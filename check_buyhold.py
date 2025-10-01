import sqlite3
import json

db_path = r"c:\Users\mabso\MyBot\results\db\backtests.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get first strategy for each ticker
cursor.execute("""
    SELECT ticker, metrics_json 
    FROM strategies 
    WHERE run_id = 'SectorETFtoDB' 
    GROUP BY ticker
    LIMIT 3
""")

for row in cursor.fetchall():
    ticker, metrics_json = row
    print(f"\n=== {ticker} ===")
    metrics = json.loads(metrics_json)
    print(f"Keys in metrics: {list(metrics.keys())}")
    
    # Look for buyhold keys
    buyhold_keys = [k for k in metrics.keys() if 'buy' in k.lower() or 'hold' in k.lower()]
    if buyhold_keys:
        print(f"Buy & hold keys found: {buyhold_keys}")
        for key in buyhold_keys:
            print(f"  {key}: {metrics[key]}")
    else:
        print("No buy & hold keys found")

conn.close()
