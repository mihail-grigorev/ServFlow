import os
import uuid
import io
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from PIL import Image

from backend.config import settings
from backend.database import get_db
from backend.models import User, ServiceOrder, VerificationCode
from backend.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    StaffCreate,
    UserResponse,
    UserProfileUpdate,
    SendCodeRequest,
    SendCodeResponse,
    ConfirmCodeRequest
)
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_dispatcher,
    oauth2_scheme
)
from backend.email_service import (
    generate_verification_code,
    hash_verification_code,
    verify_code_hash,
    send_yandex_verification_email
)
from backend.rate_limiter import (
    check_failed_login_limit,
    record_failed_login,
    clear_failed_login,
    check_code_request_cooldown,
    record_code_request
)
from backend.audit import log_audit
from backend.seed import get_company_id_for_client

router = APIRouter(prefix="/auth", tags=["Аутентификация"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "avatars")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_AVATAR_DIMENSION = 2000

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    clean_email = req.email.strip().lower()

    # Rate limiting: max 5 failed attempts per 15 min per IP+email pair
    if not check_failed_login_limit(ip, clean_email):
        log_audit(db, action="login_blocked_rate_limit", ip=ip, object=clean_email)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток входа. Попробуйте через 15 минут.",
        )

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    pwd = req.password

    # Match user's own password, trimmed password, or standard demo password fallback in DEMO_MODE
    is_valid = False
    if user:
        if verify_password(pwd, user.hashed_password) or verify_password(pwd.strip(), user.hashed_password):
            is_valid = True
        elif settings.DEMO_MODE and pwd.strip() in ["password123", "admin", "123456", "12345678"]:
            is_valid = True

    if not is_valid:
        record_failed_login(ip, clean_email)
        log_audit(db, action="login_failed", ip=ip, object=clean_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clear_failed_login(ip, clean_email)
    log_audit(db, action="login_success", user_id=user.id, ip=ip, object=user.email)

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "v": getattr(user, 'token_version', 1) or 1
    })
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout-all")
def logout_all_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Security requirement B3: Revokes all existing access tokens by incrementing token_version.
    """
    current_user.token_version = (getattr(current_user, 'token_version', 1) or 1) + 1
    db.commit()
    log_audit(db, action="logout_all_sessions", user_id=current_user.id, object=current_user.email)
    return {"status": "success", "message": "Все активные сессии успешно завершены"}


@router.post("/switch-user/{user_id}", response_model=TokenResponse)
def switch_user(
    user_id: int,
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Security check K2: Allowed only in DEMO_MODE or by authenticated dispatcher.
    """
    if not settings.DEMO_MODE:
        # If not demo mode, require authenticated dispatcher
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация диспетчера")
        current_user = get_current_user(token=token, db=db)
        if current_user.role != "dispatcher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Переключение пользователей доступно только диспетчеру")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    ip = get_client_ip(request)
    log_audit(db, action="switch_user", user_id=user.id, ip=ip, object=user.email)

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "v": getattr(user, 'token_version', 1) or 1
    })
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/register/send-code", response_model=SendCodeResponse)
def send_register_code(req: SendCodeRequest, request: Request, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите корректный email адрес")

    # Cooldown check: 60s between code requests per email
    can_send, remaining = check_code_request_cooldown(clean_email, "register")
    if not can_send:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Повторная отправка кода возможна через {remaining} сек."
        )

    # Security check B2: Uniform response to prevent email enumeration
    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        # Return generic uniform success message without generating new code
        return SendCodeResponse(
            status="success",
            message="Если данный email адрес корректен, проверочный код отправлен."
        )

    # Invalidate previous unused registration codes for this email
    db.query(VerificationCode).filter(
        func.lower(VerificationCode.email) == clean_email,
        VerificationCode.purpose == "register",
        VerificationCode.is_used == False
    ).update({"is_used": True})

    code = generate_verification_code()
    code_hash = hash_verification_code(clean_email, code)

    vcode = VerificationCode(
        email=clean_email,
        code=code,
        code_hash=code_hash,
        attempts=0,
        purpose="register",
        expires_at=datetime.utcnow() + timedelta(minutes=15),
        is_used=False
    )
    db.add(vcode)
    db.commit()
    record_code_request(clean_email, "register")

    ip = get_client_ip(request)
    log_audit(db, action="send_register_code", ip=ip, object=clean_email)

    success, msg = send_yandex_verification_email(clean_email, code, purpose="register")
    if not success and not settings.DEMO_MODE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return SendCodeResponse(
        status="success",
        message="Если данный email адрес корректен, проверочный код отправлен."
    )


@router.post("/register", response_model=TokenResponse)
def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    clean_email = user_in.email.strip().lower()
    ip = get_client_ip(request)

    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )

    # Check 6-digit confirmation code
    if not user_in.code or not user_in.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите 6-значный проверочный код, отправленный на вашу почту"
        )

    clean_code = user_in.code.strip()
    vcode = db.query(VerificationCode).filter(
        func.lower(VerificationCode.email) == clean_email,
        VerificationCode.purpose == "register",
        VerificationCode.is_used == False,
        VerificationCode.expires_at > datetime.utcnow()
    ).order_by(VerificationCode.id.desc()).first()

    if not vcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код подтверждения. Запросите новый код."
        )

    # Security check B1: Maximum 5 attempts per code
    if getattr(vcode, 'attempts', 0) >= 5:
        vcode.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Превышено максимальное число попыток ввода кода (5). Запросите новый код."
        )

    is_valid_code = verify_code_hash(clean_email, clean_code, getattr(vcode, 'code_hash', None), vcode.code)
    if not is_valid_code:
        vcode.attempts = getattr(vcode, 'attempts', 0) + 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный проверочный код"
        )

    vcode.is_used = True

    # Security check K4: Registration strictly creates company role; ignore client role/senior inputs
    full_name_clean = user_in.full_name.strip()
    company_id = get_company_id_for_client(full_name_clean)

    user = User(
        email=clean_email,
        full_name=full_name_clean,
        role="company",
        city=user_in.city or "Москва",
        company_id=company_id,
        is_senior=False,
        qualifications=[],
        avatar_url=user_in.avatar_url,
        hashed_password=get_password_hash(user_in.password.strip()),
        token_version=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit(db, action="register_company", user_id=user.id, ip=ip, object=user.email)

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "v": user.token_version
    })
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/staff", response_model=UserResponse)
def create_staff_user(
    staff_in: StaffCreate,
    request: Request,
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Security check K4: Only authenticated dispatchers can create new engineers or dispatchers.
    """
    clean_email = staff_in.email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    new_staff = User(
        email=clean_email,
        full_name=staff_in.full_name.strip(),
        role=staff_in.role,
        city=staff_in.city or "Москва",
        company_id=None,
        is_senior=staff_in.is_senior,
        qualifications=staff_in.qualifications or [],
        hashed_password=get_password_hash(staff_in.password.strip()),
        token_version=1
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    ip = get_client_ip(request)
    log_audit(
        db,
        action="create_staff",
        user_id=current_user.id,
        ip=ip,
        object=new_staff.email,
        details={"role": new_staff.role, "is_senior": new_staff.is_senior}
    )

    return UserResponse.model_validate(new_staff)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_data: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Security check K4: Only dispatcher can change is_senior or qualifications
    if profile_data.is_senior is not None or profile_data.qualifications is not None:
        if current_user.role != "dispatcher":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Изменение квалификаций и статуса старшего специалиста доступно только диспетчеру"
            )
        if profile_data.is_senior is not None:
            user.is_senior = profile_data.is_senior
        if profile_data.qualifications is not None:
            user.qualifications = profile_data.qualifications

    # Changing email requires code confirmation
    if profile_data.email and profile_data.email.strip().lower() != user.email.lower():
        clean_new_email = profile_data.email.strip().lower()
        existing = db.query(User).filter(func.lower(User.email) == clean_new_email).first()
        if existing and existing.id != user.id:
            raise HTTPException(status_code=400, detail="Этот email уже занят другим пользователем")

        if not profile_data.code or not profile_data.code.strip():
            raise HTTPException(
                status_code=400,
                detail="Для смены email необходимо ввести код подтверждения, отправленный на новый адрес"
            )

        vcode = db.query(VerificationCode).filter(
            func.lower(VerificationCode.email) == clean_new_email,
            VerificationCode.purpose == "change_email",
            VerificationCode.is_used == False,
            VerificationCode.expires_at > datetime.utcnow()
        ).order_by(VerificationCode.id.desc()).first()

        if not vcode or not verify_code_hash(clean_new_email, profile_data.code.strip(), getattr(vcode, 'code_hash', None), vcode.code):
            raise HTTPException(status_code=400, detail="Неверный или просроченный проверочный код")

        vcode.is_used = True
        user.email = clean_new_email

    if profile_data.full_name is not None:
        user.full_name = profile_data.full_name.strip()
    if profile_data.city is not None:
        user.city = profile_data.city
    if profile_data.avatar_url is not None:
        user.avatar_url = profile_data.avatar_url

    # Changing password revokes older tokens
    if profile_data.password and profile_data.password.strip():
        user.hashed_password = get_password_hash(profile_data.password.strip())
        user.token_version = (getattr(user, 'token_version', 1) or 1) + 1

    db.commit()
    db.refresh(user)

    ip = get_client_ip(request)
    log_audit(db, action="update_profile", user_id=user.id, ip=ip, object=user.email)
    return UserResponse.model_validate(user)


@router.post("/delete-account/send-code", response_model=SendCodeResponse)
def send_delete_account_code(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_email = current_user.email.strip().lower()

    can_send, remaining = check_code_request_cooldown(clean_email, "delete_account")
    if not can_send:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Повторная отправка кода возможна через {remaining} сек."
        )

    # Invalidate previous unused delete codes
    db.query(VerificationCode).filter(
        func.lower(VerificationCode.email) == clean_email,
        VerificationCode.purpose == "delete_account",
        VerificationCode.is_used == False
    ).update({"is_used": True})

    code = generate_verification_code()
    code_hash = hash_verification_code(clean_email, code)

    vcode = VerificationCode(
        email=clean_email,
        code=code,
        code_hash=code_hash,
        attempts=0,
        purpose="delete_account",
        expires_at=datetime.utcnow() + timedelta(minutes=15),
        is_used=False
    )
    db.add(vcode)
    db.commit()
    record_code_request(clean_email, "delete_account")

    ip = get_client_ip(request)
    log_audit(db, action="send_delete_account_code", user_id=current_user.id, ip=ip, object=clean_email)

    success, msg = send_yandex_verification_email(clean_email, code, purpose="delete_account")
    if not success and not settings.DEMO_MODE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return SendCodeResponse(
        status="success",
        message="Код подтверждения отправлен на ваш email адрес."
    )


@router.post("/delete-account/confirm")
def confirm_delete_account(
    req: ConfirmCodeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_email = current_user.email.strip().lower()
    clean_code = req.code.strip()

    vcode = db.query(VerificationCode).filter(
        func.lower(VerificationCode.email) == clean_email,
        VerificationCode.purpose == "delete_account",
        VerificationCode.is_used == False,
        VerificationCode.expires_at > datetime.utcnow()
    ).order_by(VerificationCode.id.desc()).first()

    if not vcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код подтверждения удаления."
        )

    if getattr(vcode, 'attempts', 0) >= 5:
        vcode.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Превышено максимальное число попыток ввода кода (5)."
        )

    if not verify_code_hash(clean_email, clean_code, getattr(vcode, 'code_hash', None), vcode.code):
        vcode.attempts = getattr(vcode, 'attempts', 0) + 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный проверочный код")

    vcode.is_used = True

    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Safely clear FK references in orders before deleting
    db.query(ServiceOrder).filter(ServiceOrder.engineer_id == user.id).update({"engineer_id": None})
    db.query(ServiceOrder).filter(ServiceOrder.created_by_id == user.id).update({"created_by_id": None})

    ip = get_client_ip(request)
    log_audit(db, action="delete_account", user_id=user.id, ip=ip, object=user.email)

    db.delete(user)
    db.commit()
    return {"status": "success", "message": "Профиль успешно удалён"}


@router.delete("/profile")
def delete_profile(
    code: Optional[str] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not code or not code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для удаления профиля необходимо ввести код подтверждения, отправленный на ваш email"
        )
    return confirm_delete_account(ConfirmCodeRequest(code=code.strip()), request, current_user, db)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Security check B4:
    - Strictly disallows .svg (stored XSS prevention)
    - Validates max file size 2 MB
    - Inspects file headers via Pillow (allowed: PNG, JPEG, WEBP)
    - Validates dimensions <= 2000x2000
    - Re-encodes as clean WebP without EXIF
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext == ".svg":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загрузка SVG файлов запрещена правилами безопасности. Используйте PNG, JPEG или WEBP."
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла превышает допустимый лимит 2 МБ"
        )

    try:
        img = Image.open(io.BytesIO(content))
        img.verify()

        # Re-open image after verify()
        img = Image.open(io.BytesIO(content))
        allowed_formats = {"PNG", "JPEG", "WEBP"}
        if (img.format or "").upper() not in allowed_formats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Разрешены только изображения форматов PNG, JPEG или WEBP"
            )

        width, height = img.size
        if width > MAX_AVATAR_DIMENSION or height > MAX_AVATAR_DIMENSION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Разрешение изображения не должно превышать {MAX_AVATAR_DIMENSION}x{MAX_AVATAR_DIMENSION} px"
            )

        filename = f"{current_user.id}_{uuid.uuid4().hex}.webp"
        filepath = os.path.join(UPLOAD_DIR, filename)

        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "RGB")

        # Save as stripped WebP
        img.save(filepath, format="WEBP", quality=85)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или поврежденный файл изображения"
        )

    avatar_url = f"/api/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    ip = get_client_ip(request) if request else "127.0.0.1"
    log_audit(db, action="upload_avatar", user_id=current_user.id, ip=ip, object=avatar_url)

    return {"avatar_url": avatar_url}


@router.get("/demo-users", response_model=list[UserResponse])
def get_demo_users(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Security check K2: Allowed when DEMO_MODE=True or by authenticated dispatcher.
    """
    if not settings.DEMO_MODE:
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация диспетчера")
        current_user = get_current_user(token=token, db=db)
        if current_user.role != "dispatcher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Список пользователей доступен только диспетчеру")

    users = db.query(User).order_by(User.role, User.city, User.is_senior.desc()).all()
    return [UserResponse.model_validate(u) for u in users]
