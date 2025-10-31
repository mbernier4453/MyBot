"""
Data Source - Polygon Flat Files Integration
Replaces yfinance with fast S3 flat file downloads
"""

import sys
from pathlib import Path
import pandas as pd
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from data.polygon_flatfiles import PolygonFlatFiles

OHLCV = ["Open", "High", "Low", "Close", "Volume"]


class DataSource:
    """Unified data source using Polygon Flat Files"""
    
    def __init__(self):
        self.flatfiles = PolygonFlatFiles()
    
    def load_bars(self, symbols: list[str], start: str, end: str) -> dict[str, pd.DataFrame]:
        """
        Load OHLCV data for multiple symbols from Polygon flat files.
        
        Args:
            symbols: List of ticker symbols (e.g., ['AAPL', 'MSFT'])
            start: Start date 'YYYY-MM-DD'
            end: End date 'YYYY-MM-DD'
            
        Returns:
            Dict mapping symbol -> DataFrame with OHLCV columns and DatetimeIndex
        """
        out = {}
        
        for symbol in symbols:
            try:
                df = self.flatfiles.get_daily_bars(symbol, start, end)
                
                if df.empty:
                    print(f"[DATA] No data for {symbol}")
                    continue
                
                # Normalize column names to match legacy format
                df = df.rename(columns={
                    'open': 'Open',
                    'high': 'High', 
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                
                # Ensure all required columns exist
                for col in OHLCV:
                    if col not in df.columns:
                        raise KeyError(f"Missing column {col} for {symbol}")
                
                # Set dtypes
                df = df.astype({
                    "Open": "float32",
                    "High": "float32",
                    "Low": "float32",
                    "Close": "float32",
                    "Volume": "float64",
                }).dropna()
                
                # Ensure datetime index
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)
                
                out[symbol] = df
                print(f"[DATA] Loaded {len(df)} bars for {symbol}")
                
            except Exception as e:
                print(f"[DATA] Error loading {symbol}: {e}")
                continue
        
        if not out:
            raise ValueError("No data loaded for any symbols")
        
        return out
    
    def get_data(self, symbol: str, start: str = None, end: str = None) -> pd.DataFrame:
        """
        Load data for a single symbol.
        
        Args:
            symbol: Ticker symbol
            start: Start date 'YYYY-MM-DD'
            end: End date 'YYYY-MM-DD'
            
        Returns:
            DataFrame with OHLCV columns and DatetimeIndex
        """
        result = self.load_bars([symbol], start, end)
        return result.get(symbol, pd.DataFrame())


# Module-level functions for backward compatibility
_data_source = DataSource()

def load_bars(symbols: list[str], start: str, end: str) -> dict[str, pd.DataFrame]:
    """Load bars for multiple symbols"""
    return _data_source.load_bars(symbols, start, end)

def get_data(symbol: str, start: str = None, end: str = None) -> pd.DataFrame:
    """Load data for single symbol"""
    return _data_source.get_data(symbol, start, end)
