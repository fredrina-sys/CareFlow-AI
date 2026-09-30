import uuid
import re
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.api.deps import current_user, require_roles
from app.db.session import get_db
from app.models import *
from app.services.access import access_level, doctor_of, patient_of, doctor_hospital_ids, has_emergency_access
from app.services.audit import audit
from app.services.redflags import evaluate

router = APIRouter(prefix="/api", tags=["clinical"])
DX_STATUS = "ACTIVE|IMPROVING|RESOLVED|CHRONIC|RULED_OUT"

def get_patient_or_404(db, pid):
    p = db.get(Patient, pid)
    if not p or not p.is_active: raise HTTPException(404, "Patient not found")
    return p

def authorize(db, user, patient):
    level, scopes = access_level(db, user, patient)
    if not level: raise HTTPException(403, "No access to this patient's record")
    return level, scopes

def event(db, patient_id, hospital_id, etype, title, detail=None, ref=None):
    db.add(TimelineEvent(patient_id=patient_id, hospital_id=hospital_id, event_type=etype, title=title, detail=detail, ref_id=ref))

def enc_out(e, db: Session = None):
    out = {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in {
        "id": e.id, "patient_id": e.patient_id, "hospital_id": e.hospital_id,
        "department_id": e.department_id, "doctor_id": e.doctor_id,
        "token_number": getattr(e, "token_number", None) or f"TK-{str(e.id)[:4].upper()}",
        "status": e.status, "priority": e.priority, "chief_complaint": e.chief_complaint,
        "symptoms": e.symptoms, "exam_findings": e.exam_findings,
        "temperature_c": e.temperature_c, "bp_systolic": e.bp_systolic,
        "bp_diastolic": e.bp_diastolic, "pulse": e.pulse, "spo2": e.spo2
    }.items()}
    if db:
        if e.hospital_id:
            hosp = db.get(Hospital, e.hospital_id)
            if hosp:
                out["hospital_name"] = hosp.name
                out["hospital_city"] = hosp.city
        if e.department_id:
            dept = db.get(Department, e.department_id)
            if dept: out["department_name"] = dept.name
        if e.doctor_id:
            doc = db.get(Doctor, e.doctor_id)
            if doc:
                du = db.get(User, doc.user_id)
                out["doctor_name"] = du.full_name if du else "Doctor"
                out["doctor_specialty"] = doc.specialty or "Specialist"
                out["doctor_registration_no"] = doc.registration_no
        
        is_em = (e.priority == "EMERGENCY") or ("EMERGENCY" in (e.token_number or ""))
        out["doctor_assignment_pending"] = bool(
            e.doctor_id is None and e.status in ("WAITING", "TRIAGED") and db.scalar(
                select(TimelineEvent.id).where(
                    TimelineEvent.ref_id == e.id,
                    TimelineEvent.event_type == "DOCTOR_UNAVAILABLE"
                ).limit(1)
            )
        )
        if out["doctor_assignment_pending"]:
            last_unavailable = db.scalar(select(AuditLog).where(
                AuditLog.action == "DOCTOR_UNAVAILABLE",
                AuditLog.resource_type == "encounter",
                AuditLog.resource_id == str(e.id)
            ).order_by(AuditLog.created_at.desc()).limit(1))
            out["unavailable_doctor_id"] = (last_unavailable.meta or {}).get("doctor_id") if last_unavailable else None
        out["is_emergency_bypass"] = is_em
        if is_em:
            out["queue_position"] = 0
            out["waiting_ahead"] = 0
            out["estimated_wait_mins"] = 0
            out["emergency_status"] = "DIRECT_ER_ADMISSION"
        elif e.status in ("WAITING", "TRIAGED"):
            ahead_filter = [
                Encounter.hospital_id == e.hospital_id,
                Encounter.status.in_(["WAITING", "TRIAGED"]),
                Encounter.created_at < e.created_at
            ]
            if e.doctor_id:
                ahead_filter.append(Encounter.doctor_id == e.doctor_id)
            ahead = db.scalar(select(func.count(Encounter.id)).where(*ahead_filter)) or 0
            out["queue_position"] = ahead + 1
            out["waiting_ahead"] = ahead
            out["estimated_wait_mins"] = ahead * 10
        else:
            out["queue_position"] = 0
            out["waiting_ahead"] = 0
            out["estimated_wait_mins"] = 0
    return out

def visible(scopes, name): return scopes is None or name in scopes

def record(db, user, p, level, scopes):
    """Provenance-tagged record, filtered by role/consent scope. Patients don't see notes unless flagged visible."""
    out = {"id": str(p.id), "full_name": p.full_name, "gender": p.gender, "dob": p.dob.isoformat() if p.dob else None,
           "preferred_language": p.preferred_language, "access": level}
    if level == "SHARED" and user.role.name == "DOCTOR":
        out["emergency_access"] = has_emergency_access(db, user, p)
    if visible(scopes, "ALLERGIES"):
        out["allergies"] = [{"substance": a.substance, "severity": a.severity, "reaction": a.reaction, "provenance": a.provenance}
                            for a in db.scalars(select(Allergy).where(Allergy.patient_id == p.id, Allergy.is_active))]
    if visible(scopes, "DIAGNOSES"):
        out["diagnoses"] = [{"id": str(d.id), "name": d.name, "status": d.status, "provenance": d.provenance, "date": d.created_at.isoformat()}
                            for d in db.scalars(select(Diagnosis).where(Diagnosis.patient_id == p.id).order_by(Diagnosis.created_at.desc()))]
    if visible(scopes, "PRESCRIPTIONS"):
        out["prescriptions"] = [{"id": str(r.id), "date": r.created_at.isoformat(), "items": [
            {"medicine": i.medicine_name, "dosage": i.dosage, "frequency": i.frequency, "duration": i.duration} for i in r.items]}
            for r in db.scalars(select(Prescription).where(Prescription.patient_id == p.id).order_by(Prescription.created_at.desc()))]
    if visible(scopes, "NOTES"):
        q = select(DoctorNote).where(DoctorNote.patient_id == p.id).order_by(DoctorNote.created_at.desc())
        if user.role.name == "PATIENT": q = q.where(DoctorNote.visible_to_patient)
        out["notes"] = [{"type": n.note_type, "text": n.text, "date": n.created_at.isoformat()} for n in db.scalars(q)]
    return out

class PatientIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200); dob: date | None = None; gender: str | None = None
    preferred_language: str = "en"; phone: str | None = None

@router.post("/patients", status_code=201)
def create_patient(b: PatientIn, u=Depends(require_roles("TRIAGE", "DOCTOR")), db: Session = Depends(get_db)):
    p = Patient(**b.model_dump()); db.add(p); db.flush(); audit(db, u, "PATIENT_CREATED", "patient", p.id, p.id); db.commit()
    return {"id": str(p.id), "full_name": p.full_name}

@router.get("/patients")
def list_patients(u=Depends(require_roles("TRIAGE", "DOCTOR", "PATIENT")), db: Session = Depends(get_db)):
    """Staff see only patients with an encounter at their own hospital(s); patients see themselves."""
    if u.role.name == "PATIENT":
        p = patient_of(db, u); return [{"id": str(p.id), "full_name": p.full_name}] if p else []
    hosp = {u.hospital_id} if u.role.name == "TRIAGE" else doctor_hospital_ids(db, doctor_of(db, u))
    ids = set(db.scalars(select(Encounter.patient_id).where(Encounter.hospital_id.in_(hosp))))
    return [{"id": str(p.id), "full_name": p.full_name} for p in db.scalars(select(Patient).where(Patient.id.in_(ids)))] if ids else []

@router.get("/patients/{pid}")
def get_patient(pid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, pid); level, scopes = authorize(db, u, p)
    audit(db, u, "SHARED_RECORD_ACCESSED" if level == "SHARED" else "PATIENT_VIEWED", "patient", p.id, p.id,
          {"scopes": sorted(scopes)} if scopes else None)
    db.commit(); return record(db, u, p, level, scopes)

@router.get("/patients/{pid}/timeline")
def timeline(pid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, pid); level, scopes = authorize(db, u, p)
    emergency = level == "SHARED" and u.role.name == "DOCTOR" and has_emergency_access(db, u, p)
    if level == "SHARED" and not emergency: raise HTTPException(403, "Timeline is not part of shared scopes")
    if emergency:
        audit(db, u, "EMERGENCY_BREAK_GLASS_ACCESSED", "timeline", p.id, p.id, {"view": "patient_timeline"})
        db.commit()
    return [{"type": e.event_type, "title": e.title, "detail": e.detail, "at": e.occurred_at.isoformat()}
            for e in db.scalars(select(TimelineEvent).where(TimelineEvent.patient_id == pid).order_by(TimelineEvent.occurred_at.desc()))]

@router.get("/patients/{pid}/active-encounter")
def get_active_encounter(pid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, pid); level, scopes = authorize(db, u, p)
    e = db.scalar(
        select(Encounter)
        .where(
            Encounter.patient_id == p.id,
            Encounter.status.in_(["WAITING", "TRIAGED", "IN_CONSULT"])
        )
        .order_by(Encounter.created_at.desc())
    )
    if not e:
        e = db.scalar(
            select(Encounter)
            .where(Encounter.patient_id == p.id)
            .order_by(Encounter.created_at.desc())
        )
    if not e:
        return None
    return enc_out(e, db)

class EncounterIn(BaseModel):
    patient_id: uuid.UUID
    hospital_id: uuid.UUID | None = None
    chief_complaint: str | None = None
    symptoms: str | None = None
    priority: str | None = Field("ROUTINE", pattern="^(ROUTINE|URGENT|EMERGENCY)$")
    interview_qa: list[dict] | None = None

class EncounterPatch(BaseModel):
    status: str | None = Field(None, pattern="^(WAITING|TRIAGED|IN_CONSULT|COMPLETED|CANCELLED)$")
    priority: str | None = Field(None, pattern="^(ROUTINE|URGENT|EMERGENCY)$")
    chief_complaint: str | None = None; symptoms: str | None = None; exam_findings: str | None = None
    temperature_c: float | None = Field(None, ge=30, le=45); bp_systolic: int | None = Field(None, ge=40, le=300)
    bp_diastolic: int | None = Field(None, ge=20, le=200); pulse: int | None = Field(None, ge=20, le=300); spo2: int | None = Field(None, ge=50, le=100)

class TriageRecommendIn(BaseModel):
    chief_complaint: str | None = None
    symptoms: str | None = None
    preferred_hospital_id: uuid.UUID | None = None
    priority: str | None = None
    exclude_doctor_ids: list[uuid.UUID] = Field(default_factory=list)

def ai_triage_routing(
    db: Session,
    complaint: str | None,
    symptoms: str | None,
    preferred_hosp_id: uuid.UUID | None = None,
    forced_priority: str | None = None,
    excluded_doctor_ids: set[uuid.UUID] | None = None
):
    text_corpus = f"{complaint or ''} {symptoms or ''}".lower()
    
    # Emergency red flags (bilingual Kannada & English)
    emergency_keywords = [
        "chest pain", "heart attack", "unconscious", "stroke", "severe bleeding",
        "shortness of breath", "severe breathlessness", "paralysis", "collapse",
        "severe trauma", "head injury", "anaphylaxis", "poisoning", "choking",
        "seizure", "stemi", "accident", "bleeding profusely",
        "\u0c8e\u0ca6 \u0ca8\u0ccb\u0cb5\u0cc1",
        "\u0c89\u0cb8\u0cbf\u0cb0\u0cbe\u0c9f\u0ca6 \u0ca4\u0cca\u0c82\u0ca6\u0cb0\u0cc6",
        "\u0caa\u0ccd\u0cb0\u0c9c\u0ccd\u0c9e\u0cc6 \u0ca4\u0caa\u0ccd\u0caa\u0cbf\u0ca6\u0cc6",
        "\u0ca4\u0cc0\u0cb5\u0ccd\u0cb0 \u0cb0\u0c95\u0ccd\u0ca4\u0cb8\u0ccd\u0cb0\u0cbe\u0cb5",
    ]

    def has_any(keywords):
        for k in keywords:
            if not k:
                continue
            if k.isascii() and len(k) <= 5:
                if re.search(r'\b' + re.escape(k) + r'\b', text_corpus, re.I):
                    return True
            else:
                if k in text_corpus:
                    return True
        return False

    is_emergency = (forced_priority == "EMERGENCY") or has_any(emergency_keywords)

    if is_emergency:
        dept_search = "Emergency"
        dept_name = "Emergency & Critical Care (24x7 ER)"
        dept_code = "EMRG"
        priority = "EMERGENCY"
        reason = "Immediate Level-1 Emergency & Trauma Care assigned due to acute red-flag symptoms."
    elif has_any(["heart", "cardiac", "chest tightness", "palpitation", "high bp", "hypertension", "angina", "arrhythmia", "ಎದೆ ಬಡಿತ", "ರಕ್ತದೊತ್ತಡ"]):
        dept_search = "Cardiology"
        dept_name = "Cardiology & Cardiac Sciences"
        dept_code = "CARDIO"
        priority = "URGENT"
        reason = "Cardiovascular evaluation recommended for cardiac/chest symptoms."
    elif has_any(["bone", "joint", "fracture", "knee", "back", "ankle", "sprain", "fall", "spine", "arthritis", "ligament", "shoulder", "hip", "ಮೂಳೆ", "ಕೀಲು", "ಸೊಂಟ", "ಕಾಲು", "ಬೆನ್ನು ನೋವು"]):
        dept_search = "Orthopaedics"
        dept_name = "Orthopaedics & Joint Care"
        dept_code = "ORTHO"
        priority = "ROUTINE"
        reason = "Orthopaedic surgeon assigned for musculoskeletal assessment."
    elif has_any(["ear", "ears", "throat", "hearing", "tinnitus", "sinus", "nose", "tonsil", "ear pain", "ear discharge", "vertigo", "nasal", "hoarseness", "ಕಿವಿ", "ಮೂಗು", "ಗಂಟಲು", "ಕೀವು"]):
        dept_search = "ENT"
        dept_name = "ENT (Ear, Nose, Throat)"
        dept_code = "ENT"
        priority = "ROUTINE"
        reason = "ENT & Otolaryngology specialist matched for ear, nose, or throat symptoms."
    elif has_any(["child", "baby", "infant", "pediatric", "kid", "newborn", "toddler", "vaccine", "vaccination", "ಮಗು", "ಮಕ್ಕಳ"]):
        dept_search = "Paediatrics"
        dept_name = "Paediatrics & Neonatology"
        dept_code = "PAED"
        priority = "ROUTINE"
        reason = "Paediatrician assigned for specialized child health care."
    elif has_any(["asthma", "lung", "lungs", "cough", "wheezing", "phlegm", "bronchitis", "respiratory", "inhaler", "ಕೆಮ್ಮು", "ಉಬ್ಬಸ", "ಕಫ"]):
        dept_search = "Pulmonology"
        dept_name = "Pulmonology & Chest Medicine"
        dept_code = "PULMO"
        priority = "ROUTINE"
        reason = "Pulmonologist assigned for respiratory and chest evaluation."
    elif has_any(["skin", "rash", "itching", "eczema", "acne", "allergy skin", "psoriasis", "hives", "boil", "fungal", "ಚರ್ಮ", "ತುರಿಕೆ"]):
        dept_search = "Dermatology"
        dept_name = "Dermatology & Cosmetology"
        dept_code = "DERM"
        priority = "ROUTINE"
        reason = "Dermatologist assigned for skin and allergic conditions."
    elif has_any(["stomach", "gastric", "acidity", "vomit", "vomiting", "diarrhea", "abdomen", "abdominal", "constipation", "liver", "nausea", "motion", "ಹೊಟ್ಟೆ ನೋವು", "ವಾಂತಿ", "ಭೇದಿ"]):
        dept_search = "Gastroenterology"
        dept_name = "Gastroenterology"
        dept_code = "GASTRO"
        priority = "ROUTINE"
        reason = "Gastroenterology specialist assigned for digestive symptoms."
    elif any(k in text_corpus for k in ["numbness", "headache", "migraine", "dizziness", "tremor", "tremors", "nerve", "sciatica", "fainting", "memory", "ತಲೆನೋವು", "ನರ"]):
        dept_search = "Neurology"
        dept_name = "Neurology & Neuro Surgery"
        dept_code = "NEURO"
        priority = "ROUTINE"
        reason = "Neurologist assigned for neurological evaluation."
    else:
        dept_search = "General Medicine"
        dept_name = "General Medicine"
        dept_code = "GM"
        priority = "ROUTINE"
        reason = "General Physician assigned for comprehensive medical examination."

    # 1. Hospital Selection with City/Specialty Intelligence & Multi-Hospital Load Balancing
    hosp = None
    if preferred_hosp_id:
        hosp = db.get(Hospital, preferred_hosp_id)
    
    if not hosp or not hosp.is_active:
        candidate_hosps = db.scalars(
            select(Hospital)
            .join(Department, Department.hospital_id == Hospital.id)
            .where(Hospital.is_active, Department.name.ilike(f"%{dept_search}%"))
        ).all()

        if candidate_hosps:
            # City keyword detection from complaint/symptoms
            city_keywords = {
                "mangaluru": "Mangaluru", "mangalore": "Mangaluru",
                "udupi": "Udupi",
                "manipal": "Manipal",
                "bengaluru": "Bengaluru", "bangalore": "Bengaluru"
            }
            matched_city = None
            for kw, cname in city_keywords.items():
                if kw in text_corpus:
                    matched_city = cname
                    break

            city_filtered = [h for h in candidate_hosps if h.city == matched_city] if matched_city else []
            eligible_hosps = city_filtered if city_filtered else candidate_hosps

            # Centers of Excellence priority
            specialty_preferences = {
                "Cardiology": ["Fortis", "Narayana", "Apollo"],
                "Emergency": ["Manipal", "Sunrise", "Fortis", "Narayana"],
                "ENT": ["Sunrise", "Lakeview", "KMC", "Apollo"],
                "Orthopaedics": ["Manipal", "Apollo", "Narayana", "Sunrise"],
                "Pulmonology": ["Apollo", "Fortis", "Sunrise"],
                "Paediatrics": ["Lakeview", "Sunrise"],
                "Dermatology": ["Sunrise", "Lakeview"],
                "Gastroenterology": ["Apollo", "Narayana"],
                "Neurology": ["Manipal", "Apollo"]
            }
            preferred_names = specialty_preferences.get(dept_search, [])

            # Dynamic Hospital Load Balancing: evaluate active patient queue at each hospital
            hosp_loads = []
            for h in eligible_hosps:
                # Count waiting/in_consult encounters at this hospital
                active_hosp_q = db.scalar(
                    select(func.count(Encounter.id)).where(
                        Encounter.hospital_id == h.id,
                        Encounter.status.in_(["WAITING", "IN_CONSULT"])
                    )
                ) or 0
                
                # Bonus score for specialty center of excellence
                excellence_bonus = 0
                for rank, pref in enumerate(preferred_names):
                    if pref.lower() in h.name.lower():
                        excellence_bonus = len(preferred_names) - rank
                        break

                hosp_loads.append({
                    "hospital": h,
                    "active_queue": active_hosp_q,
                    "bonus": excellence_bonus
                })

            # Sort by least loaded first, with bonus for center of excellence
            # Effective score = active_queue - (excellence_bonus * 0.5)
            hosp_loads.sort(key=lambda x: (x["active_queue"] - (x["bonus"] * 0.5), x["hospital"].name))
            hosp = hosp_loads[0]["hospital"]
        else:
            hosp = db.scalar(select(Hospital).where(Hospital.is_active))
            
    if not hosp:
        raise HTTPException(500, "No active hospital configured in the system.")

    # 2. Department Selection
    dept = db.scalar(select(Department).where(Department.hospital_id == hosp.id, Department.name.ilike(f"%{dept_search}%")))
    if not dept:
        dept = db.scalar(select(Department).where(Department.hospital_id == hosp.id, Department.name.ilike("%General Medicine%")))
    if not dept:
        dept = db.scalar(select(Department).where(Department.hospital_id == hosp.id))
    dept_id = dept.id if dept else None

    # 3. Doctor Selection with TRUE LOAD BALANCING (Distributes patients evenly across doctors!)
    doc_assignments = db.scalars(select(DoctorHospitalAssignment).where(
        DoctorHospitalAssignment.hospital_id == hosp.id,
        DoctorHospitalAssignment.department_id == dept_id,
        DoctorHospitalAssignment.is_active
    )).all()
    
    if not doc_assignments:
        doc_assignments = db.scalars(select(DoctorHospitalAssignment).where(
            DoctorHospitalAssignment.hospital_id == hosp.id,
            DoctorHospitalAssignment.is_active
        )).all()

    candidate_doctors_info = []
    for asgn in doc_assignments:
        doc_obj = db.get(Doctor, asgn.doctor_id)
        if not doc_obj:
            continue
        user_obj = db.get(User, doc_obj.user_id)
        if not user_obj or not user_obj.is_active:
            continue
            
        # Active queue count
        active_queue = db.scalar(select(func.count(Encounter.id)).where(
            Encounter.doctor_id == doc_obj.id,
            Encounter.status.in_(["WAITING", "IN_CONSULT"])
        )) or 0

        # Total historical encounters assigned to this doctor (for fair tie-breaking)
        total_assigned = db.scalar(select(func.count(Encounter.id)).where(
            Encounter.doctor_id == doc_obj.id
        )) or 0
        
        candidate_doctors_info.append({
            "doctor": doc_obj,
            "user": user_obj,
            "queue_count": active_queue,
            "total_assigned": total_assigned
        })
        
    if excluded_doctor_ids:
        candidate_doctors_info = [c for c in candidate_doctors_info if c["doctor"].id not in excluded_doctor_ids]

    if candidate_doctors_info:
        # Load balance: pick doctor with minimum active queue, then minimum total encounters
        candidate_doctors_info.sort(key=lambda x: (x["queue_count"], x["total_assigned"], str(x["doctor"].id)))
        chosen_doc = candidate_doctors_info[0]["doctor"]
        doc_user = candidate_doctors_info[0]["user"]
        active_q = candidate_doctors_info[0]["queue_count"]
    elif excluded_doctor_ids:
        chosen_doc = None
        doc_user = None
        active_q = 0
    else:
        first_doc = db.scalar(select(Doctor))
        if first_doc:
            chosen_doc = first_doc
            doc_user = db.get(User, chosen_doc.user_id)
            active_q = 0
        else:
            chosen_doc = None
            doc_user = None
            active_q = 0

    return {
        "hospital_id": hosp.id,
        "hospital_name": hosp.name,
        "hospital_city": hosp.city,
        "department_id": dept_id,
        "department_name": dept.name if dept else dept_name,
        "dept_code": dept_code,
        "doctor_id": chosen_doc.id if chosen_doc else None,
        "doctor_name": doc_user.full_name if doc_user else "On-Call Specialist",
        "doctor_specialty": chosen_doc.specialty if chosen_doc else "Specialist",
        "doctor_registration_no": chosen_doc.registration_no if chosen_doc else "DEMO-KMC",
        "doctor_active_queue": active_q,
        "is_emergency": is_emergency,
        "priority": priority,
        "triage_reason": reason,
        "candidate_doctors": [
            {
                "id": str(c["doctor"].id),
                "name": c["user"].full_name,
                "specialty": c["doctor"].specialty,
                "active_queue": c["queue_count"]
            }
            for c in candidate_doctors_info
        ]
    }

@router.post("/triage/recommend")
def recommend_triage(
    b: TriageRecommendIn,
    u=Depends(current_user),
    db: Session = Depends(get_db)
):
    routing = ai_triage_routing(
        db=db,
        complaint=b.chief_complaint,
        symptoms=b.symptoms,
        preferred_hosp_id=b.preferred_hospital_id,
        forced_priority=b.priority,
        excluded_doctor_ids=set(b.exclude_doctor_ids)
    )
    
    # Also fetch alternative hospitals that have this department
    all_hosps = db.scalars(select(Hospital).where(Hospital.is_active)).all()
    alternatives = [
        {
            "id": str(h.id),
            "name": h.name,
            "city": h.city,
            "is_recommended": h.id == routing["hospital_id"]
        }
        for h in all_hosps
    ]
    
    return {
        "department_name": routing["department_name"],
        "dept_code": routing["dept_code"],
        "priority": routing["priority"],
        "is_emergency_bypass": routing["is_emergency"],
        "emergency_alert": "CRITICAL: Immediate ER bypass required. Direct casualty admission." if routing["is_emergency"] else None,
        "triage_reason": routing["triage_reason"],
        "recommended_hospital": {
            "id": str(routing["hospital_id"]),
            "name": routing["hospital_name"],
            "city": routing["hospital_city"]
        },
        "recommended_doctor": {
            "id": str(routing["doctor_id"]) if routing["doctor_id"] else None,
            "name": routing["doctor_name"],
            "specialty": routing["doctor_specialty"],
            "registration_no": routing["doctor_registration_no"],
            "active_queue": routing["doctor_active_queue"],
            "estimated_wait_mins": routing["doctor_active_queue"] * 10 if not routing["is_emergency"] else 0
        },
        "candidate_doctors": routing["candidate_doctors"],
        "hospitals": alternatives
    }

@router.post("/encounters", status_code=201)
def create_encounter(b: EncounterIn, u=Depends(require_roles("PATIENT", "TRIAGE", "DOCTOR")), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, b.patient_id)
    if u.role.name == "PATIENT":
        me = patient_of(db, u)
        if not me or me.id != p.id: raise HTTPException(403, "Cannot book for another patient")
        hosp_req = b.hospital_id
    else:
        hosp_req = u.hospital_id or b.hospital_id

    # Intelligent AI routing and doctor load balancing
    routing = ai_triage_routing(
        db=db,
        complaint=b.chief_complaint,
        symptoms=b.symptoms,
        preferred_hosp_id=hosp_req,
        forced_priority=b.priority
    )

    hosp = routing["hospital_id"]
    dept_id = routing["department_id"]
    doc_id = routing["doctor_id"]
    dept_code = routing["dept_code"]
    is_emergency = routing["is_emergency"]
    final_priority = routing["priority"]

    if u.role.name == "DOCTOR":
        doc_id = doctor_of(db, u).id

    # Generate token number for today
    count_today = db.scalar(select(func.count(Encounter.id)).where(Encounter.hospital_id == hosp)) or 0
    if is_emergency:
        token_num = f"EMERGENCY-BYPASS-{count_today + 1:02d}"
    else:
        token_num = f"TK-{dept_code}-{count_today + 1:02d}"

    e = Encounter(
        patient_id=p.id,
        hospital_id=hosp,
        department_id=dept_id,
        doctor_id=doc_id,
        token_number=token_num,
        chief_complaint=b.chief_complaint,
        symptoms=b.symptoms,
        priority=final_priority
    )
    if u.role.name == "DOCTOR":
        e.status = "IN_CONSULT"
    db.add(e)
    db.flush()
    if b.interview_qa:
        interview = ClinicalInterview(encounter_id=e.id)
        db.add(interview)
        db.flush()
        for item in b.interview_qa:
            q_text = item.get("question") or item.get("q")
            a_text = item.get("answer") or item.get("a")
            if q_text:
                cq = ClinicalQuestion(interview_id=interview.id, text=q_text, source="AI_GENERATED")
                db.add(cq)
                db.flush()
                if a_text:
                    ca = ClinicalAnswer(question_id=cq.id, text=a_text, source="PATIENT_PROVIDED")
                    db.add(ca)
    audit(db, u, "ENCOUNTER_CREATED", "encounter", e.id, p.id)
    ev_type = "EMERGENCY_BYPASS" if is_emergency else "OPD_VISIT"
    ev_title = f"🚨 EMERGENCY BYPASS ACTIVATED — Token: {token_num}" if is_emergency else f"OPD encounter opened ({e.priority}) — Token: {token_num}"
    event(db, p.id, hosp, ev_type, ev_title, b.chief_complaint, e.id)
    db.commit()
    return enc_out(e, db)

def encounter_for_user(db, u, eid):
    e = db.get(Encounter, eid)
    if not e: raise HTTPException(404, "Encounter not found")
    role = u.role.name
    if role == "PATIENT":
        p = patient_of(db, u)
        if not p or p.id != e.patient_id: raise HTTPException(403, "Not your encounter")
        return e
    ok = (role == "TRIAGE" and u.hospital_id == e.hospital_id) or (role == "DOCTOR" and e.hospital_id in doctor_hospital_ids(db, doctor_of(db, u)))
    if not ok: raise HTTPException(403, "Encounter belongs to another hospital")
    return e

@router.get("/encounters/{eid}")
def get_encounter(eid: uuid.UUID, u=Depends(require_roles("PATIENT", "TRIAGE", "DOCTOR")), db: Session = Depends(get_db)):
    e = encounter_for_user(db, u, eid); out = enc_out(e, db)
    out["red_flags"] = [{"code": f.code, "message": f.message, "severity": f.severity,
                         "disclaimer": "Clinical alert — requires professional assessment."} for f in db.scalars(select(RedFlag).where(RedFlag.encounter_id == e.id))]
    interview = db.scalar(select(ClinicalInterview).where(ClinicalInterview.encounter_id == e.id))
    if interview:
        qas = []
        cqs = list(db.scalars(select(ClinicalQuestion).where(ClinicalQuestion.interview_id == interview.id)))
        for cq in cqs:
            ans = db.scalar(select(ClinicalAnswer).where(ClinicalAnswer.question_id == cq.id))
            qas.append({"question": cq.text, "answer": ans.text if ans else ""})
        out["interview"] = qas
    else:
        out["interview"] = []
    return out

@router.patch("/encounters/{eid}")
def patch_encounter(eid: uuid.UUID, b: EncounterPatch, u=Depends(require_roles("TRIAGE", "DOCTOR")), db: Session = Depends(get_db)):
    e = encounter_for_user(db, u, eid); data = b.model_dump(exclude_unset=True)
    if u.role.name == "TRIAGE" and set(data) - {"priority", "chief_complaint", "symptoms", "temperature_c", "bp_systolic", "bp_diastolic", "pulse", "spo2", "status"}:
        raise HTTPException(403, "Triage cannot edit this field")
    if u.role.name == "TRIAGE" and data.get("status") not in (None, "WAITING", "TRIAGED"): raise HTTPException(403, "Triage can only set WAITING/TRIAGED")
    for k, v in data.items(): setattr(e, k, v)
    if u.role.name == "DOCTOR" and not e.doctor_id: e.doctor_id = doctor_of(db, u).id
    if data.get("status") == "COMPLETED":
        e.completed_at = datetime.now(timezone.utc); event(db, e.patient_id, e.hospital_id, "ENCOUNTER_COMPLETED", "OPD visit completed", None, e.id)
    allergies = list(db.scalars(select(Allergy).where(Allergy.patient_id == e.patient_id, Allergy.is_active)))
    db.query(RedFlag).filter(RedFlag.encounter_id == e.id).delete()
    for f in evaluate(e, allergies): db.add(RedFlag(encounter_id=e.id, code=f["code"], message=f["message"], severity=f["severity"]))
    db.commit(); return enc_out(e, db)

class DoctorUnavailableIn(BaseModel):
    reason: str = Field(default="Doctor unavailable", min_length=3, max_length=300)

class ReassignDoctorIn(BaseModel):
    doctor_id: uuid.UUID

@router.post("/encounters/{eid}/doctor-unavailable")
def doctor_unavailable(eid: uuid.UUID, b: DoctorUnavailableIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e = encounter_for_user(db, u, eid)
    doc = doctor_of(db, u)
    if not doc or e.doctor_id != doc.id:
        raise HTTPException(403, "Only the doctor assigned to this patient can mark themselves unavailable")
    if e.status not in ("WAITING", "TRIAGED", "IN_CONSULT"):
        raise HTTPException(409, "Only an active encounter can be released")
    if e.status == "IN_CONSULT":
        e.status = "WAITING"
    e.doctor_id = None
    audit(db, u, "DOCTOR_UNAVAILABLE", "encounter", e.id, e.patient_id, {"doctor_id": str(doc.id)})
    event(db, e.patient_id, e.hospital_id, "DOCTOR_UNAVAILABLE", "Your assigned doctor is unavailable", "Choose another available doctor to keep your place in the queue.", e.id)
    db.commit()
    return enc_out(e, db)

@router.post("/encounters/{eid}/reassign-doctor")
def reassign_doctor(eid: uuid.UUID, b: ReassignDoctorIn, u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    e = encounter_for_user(db, u, eid)
    if e.status not in ("WAITING", "TRIAGED") or e.doctor_id is not None:
        raise HTTPException(409, "This encounter is no longer waiting for a doctor choice")
    assignment = db.scalar(select(DoctorHospitalAssignment).where(
        DoctorHospitalAssignment.doctor_id == b.doctor_id,
        DoctorHospitalAssignment.hospital_id == e.hospital_id,
        DoctorHospitalAssignment.is_active
    ))
    if not assignment:
        raise HTTPException(422, "Choose an available doctor at the selected hospital")
    same_department_exists = bool(e.department_id and db.scalar(select(DoctorHospitalAssignment.id).where(
        DoctorHospitalAssignment.hospital_id == e.hospital_id,
        DoctorHospitalAssignment.department_id == e.department_id,
        DoctorHospitalAssignment.is_active
    ).limit(1)))
    if same_department_exists and assignment.department_id != e.department_id:
        raise HTTPException(422, "Choose a doctor in the department assigned to this visit")
    e.doctor_id = b.doctor_id
    chosen = db.get(Doctor, b.doctor_id)
    chosen_user = db.get(User, chosen.user_id)
    audit(db, u, "DOCTOR_REASSIGNED_BY_PATIENT", "encounter", e.id, e.patient_id, {"doctor_id": str(chosen.id)})
    event(db, e.patient_id, e.hospital_id, "DOCTOR_REASSIGNED", "Your doctor has been updated", f"Assigned to {chosen_user.full_name}.", e.id)
    db.commit()
    return enc_out(e, db)

class DiagnosisIn(BaseModel):
    encounter_id: uuid.UUID; name: str = Field(min_length=1, max_length=255); status: str = Field("ACTIVE", pattern=f"^({DX_STATUS})$")
class MedItem(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=200); dosage: str; route: str = "ORAL"; frequency: str; duration: str; instructions: str | None = None
class PrescriptionIn(BaseModel):
    encounter_id: uuid.UUID; items: list[MedItem] = Field(min_length=1); instructions: str | None = None
class NoteIn(BaseModel):
    encounter_id: uuid.UUID; text: str = Field(min_length=1); note_type: str = Field("CLINICAL_NOTE", pattern="^(CLINICAL_NOTE|IMPORTANT_FOR_FUTURE_DOCTORS)$")
    visible_to_patient: bool = False
class FollowUpIn(BaseModel):
    encounter_id: uuid.UUID; due_date: date; reason: str | None = None

encounter_for_staff = encounter_for_user

def doctor_enc(db, u, eid):
    e = encounter_for_user(db, u, eid); return e, doctor_of(db, u)

@router.post("/diagnoses", status_code=201)
def add_diagnosis(b: DiagnosisIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e, doc = doctor_enc(db, u, b.encounter_id)
    d = Diagnosis(patient_id=e.patient_id, encounter_id=e.id, name=b.name, status=b.status, entered_by=doc.id); db.add(d); db.flush()
    audit(db, u, "DIAGNOSIS_CREATED", "diagnosis", d.id, e.patient_id); event(db, e.patient_id, e.hospital_id, "DIAGNOSIS", f"Diagnosis: {b.name}", b.status, d.id)
    db.commit(); return {"id": str(d.id)}

@router.post("/prescriptions", status_code=201)
def add_prescription(b: PrescriptionIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e, doc = doctor_enc(db, u, b.encounter_id)
    rx = Prescription(patient_id=e.patient_id, encounter_id=e.id, doctor_id=doc.id, instructions=b.instructions)
    rx.items = [PrescriptionItem(**i.model_dump()) for i in b.items]; db.add(rx); db.flush()
    allergies = list(db.scalars(select(Allergy).where(Allergy.patient_id == e.patient_id, Allergy.is_active)))
    conflicts = [f for f in evaluate(e, allergies, [i.medicine_name for i in b.items]) if f["code"] == "MED_ALLERGY_CONFLICT"]
    for f in conflicts: db.add(RedFlag(encounter_id=e.id, code=f["code"], message=f["message"], severity=f["severity"]))
    audit(db, u, "PRESCRIPTION_CREATED", "prescription", rx.id, e.patient_id); event(db, e.patient_id, e.hospital_id, "PRESCRIPTION", "Prescription issued", ", ".join(i.medicine_name for i in b.items), rx.id)
    db.commit(); return {"id": str(rx.id), "alerts": conflicts}

@router.get("/prescriptions/{rid}")
def get_prescription(rid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    rx = db.get(Prescription, rid)
    if not rx: raise HTTPException(404, "Prescription not found")
    p = db.get(Patient, rx.patient_id); level, scopes = authorize(db, u, p)
    if not visible(scopes, "PRESCRIPTIONS"): raise HTTPException(403, "Prescriptions not shared")
    enc = db.get(Encounter, rx.encounter_id); doc = db.get(Doctor, rx.doctor_id); du = db.get(User, doc.user_id); h = db.get(Hospital, enc.hospital_id)
    dx = [d.name for d in db.scalars(select(Diagnosis).where(Diagnosis.encounter_id == enc.id))]
    fu = db.scalar(select(FollowUp).where(FollowUp.encounter_id == enc.id))
    return {"id": str(rx.id), "hospital": h.name, "doctor": du.full_name, "registration_no": doc.registration_no, "patient": p.full_name,
            "date": rx.created_at.date().isoformat(), "diagnoses": dx, "instructions": rx.instructions,
            "follow_up": fu.due_date.isoformat() if fu else None,
            "items": [{"medicine": i.medicine_name, "dosage": i.dosage, "route": i.route, "frequency": i.frequency, "duration": i.duration, "instructions": i.instructions} for i in rx.items]}

@router.post("/notes", status_code=201)
def add_note(b: NoteIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e, doc = doctor_enc(db, u, b.encounter_id)
    n = DoctorNote(patient_id=e.patient_id, encounter_id=e.id, doctor_id=doc.id, note_type=b.note_type, text=b.text, visible_to_patient=b.visible_to_patient)
    db.add(n); db.commit(); return {"id": str(n.id)}

@router.post("/follow-ups", status_code=201)
def add_followup(b: FollowUpIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e, _ = doctor_enc(db, u, b.encounter_id)
    f = FollowUp(patient_id=e.patient_id, encounter_id=e.id, due_date=b.due_date, reason=b.reason); db.add(f); db.flush()
    event(db, e.patient_id, e.hospital_id, "FOLLOW_UP", f"Follow-up scheduled {b.due_date}", b.reason, f.id); db.commit(); return {"id": str(f.id)}

@router.get("/queue")
def opd_queue(u=Depends(require_roles("TRIAGE", "DOCTOR")), db: Session = Depends(get_db)):
    hosp = u.hospital_id if u.role.name == "TRIAGE" else None
    current_doc = doctor_of(db, u) if u.role.name == "DOCTOR" else None
    hs = {hosp} if hosp else doctor_hospital_ids(db, current_doc)
    rank = {"EMERGENCY": 0, "URGENT": 1, "ROUTINE": 2}
    es = db.scalars(select(Encounter).where(Encounter.hospital_id.in_(hs), Encounter.status.in_(["WAITING", "TRIAGED", "IN_CONSULT"])))
    return sorted([{**enc_out(e, db), "patient_name": db.get(Patient, e.patient_id).full_name,
                    "assigned_to_me": bool(current_doc and e.doctor_id == current_doc.id)} for e in es], key=lambda x: rank[x["priority"]])

@router.get("/patients/{pid}/follow-ups")
def patient_follow_ups(pid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, pid); level, _ = authorize(db, u, p)
    if level != "FULL": raise HTTPException(403, "Follow-ups are not part of shared scopes")
    return [{"id": str(f.id), "due_date": f.due_date.isoformat(), "reason": f.reason, "status": f.status}
            for f in db.scalars(select(FollowUp).where(FollowUp.patient_id == pid).order_by(FollowUp.due_date))]
