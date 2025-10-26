# Market Breadth Module

S&P 500 market breadth indicators for technical analysis.

## Features

### Four Core Indicators

1. **Advance-Decline Line**
   - Cumulative sum of daily advancers minus decliners
   - 10-day moving average overlay
   - Shows market participation and momentum

2. **TICK Proxy** (Intraday)
   - Per-minute count of upticking vs downticking stocks
   - Reference lines at ±100, ±300, ±800
   - Shows intraday market pressure
   - Note: Currently simplified for demo - full implementation requires intraday data

3. **52-Week Highs vs Lows**
   - Daily count of stocks making new 52-week highs and lows
   - Net high-low calculation with 10-day MA
   - Identifies market extremes and turning points

4. **Percent Above Moving Averages**
   - Percentage of stocks above 50-day and 200-day MAs
   - Breadth thrust detection (40% → 61.5% within 10 days)
   - Shows overall market health

## Data Source

- **Provider**: Polygon.io
- **Universe**: S&P 500 constituents (currently using top 50-100 for performance)
- **Frequency**: Daily bars for most indicators, 1-minute for TICK proxy
- **Caching**: All fetched data is cached locally to reduce API calls

## Usage

### Frontend

Navigate to the "Market Breadth" tab in the main navigation.

**Controls:**
- **Timeframe Selector**: Choose analysis period (3M, 6M, 1Y, 2Y)
- **Refresh Button**: Force reload data from Polygon.io

### Backend CLI

Direct command-line usage:

```bash
# Advance-Decline Line
python backend/market_breadth_cli.py ad-line --days 252

# 52-Week Highs/Lows
python backend/market_breadth_cli.py highs-lows --days 252

# Percent Above MA
python backend/market_breadth_cli.py percent-ma --days 252

# TICK Proxy
python backend/market_breadth_cli.py tick --date 2024-01-15
```

## Configuration

Set your Polygon.io API key in `backend/config.py`:

```python
POLYGON_API_KEY = "your_api_key_here"
```

Or via environment variable:
```bash
export POLYGON_API_KEY="your_api_key_here"
```

## Cache Management

Cached data is stored in `data/breadth_cache/`:
- Ticker lists: Valid for 1 day
- Daily bars: Persistent until refresh
- Minute bars: Per-day per-ticker

To force refresh, use the Refresh button in the UI or delete cache files manually.

## Performance Considerations

- **Initial Load**: First run may take 2-5 minutes depending on API rate limits
- **Subsequent Loads**: Near-instant from cache
- **API Limits**: Respects Polygon.io rate limits (5 calls/minute free tier)
- **Stock Universe**: Currently limited to 50-100 stocks for testing; expand in production

## Technical Details

### Calculations

**A/D Line:**
- Advancer: close > prior close
- Decliner: close < prior close  
- Unchanged: close == prior close
- A/D Line = cumulative sum of (advancers - decliners)

**TICK Proxy:**
- Per bar: count(uptickers) - count(downtickers)
- Upticker: close > prior bar close
- Downticker: close < prior bar close

**52-Week High/Low:**
- High: current close >= max(high) over past 252 trading days
- Low: current close <= min(low) over past 252 trading days
- Requires 252-day history; excludes stocks with insufficient data

**Percent Above MA:**
- For each stock: is close > MA_50 or MA_200?
- Percent = (count above / valid count) × 100
- Excludes stocks without sufficient lookback for MA calculation

### Breadth Thrust Detection

A breadth thrust occurs when %Above50 rises from below 40% to above 61.5% within 10 trading days. This is considered a strong bullish signal historically.

## Limitations & Future Enhancements

**Current Limitations:**
- Survivorship bias: Uses current S&P 500 members, not historical composition
- Limited universe: 50-100 stocks vs full 500 for performance
- TICK proxy: Simplified implementation (full version requires WebSocket streaming)

**Planned Enhancements:**
- Historical S&P 500 membership data
- Full 500-stock universe
- Real-time TICK via WebSocket
- Additional breadth indicators (McClellan Oscillator, etc.)
- SPX overlay on all charts for correlation analysis

## Dependencies

```
pandas>=2.0
requests>=2.28.0
plotly>=5
```

See `requirements.txt` for full list.

## Architecture

```
Backend (Python):
  backend/market_breadth_cli.py     - CLI script for data calculation
  backend/market_breadth.py          - Core calculation functions (async)
  
Frontend (JavaScript):
  frontend/modules/features/market-breadth.js  - UI and chart rendering
  frontend/modules/ui/tabs.js                  - Tab initialization
  
Electron IPC:
  frontend/main.js      - IPC handlers (breadth-get-*)
  frontend/preload.js   - IPC exposure to renderer
```

## Troubleshooting

**Error: "No data returned"**
- Check Polygon.io API key is set correctly
- Verify API key has sufficient permissions
- Check API rate limits haven't been exceeded

**Charts not loading**
- Check browser console for errors
- Verify Python backend is accessible
- Ensure all dependencies are installed

**Slow performance**
- First run builds cache - subsequent runs are faster
- Reduce `days` parameter for faster testing
- Clear cache if data seems stale

## Credits

Market breadth methodology based on established technical analysis principles. Implementation uses Polygon.io as data provider.
