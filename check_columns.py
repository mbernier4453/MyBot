"""Check if buyhold_json column exists"""
import sqlite3

conn = sqlite3.connect("./results/runs.duckdb")
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(strategies)")
columns = cursor.fetchall()

print("Columns in strategies table:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()
