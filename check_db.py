import sqlite3

# Check backtests.db
print("=== Checking backtests.db ===")
conn = sqlite3.connect('results/db/backtests.db')
cursor = conn.cursor()

# Get tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"Tables: {tables}")

# Get runs table structure
if tables:
    cursor.execute("PRAGMA table_info(runs)")
    runs_cols = cursor.fetchall()
    print(f"\nRuns table columns: {runs_cols}")
    
    # Count rows
    cursor.execute("SELECT COUNT(*) FROM runs")
    count = cursor.fetchone()[0]
    print(f"\nNumber of runs: {count}")
    
    if count > 0:
        cursor.execute("SELECT * FROM runs LIMIT 1")
        sample = cursor.fetchone()
        print(f"\nSample row: {sample}")
    
    # Check other tables
    for table_name in tables:
        if table_name[0] != 'runs':
            cursor.execute(f"SELECT COUNT(*) FROM {table_name[0]}")
            tcount = cursor.fetchone()[0]
            print(f"\n{table_name[0]} table: {tcount} rows")

conn.close()
print("\n" + "="*50)
