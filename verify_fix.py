
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env explicitly
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

from backtester.s3_data import load_bars
from datetime import datetime

def test_fix():
    print("Testing GOOGL split fix (July 2022)...")
    
    start = datetime(2022, 7, 10)
    end = datetime(2022, 7, 25)
    
    try:
        # This should now trigger the split detector and return adjusted data
        df = load_bars("GOOGL", start, end)
        
        print("\nAdjusted Data (S3 + Split Detector):")
        print(df[['Close', 'Volume']].to_string())
        
        # Check prices
        # Before split (July 15), price was ~2200. After split (July 18), ~110.
        # Adjusted data should show ~110 for BOTH.
        
        close_before = df.loc[df.index < '2022-07-16', 'Close'].iloc[-1]
        close_after = df.loc[df.index > '2022-07-16', 'Close'].iloc[0]
        
        print(f"\nClose Before (July 15): {close_before:.2f}")
        print(f"Close After (July 18): {close_after:.2f}")
        
        if abs(close_before - close_after) < 10: # Allow some market movement
            print("\nSUCCESS: Prices are continuous! Split was adjusted.")
        else:
            print("\nFAILURE: Large gap detected. Split NOT adjusted.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fix()
