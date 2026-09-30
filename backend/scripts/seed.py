"""Seed SYNTHETIC demo data with comprehensive hospitals, doctors, and patients.
Run: python -m scripts.seed [--reset]
All names/medical data are fictional synthetic demos for CareFlow AI.
"""
import sys
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.security import hash_password
from app.models import *
from app.db.session import SessionLocal, engine, Base

DEMO_PASSWORD = "CareFlow#Demo1"

def seed(db: Session, reset: bool = False):
    if reset:
        print("Resetting database schema...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    if db.query(Role).count() and not reset:
        print("Database already contains records. Run with --reset to reload fresh seed data.")
        return

    print("Seeding roles...")
    roles = {n: Role(name=n) for n in ("ADMIN", "DOCTOR", "TRIAGE", "PATIENT")}
    db.add_all(roles.values())
    db.flush()

    # 1. Seven Distinct Hospitals across Karnataka
    print("Seeding 7 hospitals...")
    h_sunrise = Hospital(name="Sunrise Multispeciality Hospital (demo)", city="Mangaluru")
    h_lakeview = Hospital(name="Lakeview General Hospital (demo)", city="Udupi")
    h_apollo = Hospital(name="Apollo Institute of Medical Sciences (demo)", city="Bengaluru")
    h_fortis = Hospital(name="Fortis Heart & Super-Specialty Hospital (demo)", city="Bengaluru")
    h_manipal = Hospital(name="Manipal Trauma & Speciality Hospital (demo)", city="Manipal")
    h_narayana = Hospital(name="Narayana Health City & Cardiac Center (demo)", city="Bengaluru")
    h_kmc = Hospital(name="KMC Hospital & Academic Medical Center (demo)", city="Mangaluru")
    all_hospitals = [h_sunrise, h_lakeview, h_apollo, h_fortis, h_manipal, h_narayana, h_kmc]
    db.add_all(all_hospitals)
    db.flush()

    # 2. Departments for all hospitals (10 standard departments each)
    print("Seeding hospital departments...")
    dept_names = [
        "General Medicine",
        "Cardiology & Cardiac Sciences",
        "ENT (Ear, Nose, Throat)",
        "Orthopaedics & Joint Care",
        "Paediatrics & Neonatology",
        "Pulmonology & Chest Medicine",
        "Dermatology & Cosmetology",
        "Emergency & Critical Care (24x7 ER)",
        "Gastroenterology",
        "Neurology & Neuro Surgery"
    ]
    deps = {}
    for h in all_hospitals:
        for dname in dept_names:
            dept_obj = Department(hospital_id=h.id, name=dname)
            db.add(dept_obj)
            deps[(h.id, dname)] = dept_obj
    db.flush()

    def make_user(email, name, role_name, hosp_id=None):
        u = User(
            email=email.lower(),
            full_name=name,
            password_hash=hash_password(DEMO_PASSWORD),
            role_id=roles[role_name].id,
            hospital_id=hosp_id
        )
        db.add(u)
        db.flush()
        return u

    # 3. Staff: Triage Nurses & System Admins
    print("Seeding triage nurses and administrators...")
    make_user("triage@careflow.demo", "Nurse Kavya Nair", "TRIAGE", h_sunrise.id)
    make_user("triage@example.com", "Nurse Kavya Nair", "TRIAGE", h_sunrise.id)
    make_user("triage2@careflow.demo", "Nurse Preethi Alva", "TRIAGE", h_manipal.id)
    make_user("triage3@careflow.demo", "Nurse Anjali Gowda", "TRIAGE", h_narayana.id)
    make_user("admin@careflow.demo", "Admin Demo", "ADMIN")
    make_user("admin@example.com", "Admin Demo", "ADMIN")

    # 4. Rich Roster of 26+ Specialist Doctors across Hospitals & Departments
    print("Seeding 26+ specialist doctors across multiple institutions...")
    doctor_roster = [
        # Sunrise Multispeciality (Mangaluru)
        ("Dr. Meera Rao", h_sunrise, "General Medicine", "DEMO-KMC-1001", "doctor1@careflow.demo", ["dr.meera.rao@example.com", "dr.priya.sharma@example.com"]),
        ("Dr. Rajesh Shenoy", h_sunrise, "ENT (Ear, Nose, Throat)", "DEMO-KMC-1002", "doctor2@careflow.demo", ["dr.rajesh.shenoy@example.com"]),
        ("Dr. Arjun Shetty", h_lakeview, "Orthopaedics & Joint Care", "DEMO-KMC-1003", "doctor3@careflow.demo", ["dr.arjun.shetty@example.com"]),
        ("Dr. Pooja Patil", h_sunrise, "Emergency & Critical Care (24x7 ER)", "DEMO-KMC-1004", "doctor4@careflow.demo", ["dr.pooja.patil@example.com"]),
        ("Dr. Sneha Bhat", h_sunrise, "Dermatology & Cosmetology", "DEMO-KMC-1005", "doctor5@careflow.demo", ["dr.sneha.bhat@example.com"]),
        ("Dr. Vinay Hegde", h_sunrise, "Pulmonology & Chest Medicine", "DEMO-KMC-1006", "doctor6@careflow.demo", ["dr.vinay.hegde@example.com"]),

        # Lakeview General (Udupi)
        ("Dr. Farah Khan", h_lakeview, "General Medicine", "DEMO-KMC-1007", "doctor7@careflow.demo", ["dr.farah.khan@example.com"]),
        ("Dr. Priya Nayak", h_lakeview, "ENT (Ear, Nose, Throat)", "DEMO-KMC-1008", "doctor8@careflow.demo", ["dr.priya.nayak@example.com"]),
        ("Dr. Ananya Acharya", h_lakeview, "Paediatrics & Neonatology", "DEMO-KMC-1009", "doctor9@careflow.demo", ["dr.ananya.acharya@example.com"]),
        ("Dr. Suresh Acharya", h_lakeview, "Emergency & Critical Care (24x7 ER)", "DEMO-KMC-1010", "doctor10@careflow.demo", ["dr.suresh.acharya@example.com"]),
        ("Dr. Rashmi Shenoy", h_lakeview, "Dermatology & Cosmetology", "DEMO-KMC-1011", "doctor11@careflow.demo", ["dr.rashmi.shenoy@example.com"]),

        # Apollo Institute of Medical Sciences (Bengaluru)
        ("Dr. Vikramaditya Hegde", h_apollo, "Cardiology & Cardiac Sciences", "DEMO-KMC-1012", "doctor12@careflow.demo", ["dr.vikramaditya.hegde@example.com"]),
        ("Dr. Vivek Alva", h_apollo, "ENT (Ear, Nose, Throat)", "DEMO-KMC-1013", "doctor13@careflow.demo", ["dr.vivek.alva@example.com"]),
        ("Dr. Rohan D'Souza", h_apollo, "Orthopaedics & Joint Care", "DEMO-KMC-1014", "doctor14@careflow.demo", ["dr.rohan.dsouza@example.com"]),
        ("Dr. Chetan Prasad", h_apollo, "Pulmonology & Chest Medicine", "DEMO-KMC-1015", "doctor15@careflow.demo", ["dr.chetan.prasad@example.com"]),
        ("Dr. Naveen Kumar", h_apollo, "General Medicine", "DEMO-KMC-1016", "doctor16@careflow.demo", ["dr.naveen.kumar@example.com"]),
        ("Dr. Nitin Prabhu", h_apollo, "Gastroenterology", "DEMO-KMC-1017", "doctor17@careflow.demo", ["dr.nitin.prabhu@example.com"]),

        # Fortis Heart & Super-Specialty (Bengaluru)
        ("Dr. Sunita Kulkarni", h_fortis, "Cardiology & Cardiac Sciences", "DEMO-KMC-1018", "doctor18@careflow.demo", ["dr.sunita.kulkarni@example.com"]),
        ("Dr. Manoj Kumar", h_fortis, "Emergency & Critical Care (24x7 ER)", "DEMO-KMC-1019", "doctor19@careflow.demo", ["dr.manoj.kumar@example.com"]),
        ("Dr. Sushma Rao", h_fortis, "Pulmonology & Chest Medicine", "DEMO-KMC-1020", "doctor20@careflow.demo", ["dr.sushma.rao@example.com"]),

        # Manipal Trauma & Speciality (Manipal)
        ("Dr. Sandeep Verma", h_manipal, "Orthopaedics & Joint Care", "DEMO-KMC-1021", "doctor21@careflow.demo", ["dr.sandeep.verma@example.com"]),
        ("Dr. Abhishek Kamath", h_manipal, "Emergency & Critical Care (24x7 ER)", "DEMO-KMC-1022", "doctor22@careflow.demo", ["dr.abhishek.kamath@example.com"]),
        ("Dr. Gautham Kamath", h_manipal, "Neurology & Neuro Surgery", "DEMO-KMC-1023", "doctor23@careflow.demo", ["dr.gautham.kamath@example.com"]),

        # Narayana Health City & Cardiac Center (Bengaluru)
        ("Dr. Devi Shetty", h_narayana, "Cardiology & Cardiac Sciences", "DEMO-KMC-1024", "doctor24@careflow.demo", ["dr.devi.shetty@example.com"]),
        ("Dr. Vikram Rao", h_narayana, "Orthopaedics & Joint Care", "DEMO-KMC-1025", "doctor25@careflow.demo", ["dr.vikram.rao@example.com"]),
        ("Dr. Kiran Shetty", h_narayana, "Emergency & Critical Care (24x7 ER)", "DEMO-KMC-1026", "doctor26@careflow.demo", ["dr.kiran.shetty@example.com"]),

        # KMC Hospital & Academic Medical Center (Mangaluru)
        ("Dr. Ramesh Bhat", h_kmc, "General Medicine", "DEMO-KMC-1027", "doctor27@careflow.demo", ["dr.ramesh.bhat@example.com"]),
        ("Dr. Anant Hegde", h_kmc, "ENT (Ear, Nose, Throat)", "DEMO-KMC-1028", "doctor28@careflow.demo", ["dr.anant.hegde@example.com"]),
    ]

    docs = []
    doc_map = {}
    for name, hosp, spec, reg, pri_email, aliases in doctor_roster:
        u = make_user(pri_email, name, "DOCTOR", hosp.id)
        d = Doctor(user_id=u.id, registration_no=reg, specialty=spec)
        db.add(d)
        db.flush()
        # Department assignment
        dept = deps.get((hosp.id, spec)) or deps.get((hosp.id, "General Medicine"))
        db.add(DoctorHospitalAssignment(
            doctor_id=d.id,
            hospital_id=hosp.id,
            department_id=dept.id if dept else None,
            is_active=True
        ))
        docs.append(d)
        doc_map[name] = d

        # Additional alias email accounts for convenient demo testing
        for alias in aliases:
            make_user(alias, name, "DOCTOR", hosp.id)

    # 5. Diverse Patient Population (20 Patients with Kannada & English preferences)
    print("Seeding 20 diverse patients...")
    patient_data = [
        ("Ravi Kumar", "M", 1978, "kn", "ravi.kumar@example.com", ["patient1@careflow.demo"], "+91 98450 12345"),
        ("Anitha Bhat", "F", 1990, "kn", "anitha.bhat@example.com", ["patient2@careflow.demo"], "+91 98450 23456"),
        ("Suresh Pai", "M", 1965, "en", "suresh.pai@example.com", ["patient3@careflow.demo"], "+91 98450 34567"),
        ("Divya Hegde", "F", 2001, "kn", "divya.hegde@example.com", ["patient4@careflow.demo"], "+91 98450 45678"),
        ("Imran Ali", "M", 1985, "en", "imran.ali@example.com", ["patient5@careflow.demo"], "+91 98450 56789"),
        ("Lakshmi Naik", "F", 1958, "kn", "lakshmi.naik@example.com", ["patient6@careflow.demo"], "+91 98450 67890"),
        ("Karthik Rao", "M", 2010, "en", "karthik.rao@example.com", ["patient7@careflow.demo"], "+91 98450 78901"),
        ("Geetha Acharya", "F", 1974, "kn", "geetha.acharya@example.com", ["patient8@careflow.demo"], "+91 98450 89012"),
        ("Mohammed Zeeshan", "M", 1995, "en", "mohammed.zeeshan@example.com", ["patient9@careflow.demo"], "+91 98450 90123"),
        ("Pooja Hegde", "F", 1991, "kn", "pooja.hegde@example.com", ["patient10@careflow.demo"], "+91 98451 01234"),
        ("Raghavendra Shenoy", "M", 1952, "kn", "raghavendra.shenoy@example.com", ["patient11@careflow.demo"], "+91 98451 12345"),
        ("Vidya Kamath", "F", 1980, "en", "vidya.kamath@example.com", ["patient12@careflow.demo"], "+91 98451 23456"),
        ("Anand Kulkarni", "M", 1967, "kn", "anand.kulkarni@example.com", ["patient13@careflow.demo"], "+91 98451 34567"),
        ("Sunitha Prabhu", "F", 1997, "kn", "sunitha.prabhu@example.com", ["patient14@careflow.demo"], "+91 98451 45678"),
        ("Rajeshwari Holla", "F", 1960, "kn", "rajeshwari.holla@example.com", ["patient15@careflow.demo"], "+91 98451 56789"),
        ("Deepak Nayak", "M", 1988, "kn", "deepak.nayak@example.com", ["patient16@careflow.demo"], "+91 98451 67890"),
        ("Shweta Alva", "F", 1993, "en", "shweta.alva@example.com", ["patient17@careflow.demo"], "+91 98451 78901"),
        ("Manjunath Gowda", "M", 1970, "kn", "manjunath.gowda@example.com", ["patient18@careflow.demo"], "+91 98451 89012"),
        ("Fathima Beevi", "F", 1982, "en", "fathima.beevi@example.com", ["patient19@careflow.demo"], "+91 98451 90123"),
        ("Venkatesh Prasad", "M", 1962, "kn", "venkatesh.prasad@example.com", ["patient20@careflow.demo"], "+91 98452 01234"),
    ]

    pts = []
    pt_map = {}
    for name, gender, birth_year, lang, pri_email, aliases, phone in patient_data:
        # The documented patientN@careflow.demo demo login must own the
        # Patient row; previously it was an unlinked second account.
        patient_email = aliases[0] if aliases else pri_email
        u = make_user(patient_email, name, "PATIENT")
        p = Patient(
            user_id=u.id,
            full_name=name,
            gender=gender,
            dob=date(birth_year, 5, 12),
            preferred_language=lang,
            phone=phone
        )
        db.add(p)
        db.flush()
        pts.append(p)
        pt_map[name] = p

        # Keep any extra aliases as accounts only when they are not the
        # account already attached to this patient.
        for alias in aliases[1:]:
            make_user(alias, name, "PATIENT")

    now = datetime.now(timezone.utc)

    # 6. Allergies for Patients
    print("Seeding patient allergies...")
    db.add(Allergy(patient_id=pts[0].id, substance="Penicillin", reaction="Skin rash & urticaria", severity="SEVERE"))
    db.add(Allergy(patient_id=pts[2].id, substance="Sulfa Drugs", reaction="Facial swelling & hives", severity="MODERATE"))
    db.add(Allergy(patient_id=pts[10].id, substance="Aspirin", reaction="Bronchospasm", severity="SEVERE"))
    db.flush()

    # 7. Completed Visits & Rich Medical History for Ravi Kumar (pts[0])
    print("Seeding clinical encounters & medical history for Ravi Kumar...")
    e_ravi = Encounter(
        patient_id=pts[0].id,
        hospital_id=h_sunrise.id,
        department_id=deps[(h_sunrise.id, "General Medicine")].id,
        doctor_id=doc_map["Dr. Meera Rao"].id,
        status="COMPLETED",
        priority="ROUTINE",
        token_number="TK-GM-01",
        chief_complaint="Fever and persistent productive cough for 3 days",
        symptoms="High fever (38.4°C), chills, yellow sputum. Penicillin allergy confirmed.",
        temperature_c=38.4,
        bp_systolic=124,
        bp_diastolic=82,
        pulse=84,
        spo2=97,
        created_at=now - timedelta(days=20),
        completed_at=now - timedelta(days=20)
    )
    db.add(e_ravi)
    db.flush()

    db.add(Diagnosis(
        patient_id=pts[0].id,
        encounter_id=e_ravi.id,
        name="Acute bronchitis",
        icd_code="J20.9",
        status="RESOLVED",
        entered_by=doc_map["Dr. Meera Rao"].id
    ))
    rx_ravi = Prescription(
        patient_id=pts[0].id,
        encounter_id=e_ravi.id,
        doctor_id=doc_map["Dr. Meera Rao"].id,
        status="COMPLETED",
        instructions="Complete full 3-day course. Rest, increase oral fluids.",
        items=[
            PrescriptionItem(
                medicine_name="Azithromycin 500mg",
                dosage="500 mg",
                route="ORAL",
                frequency="Once daily (OD)",
                duration="3 days",
                instructions="Take after food"
            ),
            PrescriptionItem(
                medicine_name="Paracetamol 650mg",
                dosage="650 mg",
                route="ORAL",
                frequency="As needed (SOS)",
                duration="3 days",
                instructions="Take when temp exceeds 38°C"
            )
        ]
    )
    db.add(rx_ravi)
    db.add(DoctorNote(
        patient_id=pts[0].id,
        encounter_id=e_ravi.id,
        doctor_id=doc_map["Dr. Meera Rao"].id,
        note_type="IMPORTANT_FOR_FUTURE_DOCTORS",
        text="PATIENT ALLERGY ALERT: Developed severe cutaneous rash with penicillin derivatives in 2021. Avoid beta-lactams.",
        visible_to_patient=True
    ))
    db.add(FollowUp(
        patient_id=pts[0].id,
        encounter_id=e_ravi.id,
        due_date=(now + timedelta(days=7)).date(),
        reason="Follow-up review of chest clear and cough resolution",
        status="SCHEDULED"
    ))
    db.add(TimelineEvent(
        patient_id=pts[0].id,
        hospital_id=h_sunrise.id,
        event_type="OPD_VISIT",
        title="OPD Consultation — Dr. Meera Rao",
        detail="Acute bronchitis treated with Azithromycin.",
        occurred_at=now - timedelta(days=20)
    ))
    db.add(TimelineEvent(
        patient_id=pts[0].id,
        hospital_id=h_sunrise.id,
        event_type="DIAGNOSIS",
        title="Diagnosis: Acute bronchitis (J20.9)",
        occurred_at=now - timedelta(days=20)
    ))
    db.add(TimelineEvent(
        patient_id=pts[0].id,
        hospital_id=h_sunrise.id,
        event_type="PRESCRIPTION",
        title="Prescription: Azithromycin 500mg + Paracetamol 650mg",
        occurred_at=now - timedelta(days=20)
    ))

    # 8. Laboratory Reports with Pre-Generated OCR Results
    print("Seeding medical documents & OCR reports...")
    doc1 = MedicalDocument(
        patient_id=pts[0].id,
        uploaded_by=pts[0].user_id,
        doc_type="LAB_REPORT",
        filename="Sunrise_Hospital_Lab_Report_Ravi_Kumar.pdf",
        content_type="application/pdf",
        storage_key="Sunrise_Hospital_Lab_Report_Ravi_Kumar.pdf"
    )
    db.add(doc1)
    db.flush()
    db.add(OcrResult(
        document_id=doc1.id,
        status="DONE",
        confidence=98.8,
        review_status="PENDING_REVIEW",
        text="""SUNRISE MULTISPECIALITY HOSPITAL
Central Clinical Laboratory & Diagnostics
Patient Name: Ravi Kumar | Age: 48 Yrs | Gender: Male | UHID: SH-2024-88412
Referring Doctor: Dr. Meera Rao, MD | Date: 09-Sep-2024

COMPLETE BLOOD COUNT (CBC) & SEROLOGY
-------------------------------------------------------------------------
Test Name                    Result       Unit         Biological Reference
Haemoglobin (Hb)             14.2         g/dL         13.0 - 17.0 (Normal)
Total RBC Count              4.85         mil/uL       4.50 - 5.50 (Normal)
Packed Cell Volume (PCV)     42.1         %            40.0 - 50.0 (Normal)
Total Leukocyte Count (TLC)  7,200        /uL          4,000 - 11,000 (Normal)
Neutrophils                  62           %            40 - 70
Lymphocytes                  28           %            20 - 40
Platelet Count               245,000      /uL          150,000 - 450,000 (Normal)
Erythrocyte Sed. Rate (ESR)  14           mm/1st hr    0 - 15 (Normal)
Random Blood Sugar           108          mg/dL        70 - 140 (Normal)
Serum Creatinine             0.9          mg/dL        0.7 - 1.2 (Normal)

CLINICAL IMPRESSION:
Hematological profile within standard biological limits. No acute leukemia, severe thrombocytopenia or toxic granulation identified."""
    ))

    doc2 = MedicalDocument(
        patient_id=pts[0].id,
        uploaded_by=pts[0].user_id,
        doc_type="LAB_REPORT",
        filename="synthetic_cbc.pdf",
        content_type="application/pdf",
        storage_key="synthetic_cbc.pdf"
    )
    db.add(doc2)
    db.flush()
    db.add(OcrResult(
        document_id=doc2.id,
        status="DONE",
        confidence=99.1,
        review_status="ACCEPTED",
        text="""LABORATORY INVESTIGATION REPORT — SYNTHETIC CBC
Patient Name: Ravi Kumar | Age: 48 | Sex: M
Hb: 14.2 g/dL | TLC: 7,200 /uL | Platelets: 245,000 /uL
Impression: Normocytic normochromic blood picture within normal limits."""
    ))

    # 9. Realistic Distribution of Active Queues (Demonstrating AI Load Balancing!)
    print("Seeding active waiting queues across doctors for load balancing...")
    # Dr. Rajesh Shenoy has 1 waiting patient
    db.add(Encounter(
        patient_id=pts[4].id,
        hospital_id=h_sunrise.id,
        department_id=deps[(h_sunrise.id, "ENT (Ear, Nose, Throat)")].id,
        doctor_id=doc_map["Dr. Rajesh Shenoy"].id,
        status="WAITING",
        priority="ROUTINE",
        token_number="TK-ENT-01",
        chief_complaint="Throat pain and difficulty swallowing for 2 days"
    ))

    # Dr. Arjun Shetty (Ortho) has 1 waiting patient
    db.add(Encounter(
        patient_id=pts[3].id,
        hospital_id=h_sunrise.id,
        department_id=deps[(h_sunrise.id, "Orthopaedics & Joint Care")].id,
        doctor_id=doc_map["Dr. Arjun Shetty"].id,
        status="WAITING",
        priority="URGENT",
        token_number="TK-ORTHO-01",
        chief_complaint="Severe right ankle swelling and sprain after fall"
    ))

    # Dr. Meera Rao (General Medicine) has 1 waiting patient
    db.add(Encounter(
        patient_id=pts[1].id,
        hospital_id=h_sunrise.id,
        department_id=deps[(h_sunrise.id, "General Medicine")].id,
        doctor_id=doc_map["Dr. Meera Rao"].id,
        status="WAITING",
        priority="ROUTINE",
        token_number="TK-GM-02",
        chief_complaint="Tension headache and fatigue"
    ))

    # Dr. Sunita Kulkarni (Cardiology - Fortis) has 1 waiting patient
    db.add(Encounter(
        patient_id=pts[2].id,
        hospital_id=h_fortis.id,
        department_id=deps[(h_fortis.id, "Cardiology & Cardiac Sciences")].id,
        doctor_id=doc_map["Dr. Sunita Kulkarni"].id,
        status="WAITING",
        priority="ROUTINE",
        token_number="TK-CARDIO-01",
        chief_complaint="Mild palpitation during exertion, baseline hypertension review"
    ))

    # Past Emergency Encounter (Emergency Bypass Demonstration)
    db.add(Encounter(
        patient_id=pts[10].id,
        hospital_id=h_manipal.id,
        department_id=deps[(h_manipal.id, "Emergency & Critical Care (24x7 ER)")].id,
        doctor_id=doc_map["Dr. Abhishek Kamath"].id,
        status="COMPLETED",
        priority="EMERGENCY",
        token_number="EMERGENCY-BYPASS-01",
        chief_complaint="Acute severe chest tightness and profuse sweating",
        symptoms="Emergency Bypass direct admission. ECG showed acute inferior wall STEMI.",
        spo2=91,
        temperature_c=36.8,
        bp_systolic=92,
        bp_diastolic=60,
        pulse=118,
        created_at=now - timedelta(days=5),
        completed_at=now - timedelta(days=5)
    ))

    # Consents and Data Sharing
    consent = Consent(patient_id=pts[2].id, purpose="Continuity of Care across Hospitals")
    db.add(consent)
    db.flush()
    db.add(DataSharingPermission(
        consent_id=consent.id,
        patient_id=pts[2].id,
        hospital_id=h_lakeview.id,
        scope=["ALLERGIES", "DIAGNOSES"]
    ))

    db.commit()
    print("----------------------------------------------------------------------")
    print("SUCCESS: CareFlow AI database seeded with comprehensive synthetic data!")
    print(f"Hospitals:  7 institutions ({', '.join(h.name.split()[0] for h in all_hospitals)})")
    print(f"Doctors:    28 specialists across ENT, Cardiology, Ortho, ER, Medicine, etc.")
    print(f"Patients:   20 diverse patients (Kannada and English language settings)")
    print(f"Default Demo Password for all accounts: {DEMO_PASSWORD} (or password123)")
    print("----------------------------------------------------------------------")

if __name__ == "__main__":
    reset_db = "--reset" in sys.argv
    with SessionLocal() as s:
        seed(s, reset=reset_db)
