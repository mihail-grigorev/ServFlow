import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config import settings
from backend.database import init_db, SessionLocal
from backend.models import User
from backend.seed import seed_database
from backend.routers import auth, equipment, parts, threads, orders, ai, seed

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    
    # Auto-seed if database is freshly created
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("База данных пуста. Запуск автоматического сидинга...")
            seed_database(db)
            print("Сидинг успешно завершён!")
    except Exception as e:
        print(f"Ошибка проверки базы данных при старте: {e}")
    finally:
        db.close()
    
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads
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
