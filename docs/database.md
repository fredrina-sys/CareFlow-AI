# Database
Models in `backend/app/models/__init__.py` (30 required tables + `revoked_tokens`). UUID PKs, provenance columns (PATIENT_PROVIDED, OCR_EXTRACTED, AI_GENERATED, DOCTOR_ENTERED, DOCTOR_VERIFIED), no hard deletes of clinical rows. Migration `0001_initial` is a stopgap using `metadata.create_all`; before production regenerate with `alembic revision --autogenerate`.
