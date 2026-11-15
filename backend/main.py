import os
import uuid
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from backend.config import settings
from backend.database import init_db, SessionLocal
from backend.models import User
from backend.seed import seed_database
from backend.routers import auth, equipment, parts, threads, orders, ai, seed, demo, analytics
from backend.analytics import init_clickhouse, clickhouse_sync_background_worker

logger = logging.getLogger(__name__)

DEFAULT_JWT_SECRET = "super-secret-kofeservice-jwt-key-2026"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security check B3: Verify JWT_SECRET
    if settings.JWT_SECRET == DEFAULT_JWT_SECRET:
        if not settings.DEMO_MODE:
            raise RuntimeError("CRITICAL SECURITY ERROR: Default JWT_SECRET is not allowed when DEMO_MODE=False!")
        else:
            logger.warning("[SECURITY WARNING] Default JWT_SECRET detected. Allowed only because DEMO_MODE=True.")

    # Initialize DB schema
    init_db()
    
    # Auto-seed if database is freshly created
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            logger.info("База данных пуста. Запуск автоматического сидинга...")
            seed_database(db)
            logger.info("Сидинг успешно завершён!")
    except Exception as e:
        logger.error(f"Ошибка проверки базы данных при старте: {e}")
    finally:
        db.close()

    # Initialize ClickHouse analytics and start background sync worker if configured
    sync_task = None
    if settings.CLICKHOUSE_URL:
        try:
            init_clickhouse()
            sync_task = asyncio.create_task(clickhouse_sync_background_worker())
            logger.info("ClickHouse analytics sync worker started.")
        except Exception as e:
            logger.warning(f"Could not start ClickHouse worker: {e}")
    
    yield

    if sync_task:
        sync_task.cancel()


# Security check B5: Swagger/OpenAPI docs exposed only in DEMO_MODE
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEMO_MODE else None,
    redoc_url="/redoc" if settings.DEMO_MODE else None,
    openapi_url="/openapi.json" if settings.DEMO_MODE else None,
)

# Security check B5: Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: https://api.dicebear.com blob:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "script-src 'self' 'unsafe-inline'; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "connect-src 'self' ws: wss: http: https:; "
        "frame-ancestors 'none';"
    )
    if settings.PUBLIC_BASE_URL.startswith("https://"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Security check B6: Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = str(uuid.uuid4())[:8]
    logger.error(f"[REQUEST {req_id}] Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера", "request_id": req_id}
    )

# CORS middleware: support mobile phones on local Wi-Fi and cloud hosts
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.onrender\.com|.*\.koyeb\.app)(:\d+)?$" if settings.DEMO_MODE else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads with security options
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Mount API Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(equipment.router, prefix=settings.API_PREFIX)
app.include_router(parts.router, prefix=settings.API_PREFIX)
app.include_router(threads.router, prefix=settings.API_PREFIX)
app.include_router(orders.router, prefix=settings.API_PREFIX)
app.include_router(ai.router, prefix=settings.API_PREFIX)
app.include_router(seed.router, prefix=settings.API_PREFIX)
app.include_router(demo.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "reference_date": settings.SYSTEM_REFERENCE_DATE.strftime("%d.%m.%Y %H:%M")
    }

@app.get("/logo.png")
def get_logo():
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logo.png")
    if os.path.exists(logo_path):
        return FileResponse(logo_path, media_type="image/png")
    frontend_logo = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "logo.png")
    if os.path.exists(frontend_logo):
        return FileResponse(frontend_logo, media_type="image/png")
    return {"error": "logo not found"}

# Mount static frontend build if it exists
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
