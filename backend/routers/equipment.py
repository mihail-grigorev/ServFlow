from datetime import datetime
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import get_db
from backend.models import Equipment, User
from backend.schemas import EquipmentResponse, EquipmentCreate
from backend.auth import get_current_user
from backend.seed import get_company_id_for_client

router = APIRouter(prefix="/equipment", tags=["Оборудование"])

@router.get("", response_model=list[EquipmentResponse])
def get_all_equipment(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Equipment)
    # Security check K6: Company only sees their own equipment per contracts
    if current_user.role == "company":
        comp_id = current_user.company_id
        user_name = current_user.full_name.strip()
        conds = []
        if comp_id:
            conds.append(Equipment.company_id == comp_id)
        if user_name:
            conds.append(Equipment.client_name == user_name)
        if conds:
            query = query.filter(or_(*conds))
        else:
            return []

    items = query.order_by(Equipment.code).all()
    return [EquipmentResponse.model_validate(item) for item in items]

@router.get("/{id_or_code}", response_model=EquipmentResponse)
def get_equipment_by_id_or_code(
    id_or_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if id_or_code.isdigit():
        eq = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        eq = db.query(Equipment).filter(Equipment.code == id_or_code.upper()).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    # Security check K6: Company cannot inspect equipment of other companies
    if current_user.role == "company":
        matches_comp = (eq.company_id and eq.company_id == current_user.company_id)
        matches_name = (eq.client_name == current_user.full_name.strip())
        if not (matches_comp or matches_name):
            raise HTTPException(status_code=404, detail="Оборудование не найдено")

    return EquipmentResponse.model_validate(eq)

@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    data: EquipmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    client_name = data.client_name
    if not client_name or not client_name.strip():
        if current_user.role == "company":
            client_name = current_user.full_name
        else:
            client_name = "ООО «Клиент»"

    city = data.city or (current_user.city if current_user.city else "Москва")
    code = (data.code or "").strip().upper()
    if code:
        existing = db.query(Equipment).filter(Equipment.code == code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Кофемашина с кодом {code} уже существует")
    else:
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

    company_id = data.company_id or current_user.company_id or get_company_id_for_client(client_name)

    new_eq = Equipment(
        code=code,
        client_name=client_name.strip(),
        company_id=company_id,
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
