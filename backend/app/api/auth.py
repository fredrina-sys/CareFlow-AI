from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import current_user
from app.core.security import create_token, hash_password, verify_password
from app.db.session import get_db
from app.models import Patient, RevokedToken, Role, User
from app.services.audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: EmailStr; password: str = Field(min_length=8, max_length=128); full_name: str = Field(min_length=1, max_length=200)
    dob: date | None = None; gender: str | None = None; preferred_language: str = "en"
class LoginIn(BaseModel):
    email: EmailStr; password: str

def user_out(u: User): return {"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role.name,
                               "hospital_id": str(u.hospital_id) if u.hospital_id else None}

@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Public registration creates PATIENT accounts only; staff are created by an admin/seed."""
    if db.scalar(select(User).where(User.email == body.email.lower())): raise HTTPException(409, "Email already registered")
    role = db.scalar(select(Role).where(Role.name == "PATIENT"))
    u = User(email=body.email.lower(), password_hash=hash_password(body.password), full_name=body.full_name, role_id=role.id)
    db.add(u); db.flush()
    p = Patient(user_id=u.id, full_name=body.full_name, dob=body.dob, gender=body.gender, preferred_language=body.preferred_language)
    db.add(p); db.flush(); audit(db, u, "PATIENT_CREATED", "patient", p.id, p.id); db.commit()
    return user_out(u)

@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == body.email.lower()))
    if not u or not u.is_active or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Invalid email or password")
    audit(db, u, "LOGIN", "user", u.id); db.commit()
    return {"access_token": create_token(str(u.id), u.role.name), "token_type": "bearer", "user": user_out(u)}

@router.post("/logout")
def logout(u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.add(RevokedToken(jti=u._jti)); audit(db, u, "LOGOUT", "user", u.id); db.commit()
    return {"detail": "Logged out"}

@router.get("/me")
def me(u: User = Depends(current_user)): return user_out(u)
