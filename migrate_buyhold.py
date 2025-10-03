"""
Add buyhold_json column to strategies table for existing databases.
"""
import sqlite3
import shutil
from datetime import datetime

DB_PATH = "./results/db/backtests.db"

def main():
    # Backup database
    backup_path = f"{DB_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"✅ Backup created: {backup_path}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(strategies)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'buyhold_json' in columns:
            print("✅ buyhold_json column already exists in strategies table")
        else:
            cursor.execute("ALTER TABLE strategies ADD COLUMN buyhold_json TEXT")
            conn.commit()
            print("✅ Added buyhold_json column to strategies table")
        
        print("\n✅ Migration complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
