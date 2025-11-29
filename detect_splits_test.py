
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env explicitly
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

from backtester.s3_data import load_bars, download_date, init_s3_client
from datetime import datetime, timedelta

def count_tickers():
    print("Downloading recent data to count tickers...")
    try:
        s3 = init_s3_client()
        # Try a recent trading day
        date_str = "2024-01-04" 
        df = download_date(s3, date_str)
        
        if df is not None:
            count = df['ticker'].nunique()
            print(f"\n[ANSWER] Found {count} unique tickers in {date_str} file.")
            print(f"Examples: {df['ticker'].unique()[:10]}")
        else:
            print("Could not download data to count tickers.")
    except Exception as e:
        print(f"Error in count_tickers: {e}")

def detect_splits(ticker):
    print(f"\nTesting split detection for {ticker}...")
    # Load unadjusted data
    end = datetime.now()
    start = datetime(2020, 1, 1)
    
    try:
        df = load_bars(ticker, start, end)
        if df.empty:
            print("No data found.")
            return

        df = df.sort_index()
        closes = df['Close']
        
        # Calculate daily returns
        ratios = closes / closes.shift(1)
        
        # Filter for drops > 30% (ratio < 0.7)
        potential_splits = ratios[ratios < 0.7]
        
        if potential_splits.empty:
            print("No potential splits found.")
        
        for date, ratio in potential_splits.items():
            # Check if it's a clean ratio
            # Invert ratio to get split factor (e.g. 0.05 -> 20)
            factor = 1 / ratio
            
            # Check if close to an integer
            nearest_int = round(factor)
            if abs(factor - nearest_int) < 0.1: # 10% tolerance
                print(f"Found likely split on {date.date()}: {nearest_int}:1 (Ratio: {ratio:.4f})")
            else:
                print(f"Ignored drop on {date.date()} (Ratio: {ratio:.4f}) - not a clean split ratio")
    except Exception as e:
        print(f"Error in detect_splits: {e}")

if __name__ == "__main__":
    try:
        count_tickers()
        detect_splits("GOOGL") # Should find 20:1 in July 2022
        detect_splits("TSLA")  # Should find 5:1 (2020) and 3:1 (2022)
        detect_splits("AMZN")  # Should find 20:1 (2022)
    except Exception as e:
        print(f"Error: {e}")
