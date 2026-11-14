from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from backend.database import get_db
from backend.models import ServiceOrder, ClientThread, SparePart, Equipment, User, Message
from backend.schemas import (
    ServiceOrderCreate, ServiceOrderResponse, ServiceOrderStatusUpdate, ServiceOrderReportUpdate, ServiceOrderUpdate, ClientThreadResponse
)
from backend.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["Заявки на выезд"])

@router.get("", response_model=list[ServiceOrderResponse])
def get_orders(
    status: Optional[str] = Query(None),
    engineer_id: Optional[int] = Query(None),
    is_warranty: Optional[bool] = Query(None),
    client_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ServiceOrder)

    # Rule: If current user is a company, only return their own service orders!
    if current_user.role == "company":
        comp_name = current_user.full_name.strip()
        clean = comp_name.replace("«", "").replace("»", "").replace('"', '').replace("'", "").strip()
        words = [w for w in clean.split() if len(w) > 2 and w.lower() not in ["кафе", "ооо", "зао", "ип", "гостиница", "пекарня", "ресторан"]]
        conds = [ServiceOrder.client_name == comp_name, ServiceOrder.client_name.ilike(f"%{clean}%")]
        for w in words:
            conds.append(ServiceOrder.client_name.ilike(f"%{w}%"))
        query = query.filter(or_(*conds))
    elif client_name and client_name.strip():
        c_name = client_name.strip()
        query = query.filter(ServiceOrder.client_name.ilike(f"%{c_name}%"))

    if status:
        query = query.filter(ServiceOrder.status == status)
    if engineer_id is not None:
        query = query.filter(ServiceOrder.engineer_id == engineer_id)
    if is_warranty is not None:
        query = query.filter(ServiceOrder.is_warranty == is_warranty)

    orders = query.order_by(ServiceOrder.created_at.desc()).all()
    return [ServiceOrderResponse.model_validate(o) for o in orders]

@router.get("/engineer-recommendations")
def get_engineer_recommendations(
    model: str = Query(...),
    city: str = Query("Москва"),
    symptom: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    engineers = db.query(User).filter(User.role == "engineer").all()
    results = []

    symptom_words = []
    if symptom:
        clean_sym = symptom.lower().replace(",", " ").replace(".", " ").replace("!", " ")
        symptom_words = [w for w in clean_sym.split() if len(w) >= 4 and w not in ["кофемашина", "кофемашины", "здравствуйте", "пожалуйста", "нужно", "требуется"]]

    for eng in engineers:
        active_orders = db.query(ServiceOrder).filter(
            ServiceOrder.engineer_id == eng.id,
            ServiceOrder.status.in_(["Назначен", "В пути", "На месте", "Диагностика", "Согласование", "Новая", "Создана"])
        ).count()

        history_orders = db.query(ServiceOrder).filter(ServiceOrder.engineer_id == eng.id).all()
        completed_orders = sum(1 for o in history_orders if o.status == "Выполнен")
        model_experience_count = sum(1 for o in history_orders if o.model == model)

        symptom_match_count = 0
        if symptom_words:
            for o in history_orders:
                hist_text = f"{o.symptom or ''} {o.inspection_report or ''}".lower()
                if any(w in hist_text for w in symptom_words):
                    symptom_match_count += 1

        has_qual = model in (eng.qualifications or [])
        city_match = (eng.city or "").lower() == city.lower()

        score = 0
        if city_match:
            score += 100
        if has_qual:
            score += 40
        score += model_experience_count * 25
        score += symptom_match_count * 20
        score += completed_orders * 5
        score -= active_orders * 35

        reasons = []
        if active_orders == 0:
            reasons.append("свободен (0 активных заявок)")
        else:
            reasons.append(f"{active_orders} активн. заявк{'а' if active_orders == 1 else 'и'}")

        if model_experience_count > 0:
            reasons.append(f"опыт по {model} ({model_experience_count} в журнале)")
        elif has_qual:
            reasons.append(f"допуск к {model}")

        if symptom_match_count > 0:
            reasons.append("устранял аналогичную проблему")

        reason_str = ", ".join(reasons)

        results.append({
            "id": eng.id,
            "full_name": eng.full_name,
            "city": eng.city,
            "is_senior": eng.is_senior,
            "qualifications": eng.qualifications or [],
            "avatar_url": eng.avatar_url,
            "active_orders": active_orders,
            "completed_orders": completed_orders,
            "model_experience_count": model_experience_count,
            "symptom_match_count": symptom_match_count,
            "city_match": city_match,
            "score": score,
            "recommendation_reason": reason_str,
            "is_recommended": False
        })

    results.sort(key=lambda x: (x["city_match"], x["score"], -x["active_orders"]), reverse=True)
    if results and results[0]["city_match"]:
        results[0]["is_recommended"] = True
        results[0]["recommendation_reason"] = "⭐ Рекомендуется первым: " + results[0]["recommendation_reason"]

    return results

@router.get("/{order_id}", response_model=ServiceOrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return ServiceOrderResponse.model_validate(order)

@router.get("/{order_id}/thread", response_model=ClientThreadResponse)
def get_order_thread(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    thread = None
    if order.thread_id:
        thread = db.query(ClientThread).filter(ClientThread.id == order.thread_id).first()

    if not thread:
        max_num = (db.query(func.max(ClientThread.thread_number)).scalar() or 0) + 1
        thread = ClientThread(
            thread_number=max_num,
            client_name=order.client_name,
            equipment_id=order.equipment_id,
            equipment_code=order.equipment_code,
            status="order_created",
            channel="Мессенджер",
            is_warranty=order.is_warranty,
            warranty_reason=order.warranty_reason,
            is_unregistered=order.is_sales_transfer,
            last_activity=datetime.utcnow()
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)

        initial_msg = Message(
            thread_id=thread.id,
            channel="Мессенджер",
            chat_type="client_dispatcher",
            sender_type="system",
            sender_name="Система ServFlow",
            content=f"Открыта ветка переписки по заявке {order.order_number}. Оборудование: {order.equipment_code or order.model}. Симптом: {order.symptom}",
            created_at=datetime.utcnow()
        )
        db.add(initial_msg)
        order.thread_id = thread.id
        db.commit()
        db.refresh(thread)

    resp = ClientThreadResponse.model_validate(thread)
    resp.linked_order_number = order.order_number
    resp.assigned_engineer_id = order.engineer_id
    if order.engineer_id:
        eng_user = db.query(User).filter(User.id == order.engineer_id).first()
        if eng_user:
            resp.assigned_engineer_name = eng_user.full_name
    if current_user.role == "company":
        resp.messages = [m for m in resp.messages if getattr(m, 'chat_type', 'client_dispatcher') != 'dispatcher_engineer']
    return resp

@router.post("", response_model=ServiceOrderResponse)
def create_order(
    order_in: ServiceOrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find equipment if code is provided
    equipment = None
    if order_in.equipment_code:
        equipment = db.query(Equipment).filter(Equipment.code == order_in.equipment_code).first()

    # Reserve spare parts in database (Rule П-8)
    reserved_parts_json = []
    for item in order_in.reserved_parts:
        part = db.query(SparePart).filter(SparePart.code == item.code).first()
        if part:
            qty = max(1, item.quantity)
            if item.source_city.lower() == "москва":
                part.moscow_reserved += qty
            else:
                part.tula_reserved += qty
            reserved_parts_json.append({
                "code": item.code,
                "name": part.name,
                "quantity": qty,
                "source_city": item.source_city,
                "transfer_required": item.transfer_required
            })

    # DEDUPLICATION CHECK: If an order already exists for this thread or equipment, update it instead of creating a duplicate!
    existing_order = None
    if order_in.thread_id:
        existing_order = db.query(ServiceOrder).filter(ServiceOrder.thread_id == order_in.thread_id).first()
    if not existing_order and order_in.equipment_code:
        existing_order = db.query(ServiceOrder).filter(
            ServiceOrder.equipment_code == order_in.equipment_code,
            ServiceOrder.client_name == order_in.client_name,
            ServiceOrder.status.in_(["Новая", "Создана", "Вне договора"])
        ).first()

    if existing_order:
        existing_order.client_name = order_in.client_name
        existing_order.equipment_id = equipment.id if equipment else existing_order.equipment_id
        existing_order.equipment_code = order_in.equipment_code or (equipment.code if equipment else existing_order.equipment_code)
        existing_order.address = order_in.address or existing_order.address
        existing_order.model = order_in.model or existing_order.model
        existing_order.serial_number = order_in.serial_number or existing_order.serial_number
        existing_order.symptom = order_in.symptom or existing_order.symptom
        existing_order.client_assumption = order_in.client_assumption
        existing_order.is_warranty = order_in.is_warranty
        existing_order.warranty_reason = order_in.warranty_reason
        existing_order.is_sales_transfer = order_in.is_sales_transfer
        existing_order.status = "Назначен" if order_in.engineer_id else ("В работе" if existing_order.status == "В работе" else "Создана")
        existing_order.engineer_id = order_in.engineer_id
        if reserved_parts_json:
            existing_order.reserved_parts = reserved_parts_json
        existing_order.updated_at = datetime.utcnow()
        order = existing_order
    else:
        today_str = datetime.utcnow().strftime("%Y%m%d")
        count = db.query(ServiceOrder).count() + 1
        order_number = f"ORD-{today_str}-{count:03d}"
        order = ServiceOrder(
            order_number=order_number,
            thread_id=order_in.thread_id,
            client_name=order_in.client_name,
            equipment_id=equipment.id if equipment else None,
            equipment_code=order_in.equipment_code or (equipment.code if equipment else None),
            address=order_in.address,
            model=order_in.model,
            serial_number=order_in.serial_number,
            symptom=order_in.symptom,
            client_assumption=order_in.client_assumption,
            is_warranty=order_in.is_warranty,
            warranty_reason=order_in.warranty_reason,
            is_sales_transfer=order_in.is_sales_transfer,
            status="Назначен" if order_in.engineer_id else "Создана",
            engineer_id=order_in.engineer_id,
            reserved_parts=reserved_parts_json,
            created_by_id=current_user.id,
            created_at=datetime.utcnow()
        )
        db.add(order)

    # Update associated thread status if present
    if order_in.thread_id:
        thread = db.query(ClientThread).filter(ClientThread.id == order_in.thread_id).first()
        if thread:
            thread.status = "order_created"

    db.commit()
    db.refresh(order)
    return ServiceOrderResponse.model_validate(order)


@router.put("/{order_id}", response_model=ServiceOrderResponse)
def update_order(
    order_id: int,
    order_update: ServiceOrderUpdate,
    db: Session = Depends(get_db)
):
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if order_update.client_name is not None:
        order.client_name = order_update.client_name
    if order_update.address is not None:
        order.address = order_update.address
    if order_update.model is not None:
        order.model = order_update.model
    if order_update.serial_number is not None:
        order.serial_number = order_update.serial_number
    if order_update.symptom is not None:
        order.symptom = order_update.symptom
    if order_update.client_assumption is not None:
        order.client_assumption = order_update.client_assumption
    if order_update.is_warranty is not None:
        order.is_warranty = order_update.is_warranty
    if order_update.warranty_reason is not None:
        order.warranty_reason = order_update.warranty_reason
    if order_update.status is not None:
        order.status = order_update.status
    if order_update.engineer_id is not None:
        order.engineer_id = order_update.engineer_id if order_update.engineer_id > 0 else None
    if order_update.inspection_report is not None:
        order.inspection_report = order_update.inspection_report

    if order_update.reserved_parts is not None:
        reserved_parts_json = []
        for item in order_update.reserved_parts:
            part = db.query(SparePart).filter(SparePart.code == item.code).first()
            qty = max(1, item.quantity)
            reserved_parts_json.append({
                "code": item.code,
                "name": item.name or (part.name if part else item.code),
                "quantity": qty,
                "source_city": item.source_city,
                "transfer_required": item.transfer_required
            })
        order.reserved_parts = reserved_parts_json

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return ServiceOrderResponse.model_validate(order)


@router.patch("/{order_id}/status", response_model=ServiceOrderResponse)
def update_order_status(
    order_id: int,
    status_update: ServiceOrderStatusUpdate,
    db: Session = Depends(get_db)
):
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    order.status = status_update.status
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return ServiceOrderResponse.model_validate(order)


@router.post("/{order_id}/report", response_model=ServiceOrderResponse)
def submit_order_report(
    order_id: int,
    report_in: ServiceOrderReportUpdate,
    db: Session = Depends(get_db)
):
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    order.inspection_report = report_in.inspection_report
    order.status = report_in.status or "Выполнен"
    order.updated_at = datetime.utcnow()

    # Update equipment last visit history if applicable
    if order.equipment_id:
        eq = db.query(Equipment).filter(Equipment.id == order.equipment_id).first()
        if eq:
            eq.last_visit_date = datetime.utcnow()
            eq.last_visit_result = report_in.inspection_report

    db.commit()
    db.refresh(order)
    return ServiceOrderResponse.model_validate(order)

@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "dispatcher":
        raise HTTPException(status_code=403, detail="Удаление заявки доступно только диспетчеру")

    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Release reserved parts back to warehouse
    if order.reserved_parts:
        try:
            for item in order.reserved_parts:
                if isinstance(item, dict):
                    code = item.get("code")
                    qty = max(1, item.get("quantity", 1))
                    city = str(item.get("source_city", "")).lower()
                    if code:
                        part = db.query(SparePart).filter(SparePart.code == code).first()
                        if part:
                            if "москва" in city:
                                part.moscow_reserved = max(0, (part.moscow_reserved or 0) - qty)
                            else:
                                part.tula_reserved = max(0, (part.tula_reserved or 0) - qty)
        except Exception as e:
            print(f"Error restoring reserved parts: {e}")

    # If linked to a thread, update thread status
    if order.thread_id:
        try:
            thread = db.query(ClientThread).filter(ClientThread.id == order.thread_id).first()
            if thread and thread.status == "order_created":
                thread.status = "ready_for_order"
        except Exception as e:
            print(f"Error resetting thread status: {e}")

    db.delete(order)
    db.commit()
    return {"detail": "Заявка успешно удалена", "order_id": order_id}
