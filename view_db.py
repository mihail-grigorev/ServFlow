import sqlite3
import sys

def view(table_name=None):
    conn = sqlite3.connect("kofeservice.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]
    
    if not table_name:
        print("\n=== ТАБЛИЦЫ В БАЗЕ ДАННЫХ (kofeservice.db) ===")
        for t in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            cnt = cursor.fetchone()[0]
            print(f"  • {t:<20} : {cnt} строк")
        print("\nПодсказка: чтобы посмотреть содержимое таблицы, запустите:")
        print("  python view_db.py <имя_таблицы>  (например: python view_db.py equipments)\n")
        conn.close()
        return

    if table_name not in tables:
        print(f"Таблица '{table_name}' не найдена! Доступные таблицы: {', '.join(tables)}")
        conn.close()
        return

    cursor.execute(f"PRAGMA table_info({table_name});")
    cols = [col[1] for col in cursor.fetchall()]
    
    cursor.execute(f"SELECT * FROM {table_name};")
    rows = cursor.fetchall()
    
    print(f"\n=== ТАБЛИЦА: {table_name} ({len(rows)} записей) ===")
    print(" | ".join(cols))
    print("-" * 80)
    for row in rows:
        formatted = [str(x) if x is not None else "NULL" for x in row]
        # Truncate long strings for clean terminal display
        formatted = [f"{x[:30]}..." if len(x) > 33 else x for x in formatted]
        print(" | ".join(formatted))
    print()
    conn.close()

if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else None
    view(t)
