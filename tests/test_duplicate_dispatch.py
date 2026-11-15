import pytest
import concurrent.futures
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Equipment, SparePart, ClientThread, Message, ServiceOrder
from backend.auth import create_access_token
from backend.seed import seed_database

# Setup test SQLite DB
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def test_duplicate_order_sequential_rejection(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    # Pick a fresh thread
    thread = db_session.query(ClientThread).filter(ClientThread.thread_number == 1).first()
    eng = db_session.query(User).filter(User.role == "engineer").first()

    payload = {
        "thread_id": thread.id,
        "client_name": thread.client_name,
        "equipment_code": thread.equipment_code,
        "address": "Москва, ул. Ленина, 1",
        "model": "C100",
        "serial_number": "SN-001",
        "symptom": "Проблема с насосом",
        "engineer_id": eng.id,
        "reserved_parts": [{"code": "G100", "quantity": 1, "source_city": "Москва", "transfer_required": False}]
    }

    # First attempt: succeeds
    r1 = client.post("/api/orders", json=payload, headers=headers)
    assert r1.status_code == 200, f"First order failed: {r1.text}"
    order1 = r1.json()
    assert order1["thread_id"] == thread.id

    # Second attempt: rejected with 409 Conflict
    r2 = client.post("/api/orders", json=payload, headers=headers)
    assert r2.status_code == 409, f"Expected 409, got {r2.status_code}"
    err_data = r2.json()
    assert "уже сформирована заявка" in err_data["detail"]
    assert err_data["order_number"] == order1["order_number"]
    assert err_data["order_id"] == order1["id"]


def test_insufficient_stock_rejection(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    thread = db_session.query(ClientThread).filter(ClientThread.thread_number == 2).first()
    eng = db_session.query(User).filter(User.role == "engineer").first()

    # Part P300 has only 0 free in seed or very low
    part = db_session.query(SparePart).filter(SparePart.code == "P300").first()
    free_moscow = (part.moscow_stock or 0) - (part.moscow_reserved or 0)

    # Request more than free stock
    payload = {
        "thread_id": thread.id,
        "client_name": thread.client_name,
        "equipment_code": thread.equipment_code,
        "address": "Москва, ул. Тверская, 5",
        "model": "C300",
        "serial_number": "SN-002",
        "symptom": "Замена помпы",
        "engineer_id": eng.id,
        "reserved_parts": [{"code": "P300", "quantity": free_moscow + 5, "source_city": "Москва", "transfer_required": False}]
    }

    resp = client.post("/api/orders", json=payload, headers=headers)
    assert resp.status_code == 409
    assert "Недостаточно деталей на складе" in resp.json()["detail"]


def test_order_creation_after_cancellation(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    thread = db_session.query(ClientThread).filter(ClientThread.thread_number == 3).first()
    eng = db_session.query(User).filter(User.role == "engineer").first()

    payload = {
        "thread_id": thread.id,
        "client_name": thread.client_name,
        "equipment_code": thread.equipment_code,
        "address": "Москва, ул. Арбат, 10",
        "model": "C100",
        "serial_number": "SN-003",
        "symptom": "Диагностика",
        "engineer_id": eng.id,
        "reserved_parts": []
    }

    # 1. Create order
    r1 = client.post("/api/orders", json=payload, headers=headers)
    assert r1.status_code == 200
    order1 = r1.json()

    # 2. Cancel order
    r_cancel = client.patch(f"/api/orders/{order1['id']}/status", json={"status": "Отменен"}, headers=headers)
    assert r_cancel.status_code == 200
    assert r_cancel.json()["status"] == "Отменен"

    # 3. Create new order for the same thread now succeeds
    r2 = client.post("/api/orders", json=payload, headers=headers)
    assert r2.status_code == 200
    order2 = r2.json()
    assert order2["id"] != order1["id"]
    assert order2["thread_id"] == thread.id


def test_concurrent_order_dispatch(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    thread = db_session.query(ClientThread).filter(ClientThread.thread_number == 4).first()
    eng = db_session.query(User).filter(User.role == "engineer").first()

    part_before = db_session.query(SparePart).filter(SparePart.code == "V010").first()
    moscow_res_before = part_before.moscow_reserved

    payload = {
        "thread_id": thread.id,
        "client_name": thread.client_name,
        "equipment_code": thread.equipment_code,
        "address": "Москва, Садовая, 1",
        "model": "C200",
        "serial_number": "SN-004",
        "symptom": "Течь клапана",
        "engineer_id": eng.id,
        "reserved_parts": [{"code": "V010", "quantity": 1, "source_city": "Москва", "transfer_required": False}]
    }

    def try_create():
        return client.post("/api/orders", json=payload, headers=headers)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(try_create)
        f2 = executor.submit(try_create)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.status_code, res2.status_code]
    assert 200 in statuses, "At least one concurrent request must succeed"
    assert 409 in statuses, "The duplicate concurrent request must receive 409 Conflict"

    # Verify part was reserved exactly once (+1)
    db_session.expire_all()
    part_after = db_session.query(SparePart).filter(SparePart.code == "V010").first()
    assert part_after.moscow_reserved == moscow_res_before + 1

