import os
import uuid
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database import get_db
from backend.models import User
from backend.seed import seed_database
from backend.auth import require_dispatcher
from backend.audit import log_audit

router = APIRouter(prefix="/seed", tags=["Сброс и импорт данных"])

MAX_EXCEL_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/reset")
def reset_data(
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Security check K3: Resets database only if DEMO_MODE=true and called by dispatcher.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Сброс базы данных разрешен только при активном режиме DEMO_MODE=true"
        )

    res = seed_database(db)
    log_audit(db, action="seed_reset", user_id=current_user.id, object="database")
    return res

@router.post("/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    """
    Security check K3:
    - Allowed only for dispatcher and DEMO_MODE=true
    - Strictly validates .xlsx extension
    - Enforces max size 5 MB
    - Processes inside a temporary file with a unique UUID
    - Always removes the temporary file in a finally block
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Импорт данных из Excel разрешен только при активном режиме DEMO_MODE=true"
        )

    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешена загрузка файлов только с расширением .xlsx"
        )

    content = await file.read()
    if len(content) > MAX_EXCEL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла превышает допустимый лимит 5 МБ"
        )

    temp_dir = tempfile.gettempdir()
    unique_filename = f"servflow_upload_{uuid.uuid4().hex}.xlsx"
    temp_path = os.path.join(temp_dir, unique_filename)

    try:
        with open(temp_path, "wb") as f:
            f.write(content)

        res = seed_database(db, excel_path=temp_path)
        log_audit(db, action="seed_upload_excel", user_id=current_user.id, object=filename)
        return {
            "status": "success",
            "message": "Файл успешно загружен и данные импортированы в базу данных!"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка обработки Excel файла: {e}"
        )
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
