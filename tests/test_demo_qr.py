import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Equipment, SparePart, ClientThread, Message, ServiceOrder, DemoQrToken
from backend.auth import get_password_hash, create_access_token
from backend.config import settings
from backend.seed import seed_database
import backend.routers.demo as demo_router

# Setup test in-memory SQLite DB
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


def test_demo_config(client):
    settings.DEMO_MODE = True
    resp = client.get("/api/demo/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["demo_mode"] is True
    assert "public_base_url" in data


def test_demo_companies_auth(client, db_session):
    # Unauthenticated
    resp = client.get("/api/demo/companies")
    assert resp.status_code == 401

    # Engineer role forbidden
    eng = db_session.query(User).filter(User.role == "engineer").first()
    eng_token = create_access_token(data={"sub": eng.email, "role": eng.role, "v": eng.token_version or 1})
    resp = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {eng_token}"})
    assert resp.status_code == 403

    # Dispatcher allowed
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    resp = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {disp_token}"})
    assert resp.status_code == 200
    companies = resp.json()
    assert len(companies) > 0
    first = companies[0]
    assert "company_id" in first
    assert "company_name" in first
    assert "qr_svg" in first
    assert "<svg" in first["qr_svg"]
    assert "token" in first
    assert "url" in first


def test_qr_exchange_and_company_scope(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    resp = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {disp_token}"})
    companies = resp.json()
    kedr = next(c for c in companies if c["company_id"] == "comp_kedr")

    # Invalid token
    resp = client.post("/api/demo/exchange", json={"token": "invalid_token_12345"})
    assert resp.status_code == 401

    # Valid exchange
    resp = client.post("/api/demo/exchange", json={"token": kedr["token"]})
    assert resp.status_code == 200
    auth_data = resp.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["role"] == "company"
    assert auth_data["user"]["company_id"] == "comp_kedr"

    comp_token = auth_data["access_token"]

    # Verify IDOR: Kedr can view its own threads, but cannot view another company's
    resp = client.get("/api/threads", headers={"Authorization": f"Bearer {comp_token}"})
    assert resp.status_code == 200
    threads = resp.json()
    assert all(t["company_id"] == "comp_kedr" or "Кедр" in t["client_name"] for t in threads)


def test_verify_staff_pin(client):
    # Bad PIN
    resp = client.post("/api/demo/verify-staff-pin", json={"pin": "wrong-pin"})
    assert resp.status_code == 400

    # Correct PIN
    resp = client.post("/api/demo/verify-staff-pin", json={"pin": "1997"})
    assert resp.status_code == 200
    assert resp.json()["valid"] is True

    resp2 = client.post("/api/demo/verify-staff-pin", json={"pin": "2026"})
    assert resp2.status_code == 200
    assert resp2.json()["valid"] is True


def test_audience_anti_spam(client, db_session):
    import backend.routers.threads as threads_router
    orig_auto_reply = threads_router.AUTO_REPLY_ENABLED
    threads_router.AUTO_REPLY_ENABLED = False
    try:
        # Exchange token for comp_kedr
        disp = db_session.query(User).filter(User.role == "dispatcher").first()
        disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
        resp = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {disp_token}"})
        kedr = next(c for c in resp.json() if c["company_id"] == "comp_kedr")

        resp = client.post("/api/demo/exchange", json={"token": kedr["token"]})
        comp_token = resp.json()["access_token"]

        # 1. Message > 1000 characters
        long_text = "А" * 1001
        resp = client.post(
            "/api/threads",
            json={"content": long_text},
            headers={"Authorization": f"Bearer {comp_token}"}
        )
        assert resp.status_code == 400

        # 2. Rate limit: post messages
        # Fetch a thread for kedr
        threads = client.get("/api/threads", headers={"Authorization": f"Bearer {comp_token}"}).json()
        thread_id = threads[0]["id"]

        for i in range(10):
            r = client.post(
                f"/api/threads/{thread_id}/messages",
                json={"content": f"Тестовое сообщение {i}"},
                headers={"Authorization": f"Bearer {comp_token}"}
            )
            assert r.status_code == 200

        # 11th message must be rejected with 429
        r11 = client.post(
            f"/api/threads/{thread_id}/messages",
            json={"content": "Превышение лимита"},
            headers={"Authorization": f"Bearer {comp_token}"}
        )
        assert r11.status_code == 429
    finally:
        threads_router.AUTO_REPLY_ENABLED = orig_auto_reply


def test_qr_revoke_and_reissue(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})

    # Get current token
    comps = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {disp_token}"}).json()
    token_before = comps[0]["token"]

    # Revoke all
    resp = client.post("/api/demo/qr/revoke-all", headers={"Authorization": f"Bearer {disp_token}"})
    assert resp.status_code == 200

    # Exchange with old token must now fail with 401
    resp = client.post("/api/demo/exchange", json={"token": token_before})
    assert resp.status_code == 401

    # Reissue all
    resp = client.post("/api/demo/qr/issue-all", headers={"Authorization": f"Bearer {disp_token}"})
    assert resp.status_code == 200

    # Get new tokens
    comps_new = client.get("/api/demo/companies", headers={"Authorization": f"Bearer {disp_token}"}).json()
    token_after = comps_new[0]["token"]
    assert token_after != token_before

    # Exchange with new token succeeds
    resp = client.post("/api/demo/exchange", json={"token": token_after})
    assert resp.status_code == 200


def test_reset_demo_data(client, db_session):
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})

    # Call reset demo data
    resp = client.post("/api/demo/reset-data", headers={"Authorization": f"Bearer {disp_token}"})
    assert resp.status_code == 200

    # Verify baseline state (13 threads)
    threads = client.get("/api/threads", headers={"Authorization": f"Bearer {disp_token}"}).json()
    assert len(threads) == 13

    # Users and demo tokens are intact
    assert db_session.query(User).count() > 10


def test_demo_mode_disabled(client):
    try:
        settings.DEMO_MODE = False
        resp = client.get("/api/demo/config")
        assert resp.status_code == 404

        resp = client.get("/api/demo/companies")
        assert resp.status_code == 404

        resp = client.post("/api/demo/exchange", json={"token": "some_token"})
        assert resp.status_code == 404

        resp = client.post("/api/demo/verify-staff-pin", json={"pin": "2026"})
        assert resp.status_code == 404
    finally:
        settings.DEMO_MODE = True
