from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.models import User
from backend.auth import require_dispatcher
from backend.analytics import (
    get_analytics_summary,
    get_analytics_timeseries,
    sync_events_to_clickhouse
)

router = APIRouter(prefix="/analytics", tags=["Аналитика ClickHouse"])

@router.get("/summary")
def get_summary(
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns high-level business and operational KPIs for dispatchers.
    Calculates from ClickHouse if reachable, otherwise seamlessly falls back to PostgreSQL.
    """
    return get_analytics_summary(db)


@router.get("/timeseries")
def get_timeseries(
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns time-series trend data and rules distribution for charts.
    """
    return get_analytics_timeseries(db)


@router.post("/sync")
def trigger_sync(
    current_user: User = Depends(require_dispatcher),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Manually triggers an immediate batch synchronization of un-synced events into ClickHouse.
    """
    synced = sync_events_to_clickhouse(batch_size=5000)
    return {"status": "ok", "synced_count": synced}
