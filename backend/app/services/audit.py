from sqlalchemy.orm import Session
from app.models import AuditLog

def audit(db: Session, actor, action: str, resource_type=None, resource_id=None, patient_id=None, meta=None):
    """IDs/codes only in meta — never clinical text."""
    db.add(AuditLog(actor_id=getattr(actor, "id", None), action=action, resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else None, patient_id=patient_id, meta=meta))
