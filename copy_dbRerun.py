import sqlite3
import shutil

# Source and destination
src_db = r"c:\Users\mabso\MyBot\frontend\results\db\backtests.db"
dst_db = r"c:\Users\mabso\MyBot\results\db\backtests.db"

# First, backup the destination
backup_db = r"c:\Users\mabso\MyBot\results\db\backtests_backup.db"
shutil.copy2(dst_db, backup_db)
print(f"✅ Backed up main database to: {backup_db}")

# Connect to both databases
src_conn = sqlite3.connect(src_db)
dst_conn = sqlite3.connect(dst_db)

src_cursor = src_conn.cursor()
dst_cursor = dst_conn.cursor()

# Copy the DBRerun from source to destination
print("\nCopying DBRerun data...")

# 1. Copy the run record
src_cursor.execute("SELECT * FROM runs WHERE run_id = 'DBRerun'")
run_data = src_cursor.fetchone()
if run_data:
    dst_cursor.execute("""
        INSERT OR REPLACE INTO runs (run_id, notes, mode, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?)
    """, run_data)
    print(f"✅ Copied run record: {run_data[0]}")

# 2. Copy all strategies for DBRerun
src_cursor.execute("SELECT COUNT(*) FROM strategies WHERE run_id = 'DBRerun'")
strat_count = src_cursor.fetchone()[0]
print(f"   Found {strat_count} strategies to copy...")

src_cursor.execute("SELECT * FROM strategies WHERE run_id = 'DBRerun'")
strategies = src_cursor.fetchall()

# Get column names
src_cursor.execute("PRAGMA table_info(strategies)")
columns = [col[1] for col in src_cursor.fetchall()]
placeholders = ','.join(['?' for _ in columns])
col_names = ','.join(columns)

for strat in strategies:
    try:
        dst_cursor.execute(f"INSERT INTO strategies ({col_names}) VALUES ({placeholders})", strat)
    except sqlite3.IntegrityError:
        # Skip if already exists
        pass

dst_conn.commit()
print(f"✅ Copied {len(strategies)} strategies")

# Verify
dst_cursor.execute("SELECT COUNT(*) FROM strategies WHERE run_id = 'DBRerun'")
verify_count = dst_cursor.fetchone()[0]
print(f"✅ Verified: {verify_count} strategies now in main database")

src_conn.close()
dst_conn.close()

print("\n✅ Done! You can now see DBRerun in your frontend.")
