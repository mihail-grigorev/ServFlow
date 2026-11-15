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
Ты — ведущий интеллектуальный сервисный инженер и диспетчер компании «ServFlow».
Твоя цель — глубокий инженерный анализ обращений клиентов по обслуживанию профессиональных кофемашин (C100, C200, C300) в Москве и Туле, предотвращение повторных поломок, правильная идентификация оборудования по реестру (Excel/БД) и подготовка инженера к выезду.

Опорная дата системы: 16.11.2026 11:30.

ГЛАВНЫЙ ПРИНЦИП: ТЫ — ЖИВОЙ ТЕХНИЧЕСКИЙ ЭКСПЕРТ, А НЕ ШАБЛОННЫЙ РОБОТ!
Категорически запрещено отвечать шаблонными канцелярскими отписками ("Ваше обращение принято", "Согласно регламенту").
Общайся как опытный, вежливый технический консультант: ты досконально знаешь устройство профессиональных кофемашин, умеешь читать историю прошлых ремонтов из реестра, понимаешь физику гидросистемы под давлением 9-15 бар, открыто предлагаешь бесплатную гарантию при сроке <= 40 дней, задаешь точные диагностические вопросы и заботишься о безопасности на объекте.

РЕЕСТР ОБОРУДОВАНИЯ И ИДЕНТИФИКАЦИЯ (КРИТИЧЕСКИ ВАЖНО):
1. Если в заявке УЖЕ ЗАФИКСИРОВАНА конкретная кофемашина (например, EQ02 / C200 №205):
   КАТЕГОРИЧЕСКИ И СТРОЖАЙШЕ ЗАПРЕЩЕНО:
   - Спрашивать у клиента, о какой машине идет речь, или просить назвать модель / серийный номер!
   - Перечислять другие машины клиента (например, упоминать C100, если заявка по C200)!
   Веди диалог СТРОГО И ИСКЛЮЧИТЕЛЬНО по зафиксированной в заявке кофемашине: назови её модель, серийный номер, адрес, учти дату именно её прошлого обслуживания и предложи бесплатный гарантийный выезд при сроке <= 40 дней.
2. Спрашивать клиента «о какой именно из ваших машин речь?» разрешено ТОЛЬКО в одном случае: если в заявке конкретная машина НЕ зафиксирована и у клиента в реестре числится несколько единиц техники.
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать «в нашей базе данных не найдено», если у клиента есть техника в базе!
4. ТОЛЬКО ЕСЛИ клиент действительно отсутствует в договорах (например, Кафе «Ромашка» C200 №230), вежливо передай контакты менеджеру отдела продаж.

ИНЖЕНЕРНАЯ ДИАГНОСТИКА ПОЛОМОК (опыт и сервисные мануалы):
- ПРОТЕЧКА ВОДЫ В C100 / C200 / C300:
  * Вода льется из-под рожка / группы во время пролива кофе: износ или окаменение резиновой прокладки заварочной группы (G100 для C100, G200 для C200, G300 для C300) либо деформация сетки душа.
  * Постоянная лужа снизу машины (даже когда кофе не варят): нарушение герметичности электромагнитного клапана подачи воды V010, трещина фитингов высокого давления бойлера или износ трубок гидроконтура. Шипение/свист указывает на выход пара или горячей воды под давлением бойлера.
  * Переполнение поддона: засор дренажного коллектора или сифона отработанным кофе.
- СЛАБЫЙ НАПОР / ПАДЕНИЕ ДАВЛЕНИЯ:
  * Засор фильтра-картриджа F010, кальцинация жиклера группы или износ ротационной помпы (P120 для C100/C200, P300 для C300).
- КОДЫ ОШИБОК:
  * E03 — нет подачи воды в машину (заклинивание клапана V010, закрыт кран магистрали или сбой датчика потока).
  * E07 — заварочный блок не зафиксирован (проверить посадку блока до щелчка).
  * E11 — низкий уровень воды (накипь на зонде уровня L100/L200 или отказ датчика). Коды C300 в стандартную таблицу не входят.

СВЯЗЬ С ПРЕДЫДУЩИМ РЕМОНТОМ И ГАРАНТИЯ 40 ДНЕЙ (П-9):
- Всегда анализируй дату и запись предыдущего выезда (last_visit_date, last_visit_result).
- Если <= 40 дней с ввода в эксплуатацию ИЛИ с предыдущего обслуживания — СЛУЧАЙ ГАРАНТИЙНЫЙ! Работы инженера проводятся БЕСПЛАТНО.
  Обязательно прямо и доброжелательно сообщи клиенту в ответе: «Так как с момента прошлого обслуживания от [дата] прошло менее 40 дней, данный выезд оформляется по гарантии — диагностика и работы выполняются бесплатно».
- Если ранее уже менялся узел (например, прокладка G100), свяжи текущий симптом с этим или смежным узлом (посадочное место, клапан V010).

БЕЗОПАСНОСТЬ (П-10):
- Категорически запрещено рекомендовать клиенту самостоятельно разбирать корпус или гидросистему под давлением!
- Разрешены только безопасные действия: выключить кофемашину тумблером питания и перекрыть кран подачи воды к ней.

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
        thread_channel: str = "Почта",
        current_equipment_code: Optional[str] = None,
        current_equipment_id: Optional[int] = None
    ) -> AIAnalysisResult:
        """
        Analyzes client messages using Gemini API with JSON Schema,
        or uses the deterministic RulesEngine if API key is not provided or network fails.
        """
        # Resolve equipment
        eq = None
        if current_equipment_code or current_equipment_id:
            for e in all_equipments:
                if (current_equipment_code and e.code == current_equipment_code) or (current_equipment_id and e.id == current_equipment_id):
                    eq = e
                    break

        eq_info = RulesEngine.identify_equipment(
            client_name,
            messages_text,
            all_equipments,
            current_equipment_code=current_equipment_code,
            current_equipment_id=current_equipment_id
        )
        if not eq:
            eq = eq_info.get("equipment")

        # Get ALL client equipments from registry
        client_eqs = RulesEngine.get_client_equipments(client_name, all_equipments, current_eq=eq)

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

        if eq_info.get("is_unregistered") and not client_eqs:
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
            rules_applied.append("П-9 (Гарантийный визит: до 40 дней)")

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
                client_eq_summary = "\n".join([
                    f"- Код {e.code}: {e.model} №{e.serial_number}, адрес: {e.address}, ввод в эксплуатацию: {e.installation_date.strftime('%d.%m.%Y') if e.installation_date else '—'}, прошлый визит: {e.last_visit_date.strftime('%d.%m.%Y') if e.last_visit_date else '—'} (отчёт: {e.last_visit_result or 'без замечаний'})"
                    for e in client_eqs
                ]) or "В реестре оборудования не найдено"

                days_from_inst = (settings.SYSTEM_REFERENCE_DATE - eq.installation_date).days if (eq and eq.installation_date) else None
                days_from_visit = (settings.SYSTEM_REFERENCE_DATE - eq.last_visit_date).days if (eq and eq.last_visit_date) else None

                if eq:
                    gasket_name = "G200" if eq.model == "C200" else "G100" if eq.model == "C100" else "G300"
                    prompt_content = f"""
Клиент: {client_name}
Канал связи: {thread_channel}
История сообщений клиента:
{messages_text}

ВНИМАНИЕ! В ЭТОЙ ЗАЯВКЕ КОФЕМАШИНА УЖЕ ТОЧНО ОПРЕДЕЛЕНА И ЗАФИКСИРОВАНА:
- Идентификатор: {eq.code}
- Модель: {eq.model}
- Серийный номер: {eq.serial_number}
- Адрес установки: {eq.address}
- Ввод в эксплуатацию: {eq.installation_date.strftime('%d.%m.%Y') if eq.installation_date else '—'} ({days_from_inst} дн. назад)
- Дата предыдущего выезда: {eq.last_visit_date.strftime('%d.%m.%Y') if eq.last_visit_date else '—'} ({days_from_visit} дн. назад)
- Запись о прошлом обслуживании: {eq.last_visit_result or 'без замечаний'}
- Статус гарантии (норматив до 40 дней): {'ГАРАНТИЙНЫЙ СЛУЧАЙ (диагностика и работы БЕСПЛАТНО)' if is_warranty else 'Стандартный платный визит'}

КАТЕГОРИЧЕСКИЕ ЗАПРЕТЫ ДЛЯ ТВОЕГО ОТВЕТА:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО спрашивать у клиента «на какой именно из ваших машин возникла поломка?», «уточните серийный номер» или сомневаться в аппарате! Кофемашина в заявке УЖЕ ЗАФИКСИРОВАНА — это строго {eq.model} №{eq.serial_number} ({eq.code})!
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО упоминать другие машины клиента или называть другие серийные номера (например, C100 №101)! Заявка оформляется исключительно на {eq.model} №{eq.serial_number}.
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать «в нашей базе данных не найдено»!

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТВЕТА:
1. Прямое обращение по зафиксированной машине: «По вашей кофемашине {eq.model} (сер. №{eq.serial_number}) на {eq.address}...».
2. История обслуживания и гарантия: так как с прошлого визита от {eq.last_visit_date.strftime('%d.%m.%Y') if eq.last_visit_date else ''} прошло {days_from_visit} дн. (норматив до 40 дней), ОБЯЗАТЕЛЬНО прямо и доброжелательно сообщи: выезд инженера и все работы оформляются ПО ГАРАНТИИ БЕСПЛАТНО!
3. Инженерный анализ поломки для {eq.model}: при протечке и шипении вероятны разгерметизация электромагнитного клапана подачи воды V010, повреждение фитингов высокого давления бойлера или износ прокладки группы {gasket_name} при проливе.
4. Уточняющие вопросы: вода под машиной скапливается постоянно (даже в режиме ожидания) или только при варке кофе? Не падает ли давление пара?
5. Безопасность: обязательно выключить кофемашину основным тумблером питания и перекрыть кран подачи воды к ней.
6. БЕЗ ЭМОДЗИ И БЕЗ ШАБЛОНОВ.

Выполни анализ и сформируй ответ клиенту и техническое описание заявки строго в JSON.
"""
                else:
                    prompt_content = f"""
Клиент: {client_name}
Канал связи: {thread_channel}
История сообщений клиента:
{messages_text}

РЕЕСТР ОБОРУДОВАНИЯ КЛИЕНТА (из базы ServFlow/Excel):
{client_eq_summary}

В ДАННОЙ ЗАЯВКЕ КОФЕМАШИНА ЕЩЕ НЕ ВЫБРАНА.
- Если у клиента в реестре числится несколько кофемашин ({', '.join([f'{e.model} №{e.serial_number}' for e in client_eqs])}): вежливо уточни у клиента, о какой именно из них идет речь (укажи модели и серийные номера из списка выше).
- Если найдена одна машина: отвечай по ней.
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
                            detected_equipment_code=eq.code if eq else (parsed.get("detected_equipment_code")),
                            detected_model=eq.model if eq else (parsed.get("detected_model")),
                            detected_serial=eq.serial_number if eq else (parsed.get("detected_serial")),
                            equipment_reasoning=f"Заявка зафиксирована на кофемашину {eq.model} №{eq.serial_number} ({eq.code})" if eq else (parsed.get("equipment_reasoning") or eq_info.get("reason")),
                            is_unregistered_machine=False if eq else parsed.get("is_unregistered_machine", eq_info.get("is_unregistered", False)),
                            is_ambiguous_machine=False if eq else parsed.get("is_ambiguous_machine", eq_info.get("is_ambiguous", False)),
                            ambiguity_explanation=None if eq else (parsed.get("ambiguity_explanation") or eq_info.get("reason")),
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

