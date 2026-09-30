import io
from sqlalchemy import select
from app.core.security import hash_password, verify_password
from app.models import AuditLog, Patient, User, Hospital, Encounter, Consent

def pid(db, email): return str(db.scalar(select(Patient).join(User, User.id == Patient.user_id).where(User.email == email)).id)
def actions(db): return {a.action for a in db.scalars(select(AuditLog))}

def test_password_hashing():
    h = hash_password("secret123"); assert h != "secret123" and verify_password("secret123", h) and not verify_password("x", h)

def test_login_bad_password_and_me(client, login):
    assert client.post("/api/auth/login", json={"email": "doctor1@careflow.demo", "password": "wrong"}).status_code == 401
    assert client.get("/api/auth/me", headers=login("doctor1@careflow.demo")).json()["role"] == "DOCTOR"

def test_logout_invalidates_token(client, login):
    h = login("patient1@careflow.demo"); assert client.post("/api/auth/logout", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401

def test_register_creates_patient_only(client):
    r = client.post("/api/auth/register", json={"email": "new@x.demo", "password": "longenough1", "full_name": "New Person"})
    assert r.status_code == 201 and r.json()["role"] == "PATIENT"

def test_rbac_patient_cannot_use_staff_endpoint(client, login):
    assert client.get("/api/queue", headers=login("patient1@careflow.demo")).status_code == 403
    assert client.get("/api/audit-logs", headers=login("doctor1@careflow.demo")).status_code == 403

def test_patient_isolation(client, login, db):
    assert client.get(f"/api/patients/{pid(db,'patient2@careflow.demo')}", headers=login("patient1@careflow.demo")).status_code == 403
    assert client.get(f"/api/patients/{pid(db,'patient1@careflow.demo')}", headers=login("patient1@careflow.demo")).status_code == 200

def test_patient_hides_notes_not_flagged_visible(client, login, db):
    r = client.get(f"/api/patients/{pid(db,'patient1@careflow.demo')}", headers=login("patient1@careflow.demo")).json()
    assert all("penicillin" in n["text"].lower() for n in r["notes"])

def test_encounter_triage_doctor_prescription_flow(client, login, db):
    h_t, h_d = login("triage@careflow.demo"), login("doctor1@careflow.demo")
    q = client.get("/api/queue", headers=h_t).json(); eid = next(e["id"] for e in q if e["patient_name"] == "Anitha Bhat")
    r = client.patch(f"/api/encounters/{eid}", json={"spo2": 88, "temperature_c": 38.0, "status": "TRIAGED"}, headers=h_t); assert r.status_code == 200
    assert any(f["code"] == "LOW_SPO2" for f in client.get(f"/api/encounters/{eid}", headers=h_d).json()["red_flags"])
    assert client.patch(f"/api/encounters/{eid}", json={"status": "COMPLETED"}, headers=h_t).status_code == 403
    assert client.post("/api/diagnoses", json={"encounter_id": eid, "name": "Tension headache", "status": "BOGUS"}, headers=h_d).status_code == 422
    assert client.post("/api/diagnoses", json={"encounter_id": eid, "name": "Tension headache", "status": "ACTIVE"}, headers=h_d).status_code == 201
    rx = client.post("/api/prescriptions", json={"encounter_id": eid, "items": [{"medicine_name": "Paracetamol 500mg", "dosage": "500 mg", "frequency": "TID", "duration": "3 days"}]}, headers=h_d)
    assert rx.status_code == 201
    got = client.get(f"/api/prescriptions/{rx.json()['id']}", headers=h_d).json(); assert got["registration_no"].startswith("DEMO") and got["items"][0]["medicine"] == "Paracetamol 500mg"
    assert {"DIAGNOSIS_CREATED", "PRESCRIPTION_CREATED"} <= actions(db)

def test_allergy_conflict_alert(client, login, db):
    h = login("doctor1@careflow.demo"); e = db.scalar(select(Encounter).where(Encounter.patient_id == db.scalar(select(Patient).where(Patient.full_name == "Ravi Kumar")).id, Encounter.status == "COMPLETED"))
    rx = client.post("/api/prescriptions", json={"encounter_id": str(e.id), "items": [{"medicine_name": "Penicillin V", "dosage": "250 mg", "frequency": "QID", "duration": "5d"}]}, headers=h).json()
    assert rx["alerts"] and rx["alerts"][0]["code"] == "MED_ALLERGY_CONFLICT"

def test_cross_hospital_denied_then_allowed_with_consent(client, login, db):
    p3 = pid(db, "patient3@careflow.demo"); p1 = pid(db, "patient1@careflow.demo")
    dr_b = login("doctor3@careflow.demo")
    assert client.get(f"/api/patients/{p1}", headers=dr_b).status_code == 403  # no consent
    r = client.get(f"/api/patients/{p3}", headers=dr_b); assert r.status_code == 200  # seeded consent
    assert "allergies" in r.json() and "diagnoses" in r.json() and "prescriptions" not in r.json() and "notes" not in r.json()
    assert "SHARED_RECORD_ACCESSED" in actions(db)
    assert client.get(f"/api/patients/{p3}/timeline", headers=dr_b).status_code == 403

def test_emergency_break_glass_unlocks_timeline_and_is_hospital_scoped(client, login, db):
    p1 = pid(db, "patient1@careflow.demo")
    dr_b = login("doctor3@careflow.demo")
    r = client.post("/api/sharing/emergency-access", json={"patient_id": p1, "reason": "Unconscious patient in emergency department"}, headers=dr_b)
    assert r.status_code == 201, r.text
    record = client.get(f"/api/patients/{p1}", headers=dr_b)
    assert record.status_code == 200 and record.json()["emergency_access"] is True
    assert client.get(f"/api/patients/{p1}/timeline", headers=dr_b).status_code == 200
    assert "EMERGENCY_BREAK_GLASS_ACCESSED" in actions(db)
    wrong_hospital = client.post("/api/sharing/emergency-access", json={"patient_id": p1, "hospital_id": "00000000-0000-4000-8000-000000000001", "reason": "Unconscious patient in emergency department"}, headers=dr_b)
    assert wrong_hospital.status_code == 403

def test_patient_grants_and_revokes(client, login, db):
    hp = login("patient1@careflow.demo"); p1 = pid(db, "patient1@careflow.demo"); hb = str(db.scalar(select(Hospital).where(Hospital.name.like("Lakeview%"))).id)
    c = client.post("/api/consents", json={}, headers=hp).json()["id"]
    m = client.post("/api/sharing/permissions", json={"consent_id": c, "hospital_id": hb, "scope": ["ALLERGIES"]}, headers=hp).json()["id"]
    dr_b = login("doctor3@careflow.demo"); assert client.get(f"/api/patients/{p1}", headers=dr_b).status_code == 200
    assert client.delete(f"/api/sharing/permissions/{m}", headers=hp).status_code == 200
    assert client.get(f"/api/patients/{p1}", headers=dr_b).status_code == 403
    assert {"CONSENT_CREATED", "CONSENT_REVOKED"} <= actions(db)
    assert client.post("/api/sharing/permissions", json={"consent_id": c, "hospital_id": hb, "scope": ["EVERYTHING"]}, headers=hp).status_code == 422

def test_ai_summary_requires_verification(client, login, db):
    h = login("doctor1@careflow.demo"); e = db.scalar(select(Encounter).where(Encounter.status == "COMPLETED"))
    s = client.post("/api/ai/clinical-summary", json={"encounter_id": str(e.id)}, headers=h).json()
    assert s["status"] == "PENDING_REVIEW" and s["provenance"] == "AI_GENERATED" and "requires doctor verification" in s["content"]["notice"]
    c = client.post(f"/api/ai/clinical-summary/{s['id']}/confirm", headers=h).json(); assert c["provenance"] == "DOCTOR_VERIFIED"
    assert client.post(f"/api/ai/clinical-summary/{s['id']}/reject", headers=h).status_code == 409
    assert {"AI_SUMMARY_GENERATED", "AI_SUMMARY_CONFIRMED"} <= actions(db)

def test_document_upload_validation(client, login, db, tmp_path, monkeypatch):
    from app.core.config import settings; monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    h = login("patient1@careflow.demo"); p1 = pid(db, "patient1@careflow.demo")
    bad = client.post("/api/documents", data={"patient_id": p1}, files={"file": ("x.exe", io.BytesIO(b"MZ"), "application/octet-stream")}, headers=h); assert bad.status_code == 415
    fake = client.post("/api/documents", data={"patient_id": p1}, files={"file": ("x.pdf", io.BytesIO(b"not a pdf"), "application/pdf")}, headers=h); assert fake.status_code == 415
    other = pid(db, "patient2@careflow.demo")
    assert client.post("/api/documents", data={"patient_id": other}, files={"file": ("x.png", io.BytesIO(b"\x89PNG..."), "image/png")}, headers=h).status_code == 403
