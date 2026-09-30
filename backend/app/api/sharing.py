import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.provider import get_provider, REQUIRED_NOTICE
from app.api.clinical import authorize, get_patient_or_404, event
from app.api.deps import current_user, require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models import *
from app.ocr.service import run_ocr
from app.services.access import ALL_SCOPES, doctor_of, patient_of, doctor_hospital_ids
from app.services.audit import audit
from app.services.redflags import evaluate
from app.services.storage import storage

router = APIRouter(prefix="/api", tags=["sharing-ai-docs"])

# ---------- consent & sharing (patient-controlled) ----------
class ConsentIn(BaseModel):
    purpose: str = "Continuity of care"
class PermissionIn(BaseModel):
    consent_id: uuid.UUID; hospital_id: uuid.UUID; doctor_id: uuid.UUID | None = None
    scope: list[str] = Field(min_length=1); expires_at: datetime | None = None

def my_patient(db, u):
    p = patient_of(db, u)
    if not p: raise HTTPException(403, "Patient account required")
    return p

@router.post("/consents", status_code=201)
def create_consent(b: ConsentIn, u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    p = my_patient(db, u); c = Consent(patient_id=p.id, purpose=b.purpose); db.add(c); db.flush()
    audit(db, u, "CONSENT_CREATED", "consent", c.id, p.id); db.commit(); return {"id": str(c.id), "status": c.status}

@router.get("/consents")
def list_consents(u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    p = my_patient(db, u)
    return [{"id": str(c.id), "purpose": c.purpose, "status": c.status, "permissions": [
        {"id": str(m.id), "hospital_id": str(m.hospital_id), "doctor_id": str(m.doctor_id) if m.doctor_id else None, "scope": m.scope, "is_active": m.is_active}
        for m in db.scalars(select(DataSharingPermission).where(DataSharingPermission.consent_id == c.id))]}
        for c in db.scalars(select(Consent).where(Consent.patient_id == p.id))]

@router.post("/sharing/permissions", status_code=201)
def grant(b: PermissionIn, u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    p = my_patient(db, u); c = db.get(Consent, b.consent_id)
    if not c or c.patient_id != p.id or c.status != "ACTIVE": raise HTTPException(404, "Active consent not found")
    bad = set(b.scope) - set(ALL_SCOPES)
    if bad: raise HTTPException(422, f"Unknown scope: {sorted(bad)}")
    if not db.get(Hospital, b.hospital_id): raise HTTPException(404, "Hospital not found")
    m = DataSharingPermission(consent_id=c.id, patient_id=p.id, hospital_id=b.hospital_id, doctor_id=b.doctor_id, scope=b.scope, expires_at=b.expires_at)
    db.add(m); db.flush(); audit(db, u, "CONSENT_CREATED", "sharing_permission", m.id, p.id, {"hospital_id": str(b.hospital_id), "scope": b.scope})
    db.commit(); return {"id": str(m.id)}

@router.delete("/sharing/permissions/{mid}")
def revoke(mid: uuid.UUID, u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    p = my_patient(db, u); m = db.get(DataSharingPermission, mid)
    m.is_active = False; audit(db, u, "CONSENT_REVOKED", "sharing_permission", m.id, p.id); db.commit(); return {"detail": "Revoked"}

class EmergencyAccessIn(BaseModel):
    patient_id: uuid.UUID
    reason: str = Field(min_length=5, max_length=500)
    hospital_id: uuid.UUID | None = None

@router.post("/sharing/emergency-access", status_code=201)
def emergency_access(b: EmergencyAccessIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    doc = doctor_of(db, u)
    if not doc: raise HTTPException(403, "Doctor profile required")
    p = get_patient_or_404(db, b.patient_id)
    doc_hosps = doctor_hospital_ids(db, doc)
    allowed_hospitals = set(doc_hosps)
    if u.hospital_id:
        allowed_hospitals.add(u.hospital_id)
    hosp_id = b.hospital_id or u.hospital_id or (next(iter(doc_hosps)) if doc_hosps else None)
    if not hosp_id: raise HTTPException(422, "Hospital ID required")
    if hosp_id not in allowed_hospitals: raise HTTPException(403, "Emergency access can only be granted to your assigned hospital")
    
    # Keep each break-glass action in its own auditable, short-lived grant.
    c = Consent(patient_id=p.id, purpose="Emergency cross-hospital break-glass override")
    db.add(c); db.flush()
    
    m = DataSharingPermission(
        consent_id=c.id, patient_id=p.id, hospital_id=hosp_id, doctor_id=doc.id,
        scope=ALL_SCOPES, expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    db.add(m); db.flush()
    audit(db, u, "EMERGENCY_BREAK_GLASS_ACCESSED", "patient", p.id, p.id, {
        "reason": b.reason,
        "doctor_reg_no": doc.registration_no,
        "doctor_name": u.full_name,
        "hospital_id": str(hosp_id)
    })
    event(db, p.id, hosp_id, "EMERGENCY_ACCESS", f"Break-glass Emergency: Dr. {u.full_name}", b.reason, m.id)
    db.commit()
    return {
        "id": str(m.id),
        "status": "EMERGENCY_UNLOCKED",
        "doctor": u.full_name,
        "registration_no": doc.registration_no,
        "expires_in_hours": 24,
        "reason": b.reason
    }

# ---------- AI clinical summary (assistant only; doctor verifies) ----------
class SummaryIn(BaseModel):
    encounter_id: uuid.UUID
class SummaryReview(BaseModel):
    edited_content: dict | None = None

def build_ctx(db, e, p):
    age = (datetime.now(timezone.utc).date() - p.dob).days // 365 if p.dob else None
    al = list(db.scalars(select(Allergy).where(Allergy.patient_id == p.id, Allergy.is_active)))
    dx = list(db.scalars(select(Diagnosis).where(Diagnosis.patient_id == p.id)))
    rx = list(db.scalars(select(PrescriptionItem).join(Prescription).where(Prescription.patient_id == p.id, Prescription.status == "ACTIVE")))
    notes = list(db.scalars(select(DoctorNote).where(DoctorNote.patient_id == p.id)))
    return {"patient": {"name": p.full_name, "age": age, "gender": p.gender}, "chief_complaint": e.chief_complaint, "symptoms": e.symptoms,
            "allergies": [{"substance": a.substance} for a in al], "diagnoses": [{"name": d.name, "status": d.status} for d in dx],
            "medications": [f"{i.medicine_name} {i.dosage}" for i in rx], "notes": [{"type": n.note_type, "text": n.text} for n in notes],
            "red_flags": evaluate(e, al), "investigations": []}

@router.post("/ai/clinical-summary", status_code=201)
def gen_summary(b: SummaryIn, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    e = db.get(Encounter, b.encounter_id)
    if not e: raise HTTPException(404, "Encounter not found")
    p = db.get(Patient, e.patient_id); level, _ = authorize(db, u, p)
    if level != "FULL": raise HTTPException(403, "Summary requires treating-hospital access")
    content = get_provider().summarize(build_ctx(db, e, p)); content["notice"] = REQUIRED_NOTICE
    s = ClinicalSummary(patient_id=p.id, encounter_id=e.id, content=content, generated_by=u.id); db.add(s); db.flush()
    db.add(ClinicalSummaryRevision(summary_id=s.id, content=content, provenance="AI_GENERATED", changed_by=u.id, note="Initial AI draft"))
    audit(db, u, "AI_SUMMARY_GENERATED", "clinical_summary", s.id, p.id); db.commit()
    return {"id": str(s.id), "status": s.status, "provenance": s.provenance, "content": content}

def review(db, u, sid, status, body):
    s = db.get(ClinicalSummary, sid)
    if not s: raise HTTPException(404, "Summary not found")
    p = db.get(Patient, s.patient_id); level, _ = authorize(db, u, p)
    if level != "FULL": raise HTTPException(403, "No access")
    if s.status != "PENDING_REVIEW": raise HTTPException(409, f"Already {s.status}")
    if status == "CONFIRMED":
        if body.edited_content:
            s.content = {**body.edited_content, "notice": REQUIRED_NOTICE}
            db.add(ClinicalSummaryRevision(summary_id=s.id, content=s.content, provenance="DOCTOR_ENTERED", changed_by=u.id, note="Doctor edit"))
        s.provenance = "DOCTOR_VERIFIED"
    s.status = status; s.reviewed_by = u.id; s.reviewed_at = datetime.now(timezone.utc)
    db.add(ClinicalSummaryRevision(summary_id=s.id, content=s.content, provenance=s.provenance, changed_by=u.id, note=status))
    audit(db, u, f"AI_SUMMARY_{status}", "clinical_summary", s.id, p.id); db.commit()
    return {"id": str(s.id), "status": s.status, "provenance": s.provenance}

@router.post("/ai/clinical-summary/{sid}/confirm")
def confirm(sid: uuid.UUID, body: SummaryReview = SummaryReview(), u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    return review(db, u, sid, "CONFIRMED", body)

@router.post("/ai/clinical-summary/{sid}/reject")
def reject(sid: uuid.UUID, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    return review(db, u, sid, "REJECTED", SummaryReview())

# ---------- documents + OCR ----------
ALLOWED = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}
MAGIC = {"application/pdf": b"%PDF", "image/png": b"\x89PNG", "image/jpeg": b"\xff\xd8\xff"}

@router.post("/documents", status_code=201)
async def upload(file: UploadFile = File(...), patient_id: uuid.UUID = Form(...), doc_type: str = Form("OTHER"),
                 encounter_id: uuid.UUID | None = Form(None), u=Depends(require_roles("PATIENT", "DOCTOR", "TRIAGE")), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, patient_id); level, _ = authorize(db, u, p)
    if level != "FULL": raise HTTPException(403, "Upload requires treating-hospital access")
    if file.content_type not in ALLOWED: raise HTTPException(415, "Only PDF, PNG, JPG/JPEG allowed")
    data = await file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024: raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_MB} MB")
    if not data.startswith(MAGIC[file.content_type]): raise HTTPException(415, "File content does not match its type")
    key = storage.save(data, ALLOWED[file.content_type])
    d = MedicalDocument(patient_id=p.id, encounter_id=encounter_id, uploaded_by=u.id, doc_type=doc_type[:40], filename=(file.filename or "upload")[:255],
                        content_type=file.content_type, storage_key=key); db.add(d); db.flush()
    audit(db, u, "DOCUMENT_UPLOADED", "document", d.id, p.id)
    r = run_ocr(data, file.content_type)
    o = OcrResult(document_id=d.id, text=r["text"], confidence=r["confidence"], status=r["status"]); db.add(o); db.flush()
    audit(db, u, "OCR_CREATED", "ocr_result", o.id, p.id, {"status": r["status"]})
    event(db, p.id, None, "DOCUMENT", "Medical document uploaded", d.doc_type, d.id); db.commit()
    return doc_out(d, o)

def doc_out(d, o):
    return {"id": str(d.id), "filename": d.filename, "doc_type": d.doc_type, "ocr": None if not o else {
        "status": o.status, "provenance": "OCR_EXTRACTED", "review_status": o.review_status, "confidence": o.confidence, "text": o.text,
        "notice": "OCR-extracted text — not verified clinical information." if o.status == "DONE" else "OCR unavailable for this file — manual review needed."}}

def doc_and_check(db, u, did):
    d = db.get(MedicalDocument, did)
    if not d: raise HTTPException(404, "Document not found")
    level, scopes = authorize(db, u, db.get(Patient, d.patient_id))
    if level == "SHARED" and "DOCUMENTS" not in scopes: raise HTTPException(403, "Documents not shared")
    return d, level

@router.get("/documents/{did}")
def get_doc(did: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    d, level = doc_and_check(db, u, did)
    audit(db, u, "SHARED_RECORD_ACCESSED" if level == "SHARED" else "DOCUMENT_VIEWED", "document", d.id, d.patient_id); db.commit()
    return doc_out(d, db.scalar(select(OcrResult).where(OcrResult.document_id == d.id).order_by(OcrResult.created_at.desc())))

@router.post("/documents/{did}/ocr")
def rerun_ocr(did: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    d, level = doc_and_check(db, u, did)
    if level != "FULL": raise HTTPException(403, "No access")
    try: raw = storage.read(d.storage_key)
    except FileNotFoundError: raise HTTPException(404, "The stored file is missing (seed placeholder documents have no file).")
    r = run_ocr(raw, d.content_type)
    o = OcrResult(document_id=d.id, text=r["text"], confidence=r["confidence"], status=r["status"]); db.add(o); db.flush()
    audit(db, u, "OCR_CREATED", "ocr_result", o.id, d.patient_id); db.commit(); return doc_out(d, o)

class OcrReview(BaseModel):
    action: str = Field(pattern="^(ACCEPT|EDIT|REJECT)$"); edited_text: str | None = None

@router.post("/documents/{did}/ocr/review")
def review_ocr(did: uuid.UUID, b: OcrReview, u=Depends(require_roles("DOCTOR")), db: Session = Depends(get_db)):
    d, level = doc_and_check(db, u, did)
    if level != "FULL": raise HTTPException(403, "No access")
    o = db.scalar(select(OcrResult).where(OcrResult.document_id == d.id).order_by(OcrResult.created_at.desc()))
    if b.action == "EDIT" and not b.edited_text: raise HTTPException(422, "edited_text required")
    o.review_status = {"ACCEPT": "ACCEPTED", "EDIT": "EDITED", "REJECT": "REJECTED"}[b.action]
    o.reviewed_text = b.edited_text if b.action == "EDIT" else (o.text if b.action == "ACCEPT" else None); o.reviewed_by = u.id
    db.commit(); return doc_out(d, o)

# ---------- audit ----------
@router.get("/audit-logs")
def audit_logs(u=Depends(require_roles("ADMIN", "PATIENT")), db: Session = Depends(get_db)):
    """Admin: all logs. Patient: only logs about their own record."""
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)
    if u.role.name == "PATIENT": q = q.where(AuditLog.patient_id == my_patient(db, u).id)
    return [{"action": a.action, "actor_id": str(a.actor_id) if a.actor_id else None, "resource": a.resource_type, "resource_id": a.resource_id,
             "at": a.created_at.isoformat(), "meta": a.meta} for a in db.scalars(q)]

# ---------- lookups used by the UI ----------
@router.get("/patients/{pid}/documents")
def list_docs(pid: uuid.UUID, u=Depends(current_user), db: Session = Depends(get_db)):
    p = get_patient_or_404(db, pid); level, scopes = authorize(db, u, p)
    if level == "SHARED" and "DOCUMENTS" not in scopes: raise HTTPException(403, "Documents not shared")
    return [{"id": str(d.id), "filename": d.filename, "doc_type": d.doc_type, "at": d.created_at.isoformat(),
             "ocr_status": (o.status if (o := db.scalar(select(OcrResult).where(OcrResult.document_id == d.id).order_by(OcrResult.created_at.desc()))) else None),
             "review_status": o.review_status if o else None}
            for d in db.scalars(select(MedicalDocument).where(MedicalDocument.patient_id == p.id).order_by(MedicalDocument.created_at.desc()))]

@router.get("/hospitals")
def hospitals(u=Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": str(h.id), "name": h.name, "city": h.city} for h in db.scalars(select(Hospital).where(Hospital.is_active))]

@router.patch("/me/language")
def set_language(lang: str, u=Depends(require_roles("PATIENT")), db: Session = Depends(get_db)):
    if lang not in ("en", "kn"): raise HTTPException(422, "Unsupported language")
    my_patient(db, u).preferred_language = lang; db.commit(); return {"preferred_language": lang}
