from datetime import datetime
import openpyxl
from sqlalchemy.orm import Session
from backend.models import User, Equipment, SparePart, ClientThread, Message, ServiceOrder
from backend.auth import get_password_hash
from backend.rules_engine import RulesEngine

# Built-in exact data dictionary from case study
EQUIPMENT_DATA = [
    {
        "code": "EQ01",
        "client_name": "Кафе «Кедр»",
        "address": "Москва, ул. Лесная, 12",
        "city": "Москва",
        "model": "C100",
        "serial_number": "101",
        "installation_date": datetime(2024, 3, 14),
        "last_visit_date": datetime(2026, 10, 20),
        "last_visit_result": "Течь снизу. Заменена прокладка G100, причина подтверждена осмотром."
    },
    {
        "code": "EQ02",
        "client_name": "Кафе «Кедр»",
        "address": "Москва, ул. Лесная, 12",
        "city": "Москва",
        "model": "C200",
        "serial_number": "205",
        "installation_date": datetime(2025, 6, 2),
        "last_visit_date": datetime(2026, 10, 10),
        "last_visit_result": "Плановое обслуживание, замечаний нет."
    },
    {
        "code": "EQ03",
        "client_name": "Гостиница «Берег»",
        "address": "Тула, Набережная ул., 3",
        "city": "Тула",
        "model": "C100",
        "serial_number": "108",
        "installation_date": datetime(2023, 11, 19),
        "last_visit_date": datetime(2026, 9, 12),
        "last_visit_result": "Плановое обслуживание, замечаний нет."
    },
    {
        "code": "EQ04",
        "client_name": "Кафе «Лист»",
        "address": "Москва, Цветной б-р, 7",
        "city": "Москва",
        "model": "C300",
        "serial_number": "310",
        "installation_date": datetime(2025, 1, 27),
        "last_visit_date": datetime(2026, 11, 1),
        "last_visit_result": "Жалоба на гул. На визите симптом не повторился, узлы не менялись."
    },
    {
        "code": "EQ05",
        "client_name": "Кафе «Парк»",
        "address": "Москва, Парковая ул., 21",
        "city": "Москва",
        "model": "C200",
        "serial_number": "211",
        "installation_date": datetime(2024, 7, 8),
        "last_visit_date": datetime(2026, 8, 11),
        "last_visit_result": "Заменён датчик уровня L200."
    },
    {
        "code": "EQ06",
        "client_name": "Кафе «Угол»",
        "address": "Тула, ул. Советская, 40",
        "city": "Тула",
        "model": "C100",
        "serial_number": "119",
        "installation_date": datetime(2025, 9, 30),
        "last_visit_date": datetime(2026, 11, 8),
        "last_visit_result": "Исправлено подключение подачи воды. Узлы не менялись."
    },
    {
        "code": "EQ07",
        "client_name": "Кофейня «Сквер»",
        "address": "Москва, ул. Мясницкая, 15",
        "city": "Москва",
        "model": "C200",
        "serial_number": "214",
        "installation_date": datetime(2024, 4, 11),
        "last_visit_date": datetime(2026, 8, 20),
        "last_visit_result": "Клиент описывал гул при приготовлении. После осмотра заменили узел, симптом исчез."
    },
    {
        "code": "EQ08",
        "client_name": "Пекарня «Зерно»",
        "address": "Тула, ул. Садовая, 4",
        "city": "Тула",
        "model": "C100",
        "serial_number": "121",
        "installation_date": datetime(2025, 2, 5),
        "last_visit_date": datetime(2026, 10, 2),
        "last_visit_result": "Заменён фильтр-картридж F010."
    },
    {
        "code": "EQ09",
        "client_name": "Пекарня «Зерно»",
        "address": "Тула, пр. Ленина, 18",
        "city": "Тула",
        "model": "C100",
        "serial_number": "124",
        "installation_date": datetime(2025, 2, 5),
        "last_visit_date": datetime(2026, 10, 15),
        "last_visit_result": "Плановое обслуживание, замечаний нет."
    },
    {
        "code": "EQ10",
        "client_name": "Кафе «Маяк»",
        "address": "Москва, ул. Таганская, 9",
        "city": "Москва",
        "model": "C300",
        "serial_number": "305",
        "installation_date": datetime(2024, 10, 16),
        "last_visit_date": datetime(2026, 10, 28),
        "last_visit_result": "Течь из-под заварочной группы. Заменена прокладка G300."
    },
    {
        "code": "EQ11",
        "client_name": "Гостиница «Север»",
        "address": "Москва, Ленинградский пр., 52",
        "city": "Москва",
        "model": "C200",
        "serial_number": "207",
        "installation_date": datetime(2024, 5, 21),
        "last_visit_date": datetime(2026, 9, 14),
        "last_visit_result": "Плановое обслуживание. Инженер рекомендовал заменить фильтр-картридж на следующем визите."
    },
    {
        "code": "EQ12",
        "client_name": "Ресторан «Пирс»",
        "address": "Москва, Пресненская наб., 6",
        "city": "Москва",
        "model": "C100",
        "serial_number": "133",
        "installation_date": datetime(2026, 11, 3),
        "last_visit_date": None,
        "last_visit_result": None
    }
]

PARTS_DATA = [
    {"code": "G100", "name": "Прокладка заварочной группы", "compatible_models": ["C100"], "moscow_stock": 3, "moscow_reserved": 0, "tula_stock": 1, "tula_reserved": 0},
    {"code": "G200", "name": "Прокладка заварочной группы", "compatible_models": ["C200"], "moscow_stock": 2, "moscow_reserved": 2, "tula_stock": 0, "tula_reserved": 0},
    {"code": "G300", "name": "Прокладка заварочной группы", "compatible_models": ["C300"], "moscow_stock": 1, "moscow_reserved": 0, "tula_stock": 0, "tula_reserved": 0},
    {"code": "P120", "name": "Помпа (насос подачи воды)", "compatible_models": ["C100", "C200"], "moscow_stock": 4, "moscow_reserved": 1, "tula_stock": 1, "tula_reserved": 1},
    {"code": "P300", "name": "Помпа (насос подачи воды)", "compatible_models": ["C300"], "moscow_stock": 1, "moscow_reserved": 1, "tula_stock": 0, "tula_reserved": 0},
    {"code": "L100", "name": "Датчик уровня воды", "compatible_models": ["C100"], "moscow_stock": 2, "moscow_reserved": 0, "tula_stock": 1, "tula_reserved": 0},
    {"code": "L200", "name": "Датчик уровня воды", "compatible_models": ["C200"], "moscow_stock": 1, "moscow_reserved": 1, "tula_stock": 2, "tula_reserved": 0},
    {"code": "V010", "name": "Клапан подачи воды", "compatible_models": ["C100", "C200", "C300"], "moscow_stock": 5, "moscow_reserved": 2, "tula_stock": 3, "tula_reserved": 0},
    {"code": "F010", "name": "Фильтр-картридж для воды", "compatible_models": ["C100", "C200", "C300"], "moscow_stock": 14, "moscow_reserved": 6, "tula_stock": 9, "tula_reserved": 3},
    {"code": "S100", "name": "Ремкомплект парового крана", "compatible_models": ["C100"], "moscow_stock": 0, "moscow_reserved": 0, "tula_stock": 2, "tula_reserved": 0},
]

# Raw 23 requests
RAW_REQUESTS = [
    {"code": "З-01", "time": "16.11 08:05", "channel": "Почта", "sender": "Кафе «Кедр», администратор", "client": "Кафе «Кедр»", "text": "Кофемашина опять течёт снизу, приезжайте как в прошлый раз. Какая из двух — уточню у смены."},
    {"code": "З-02", "time": "16.11 08:12", "channel": "Звонок", "sender": "Гостиница «Берег», служба питания", "client": "Гостиница «Берег»", "text": "После мойки не выдаёт кофе. Питание включено, на экране код ошибки, но его не записали."},
    {"code": "З-03", "time": "16.11 08:20", "channel": "Мессенджер", "sender": "Кафе «Лист», бариста", "client": "Кафе «Лист»", "text": "На C300 снова гул, но напиток готовит. В прошлый раз инженер ничего не нашёл."},
    {"code": "З-04", "time": "16.11 08:31", "channel": "Почта", "sender": "Кафе «Парк», управляющий", "client": "Кафе «Парк»", "text": "На машине 211 надпись «Низкий уровень», хотя вода в баке есть. Можно сразу привезти новый насос?"},
    {"code": "З-05", "time": "16.11 08:44", "channel": "Звонок", "sender": "Кафе «Угол», администратор", "client": "Кафе «Угол»", "text": "Наш номер 119. С утра напиток идёт очень медленно, вчера всё работало."},
    {"code": "З-06", "time": "16.11 08:52", "channel": "Мессенджер", "sender": "Кафе «Кедр», бариста", "client": "Кафе «Кедр»", "text": "Уточнение по течи: на шильдике 205, вода появляется справа после приготовления."},
    {"code": "З-07", "time": "16.11 09:03", "channel": "Почта", "sender": "Пекарня «Зерно», офис", "client": "Пекарня «Зерно»", "text": "В пекарне снова слабый напор, кофе течёт тонкой струйкой."},
    {"code": "З-08", "time": "16.11 09:10", "channel": "Почта", "sender": "Кафе «Лист», управляющий", "client": "Кафе «Лист»", "text": "Пришлите инструкцию по разборке, сами починим, чтобы не ждать инженера."},
    {"code": "З-09", "time": "16.11 09:18", "channel": "Звонок", "sender": "Кафе «Ромашка», владелец", "client": "Кафе «Ромашка»", "text": "Купили машину с рук. Марку и серийный номер пока не нашли, нужна прокладка."},
    {"code": "З-10", "time": "16.11 09:25", "channel": "Звонок", "sender": "Гостиница «Берег», служба питания", "client": "Гостиница «Берег»", "text": "Фото экрана сделать не можем. Сотрудник на месте прочитает код диспетчеру по телефону после 11:00."},
    {"code": "З-11", "time": "16.11 09:34", "channel": "Почта", "sender": "Кафе «Маяк», бариста", "client": "Кафе «Маяк»", "text": "Снова капает из-под группы, как перед прошлым ремонтом."},
    {"code": "З-12", "time": "16.11 09:40", "channel": "Мессенджер", "sender": "Кафе «Кедр», администратор", "client": "Кафе «Кедр»", "text": "Повторяю заявку о течи по серийному 205, ответа пока нет."},
    {"code": "З-13", "time": "16.11 09:52", "channel": "Почта", "sender": "Гостиница «Север», завхоз", "client": "Гостиница «Север»", "text": "Машина 207 работает нормально. Хотим заменить фильтр, как советовал инженер."},
    {"code": "З-14", "time": "16.11 10:05", "channel": "Звонок", "sender": "Ресторан «Пирс», шеф-бариста", "client": "Ресторан «Пирс»", "text": "Машину поставили в начале месяца. Пар из крана идёт слабо, кофе нормальный."},
    {"code": "З-15", "time": "16.11 10:16", "channel": "Почта", "sender": "Кофейня «Сквер», бариста", "client": "Кофейня «Сквер»", "text": "Машина 214 снова гудит при приготовлении, как в августе. Наверное, опять тот узел."},
    {"code": "З-16", "time": "16.11 10:27", "channel": "Мессенджер", "sender": "Кафе «Парк», управляющий", "client": "Кафе «Парк»", "text": "Летом уже меняли датчик уровня. Если это снова он, привезите сразу."},
    {"code": "З-17", "time": "16.11 10:40", "channel": "Почта", "sender": "Пекарня «Зерно», офис", "client": "Пекарня «Зерно»", "text": "Уточняю: напор слабый на Садовой. На Ленина всё в порядке."},
    {"code": "З-18", "time": "16.11 10:55", "channel": "Звонок", "sender": "Гостиница «Север», ресепшн", "client": "Гостиница «Север»", "text": "Вторая машина в баре, номер 270, течёт из-под поддона."},
    {"code": "З-19", "time": "16.11 11:15", "channel": "Звонок", "sender": "Гостиница «Берег», служба питания", "client": "Гостиница «Берег»", "text": "Сотрудник прочитал код на экране: E07."},
    {"code": "З-20", "time": "16.11 11:25", "channel": "Звонок", "sender": "Кафе «Ромашка», владелец", "client": "Кафе «Ромашка»", "text": "Нашли шильдик: C200, номер 230. Договора с вами пока нет."},
    {"code": "З-21", "time": "16.11 11:26", "channel": "Почта", "sender": "Кафе «Маяк», бариста", "client": "Кафе «Маяк»", "text": "На экране ещё появился код E11."},
    {"code": "З-22", "time": "16.11 11:28", "channel": "Звонок", "sender": "Пекарня «Зерно», офис", "client": "Пекарня «Зерно»", "text": "Теперь на Ленина E03, вода в баке есть."},
    {"code": "З-23", "time": "16.11 11:29", "channel": "Мессенджер", "sender": "Кафе «Кедр», бариста", "client": "Кафе «Кедр»", "text": "И ещё на 205 слабый пар, молоко не греется."},
]

# Logical thread definitions grouping requests per Rule П-3
THREAD_DEFINITIONS = [
    {
        "thread_number": 1,
        "client_name": "Кафе «Кедр»",
        "equipment_code": "EQ02",
        "request_codes": ["З-01", "З-06", "З-12", "З-23"],
        "channel": "Мессенджер",
        "status": "ready_for_order"
    },
    {
        "thread_number": 2,
        "client_name": "Гостиница «Берег»",
        "equipment_code": "EQ03",
        "request_codes": ["З-02", "З-10", "З-19"],
        "channel": "Звонок",
        "status": "ready_for_order"
    },
    {
        "thread_number": 3,
        "client_name": "Кафе «Лист»",
        "equipment_code": "EQ04",
        "request_codes": ["З-03", "З-08"],
        "channel": "Почта",
        "status": "needs_clarification"
    },
    {
        "thread_number": 4,
        "client_name": "Кафе «Парк»",
        "equipment_code": "EQ05",
        "request_codes": ["З-04", "З-16"],
        "channel": "Почта",
        "status": "ready_for_order"
    },
    {
        "thread_number": 5,
        "client_name": "Кафе «Угол»",
        "equipment_code": "EQ06",
        "request_codes": ["З-05"],
        "channel": "Звонок",
        "status": "ready_for_order"
    },
    {
        "thread_number": 6,
        "client_name": "Пекарня «Зерно»",
        "equipment_code": "EQ08",  # Садовая, 4
        "request_codes": ["З-07", "З-17"],
        "channel": "Почта",
        "status": "ready_for_order"
    },
    {
        "thread_number": 7,
        "client_name": "Кафе «Ромашка»",
        "equipment_code": None,  # Not in registry
        "request_codes": ["З-09", "З-20"],
        "channel": "Звонок",
        "status": "sales_transfer"
    },
    {
        "thread_number": 8,
        "client_name": "Кафе «Маяк»",
        "equipment_code": "EQ10",
        "request_codes": ["З-11", "З-21"],
        "channel": "Почта",
        "status": "ready_for_order"
    },
    {
        "thread_number": 9,
        "client_name": "Гостиница «Север»",
        "equipment_code": "EQ11",  # №207
        "request_codes": ["З-13"],
        "channel": "Почта",
        "status": "ready_for_order"
    },
    {
        "thread_number": 10,
        "client_name": "Ресторан «Пирс»",
        "equipment_code": "EQ12",
        "request_codes": ["З-14"],
        "channel": "Звонок",
        "status": "ready_for_order"
    },
    {
        "thread_number": 11,
        "client_name": "Кофейня «Сквер»",
        "equipment_code": "EQ07",
        "request_codes": ["З-15"],
        "channel": "Почта",
        "status": "ready_for_order"
    },
    {
        "thread_number": 12,
        "client_name": "Гостиница «Север»",
        "equipment_code": None,  # №270 is missing in registry
        "request_codes": ["З-18"],
        "channel": "Звонок",
        "status": "needs_clarification"
    },
    {
        "thread_number": 13,
        "client_name": "Пекарня «Зерно»",
        "equipment_code": "EQ09",  # пр. Ленина, 18
        "request_codes": ["З-22"],
        "channel": "Звонок",
        "status": "ready_for_order"
    }
]

def seed_database(db: Session, excel_path: str = "Данные_к_кейсу_06.xlsx"):
    """
    Clears and seeds all initial data: users, equipment, parts, threads, messages.
    """
    # 1. Clean existing records in dependency order
    db.query(ServiceOrder).delete()
    db.query(Message).delete()
    db.query(ClientThread).delete()
    db.query(SparePart).delete()
    db.query(Equipment).delete()
    db.query(User).delete()
    db.commit()

    # 2. Seed Users
    hashed_pwd = get_password_hash("password123")
    users = [
        User(
            email="dispatcher@kofeservice.ru",
            full_name="Анна Соколова",
            role="dispatcher",
            city="Москва",
            is_senior=False,
            qualifications=["C100", "C200", "C300"],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Anna",
            hashed_password=hashed_pwd
        ),
        User(
            email="ivanov@kofeservice.ru",
            full_name="Алексей Иванов",
            role="engineer",
            city="Москва",
            is_senior=False,
            qualifications=["C100", "C200", "C300"],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Alex",
            hashed_password=hashed_pwd
        ),
        User(
            email="petrov@kofeservice.ru",
            full_name="Дмитрий Петров",
            role="engineer",
            city="Москва",
            is_senior=False,
            qualifications=["C100", "C200"],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Dmitry",
            hashed_password=hashed_pwd
        ),
        User(
            email="smirnov@kofeservice.ru",
            full_name="Сергей Смирнов",
            role="engineer",
            city="Тула",
            is_senior=False,
            qualifications=["C100", "C200", "C300"],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Sergey",
            hashed_password=hashed_pwd
        ),
        User(
            email="kozlov@kofeservice.ru",
            full_name="Павел Козлов",
            role="engineer",
            city="Тула",
            is_senior=False,
            qualifications=["C100", "C200"],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Pavel",
            hashed_password=hashed_pwd
        ),
        # Company accounts (clients)
        User(
            email="client_kedr@kofeservice.ru",
            full_name="Кафе «Кедр»",
            role="company",
            city="Москва",
            is_senior=False,
            qualifications=[],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Kedr",
            hashed_password=hashed_pwd
        ),
        User(
            email="client_bereg@kofeservice.ru",
            full_name="Гостиница «Берег»",
            role="company",
            city="Тула",
            is_senior=False,
            qualifications=[],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Bereg",
            hashed_password=hashed_pwd
        ),
        User(
            email="client_zerno@kofeservice.ru",
            full_name="Пекарня «Зерно»",
            role="company",
            city="Москва",
            is_senior=False,
            qualifications=[],
            avatar_url="https://api.dicebear.com/7.x/notionists/svg?seed=Zerno",
            hashed_password=hashed_pwd
        ),
    ]
    db.add_all(users)
    db.commit()

    # 3. Seed Equipment
    eq_objs = {}
    for eq_data in EQUIPMENT_DATA:
        eq = Equipment(**eq_data)
        db.add(eq)
        db.flush()
        eq_objs[eq.code] = eq
    db.commit()

    # 4. Seed Spare Parts
    for part_data in PARTS_DATA:
        sp = SparePart(**part_data)
        db.add(sp)
    db.commit()

    # Map raw requests by code
    requests_map = {r["code"]: r for r in RAW_REQUESTS}

    # 5. Seed Threads and Messages
    for t_def in THREAD_DEFINITIONS:
        eq = eq_objs.get(t_def["equipment_code"]) if t_def["equipment_code"] else None

        # Check warranty
        is_warranty = False
        warranty_reason = None
        if eq:
            # Aggregate messages to check warranty
            msgs_text = " ".join([requests_map[c]["text"] for c in t_def["request_codes"] if c in requests_map])
            is_warranty, warranty_reason = RulesEngine.check_warranty(
                eq.installation_date,
                eq.last_visit_date,
                eq.last_visit_result,
                msgs_text
            )

        thread = ClientThread(
            thread_number=t_def["thread_number"],
            client_name=t_def["client_name"],
            equipment_id=eq.id if eq else None,
            equipment_code=eq.code if eq else None,
            status=t_def["status"],
            channel=t_def["channel"],
            is_warranty=is_warranty,
            warranty_reason=warranty_reason,
            is_unregistered=(eq is None and ("ромашка" in t_def["client_name"].lower() or t_def["thread_number"] == 12)),
            last_activity=datetime(2026, 11, 16, 11, 29)
        )
        db.add(thread)
        db.flush()

        # Add messages for this thread
        for req_code in t_def["request_codes"]:
            req = requests_map.get(req_code)
            if req:
                # Parse hour and minute from '16.11 08:05'
                time_parts = req["time"].split(" ")[1].split(":")
                msg_time = datetime(2026, 11, 16, int(time_parts[0]), int(time_parts[1]))

                msg = Message(
                    thread_id=thread.id,
                    request_code=req["code"],
                    channel=req["channel"],
                    sender_type="client",
                    sender_name=req["sender"],
                    content=req["text"],
                    created_at=msg_time
                )
                db.add(msg)

    db.commit()
    return {
        "status": "success",
        "message": "База данных успешно заполнена исходными данными: 5 пользователей, 12 единиц оборудования, 10 запчастей, 13 веток обращений (23 утренних сообщения)."
    }

