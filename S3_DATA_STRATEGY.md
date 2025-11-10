# S3 Flatfile Data Strategy (Massive.com)

## Overview
Replace yfinance with Massive.com (formerly Polygon) S3 flatfiles for:
- **Speed:** Pre-downloaded CSVs vs API calls per request
- **Granularity:** Minute-level candles (not just daily)
- **Reliability:** No API rate limits or downtime
- **History:** Back to 2003 for all US stocks

---

## Data Available

### 1. Day Aggregates (Perfect for most backtests)
- **Path:** `s3://us_stocks_sip/day_aggs_v1/YYYY/YYYY-MM-DD.csv.gz`
- **Size:** ~50MB per day (compressed)
- **Columns:** ticker, open, high, low, close, volume, vwap, timestamp
- **History:** Sept 10, 2003 → Present
- **Update:** Daily at 11:00 AM ET (previous day's data)

### 2. Minute Aggregates (For intraday strategies)
- **Path:** `s3://us_stocks_sip/minute_aggs_v1/YYYY/YYYY-MM-DD.csv.gz`
- **Size:** ~4-5GB per day (compressed)
- **Columns:** Same as day aggs but per minute
- **Use Case:** Intraday backtests, fine-grained entries/exits

### 3. Trades & Quotes (Not needed for backtesting)
- Too granular (nanosecond timestamps)
- Massive file sizes (100s of GB per day)
- Skip unless doing HFT research

---

## Implementation Strategy

### Phase 1: Data Loader Module (START HERE)
Create `backtester/s3_data.py` to:
1. Download S3 flatfiles (boto3)
2. Cache locally (avoid re-downloading)
3. Filter by ticker(s) and date range
4. Return pandas DataFrame in same format as yfinance

**Key Design:** Drop-in replacement for `yfinance.download()`

```python
# Current code (yfinance)
data = yf.download(ticker, start=start_date, end=end_date)

# New code (S3 flatfiles)
data = s3_data.load_bars(ticker, start=start_date, end=end_date)

# SAME RESULT FORMAT!
```

### Phase 2: Local Caching Strategy
**Problem:** Can't download 4-5GB every time we backtest

**Solution:** Local file cache
```
data_cache/
├── day_aggs/
│   ├── 2024-01-02.parquet       # Converted to Parquet (smaller)
│   ├── 2024-01-03.parquet
│   └── ...
└── minute_aggs/
    ├── 2024-01-02.parquet
    └── ...
```

**Cache Logic:**
1. Check if date exists in local cache
2. If YES → load from cache (fast!)
3. If NO → download from S3, save to cache, return data
4. Keep last N days in cache (configurable, e.g., 500 days = ~1 year backtest data)

### Phase 3: Multi-Ticker Optimization
**Current yfinance:** Downloads each ticker separately (slow)
**S3 flatfiles:** Each file contains ALL tickers for that day!

**Optimization:**
```python
# Instead of:
for ticker in ['AAPL', 'GOOGL', 'MSFT']:
    data[ticker] = download(ticker, dates)  # 3 downloads

# Do this:
all_data = load_day_file('2024-01-02')  # 1 download, all tickers
data = {ticker: all_data[all_data.ticker == ticker] for ticker in tickers}
```

---

## File Format Details

### Day Aggregates CSV Structure
```csv
ticker,open,high,low,close,volume,vwap,timestamp
AAPL,185.23,186.45,184.10,185.92,52431200,185.45,1704240000
MSFT,370.15,372.80,369.50,371.23,18234500,371.10,1704240000
...
```

### Timestamp Conversion
**Important:** Timestamps are in UTC (Unix epoch seconds)
```python
# Convert to datetime
df['date'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)

# Convert to ET for market hours
df['date_et'] = df['date'].dt.tz_convert('America/New_York')
```

---

## AWS S3 Access Setup

### 1. Install boto3
```bash
pip install boto3
```

### 2. Configure AWS Credentials
Massive.com uses standard AWS S3 credentials:

**Option A:** Environment variables
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

**Option B:** AWS credentials file (`~/.aws/credentials`)
```ini
[default]
aws_access_key_id = your_key
aws_secret_access_key = your_secret
```

**Option C:** .env file (recommended for this project)
```env
MASSIVE_ACCESS_KEY=your_key
MASSIVE_SECRET_KEY=your_secret
```

### 3. S3 Bucket Details
- **Bucket:** `flatfiles` (or check Massive.com dashboard)
- **Region:** `us-east-1` (typical, verify with Massive)
- **Endpoint:** Standard AWS S3 endpoint

---

## Code Implementation Plan

### File: `backtester/s3_data.py`

```python
"""
S3 Flatfile data loader - replaces yfinance
"""
import boto3
import pandas as pd
import gzip
import os
from pathlib import Path
from datetime import datetime, timedelta
import io

CACHE_DIR = Path("./data_cache")
S3_BUCKET = "flatfiles"
S3_PREFIX_DAY = "us_stocks_sip/day_aggs_v1"
S3_PREFIX_MIN = "us_stocks_sip/minute_aggs_v1"

def init_s3_client():
    """Initialize S3 client with Massive.com credentials"""
    return boto3.client(
        's3',
        aws_access_key_id=os.getenv('MASSIVE_ACCESS_KEY'),
        aws_secret_access_key=os.getenv('MASSIVE_SECRET_KEY'),
        region_name='us-east-1'
    )

def get_cache_path(date_str, timeframe='day'):
    """Get local cache file path"""
    subdir = 'day_aggs' if timeframe == 'day' else 'minute_aggs'
    cache_path = CACHE_DIR / subdir / f"{date_str}.parquet"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    return cache_path

def download_date(s3_client, date_str, timeframe='day'):
    """Download and cache a single date's data"""
    cache_path = get_cache_path(date_str, timeframe)
    
    # Check cache first
    if cache_path.exists():
        print(f"[CACHE HIT] {date_str}")
        return pd.read_parquet(cache_path)
    
    # Download from S3
    print(f"[S3 DOWNLOAD] {date_str}")
    prefix = S3_PREFIX_DAY if timeframe == 'day' else S3_PREFIX_MIN
    year = date_str[:4]
    s3_key = f"{prefix}/{year}/{date_str}.csv.gz"
    
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        compressed = response['Body'].read()
        
        # Decompress and parse CSV
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as gz:
            df = pd.read_csv(gz)
        
        # Convert timestamp to datetime
        df['date'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)
        
        # Save to cache
        df.to_parquet(cache_path, compression='snappy')
        
        return df
    except Exception as e:
        print(f"[ERROR] Failed to download {date_str}: {e}")
        return None

def load_bars(ticker, start_date, end_date, timeframe='day'):
    """
    Load bar data for a ticker (replaces yf.download)
    
    Args:
        ticker: Stock symbol (e.g., 'AAPL')
        start_date: Start date (str or datetime)
        end_date: End date (str or datetime)
        timeframe: 'day' or 'minute'
    
    Returns:
        DataFrame with columns: Open, High, Low, Close, Volume
        Index: DatetimeIndex
    """
    s3 = init_s3_client()
    
    # Convert dates to strings
    if isinstance(start_date, str):
        start_date = pd.to_datetime(start_date)
    if isinstance(end_date, str):
        end_date = pd.to_datetime(end_date)
    
    # Generate date range (trading days only)
    date_range = pd.date_range(start_date, end_date, freq='B')  # B = business days
    
    all_data = []
    for date in date_range:
        date_str = date.strftime('%Y-%m-%d')
        df = download_date(s3, date_str, timeframe)
        
        if df is not None:
            # Filter to requested ticker
            ticker_data = df[df['ticker'] == ticker].copy()
            if not ticker_data.empty:
                all_data.append(ticker_data)
    
    if not all_data:
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
    
    # Set date as index
    result = result.set_index('date')
    result = result.sort_index()
    
    # Return only OHLCV columns
    return result[['Open', 'High', 'Low', 'Close', 'Volume']]

def load_multiple_tickers(tickers, start_date, end_date, timeframe='day'):
    """
    Optimized multi-ticker loading
    Downloads each date file once, splits by ticker
    """
    s3 = init_s3_client()
    
    if isinstance(start_date, str):
        start_date = pd.to_datetime(start_date)
    if isinstance(end_date, str):
        end_date = pd.to_datetime(end_date)
    
    date_range = pd.date_range(start_date, end_date, freq='B')
    
    result = {ticker: [] for ticker in tickers}
    
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
            combined = combined.set_index('date').sort_index()
            formatted[ticker] = combined[['Open', 'High', 'Low', 'Close', 'Volume']]
    
    return formatted
```

---

## Migration Steps

### Step 1: Create S3 Data Module ✅
- Implement `backtester/s3_data.py`
- Test downloading a single date
- Test caching mechanism
- Test multi-ticker optimization

### Step 2: Update `backtester/data.py`
Replace yfinance calls:

```python
# OLD
import yfinance as yf
def get_data(ticker, start, end):
    return yf.download(ticker, start=start, end=end)

# NEW
from backtester import s3_data
def get_data(ticker, start, end):
    return s3_data.load_bars(ticker, start, end)
```

### Step 3: Update All Import Locations
Search and replace across:
- `backtester/engine.py`
- `dynamic_backtest.py`
- `load_preview_data.py`
- Any other files using yfinance

### Step 4: Test Backtests
- Run existing backtests with S3 data
- Verify results match (or are better!)
- Check cache performance

### Step 5: Add Minute Timeframe Support
- Update indicators to handle minute data
- Add timeframe parameter to backtest configs
- Test intraday strategies

---

## Performance Expectations

### Current (yfinance)
- 1 ticker, 1 year: ~3-5 seconds
- 10 tickers, 1 year: ~30-50 seconds
- Network dependent, unreliable

### With S3 Flatfiles (first run)
- Download ~50MB per day
- 252 trading days/year = ~12GB download
- ~2-3 minutes first time (network dependent)

### With S3 Flatfiles (cached)
- Reading from local parquet files
- 1 ticker, 1 year: <0.5 seconds
- 10 tickers, 1 year: <2 seconds
- **10-20x faster!**

### Cache Size Management
- 1 year daily data: ~25GB uncompressed, ~5GB compressed (parquet)
- 1 year minute data: ~1.2TB uncompressed, ~250GB compressed
- **Strategy:** Keep only needed date ranges, auto-cleanup old data

---

## Configuration

### Add to `.env`
```env
# Massive.com S3 Credentials
MASSIVE_ACCESS_KEY=your_access_key
MASSIVE_SECRET_KEY=your_secret_key

# Cache settings
DATA_CACHE_DIR=./data_cache
DATA_CACHE_MAX_DAYS=500  # Keep ~2 years of data
DATA_CACHE_CLEANUP_ENABLED=true
```

---

## Advantages Over yfinance

1. **Speed:** 10-20x faster with caching
2. **Reliability:** No API downtime or rate limits
3. **Granularity:** Minute-level data available
4. **History:** Back to 2003 (vs yfinance limitations)
5. **Batch Loading:** Download once, use for all tickers
6. **Offline:** Once cached, works without internet
7. **Consistency:** Exact same data every run (no API changes)

---

## Next Steps

1. **Get S3 credentials from Massive.com dashboard**
2. **Implement `backtester/s3_data.py`** (I'll write this)
3. **Test download and caching** with sample dates
4. **Replace yfinance imports** throughout codebase
5. **Run test backtests** to verify accuracy
6. **Optimize cache management** (cleanup old files)
7. **Document minute-timeframe** usage for frontend

Once data layer is solid, we move to Flask API!
