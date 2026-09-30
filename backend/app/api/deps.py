import uuid
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.security import decode_token
from app.db.session import get_db
from app.models import RevokedToken, User

bearer = HTTPBearer(auto_error=False)

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds: raise HTTPException(401, "Not authenticated")
    try: data = decode_token(creds.credentials)
    except PyJWTError: raise HTTPException(401, "Invalid or expired token")
    if db.get(RevokedToken, data["jti"]): raise HTTPException(401, "Token has been revoked")
    user = db.scalar(select(User).where(User.id == uuid.UUID(data["sub"])))
    if not user or not user.is_active: raise HTTPException(401, "User inactive")
    user._jti = data["jti"]
    return user

def require_roles(*roles):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role.name not in roles: raise HTTPException(403, "Insufficient role")
        return user
    return dep
