# New Backtesting Engine - Architecture

## Overview
New backtesting engine using **Polygon Flat Files** for data (replacing yfinance) with support for all frontend indicators and flexible condition-based signals.

## Directory Structure

```
backend/
  backtest/
    __init__.py           # Module exports
    data_source.py        # Polygon flat files integration
    indicators.py         # All technical indicators (RSI, MACD, BB, etc.)
    signals.py            # Condition evaluation and signal generation
    engine.py             # Main backtesting engine
    metrics.py            # KPI calculations (Sharpe, Sortino, etc.)
    capm.py               # CAPM analysis (alpha, beta, etc.)
    results.py            # CSV export
    api.py                # Flask API endpoints (TODO)
  test_backtest.py        # Test script
```

## Core Components

### 1. Data Source (`data_source.py`)
- Wraps `PolygonFlatFiles` class
- Provides same interface as legacy `data.py`
- **Function**: `load_bars(symbols, start, end)` → dict of DataFrames
- **Function**: `get_data(symbol, start, end)` → single DataFrame
- Returns OHLCV columns with DatetimeIndex

### 2. Indicators (`indicators.py`)
Python implementations matching `frontend/modules/indicators/calculations.js`:

**Moving Averages:**
- SMA, EMA, WMA, HMA, KAMA

**Oscillators:**
- RSI (Wilder's smoothing)
- Stochastic RSI
- MACD (with signal and histogram)

**Bands/Channels:**
- Bollinger Bands
- Keltner Channels
- ATR (Average True Range)

**Main Function:**
```python
Indicators.calculate_all(df, indicators_config)
# Returns dict: {'RSI': Series, 'MACD': Series, ...}
```

### 3. Signals (`signals.py`)
Evaluates entry/exit conditions from frontend format.

**Condition Format:**
```python
{
    'type': 'price' | 'rsi' | 'ma',
    'source': 'close' | 'rsi' | indicator_name,
    'comparison': 'above' | 'below' | 'crosses_above' | 'crosses_below',
    'target': number or indicator_name,
    'params': {...}
}
```

**Supported Comparisons:**
- `above`, `below` (>, <)
- `crosses_above`, `crosses_below` (crossovers)
- `equals`, `greater_equal`, `less_equal`

**Functions:**
- `SignalEvaluator.evaluate_conditions(conditions, logic='all'|'any')`
- `build_signals_from_config(df, indicators, config)` → (entry_signal, exit_signal)

### 4. Engine (`engine.py`)

**Main Class: `BacktestEngine`**

**Configuration:**
```python
config = {
    'symbols': ['AAPL', 'MSFT'],
    'start_date': '2024-01-01',
    'end_date': '2024-12-31',
    'initial_capital': 100000,
    'order_type': 'MOO' | 'MOC',
    'slippage_bps': 5,
    'commission_bps': 1,
    'indicators': {
        'rsi': {'period': 14},
        'macd': {'fast': 12, 'slow': 26, 'signal': 9}
    },
    'entry_conditions': [...],
    'exit_conditions': [...],
    'entry_logic': 'all' | 'any',
    'exit_logic': 'all' | 'any'
}
```

**Functions:**
- `run_backtest(config, symbol)` → results dict
- `preview_strategy(...)` → quick signal preview without execution

**Results:**
```python
{
    'metrics': {
        'init_cap', 'end_cap', 'total_return', 'cagr',
        'sharpe', 'sortino', 'vol', 'maxdd',
        'trades_entry', 'trades_exit', 'trades_total', 'bars'
    },
    'equity': pd.Series,      # Equity curve
    'trades': [...],          # List of trade dicts
    'events': [...]           # Entry/exit events
}
```

### 5. Metrics (`metrics.py`)
Copied from legacy `backtester/metrics.py`:
- Total return, CAGR
- Sharpe ratio, Sortino ratio
- Volatility, Max drawdown
- Win rate, trade statistics

### 6. CAPM (`capm.py`)
Copied from legacy `backtester/capm.py`:
- Alpha, Beta, R²
- Tracking error, Information ratio
- Treynor ratio
- Rolling metrics

### 7. Results (`results.py`)
Copied from legacy `backtester/results.py`:
- Writes metrics to CSV
- Includes benchmark comparisons
- Portfolio-level summaries

## Frontend Integration (TODO)

### API Endpoints Needed

**POST /api/backtest/preview**
```json
{
  "symbol": "AAPL",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "indicators": {...},
  "entry_conditions": [...],
  "exit_conditions": [...]
}
```
Returns: OHLC + indicators + signals for charting

**POST /api/backtest/run**
```json
{
  "run_name": "My Strategy",
  "symbols": ["AAPL", "MSFT"],
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "config": {...}
}
```
Returns: Metrics, saves to database

**GET /api/backtest/results/{run_id}**
Returns: Full results including trades, equity curve, tearsheet

## Testing

Run test script:
```bash
cd backend
python test_backtest.py
```

Tests:
1. ✅ Indicator calculations
2. ✅ Preview function (signals only)
3. ✅ Simple RSI strategy backtest

## Key Features

✅ **Fast Data Loading**: Polygon flat files from S3  
✅ **All Frontend Indicators**: RSI, MACD, BB, KC, ATR, etc.  
✅ **Flexible Conditions**: Frontend conditions-builder format  
✅ **Trade Simulation**: MOO/MOC orders, slippage, commission  
✅ **Full Metrics**: Sharpe, Sortino, CAGR, drawdown, etc.  
✅ **CAPM Analysis**: Alpha, beta, benchmark comparison  
✅ **Event Tracking**: Entry/exit dates, prices, P&L  

## Next Steps

1. **Create API Layer** (`api.py`)
   - Flask/FastAPI endpoints
   - Connect to frontend modules

2. **Database Integration**
   - Save backtest runs to SQLite
   - Store trades, equity curves, metrics

3. **Tearsheet Generation**
   - Adapt `backtester/tearsheet.py`
   - Generate HTML with Plotly charts

4. **Frontend Updates**
   - Update `preview.js` to call new API
   - Update `runs.js` to use new backend
   - Ensure results display works

## Advantages Over Legacy

- **10-100x faster data loading** (flat files vs API calls)
- **All chart indicators available** (not just RSI)
- **Flexible condition builder** (not hardcoded signals)
- **Clean separation** (data, indicators, signals, engine)
- **Easy to extend** (add new indicators/conditions)
- **Better testing** (modular components)

## Migration Path

1. ✅ Build new engine with flat files
2. ✅ Port all indicators
3. ✅ Create flexible signals
4. ⏳ Build API endpoints
5. ⏳ Update frontend to use new API
6. ⏳ Test with existing strategies
7. ⏳ Deprecate legacy backtester
