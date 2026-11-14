import os
import json
import logging
from typing import Optional, List, Dict, Any
import httpx
from backend.config import settings
from backend.rules_engine import RulesEngine, ERROR_CODES_DESCRIPTION
from backend.schemas import AIAnalysisResult, RecommendedPartCandidate

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
Ты — интеллектуальный ассистент диспетчера сервисной компании «ServFlow».
Твоя цель — анализ обращений клиентов по обслуживанию профессиональных кофемашин в Москве и Туле, подготовка выезда сервисного инженера и сокращение повторных («пустых») визитов.

Опорная дата системы: 16.11.2026 11:30.

СТРОГИЕ ПРАВИЛА КОМПАНИИ (П-1 .. П-10):
1. П-1 (Определение машины): Выезд готовят на конкретную машину из реестра (клиент, адрес, модель, серийный номер). Если у клиента несколько машин (например, у Кафе «Кедр» две машины: 101 и 205; у Пекарни «Зерно» два адреса: Садовая 121 и Ленина 124), название клиента не определяет машину — требуется уточнить серийный номер или адрес.
2. П-2 (Машина не из реестра): Выезд назначают только на машину из реестра. Обращение о машине вне реестра (например, Кафе «Ромашка» C200 №230) передаётся менеджеру по продажам.
3. П-3 (Повторы и уточнения): Повторные сообщения по той же проблеме объединяются в открытую ветку.
4. П-4 (Симптом и причина): В заявку записывают только симптом (что происходит, когда и где). Догадки клиента («привезите насос», «наверное датчик») записываются отдельно как комментарий клиента, но не считаются причиной!
5. П-5 (Что уточнить):
   - Течь: где именно появляется вода (снизу, слева, справа, из-под группы, из-под поддона) и когда (во время приготовления, после, постоянно).
   - Слабый поток/напор: с какого момента и после каких работ.
   - Ошибка: точный код.
6. П-6 (Коды ошибок): E03 — нет подачи воды; E07 — заварочный блок не обнаружен; E11 — датчик показывает низкий уровень воды. Коды C300 в стандартную таблицу не входят.
7. П-7 (Совместимость деталей): Деталь берут только если модель машины указана в списке подходящих. Прокладки разных серий (G100, G200, G300) не взаимозаменяемы!
8. П-8 (Свободный остаток): Свободно = Склад - Резерв. Перевозка Москва <-> Тула занимает +1 рабочий день.
9. П-9 (Гарантия): Если та же жалоба пришла в течение <=30 дней после ремонта или машина установлена <=30 дней назад, случай гарантийный и требует согласования старшего инженера.
10. П-10 (Действия клиента): Запрещено давать инструкции по разборке и самостоятельный ремонт! Разрешены только действия из руководства пользователя: выключить/включить, проверить подачу воды, заново установить заварочный блок.
11. ИСТОРИЯ ПРЕДЫДУЩИХ ВЫЗОВОВ: Обязательно учитывай данные предыдущего визита (last_visit_result). Если на прошлом визите инженер менял деталь или рекомендовал замену, ориентируйся строго на этот узел. НЕ предлагай лишних деталей: подбирай максимум 1-2 наиболее точные и совместимые детали.

ЗАПРЕТ НА ЭМОДЗИ: Категорически не используй эмодзи в ответах.

Верни строго JSON объект следующей структуры:
{
  "detected_equipment_code": "EQ01" или null,
  "detected_model": "C100" или null,
  "detected_serial": "101" или null,
  "is_unregistered_machine": false,
  "is_ambiguous_machine": false,
  "ambiguity_explanation": null,
  "is_warranty": false,
  "warranty_reason": null,
  "error_code": "E07" или null,
  "error_explanation": "Заварочный блок не обнаружен" или null,
  "draft_symptom": "Краткое техническое описание симптома без догадок",
  "client_assumption": "Догадка клиента (например: просит привезти насос)",
  "reply_to_client": "Вежливый текст ответа клиенту по правилам П-1, П-5, П-10",
  "missing_questions": ["Вопрос 1", "Вопрос 2"],
  "rules_applied": ["П-1", "П-5"]
}
"""

class AIService:
    @staticmethod
    async def analyze_thread(
        client_name: str,
        messages_text: str,
        all_equipments: List[Any],
        all_parts: List[Any],
        thread_channel: str = "Почта"
    ) -> AIAnalysisResult:
        """
        Analyzes client messages using Gemini API with JSON Schema,
        or uses the deterministic RulesEngine if API key is not provided or network fails.
        """
        # First, run deterministic rule engine evaluation
        eq_info = RulesEngine.identify_equipment(client_name, messages_text, all_equipments)
        eq = eq_info.get("equipment")

        # Warranty check
        is_warranty = False
        warranty_reason = None
        if eq:
            is_warranty, warranty_reason = RulesEngine.check_warranty(
                eq.installation_date,
                eq.last_visit_date,
                eq.last_visit_result,
                messages_text
            )

        # Symptom and assumption extraction
        clean_symptom, client_assumption = RulesEngine.extract_symptoms_and_assumptions(messages_text)

        # Missing questions
        missing_questions = RulesEngine.get_missing_clarifications(messages_text, eq)

        # Error code detection
        error_code = None
        error_explanation = None
        for code, expl in ERROR_CODES_DESCRIPTION.items():
            if code in messages_text.upper():
                error_code = code
                error_explanation = expl
                break

        # City determination
        city = eq.city if eq else ("Москва" if "москва" in messages_text.lower() else "Тула")

        # Recommended parts with stock check & previous visit history
        parts_list = RulesEngine.get_recommended_parts_for_order(
            eq.model if eq else None,
            city,
            messages_text,
            all_parts,
            equipment=eq
        )
        recommended_parts = [
            RecommendedPartCandidate(
                code=p["code"],
                name=p["name"],
                is_compatible=p["is_compatible"],
                local_stock=p["local_stock"],
                local_reserved=p["local_reserved"],
                local_free=p["local_free"],
                other_city_free=p["other_city_free"],
                transfer_required=p["transfer_required"],
                status_note=p["status_note"],
                diagnostic_reason=p.get("diagnostic_reason")
            )
            for p in parts_list
        ]

        # Rules applied list
        rules_applied = []
        if eq_info.get("is_ambiguous"):
            rules_applied.append("П-1 (Определение машины: неоднозначность)")
        elif eq:
            rules_applied.append("П-1 (Определение машины: зафиксирована)")

        if eq_info.get("is_unregistered"):
            rules_applied.append("П-2 (Машина не из реестра: передача в продажи)")

        if client_assumption:
            rules_applied.append("П-4 (Отделение симптома от догадок клиента)")

        if missing_questions:
            rules_applied.append("П-5 (Уточнение параметров течи/напора/ошибки)")

        if error_code:
            rules_applied.append("П-6 (Коды ошибок C100/C200)")

        if recommended_parts:
            rules_applied.append("П-7 (Совместимость запчастей)")
            rules_applied.append("П-8 (Свободный остаток и межскладская логистика)")

        if is_warranty:
            rules_applied.append("П-9 (Гарантийный визит: до 30 дней)")

        if "инструкцию по разборке" in messages_text.lower() or "сами починим" in messages_text.lower():
            rules_applied.append("П-10 (Отказ в разборке, действия по руководству)")

        # Prepare rule-based fallback reply
        fallback_reply = RulesEngine.generate_rule_based_reply(
            client_name,
            messages_text,
            eq_info,
            is_warranty,
            warranty_reason
        )

        # If Gemini API key is configured, call Gemini API
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            try:
                prompt_content = f"""
Клиент: {client_name}
Канал связи: {thread_channel}
История сообщений:
{messages_text}

Информация об оборудовании:
{f"Код: {eq.code}, Модель: {eq.model}, Серийный номер: {eq.serial_number}, Адрес: {eq.address}, Дата установки: {eq.installation_date}, Последний визит: {eq.last_visit_date} ({eq.last_visit_result})" if eq else "Машина в реестре пока не определена или отсутствует"}

Выполни анализ и сформируй ответ клиенту и техническое описание заявки строго по правилам П-1 .. П-10.
"""
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2
                    }
                }

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text_resp)

                        return AIAnalysisResult(
                            detected_equipment_code=parsed.get("detected_equipment_code") or (eq.code if eq else None),
                            detected_model=parsed.get("detected_model") or (eq.model if eq else None),
                            detected_serial=parsed.get("detected_serial") or (eq.serial_number if eq else None),
                            equipment_reasoning=parsed.get("equipment_reasoning") or eq_info.get("reason"),
                            is_unregistered_machine=parsed.get("is_unregistered_machine", eq_info.get("is_unregistered", False)),
                            is_ambiguous_machine=parsed.get("is_ambiguous_machine", eq_info.get("is_ambiguous", False)),
                            ambiguity_explanation=parsed.get("ambiguity_explanation") or eq_info.get("reason"),
                            is_warranty=parsed.get("is_warranty", is_warranty),
                            warranty_reason=parsed.get("warranty_reason") or warranty_reason,
                            error_code=parsed.get("error_code") or error_code,
                            error_explanation=parsed.get("error_explanation") or error_explanation,
                            draft_symptom=parsed.get("draft_symptom") or clean_symptom,
                            client_assumption=parsed.get("client_assumption") or client_assumption,
                            reply_to_client=parsed.get("reply_to_client") or fallback_reply,
                            missing_questions=parsed.get("missing_questions") or missing_questions,
                            recommended_parts=recommended_parts,
                            rules_applied=list(set(rules_applied + parsed.get("rules_applied", [])))
                        )
            except Exception as e:
                logger.warning(f"Gemini API call failed: {e}. Using deterministic fallback analyzer.")

        # Return deterministic rule-based analysis
        return AIAnalysisResult(
            detected_equipment_code=eq.code if eq else None,
            detected_model=eq.model if eq else None,
            detected_serial=eq.serial_number if eq else None,
            equipment_reasoning=eq_info.get("reason"),
            is_unregistered_machine=eq_info.get("is_unregistered", False),
            is_ambiguous_machine=eq_info.get("is_ambiguous", False),
            ambiguity_explanation=eq_info.get("reason") if eq_info.get("is_ambiguous") else None,
            is_warranty=is_warranty,
            warranty_reason=warranty_reason,
            error_code=error_code,
            error_explanation=error_explanation,
            draft_symptom=clean_symptom,
            client_assumption=client_assumption,
            reply_to_client=fallback_reply,
            missing_questions=missing_questions,
            recommended_parts=recommended_parts,
            rules_applied=rules_applied
        )

