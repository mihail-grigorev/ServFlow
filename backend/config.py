import os
from datetime import datetime
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ServFlow"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database URL: default connects to local postgres on 5434 or Docker on 5432
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5434/kofeservice"
    )
    
    # System Reference Date per case specification: 16.11.2026 11:30
    SYSTEM_REFERENCE_DATE: datetime = datetime(2026, 11, 16, 11, 30, 0)
    
    # Google Gemini API key
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    
    # Auth JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-kofeservice-jwt-key-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

    # Yandex Mail SMTP settings for verification codes
    YANDEX_SMTP_HOST: str = os.getenv("YANDEX_SMTP_HOST", "smtp.yandex.ru")
    YANDEX_SMTP_PORT: int = int(os.getenv("YANDEX_SMTP_PORT", "465"))
    YANDEX_SMTP_USER: str = os.getenv("YANDEX_SMTP_USER", "")
    YANDEX_SMTP_PASSWORD: str = os.getenv("YANDEX_SMTP_PASSWORD", "")
    YANDEX_SMTP_FROM_NAME: str = os.getenv("YANDEX_SMTP_FROM_NAME", "ServFlow")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

