# Backend - MyBot Trading System

Python backend for backtesting, data management, and signal generation.

## Structure

```
backend/
├── config.py                    # Environment configuration
├── data/
│   ├── polygon_flatfiles.py     # S3 flat file downloader
│   └── cache/                   # Local data cache (parquet files)
├── preview/
│   ├── load_preview_data.py     # Data loader for preview charts
│   └── generator.py             # Signal generator (TODO)
├── backtest/
│   └── engine.py                # Backtest engine (TODO)
├── tests/
│   └── test_setup.py            # Setup verification
└── requirements.txt             # Python dependencies
```

## Setup

### 1. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment

Fill in your credentials in the root `.env` file:

```bash
POLYGON_API_KEY=your_polygon_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

Get these from:
- Polygon API Key: https://polygon.io/dashboard
- AWS Credentials: https://polygon.io/dashboard/flat-files

### 3. Test Setup

```bash
python backend/tests/test_setup.py
```

This will:
- ✓ Validate environment variables
- ✓ Test S3 connection
- ✓ Download sample data
- ✓ Verify preview system

## Data Sources

### Polygon Flat Files (Primary)
- **What**: Historical daily/minute bars from S3
- **Best for**: Backtesting, bulk historical data
- **Cache**: Stored locally as parquet files
- **Speed**: Very fast after initial download

### Usage

```python
from data.polygon_flatfiles import PolygonFlatFiles

pf = PolygonFlatFiles()

# Get historical data
data = pf.get_daily_bars('AAPL', '2024-01-01', '2024-12-31')

# Preload a date range
pf.preload_range('2024-01-01', '2024-12-31')
```

## Preview System

The preview system loads data and generates signals for visualization:

```python
from preview.load_preview_data import load_preview_data

result = load_preview_data({
    'ticker': 'AAPL',
    'startDate': '2024-01-01',
    'endDate': '2024-12-31',
    'interval': '1d'
})

# Returns: {success: True, data: {dates, open, high, low, close, volume}}
```

## Backtest Engine (TODO)

Full backtesting engine to be implemented here.
