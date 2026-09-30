"""All CareFlow tables. Provenance values: PATIENT_PROVIDED, OCR_EXTRACTED, AI_GENERATED,
DOCTOR_ENTERED, DOCTOR_VERIFIED. Clinical rows are never hard-deleted (status / is_active)."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Date, Uuid)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

def now(): return datetime.now(timezone.utc)
def pk(): return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
def fk(t, null=False, idx=True): return mapped_column(Uuid, ForeignKey(f"{t}.id"), nullable=null, index=idx)
def ts(): return mapped_column(DateTime(timezone=True), default=now)
def S(n=255, **k): return mapped_column(String(n), **k)
def T(**k): return mapped_column(Text, **k)

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = pk(); name: Mapped[str] = S(30, unique=True)  # ADMIN DOCTOR TRIAGE PATIENT

class Hospital(Base):
    __tablename__ = "hospitals"
    id: Mapped[uuid.UUID] = pk(); name: Mapped[str] = S(); city: Mapped[str] = S(100, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Department(Base):
    __tablename__ = "departments"
    id: Mapped[uuid.UUID] = pk(); hospital_id: Mapped[uuid.UUID] = fk("hospitals"); name: Mapped[str] = S(100)

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk(); email: Mapped[str] = S(255, unique=True, index=True)
    password_hash: Mapped[str] = S(); full_name: Mapped[str] = S()
    role_id: Mapped[uuid.UUID] = fk("roles"); hospital_id: Mapped[uuid.UUID] = fk("hospitals", True)  # staff home hospital
    is_active: Mapped[bool] = mapped_column(Boolean, default=True); created_at = ts()
    role: Mapped[Role] = relationship()

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    jti: Mapped[str] = S(64, primary_key=True); revoked_at = ts()

class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[uuid.UUID] = pk(); user_id: Mapped[uuid.UUID] = fk("users", True)
    full_name: Mapped[str] = S(); dob = mapped_column(Date, nullable=True); gender: Mapped[str] = S(20, nullable=True)
    preferred_language: Mapped[str] = S(10, default="en"); phone: Mapped[str] = S(30, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True); created_at = ts()

class Doctor(Base):
    __tablename__ = "doctors"
    id: Mapped[uuid.UUID] = pk(); user_id: Mapped[uuid.UUID] = fk("users"); registration_no: Mapped[str] = S(50)
    specialty: Mapped[str] = S(100, nullable=True)

class DoctorHospitalAssignment(Base):
    __tablename__ = "doctor_hospital_assignments"
    id: Mapped[uuid.UUID] = pk(); doctor_id: Mapped[uuid.UUID] = fk("doctors"); hospital_id: Mapped[uuid.UUID] = fk("hospitals")
    department_id: Mapped[uuid.UUID] = fk("departments", True); is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Encounter(Base):
    __tablename__ = "encounters"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); hospital_id: Mapped[uuid.UUID] = fk("hospitals")
    department_id: Mapped[uuid.UUID] = fk("departments", True); doctor_id: Mapped[uuid.UUID] = fk("doctors", True)
    status: Mapped[str] = S(20, default="WAITING", index=True)  # WAITING TRIAGED IN_CONSULT COMPLETED CANCELLED
    priority: Mapped[str] = S(10, default="ROUTINE")  # ROUTINE URGENT EMERGENCY
    token_number: Mapped[str] = mapped_column(String(30), nullable=True)
    chief_complaint: Mapped[str] = T(nullable=True); symptoms: Mapped[str] = T(nullable=True)
    exam_findings: Mapped[str] = T(nullable=True)
    temperature_c: Mapped[float] = mapped_column(Float, nullable=True); bp_systolic: Mapped[int] = mapped_column(Integer, nullable=True)
    bp_diastolic: Mapped[int] = mapped_column(Integer, nullable=True); pulse: Mapped[int] = mapped_column(Integer, nullable=True)
    spo2: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at = ts(); completed_at = mapped_column(DateTime(timezone=True), nullable=True)

class ClinicalInterview(Base):
    __tablename__ = "clinical_interviews"
    id: Mapped[uuid.UUID] = pk(); encounter_id: Mapped[uuid.UUID] = fk("encounters"); created_at = ts()
class ClinicalQuestion(Base):
    __tablename__ = "clinical_questions"
    id: Mapped[uuid.UUID] = pk(); interview_id: Mapped[uuid.UUID] = fk("clinical_interviews"); text: Mapped[str] = T()
    source: Mapped[str] = S(20, default="AI_GENERATED")
class ClinicalAnswer(Base):
    __tablename__ = "clinical_answers"
    id: Mapped[uuid.UUID] = pk(); question_id: Mapped[uuid.UUID] = fk("clinical_questions"); text: Mapped[str] = T()
    source: Mapped[str] = S(20, default="PATIENT_PROVIDED")
class ClinicalEntity(Base):
    __tablename__ = "clinical_entities"
    id: Mapped[uuid.UUID] = pk(); encounter_id: Mapped[uuid.UUID] = fk("encounters"); kind: Mapped[str] = S(30)
    value: Mapped[str] = S(); provenance: Mapped[str] = S(20)

class ClinicalSummary(Base):
    __tablename__ = "clinical_summaries"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters", True)
    content = mapped_column(JSON); provenance: Mapped[str] = S(20, default="AI_GENERATED")
    status: Mapped[str] = S(20, default="PENDING_REVIEW")  # PENDING_REVIEW CONFIRMED REJECTED
    generated_by = fk("users", True); reviewed_by = fk("users", True); reviewed_at = mapped_column(DateTime(timezone=True), nullable=True)
    created_at = ts()
class ClinicalSummaryRevision(Base):
    __tablename__ = "clinical_summary_revisions"
    id: Mapped[uuid.UUID] = pk(); summary_id: Mapped[uuid.UUID] = fk("clinical_summaries"); content = mapped_column(JSON)
    provenance: Mapped[str] = S(20); changed_by = fk("users", True); note: Mapped[str] = S(255, nullable=True); created_at = ts()
class RedFlag(Base):
    __tablename__ = "red_flags"
    id: Mapped[uuid.UUID] = pk(); encounter_id: Mapped[uuid.UUID] = fk("encounters"); code: Mapped[str] = S(50)
    message: Mapped[str] = S(); severity: Mapped[str] = S(10, default="WARN"); created_at = ts()

class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters")
    name: Mapped[str] = S(); icd_code: Mapped[str] = S(20, nullable=True)
    status: Mapped[str] = S(20, default="ACTIVE")  # ACTIVE IMPROVING RESOLVED CHRONIC RULED_OUT
    provenance: Mapped[str] = S(20, default="DOCTOR_ENTERED"); entered_by = fk("doctors", True); created_at = ts()
class Medicine(Base):
    __tablename__ = "medicines"
    id: Mapped[uuid.UUID] = pk(); name: Mapped[str] = S(200, index=True); form: Mapped[str] = S(50, nullable=True)
class Prescription(Base):
    __tablename__ = "prescriptions"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters")
    doctor_id: Mapped[uuid.UUID] = fk("doctors"); instructions: Mapped[str] = T(nullable=True); status: Mapped[str] = S(20, default="ACTIVE")
    created_at = ts(); items: Mapped[list["PrescriptionItem"]] = relationship(back_populates="prescription")
class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    id: Mapped[uuid.UUID] = pk(); prescription_id: Mapped[uuid.UUID] = fk("prescriptions"); medicine_id: Mapped[uuid.UUID] = fk("medicines", True)
    medicine_name: Mapped[str] = S(200)  # snapshot: history stays accurate if catalogue changes
    dosage: Mapped[str] = S(100); route: Mapped[str] = S(50); frequency: Mapped[str] = S(100); duration: Mapped[str] = S(100)
    instructions: Mapped[str] = S(500, nullable=True); prescription: Mapped[Prescription] = relationship(back_populates="items")
class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters")
    name: Mapped[str] = S(); status: Mapped[str] = S(20, default="ORDERED"); created_at = ts()
class LabResult(Base):
    __tablename__ = "lab_results"
    id: Mapped[uuid.UUID] = pk(); investigation_id: Mapped[uuid.UUID] = fk("investigations"); test: Mapped[str] = S()
    value: Mapped[str] = S(100); unit: Mapped[str] = S(30, nullable=True); reference_range: Mapped[str] = S(100, nullable=True)
    provenance: Mapped[str] = S(20, default="DOCTOR_ENTERED"); created_at = ts()
class DoctorNote(Base):
    __tablename__ = "doctor_notes"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters")
    doctor_id: Mapped[uuid.UUID] = fk("doctors"); note_type: Mapped[str] = S(40, default="CLINICAL_NOTE")  # or IMPORTANT_FOR_FUTURE_DOCTORS
    text: Mapped[str] = T(); visible_to_patient: Mapped[bool] = mapped_column(Boolean, default=False); created_at = ts()
class FollowUp(Base):
    __tablename__ = "follow_ups"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters")
    due_date = mapped_column(Date); reason: Mapped[str] = S(500, nullable=True); status: Mapped[str] = S(20, default="SCHEDULED")
class Allergy(Base):
    __tablename__ = "allergies"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); substance: Mapped[str] = S(200)
    reaction: Mapped[str] = S(200, nullable=True); severity: Mapped[str] = S(20, default="MILD")
    provenance: Mapped[str] = S(20, default="PATIENT_PROVIDED"); is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); encounter_id: Mapped[uuid.UUID] = fk("encounters", True)
    uploaded_by: Mapped[uuid.UUID] = fk("users"); doc_type: Mapped[str] = S(40); filename: Mapped[str] = S()
    content_type: Mapped[str] = S(50); storage_key: Mapped[str] = S(500); created_at = ts()
class OcrResult(Base):
    __tablename__ = "ocr_results"
    id: Mapped[uuid.UUID] = pk(); document_id: Mapped[uuid.UUID] = fk("medical_documents"); text: Mapped[str] = T(nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    status: Mapped[str] = S(20)  # DONE UNAVAILABLE FAILED
    provenance: Mapped[str] = S(20, default="OCR_EXTRACTED")
    review_status: Mapped[str] = S(20, default="PENDING_REVIEW")  # PENDING_REVIEW ACCEPTED EDITED REJECTED
    reviewed_text: Mapped[str] = T(nullable=True); reviewed_by = fk("users", True); created_at = ts()
class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); hospital_id: Mapped[uuid.UUID] = fk("hospitals", True)
    event_type: Mapped[str] = S(40); title: Mapped[str] = S(); detail: Mapped[str] = T(nullable=True)
    ref_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True); occurred_at = mapped_column(DateTime(timezone=True), default=now, index=True)
class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[uuid.UUID] = pk(); patient_id: Mapped[uuid.UUID] = fk("patients"); purpose: Mapped[str] = S(200, default="Continuity of care")
    status: Mapped[str] = S(20, default="ACTIVE")  # ACTIVE REVOKED
    granted_at = ts(); revoked_at = mapped_column(DateTime(timezone=True), nullable=True)
class DataSharingPermission(Base):
    __tablename__ = "data_sharing_permissions"
    id: Mapped[uuid.UUID] = pk(); consent_id: Mapped[uuid.UUID] = fk("consents"); patient_id: Mapped[uuid.UUID] = fk("patients")
    hospital_id: Mapped[uuid.UUID] = fk("hospitals"); doctor_id: Mapped[uuid.UUID] = fk("doctors", True)  # null = any doctor at hospital
    scope = mapped_column(JSON, default=list)  # e.g. ["DIAGNOSES","PRESCRIPTIONS","ALLERGIES","LAB_RESULTS","NOTES","DOCUMENTS"]
    expires_at = mapped_column(DateTime(timezone=True), nullable=True); is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at = ts()
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = pk(); actor_id: Mapped[uuid.UUID] = fk("users", True); action: Mapped[str] = S(50, index=True)
    resource_type: Mapped[str] = S(50, nullable=True); resource_id: Mapped[str] = S(64, nullable=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True, index=True)
    meta = mapped_column(JSON, nullable=True)  # never put PHI here; IDs only
    created_at = mapped_column(DateTime(timezone=True), default=now, index=True)
