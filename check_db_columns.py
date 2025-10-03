"""Check actual database columns"""
import sqlite3

conn = sqlite3.connect("./results/db/backtests.db")
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(strategies)")
columns = cursor.fetchall()

print("Columns in strategies table (./results/db/backtests.db):")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()
