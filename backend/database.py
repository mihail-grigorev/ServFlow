import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL

# Create engine
try:
    if db_url.startswith("sqlite"):
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False}
        )
    else:
        # Test connection with 2-second timeout to avoid startup hangs if Docker is starting
        test_engine = create_engine(
            db_url,
            connect_args={"connect_timeout": 2},
            pool_pre_ping=True
        )
        with test_engine.connect() as conn:
            pass
        engine = test_engine
except Exception as e:
    logger.warning(f"Could not connect using {db_url}: {e}. Falling back to SQLite.")
    fallback_url = "sqlite:///./kofeservice.db"
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import backend.models
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            from sqlalchemy import text
            if "sqlite" in str(engine.url):
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT;"))
                except Exception:
                    pass
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;"))
            try:
                conn.execute(text("UPDATE users SET avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Anna' WHERE email = 'dispatcher@kofeservice.ru' AND avatar_url IS NULL;"))
            except Exception:
                pass
    except Exception as e:
        logger.debug(f"Migration note: {e}")
