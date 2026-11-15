import sys
import time
import random
import json
from datetime import datetime, timedelta
import argparse

from backend.config import settings
from backend.database import SessionLocal, engine, Base, init_db
from backend.models import Event
from backend.analytics import get_clickhouse_client, init_clickhouse


def generate_synthetic_events(count: int = 100000):
    """
    Generates synthetic events distributed across the past 90 days.
    """
    init_db()
    now = datetime.utcnow()
    event_types = [
        "thread_created",
        "ai_analysis",
        "order_created",
        "order_status_changed",
        "engineer_assigned",
        "report_submitted",
        "qr_login"
    ]
    weights = [0.20, 0.30, 0.20, 0.15, 0.05, 0.05, 0.05]
    companies = ["comp_kedr", "comp_briz", "comp_pirs", "comp_travel", "comp_shokolad", "comp_pravda"]
    models = ["C100", "C200", "C300"]
    rules_pool = ["П-1", "П-2", "П-3", "П-4", "П-5", "П-6", "П-7", "П-8", "П-9", "П-10"]

    print(f"Generating {count:,} synthetic analytical events spanning 90 days...")
    start_time = time.perf_counter()

    events_data = []
    for i in range(1, count + 1):
        # Random timestamp within 90 days
        delta_seconds = random.randint(0, 90 * 86400)
        ts = now - timedelta(seconds=delta_seconds)
        etype = random.choices(event_types, weights=weights)[0]
        cid = random.choice(companies) if random.random() < 0.7 else None
        user_id = random.randint(1, 5)

        payload = {}
        if etype == "ai_analysis":
            source = "gemini" if random.random() < 0.85 else "fallback"
            lat = round(random.gauss(150, 40), 1) if source == "gemini" else round(random.gauss(25, 5), 1)
            lat = max(10.0, lat)
            num_rules = random.randint(1, 3)
            trig_rules = random.sample(rules_pool, num_rules)
            payload = {
                "source": source,
                "latency_ms": lat,
                "rules_triggered": trig_rules,
                "is_warranty": "П-9" in trig_rules
            }
        elif etype == "order_created":
            payload = {
                "model": random.choice(models),
                "is_warranty": random.random() < 0.3,
                "parts_count": random.randint(0, 3)
            }
        elif etype == "order_status_changed":
            payload = {
                "new_status": random.choice(["В пути", "В работе", "Выполнен", "Отменен"])
            }
        elif etype == "qr_login":
            payload = {
                "company_id": cid,
                "client_ip": f"192.168.1.{random.randint(10, 250)}"
            }

        events_data.append({
            "id": i,
            "ts": ts,
            "type": etype,
            "thread_id": random.randint(1, 500) if etype in ("thread_created", "ai_analysis", "order_created") else None,
            "order_id": random.randint(1, 300) if "order" in etype else None,
            "user_id": user_id,
            "company_id": cid,
            "payload": payload
        })

    elapsed_gen = time.perf_counter() - start_time
    print(f"Generated {count:,} records in memory in {elapsed_gen:.2f}s.")

    # 1. Insert into ClickHouse if configured and reachable
    ch_client = get_clickhouse_client()
    if ch_client:
        print("Connected to ClickHouse. Initializing schema...")
        init_clickhouse()
        print("Bulk inserting into ClickHouse fact_events...")
        ch_start = time.perf_counter()

        # Batch insert into ClickHouse
        batch_size = 25000
        total_ch_inserted = 0
        column_names = ["id", "ts", "type", "thread_id", "order_id", "user_id", "company_id", "payload"]

        for idx in range(0, count, batch_size):
            chunk = events_data[idx:idx + batch_size]
            rows = [
                [
                    item["id"],
                    item["ts"],
                    item["type"],
                    item["thread_id"],
                    item["order_id"],
                    item["user_id"],
                    item["company_id"],
                    json.dumps(item["payload"], ensure_ascii=False)
                ]
                for item in chunk
            ]
            ch_client.insert("fact_events", rows, column_names=column_names)
            total_ch_inserted += len(rows)
            print(f"  Inserted {total_ch_inserted:,} / {count:,} into ClickHouse...")

        ch_elapsed = time.perf_counter() - ch_start
        print(f"ClickHouse insertion complete: {total_ch_inserted:,} rows in {ch_elapsed:.2f}s ({int(count/ch_elapsed):,} rows/s)!")
    else:
        print("ClickHouse not configured or unreachable; skipping ClickHouse bulk insert.")

    # 2. Insert into PostgreSQL / SQLite
    print("Inserting batch into relational database (events table)...")
    db_start = time.perf_counter()
    db = SessionLocal()
    try:
        # For Postgres/SQLite performance, insert up to 10,000 events or full count
        db_limit = min(count, 10000)
        chunk = events_data[:db_limit]
        
        objects = [
            Event(
                ts=item["ts"],
                type=item["type"],
                thread_id=item["thread_id"],
                order_id=item["order_id"],
                user_id=item["user_id"],
                company_id=item["company_id"],
                payload=item["payload"],
                synced_to_ch=(ch_client is not None)
            )
            for item in chunk
        ]
        db.bulk_save_objects(objects)
        db.commit()
        db_elapsed = time.perf_counter() - db_start
        print(f"Relational DB insertion complete: {len(objects):,} rows in {db_elapsed:.2f}s.")
    except Exception as e:
        db.rollback()
        print(f"Relational DB insert error: {e}")
    finally:
        db.close()

    total_time = time.perf_counter() - start_time
    print(f"All done! Total time: {total_time:.2f}s.")


def main():
    parser = argparse.ArgumentParser(description="ServFlow CLI management tools")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # seed-history command
    seed_parser = subparsers.add_parser("seed-history", help="Generate synthetic analytical events")
    seed_parser.add_argument("--count", type=int, default=100000, help="Number of events to generate (default: 100000)")

    args = parser.parse_args()

    if args.command == "seed-history":
        generate_synthetic_events(count=args.count)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
