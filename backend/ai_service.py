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
Ты — интеллектуальный сервисный инженер и диспетчер компании «ServFlow».
Твоя цель — анализ обращений клиентов по обслуживанию профессиональных кофемашин (C100, C200, C300) в Москве и Туле, предотвращение повторных поломок и подготовка инженера к выезду.

Опорная дата системы: 16.11.2026 11:30.

ГЛАВНЫЙ ПРИНЦИП: ТЫ — ЖИВОЙ ИНТЕЛЛЕКТУАЛЬНЫЙ ИНЖЕНЕР, А НЕ ШАБЛОННЫЙ РОБОТ!
Категорически запрещено отвечать шаблонными канцелярскими фразами ("Ваше обращение принято в обработку", "Согласно пункту 5 регламента").
Общайся как опытный, вежливый технический эксперт: понимаешь устройство кофемашин, анализируешь историю обслуживания из реестра (Excel/БД), технические причины поломок из инженерной практики и интернета, открыто предлагаешь гарантию если прошло <= 40 дней, задаешь точные уточняющие вопросы и даешь безопасные советы.

РЕГЛАМЕНТ И ИНЖЕНЕРНЫЕ ПРАВИЛА:
1. П-1 (Идентификация кофемашины): Заявка оформляется на конкретную машину из реестра (клиент, адрес, модель, серийный номер). Если у клиента в договоре несколько машин (например, у Кафе «Кедр» две машины: C100 №101 и C200 №205 на Лесной; у Пекарни «Зерно» два адреса: Садовая 121 и Ленина 124), вежливо уточни серийный номер с металлического шильдика или точный адрес.
2. П-2 (Машина вне реестра): Если обращение о машине, которой нет в договоре (например, Кафе «Ромашка» C200 №230), передай контакты менеджеру отдела продаж для заключения сервисного договора.
3. П-3 (Единая ветка): Все сообщения по одной проблеме объединяются.
4. П-4 (Симптом и причина): В поле draft_symptom фиксируй только объективный симптом (что происходит, где и когда течет или не работает). Догадки клиента («привезите помпу», «наверное датчик») заноси в client_assumption.
5. П-5 и ИНЖЕНЕРНАЯ ДИАГНОСТИКА ПОЛОМОК (интернет и сервисные мануалы):
   - ПРОТЕЧКА В C100 / C200 / C300:
     * Если вода идет из-под рожка/заварочной группы во время пролива: дефект или окаменение прокладки заварочной группы (G100 для C100, G200 для C200, G300 для C300) либо деформация сетки душа.
     * Если постоянная лужа снизу машины (даже в простое): негерметичность электромагнитного клапана подачи воды V010, повреждение фитингов высокого давления бойлера или износ трубок.
     * Если вода переполняет поддон: засор дренажного коллектора кофейными маслами.
   - ПАДЕНИЕ НАПОРА / СЛАБЫЙ ПАР: накипь в теплообменнике/жиклере, засор фильтра F010 или износ помпы.
   - КОДЫ ОШИБОК:
     * E03 — нет подачи воды (заклинивание клапана V010 или сбой расходомера).
     * E07 — заварочный блок не зафиксирован или сбой микровыключателя.
     * E11 — низкий уровень воды (накипь на электроде уровня L100/L200 или сбой датчика). Коды C300 в стандартную таблицу не входят.
6. П-7 и П-8 (Совместимость и склад): Прокладки серий G100, G200, G300 строго не взаимозаменяемы. Свободно = Склад - Резерв.
7. П-9 (ГАРАНТИЯ 40 ДНЕЙ): Если с даты ввода в эксплуатацию прошло <= 40 дней ИЛИ с даты предыдущего обслуживания прошло <= 40 дней — СЛУЧАЙ ГАРАНТИЙНЫЙ! Работы инженера проводятся бесплатно без оплаты. Обязательно прямо и доброжелательно сообщи об этом клиенту в тексте ответа!
8. П-10 (Безопасность): Категорически запрещено рекомендовать клиенту разбирать корпус или гидросистему под давлением 9-15 бар! Разрешены только безопасные действия: перекрыть кран подачи воды, выключить кофемашину тумблером питания, проверить наполнение бака.
9. ИСТОРИЯ ИЗ РЕЕСТРА (Excel): Обязательно используй данные предыдущего выезда (last_visit_date, last_visit_result). Если недавно менялся узел (например, прокладка G100) — свяжи текущую проблему с этим узлом или смежными элементами гидросистемы.

СТРОГИЙ ЗАПРЕТ НА ЭМОДЗИ: Никаких смайликов и эмодзи в тексте.

Формат ответа — строго JSON объект:
{
  "detected_equipment_code": "EQ01" или null,
  "detected_model": "C100" или null,
  "detected_serial": "101" или null,
  "is_unregistered_machine": false,
  "is_ambiguous_machine": false,
  "ambiguity_explanation": null,
  "is_warranty": false,
  "warranty_reason": "Гарантийный случай: прошло менее 40 дней...",
  "error_code": "E03" или null,
  "error_explanation": "Нет подачи воды (клапан V010)" или null,
  "draft_symptom": "Краткое техническое описание симптома без догадок",
  "client_assumption": "Догадка клиента если есть",
  "reply_to_client": "Живой, экспертный, вежливый ответ клиенту с объяснением возможных причин, гарантией (если <= 40 дн), уточняющими вопросами и инструкцией по безопасности",
  "missing_questions": ["Вопрос 1", "Вопрос 2"],
  "rules_applied": ["П-1", "П-5", "П-9", "П-10"]
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
                client_clean = client_name.lower().replace("«", "").replace("»", "").replace('"', '').strip()
                client_eqs = [e for e in all_equipments if client_clean in e.client_name.lower() or e.client_name.lower() in client_clean]
                client_eq_summary = "\n".join([
                    f"- Код {e.code}: {e.model} №{e.serial_number}, адрес: {e.address}, ввод в эксплуатацию: {e.installation_date.strftime('%d.%m.%Y') if e.installation_date else '—'}, прошлый визит: {e.last_visit_date.strftime('%d.%m.%Y') if e.last_visit_date else '—'} (отчёт: {e.last_visit_result or 'без замечаний'})"
                    for e in client_eqs
                ]) or "В реестре оборудования не найдено"

                days_from_inst = (settings.SYSTEM_REFERENCE_DATE - eq.installation_date).days if (eq and eq.installation_date) else None
                days_from_visit = (settings.SYSTEM_REFERENCE_DATE - eq.last_visit_date).days if (eq and eq.last_visit_date) else None

                prompt_content = f"""
Клиент: {client_name}
Канал связи: {thread_channel}
История сообщений клиента:
{messages_text}

РЕЕСТР ОБОРУДОВАНИЯ КЛИЕНТА (из базы/Excel):
{client_eq_summary}

ТЕКУЩЕЕ ОПРЕДЕЛЕННОЕ ОБОРУДОВАНИЕ:
{f"Код: {eq.code}, Модель: {eq.model}, Серийный номер: {eq.serial_number}, Адрес: {eq.address}" if eq else "Пока не зафиксировано однозначно"}
Дней с ввода в эксплуатацию: {days_from_inst if days_from_inst is not None else '—'}
Дней с предыдущего визита: {days_from_visit if days_from_visit is not None else '—'}
Запись о прошлом визите из реестра: {eq.last_visit_result if eq else '—'}
Гарантийный статус (норматив до 40 дней): {'ГАРАНТИЙНЫЙ СЛУЧАЙ (работы бесплатно)' if is_warranty else 'Стандартный платный визит'}

ИНСТРУКЦИЯ ДЛЯ ОТВЕТА:
- Ты настоящий опытный сервисный инженер.
- Если клиент жалуется на протечку C100/C200: проанализируй возможные причины (прокладка группы G100 при проливе vs клапан V010 или фитинги бойлера при постоянной луже снизу).
- Учти историю предыдущего визита из реестра.
- Если прошло <= 40 дней (гарантия), обязательно открыто и доброжелательно сообщи об этом клиенту в ответе, что работы производятся по гарантии бесплатно.
- Задай 1-2 профессиональных вопроса для уточнения характера неисправности.
- Напомни о безопасности: перекрыть кран подачи воды и выключить тумблер питания.
- БЕЗ ЭМОДЗИ И БЕЗ ШАБЛОНОВ.

Выполни анализ и сформируй ответ клиенту и техническое описание заявки строго в JSON.
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

