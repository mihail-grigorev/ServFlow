from datetime import datetime, timedelta
from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from backend.config import settings
from backend.database import get_db
from backend.models import ClientThread, Message, Equipment, User, ServiceOrder, SparePart
from backend.schemas import (
    ClientThreadResponse, MessageCreate, MessageResponse, SimulateCustomerMessageRequest, CreateThreadRequest
)
from backend.auth import get_current_user, require_dispatcher, oauth2_scheme
from backend.rules_engine import RulesEngine
from backend.ai_service import AIService
from backend.seed import get_company_id_for_client
from backend.rate_limiter import check_company_message_limit, check_company_thread_limit
from backend.analytics import track_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads", tags=["Обращения и переписка"])

AUTO_REPLY_ENABLED = True

@router.get("/settings/auto-reply")
def get_auto_reply_setting(current_user: User = Depends(require_dispatcher)):
    global AUTO_REPLY_ENABLED
    return {"auto_reply_enabled": AUTO_REPLY_ENABLED}

@router.post("/settings/auto-reply")
def set_auto_reply_setting(payload: dict, current_user: User = Depends(require_dispatcher)):
    global AUTO_REPLY_ENABLED
    AUTO_REPLY_ENABLED = bool(payload.get("auto_reply_enabled", True))
    return {"auto_reply_enabled": AUTO_REPLY_ENABLED}

@router.post("/auto-reply-all")
async def auto_reply_all_threads(
    current_user: User = Depends(require_dispatcher),
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
    all_parts = db.query(SparePart).all()
    
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
                eq_info = RulesEngine.identify_equipment(
                    thread.client_name,
                    full_client_text,
                    all_eq,
                    current_equipment_code=thread.equipment_code,
                    current_equipment_id=thread.equipment_id
                )
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
            
            ai_reply = None
            try:
                messages_context = "\n".join([f"[{m.channel}] {m.sender_name}: {m.content}" for m in all_thread_msgs])
                analysis = await AIService.analyze_thread(
                    client_name=thread.client_name,
                    messages_text=messages_context,
                    all_equipments=all_eq,
                    all_parts=all_parts,
                    thread_channel=thread.channel,
                    current_equipment_code=thread.equipment_code,
                    current_equipment_id=thread.equipment_id
                )
                ai_reply = analysis.reply_to_client
                if analysis.is_warranty and not thread.is_warranty:
                    thread.is_warranty = True
                    thread.warranty_reason = analysis.warranty_reason
            except Exception as e:
                logger.warning(f"Live Gemini auto-reply failed, falling back: {e}")

            if not ai_reply:
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

    # Security check K6: Company isolation & Engineer assignment scoping
    if current_user.role == "company":
        comp_id = current_user.company_id
        u_name = current_user.full_name.strip()
        conds = []
        if comp_id:
            conds.append(ClientThread.company_id == comp_id)
        if u_name:
            conds.append(ClientThread.client_name == u_name)
        if current_user.id:
            conds.append(ClientThread.owner_user_id == current_user.id)
        if conds:
            query = query.filter(or_(*conds))
        else:
            return []
    elif current_user.role == "engineer":
        assigned_orders = db.query(ServiceOrder.thread_id).filter(
            ServiceOrder.engineer_id == current_user.id,
            ServiceOrder.thread_id.isnot(None)
        ).all()
        assigned_thread_ids = [t[0] for t in assigned_orders if t[0] is not None]
        query = query.filter(ClientThread.id.in_(assigned_thread_ids))

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
        clean_escaped = clean_name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        words = [w for w in clean_name.split() if len(w) > 2 and w.lower() not in ["кафе", "ооо", "зао", "ип", "гостиница", "пекарня", "ресторан"]]
        conds = [
            ClientThread.client_name == raw_name,
            ClientThread.client_name.ilike(f"%{clean_escaped}%")
        ]
        for w in words:
            w_esc = w.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            conds.append(ClientThread.client_name.ilike(f"%{w_esc}%"))
        query = query.filter(or_(*conds))

    if search and search.strip():
        clean_s = search.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        s = f"%{clean_s}%"
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
    Creates a new service ticket / chat thread from client/company or dispatcher.
    Service orders are NOT created automatically here; only dispatchers create them.
    """
    client_name = current_user.full_name if current_user.role == "company" else (req.client_name or "Новый клиент")

    # Security check Section 3: Audience anti-spam
    if current_user.role == "company":
        if len(req.content) > 1000:
            raise HTTPException(
                status_code=400,
                detail="Длина сообщения не должна превышать 1000 символов."
            )
        if not check_company_thread_limit(current_user.company_id):
            raise HTTPException(
                status_code=429,
                detail="Превышен лимит создания обращений (максимум 30 в час). Пожалуйста, подождите."
            )

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
        initial_status = "ready_for_order"

    activity_time = settings.SYSTEM_REFERENCE_DATE + timedelta(minutes=max_num)

    company_id = current_user.company_id or get_company_id_for_client(client_name)

    thread = ClientThread(
        thread_number=max_num,
        client_name=client_name,
        company_id=company_id,
        owner_user_id=current_user.id if current_user.role == "company" else None,
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
            if eq_info.get("is_unregistered"):
                thread.status = "sales_transfer"
            elif "уточните" in ai_reply.lower() or "подскажите" in ai_reply.lower() or eq_info.get("is_ambiguous") or not eq:
                thread.status = "needs_clarification"
            else:
                thread.status = "ready_for_order"

    db.commit()
    db.refresh(thread)
    track_event(
        "thread_created",
        thread_id=thread.id,
        user_id=current_user.id if current_user else None,
        company_id=thread.company_id,
        payload={"client_name": thread.client_name, "channel": thread.channel},
        db=db
    )
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

    # Security check K6: Company IDOR protection & Engineer assignment scoping
    if current_user.role == "company":
        is_owner = (
            (thread.company_id and thread.company_id == current_user.company_id)
            or (thread.owner_user_id and thread.owner_user_id == current_user.id)
            or (thread.client_name == current_user.full_name.strip())
        )
        if not is_owner:
            raise HTTPException(status_code=404, detail="Обращение не найдено")
    elif current_user.role == "engineer":
        ord_assigned = db.query(ServiceOrder).filter(
            ServiceOrder.thread_id == thread.id,
            ServiceOrder.engineer_id == current_user.id
        ).first()
        if not ord_assigned:
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
async def add_message(
    thread_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(ClientThread).filter(ClientThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    # Security check K6: Company & Engineer IDOR check on sending messages
    if current_user.role == "company":
        is_owner = (
            (thread.company_id and thread.company_id == current_user.company_id)
            or (thread.owner_user_id and thread.owner_user_id == current_user.id)
            or (thread.client_name == current_user.full_name.strip())
        )
        if not is_owner:
            raise HTTPException(status_code=404, detail="Обращение не найдено")

        # Security check Section 3: Audience anti-spam
        if len(msg_in.content) > 1000:
            raise HTTPException(
                status_code=400,
                detail="Длина сообщения не должна превышать 1000 символов."
            )
        if not check_company_message_limit(current_user.company_id):
            raise HTTPException(
                status_code=429,
                detail="Пожалуйста, подождите минуту перед следующим сообщением."
            )
    elif current_user.role == "engineer":
        ord_assigned = db.query(ServiceOrder).filter(
            ServiceOrder.thread_id == thread.id,
            ServiceOrder.engineer_id == current_user.id
        ).first()
        if not ord_assigned:
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
        all_parts = db.query(SparePart).all()
        all_thread_msgs = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.id.asc()).all()
        full_client_text = " ".join([m.content for m in all_thread_msgs if m.sender_type == "client"])

        eq = None
        if thread.equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == thread.equipment_id).first()
        if not eq and thread.equipment_code:
            eq = db.query(Equipment).filter(Equipment.code == thread.equipment_code).first()

        eq_info = {"equipment": eq, "is_ambiguous": False, "is_unregistered": False}
        if not eq:
            eq_info = RulesEngine.identify_equipment(
                thread.client_name,
                full_client_text,
                all_eq,
                current_equipment_code=thread.equipment_code,
                current_equipment_id=thread.equipment_id
            )
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

        # Dynamic live AI reasoning via Gemini 3 Flash
        ai_reply = None
        try:
            messages_context = "\n".join([f"[{m.channel}] {m.sender_name}: {m.content}" for m in all_thread_msgs])
            analysis = await AIService.analyze_thread(
                client_name=thread.client_name,
                messages_text=messages_context,
                all_equipments=all_eq,
                all_parts=all_parts,
                thread_channel=thread.channel,
                current_equipment_code=thread.equipment_code,
                current_equipment_id=thread.equipment_id
            )
            ai_reply = analysis.reply_to_client
            if analysis.is_warranty and not thread.is_warranty:
                thread.is_warranty = True
                thread.warranty_reason = analysis.warranty_reason
        except Exception as e:
            logger.warning(f"Live Gemini reasoning failed, using fallback: {e}")

        if not ai_reply:
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
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Simulation endpoint for live jury demonstration:
    Injects a client message into existing thread if matched by client (П-3),
    or creates a new thread, resolves equipment (П-1/П-2), and checks warranty (П-9).
    Security check K5: Allowed in DEMO_MODE or by authenticated dispatcher.
    """
    if not settings.DEMO_MODE:
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация диспетчера")
        user = get_current_user(token=token, db=db)
        if user.role != "dispatcher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Симуляция обращений доступна только диспетчеру")

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
            company_id=get_company_id_for_client(client_name),
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
    track_event(
        "thread_created",
        thread_id=thread.id,
        user_id=None,
        company_id=thread.company_id,
        payload={"client_name": thread.client_name, "channel": thread.channel, "simulated": True},
        db=db
    )

    return ClientThreadResponse.model_validate(thread)

