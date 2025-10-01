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
        cursor.execute("SELECT * FROM runs")
        all_runs = cursor.fetchall()
        print(f"\nAll runs:")
        for row in all_runs:
            print(f"  {row}")
    
    # Check strategies table in detail
    cursor.execute("SELECT COUNT(*) FROM strategies")
    strat_count = cursor.fetchone()[0]
    print(f"\nStrategies table: {strat_count} rows")
    
    if strat_count > 0:
        cursor.execute("PRAGMA table_info(strategies)")
        strat_cols = cursor.fetchall()
        print(f"Strategies columns: {[c[1] for c in strat_cols]}")
        
        cursor.execute("SELECT run_id, ticker, total_return, sharpe, trades_total FROM strategies LIMIT 5")
        sample_strats = cursor.fetchall()
        print(f"\nSample strategies:")
        for s in sample_strats:
            print(f"  {s}")
    
    # Check other tables
    for table_name in tables:
        if table_name[0] not in ['runs', 'strategies', 'sqlite_sequence']:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name[0]}")
            tcount = cursor.fetchone()[0]
            print(f"\n{table_name[0]} table: {tcount} rows")

conn.close()
print("\n" + "="*50)
