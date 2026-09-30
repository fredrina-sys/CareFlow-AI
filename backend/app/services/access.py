"""Central authorization: who may see which patient's data, and which scopes."""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import (Patient, Doctor, DoctorHospitalAssignment, Encounter, Consent, DataSharingPermission)

ALL_SCOPES = ["DIAGNOSES", "PRESCRIPTIONS", "ALLERGIES", "LAB_RESULTS", "NOTES", "DOCUMENTS"]

def doctor_of(db: Session, user):
    return db.scalar(select(Doctor).where(Doctor.user_id == user.id))

def patient_of(db: Session, user):
    return db.scalar(select(Patient).where(Patient.user_id == user.id))

def doctor_hospital_ids(db, doc):
    return set(db.scalars(select(DoctorHospitalAssignment.hospital_id).where(
        DoctorHospitalAssignment.doctor_id == doc.id, DoctorHospitalAssignment.is_active)))

def has_emergency_access(db: Session, user, patient: Patient) -> bool:
    """True only for this doctor's active, unexpired break-glass grant."""
    doc = doctor_of(db, user)
    if not doc:
        return False
    hospitals = doctor_hospital_ids(db, doc)
    if user.hospital_id:
        hospitals.add(user.hospital_id)
    if not hospitals:
        return False
    now = datetime.now(timezone.utc)
    grants = db.scalars(select(DataSharingPermission).join(Consent, Consent.id == DataSharingPermission.consent_id).where(
        DataSharingPermission.patient_id == patient.id,
        DataSharingPermission.is_active,
        DataSharingPermission.hospital_id.in_(hospitals),
        DataSharingPermission.doctor_id == doc.id,
        Consent.status == "ACTIVE",
        Consent.purpose == "Emergency cross-hospital break-glass override",
    ))
    for grant in grants:
        exp = grant.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is None or exp >= now:
            return True
    return False

def access_level(db: Session, user, patient: Patient):
    """Returns ('FULL', None) | ('SHARED', scopes:set) | (None, None).
    FULL: the patient, or staff at a hospital with an encounter for this patient.
    SHARED: another hospital's doctor holding an active consent + permission covering them.
    ADMIN has no clinical access."""
    role = user.role.name
    if role == "PATIENT":
        p = patient_of(db, user)
        return ("FULL", None) if p and p.id == patient.id else (None, None)
    if role == "DOCTOR":
        doc = doctor_of(db, user)
        if not doc: return (None, None)
        hosp = doctor_hospital_ids(db, doc)
        if user.hospital_id:
            hosp.add(user.hospital_id)
        if db.scalar(select(Encounter.id).where(Encounter.patient_id == patient.id,
                                                Encounter.hospital_id.in_(hosp)).limit(1)):
            return ("FULL", None)
        now = datetime.now(timezone.utc)
        perms = db.scalars(select(DataSharingPermission).join(Consent, Consent.id == DataSharingPermission.consent_id).where(
            DataSharingPermission.patient_id == patient.id, DataSharingPermission.is_active,
            Consent.status == "ACTIVE", DataSharingPermission.hospital_id.in_(hosp)))
        scopes = set()
        for pm in perms:
            exp = pm.expires_at
            if exp is not None and exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp < now: continue
            if pm.doctor_id and pm.doctor_id != doc.id: continue
            scopes |= set(pm.scope or [])
        return ("SHARED", scopes) if scopes else (None, None)
    if role == "TRIAGE":
        if user.hospital_id and db.scalar(select(Encounter.id).where(
                Encounter.patient_id == patient.id, Encounter.hospital_id == user.hospital_id).limit(1)):
            return ("FULL", None)
    return (None, None)
