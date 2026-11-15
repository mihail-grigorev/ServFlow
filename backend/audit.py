from datetime import datetime
import logging
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from backend.models import AuditLog

logger = logging.getLogger(__name__)

def log_audit(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    ip: Optional[str] = None,
    object: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """
    Non-blocking security audit logger. Records security events into the audit_log table.
    Ensures that any failure in logging does not interrupt or fail the primary request.
    """
    try:
        log_entry = AuditLog(
            ts=datetime.utcnow(),
            user_id=user_id,
            ip=ip,
            action=action,
            object=object,
            details=details or {}
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error(f"[AUDIT LOG FAILURE] Could not record action '{action}': {e}")
        try:
            db.rollback()
        except Exception:
            pass
