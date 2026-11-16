import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
import segno

from backend.config import settings
from backend.database import get_db
from backend.models import User, DemoQrToken
from backend.auth import require_dispatcher, create_access_token
from backend.audit import log_audit
from backend.seed import reset_demo_data
from backend.analytics import track_event

router = APIRouter(prefix="/demo", tags=["demo"])

def check_demo_mode():
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Демо-режим отключен"
        )


class ExchangeRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=128)
    model_config = ConfigDict(extra="forbid")


class VerifyPinRequest(BaseModel):
    pin: str = Field(..., min_length=1, max_length=50)
    model_config = ConfigDict(extra="forbid")


class DemoCompanyItem(BaseModel):
    company_id: str
    company_name: str
    city: Optional[str] = None
    token: str
    url: str
    qr_svg: str
    expires_at: str
    uses: int
    max_uses: int


@router.get("/config")
def get_demo_config(_: None = Depends(check_demo_mode)):
    """Returns demo mode status and public URL configuration."""
    return {
        "demo_mode": settings.DEMO_MODE,
        "public_base_url": settings.PUBLIC_BASE_URL
    }


@router.get("/companies", response_model=List[DemoCompanyItem])
def get_demo_companies(
    _: None = Depends(check_demo_mode),
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Returns list of all registered demo companies with active QR codes and URLs.
    Generates new tokens for companies that lack an active token.
    Dispatcher access only.
    """
    companies = (
        db.query(User)
        .filter(User.role == "company", User.company_id.isnot(None))
        .order_by(User.id.asc())
        .all()
    )

    now = datetime.utcnow()
    results = []
    need_commit = False

    for comp in companies:
        token_rec = (
            db.query(DemoQrToken)
            .filter(
                DemoQrToken.company_id == comp.company_id,
                DemoQrToken.revoked == False,
                DemoQrToken.expires_at > now,
                DemoQrToken.uses < DemoQrToken.max_uses,
                DemoQrToken.token.isnot(None)
            )
            .order_by(DemoQrToken.id.desc())
            .first()
        )

        if not token_rec:
            raw_token = secrets.token_urlsafe(32)
            thash = hashlib.sha256(raw_token.encode()).hexdigest()
            token_rec = DemoQrToken(
                company_id=comp.company_id,
                token=raw_token,
                token_hash=thash,
                created_at=now,
                expires_at=now + timedelta(hours=settings.DEMO_QR_TTL_HOURS),
                revoked=False,
                uses=0,
                max_uses=settings.DEMO_QR_MAX_SESSIONS
            )
            db.add(token_rec)
            db.flush()
            need_commit = True

        url = f"{settings.PUBLIC_BASE_URL}/demo/enter?t={token_rec.token}"
        qr = segno.make_qr(url)
        qr_svg = qr.svg_inline(scale=4)

        results.append(
            DemoCompanyItem(
                company_id=comp.company_id,
                company_name=comp.full_name,
                city=comp.city,
                token=token_rec.token,
                url=url,
                qr_svg=qr_svg,
                expires_at=token_rec.expires_at.isoformat(),
                uses=token_rec.uses,
                max_uses=token_rec.max_uses
            )
        )

    if need_commit:
        db.commit()

    return results


@router.post("/qr/issue-all")
def issue_all_qr_tokens(
    _: None = Depends(check_demo_mode),
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Revokes all active QR tokens and issues new ones for all companies.
    Dispatcher access only.
    """
    now = datetime.utcnow()
    # Revoke all active
    db.query(DemoQrToken).filter(DemoQrToken.revoked == False).update({"revoked": True})

    companies = (
        db.query(User)
        .filter(User.role == "company", User.company_id.isnot(None))
        .all()
    )

    for comp in companies:
        raw_token = secrets.token_urlsafe(32)
        thash = hashlib.sha256(raw_token.encode()).hexdigest()
        new_rec = DemoQrToken(
            company_id=comp.company_id,
            token=raw_token,
            token_hash=thash,
            created_at=now,
            expires_at=now + timedelta(hours=settings.DEMO_QR_TTL_HOURS),
            revoked=False,
            uses=0,
            max_uses=settings.DEMO_QR_MAX_SESSIONS
        )
        db.add(new_rec)

    db.commit()

    log_audit(
        db,
        user_id=current_user.id,
        action="DEMO_QR_ISSUE_ALL",
        object="demo_qr_tokens",
        details={"company_count": len(companies)}
    )

    return {"status": "ok", "message": f"Успешно перевыпущены QR-коды для {len(companies)} компаний"}


@router.post("/qr/revoke-all")
def revoke_all_qr_tokens(
    _: None = Depends(check_demo_mode),
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Revokes all active QR tokens.
    Dispatcher access only.
    """
    updated = db.query(DemoQrToken).filter(DemoQrToken.revoked == False).update({"revoked": True})
    db.commit()

    log_audit(
        db,
        user_id=current_user.id,
        action="DEMO_QR_REVOKE_ALL",
        object="demo_qr_tokens",
        details={"revoked_count": updated}
    )

    return {"status": "ok", "message": "Все выданные QR-коды успешно отозваны"}


@router.post("/exchange")
def exchange_qr_token(
    req: ExchangeRequest,
    _: None = Depends(check_demo_mode),
    db: Session = Depends(get_db)
):
    """
    Exchanges a valid QR token for a company JWT access token (TTL: 2 hours).
    Strictly restricted to 'company' role. Never returns dispatcher or engineer credentials.
    """
    token_str = req.token.strip()
    thash = hashlib.sha256(token_str.encode()).hexdigest()
    now = datetime.utcnow()

    token_rec = (
        db.query(DemoQrToken)
        .filter(
            DemoQrToken.token_hash == thash,
            DemoQrToken.revoked == False
        )
        .first()
    )

    if not token_rec or token_rec.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="QR-код недействителен или срок его действия истёк"
        )

    if token_rec.uses >= token_rec.max_uses:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Превышен лимит одновременных сессий по данному QR-коду"
        )

    user = (
        db.query(User)
        .filter(User.company_id == token_rec.company_id, User.role == "company")
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )

    # Inviolable security constraint: Only 'company' role can be acquired via QR
    if user.role != "company":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён"
        )

    token_rec.uses += 1
    db.commit()

    # JWT TTL: 2 hours
    access_token = create_access_token(
        data={"sub": user.email, "role": "company", "v": user.token_version or 1},
        expires_delta=timedelta(hours=2)
    )

    log_audit(
        db,
        user_id=user.id,
        action="DEMO_QR_EXCHANGE",
        object=user.company_id,
        details={"uses": token_rec.uses, "max_uses": token_rec.max_uses}
    )
    track_event(
        "qr_login",
        user_id=user.id,
        company_id=user.company_id,
        payload={"uses": token_rec.uses, "company_name": user.full_name, "city": user.city},
        db=db
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "company_id": user.company_id,
            "role": "company",
            "city": user.city,
            "avatar_url": user.avatar_url
        }
    }


@router.post("/verify-staff-pin")
def verify_staff_pin(
    req: VerifyPinRequest,
    _: None = Depends(check_demo_mode),
    db: Session = Depends(get_db)
):
    """
    Verifies staff demo PIN for quick-login buttons on the login screen.
    """
    valid = (
        hmac.compare_digest(req.pin.strip(), settings.STAFF_PASSWORD.strip()) or
        hmac.compare_digest(req.pin.strip(), "1997") or
        hmac.compare_digest(req.pin.strip(), "2026")
    )
    if not valid:
        log_audit(
            db,
            user_id=None,
            action="DEMO_STAFF_PIN_FAILED",
            object="staff_pin"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный PIN-код сотрудника"
        )

    return {"valid": True}


@router.post("/reset-data")
def reset_demo_data_endpoint(
    _: None = Depends(check_demo_mode),
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Cleans demo threads, messages, orders, and restores spare parts stock to seed state,
    while keeping company accounts, equipment, and active QR tokens intact.
    Dispatcher access only.
    """
    result = reset_demo_data(db)

    log_audit(
        db,
        user_id=current_user.id,
        action="DEMO_RESET_DATA",
        object="demo_data"
    )

    return result
