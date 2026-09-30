# Architecture
React/Vite SPA (nginx in Docker, proxies /api) → FastAPI → PostgreSQL. Uploads on local disk behind `services/storage.py` (swap for S3). AI behind `ai/provider.py` (`AI_PROVIDER=mock`). OCR in `ocr/service.py` (Tesseract, graceful fallback).
Access model (`services/access.py`): patient=own record; doctor/triage=patients with an encounter at their hospital; other-hospital doctor=only consented scopes; admin=no clinical access. All sensitive actions write `audit_logs` (IDs only, no clinical text).
