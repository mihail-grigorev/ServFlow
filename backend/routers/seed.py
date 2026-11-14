import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.seed import seed_database

router = APIRouter(prefix="/seed", tags=["Сброс и импорт данных"])

@router.post("/reset")
def reset_data(db: Session = Depends(get_db)):
    """
    Resets database to the initial 23 morning requests and initial stocks.
    """
    res = seed_database(db)
    return res

@router.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts an uploaded .xlsx file and reseeds database.
    """
    save_path = "uploaded_data.xlsx"
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    res = seed_database(db, excel_path=save_path)
    return {"status": "success", "message": "Файл успешно загружен и данные импортированы в базу данных!"}

