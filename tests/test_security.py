import pytest
import io
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.seed import seed_database
from backend.models import User, ClientThread, Equipment, ServiceOrder, VerificationCode
from backend.email_service import generate_verification_code, hash_verification_code
from backend.config import settings

@pytest.fixture(scope="module")
def sec_db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    return engine, TestingSessionLocal

@pytest.fixture
def client(sec_db_engine):
    engine, TestingSessionLocal = sec_db_engine

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def get_token(client, email, password="password123"):
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def test_unauthenticated_requests_return_401(client):
    """K1/K5: Protected endpoints must return 401 Unauthorized without token."""
    protected_endpoints = [
        ("GET", "/api/equipment"),
        ("GET", "/api/parts"),
        ("GET", "/api/threads"),
        ("POST", "/api/orders"),
        ("POST", "/api/ai/analyze-thread/1"),
        ("POST", "/api/seed/reset"),
    ]
    for method, url in protected_endpoints:
        if method == "GET":
            r = client.get(url)
        else:
            r = client.post(url, json={})
        assert r.status_code == 401, f"{method} {url} returned {r.status_code}, expected 401"


def test_company_idor_scoping_threads_and_equipment(client):
    """K6: Company A cannot see or manipulate threads or equipment of Company B."""
    token_kedr = get_token(client, "client_kedr@kofeservice.ru")
    headers_kedr = {"Authorization": f"Bearer {token_kedr}"}

    # 1. Threads list: only Kedr threads returned
    r_threads = client.get("/api/threads", headers=headers_kedr)
    assert r_threads.status_code == 200
    threads = r_threads.json()
    assert len(threads) > 0
    for t in threads:
        assert "Кедр" in t["client_name"], f"Company Kedr saw thread of: {t['client_name']}"

    # 2. Get specific thread belonging to another client (Thread 2 = Берег) -> returns 404
    token_disp = get_token(client, "dispatcher@kofeservice.ru")
    disp_threads = client.get("/api/threads", headers={"Authorization": f"Bearer {token_disp}"}).json()
    bereg_thread = next(t for t in disp_threads if "Берег" in t["client_name"])

    r_idor_thread = client.get(f"/api/threads/{bereg_thread['id']}", headers=headers_kedr)
    assert r_idor_thread.status_code == 404, f"Expected 404 on IDOR thread access, got {r_idor_thread.status_code}"

    # 3. Post message to foreign thread -> returns 404
    r_post_msg = client.post(
        f"/api/threads/{bereg_thread['id']}/messages",
        json={"content": "Hacked message"},
        headers=headers_kedr
    )
    assert r_post_msg.status_code == 404

    # 4. Equipment scoping: Kedr sees only EQ01 and EQ02
    r_eq = client.get("/api/equipment", headers=headers_kedr)
    assert r_eq.status_code == 200
    eqs = r_eq.json()
    assert len(eqs) == 2
    for eq in eqs:
        assert "Кедр" in eq["client_name"]

    # 5. Accessing foreign equipment EQ03 (Bereg) directly -> returns 404
    r_idor_eq = client.get("/api/equipment/EQ03", headers=headers_kedr)
    assert r_idor_eq.status_code == 404


def test_registration_ignores_role_elevation(client, sec_db_engine):
    """K4: Self-registration strictly creates company role, ignoring elevated roles/privileges."""
    _, TestingSessionLocal = sec_db_engine
    db = TestingSessionLocal()

    test_email = "hacker@test.ru"
    code = generate_verification_code()
    code_hash = hash_verification_code(test_email, code)

    vcode = VerificationCode(
        email=test_email,
        code=code,
        code_hash=code_hash,
        purpose="register",
        expires_at=settings.SYSTEM_REFERENCE_DATE + pytest.importorskip("datetime").timedelta(days=1),
        is_used=False
    )
    db.add(vcode)
    db.commit()
    db.close()

    reg_payload = {
        "email": test_email,
        "full_name": "ООО «Тест»",
        "password": "securepassword123",
        "code": code,
        "role": "dispatcher",
        "is_senior": True,
        "qualifications": ["C100", "C200", "C300"]
    }
    r = client.post("/api/auth/register", json=reg_payload)
    assert r.status_code == 200
    user_data = r.json()["user"]
    assert user_data["role"] == "company", f"Expected role 'company', got {user_data['role']}"
    assert user_data["is_senior"] is False, "is_senior should not be elevated via registration"
    assert user_data["qualifications"] == [], "qualifications should be empty for company"


def test_avatar_upload_rejects_svg_and_non_images(client):
    """B4: Avatar upload strictly rejects SVG files and verifies real image headers."""
    token = get_token(client, "dispatcher@kofeservice.ru")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Reject SVG
    svg_content = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>"
    r_svg = client.post(
        "/api/auth/avatar",
        files={"file": ("avatar.svg", svg_content, "image/svg+xml")},
        headers=headers
    )
    assert r_svg.status_code == 400
    assert "SVG" in r_svg.json()["detail"]

    # 2. Reject fake PNG (plain text disguised as PNG)
    fake_png = b"NOT AN IMAGE FILE"
    r_fake = client.post(
        "/api/auth/avatar",
        files={"file": ("avatar.png", fake_png, "image/png")},
        headers=headers
    )
    assert r_fake.status_code == 400

    # 3. Accept valid PNG and convert to WebP
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color="blue")
    img.save(buf, format="PNG")
    buf.seek(0)

    r_valid = client.post(
        "/api/auth/avatar",
        files={"file": ("avatar.png", buf.getvalue(), "image/png")},
        headers=headers
    )
    assert r_valid.status_code == 200
    assert r_valid.json()["avatar_url"].endswith(".webp")


def test_p2_unregistered_machine_has_no_recommended_parts(client):
    """P-2: For unregistered clients/machines, analysis recommended_parts must be empty []."""
    token = get_token(client, "dispatcher@kofeservice.ru")
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate request for unregistered machine (Ромашка #230)
    sim_r = client.post(
        "/api/threads/simulate",
        json={
            "client_name": "Кафе «Ромашка»",
            "content": "Купили с рук C200 №230, течёт вода из группы",
            "channel": "Звонок"
        },
        headers=headers
    )
    assert sim_r.status_code == 200
    sim_thread = sim_r.json()
    assert sim_thread["is_unregistered"] is True

    # Run AI analysis on this thread
    ai_r = client.post(f"/api/ai/analyze-thread/{sim_thread['id']}", headers=headers)
    assert ai_r.status_code == 200
    ai_data = ai_r.json()
    assert ai_data["is_unregistered_machine"] is True
    assert ai_data["recommended_parts"] == [], f"Expected empty parts for unregistered machine, got {ai_data['recommended_parts']}"


def test_seed_reset_forbidden_without_demo_mode_or_non_dispatcher(client):
    """K3: seed/reset is forbidden for non-dispatchers and when DEMO_MODE=false."""
    token_eng = get_token(client, "ivanov@kofeservice.ru")
    r_eng = client.post("/api/seed/reset", headers={"Authorization": f"Bearer {token_eng}"})
    assert r_eng.status_code == 403

    token_disp = get_token(client, "dispatcher@kofeservice.ru")
    # Temporarily disable DEMO_MODE
    orig_mode = settings.DEMO_MODE
    try:
        settings.DEMO_MODE = False
        r_no_demo = client.post("/api/seed/reset", headers={"Authorization": f"Bearer {token_disp}"})
        assert r_no_demo.status_code == 403
    finally:
        settings.DEMO_MODE = orig_mode
