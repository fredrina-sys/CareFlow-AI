import uuid
from datetime import datetime, timedelta, timezone
import bcrypt, jwt
from .config import settings

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "jti": uuid.uuid4().hex, "exp": exp},
                      settings.JWT_SECRET, algorithm="HS256")

def decode_token(t: str) -> dict:
    return jwt.decode(t, settings.JWT_SECRET, algorithms=["HS256"])
