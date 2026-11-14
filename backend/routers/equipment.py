from datetime import datetime
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Equipment, User, ClientThread, ServiceOrder
from backend.schemas import EquipmentResponse, EquipmentCreate
from backend.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["Оборудование"])

@router.get("", response_model=list[EquipmentResponse])
def get_all_equipment(db: Session = Depends(get_db)):
    items = db.query(Equipment).order_by(Equipment.code).all()
    return [EquipmentResponse.model_validate(item) for item in items]

@router.get("/{id_or_code}", response_model=EquipmentResponse)
def get_equipment_by_id_or_code(id_or_code: str, db: Session = Depends(get_db)):
    if id_or_code.isdigit():
        eq = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        eq = db.query(Equipment).filter(Equipment.code == id_or_code.upper()).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")
    return EquipmentResponse.model_validate(eq)

@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    data: EquipmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine client_name
    client_name = data.client_name
    if not client_name or not client_name.strip():
        if current_user.role == "company":
            client_name = current_user.full_name
        else:
            client_name = "ООО «Клиент»"

    # Determine city
    city = data.city or (current_user.city if current_user.city else "Москва")

    # Generate or validate code
    code = (data.code or "").strip().upper()
    if code:
        existing = db.query(Equipment).filter(Equipment.code == code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Кофемашина с кодом {code} уже существует")
    else:
        # Auto-generate next code EQ{N:02d}
        all_codes = db.query(Equipment.code).all()
        max_num = 0
        for (c,) in all_codes:
            m = re.match(r"^EQ(\d+)$", c, re.IGNORECASE)
            if m:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
        next_num = max_num + 1 if max_num > 0 else 1
        code = f"EQ{next_num:02d}"

    new_eq = Equipment(
        code=code,
        client_name=client_name.strip(),
        address=data.address.strip(),
        city=city,
        model=data.model.strip(),
        serial_number=data.serial_number.strip(),
        installation_date=data.installation_date or datetime.utcnow(),
        last_visit_date=None,
        last_visit_result=None,
        created_at=datetime.utcnow()
    )
    db.add(new_eq)
    db.commit()
    db.refresh(new_eq)
    return EquipmentResponse.model_validate(new_eq)

@router.delete("/{id_or_code}")
def delete_equipment(
    id_or_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if id_or_code.isdigit():
        eq = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        eq = db.query(Equipment).filter(Equipment.code == id_or_code.upper()).first()

    if not eq:
        raise HTTPException(status_code=404, detail="Кофемашина не найдена")

    # Permission check for company users
    if current_user.role == "company":
        clean_user = re.sub(r'[«»"\']', '', current_user.full_name).strip().lower()
        clean_eq = re.sub(r'[«»"\']', '', eq.client_name).strip().lower()
        if clean_user not in clean_eq and clean_eq not in clean_user:
            raise HTTPException(status_code=403, detail="Вы можете удалять только кофемашины своей компании")

    eq_code = eq.code
    # Nullify references in client_threads and service_orders to avoid FK violation
    db.query(ClientThread).filter(ClientThread.equipment_id == eq.id).update(
        {ClientThread.equipment_id: None}, synchronize_session=False
    )
    db.query(ServiceOrder).filter(ServiceOrder.equipment_id == eq.id).update(
        {ServiceOrder.equipment_id: None}, synchronize_session=False
    )

    db.delete(eq)
    db.commit()

    return {"detail": "Кофемашина успешно удалена", "equipment_code": eq_code}
