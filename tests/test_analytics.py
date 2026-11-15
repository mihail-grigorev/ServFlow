import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Event, ClientThread, ServiceOrder, SparePart
from backend.auth import create_access_token
from backend.seed import seed_database
from backend.analytics import (
    track_event,
    get_analytics_summary,
    get_analytics_timeseries,
    sync_events_to_clickhouse
)
from backend.cli import generate_synthetic_events

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
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()
    app.dependency_overrides.clear()


def test_track_event_and_persistence(db_session):
    """
    Verifies that track_event correctly writes events to the events table.
    """
    events_count_before = db_session.query(Event).count()

    track_event(
        event_type="ai_analysis",
        thread_id=1,
        user_id=1,
        company_id="comp_kedr",
        payload={"source": "gemini", "latency_ms": 125.4, "rules_triggered": ["П-9", "П-4"]},
        db=db_session
    )

    db_session.expire_all()
    events_count_after = db_session.query(Event).count()
    assert events_count_after == events_count_before + 1

    last_event = db_session.query(Event).order_by(Event.id.desc()).first()
    assert last_event.type == "ai_analysis"
    assert last_event.thread_id == 1
    assert last_event.payload.get("source") == "gemini"
    assert last_event.payload.get("latency_ms") == 125.4
    assert last_event.synced_to_ch is False


def test_analytics_endpoints_permissions(client, db_session):
    """
    Verifies that analytics endpoints are strictly protected:
    - 401 Unauthorized for unauthenticated requests
    - 403 Forbidden for engineers and company accounts
    - 200 OK for dispatchers
    """
    # 1. Unauthenticated request
    r_unauth = client.get("/api/analytics/summary")
    assert r_unauth.status_code == 401

    # 2. Engineer request
    eng = db_session.query(User).filter(User.role == "engineer").first()
    eng_token = create_access_token(data={"sub": eng.email, "role": eng.role, "v": eng.token_version or 1})
    r_eng = client.get("/api/analytics/summary", headers={"Authorization": f"Bearer {eng_token}"})
    assert r_eng.status_code == 403

    # 3. Company request
    comp = db_session.query(User).filter(User.role == "company").first()
    comp_token = create_access_token(data={"sub": comp.email, "role": comp.role, "v": comp.token_version or 1})
    r_comp = client.get("/api/analytics/summary", headers={"Authorization": f"Bearer {comp_token}"})
    assert r_comp.status_code == 403

    # 4. Dispatcher request
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    r_disp = client.get("/api/analytics/summary", headers={"Authorization": f"Bearer {disp_token}"})
    assert r_disp.status_code == 200


def test_analytics_summary_data_structure(client, db_session):
    """
    Validates structure and calculations of /api/analytics/summary.
    """
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    res = client.get("/api/analytics/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "avoided_empty_visits" in data
    assert isinstance(data["avoided_empty_visits"], int)
    assert "auto_handled_ratio" in data
    assert isinstance(data["auto_handled_ratio"], (int, float))
    assert "total_threads" in data
    assert isinstance(data["total_threads"], int)

    # AI latency p50/p95
    assert "ai_latency" in data
    assert "p50_ms" in data["ai_latency"]
    assert "p95_ms" in data["ai_latency"]

    # Rules frequency П-1...П-10
    assert "rules_frequency" in data
    rules = data["rules_frequency"]
    for i in range(1, 11):
        assert f"П-{i}" in rules, f"Rule П-{i} missing from rules_frequency"

    # Parts deficit list
    assert "parts_deficit" in data
    assert isinstance(data["parts_deficit"], list)
    for p in data["parts_deficit"]:
        assert "code" in p
        assert "name" in p
        assert "moscow_free" in p
        assert "tula_free" in p

    # Audience demo requests
    assert "demo_requests_count" in data
    assert isinstance(data["demo_requests_count"], int)
    assert "qr_logins_count" in data
    assert isinstance(data["qr_logins_count"], int)


def test_analytics_timeseries_structure(client, db_session):
    """
    Validates structure of /api/analytics/timeseries.
    """
    disp = db_session.query(User).filter(User.role == "dispatcher").first()
    disp_token = create_access_token(data={"sub": disp.email, "role": disp.role, "v": disp.token_version or 1})
    headers = {"Authorization": f"Bearer {disp_token}"}

    res = client.get("/api/analytics/timeseries", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "daily_trend" in data
    assert isinstance(data["daily_trend"], list)
    assert len(data["daily_trend"]) >= 7

    first_day = data["daily_trend"][0]
    assert "date" in first_day
    assert "tickets" in first_day
    assert "orders" in first_day

    assert "rules_distribution" in data
    assert isinstance(data["rules_distribution"], list)
    assert len(data["rules_distribution"]) == 10


def test_clickhouse_fallback_and_sync_graceful(db_session):
    """
    Verifies that when ClickHouse is absent, sync_events_to_clickhouse returns 0
    without raising an unhandled exception or breaking the system.
    """
    synced = sync_events_to_clickhouse(batch_size=50)
    assert synced == 0

    # Summary and timeseries work normally via fallback
    sum_res = get_analytics_summary(db_session)
    assert sum_res is not None
    assert sum_res["ch_active"] is False

    time_res = get_analytics_timeseries(db_session)
    assert time_res is not None
    assert len(time_res["daily_trend"]) > 0
