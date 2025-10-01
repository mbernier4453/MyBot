import sqlite3
import json

db_path = r"c:\Users\mabso\MyBot\frontend\results\db\backtests.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get first strategy from DBRerun
cursor.execute("""
    SELECT ticker, metrics_json 
    FROM strategies 
    WHERE run_id = 'DBRerun' 
    LIMIT 1
""")

row = cursor.fetchone()
if row:
    ticker, metrics_json = row
    print(f"=== Sample from DBRerun - {ticker} ===")
    metrics = json.loads(metrics_json)
    print(f"\nAll keys in metrics:")
    for key in sorted(metrics.keys()):
        print(f"  {key}: {metrics[key]}")
    
    # Check for buyhold keys
    buyhold_keys = [k for k in metrics.keys() if 'buy' in k.lower()]
    print(f"\n✅ Buy & hold keys found: {len(buyhold_keys)}")
    if buyhold_keys:
        print("Keys:", buyhold_keys)
else:
    print("No strategies found")

conn.close()
