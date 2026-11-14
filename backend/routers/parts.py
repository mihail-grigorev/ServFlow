from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import SparePart
from backend.schemas import SparePartResponse

router = APIRouter(prefix="/parts", tags=["Запчасти"])

@router.get("", response_model=list[SparePartResponse])
def get_all_spare_parts(db: Session = Depends(get_db)):
    parts = db.query(SparePart).order_by(SparePart.code).all()
    results = []
    for p in parts:
        moscow_free = max(0, p.moscow_stock - p.moscow_reserved)
        tula_free = max(0, p.tula_stock - p.tula_reserved)
        results.append(SparePartResponse(
            id=p.id,
            code=p.code,
            name=p.name,
            compatible_models=p.compatible_models if isinstance(p.compatible_models, list) else [],
            moscow_stock=p.moscow_stock,
            moscow_reserved=p.moscow_reserved,
            moscow_free=moscow_free,
            tula_stock=p.tula_stock,
            tula_reserved=p.tula_reserved,
            tula_free=tula_free
        ))
    return results

