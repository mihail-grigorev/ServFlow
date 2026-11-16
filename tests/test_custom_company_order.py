import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, ServiceOrder
from backend.auth import create_access_token
from backend.seed import seed_database

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
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def test_create_order_for_nonexistent_company(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    eng = db_session.query(User).filter(User.role == "engineer").first()

    custom_company_name = "Кофейня «Северное Сияние»"
    custom_address = "Москва, ул. Покровка, 18"

    payload = {
        "client_name": custom_company_name,
        "equipment_code": None,
        "address": custom_address,
        "model": "C200",
        "serial_number": "SN-99988",
        "symptom": "Шумит помпа при проливе",
        "engineer_id": eng.id,
        "reserved_parts": [{"code": "P120", "quantity": 1, "source_city": "Москва", "transfer_required": False}]
    }

    # Verify company does NOT exist before creation
    db = TestingSessionLocal()
    comp_before = db.query(User).filter(User.full_name == custom_company_name).first()
    assert comp_before is None
    db.close()

    # Create order
    res = client.post("/api/orders", json=payload, headers=headers)
    assert res.status_code == 200, f"Order creation failed: {res.text}"
    order_data = res.json()
    assert order_data["client_name"] == custom_company_name
    assert order_data["equipment_code"] is None
    assert order_data["model"] == "C200"
    assert order_data["serial_number"] == "SN-99988"
    assert order_data["address"] == custom_address

    # Verify company user account was auto-provisioned
    db = TestingSessionLocal()
    comp_after = db.query(User).filter(User.full_name == custom_company_name).first()
    assert comp_after is not None
    assert comp_after.role == "company"
    assert comp_after.company_id is not None
    db.close()
