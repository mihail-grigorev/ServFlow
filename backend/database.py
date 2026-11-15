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
            is_sqlite = "sqlite" in str(engine.url)
            
            if not is_sqlite:
                # PostgreSQL migrations: safe ADD COLUMN IF NOT EXISTS
                alter_statements = [
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
                    "ALTER TABLE equipments ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);",
                    "ALTER TABLE client_threads ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);",
                    "ALTER TABLE client_threads ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;",
                    "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);",
                    "ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS code_hash VARCHAR(128);",
                    "ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;",
                ]
                for stmt in alter_statements:
                    try:
                        conn.execute(text(stmt))
                    except Exception as ex:
                        logger.debug(f"Postgres column add skipped: {ex}")
            else:
                # SQLite migrations
                sqlite_alters = [
                    "ALTER TABLE users ADD COLUMN company_id VARCHAR(50);",
                    "ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT 0;",
                    "ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;",
                    "ALTER TABLE users ADD COLUMN avatar_url TEXT;",
                    "ALTER TABLE equipments ADD COLUMN company_id VARCHAR(50);",
                    "ALTER TABLE client_threads ADD COLUMN company_id VARCHAR(50);",
                    "ALTER TABLE client_threads ADD COLUMN owner_user_id INTEGER;",
                    "ALTER TABLE service_orders ADD COLUMN company_id VARCHAR(50);",
                    "ALTER TABLE verification_codes ADD COLUMN code_hash VARCHAR(128);",
                    "ALTER TABLE verification_codes ADD COLUMN attempts INTEGER DEFAULT 0;",
                ]
                for stmt in sqlite_alters:
                    try:
                        conn.execute(text(stmt))
                    except Exception:
                        pass
    except Exception as e:
        logger.debug(f"Migration note: {e}")

    try:
        with engine.begin() as conn:
            from sqlalchemy import text
            index_stmt = (
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_active_thread "
                "ON service_orders(thread_id) "
                "WHERE status NOT IN ('Отменен', 'Отменён') AND thread_id IS NOT NULL;"
            )
            conn.execute(text(index_stmt))
    except Exception as ex:
        logger.debug(f"Index creation note: {ex}")
