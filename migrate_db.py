"""Migrate existing database to add new columns for equity curves"""
import sqlite3
import shutil
from datetime import datetime

db_path = r"c:\Users\mabso\MyBot\results\db\backtests.db"

# Backup first
backup_path = db_path.replace('.db', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db')
shutil.copy2(db_path, backup_path)
print(f"✅ Backed up database to: {backup_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n=== Migrating strategies table ===")
try:
    cursor.execute("ALTER TABLE strategies ADD COLUMN equity_json TEXT")
    print("✓ Added equity_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ equity_json column already exists")
    else:
        print(f"✗ Error adding equity_json: {e}")

try:
    cursor.execute("ALTER TABLE strategies ADD COLUMN events_json TEXT")
    print("✓ Added events_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ events_json column already exists")
    else:
        print(f"✗ Error adding events_json: {e}")

print("\n=== Migrating portfolio table ===")
try:
    cursor.execute("ALTER TABLE portfolio ADD COLUMN equity_json TEXT")
    print("✓ Added equity_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ equity_json column already exists")
    else:
        print(f"✗ Error adding equity_json: {e}")

try:
    cursor.execute("ALTER TABLE portfolio ADD COLUMN buyhold_equity_json TEXT")
    print("✓ Added buyhold_equity_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ buyhold_equity_json column already exists")
    else:
        print(f"✗ Error adding buyhold_equity_json: {e}")

try:
    cursor.execute("ALTER TABLE portfolio ADD COLUMN per_ticker_equity_json TEXT")
    print("✓ Added per_ticker_equity_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ per_ticker_equity_json column already exists")
    else:
        print(f"✗ Error adding per_ticker_equity_json: {e}")

print("\n=== Migrating runs table ===")
try:
    cursor.execute("ALTER TABLE runs ADD COLUMN benchmark_equity_json TEXT")
    print("✓ Added benchmark_equity_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ benchmark_equity_json column already exists")
    else:
        print(f"✗ Error adding benchmark_equity_json: {e}")

try:
    cursor.execute("ALTER TABLE runs ADD COLUMN config_json TEXT")
    print("✓ Added config_json column")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("✓ config_json column already exists")
    else:
        print(f"✗ Error adding config_json: {e}")

conn.commit()
conn.close()

print("\n" + "="*50)
print("✅ Migration complete!")
print("\nNOTE: Existing runs won't have equity data.")
print("Run a new backtest to populate these columns.")
