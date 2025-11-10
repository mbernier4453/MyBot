"""
S3 Flatfile Data Loader for Massive.com (formerly Polygon)
Replaces yfinance with high-speed S3 flatfiles

Features:
- Downloads compressed CSV files from S3
- Local caching (Parquet format for speed)
- Supports both daily and minute-level aggregates
- Drop-in replacement for yfinance.download()
- Multi-ticker optimization (download once, split by ticker)
"""
import boto3
import pandas as pd
import gzip
import os
import sys
import time
from pathlib import Path
from datetime import datetime, timedelta
import io
from typing import Optional, Union, List, Dict

# Configuration
CACHE_DIR = Path(os.getenv('DATA_CACHE_DIR', './data_cache'))
S3_BUCKET = "flatfiles"
S3_ENDPOINT = "https://files.massive.com"
S3_PREFIX_DAY = "us_stocks_sip/day_aggs_v1"
S3_PREFIX_MIN = "us_stocks_sip/minute_aggs_v1"
MAX_CACHE_DAYS = int(os.getenv('DATA_CACHE_MAX_DAYS', '500'))


def init_s3_client():
    """Initialize S3 client with Massive.com credentials from environment"""
    access_key = os.getenv('MASSIVE_ACCESS_KEY') or os.getenv('AWS_ACCESS_KEY_ID')
    secret_key = os.getenv('MASSIVE_SECRET_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    
    if not access_key or not secret_key:
        raise ValueError(
            "Missing S3 credentials. Set MASSIVE_ACCESS_KEY and MASSIVE_SECRET_KEY "
            "in environment or .env file"
        )
    
    from botocore.config import Config
    
    return boto3.client(
        's3',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=S3_ENDPOINT,
        config=Config(signature_version='s3v4')
    )


def get_cache_path(date_str: str, timeframe: str = 'day') -> Path:
    """
    Get local cache file path for a specific date
    
    Args:
        date_str: Date in YYYY-MM-DD format
        timeframe: 'day' or 'minute'
    
    Returns:
        Path object for cache file
    """
    subdir = 'day_aggs' if timeframe == 'day' else 'minute_aggs'
    cache_path = CACHE_DIR / subdir / f"{date_str}.parquet"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    return cache_path


def download_date(s3_client, date_str: str, timeframe: str = 'day', silent: bool = False) -> Optional[pd.DataFrame]:
    """
    Download and cache a single date's data from S3
    
    Args:
        s3_client: Boto3 S3 client
        date_str: Date in YYYY-MM-DD format
        timeframe: 'day' or 'minute'
        silent: If True, suppress cache hit and S3 not found logging
    
    Returns:
        DataFrame with all tickers for that date, or None if error
    """
    cache_path = get_cache_path(date_str, timeframe)
    
    # Check cache first (with retry for file locking)
    if cache_path.exists():
        if not silent:
            print(f"[CACHE HIT] {date_str} ({timeframe})", file=sys.stderr)
        for attempt in range(10):  # Increased from 3 to 10 attempts
            try:
                df = pd.read_parquet(cache_path)
                # Validate the DataFrame is not empty and has expected columns
                if df.empty or 'ticker' not in df.columns:
                    print(f"[CACHE INVALID] {cache_path} - empty or missing columns", file=sys.stderr)
                    cache_path.unlink(missing_ok=True)
                    break
                return df
            except (OSError, PermissionError) as e:
                if attempt < 9:  # Retry on file locking errors
                    wait_time = 0.05 * (2 ** min(attempt, 5))  # Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1600ms...
                    if not silent:
                        print(f"[CACHE LOCKED] {cache_path} attempt {attempt + 1}/10, waiting {wait_time*1000:.0f}ms", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                print(f"[CACHE ERROR] Failed to read {cache_path} after {attempt + 1} retries: {e}", file=sys.stderr)
                # Don't delete file on permission errors - it may be in use legitimately
                # Return None to skip this date instead of crashing
                return None
            except Exception as e:
                print(f"[CACHE CORRUPTED] {cache_path}: {e}", file=sys.stderr)
                cache_path.unlink(missing_ok=True)
                break
    
    # Download from S3
    if not silent:
        print(f"[S3 DOWNLOAD] {date_str} ({timeframe})", file=sys.stderr)
    prefix = S3_PREFIX_DAY if timeframe == 'day' else S3_PREFIX_MIN
    year = date_str[:4]
    month = date_str[5:7]  # Extract month (01-12)
    s3_key = f"{prefix}/{year}/{month}/{date_str}.csv.gz"
    
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        compressed = response['Body'].read()
        
        # Decompress and parse CSV
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as gz:
            df = pd.read_csv(gz)
        
        # Convert window_start (nanoseconds) to datetime
        df['date'] = pd.to_datetime(df['window_start'], unit='ns', utc=True)
        
        # Convert to ET for market hours alignment
        df['date_et'] = df['date'].dt.tz_convert('America/New_York')
        
        # Save to cache with retry (avoid race conditions)
        for attempt in range(10):  # Increased from 3 to 10 attempts
            try:
                df.to_parquet(cache_path, compression='snappy')
                if not silent:
                    print(f"[CACHED] {date_str} -> {cache_path}", file=sys.stderr)
                break
            except (OSError, PermissionError) as e:
                if attempt < 9:
                    wait_time = 0.05 * (2 ** min(attempt, 5))  # Exponential backoff
                    if not silent:
                        print(f"[CACHE WRITE BLOCKED] {cache_path} attempt {attempt + 1}/10, waiting {wait_time*1000:.0f}ms", file=sys.stderr)
                    time.sleep(wait_time)
                else:
                    print(f"[CACHE WRITE FAILED] {date_str}: {e}", file=sys.stderr)
        
        return df
        
    except s3_client.exceptions.NoSuchKey:
        if not silent:
            print(f"[S3 NOT FOUND] {s3_key} (non-trading day or future date)", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[ERROR] Failed to download {date_str}: {e}", file=sys.stderr)
        return None


def load_bars(
    ticker: str,
    start_date: Union[str, datetime],
    end_date: Union[str, datetime],
    timeframe: str = 'day',
    interval: str = '1d'  # For yfinance compatibility
) -> pd.DataFrame:
    """
    Load bar data for a single ticker (drop-in replacement for yfinance.download)
    
    Args:
        ticker: Stock symbol (e.g., 'AAPL')
        start_date: Start date (str 'YYYY-MM-DD' or datetime)
        end_date: End date (str 'YYYY-MM-DD' or datetime)
        timeframe: 'day' or 'minute'
        interval: Ignored (kept for yfinance compatibility)
    
    Returns:
        DataFrame with OHLCV columns, DatetimeIndex
        Columns: Open, High, Low, Close, Volume
        Index: DatetimeIndex (timezone-aware, ET)
    """
    s3 = init_s3_client()
    
    # Convert dates to datetime
    if isinstance(start_date, str):
        start_date = pd.to_datetime(start_date)
    if isinstance(end_date, str):
        end_date = pd.to_datetime(end_date)
    
    # Enforce minimum dates based on S3 data availability
    # Daily data: April 17, 2003+
    # Minute data: November 7, 2025+ (very recent)
    min_date_day = pd.to_datetime('2003-04-17')
    min_date_minute = pd.to_datetime('2025-11-07')
    
    if timeframe == 'day' and start_date < min_date_day:
        print(f"[WARNING] Start date {start_date.date()} is before S3 daily data availability (2003-04-17). Adjusting to 2003-04-17.", file=sys.stderr)
        start_date = min_date_day
    elif timeframe == 'minute' and start_date < min_date_minute:
        print(f"[WARNING] Start date {start_date.date()} is before S3 minute data availability (2025-11-07). Adjusting to 2025-11-07.", file=sys.stderr)
        start_date = min_date_minute
    
    # Generate date range (business days only to avoid unnecessary downloads)
    date_range = pd.date_range(start_date, end_date, freq='B')  # B = business days
    
    # OPTIMIZATION: Batch check which cache files exist to avoid sequential logging overhead
    # Build list of dates with existing cache files
    dates_with_cache = []
    dates_to_check_s3 = []
    
    for date in date_range:
        date_str = date.strftime('%Y-%m-%d')
        cache_path = get_cache_path(date_str, timeframe)
        
        if cache_path.exists():
            dates_with_cache.append(date_str)
        else:
            dates_to_check_s3.append(date_str)
    
    # Batch read all cache files (reduces logging noise)
    all_data = []
    for date_str in dates_with_cache:
        cache_path = get_cache_path(date_str, timeframe)
        try:
            df = pd.read_parquet(cache_path)
            ticker_data = df[df['ticker'] == ticker].copy()
            if not ticker_data.empty:
                all_data.append(ticker_data)
        except Exception as e:
            print(f"[CACHE ERROR] {date_str}: {e}", file=sys.stderr)
    
    # Only log cache hits once at the end (reduces stderr spam)
    if dates_with_cache:
        print(f"[CACHE BATCH] Loaded {len(dates_with_cache)} cached dates for {ticker}", file=sys.stderr)
    
    # Check S3 for missing dates (holidays will be skipped) - use silent mode to reduce log spam
    for date_str in dates_to_check_s3:
        df = download_date(s3, date_str, timeframe, silent=True)
        if df is not None:
            ticker_data = df[df['ticker'] == ticker].copy()
            if not ticker_data.empty:
                all_data.append(ticker_data)
    
    if not all_data:
        print(f"[WARNING] No data found for {ticker} between {start_date} and {end_date}", file=sys.stderr)
        return pd.DataFrame()
    
    # Combine all dates
    result = pd.concat(all_data, ignore_index=True)
    
    # Rename columns to match yfinance format
    result = result.rename(columns={
        'open': 'Open',
        'high': 'High',
        'low': 'Low',
        'close': 'Close',
        'volume': 'Volume'
    })
    
    # Use ET timezone for index
    result = result.set_index('date_et')
    result.index.name = None  # Remove index name for yfinance compatibility
    result = result.sort_index()
    
    # Return only OHLCV columns (drop ticker, vwap, etc.)
    return result[['Open', 'High', 'Low', 'Close', 'Volume']]


def load_multiple_tickers(
    tickers: List[str],
    start_date: Union[str, datetime],
    end_date: Union[str, datetime],
    timeframe: str = 'day'
) -> Dict[str, pd.DataFrame]:
    """
    Optimized multi-ticker loading
    Downloads each date file once, splits by ticker
    Much faster than calling load_bars() multiple times
    
    Args:
        tickers: List of stock symbols
        start_date: Start date (str or datetime)
        end_date: End date (str or datetime)
        timeframe: 'day' or 'minute'
    
    Returns:
        Dict mapping ticker -> DataFrame with OHLCV data
    """
    s3 = init_s3_client()
    
    if isinstance(start_date, str):
        start_date = pd.to_datetime(start_date)
    if isinstance(end_date, str):
        end_date = pd.to_datetime(end_date)
    
    date_range = pd.date_range(start_date, end_date, freq='B')
    
    # Initialize result storage
    result = {ticker: [] for ticker in tickers}
    
    # Download each date once, split by ticker
    for date in date_range:
        date_str = date.strftime('%Y-%m-%d')
        df = download_date(s3, date_str, timeframe)
        
        if df is not None:
            for ticker in tickers:
                ticker_data = df[df['ticker'] == ticker].copy()
                if not ticker_data.empty:
                    result[ticker].append(ticker_data)
    
    # Combine and format each ticker
    formatted = {}
    for ticker, data_list in result.items():
        if data_list:
            combined = pd.concat(data_list, ignore_index=True)
            combined = combined.rename(columns={
                'open': 'Open',
                'high': 'High',
                'low': 'Low',
                'close': 'Close',
                'volume': 'Volume'
            })
            combined = combined.set_index('date_et')
            combined.index.name = None
            combined = combined.sort_index()
            formatted[ticker] = combined[['Open', 'High', 'Low', 'Close', 'Volume']]
        else:
            print(f"[WARNING] No data found for {ticker}", file=sys.stderr)
            formatted[ticker] = pd.DataFrame()
    
    return formatted


def cleanup_old_cache(days_to_keep: int = MAX_CACHE_DAYS):
    """
    Remove cached files older than specified days to manage disk space
    
    Args:
        days_to_keep: Number of days to keep in cache (default from env)
    """
    if not CACHE_DIR.exists():
        return
    
    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
    removed_count = 0
    
    for timeframe_dir in CACHE_DIR.iterdir():
        if not timeframe_dir.is_dir():
            continue
            
        for cache_file in timeframe_dir.glob('*.parquet'):
            # Extract date from filename (YYYY-MM-DD.parquet)
            try:
                file_date_str = cache_file.stem  # Remove .parquet
                file_date = datetime.strptime(file_date_str, '%Y-%m-%d')
                
                if file_date < cutoff_date:
                    cache_file.unlink()
                    removed_count += 1
            except (ValueError, OSError) as e:
                print(f"[CACHE CLEANUP] Error processing {cache_file}: {e}", file=sys.stderr)
    
    if removed_count > 0:
        print(f"[CACHE CLEANUP] Removed {removed_count} old cache files", file=sys.stderr)


def get_cache_stats() -> dict:
    """
    Get statistics about current cache
    
    Returns:
        Dict with cache size, file count, date range
    """
    if not CACHE_DIR.exists():
        return {
            'exists': False,
            'total_size_mb': 0,
            'file_count': 0
        }
    
    total_size = 0
    file_count = 0
    dates = []
    
    for timeframe_dir in CACHE_DIR.iterdir():
        if not timeframe_dir.is_dir():
            continue
            
        for cache_file in timeframe_dir.glob('*.parquet'):
            total_size += cache_file.stat().st_size
            file_count += 1
            try:
                dates.append(cache_file.stem)
            except:
                pass
    
    dates.sort()
    
    return {
        'exists': True,
        'total_size_mb': round(total_size / (1024 * 1024), 2),
        'file_count': file_count,
        'oldest_date': dates[0] if dates else None,
        'newest_date': dates[-1] if dates else None,
        'cache_dir': str(CACHE_DIR)
    }


# Alias for direct yfinance replacement
download = load_bars


if __name__ == '__main__':
    """
    Test script - run with: python -m backtester.s3_data
    """
    print("=" * 60)
    print("S3 Data Loader Test")
    print("=" * 60)
    
    # Test single ticker
    print("\n[TEST 1] Loading AAPL data (last 5 trading days)...")
    end = datetime.now()
    start = end - timedelta(days=7)
    
    try:
        aapl_data = load_bars('AAPL', start, end)
        print(f"✓ Loaded {len(aapl_data)} rows")
        print(aapl_data.head())
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Test multi-ticker
    print("\n[TEST 2] Loading multiple tickers (AAPL, MSFT, GOOGL)...")
    try:
        multi_data = load_multiple_tickers(['AAPL', 'MSFT', 'GOOGL'], start, end)
        for ticker, df in multi_data.items():
            print(f"  {ticker}: {len(df)} rows")
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Show cache stats
    print("\n[CACHE STATS]")
    stats = get_cache_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    print("\n" + "=" * 60)
    print("Test complete!")
