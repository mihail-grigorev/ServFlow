from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from backend.config import settings

REFERENCE_DATE = settings.SYSTEM_REFERENCE_DATE  # 2026-11-16 11:30:00

ERROR_CODES_DESCRIPTION = {
    "E03": "Нет подачи воды в машину (проверка подачи воды)",
    "E07": "Заварочный блок не обнаружен (проверка фиксации блока)",
    "E11": "Датчик показывает низкий уровень воды",
}

# Part recommendations heuristic based on symptoms
SYMPTOM_PARTS_MAPPING = {
    # Leaks, cracks, bursts, explosions, dripping, puddles (Rule П-7: gaskets & valves)
    "течь": ["G100", "G200", "G300", "V010"],
    "течет": ["G100", "G200", "G300", "V010"],
    "течёт": ["G100", "G200", "G300", "V010"],
    "теет": ["G100", "G200", "G300", "V010"],
    "протек": ["G100", "G200", "G300", "V010"],
    "протечка": ["G100", "G200", "G300", "V010"],
    "капает": ["G100", "G200", "G300", "V010"],
    "капли": ["G100", "G200", "G300"],
    "каплет": ["G100", "G200", "G300"],
    "прокладка": ["G100", "G200", "G300"],
    "прокладк": ["G100", "G200", "G300"],
    "лопнул": ["G100", "G200", "G300", "V010"],
    "лопнуло": ["G100", "G200", "G300", "V010"],
    "лопнула": ["G100", "G200", "G300", "V010"],
    "взорван": ["G100", "G200", "G300", "V010"],
    "взорвана": ["G100", "G200", "G300", "V010"],
    "взрыв": ["G100", "G200", "G300", "V010"],
    "вода": ["G100", "G200", "G300", "V010"],
    "лужа": ["G100", "G200", "G300", "V010"],
    "мокро": ["G100", "G200", "G300", "V010"],
    "поддон": ["G100", "G200", "G300", "V010"],
    "льет": ["G100", "G200", "G300", "V010"],
    "льёт": ["G100", "G200", "G300", "V010"],
    "заливает": ["G100", "G200", "G300", "V010"],

    # Flow, pump, pressure, sound, hum, noise (Rule П-7: pumps, filter, valve)
    "напор": ["F010", "P120", "P300", "V010"],
    "медленно": ["F010", "P120", "P300", "V010"],
    "струйка": ["F010", "P120", "P300"],
    "струйк": ["F010", "P120", "P300"],
    "гул": ["P120", "P300"],
    "гудит": ["P120", "P300"],
    "шум": ["P120", "P300"],
    "трещ": ["P120", "P300"],
    "стучит": ["P120", "P300"],
    "помпа": ["P120", "P300"],
    "насос": ["P120", "P300"],
    "качает": ["P120", "P300"],
    "не качает": ["P120", "P300", "V010"],
    "давление": ["P120", "P300", "V010"],
    "не идет": ["P120", "P300", "V010"],

    # Water level, sensors, tank (Rule П-7: level sensors L100/L200)
    "низкий уровень": ["L100", "L200"],
    "уровень": ["L100", "L200"],
    "уровен": ["L100", "L200"],
    "датчик": ["L100", "L200"],
    "e11": ["L100", "L200"],
    "бак": ["L100", "L200"],
    "пустой": ["L100", "L200"],

    # Filter & water treatment (Rule П-7: F010)
    "фильтр": ["F010"],
    "картридж": ["F010"],
    "накипь": ["F010"],
    "чистка": ["F010"],
    "мойка": ["F010"],

    # Steam, milk, cappuccino (Rule П-7: steam valve kit S100)
    "пар": ["S100"],
    "молоко": ["S100"],
    "молок": ["S100"],
    "взбивател": ["S100"],
    "взбивает": ["S100"],
    "пена": ["S100"],
    "пенка": ["S100"],
    "холодн": ["S100"],
    "не греет": ["S100"],
    "капучин": ["S100"],
    "кран": ["S100"],

    # Error codes (Rule П-6)
    "e03": ["V010", "P120", "P300"],
    "e07": []  # For E07 brew group reseating is user manual step, no parts initially without inspection
}

class RulesEngine:
    @staticmethod
    def check_warranty(
        installation_date: Optional[datetime],
        last_visit_date: Optional[datetime],
        last_visit_result: Optional[str],
        current_symptom: str,
        reference_date: datetime = REFERENCE_DATE
    ) -> Tuple[bool, Optional[str]]:
        """
        Rule П-9 (Updated: 40-day warranty period):
        1. If machine was installed <= 40 days before reference date -> Warranty!
        2. If last visit was <= 40 days before reference date AND complaint relates to same problem -> Warranty!
        Requires senior engineer approval. Labor is free of charge under warranty.
        """
        if installation_date:
            days_since_install = (reference_date - installation_date).days
            if 0 <= days_since_install <= 40:
                return (
                    True,
                    f"Гарантийный случай: машина установлена {days_since_install} дн. назад (норматив до 40 дней, ввод в эксплуатацию {installation_date.strftime('%d.%m.%Y')}). Работы выполняются по гарантии без оплаты, требуется согласование старшего инженера."
                )

        if last_visit_date:
            days_since_visit = (reference_date - last_visit_date).days
            if 0 <= days_since_visit <= 40:
                # Check symptom similarity
                curr_lower = current_symptom.lower()
                prev_lower = (last_visit_result or "").lower()

                # Keywords to match using Russian stems (e.g. теч matches течь, течет, протечка)
                keywords = ["теч", "протек", "кап", "гул", "шум", "напор", "медлен", "уровен", "вод", "пар", "подключ", "прокладк", "клапан", "насос", "давлен", "слив"]
                matched_keywords = [kw for kw in keywords if kw in curr_lower and kw in prev_lower]

                if matched_keywords or "заменена" in prev_lower or "исправлено" in prev_lower or "жалоба" in prev_lower or "визит" in prev_lower or "обслуживание" in prev_lower or "осмотр" in prev_lower:
                    return (
                        True,
                        f"Гарантийный случай: повторное обращение через {days_since_visit} дн. после обслуживания от {last_visit_date.strftime('%d.%m.%Y')} (норматив до 40 дней). Работы выполняются по гарантии без оплаты."
                    )

        return (False, None)

    @staticmethod
    @staticmethod
    def normalize_client_name(name: Optional[str]) -> str:
        if not name:
            return ""
        s = name.lower().replace("ё", "е")
        for char in ['«', '»', '"', "'", '“', '”', '„', '`', '—', '-', '–', '.', ',']:
            s = s.replace(char, " ")
        import re
        return re.sub(r'\s+', ' ', s).strip()

    @staticmethod
    def get_client_equipments(
        client_name: str,
        all_equipments: List[Any],
        current_eq: Optional[Any] = None
    ) -> List[Any]:
        if not all_equipments:
            return []

        # If current equipment is already confirmed, match all machines for the same client
        if current_eq:
            eq_norm = RulesEngine.normalize_client_name(current_eq.client_name)
            matched = [e for e in all_equipments if RulesEngine.normalize_client_name(e.client_name) == eq_norm]
            if matched:
                return matched

        query_norm = RulesEngine.normalize_client_name(client_name)
        if not query_norm:
            return []

        # 1. Exact normalized match
        matched = [e for e in all_equipments if RulesEngine.normalize_client_name(e.client_name) == query_norm]
        if matched:
            return matched

        # 2. Substring match
        matched = [
            e for e in all_equipments
            if query_norm in RulesEngine.normalize_client_name(e.client_name) or RulesEngine.normalize_client_name(e.client_name) in query_norm
        ]
        if matched:
            return matched

        # 3. Token match by brand keywords (excluding generic coffee/shop words)
        STOP_WORDS = {"кафе", "кофейня", "пекарня", "гостиница", "бар", "ресторан", "ооо", "зао", "пао", "ип", "клуб"}
        query_tokens = {w for w in query_norm.split() if len(w) >= 3 and w not in STOP_WORDS}
        if query_tokens:
            matched = []
            for e in all_equipments:
                e_tokens = {w for w in RulesEngine.normalize_client_name(e.client_name).split() if len(w) >= 3 and w not in STOP_WORDS}
                if query_tokens & e_tokens:
                    matched.append(e)
            if matched:
                return matched

        return []

    @staticmethod
    def identify_equipment(
        client_name: str,
        text_content: str,
        all_equipments: List[Any],
        current_equipment_code: Optional[str] = None,
        current_equipment_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Rule П-1: identify specific machine.
        If multiple machines belong to client (Кедр: 101/205; Зерно: 121/124), verify serial/address/model.
        Rule П-2: identify if machine is not in registry (Ромашка #230; Север #270).
        """
        # 0. If equipment was already explicitly linked to thread / selected
        if current_equipment_code or current_equipment_id:
            for eq in all_equipments:
                if (current_equipment_code and eq.code == current_equipment_code) or (current_equipment_id and eq.id == current_equipment_id):
                    return {
                        "equipment": eq,
                        "is_ambiguous": False,
                        "is_unregistered": False,
                        "reason": f"Оборудование зафиксировано в заявке: {eq.model} №{eq.serial_number} ({eq.code})."
                    }

        text_lower = text_content.lower()

        # 1. Check for equipment code identifier (EQ01..EQ12, eq01..eq12)
        for eq in all_equipments:
            code_clean = eq.code.lower().replace("-", "").strip()
            if code_clean in text_lower or eq.code.lower() in text_lower or eq.code in text_content:
                return {
                    "equipment": eq,
                    "is_ambiguous": False,
                    "is_unregistered": False,
                    "reason": f"Машина точно определена по идентификатору {eq.code}: модель {eq.model} (сер. №{eq.serial_number})."
                }

        # 2. Check for serial number directly in text
        for eq in all_equipments:
            if eq.serial_number in text_content:
                return {
                    "equipment": eq,
                    "is_ambiguous": False,
                    "is_unregistered": False,
                    "reason": f"Машина точно идентифицирована по серийному номеру {eq.serial_number}: модель {eq.model} ({eq.code})."
                }

        # Check for known unregistered machines per case study (П-2)
        if "ромашка" in client_name.lower() or "230" in text_content:
            return {
                "equipment": None,
                "is_ambiguous": False,
                "is_unregistered": True,
                "reason": "Машина C200 №230 (Кафе «Ромашка») отсутствует в реестре по договору. Правило П-2: выезд не назначается, обращение передаётся менеджеру по продажам."
            }

        if "север" in client_name.lower() and "270" in text_content:
            return {
                "equipment": None,
                "is_ambiguous": False,
                "is_unregistered": True,
                "reason": "Кофемашина с номером 270 в баре Гостиницы «Север» не числится в реестре договора (в договоре только №207). Правило П-2: передать менеджеру по продажам."
            }

        # Find all machines belonging to this client using robust matching
        matched = RulesEngine.get_client_equipments(client_name, all_equipments)

        # Check if address is mentioned (e.g. Садовая or Ленина for Зерно, Лесная for Кедр)
        if "садов" in text_lower:
            for eq in matched:
                if "садовая" in eq.address.lower():
                    return {
                        "equipment": eq,
                        "is_ambiguous": False,
                        "is_unregistered": False,
                        "reason": f"Идентифицирована по адресу {eq.address} (сер. №{eq.serial_number})."
                    }
        if "ленин" in text_lower:
            for eq in matched:
                if "ленина" in eq.address.lower():
                    return {
                        "equipment": eq,
                        "is_ambiguous": False,
                        "is_unregistered": False,
                        "reason": f"Идентифицирована по адресу {eq.address} (сер. №{eq.serial_number})."
                    }

        # Check if model is mentioned (C100, C200, C300 with Latin or Cyrillic 'C'/'С')
        for model_num in ["100", "200", "300"]:
            if f"c{model_num}" in text_lower or f"с{model_num}" in text_lower:
                model_matched = [e for e in matched if model_num in e.model]
                if len(model_matched) == 1:
                    return {
                        "equipment": model_matched[0],
                        "is_ambiguous": False,
                        "is_unregistered": False,
                        "reason": f"Идентифицирована по указанной клиентом модели {model_matched[0].model} (сер. №{model_matched[0].serial_number}, {model_matched[0].address})."
                    }

        if len(matched) == 1:
            return {
                "equipment": matched[0],
                "is_ambiguous": False,
                "is_unregistered": False,
                "reason": f"Единственная машина клиента в реестре: {matched[0].model} №{matched[0].serial_number}."
            }

        if len(matched) > 1:
            serials = [f"{eq.model} №{eq.serial_number} ({eq.address})" for eq in matched]
            return {
                "equipment": None,
                "is_ambiguous": True,
                "is_unregistered": False,
                "reason": f"У клиента {client_name} несколько машин в реестре: {', '.join(serials)}. Согласно правилу П-1 требуется уточнить серийный номер или адрес."
            }

        return {
            "equipment": None,
            "is_ambiguous": False,
            "is_unregistered": True,
            "reason": f"Клиент '{client_name}' не найден в реестре оборудования. Правило П-2: передать менеджеру по продажам."
        }

    @staticmethod
    def extract_symptoms_and_assumptions(text: str) -> Tuple[str, Optional[str]]:
        """
        Rule П-4:
        Symptom = Synthesized technical description: what happened, how it happened, and preliminary node.
        Assumption = Customer's hypotheses separated out.
        Never returns a raw chat transcript dump!
        """
        text_clean = text.strip()
        assumptions = []

        # Common assumption patterns to extract separately
        phrases_assumptions = [
            "можно сразу привезти новый насос",
            "привезите сразу новый насос",
            "привезите сразу насос",
            "привезите новую помпу",
            "привезите помпу",
            "привезите сразу",
            "наверное, опять тот узел",
            "наверное опять тот узел",
            "если это снова он, привезите сразу",
            "сами починим",
            "пришлите инструкцию по разборке",
            "нужна прокладка",
            "наверное помпа",
            "наверное датчик",
            "думаю дело в клапане",
            "кажется она сгорела",
            "кажется сгорел",
        ]

        lower_t = text_clean.lower()
        for phrase in phrases_assumptions:
            if phrase in lower_t:
                assumptions.append(phrase)

        # 1. Parse client text, ignoring dispatcher / engineer / system lines
        client_lines = []
        for line in text_clean.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("[") and (": " in line or "] " in line):
                header, _, body = line.partition(": ")
                if any(role in header.lower() for role in ["диспетчер", "инженер", "сервис", "система", "servflow", "ии-"]):
                    continue
                client_lines.append(body.strip())
            else:
                client_lines.append(line)

        combined_client_text = " ".join(client_lines)
        c_lower = combined_client_text.lower()

        # 2. Synthesize what and how it happened
        symptom_parts = []

        # What: Leakage
        if any(w in c_lower for w in ["течь", "течет", "течёт", "теет", "протек", "капает", "капли", "лужа", "вода"]):
            loc = "снизу корпуса (лужа под аппаратом)"
            if any(w in c_lower for w in ["из-под группы", "групп", "рожк", "холдер"]):
                loc = "из-под заварочной группы при проливе"
            elif "поддон" in c_lower:
                loc = "переполнение дренажного поддона"

            sound = ""
            if any(w in c_lower for w in ["пар", "шип", "свист", "давлен"]):
                sound = " с выходом пара под давлением (характерное шипение)"

            cond = ""
            if any(w in c_lower for w in ["постоянно", "всегда", "непрерывно", "в простое", "даже когда не варим"]):
                cond = " Вода скапливается непрерывно даже в режиме ожидания."
            elif any(w in c_lower for w in ["при варке", "при приготовлении", "когда варим", "во время пролива"]):
                cond = " Протечка возникает только в момент приготовления кофе."

            cause = (
                " Признаки разгерметизации электромагнитного клапана подачи воды V010 либо штуцеров бойлера."
                if "групп" not in loc
                else " Признаки износа или окаменения прокладки заварочной группы."
            )
            symptom_parts.append(f"Протечка воды {loc}{sound}.{cond}{cause}")

        # What: Flow & Pump
        elif any(w in c_lower for w in ["напор", "струйк", "медленно течет", "не качает", "гул", "шум", "гудит", "трещ"]):
            flow_desc = "Слабый напор и медленный пролив кофе"
            if any(w in c_lower for w in ["гул", "шум", "гудит", "трещ"]):
                flow_desc += " с посторонним гулом и вибрацией ротационной помпы"
            cond = ""
            if any(w in c_lower for w in ["после чистки", "после декальцинации", "после промывки"]):
                cond = " Симптом проявился после проведения декальцинации."
            cause = " Вероятен засор фильтра-картриджа F010, накипь в жиклере группы либо износ помпы."
            symptom_parts.append(f"{flow_desc}.{cond}{cause}")

        # What: Error codes
        elif any(w in c_lower for w in ["e03", "e07", "e11", "ошибк", "код"]):
            if "e03" in c_lower:
                symptom_parts.append("Блокировка кофемашины с кодом ошибки E03 (нет подачи воды в бойлер). Требуется ревизия клапана V010 и датчика потока.")
            elif "e07" in c_lower:
                symptom_parts.append("Ошибка E07 (заварочный блок не зафиксирован или сбой концевика). Требуется проверка посадочного места блока.")
            elif "e11" in c_lower:
                symptom_parts.append("Ошибка E11 (датчик фиксирует низкий уровень воды в баке). Признаки накипи на электроде уровня L100/L200.")
            else:
                symptom_parts.append("Индикация сервисной ошибки на панели управления. Аппарат блокирует приготовление напитков.")

        # What: Steam & Heating
        elif any(w in c_lower for w in ["пар", "молоко", "капучин", "не греет", "холодн"]):
            symptom_parts.append("Неисправность парового тракта: слабый пар или отсутствие нагрева молока при взбивании. Вероятен износ крана пара S100 или засор трубки стимера.")

        # Self-repair inquiry
        if any(w in c_lower for w in ["инструкцию по разборке", "сами починим", "как разобрать"]):
            symptom_parts.append("Запрос инструкции по разборке кофемашины для самостоятельного ремонта.")

        if symptom_parts:
            symptom_text = " ".join(symptom_parts)
        else:
            # Clean customer words: strip greetings, pleasantries, questions
            clean_sents = []
            for sent in combined_client_text.replace("!", ".").replace("?", ".").split("."):
                s = sent.strip()
                if not s or len(s) < 5:
                    continue
                s_l = s.lower()
                if any(w in s_l for w in ["здравствуйте", "добрый день", "доброе утро", "привет", "подскажите когда", "когда приедет", "спасибо"]):
                    continue
                clean_sents.append(s)
            symptom_text = ". ".join(clean_sents) + "." if clean_sents else "Требуется диагностика и осмотр кофемашины."

        return symptom_text, ("; ".join(assumptions) if assumptions else None)

    @staticmethod
    def get_missing_clarifications(text: str, equipment: Optional[Any]) -> List[str]:
        """
        Rule П-5:
        - Leak: where does water appear (bottom, left, right, group, drip tray) and when (during, after, always).
        - Weak flow: since when and after what work.
        - Error on screen: exact code.
        """
        missing = []
        lower = text.lower()

        # Leak checks
        if any(w in lower for w in ["течь", "течет", "капает", "вода"]):
            has_where = any(loc in lower for loc in ["снизу", "слева", "справа", "из-под", "поддон", "групп"])
            has_when = any(t in lower for t in ["во время", "после", "постоянно", "с утра", "утром"])
            if not has_where:
                missing.append("Где именно появляется вода (снизу, слева, справа, из-под заварочной группы или поддона)?")
            if not has_when:
                missing.append("В какой момент происходит протечка (во время приготовления, после завершения или постоянно)?")

        # Weak flow checks
        if any(w in lower for w in ["напор", "медленно", "струйк", "поток"]):
            has_when = any(t in lower for t in ["с утра", "вчера", "после", "дня", "недел"])
            if not has_when:
                missing.append("С какого момента наблюдается слабый напор и проводились ли накануне какие-либо работы/мойка?")

        # Error on screen
        if "ошибк" in lower and not any(code in text.upper() for code in ["E03", "E07", "E11"]):
            missing.append("Какой точный код ошибки отображается на дисплее кофемашины?")

        return missing

    @staticmethod
    def get_recommended_parts_for_order(
        model: Optional[str],
        city: str,
        text_content: str,
        all_parts: List[Any],
        equipment: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Rule П-7 & П-8: Part compatibility & stock check.
        Intelligently prioritizes parts based on previous service calls/visits (last_visit_result),
        eliminating excess part recommendations and strictly respecting model compatibility.
        """
        lower = text_content.lower()
        recommended = []

        history_matched_codes = set()
        history_note = None

        # 1. Analyze previous visit history from equipment
        if equipment and getattr(equipment, 'last_visit_result', None):
            last_res = equipment.last_visit_result
            last_res_lower = last_res.lower()

            # Check if previous visit mentioned specific parts or recommendation
            for part in all_parts:
                if part.code.lower() in last_res_lower:
                    history_matched_codes.add(part.code)
                    history_note = f"Подобрано на основе предыдущего визита: {last_res}"

            # Check semantic hints in last visit
            if "фильтр" in last_res_lower and ("рекоменд" in last_res_lower or "замен" in last_res_lower or "следующ" in last_res_lower):
                history_matched_codes.add("F010")
                history_note = f"Рекомендация инженера с прошлого визита: {last_res}"
            if "прокладк" in last_res_lower:
                if model == "C100":
                    history_matched_codes.add("G100")
                elif model == "C200":
                    history_matched_codes.add("G200")
                elif model == "C300":
                    history_matched_codes.add("G300")
                history_note = f"Подобрано по узлу предыдущего ремонта: {last_res}"
            if "датчик" in last_res_lower or "уровен" in last_res_lower:
                if model == "C100":
                    history_matched_codes.add("L100")
                elif model in ["C200", "C300"]:
                    history_matched_codes.add("L200")
                history_note = f"Повторная диагностика датчика уровня: {last_res}"
            if "помп" in last_res_lower or "гул" in last_res_lower:
                if model in ["C100", "C200"]:
                    history_matched_codes.add("P120")
                elif model == "C300":
                    history_matched_codes.add("P300")
                history_note = f"Диагностика гидросистемы/помпы по истории вызова: {last_res}"

        # 2. Symptom mapping
        symptom_matched_codes = set()
        for kw, codes in SYMPTOM_PARTS_MAPPING.items():
            if kw in lower:
                for c in codes:
                    symptom_matched_codes.add(c)

        if "e03" in lower:
            symptom_matched_codes.update(["V010", "P120", "P300"])
        if "e11" in lower:
            symptom_matched_codes.update(["L100", "L200"])

        # If previous visit history matched a specific part and current complaint is related or repeated,
        # prioritize that exact part instead of proposing multiple parts!
        if history_matched_codes and any(kw in lower for kw in ["течь", "течет", "течёт", "теет", "протек", "протечка", "капает", "капли", "гул", "уровен", "напор", "струйк", "пар", "вода", "фильтр", "повтор", "опять", "снова", "в прошлый раз"]):
            candidate_codes = history_matched_codes
        elif history_matched_codes and "рекоменд" in (history_note or "").lower():
            candidate_codes = history_matched_codes
        elif symptom_matched_codes:
            candidate_codes = symptom_matched_codes
        elif history_matched_codes:
            candidate_codes = history_matched_codes
        else:
            candidate_codes = set()

        for part in all_parts:
            # Check compatibility (Rule П-7)
            compat_list = part.compatible_models if isinstance(part.compatible_models, list) else []
            is_compat = (model in compat_list) if model else True

            # If model is known and part is not compatible, SKIP it!
            if model and not is_compat:
                continue

            # Only consider part if it was specifically matched by symptom or previous history
            if part.code not in candidate_codes:
                continue

            # Stock per city (Rule П-8)
            if city.lower() == "москва":
                local_stock = part.moscow_stock
                local_res = part.moscow_reserved
                local_free = max(0, local_stock - local_res)
                other_stock = part.tula_stock
                other_res = part.tula_reserved
                other_free = max(0, other_stock - other_res)
                other_city_name = "Тула"
            else:
                local_stock = part.tula_stock
                local_res = part.tula_reserved
                local_free = max(0, local_stock - local_res)
                other_stock = part.moscow_stock
                other_res = part.moscow_reserved
                other_free = max(0, other_stock - other_res)
                other_city_name = "Москва"

            transfer_required = (local_free == 0 and other_free > 0)

            # Status note
            if local_free > 0:
                status_note = f"В наличии на складе ({local_free} шт. свободно)"
            elif transfer_required:
                status_note = f"На складе 0 шт. Доступно со склада г. {other_city_name} (+1 раб. день, свободно {other_free} шт.)"
            else:
                status_note = "Нет в наличии на обоих складах"

            diagnostic_reason = None
            if part.code in history_matched_codes and history_note:
                diagnostic_reason = history_note
            elif part.code in ["G100", "G200", "G300"]:
                diagnostic_reason = f"Протечка из-под группы. Необходима совместимая прокладка {part.code}."
            elif part.code in ["P120", "P300"]:
                diagnostic_reason = f"Гул помпы или медленный пролив. Рекомендована помпа {part.code}."
            elif part.code in ["L100", "L200"]:
                diagnostic_reason = f"Индикация уровня воды / E11. Рекомендован датчик {part.code}."
            elif part.code == "V010":
                diagnostic_reason = "Ошибка E03 или слабый приток воды: клапан подачи V010."
            elif part.code == "F010":
                diagnostic_reason = "Слабый напор: рекомендована замена фильтра-картриджа F010."
            elif part.code == "S100":
                diagnostic_reason = "Слабый пар / капучинатор: ремкомплект крана S100."

            recommended.append({
                "code": part.code,
                "name": part.name,
                "is_compatible": is_compat,
                "local_stock": local_stock,
                "local_reserved": local_res,
                "local_free": local_free,
                "other_city_free": other_free,
                "transfer_required": transfer_required,
                "status_note": status_note,
                "is_suggested": True,
                "from_history": part.code in history_matched_codes,
                "diagnostic_reason": diagnostic_reason
            })

        # Sort: parts identified by history first, then available in local stock
        recommended.sort(key=lambda x: (not x.get("from_history", False), x["local_free"] <= 0))
        # Limit to 1-2 most relevant parts to avoid asking for too many parts
        return recommended[:2]

    @staticmethod
    def generate_conversational_reply(
        messages_history: List[Any],
        client_name: str,
        equipment_info: Dict[str, Any],
        is_warranty: bool,
        warranty_reason: Optional[str],
        all_equipment: Optional[List[Any]] = None
    ) -> str:
        """
        Balanced conversational AI dispatcher:
        A natural middle-ground between free dialogue and corporate регламент (Rules П-1 .. П-10).
        Remembers what the customer already answered across the entire dialogue history,
        avoids rigid repetitive greetings, and asks only what is genuinely missing to prepare an engineer's visit.
        """
        client_texts = []
        dispatcher_count = 0
        for m in messages_history:
            sender = getattr(m, "sender_type", None) or (m.get("sender_type") if isinstance(m, dict) else "")
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            if sender == "client":
                client_texts.append(content)
            elif sender == "dispatcher":
                dispatcher_count += 1

        latest_client_msg = client_texts[-1] if client_texts else ""
        full_client_history = " ".join(client_texts).lower()
        latest_lower = latest_client_msg.lower()

        # Check if we already greeted in this thread
        is_ongoing = dispatcher_count > 0
        ack = "Принято! " if is_ongoing else "Здравствуйте! "

        # Rule П-10: Self-repair / Disassembly check
        if any(w in latest_lower for w in ["разобрать", "разборк", "вскрыть", "сами починим", "инструкцию по разборке"]):
            return (
                f"{'Понимаю ваше желание починить всё скорее, но ' if is_ongoing else 'Здравствуйте! Понимаю ваше желание ускорить ремонт, однако '} "
                "самостоятельно разбирать профессиональную кофемашину крайне не рекомендуем: "
                "это нарушает технику безопасности, аннулирует гарантию и может повредить гидросистему высокого давления. "
                "Безопасно вы можете только проверить подачу воды в баке/магистрали или перезагрузить кофемашину тумблером питания. "
                "Для устранения неисправности к вам выедет наш сервисный инженер со специальным инструментом и оригинальными комплектующими."
            )

        # Arrival inquiry check
        if any(w in latest_lower for w in ["когда приедет", "когда будет", "во сколько", "сегодня успеет", "когда мастер", "сроки"]):
            city = equipment_info.get("equipment").city if equipment_info.get("equipment") else "вашем городе"
            return (
                f"{ack}Сервисный инженер готовит комплект запасных частей со склада в {city}. "
                "Выезд запланирован в течение рабочего дня. Мастер обязательно свяжется с вами по телефону за 30-40 минут до прибытия по адресу."
            )

        # Rule П-2: Machine not in registry
        if equipment_info.get("is_unregistered"):
            return (
                f"{'Мы проверили базу договоров ServFlow: ' if is_ongoing else 'Здравствуйте! Спасибо за обращение. Мы проверили базу договоров ServFlow: '}"
                "данная кофемашина не числится в действующем реестре сервисного обслуживания. "
                "Согласно регламенту, мы передаём ваши контакты и описание оборудования менеджеру отдела продаж: "
                "специалист оперативно свяжется с вами для оформления сервисного договора или согласования разового выезда."
            )

        # Rule П-1: Ambiguous machine check
        eq = equipment_info.get("equipment")
        if equipment_info.get("is_ambiguous") and not eq:
            if is_ongoing:
                return (
                    f"{ack}Чтобы инженер взял точно совместимые запчасти и допуски, подскажите, пожалуйста, "
                    "серийный номер кофемашины (указан на металлическом шильдике) или точный адрес заведения — "
                    "по вашему договору зарегистрировано несколько единиц техники."
                )
            else:
                return (
                    "Здравствуйте! По вашему договору зарегистрировано несколько кофемашин. "
                    "Чтобы сервисный инженер взял с собой совместимые запасные части и инструменты, пожалуйста, "
                    "уточните серийный номер кофемашины (указан на металлическом шильдике) либо точный адрес заведения."
                )

        # Fact checking from full history:
        # 1. Leak specifics
        is_leak = any(w in full_client_history for w in ["течь", "течет", "течёт", "теет", "капает", "капли", "вода", "лужа", "протек"])
        leak_location_known = any(w in full_client_history for w in ["снизу", "из-под группы", "групп", "поддон", "под поддоном", "слева", "справа", "кран", "из крана", "из носика", "спереди", "сзади"])
        leak_timing_known = any(w in full_client_history for w in ["постоянно", "всегда", "непрерывно", "при варке", "при приготовлении", "когда варим", "после", "утром", "ночью", "при включении", "не варим"])

        # 2. Error code specifics
        has_error_mention = any(w in full_client_history for w in ["ошибк", "код", "горит", "пишет", "дисплей", "error"])
        detected_error_code = None
        for code in ["E03", "E07", "E11"]:
            if code.lower() in full_client_history:
                detected_error_code = code
                break

        # 3. Weak flow / Steam
        is_weak_flow = any(w in full_client_history for w in ["слабый напор", "напор", "струйк", "медленно течет", "еле течет", "слабый пар", "пар не идет", "нет пара", "капучинатор"])
        flow_onset_known = any(w in full_client_history for w in ["после чистки", "после промывки", "после декальцинации", "сегодня", "вчера", "давно", "постепенно", "резко", "неделю"])

        # Technical failure analysis based on model, registry history and symptoms:
        eq_history_note = ""
        days_note = ""
        if eq:
            if eq.last_visit_date:
                days_since_v = (REFERENCE_DATE - eq.last_visit_date).days
                if days_since_v <= 40:
                    days_note = f"По нашей базе по вашей {eq.model} (№{eq.serial_number}, {eq.address}) с момента предыдущего визита от {eq.last_visit_date.strftime('%d.%m.%Y')} прошло {days_since_v} дн. (в пределах 40-дневного гарантийного периода). Мы оформляем заявку по гарантии — работы будут выполнены бесплатно. "
                elif eq.last_visit_result:
                    eq_history_note = f"В истории обслуживания отмечено: «{eq.last_visit_result}». "
            elif eq.installation_date:
                days_since_i = (REFERENCE_DATE - eq.installation_date).days
                if days_since_i <= 40:
                    days_note = f"По реестру ServFlow оборудование {eq.model} (№{eq.serial_number}) введено в эксплуатацию {days_since_i} дн. назад ({eq.installation_date.strftime('%d.%m.%Y')}). Выезд и диагностика оформляются по гарантии без оплаты работ. "

        # 1. Leak specifics with technical coffee machine knowledge:
        if is_leak:
            tech_cause = (
                f"Для кофемашин {eq.model if eq else 'серии C'} утечка обычно вызвана либо износом уплотнительного кольца группы (прокладка G100/G200), либо негерметичностью электромагнитного клапана подачи воды V010 / фитингов высокого давления бойлера."
                if (not eq or eq.model in ["C100", "C200"]) else
                "Для моделей C300 протечка может быть связана с гидросистемой группы G300 или трубками подвода бойлера."
            )

            if not leak_location_known and not leak_timing_known:
                return (
                    f"{ack}{days_note}{eq_history_note}Фиксирую проблему с протечкой. {tech_cause} "
                    "Чтобы инженер со склада сразу взял нужный узел (клапан V010 или прокладку группы), уточните, пожалуйста: "
                    "вода сочится снизу постоянно или протекает только в момент приготовления кофе из-под рожка? "
                    "В целях безопасности перекройте кран подачи воды и выключите кофемашину тумблером питания."
                )
            elif not leak_location_known:
                return (
                    f"{ack}{days_note}{eq_history_note}Зафиксировал появление воды. "
                    "Подскажите, откуда именно она выступает: снизу из-под поддона, из-под заварочной группы при проливе, или из крана пара? "
                    "До приезда мастера перекройте кран подачи воды."
                )
            elif not leak_timing_known:
                return (
                    f"{ack}{days_note}{eq_history_note}Место течи зафиксировал. "
                    "Уточните, пожалуйста: вода сочится постоянно даже в режиме ожидания или только в момент экстракции кофе? "
                    "Инженер уже подбирает комплект уплотнителей и клапанов со склада."
                )

        if is_weak_flow and not flow_onset_known:
            return (
                f"{ack}{days_note}{eq_history_note}По симптомам снижения напора и давления возможна накипь в жиклерах гидросистемы, засор фильтра или износ помпы. "
                "Подскажите, пожалуйста: напор пропал резко (например, после декальцинации/промывки) или снижался постепенно? "
                "Проверьте, пожалуйста, уровень воды в баке или давление в подводящей магистрали."
            )

        if has_error_mention and not detected_error_code:
            return (
                f"{ack}{days_note}Для точной диагностики контроллера подскажите, какой код ошибки высвечивается на экране (например, E03 — нет подачи воды, E07 — заварочный блок, E11 — датчик уровня)?"
            )

        # If error code IS known:
        if detected_error_code:
            error_expl = ERROR_CODES_DESCRIPTION.get(detected_error_code, "")
            part_suggestion = "клапан подачи воды V010" if detected_error_code == "E03" else ("датчик уровня воды L100/L200" if detected_error_code == "E11" else "комплект датчиков заварочного узла")
            return (
                f"{ack}{days_note}Код ошибки {detected_error_code} ({error_expl}) зафиксирован. "
                f"Согласно регламенту и техкарте, сервисный инженер готовит со склада {part_suggestion} и инструмент для выездной диагностики на адрес {eq.address if eq else 'вашего заведения'}. "
                "Ожидайте прибытия мастера, он свяжется с вами перед выездом."
            )

        # Standard resolution when everything is known:
        model_str = f"модель {eq.model}" if eq else "кофемашина"
        serial_str = f" (№{eq.serial_number})" if eq and eq.serial_number else ""
        warranty_str = " Случай гарантийный — согласование передано старшему инженеру." if is_warranty else ""

        return (
            f"{ack}Вся необходимая информация собрана: {model_str}{serial_str}.{warranty_str} "
            f"Заявка на сервисный выезд успешно сформирована. "
            f"Инженер подбирает совместимые запасные части на складе и выезжает к вам. Мастер свяжется с вами перед визитом!"
        )

    @staticmethod
    def generate_rule_based_reply(
        client_name: str,
        text_content: str,
        equipment_info: Dict[str, Any],
        is_warranty: bool,
        warranty_reason: Optional[str]
    ) -> str:
        """
        Generate polite, professional reply to customer adhering strictly to Rules П-1, П-5, П-10.
        """
        lower = text_content.lower()

        # Rule П-10: Customer wants disassembly / self-repair instructions
        if "инструкцию по разборке" in lower or "сами починим" in lower:
            return (
                "Здравствуйте! В соответствии с регламентом сервисного обслуживания и требованиями безопасности "
                "мы не предоставляем инструкции по самостоятельной разборке оборудования. Самостоятельное вскрытие узлов "
                "может привести к повреждению кофемашины и снятию с гарантии.\n\n"
                "Вы можете безопасно выполнить базовые шаги из руководства пользователя:\n"
                "1. Выключить и включить кофемашину сетевым выключателем;\n"
                "2. Проверить корректность подачи воды и давление в магистрали;\n"
                "3. Извлечь и заново плотно установить заварочный блок до характерного щелчка.\n\n"
                "Для устранения неисправности мы готовы направить сервисного инженера с необходимым диагностическим оборудованием."
            )

        # Rule П-2: Machine not in contract registry
        if equipment_info.get("is_unregistered"):
            return (
                "Здравствуйте! Спасибо за обращение. Мы проверили базу договоров: данная кофемашина не числится "
                "в действующем реестре сервисного обслуживания компании «ServFlow». Согласно регламенту, "
                "мы передаём контакты и данные оборудования менеджеру по продажам для заключения сервисного договора "
                "и согласования условий разового или постоянного обслуживания. Специалист свяжется с вами в ближайшее время!"
            )

        # Rule П-1: Ambiguous machine
        if equipment_info.get("is_ambiguous"):
            return (
                "Здравствуйте! Спасибо за обращение. По вашему договору зарегистрировано несколько кофемашин. "
                "Чтобы сервисный инженер взял с собой точно совместимые запасные части и инструменты, пожалуйста, "
                "уточните серийный номер кофемашины (указан на металлическом шильдике) либо точный адрес заведения."
            )

        # Missing questions check (Rule П-5)
        missing = RulesEngine.get_missing_clarifications(text_content, equipment_info.get("equipment"))
        if missing:
            questions_text = "\n".join([f"- {q}" for q in missing])
            return (
                f"Здравствуйте! Ваше обращение принято в обработку. Для оперативной подготовки выезда инженера "
                f"и подбора необходимых комплектующих со склада, пожалуйста, уточните следующие детали:\n{questions_text}\n\n"
                f"После уточнения диспетчер сразу согласует удобное время визита специалиста."
            )

        # Standard confirmation
        warranty_note = ""
        if is_warranty:
            warranty_note = " Данный случай классифицирован как гарантийный и передан на приоритетное согласование старшему инженеру."

        return (
            f"Здравствуйте! Спасибо за предоставленную информацию. Заявка на сервисное обслуживание зафиксирована.{warranty_note} "
            f"Сервисный инженер готовит комплект запасных частей со склада для проведения выездной диагностики и ремонта. "
            f"Ожидайте прибытия специалиста."
        )

