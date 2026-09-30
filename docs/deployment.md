# Deployment
Local: `docker compose up --build`, then `docker compose exec backend python -m scripts.seed`.
Hosted: frontend on Vercel/Netlify (set API proxy/rewrites to the backend), backend on Render/Railway/Fly.io, managed PostgreSQL. Set `JWT_SECRET`, `DATABASE_URL`, `CORS` origin (edit `app/main.py`), `UPLOAD_DIR` on a persistent volume. Demo data is synthetic only.
