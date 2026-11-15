from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from backend.config import settings
from backend.database import get_db
from backend.models import ClientThread, Message, Equipment, User, ServiceOrder
from backend.schemas import (
    ClientThreadResponse, MessageCreate, MessageResponse, SimulateCustomerMessageRequest, CreateThreadRequest
)
from backend.auth import get_current_user
from backend.rules_engine import RulesEngine

router = APIRouter(prefix="/threads", tags=["Обращения и переписка"])

AUTO_REPLY_ENABLED = True

@router.get("/settings/auto-reply")
def get_auto_reply_setting():
    global AUTO_REPLY_ENABLED
    return {"auto_reply_enabled": AUTO_REPLY_ENABLED}

@router.post("/settings/auto-reply")
def set_auto_reply_setting(payload: dict):
    global AUTO_REPLY_ENABLED
    AUTO_REPLY_ENABLED = bool(payload.get("auto_reply_enabled", True))
    return {"auto_reply_enabled": AUTO_REPLY_ENABLED}

@router.post("/auto-reply-all")
def auto_reply_all_threads(
    db: Session = Depends(get_db)
):
    """
    Applies AI auto-reply to all active client threads that need clarification or customer reply.
    """
    global AUTO_REPLY_ENABLED
    AUTO_REPLY_ENABLED = True
    
    threads = db.query(ClientThread).filter(
        ClientThread.status.in_(["needs_clarification", "ready_for_order", "new"])
    ).all()
    all_eq = db.query(Equipment).all()
    
    replied_count = 0
    now = datetime.utcnow()
    
    for thread in threads:
        # Check messages in thread
        all_thread_msgs = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.id.asc()).all()
        client_msgs = [m for m in all_thread_msgs if m.sender_type == "client"]
        if not client_msgs:
            continue

        # Check if the last message in client_dispatcher channel is already from dispatcher
        disp_msgs = [m for m in all_thread_msgs if m.sender_type == "dispatcher" and getattr(m, 'chat_type', 'client_dispatcher') == 'client_dispatcher']
        last_msg = all_thread_msgs[-1] if all_thread_msgs else None
        
        # If last message was from client, or thread still needs clarification without dispatcher response
        if last_msg and last_msg.sender_type == "client":
            full_client_text = " ".join([m.content for m in client_msgs])
            
            eq = None
            if thread.equipment_id:
                eq = db.query(Equipment).filter(Equipment.id == thread.equipment_id).first()
            if not eq and thread.equipment_code:
                eq = db.query(Equipment).filter(Equipment.code == thread.equipment_code).first()
            
            eq_info = {"equipment": eq, "is_ambiguous": False, "is_unregistered": False}
            if not eq:
                eq_info = RulesEngine.identify_equipment(thread.client_name, full_client_text, all_eq)
                eq = eq_info.get("equipment")
                if eq:
                    thread.equipment_id = eq.id
                    thread.equipment_code = eq.code
            
            is_warranty = thread.is_warranty
            warranty_reason = thread.warranty_reason
            if eq and not is_warranty:
                is_warranty, warranty_reason = RulesEngine.check_warranty(
                    eq.installation_date,
                    eq.last_visit_date,
                    eq.last_visit_result,
                    full_client_text
                )
                thread.is_warranty = is_warranty
                thread.warranty_reason = warranty_reason
            
            ai_reply = RulesEngine.generate_conversational_reply(
                messages_history=all_thread_msgs,
                client_name=thread.client_name,
                equipment_info=eq_info,
                is_warranty=is_warranty,
                warranty_reason=warranty_reason,
                all_equipment=all_eq
            )
            
            if ai_reply:
                msg_time = (last_msg.created_at + timedelta(minutes=1)) if (last_msg and last_msg.created_at) else now
                auto_msg = Message(
                    thread_id=thread.id,
                    channel=thread.channel,
                    chat_type="client_dispatcher",
                    sender_type="dispatcher",
                    sender_name="ИИ-Диспетчер ServFlow",
                    content=ai_reply,
                    created_at=msg_time
                )
                db.add(auto_msg)
                thread.last_activity = msg_time
                if "уточните" in ai_reply.lower() or "подскажите" in ai_reply.lower() or eq_info.get("is_ambiguous"):
                    thread.status = "needs_clarification"
                replied_count += 1
                
    db.commit()
    return {"success": True, "replied_count": replied_count, "auto_reply_enabled": True}


@router.get("", response_model=list[ClientThreadResponse])
def get_threads(
    filter_type: Optional[str] = Query("all", description="all, needs_clarification, ready_for_order, warranty, unregistered"),
    search: Optional[str] = Query(None, description="Search by client or text"),
    client_name: Optional[str] = Query(None, description="Filter by company/client name"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ClientThread)

    if filter_type == "needs_clarification":
        query = query.filter(ClientThread.status == "needs_clarification")
    elif filter_type == "ready_for_order":
        query = query.filter(ClientThread.status == "ready_for_order")
    elif filter_type == "warranty":
        query = query.filter(ClientThread.is_warranty == True)
    elif filter_type == "unregistered":
        query = query.filter(ClientThread.is_unregistered == True)

    if client_name and client_name.strip():
        raw_name = client_name.strip()
        clean_name = raw_name.replace("«", "").replace("»", "").replace('"', '').replace("'", "").strip()
        words = [w for w in clean_name.split() if len(w) > 2 and w.lower() not in ["кафе", "ооо", "зао", "ип", "гостиница", "пекарня", "ресторан"]]
        conds = [
            ClientThread.client_name == raw_name,
            ClientThread.client_name.ilike(f"%{clean_name}%")
        ]
        for w in words:
            conds.append(ClientThread.client_name.ilike(f"%{w}%"))
        query = query.filter(or_(*conds))

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                ClientThread.client_name.ilike(s),
                ClientThread.equipment_code.ilike(s)
            )
        )

    threads = query.order_by(ClientThread.id.desc()).all()
    orders = db.query(ServiceOrder).filter(ServiceOrder.thread_id.isnot(None)).all()
    orders_by_thread = {o.thread_id: o for o in orders}
    users_by_id = {u.id: u for u in db.query(User).all()}

    results = []
    for t in threads:
        resp = ClientThreadResponse.model_validate(t)
        ord_obj = orders_by_thread.get(t.id)
        if ord_obj:
            resp.linked_order_number = ord_obj.order_number
            resp.assigned_engineer_id = ord_obj.engineer_id
            if ord_obj.engineer_id and ord_obj.engineer_id in users_by_id:
                resp.assigned_engineer_name = users_by_id[ord_obj.engineer_id].full_name
        if current_user.role == "company":
            resp.messages = [m for m in resp.messages if getattr(m, 'chat_type', 'client_dispatcher') != 'dispatcher_engineer']
        elif current_user.role == "engineer":
            resp.messages = [m for m in resp.messages if getattr(m, 'chat_type', 'dispatcher_engineer') != 'client_dispatcher']
        results.append(resp)
    return results

@router.post("", response_model=ClientThreadResponse)
def create_thread(
    req: CreateThreadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new service ticket / chat thread from client/company or dispatcher,
    and automatically registers a corresponding ServiceOrder so it shows up in "Заявки на выезд".
    """
    client_name = current_user.full_name if current_user.role == "company" else (req.client_name or "Новый клиент")
    all_eq = db.query(Equipment).all()
    eq = None
    if req.equipment_code and req.equipment_code.strip():
        eq = db.query(Equipment).filter(Equipment.code == req.equipment_code.strip()).first()
    if not eq:
        eq_info = RulesEngine.identify_equipment(client_name, req.content, all_eq)
        eq = eq_info.get("equipment")
    else:
        eq_info = {"equipment": eq, "is_ambiguous": False, "is_unregistered": False}

    max_num = (db.query(func.max(ClientThread.thread_number)).scalar() or 0) + 1
    is_warranty = False
    warranty_reason = None
    if eq:
        is_warranty, warranty_reason = RulesEngine.check_warranty(
            eq.installation_date,
            eq.last_visit_date,
            eq.last_visit_result,
            req.content
        )

    if eq_info.get("is_unregistered"):
        initial_status = "sales_transfer"
    elif not eq or eq_info.get("is_ambiguous"):
        initial_status = "needs_clarification"
    else:
        initial_status = "order_created"

    activity_time = settings.SYSTEM_REFERENCE_DATE + timedelta(minutes=max_num)

    thread = ClientThread(
        thread_number=max_num,
        client_name=client_name,
        equipment_id=eq.id if eq else None,
        equipment_code=eq.code if eq else (req.equipment_code or None),
        status=initial_status,
        channel=req.channel or "Мессенджер",
        is_warranty=is_warranty,
        warranty_reason=warranty_reason,
        is_unregistered=eq_info.get("is_unregistered", False),
        last_activity=activity_time,
        created_at=settings.SYSTEM_REFERENCE_DATE
    )
    db.add(thread)
    db.flush()

    msg = Message(
        thread_id=thread.id,
        channel=thread.channel,
        sender_type="client" if current_user.role == "company" else "dispatcher",
        sender_name=current_user.full_name if current_user.role == "company" else f"{client_name}, представитель",
        content=req.content,
        created_at=activity_time
    )
    db.add(msg)

    # Automatically create service order so it shows up in "Заявки на выезд"
    user_city = getattr(current_user, 'city', '') or 'Москва'
    order_num = f"ЗВ-{max_num:03d}"
    order = ServiceOrder(
        order_number=order_num,
        thread_id=thread.id,
        client_name=client_name,
        equipment_id=eq.id if eq else None,
        equipment_code=eq.code if eq else (req.equipment_code or None),
        address=eq.address if eq else (f"г. {user_city}" if user_city else "Адрес уточняется"),
        model=eq.model if eq else "Кофемашина",
        serial_number=eq.serial_number if eq else "—",
        symptom=req.content,
        client_assumption=None,
        is_warranty=is_warranty,
        warranty_reason=warranty_reason,
        is_sales_transfer=eq_info.get("is_unregistered", False),
        status="Новая" if not eq_info.get("is_unregistered") else "Вне договора",
        engineer_id=None,
        reserved_parts=[],
        created_by_id=current_user.id,
        created_at=activity_time
    )
    db.add(order)

    thread.last_activity = activity_time

    # Auto-Reply for newly created threads if created by client/company
    if current_user.role == "company" and AUTO_REPLY_ENABLED:
        ai_reply = RulesEngine.generate_conversational_reply(
            messages_history=[msg],
            client_name=thread.client_name,
            equipment_info=eq_info,
            is_warranty=is_warranty,
            warranty_reason=warranty_reason,
            all_equipment=all_eq
        )
        if ai_reply:
            auto_msg = Message(
                thread_id=thread.id,
                channel=thread.channel,
                sender_type="dispatcher",
                sender_name="ИИ-Диспетчер ServFlow",
                content=ai_reply,
                created_at=activity_time + timedelta(seconds=2)
            )
            db.add(auto_msg)
            thread.last_activity = auto_msg.created_at
            if "уточните" in ai_reply.lower() or "подскажите" in ai_reply.lower() or eq_info.get("is_ambiguous"):
                thread.status = "needs_clarification"

    db.commit()
    db.refresh(thread)
    return ClientThreadResponse.model_validate(thread)

@router.get("/{thread_id}", response_model=ClientThreadResponse)
def get_thread(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(ClientThread).filter(ClientThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    resp = ClientThreadResponse.model_validate(thread)
    ord_obj = db.query(ServiceOrder).filter(ServiceOrder.thread_id == thread.id).first()
    if ord_obj:
        resp.linked_order_number = ord_obj.order_number
        resp.assigned_engineer_id = ord_obj.engineer_id
        if ord_obj.engineer_id:
            eng_user = db.query(User).filter(User.id == ord_obj.engineer_id).first()
            if eng_user:
                resp.assigned_engineer_name = eng_user.full_name
    if current_user.role == "company":
        resp.messages = [m for m in resp.messages if getattr(m, 'chat_type', 'client_dispatcher') != 'dispatcher_engineer']
    elif current_user.role == "engineer":
        resp.messages = [m for m in resp.messages if getattr(m, 'chat_type', 'dispatcher_engineer') != 'client_dispatcher']
    return resp

@router.post("/{thread_id}/messages", response_model=MessageResponse)
def add_message(
    thread_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(ClientThread).filter(ClientThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    if current_user.role == "company":
        sender_type = "client"
        sender_name = current_user.full_name
    elif current_user.role == "engineer":
        sender_type = "engineer"
        sender_name = f"Инженер {current_user.full_name}"
    elif msg_in.sender_type:
        sender_type = msg_in.sender_type
        sender_name = msg_in.sender_name or current_user.full_name
    else:
        sender_type = "dispatcher"
        sender_name = current_user.full_name

    last_msg = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.id.desc()).first()
    if last_msg and last_msg.created_at:
        msg_time = last_msg.created_at + timedelta(minutes=1)
    else:
        msg_time = settings.SYSTEM_REFERENCE_DATE

    chat_type = msg_in.chat_type
    if not chat_type:
        if current_user.role == "engineer":
            chat_type = "dispatcher_engineer"
        elif current_user.role == "company":
            chat_type = "client_dispatcher"
        else:
            chat_type = "client_dispatcher"

    msg = Message(
        thread_id=thread.id,
        channel=msg_in.channel or thread.channel,
        chat_type=chat_type,
        sender_type=sender_type,
        sender_name=sender_name,
        content=msg_in.content,
        created_at=msg_time
    )
    db.add(msg)
    db.flush()
    thread.last_activity = msg_time

    # Auto-Reply by AI if customer sent message in client_dispatcher channel and feature is enabled
    if sender_type == "client" and chat_type == "client_dispatcher" and AUTO_REPLY_ENABLED:
        all_eq = db.query(Equipment).all()
        all_thread_msgs = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.id.asc()).all()
        full_client_text = " ".join([m.content for m in all_thread_msgs if m.sender_type == "client"])

        eq = None
        if thread.equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == thread.equipment_id).first()
        if not eq and thread.equipment_code:
            eq = db.query(Equipment).filter(Equipment.code == thread.equipment_code).first()

        eq_info = {"equipment": eq, "is_ambiguous": False, "is_unregistered": False}
        if not eq:
            eq_info = RulesEngine.identify_equipment(thread.client_name, full_client_text, all_eq)
            eq = eq_info.get("equipment")
            if eq:
                thread.equipment_id = eq.id
                thread.equipment_code = eq.code
                # Sync with linked service order
                linked_order = db.query(ServiceOrder).filter(ServiceOrder.thread_id == thread.id).first()
                if linked_order:
                    linked_order.equipment_id = eq.id
                    linked_order.equipment_code = eq.code
                    linked_order.model = eq.model
                    linked_order.serial_number = eq.serial_number
                    linked_order.address = eq.address
            elif eq_info.get("is_unregistered"):
                thread.is_unregistered = True

        is_warranty = thread.is_warranty
        warranty_reason = thread.warranty_reason
        if eq and not is_warranty:
            is_warranty, warranty_reason = RulesEngine.check_warranty(
                eq.installation_date,
                eq.last_visit_date,
                eq.last_visit_result,
                full_client_text
            )
            thread.is_warranty = is_warranty
            thread.warranty_reason = warranty_reason

        # Balanced Conversational Reply (remembers previous answers across dialog, avoids rigid template greetings)
        ai_reply = RulesEngine.generate_conversational_reply(
            messages_history=all_thread_msgs,
            client_name=thread.client_name,
            equipment_info=eq_info,
            is_warranty=is_warranty,
            warranty_reason=warranty_reason,
            all_equipment=all_eq
        )

        if ai_reply:
            auto_msg = Message(
                thread_id=thread.id,
                channel=thread.channel,
                chat_type="client_dispatcher",
                sender_type="dispatcher",
                sender_name="ИИ-Диспетчер ServFlow",
                content=ai_reply,
                created_at=msg_time + timedelta(seconds=2)
            )
            db.add(auto_msg)
            thread.last_activity = auto_msg.created_at

            if eq_info.get("is_unregistered"):
                thread.status = "sales_transfer"
            elif eq_info.get("is_ambiguous") or not eq or "уточните" in ai_reply.lower() or "подскажите" in ai_reply.lower():
                thread.status = "needs_clarification"
            else:
                thread.status = "ready_for_order"

    db.commit()
    db.refresh(msg)
    return MessageResponse.model_validate(msg)

@router.post("/simulate", response_model=ClientThreadResponse)
def simulate_customer_message(
    req: SimulateCustomerMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Simulation endpoint for live jury demonstration:
    Injects a client message into existing thread if matched by client (П-3),
    or creates a new thread, resolves equipment (П-1/П-2), and checks warranty (П-9).
    """
    client_name = req.client_name.strip()
    all_eq = db.query(Equipment).all()

    # Rule П-1/П-2 equipment resolution
    eq_info = RulesEngine.identify_equipment(client_name, req.content, all_eq)
    eq = eq_info.get("equipment")

    # Rule П-3: Match to open thread of same client if exists
    thread = None
    if eq:
        thread = db.query(ClientThread).filter(ClientThread.equipment_id == eq.id).first()
    if not thread:
        thread = db.query(ClientThread).filter(ClientThread.client_name.ilike(f"%{client_name}%")).first()

    # If no thread, create a new one
    if not thread:
        max_num = db.query(ClientThread).count() + 1
        is_warranty = False
        warranty_reason = None
        if eq:
            is_warranty, warranty_reason = RulesEngine.check_warranty(
                eq.installation_date,
                eq.last_visit_date,
                eq.last_visit_result,
                req.content
            )

        thread = ClientThread(
            thread_number=max_num,
            client_name=client_name,
            equipment_id=eq.id if eq else None,
            equipment_code=eq.code if eq else None,
            status="sales_transfer" if eq_info.get("is_unregistered") else ("needs_clarification" if eq_info.get("is_ambiguous") else "ready_for_order"),
            channel=req.channel,
            is_warranty=is_warranty,
            warranty_reason=warranty_reason,
            is_unregistered=eq_info.get("is_unregistered", False),
            last_activity=datetime.utcnow()
        )
        db.add(thread)
        db.flush()

    # Add the simulated client message
    last_msg = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.id.desc()).first()
    msg_time = (last_msg.created_at + timedelta(minutes=1)) if (last_msg and last_msg.created_at) else settings.SYSTEM_REFERENCE_DATE

    msg = Message(
        thread_id=thread.id,
        request_code=req.request_code or f"З-SIM",
        channel=req.channel,
        sender_type="client",
        sender_name=f"{client_name}, представитель",
        content=req.content,
        created_at=msg_time
    )
    db.add(msg)
    thread.last_activity = msg_time
    db.commit()
    db.refresh(thread)

    return ClientThreadResponse.model_validate(thread)

