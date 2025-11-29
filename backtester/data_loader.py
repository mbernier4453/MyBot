"""
Unified data loader with toggle between REST API, S3 flatfiles, and yfinance
This is the main entry point for all data loading in backtester

NOTE: S3 flatfiles contain UNADJUSTED data (no stock splits) and should be avoided.
      REST API is the preferred source with adjusted data.
"""
import os
import sys
from typing import Union, List, Dict
from datetime import datetime
import pandas as pd

# Determine data source - prefer REST API (adjusted data)
USE_API_DATA = os.getenv('USE_API_DATA', 'true').lower() in ('true', '1', 'yes', 'on')
USE_S3_DATA = os.getenv('USE_S3_DATA', 'false').lower() in ('true', '1', 'yes', 'on')

if USE_API_DATA:
    try:
        from backtester import massive_api_data
        DATA_SOURCE = 'REST_API'
        print(f"[DATA SOURCE] Using Massive.com REST API (adjusted data)", file=sys.stderr)
    except ImportError as e:
        print(f"[DATA SOURCE] REST API import failed ({e}), falling back", file=sys.stderr)
        USE_S3_DATA = True

if USE_S3_DATA and not USE_API_DATA:
    try:
        from backtester import s3_data
        DATA_SOURCE = 'S3_FLATFILES'
        print(f"[DATA SOURCE] Using Massive.com S3 Flatfiles (WARNING: UNADJUSTED DATA)", file=sys.stderr)
    except ImportError as e:
        print(f"[DATA SOURCE] S3 import failed ({e}), falling back to yfinance", file=sys.stderr)
        import yfinance as yf
        DATA_SOURCE = 'YFINANCE'
elif not USE_API_DATA:
    import yfinance as yf
    DATA_SOURCE = 'YFINANCE'
    print(f"[DATA SOURCE] Using yfinance", file=sys.stderr)


def get_data_source() -> str:
    """
    Get current data source being used
    
    Returns:
        'REST_API', 'S3_FLATFILES', or 'YFINANCE'
    """
    return DATA_SOURCE


def load_bars(
    ticker: str,
    start: Union[str, datetime],
    end: Union[str, datetime],
    interval: str = '1d',
    timeframe: str = 'day'
) -> pd.DataFrame:
    """
    Load bar data - automatically uses REST API, S3, or yfinance based on config
    
    Args:
        ticker: Stock symbol
        start: Start date
        end: End date
        interval: Time interval ('1d', '1m', etc.) - for yfinance compatibility
        timeframe: 'day' or 'minute' - for S3 flatfiles
    
    Returns:
        DataFrame with OHLCV data (adjusted for stock splits if using REST API)
    """
    if DATA_SOURCE == 'REST_API':
        # Use REST API (adjusted data by default)
        # REST API only supports daily data
        df = massive_api_data.load_bars(ticker, start, end, adjusted=True)
        
        # Rename columns to match expected format (Title Case like S3/yfinance)
        if not df.empty:
            # date, open, high, low, close, volume -> Open, High, Low, Close, Volume
            df = df.rename(columns={
                'open': 'Open',
                'high': 'High',
                'low': 'Low',
                'close': 'Close',
                'volume': 'Volume'
            })
            df = df.set_index('date')
        
        return df
    
    elif DATA_SOURCE == 'S3_FLATFILES':
        # Convert interval to timeframe if needed
        if interval == '1m':
            timeframe = 'minute'
        elif interval == '1d':
            timeframe = 'day'
        
        return s3_data.load_bars(ticker, start, end, timeframe=timeframe)
    else:
        # Use yfinance
        data = yf.download(ticker, start=start, end=end, interval=interval, progress=False)
        if data.empty:
            print(f"[WARNING] No data found for {ticker} between {start} and {end}")
        return data


def load_multiple_tickers(
    tickers: List[str],
    start: Union[str, datetime],
    end: Union[str, datetime],
    interval: str = '1d',
    timeframe: str = 'day'
) -> Dict[str, pd.DataFrame]:
    """
    Load data for multiple tickers
    Optimized for REST API and S3 (parallel fetching with caching)
    
    Args:
        tickers: List of stock symbols
        start: Start date
        end: End date
        interval: Time interval (for yfinance)
        timeframe: 'day' or 'minute' (for S3)
    
    Returns:
        Dict mapping ticker -> DataFrame
    """
    if DATA_SOURCE == 'REST_API':
        # Use REST API with adjusted data
        result = massive_api_data.load_multiple_tickers(tickers, start, end, adjusted=True)
        
        # Format each DataFrame to match expected column names (Title Case)
        for ticker, df in result.items():
            if not df.empty:
                df = df.rename(columns={
                    'open': 'Open',
                    'high': 'High',
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                result[ticker] = df.set_index('date')
        
        return result
    
    elif DATA_SOURCE == 'S3_FLATFILES':
        if interval == '1m':
            timeframe = 'minute'
        elif interval == '1d':
            timeframe = 'day'
        
        return s3_data.load_multiple_tickers(tickers, start, end, timeframe=timeframe)
    else:
        # Use yfinance (slower, one ticker at a time)
        result = {}
        for ticker in tickers:
            data = yf.download(ticker, start=start, end=end, interval=interval, progress=False)
            result[ticker] = data
        return result


# Backward compatibility aliases
get_data = load_bars
download = load_bars


if __name__ == '__main__':
    """Test the data loader"""
    print("=" * 60)
    print(f"Data Loader Test - Source: {DATA_SOURCE}")
    print("=" * 60)
    
    from datetime import timedelta
    
    end = datetime.now()
    start = end - timedelta(days=7)
    
    print(f"\n[TEST] Loading AAPL data...")
    try:
        data = load_bars('AAPL', start, end)
        print(f"✓ Loaded {len(data)} rows")
        print(data.head())
    except Exception as e:
        print(f"✗ Error: {e}")
    
    if DATA_SOURCE == 'REST_API':
        print(f"\n[CACHE INFO]")
        info = massive_api_data.get_cache_info()
        for key, value in info.items():
            print(f"  {key}: {value}")
    elif DATA_SOURCE == 'S3_FLATFILES':
        print(f"\n[CACHE STATS]")
        stats = s3_data.get_cache_stats()
        for key, value in stats.items():
            print(f"  {key}: {value}")
