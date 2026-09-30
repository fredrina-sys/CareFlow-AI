import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth, clinical, sharing
from app.db.session import engine, Base
from app.core.config import settings
import app.models  # ensure models are loaded into Base.metadata

log = logging.getLogger("careflow")
app = FastAPI(title="CareFlow AI", version="0.1.0-mvp",
              description="MVP with SYNTHETIC data only. Not clinically certified.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    r = await call_next(request)
    r.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})
    return r

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.error("Unhandled error on %s %s: %s", request.method, request.url.path, type(exc).__name__)  # no PHI, no stack to client
    return JSONResponse({"detail": "Internal server error"}, status_code=500)

for r in (auth.router, clinical.router, sharing.router): app.include_router(r)

@app.get("/api/health")
def health(): return {"status": "ok"}
