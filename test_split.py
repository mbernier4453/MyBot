
import yfinance as yf
import pandas as pd
import sys

def test_googl_split():
    print("Fetching GOOGL data around split (July 2022)...")
    sys.stdout.flush()
    
    googl = yf.Ticker("GOOGL")
    
    # Get history
    try:
        df = googl.history(start="2022-07-14", end="2022-07-19", auto_adjust=False)
        print("\nUnadjusted (auto_adjust=False):")
        print(df[['Close', 'Stock Splits']].to_string())
    except Exception as e:
        print(f"Error fetching unadjusted: {e}")

    try:
        df_adj = googl.history(start="2022-07-14", end="2022-07-19", auto_adjust=True)
        print("\nAdjusted (auto_adjust=True):")
        print(df_adj[['Close', 'Stock Splits']].to_string())
    except Exception as e:
        print(f"Error fetching adjusted: {e}")

if __name__ == "__main__":
    test_googl_split()
