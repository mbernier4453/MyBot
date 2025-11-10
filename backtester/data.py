"""
Fetch OHLCV data - supports both S3 flatfiles and yfinance
Toggle via USE_S3_DATA environment variable
"""
import os
import pandas as pd
from .settings import get

# Import unified data loader
from .data_loader import load_bars as data_loader_load_bars, get_data_source

OHLCV = ["Open", "High", "Low", "Close", "Volume"]

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a DataFrame with columns exactly OHLCV.
    Works for:
      - flat columns
      - MultiIndex with ('Field','Ticker') or ('Ticker','Field')
    """
    if df.empty:
        return df

    cols = df.columns

    # Case 1: already flat with required fields
    if not isinstance(cols, pd.MultiIndex):
        missing = [c for c in OHLCV if c not in cols]
        if missing:
            # Some yfinance builds name columns oddly; try to coerce casing
            raise KeyError(f"Missing columns after download: {missing}")
        return df[OHLCV]

    # Case 2: MultiIndex. Pick the element that matches each OHLCV once.
    picked = {}
    for field in OHLCV:
        # Find the first column tuple that contains the field at any level
        matches = [c for c in cols if field in c]
        if not matches:
            raise KeyError(f"Field '{field}' not found in yfinance columns {list(cols)}")
        picked[field] = df[matches[0]]

    out = pd.concat(picked, axis=1)
    out.columns = OHLCV
    return out

def load_bars(symbols: list[str]) -> dict[str, pd.DataFrame]:
    """
    Load OHLCV bars for multiple symbols using configured data source
    
    Args:
        symbols: List of ticker symbols
    
    Returns:
        Dict mapping symbol -> DataFrame with OHLCV columns
    """
    start, end = get("START"), get("END")
    
    print(f"[DATA] Loading {len(symbols)} symbols using {get_data_source()}")
    
    out: dict[str, pd.DataFrame] = {}
    for symbol in symbols:
        try:
            df = data_loader_load_bars(symbol, start=start, end=end)
            
            if df.empty:
                print(f"[DATA] No data for {symbol}")
                continue
            
            # Ensure OHLCV columns exist
            missing = [c for c in OHLCV if c not in df.columns]
            if missing:
                print(f"[DATA] {symbol} missing columns: {missing}")
                continue
            
            # Types and index
            df = df[OHLCV].astype({
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
            
        except Exception as e:
            print(f"[DATA] Error loading {symbol}: {e}")
            continue
    
    if not out:
        raise ValueError(f"No data loaded for any symbol. Data source: {get_data_source()}")
    
    return out

def get_data(symbol: str, start=None, end=None):
    """
    Unified loader returning a DataFrame with at least a 'close' column.
    Uses configured data source (S3 or yfinance)
    
    Args:
        symbol: Ticker symbol
        start: Start date (optional)
        end: End date (optional)
    
    Returns:
        DataFrame with at least 'close' column, DatetimeIndex
    """
    try:
        # Use unified data loader
        df = data_loader_load_bars(symbol, start=start, end=end)
        
        if df.empty:
            raise ValueError(f"No data returned for {symbol}")
        
        # Normalize column names to lowercase
        df.columns = [col.lower() for col in df.columns]
        
        # Ensure 'close' column exists
        if "close" not in df.columns:
            for alt in ["adj_close", "adjclose", "adj close", "price", "last"]:
                if alt in df.columns:
                    df = df.rename(columns={alt: "close"})
                    break
        
        if "close" not in df.columns:
            raise ValueError(f"No close column found for {symbol}")
        
        # Ensure datetime index
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        return df
        
    except Exception as e:
        raise ValueError(f"Unable to load data for {symbol}: {e}")
