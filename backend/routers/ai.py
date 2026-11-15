from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ClientThread, Equipment, SparePart
from backend.schemas import AIAnalysisResult, AIReplyGenerateRequest, AITextAnalysisRequest
from backend.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ИИ-Ассистент"])

@router.post("/analyze-thread/{thread_id}", response_model=AIAnalysisResult)
async def analyze_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = db.query(ClientThread).filter(ClientThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    all_eq = db.query(Equipment).all()
    all_parts = db.query(SparePart).all()

    # Aggregate message texts
    messages_text = "\n".join([f"[{m.channel}] {m.sender_name}: {m.content}" for m in thread.messages])

    result = await AIService.analyze_thread(
        client_name=thread.client_name,
        messages_text=messages_text,
        all_equipments=all_eq,
        all_parts=all_parts,
        thread_channel=thread.channel,
        current_equipment_code=thread.equipment_code,
        current_equipment_id=thread.equipment_id
    )
    return result

@router.post("/analyze-text", response_model=AIAnalysisResult)
async def analyze_text(req: AITextAnalysisRequest, db: Session = Depends(get_db)):
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
async def generate_reply(req: AIReplyGenerateRequest, db: Session = Depends(get_db)):
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

