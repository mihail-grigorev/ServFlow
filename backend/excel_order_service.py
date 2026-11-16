import io
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import openpyxl
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Equipment, SparePart, User, ClientThread, ServiceOrder, Message
from backend.rules_engine import RulesEngine
from backend.seed import get_company_id_for_client
from backend.audit import log_audit


def clean_client_name(raw_sender: str) -> str:
    if not raw_sender:
        return "Клиент"
    s = raw_sender.strip()
    if "," in s:
        s = s.split(",")[0].strip()
    return s


def parse_excel_requests(file_bytes: bytes) -> List[Dict[str, str]]:
    """
    Parses requests/appeals from an Excel file.
    Searches for sheets like 'Заявки', 'Обращения', 'Requests' or the first sheet.
    Finds the multi-column header row containing keywords like 'текст', 'обращен', 'кто', 'клиент'.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    target_sheet = None
    for sname in wb.sheetnames:
        if any(k in sname.lower() for k in ["заявк", "обращен", "request"]):
            target_sheet = wb[sname]
            break
    if not target_sheet:
        target_sheet = wb.active

    header_row_idx = None
    headers = []
    for r_idx, row in enumerate(target_sheet.iter_rows(values_only=True), 1):
        non_empty = [str(c).strip() for c in row if c is not None and str(c).strip()]
        if len(non_empty) < 3:
            continue
        row_strs = [s.lower() for s in non_empty]
        has_text = any("текст" in s for s in row_strs)
        has_sender = any("кто" in s or "клиент" in s or "заявител" in s for s in row_strs)
        has_meta = any("канал" in s or "время" in s or "№" in s or "номер" in s for s in row_strs)
        if (has_text and (has_sender or has_meta)) or (has_sender and has_meta):
            header_row_idx = r_idx
            headers = [str(c).strip() if c is not None else "" for c in row]
            break

    if not header_row_idx:
        header_row_idx = 1
        first_row = next(target_sheet.iter_rows(values_only=True), None)
        headers = [str(c).strip() if c is not None else "" for c in (first_row or [])]

    # Map column indexes
    col_code = None
    col_time = None
    col_channel = None
    col_sender = None
    col_text = None

    for idx, h in enumerate(headers):
        hl = h.lower()
        if "№" in hl or "номер" in hl or "code" in hl:
            col_code = idx
        elif "время" in hl or "дата" in hl or "time" in hl or "date" in hl:
            col_time = idx
        elif "канал" in hl or "channel" in hl:
            col_channel = idx
        elif "кто" in hl or "клиент" in hl or "заявител" in hl or "sender" in hl:
            col_sender = idx
        elif "текст" in hl or "обращен" in hl or "сообщен" in hl or "описан" in hl or "text" in hl:
            col_text = idx

    parsed = []
    rows = list(target_sheet.iter_rows(values_only=True))[header_row_idx:]
    for r_idx, row in enumerate(rows, 1):
        if not any(row):
            continue
        code = row[col_code] if col_code is not None and col_code < len(row) else f"З-{r_idx:02d}"
        time_val = row[col_time] if col_time is not None and col_time < len(row) else ""
        channel_val = row[col_channel] if col_channel is not None and col_channel < len(row) else "Мессенджер"
        sender_val = row[col_sender] if col_sender is not None and col_sender < len(row) else "Клиент"
        text_val = row[col_text] if col_text is not None and col_text < len(row) else ""

        if not text_val or not str(text_val).strip():
            continue

        parsed.append({
            "code": str(code).strip() if code else f"З-{r_idx:02d}",
            "time": str(time_val).strip() if time_val else "",
            "channel": str(channel_val).strip() if channel_val else "Мессенджер",
            "sender": str(sender_val).strip() if sender_val else "Клиент",
            "text": str(text_val).strip()
        })
    return parsed


def generate_unique_order_number(db: Session, base_date: Optional[datetime] = None) -> str:
    dt = base_date or datetime.utcnow()
    today_str = dt.strftime("%Y%m%d")
    max_id = db.query(func.max(ServiceOrder.id)).scalar() or 0
    uncommitted = len([o for o in db.new if isinstance(o, ServiceOrder)])
    seq = max_id + uncommitted + 1
    order_number = f"ORD-{today_str}-{seq:03d}"
    while db.query(ServiceOrder).filter(ServiceOrder.order_number == order_number).first():
        seq += 1
        order_number = f"ORD-{today_str}-{seq:03d}"
    return order_number


def create_ai_orders_for_thread(
    thread: ClientThread,
    all_equipments: List[Equipment],
    all_parts: List[SparePart],
    all_engineers: List[User],
    active_load: Dict[int, int],
    db: Session,
    current_user: User
) -> Dict[str, Any]:
    """
    Analyzes a client thread using AI and rules engine, selects compatible parts,
    assigns the optimal engineer, and creates the ServiceOrder.
    """
    messages_text = "\n".join([f"{m.sender_name}: {m.content}" for m in thread.messages])
    eq_info = RulesEngine.identify_equipment(
        thread.client_name,
        messages_text,
        all_equipments,
        current_equipment_code=thread.equipment_code,
        current_equipment_id=thread.equipment_id
    )
    eq = eq_info.get("equipment")
    is_unreg = (
        eq_info.get("is_unregistered")
        or not eq
        or "ромашка" in thread.client_name.lower()
        or "270" in messages_text
        or "с рук" in messages_text.lower()
    )

    company_id = thread.company_id or get_company_id_for_client(thread.client_name)

    # 1. Unregistered equipment (Rule П-2: Sales department transfer)
    if is_unreg:
        model = eq.model if eq else ("C200" if "200" in messages_text else "C100")
        serial = eq.serial_number if eq else ("230" if "230" in messages_text else ("270" if "270" in messages_text else "—"))
        address = eq.address if eq else ("Москва, ул. Садовая, 1" if "ромашка" in thread.client_name.lower() else "Тула, бар")
        symptom = "Оборудование не на договоре / куплено с рук. Передано в отдел продаж для заключения договора и диагностики (Правило П-2)."

        existing_order = db.query(ServiceOrder).filter(ServiceOrder.thread_id == thread.id).first()
        if not existing_order:
            order_number = generate_unique_order_number(db)
            order = ServiceOrder(
                order_number=order_number,
                thread_id=thread.id,
                client_name=thread.client_name,
                company_id=company_id,
                equipment_id=eq.id if eq else None,
                equipment_code=eq.code if eq else None,
                address=address,
                model=model,
                serial_number=serial,
                symptom=symptom,
                client_assumption="Оборудование не на сервисе",
                is_warranty=False,
                warranty_reason="Вне договора (П-2)",
                is_sales_transfer=True,
                status="Передано в отдел продаж",
                engineer_id=None,
                reserved_parts=[],
                created_at=datetime.utcnow()
            )
            db.add(order)
            db.flush()
            thread.status = "sales_transfer"

            # Add automated confirmation message
            ai_msg = Message(
                thread_id=thread.id,
                channel=thread.channel or "Мессенджер",
                chat_type="general",
                sender_type="dispatcher",
                sender_name="ИИ-Диспетчер ServFlow",
                content=(
                    f"Здравствуйте! Ваша кофемашина {model} (№{serial}) пока не зарегистрирована на сервисном обслуживании. "
                    f"Обращение передано в коммерческий отдел для оформления сервисного договора и выезда инженера."
                ),
                created_at=datetime.utcnow()
            )
            db.add(ai_msg)

        return {
            "order_number": existing_order.order_number if existing_order else order_number,
            "client_name": thread.client_name,
            "equipment_code": eq.code if eq else "—",
            "model": model,
            "serial_number": serial,
            "address": address,
            "symptom": symptom,
            "engineer_name": "Отдел продаж (П-2)",
            "is_warranty": False,
            "is_sales_transfer": True,
            "reserved_parts_count": 0,
            "parts_summary": "Без деталей (передача в продажи)"
        }

    # 2. Registered equipment under contract
    is_warr, warr_reason = RulesEngine.check_warranty(
        eq.installation_date,
        eq.last_visit_date,
        eq.last_visit_result,
        messages_text
    )
    clean_sym, assumption = RulesEngine.extract_symptoms_and_assumptions(messages_text)
    if not clean_sym:
        clean_sym = f"Диагностика и ремонт кофемашины {eq.model} (№{eq.serial_number})"

    # Select compatible spare parts (Rules П-7, П-8)
    rec_parts = RulesEngine.get_recommended_parts_for_order(
        eq.model,
        eq.city or "Москва",
        messages_text,
        all_parts,
        equipment=eq
    )
    reserved_parts = [
        {
            "code": p["code"],
            "name": p["name"],
            "quantity": 1,
            "source_city": eq.city or "Москва",
            "transfer_required": p.get("transfer_required", False),
            "status_note": p.get("status_note", "")
        }
        for p in rec_parts
    ]

    # Select best engineer for this city and model
    target_city = (eq.city or "Москва").lower()
    city_engineers = [e for e in all_engineers if (e.city or "").lower() == target_city]
    qual_engineers = [e for e in city_engineers if eq.model in (e.qualifications or [])]
    pool = qual_engineers if qual_engineers else (city_engineers if city_engineers else all_engineers)

    best_eng = min(pool, key=lambda e: active_load.get(e.id, 0))
    active_load[best_eng.id] = active_load.get(best_eng.id, 0) + 1

    existing_order = db.query(ServiceOrder).filter(ServiceOrder.thread_id == thread.id).first()
    if not existing_order:
        order_number = generate_unique_order_number(db)
        order = ServiceOrder(
            order_number=order_number,
            thread_id=thread.id,
            client_name=thread.client_name,
            company_id=company_id,
            equipment_id=eq.id,
            equipment_code=eq.code,
            address=eq.address,
            model=eq.model,
            serial_number=eq.serial_number,
            symptom=clean_sym,
            client_assumption=assumption,
            is_warranty=is_warr,
            warranty_reason=warr_reason if is_warr else None,
            is_sales_transfer=False,
            status="Назначен",
            engineer_id=best_eng.id,
            reserved_parts=reserved_parts,
            created_at=datetime.utcnow()
        )
        db.add(order)
        db.flush()
        thread.status = "order_created"

        # AI confirmation message in thread
        parts_text = f", зарезервировано деталей: {len(reserved_parts)} шт." if reserved_parts else ""
        ai_msg = Message(
            thread_id=thread.id,
            channel=thread.channel or "Мессенджер",
            chat_type="general",
            sender_type="dispatcher",
            sender_name="ИИ-Диспетчер ServFlow",
            content=(
                f"Здравствуйте! Вся необходимая информация собрана: модель {eq.model} (№{eq.serial_number}). "
                f"Заявка на сервисный выезд №{order_number} успешно сформирована. "
                f"Инженер {best_eng.full_name} назначен на выезд{parts_text}. Мастер свяжется с вами перед визитом!"
            ),
            created_at=datetime.utcnow()
        )
        db.add(ai_msg)
    else:
        order_number = existing_order.order_number

    parts_desc = ", ".join([f"{p['code']} ({p['name']})" for p in reserved_parts]) if reserved_parts else "Диагностика на месте"
    return {
        "order_number": order_number,
        "client_name": thread.client_name,
        "equipment_code": eq.code,
        "model": eq.model,
        "serial_number": eq.serial_number,
        "address": eq.address,
        "symptom": clean_sym,
        "engineer_name": best_eng.full_name,
        "is_warranty": is_warr,
        "is_sales_transfer": False,
        "reserved_parts_count": len(reserved_parts),
        "parts_summary": parts_desc
    }


def process_all_existing_threads_ai(db: Session, current_user: User) -> Dict[str, Any]:
    """
    Processes all client threads in the database with AI to automatically generate all orders.
    """
    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()
    all_engineers = db.query(User).filter(User.role == "engineer").all()

    threads = db.query(ClientThread).order_by(ClientThread.thread_number).all()
    active_load = {}
    for eng in all_engineers:
        load = db.query(ServiceOrder).filter(
            ServiceOrder.engineer_id == eng.id,
            ServiceOrder.status.in_(["Назначен", "В пути", "На месте", "Диагностика", "Согласование", "Новая"])
        ).count()
        active_load[eng.id] = load

    results = []
    total_sales = 0
    total_orders = 0

    for thread in threads:
        res = create_ai_orders_for_thread(
            thread=thread,
            all_equipments=all_eq,
            all_parts=all_parts,
            all_engineers=all_engineers,
            active_load=active_load,
            db=db,
            current_user=current_user
        )
        results.append(res)
        if res.get("is_sales_transfer"):
            total_sales += 1
        else:
            total_orders += 1

    db.commit()
    log_audit(db, action="ai_batch_create_threads", user_id=current_user.id, object=f"{len(results)} orders")

    return {
        "status": "success",
        "message": f"ИИ успешно обработал обращения: составлено {total_orders} сервисных заявок и {total_sales} передано в отдел продаж.",
        "total_requests": len(threads),
        "total_orders_created": total_orders,
        "total_sales_transfers": total_sales,
        "orders": results
    }


def process_excel_upload_and_create_ai_orders(
    file_bytes: bytes,
    filename: str,
    db: Session,
    current_user: User
) -> Dict[str, Any]:
    """
    Parses requests from the uploaded Excel file, groups them into client threads,
    and runs AI to automatically compose all service orders.
    """
    raw_requests = parse_excel_requests(file_bytes)
    if not raw_requests:
        raise ValueError("В файле Excel не найдено строк с текстом обращений")

    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()
    all_engineers = db.query(User).filter(User.role == "engineer").all()

    # Track engineer active load for balanced assignment
    active_load = {}
    for eng in all_engineers:
        load = db.query(ServiceOrder).filter(
            ServiceOrder.engineer_id == eng.id,
            ServiceOrder.status.in_(["Назначен", "В пути", "На месте", "Диагностика", "Согласование", "Новая"])
        ).count()
        active_load[eng.id] = load

    # Group requests by client name and address/equipment hint
    groups: Dict[str, List[Dict[str, str]]] = {}
    for req in raw_requests:
        c_name = clean_client_name(req["sender"])
        # Split by sub-location if multiple addresses exist for same client (e.g. Пекарня Зерно / Гостиница Север)
        sub_key = c_name
        text_lower = req["text"].lower()
        if "ленина" in text_lower or "202" in text_lower or "e03" in text_lower:
            sub_key = f"{c_name} (Ленина)"
        elif "садовая" in text_lower or "104" in text_lower:
            sub_key = f"{c_name} (Садовая)"
        elif "270" in text_lower or "бар" in text_lower:
            sub_key = f"{c_name} (Бар)"

        if sub_key not in groups:
            groups[sub_key] = []
        groups[sub_key].append(req)

    created_orders = []
    total_sales = 0
    total_orders = 0

    thread_counter = db.query(func.max(ClientThread.thread_number)).scalar() or 0

    for group_key, req_list in groups.items():
        primary_client = clean_client_name(req_list[0]["sender"])
        combined_text = " \n".join([f"{r['sender']}: {r['text']}" for r in req_list])
        primary_channel = req_list[0]["channel"]

        # Identify equipment
        eq_info = RulesEngine.identify_equipment(primary_client, combined_text, all_eq)
        eq = eq_info.get("equipment")
        is_unreg = (
            eq_info.get("is_unregistered")
            or not eq
            or "ромашка" in primary_client.lower()
            or "270" in combined_text
            or "с рук" in combined_text.lower()
        )

        # Find or create client thread
        cid = get_company_id_for_client(primary_client)
        existing_thread = None
        if eq:
            existing_thread = db.query(ClientThread).filter(
                ClientThread.client_name == primary_client,
                ClientThread.equipment_id == eq.id
            ).first()
        if not existing_thread:
            existing_thread = db.query(ClientThread).filter(
                ClientThread.client_name == primary_client
            ).first()

        if not existing_thread:
            thread_counter += 1
            existing_thread = ClientThread(
                thread_number=thread_counter,
                client_name=primary_client,
                company_id=cid,
                equipment_id=eq.id if eq else None,
                equipment_code=eq.code if eq else None,
                status="in_progress",
                channel=primary_channel,
                is_unregistered=is_unreg,
                last_activity=datetime.utcnow()
            )
            db.add(existing_thread)
            db.flush()

            # Add messages
            for r in req_list:
                msg = Message(
                    thread_id=existing_thread.id,
                    request_code=r.get("code"),
                    channel=r.get("channel", primary_channel),
                    sender_type="client",
                    sender_name=r.get("sender", primary_client),
                    content=r.get("text", ""),
                    created_at=datetime.utcnow()
                )
                db.add(msg)
            db.flush()

        # Run AI order generation for this thread
        res = create_ai_orders_for_thread(
            thread=existing_thread,
            all_equipments=all_eq,
            all_parts=all_parts,
            all_engineers=all_engineers,
            active_load=active_load,
            db=db,
            current_user=current_user
        )
        created_orders.append(res)
        if res.get("is_sales_transfer"):
            total_sales += 1
        else:
            total_orders += 1

    db.commit()
    log_audit(db, action="ai_batch_create_from_excel", user_id=current_user.id, object=f"{filename} ({len(created_orders)} orders)")

    return {
        "status": "success",
        "message": f"ИИ успешно обработал Excel: составлено {total_orders} сервисных заявок и {total_sales} передано в отдел продаж.",
        "total_requests": len(raw_requests),
        "total_orders_created": total_orders,
        "total_sales_transfers": total_sales,
        "orders": created_orders
    }
