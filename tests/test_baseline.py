import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.seed import seed_database
from backend.models import User

# In-memory SQLite with StaticPool so all connections share the same memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine

@pytest.fixture(scope="function")
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = Session()

    seed_database(session)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def dispatcher_auth_headers(client):
    r = client.post("/api/auth/login", json={"email": "dispatcher@kofeservice.ru", "password": "password123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert "reference_date" in data

def test_equipment_count_and_schema_snapshot(client, dispatcher_auth_headers):
    r = client.get("/api/equipment", headers=dispatcher_auth_headers)
    assert r.status_code == 200
    eq_list = r.json()
    assert len(eq_list) == 12

    # Snapshot check of required fields and types
    first = eq_list[0]
    expected_fields = {"id", "code", "client_name", "address", "city", "model", "serial_number", "installation_date"}
    assert expected_fields.issubset(set(first.keys()))
    assert isinstance(first["code"], str)
    assert isinstance(first["model"], str)
    assert isinstance(first["serial_number"], str)

def test_parts_count_and_schema_snapshot(client, dispatcher_auth_headers):
    r = client.get("/api/parts", headers=dispatcher_auth_headers)
    assert r.status_code == 200
    parts_list = r.json()
    assert len(parts_list) == 10

    # Snapshot check of fields
    first = parts_list[0]
    expected_fields = {"id", "code", "name", "compatible_models", "moscow_stock", "moscow_reserved", "moscow_free", "tula_stock", "tula_reserved", "tula_free"}
    assert expected_fields.issubset(set(first.keys()))
    assert isinstance(first["code"], str)
    assert isinstance(first["compatible_models"], list)

def test_threads_count_and_schema_snapshot(client, dispatcher_auth_headers):
    r = client.get("/api/threads", headers=dispatcher_auth_headers)
    assert r.status_code == 200
    threads_list = r.json()
    assert len(threads_list) == 13

    # Snapshot check
    first = threads_list[0]
    expected_fields = {"id", "thread_number", "client_name", "channel", "status", "is_warranty", "is_unregistered", "messages"}
    assert expected_fields.issubset(set(first.keys()))
    assert isinstance(first["thread_number"], int)
    assert isinstance(first["messages"], list)

def test_ai_analysis_piers_warranty_rule_p9(client, dispatcher_auth_headers):
    r_threads = client.get("/api/threads", headers=dispatcher_auth_headers)
    threads = r_threads.json()
    piers_thread = next(t for t in threads if "Пирс" in t["client_name"])

    r_ai = client.post(f"/api/ai/analyze-thread/{piers_thread['id']}", headers=dispatcher_auth_headers)
    assert r_ai.status_code == 200
    ai_res = r_ai.json()

    # Snapshot of AI analysis fields
    expected_ai_fields = {
        "detected_equipment_code", "is_warranty", "warranty_reason",
        "recommended_parts", "draft_symptom", "reply_to_client"
    }
    assert expected_ai_fields.issubset(set(ai_res.keys()))
    assert ai_res["is_warranty"] is True
    assert ai_res["detected_equipment_code"] == "EQ12"
    assert len(ai_res["recommended_parts"]) >= 1

def test_order_lifecycle_and_schema_snapshot(client, dispatcher_auth_headers, db_session):
    # 1. Find Piers thread
    r_threads = client.get("/api/threads", headers=dispatcher_auth_headers)
    piers_thread = next(t for t in r_threads.json() if "Пирс" in t["client_name"])

    # 2. Get engineer Ivanov
    ivanov = db_session.query(User).filter(User.full_name.ilike("%Иванов%")).first()
    assert ivanov is not None

    # 3. Create Service Order
    order_payload = {
        "thread_id": piers_thread["id"],
        "client_name": "Ресторан «Пирс»",
        "equipment_code": "EQ12",
        "address": "Москва, Пресненская наб., 6",
        "model": "C100",
        "serial_number": "133",
        "symptom": "Слабый напор пара из парового крана",
        "client_assumption": "Замечание шеф-бариста",
        "is_warranty": True,
        "warranty_reason": "До 40 дней после прошлого визита",
        "is_sales_transfer": False,
        "engineer_id": ivanov.id,
        "reserved_parts": [{"code": "S100", "name": "Ремкомплект парового крана", "quantity": 1, "source_city": "Тула", "transfer_required": True}]
    }

    r_order = client.post("/api/orders", json=order_payload, headers=dispatcher_auth_headers)
    assert r_order.status_code == 200, f"Order creation failed: {r_order.text}"
    order_data = r_order.json()
    order_id = order_data["id"]

    # Order schema snapshot
    expected_order_fields = {
        "id", "order_number", "thread_id", "client_name", "equipment_code",
        "address", "model", "serial_number", "symptom", "status", "engineer_id", "reserved_parts"
    }
    assert expected_order_fields.issubset(set(order_data.keys()))
    assert order_data["order_number"].startswith("ORD-")
    assert order_data["status"] == "Назначен"

    # 4. Status update
    r_status = client.patch(f"/api/orders/{order_id}/status", json={"status": "В пути"}, headers=dispatcher_auth_headers)
    assert r_status.status_code == 200
    assert r_status.json()["status"] == "В пути"

    # 5. Inspection report
    r_eng = client.post("/api/auth/login", json={"email": ivanov.email, "password": "password123"})
    assert r_eng.status_code == 200
    eng_token = r_eng.json()["access_token"]
    eng_headers = {"Authorization": f"Bearer {eng_token}"}

    r_report = client.post(
        f"/api/orders/{order_id}/report",
        json={"inspection_report": "Осмотр выполнен. Произведена замена уплотнителей крана (S100). Пар в норме."},
        headers=eng_headers
    )
    assert r_report.status_code == 200
    assert r_report.json()["status"] == "Выполнен"

def test_simulator_rule_p2_unregistered_machine(client, dispatcher_auth_headers):
    r_sim = client.post(
        "/api/threads/simulate",
        json={
            "client_name": "Кафе «Ромашка»",
            "content": "Купили с рук C200 №230, течёт вода",
            "channel": "Звонок"
        },
        headers=dispatcher_auth_headers
    )
    assert r_sim.status_code == 200
    sim_data = r_sim.json()
    assert sim_data["is_unregistered"] is True
    assert sim_data["status"] == "sales_transfer"
