"""
Massive.com REST API Data Loader
Replaces S3 flatfiles with REST API for adjusted OHLCV data

Features:
- Downloads adjusted data (stock splits handled correctly)
- Local caching (Parquet format for speed)
- Supports daily aggregates back to 2003-09-10
- Rate limiting and retry logic
- Drop-in replacement for s3_data.py
"""
import requests
import pandas as pd
import os
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Union, List, Dict
import json

# Configuration
CACHE_DIR = Path(os.getenv('DATA_CACHE_DIR', './data_cache'))
API_BASE_URL = "https://api.massive.com"
MAX_CACHE_DAYS = int(os.getenv('DATA_CACHE_MAX_DAYS', '500'))
API_RATE_LIMIT_DELAY = float(os.getenv('MASSIVE_API_RATE_LIMIT_DELAY', '0.2'))  # seconds between requests
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Earliest available date from REST API
MIN_DATE = datetime(2003, 9, 10)


def get_api_key() -> str:
    """Get Massive.com API key from environment"""
    api_key = os.getenv('MASSIVE_API_KEY')
    if not api_key:
        raise ValueError(
            "Missing API key. Set MASSIVE_API_KEY in environment or .env file"
        )
    return api_key


def get_cache_path(ticker: str, start_date: str, end_date: str) -> Path:
    """
    Get local cache file path for a specific ticker and date range
    
    Args:
        ticker: Stock ticker symbol
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        Path to cache file
    """
    cache_subdir = CACHE_DIR / 'api_daily' / ticker
    cache_subdir.mkdir(parents=True, exist_ok=True)
    return cache_subdir / f"{ticker}_{start_date}_{end_date}.parquet"


def fetch_ohlcv_from_api(ticker: str, start_date: str, end_date: str, adjusted: bool = True) -> pd.DataFrame:
    """
    Fetch OHLCV data from Massive.com REST API
    
    Args:
        ticker: Stock ticker symbol (case-sensitive)
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        adjusted: Whether to get adjusted data (default True for stock splits)
    
    Returns:
        DataFrame with columns: date, open, high, low, close, volume
    
    Raises:
        Exception: If API request fails after retries
    """
    api_key = get_api_key()
    
    # Build API URL: /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
    url = f"{API_BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day/{start_date}/{end_date}"
    
    params = {
        'adjusted': str(adjusted).lower(),
        'sort': 'asc',
        'limit': 50000
    }
    
    headers = {
        'Authorization': f'Bearer {api_key}'
    }
    
    for attempt in range(MAX_RETRIES):
        try:
            print(f"[API] Fetching {ticker} from {start_date} to {end_date} (adjusted={adjusted})")
            response = requests.get(url, params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') != 'OK':
                    raise Exception(f"API returned status: {data.get('status')}")
                
                results = data.get('results', [])
                if not results:
                    print(f"[API] No data returned for {ticker} in range {start_date} to {end_date}")
                    return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
                
                # Convert API response to DataFrame
                df = pd.DataFrame(results)
                
                # API response format:
                # t: timestamp (milliseconds), o: open, h: high, l: low, c: close, v: volume
                # n: number of transactions, vw: volume weighted average
                df = df.rename(columns={
                    't': 'timestamp',
                    'o': 'open',
                    'h': 'high',
                    'l': 'low',
                    'c': 'close',
                    'v': 'volume'
                })
                
                # Convert timestamp to date
                df['date'] = pd.to_datetime(df['timestamp'], unit='ms').dt.date
                df['date'] = pd.to_datetime(df['date'])
                
                # Select and order columns
                df = df[['date', 'open', 'high', 'low', 'close', 'volume']]
                
                print(f"[API] Retrieved {len(df)} bars for {ticker}")
                
                # Rate limiting
                time.sleep(API_RATE_LIMIT_DELAY)
                
                return df
            
            elif response.status_code == 429:
                # Rate limit hit
                retry_after = int(response.headers.get('Retry-After', RETRY_DELAY * (attempt + 1)))
                print(f"[API] Rate limit hit for {ticker}, retrying in {retry_after}s...")
                time.sleep(retry_after)
                
            elif response.status_code == 404:
                print(f"[API] Ticker {ticker} not found")
                return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
                
            else:
                print(f"[API] Error {response.status_code} for {ticker}: {response.text}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    raise Exception(f"API request failed with status {response.status_code}: {response.text}")
        
        except requests.exceptions.Timeout:
            print(f"[API] Timeout for {ticker}, attempt {attempt + 1}/{MAX_RETRIES}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                raise
        
        except Exception as e:
            print(f"[API] Error fetching {ticker}: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                raise
    
    raise Exception(f"Failed to fetch data for {ticker} after {MAX_RETRIES} retries")


def load_bars(
    ticker: str,
    start_date: Union[str, datetime],
    end_date: Union[str, datetime],
    use_cache: bool = True,
    adjusted: bool = True
) -> pd.DataFrame:
    """
    Load OHLCV bars for a ticker, using cache if available
    
    Args:
        ticker: Stock ticker symbol
        start_date: Start date (YYYY-MM-DD string or datetime)
        end_date: End date (YYYY-MM-DD string or datetime)
        use_cache: Whether to use cached data (default True)
        adjusted: Whether to get adjusted data (default True for stock splits)
    
    Returns:
        DataFrame with columns: date, open, high, low, close, volume
    """
    # Convert dates to strings
    if isinstance(start_date, datetime):
        start_date = start_date.strftime('%Y-%m-%d')
    if isinstance(end_date, datetime):
        end_date = end_date.strftime('%Y-%m-%d')
    
    # Enforce minimum date
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    if start_dt < MIN_DATE:
        print(f"[API] Warning: {start_date} is before minimum date {MIN_DATE.strftime('%Y-%m-%d')}, adjusting...")
        start_date = MIN_DATE.strftime('%Y-%m-%d')
    
    # Check cache first
    cache_path = get_cache_path(ticker, start_date, end_date)
    if use_cache and cache_path.exists():
        try:
            df = pd.read_parquet(cache_path)
            print(f"[CACHE] Loaded {ticker} from cache: {len(df)} bars")
            return df
        except Exception as e:
            print(f"[CACHE] Error reading cache for {ticker}: {e}, fetching fresh data")
    
    # Fetch from API
    df = fetch_ohlcv_from_api(ticker, start_date, end_date, adjusted=adjusted)
    
    # Cache the result
    if not df.empty and use_cache:
        try:
            df.to_parquet(cache_path, index=False)
            print(f"[CACHE] Saved {ticker} to cache: {cache_path}")
        except Exception as e:
            print(f"[CACHE] Error saving cache for {ticker}: {e}")
    
    return df


def load_multiple_tickers(
    tickers: List[str],
    start_date: Union[str, datetime],
    end_date: Union[str, datetime],
    use_cache: bool = True,
    adjusted: bool = True
) -> Dict[str, pd.DataFrame]:
    """
    Load bars for multiple tickers
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date (YYYY-MM-DD string or datetime)
        end_date: End date (YYYY-MM-DD string or datetime)
        use_cache: Whether to use cached data (default True)
        adjusted: Whether to get adjusted data (default True for stock splits)
    
    Returns:
        Dictionary mapping ticker to DataFrame
    """
    results = {}
    
    for ticker in tickers:
        try:
            df = load_bars(ticker, start_date, end_date, use_cache=use_cache, adjusted=adjusted)
            results[ticker] = df
        except Exception as e:
            print(f"[ERROR] Failed to load {ticker}: {e}")
            results[ticker] = pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
    
    return results


def clear_cache(ticker: Optional[str] = None):
    """
    Clear cached data
    
    Args:
        ticker: Optional ticker to clear (clears all if None)
    """
    if ticker:
        ticker_cache_dir = CACHE_DIR / 'api_daily' / ticker
        if ticker_cache_dir.exists():
            import shutil
            shutil.rmtree(ticker_cache_dir)
            print(f"[CACHE] Cleared cache for {ticker}")
    else:
        if CACHE_DIR.exists():
            import shutil
            shutil.rmtree(CACHE_DIR)
            print(f"[CACHE] Cleared all cache")


def get_cache_info() -> Dict:
    """
    Get information about cached data
    
    Returns:
        Dictionary with cache statistics
    """
    if not CACHE_DIR.exists():
        return {'total_files': 0, 'total_size_mb': 0}
    
    cache_files = list(CACHE_DIR.rglob('*.parquet'))
    total_size = sum(f.stat().st_size for f in cache_files)
    
    return {
        'total_files': len(cache_files),
        'total_size_mb': round(total_size / 1024 / 1024, 2),
        'cache_dir': str(CACHE_DIR)
    }


# Backward compatibility aliases
download_date = load_bars  # For compatibility with old s3_data.py code


if __name__ == '__main__':
    # Test the module
    print("Testing Massive.com REST API data loader...")
    
    # Test single ticker
    ticker = 'AAPL'
    start = '2024-01-01'
    end = '2024-11-29'
    
    print(f"\nFetching {ticker} from {start} to {end}")
    df = load_bars(ticker, start, end)
    print(f"\nResult:")
    print(df.head())
    print(f"\nTotal bars: {len(df)}")
    
    # Show cache info
    print("\nCache info:")
    print(get_cache_info())
