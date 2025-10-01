import sqlite3

db_path = r"c:\Users\mabso\MyBot\results\db\backtests.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all runs
cursor.execute("SELECT run_id, mode, started_at, completed_at FROM runs ORDER BY started_at DESC")
runs = cursor.fetchall()

print("All runs in database:")
print("-" * 80)
for run_id, mode, started, completed in runs:
    print(f"Run ID: {run_id}")
    print(f"  Mode: {mode}")
    print(f"  Started: {started}")
    print(f"  Completed: {completed}")
    
    # Count strategies for this run
    cursor.execute("SELECT COUNT(*) FROM strategies WHERE run_id = ?", (run_id,))
    strat_count = cursor.fetchone()[0]
    print(f"  Strategies: {strat_count}")
    print()

conn.close()
