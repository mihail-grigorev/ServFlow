import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database import get_db
from backend.models import ClientThread, Equipment, SparePart, User
from backend.schemas import AIAnalysisResult, AIReplyGenerateRequest, AITextAnalysisRequest
from backend.ai_service import AIService
from backend.auth import require_dispatcher
from backend.rate_limiter import check_ai_rate_limit
from backend.analytics import track_event

router = APIRouter(prefix="/ai", tags=["ИИ-Ассистент"])

@router.post("/analyze-thread/{thread_id}", response_model=AIAnalysisResult)
async def analyze_thread(
    thread_id: int,
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    if not check_ai_rate_limit(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит обращений к ИИ (максимум 20 запросов в минуту)"
        )

    thread = db.query(ClientThread).filter(ClientThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()

    # Aggregate message texts
    messages_text = "\n".join([f"[{m.channel}] {m.sender_name}: {m.content}" for m in thread.messages])

    start_t = time.perf_counter()
    result = await AIService.analyze_thread(
        client_name=thread.client_name,
        messages_text=messages_text,
        all_equipments=all_eq,
        all_parts=all_parts,
        thread_channel=thread.channel,
        current_equipment_code=thread.equipment_code,
        current_equipment_id=thread.equipment_id
    )
    latency_ms = round((time.perf_counter() - start_t) * 1000, 1)

    source = "gemini" if (settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()) else "fallback"
    track_event(
        event_type="ai_analysis",
        thread_id=thread.id,
        user_id=current_user.id,
        company_id=thread.company_id,
        payload={
            "source": source,
            "latency_ms": latency_ms,
            "rules_triggered": result.rules_applied,
            "is_warranty": result.is_warranty
        },
        db=db
    )

    return result

@router.post("/analyze-text", response_model=AIAnalysisResult)
async def analyze_text(
    req: AITextAnalysisRequest,
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    if not check_ai_rate_limit(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит обращений к ИИ (максимум 20 запросов в минуту)"
        )

    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()

    client_name = req.client_name or "Клиент"
    result = await AIService.analyze_thread(
        client_name=client_name,
        messages_text=req.text,
        all_equipments=all_eq,
        all_parts=all_parts,
        thread_channel="Мессенджер"
    )
    return result

@router.post("/generate-reply")
async def generate_reply(
    req: AIReplyGenerateRequest,
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
):
    if not check_ai_rate_limit(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит обращений к ИИ (максимум 20 запросов в минуту)"
        )

    thread = db.query(ClientThread).filter(ClientThread.id == req.thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()
    messages_text = "\n".join([f"[{m.channel}] {m.sender_name}: {m.content}" for m in thread.messages])

    analysis = await AIService.analyze_thread(
        client_name=thread.client_name,
        messages_text=messages_text,
        all_equipments=all_eq,
        all_parts=all_parts,
        thread_channel=thread.channel,
        current_equipment_code=thread.equipment_code,
        current_equipment_id=thread.equipment_id
    )
    return {"reply": analysis.reply_to_client, "rules_applied": analysis.rules_applied}
