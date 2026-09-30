# CareFlow AI — AI-assisted digital OPD & longitudinal health record (MVP, in progress)

> **All demo data is synthetic and must not be used as real medical data.**
> This is a portfolio/MVP system. It is not clinically certified and not compliant with any healthcare regulation.

## Verification status

The frontend production build passed. The backend test suite passed (13 tests). The app was started locally, and the doctor demo account was verified on the OPD dashboard and logging out to the public home page.

All sample patients and clinical records are synthetic. This is a portfolio MVP, not a certified or regulation-compliant clinical system.

## Run (backend)
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/careflow
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload         # http://localhost:8000/docs
pytest                                # uses in-memory SQLite
```
## Run (frontend)
```bash
cd frontend && npm install && npm run build
npm run dev                                   # http://localhost:5173 (proxies /api to :8000)
```
Docker: `cp .env.example .env` (set `JWT_SECRET`), `docker compose up --build`, then seed once:
`docker compose exec backend python -m scripts.seed`. App at http://localhost:5173.

### Hosting configuration

Before deploying, configure a PostgreSQL database for the backend. The Render blueprint runs migrations but does not reset or seed data on each deploy. Set `DATABASE_URL` to the provider's SQLAlchemy URL (`postgresql+psycopg://...`), `JWT_SECRET` to a fresh secret, and `CORS_ORIGINS` to the exact HTTPS frontend origin. Seed demo data once after the first deploy with `cd backend && python -m scripts.seed` if you want demo accounts. In Netlify, set `VITE_API_URL` to the backend API origin (for example `https://your-api.example.com/api`) and redeploy. Never use the demo data or credentials for real patients.

Frontend gaps: investigations/lab-result entry UI, follow-up list on the doctor dashboard, admin user management, Kannada covers only navigation/patient strings (staff screens are English), `/profile` is read-only.

## Demo accounts (password `CareFlow#Demo1`)
doctor1/2 (Sunrise hospital), doctor3 (Lakeview hospital), triage, admin, patient1..patient7 — all `@careflow.demo`.
Seeded: patient3 has shared ALLERGIES+DIAGNOSES with Lakeview; patient1 has not (use for consent demo).

## Windows quick start (PowerShell/CMD)
```
copy .env.example .env
notepad .env                      (set JWT_SECRET)
docker compose up --build
docker compose exec backend python -m scripts.seed
```
Open http://localhost:5173. Without Docker: `cd backend`, `python -m venv .venv`, `.venv\Scripts\activate`, `pip install -r requirements.txt`, `set DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/careflow`, `alembic upgrade head`, `python -m scripts.seed`, `uvicorn app.main:app --reload`; frontend: `cd frontend`, `npm install`, `npm run dev`.

### Local run without Docker or PostgreSQL (SQLite)

In PowerShell, start the backend in one terminal:

```powershell
cd backend
python -m venv .venv                 # skip if .venv already exists
.venv\Scripts\Activate.ps1
pip install -r requirements.txt      # skip if dependencies are already installed
$env:DATABASE_URL = "sqlite:///./dev.db"
$env:JWT_SECRET = "local-demo-secret-change-before-deployment-32chars"
python -m scripts.seed               # seeds a new local database; does not reset existing data
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm install                          # skip if node_modules already exists
npm run dev
```

Open http://localhost:5173. For a fresh database only, use `python -m scripts.seed --reset` to recreate the synthetic demo data.

## Design notes
- **Access model** (`app/services/access.py`): patient → own record; doctor/triage → patients with an encounter at their hospital (FULL); other-hospital doctor → only scopes covered by an active consent + permission (SHARED); admin → no clinical access.
- **Provenance**: PATIENT_PROVIDED / OCR_EXTRACTED / AI_GENERATED / DOCTOR_ENTERED / DOCTOR_VERIFIED. AI summaries stay `PENDING_REVIEW` until a doctor confirms (with revision history).
- **Audit**: IDs/codes only in metadata, never clinical text.
- Known MVP gaps: no rate limiting, no refresh tokens, CORS fixed to localhost:5173, scanned-PDF OCR not rasterized, timeline not shareable via scopes.
