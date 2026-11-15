import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import func

from backend.config import settings
from backend.models import Event, ServiceOrder, ClientThread, SparePart, Message, User

logger = logging.getLogger(__name__)

_clickhouse_initialized = False

def get_clickhouse_client():
    """Returns ClickHouse client if configured and reachable, else None."""
    if not settings.CLICKHOUSE_URL or not settings.CLICKHOUSE_URL.strip():
        return None
    try:
        import clickhouse_connect
        url = settings.CLICKHOUSE_URL.strip()
        client = clickhouse_connect.get_client(url=url, connect_timeout=2)
        return client
    except Exception as e:
        logger.debug(f"ClickHouse client connection failed: {e}")
        return None


def init_clickhouse():
    """Initializes ClickHouse tables and materialized view if ClickHouse is reachable."""
    global _clickhouse_initialized
    client = get_clickhouse_client()
    if not client:
        return False
    try:
        client.command("""
        CREATE TABLE IF NOT EXISTS fact_events (
            id UInt64,
            ts DateTime,
            type LowCardinality(String),
            thread_id Nullable(UInt64),
            order_id Nullable(UInt64),
            user_id Nullable(UInt64),
            company_id Nullable(String),
            payload String
        ) ENGINE = MergeTree()
        ORDER BY (toDate(ts), type);
        """)

        client.command("""
        CREATE TABLE IF NOT EXISTS daily_event_aggregates (
            event_date Date,
            type LowCardinality(String),
            event_count UInt64
        ) ENGINE = SummingMergeTree()
        ORDER BY (event_date, type);
        """)

        client.command("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_event_aggregates
        TO daily_event_aggregates
        AS SELECT
            toDate(ts) AS event_date,
            type,
            count() AS event_count
        FROM fact_events
        GROUP BY event_date, type;
        """)
        _clickhouse_initialized = True
        logger.info("ClickHouse schema and materialized view initialized successfully.")
        return True
    except Exception as e:
        logger.warning(f"Failed to initialize ClickHouse schema: {e}")
        return False


def track_event(
    event_type: str,
    thread_id: Optional[int] = None,
    order_id: Optional[int] = None,
    user_id: Optional[int] = None,
    company_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None
) -> None:
    """
    Safely records an event to the events table in Postgres/SQLite.
    Guaranteed never to throw an exception or interrupt the caller's request.
    """
    try:
        bind = db.get_bind() if db is not None else None
        if bind is not None:
            LocalSession = sessionmaker(bind=bind, autocommit=False, autoflush=False)
            sess = LocalSession()
        else:
            from backend.database import SessionLocal
            sess = SessionLocal()

        try:
            evt = Event(
                ts=datetime.utcnow(),
                type=event_type,
                thread_id=thread_id,
                order_id=order_id,
                user_id=user_id,
                company_id=str(company_id) if company_id else None,
                payload=payload or {},
                synced_to_ch=False
            )
            sess.add(evt)
            sess.commit()
        except Exception as inner_e:
            sess.rollback()
            logger.debug(f"track_event insert error: {inner_e}")
        finally:
            sess.close()
    except Exception as e:
        logger.debug(f"track_event({event_type}) caught exception: {e}")


def sync_events_to_clickhouse(batch_size: int = 1000) -> int:
    """
    Transfers un-synced events from Postgres into ClickHouse in batches,
    marking synced rows upon successful insertion.
    """
    client = get_clickhouse_client()
    if not client:
        return 0

    from backend.database import SessionLocal
    sess = SessionLocal()
    try:
        events = sess.query(Event).filter(Event.synced_to_ch == False).order_by(Event.id.asc()).limit(batch_size).all()
        if not events:
            return 0

        rows = []
        ids = []
        for e in events:
            ids.append(e.id)
            rows.append([
                e.id,
                e.ts,
                e.type,
                e.thread_id,
                e.order_id,
                e.user_id,
                e.company_id,
                json.dumps(e.payload or {}, ensure_ascii=False)
            ])

        column_names = ["id", "ts", "type", "thread_id", "order_id", "user_id", "company_id", "payload"]
        client.insert("fact_events", rows, column_names=column_names)

        sess.query(Event).filter(Event.id.in_(ids)).update({Event.synced_to_ch: True}, synchronize_session=False)
        sess.commit()
        return len(ids)
    except Exception as e:
        sess.rollback()
        logger.debug(f"ClickHouse sync failed: {e}")
        return 0
    finally:
        sess.close()


async def clickhouse_sync_background_worker():
    """Background worker running every 10 seconds to sync events to ClickHouse."""
    while True:
        try:
            if settings.CLICKHOUSE_URL:
                sync_events_to_clickhouse()
        except Exception as e:
            logger.debug(f"clickhouse_sync_background_worker error: {e}")
        await asyncio.sleep(10)


def get_analytics_summary(db: Session) -> Dict[str, Any]:
    """
    Calculates key performance metrics 100% from real database records (PostgreSQL / SQLite).
    No synthetic constants or artificial offsets.
    """
    # 1. Avoided empty visits (real active orders with diagnosed reserved parts)
    active_orders = db.query(ServiceOrder).filter(
        ServiceOrder.status.notin_(["Отменен", "Отменён"])
    ).all()
    avoided_empty_visits = sum(
        1 for o in active_orders if o.reserved_parts and len(o.reserved_parts) > 0
    )

    # 2. Automatically handled customer requests ratio from real threads & messages
    total_threads = db.query(ClientThread).count()
    auto_handled_threads = 0
    if total_threads > 0:
        auto_handled_threads = db.query(Message.thread_id).filter(
            Message.sender_type.in_(["ai", "system"])
        ).distinct().count()

    auto_ratio = round((auto_handled_threads / total_threads * 100), 1) if total_threads > 0 else 0.0

    # 3. Rules frequency (П-1 ... П-10) computed strictly from real events and records
    rules_counts = {f"П-{i}": 0 for i in range(1, 11)}

    # Scan real ai_analysis events
    ai_events = db.query(Event).filter(Event.type == "ai_analysis").all()
    for ev in ai_events:
        payload = ev.payload or {}
        trig = payload.get("rules_triggered") or []
        for r in trig:
            for k in rules_counts.keys():
                if k in str(r):
                    rules_counts[k] += 1

    # Also account for real thread states
    all_threads = db.query(ClientThread).all()
    for th in all_threads:
        if th.equipment_code or th.equipment_id:
            rules_counts["П-1"] += 1
        if th.is_unregistered:
            rules_counts["П-2"] += 1
        if th.is_warranty:
            rules_counts["П-9"] += 1

    # Also account for real orders
    for ord_obj in active_orders:
        if ord_obj.is_warranty:
            rules_counts["П-9"] += 1
        if ord_obj.reserved_parts:
            rules_counts["П-6"] += len(ord_obj.reserved_parts)
            rules_counts["П-7"] += len(ord_obj.reserved_parts)
            for rp in ord_obj.reserved_parts:
                if isinstance(rp, dict) and rp.get("transfer_required"):
                    rules_counts["П-8"] += 1

    # 4. AI Latency (p50 / p95) from real recorded latency values
    latencies = []
    for ev in ai_events:
        lat = (ev.payload or {}).get("latency_ms")
        if lat is not None and isinstance(lat, (int, float)) and lat > 0:
            latencies.append(float(lat))

    if latencies:
        latencies.sort()
        n = len(latencies)
        p50 = latencies[int(n * 0.5)]
        p95 = latencies[min(int(n * 0.95), n - 1)]
    else:
        p50 = 0.0
        p95 = 0.0

    # 5. Spare parts deficit from real inventory
    all_parts = db.query(SparePart).all()
    deficit_parts = []
    for p in all_parts:
        moscow_free = (p.moscow_stock or 0) - (p.moscow_reserved or 0)
        tula_free = (p.tula_stock or 0) - (p.tula_reserved or 0)
        if moscow_free <= 1 or tula_free <= 1:
            deficit_parts.append({
                "code": p.code,
                "name": p.name,
                "moscow_free": moscow_free,
                "tula_free": tula_free,
                "is_critical": (moscow_free <= 0 or tula_free <= 0)
            })

    # 6. Audience demo companies requests
    demo_companies = ["comp_kedr", "comp_briz", "comp_pirs", "comp_travel"]
    demo_requests_count = db.query(ClientThread).filter(
        ClientThread.company_id.in_(demo_companies)
    ).count()

    # QR logins count from real events
    qr_logins_count = db.query(Event).filter(Event.type == "qr_login").count()

    return {
        "avoided_empty_visits": avoided_empty_visits,
        "auto_handled_ratio": auto_ratio,
        "total_threads": total_threads,
        "auto_handled_threads": auto_handled_threads,
        "ai_latency": {
            "p50_ms": round(p50, 1),
            "p95_ms": round(p95, 1)
        },
        "rules_frequency": rules_counts,
        "parts_deficit": deficit_parts,
        "demo_requests_count": demo_requests_count,
        "qr_logins_count": qr_logins_count,
        "ch_active": get_clickhouse_client() is not None
    }


def get_analytics_timeseries(db: Session) -> Dict[str, Any]:
    """
    Returns time-series and categorical breakdown for analytical charts,
    computed 100% from real database tables and events across the last 7 days.
    """
    today = datetime.utcnow().date()
    daily_stats = []

    # Check if ClickHouse has fact_events
    ch_client = get_clickhouse_client()
    ch_daily_map = {}
    if ch_client:
        try:
            res = ch_client.query("""
                SELECT
                    toDate(ts) AS d,
                    countIf(type = 'thread_created') AS tickets,
                    countIf(type = 'order_created') AS orders,
                    avgIf(JSONExtractFloat(payload, 'latency_ms'), type = 'ai_analysis') AS avg_lat
                FROM fact_events
                WHERE ts >= now() - INTERVAL 7 DAY
                GROUP BY d
                ORDER BY d ASC
            """)
            for row in res.result_rows:
                d_str = row[0].strftime("%Y-%m-%d") if hasattr(row[0], 'strftime') else str(row[0])
                ch_daily_map[d_str] = {
                    "tickets": int(row[1]),
                    "orders": int(row[2]),
                    "avg_lat": round(float(row[3] or 0), 1)
                }
        except Exception as e:
            logger.debug(f"ClickHouse timeseries query failed, fallback to DB: {e}")

    for offset in range(6, -1, -1):
        target_date = today - timedelta(days=offset)
        d_str = target_date.strftime("%Y-%m-%d")
        d_label = target_date.strftime("%d.%m")

        if d_str in ch_daily_map:
            ch_data = ch_daily_map[d_str]
            daily_stats.append({
                "date": d_label,
                "full_date": d_str,
                "tickets": ch_data["tickets"],
                "orders": ch_data["orders"],
                "avg_latency_ms": ch_data["avg_lat"]
            })
        else:
            day_start = datetime.combine(target_date, datetime.min.time())
            day_end = datetime.combine(target_date, datetime.max.time())

            # Real tickets created on this date
            tickets_cnt = db.query(Event).filter(
                Event.type == "thread_created",
                Event.ts >= day_start,
                Event.ts <= day_end
            ).count()
            threads_cnt = db.query(ClientThread).filter(
                ClientThread.created_at >= day_start,
                ClientThread.created_at <= day_end
            ).count()
            total_day_tickets = tickets_cnt + threads_cnt

            # Real orders created on this date
            orders_cnt = db.query(Event).filter(
                Event.type == "order_created",
                Event.ts >= day_start,
                Event.ts <= day_end
            ).count()
            db_orders_cnt = db.query(ServiceOrder).filter(
                ServiceOrder.created_at >= day_start,
                ServiceOrder.created_at <= day_end
            ).count()
            total_day_orders = orders_cnt + db_orders_cnt

            # Real average latency on this date
            day_ai_events = db.query(Event).filter(
                Event.type == "ai_analysis",
                Event.ts >= day_start,
                Event.ts <= day_end
            ).all()

            latencies = [
                float(ev.payload.get("latency_ms"))
                for ev in day_ai_events
                if ev.payload and ev.payload.get("latency_ms")
            ]
            avg_lat = round(sum(latencies) / len(latencies), 1) if latencies else 0.0

            daily_stats.append({
                "date": d_label,
                "full_date": d_str,
                "tickets": total_day_tickets,
                "orders": total_day_orders,
                "avg_latency_ms": avg_lat
            })

    # Rules description mapping
    rules_info = [
        {"rule": "П-1", "name": "Идентификация модели / серийного номера"},
        {"rule": "П-2", "name": "Оборудование вне реестра (отдел продаж)"},
        {"rule": "П-3", "name": "Уточнение симптома при неполных данных"},
        {"rule": "П-4", "name": "Синтез описания неисправности"},
        {"rule": "П-5", "name": "Инструктаж безопасности (обесточить, перекрыть)"},
        {"rule": "П-6", "name": "Подбор ремкомплекта деталей"},
        {"rule": "П-7", "name": "Проверка наличия на складе выезда"},
        {"rule": "П-8", "name": "Межскладское перемещение Москва-Тула"},
        {"rule": "П-9", "name": "Гарантийный выезд (до 40 дней)"},
        {"rule": "П-10", "name": "Запрет самостоятельной разборки клиентом"}
    ]

    summary = get_analytics_summary(db)
    rules_freq = summary.get("rules_frequency", {})

    rules_distribution = [
        {
            "rule": r["rule"],
            "name": r["name"],
            "count": rules_freq.get(r["rule"], 0)
        }
        for r in rules_info
    ]

    return {
        "daily_trend": daily_stats,
        "rules_distribution": rules_distribution
    }
