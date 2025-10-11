# Frontend Backtest Fixes

## Issue 1: Python Virtual Environment Not Used ✅ FIXED

**Problem**: Electron was using system Python instead of the `.venv` Python, causing "ModuleNotFoundError: No module named 'pandas'"

**Solution**: Added `getPythonExecutable()` function in `frontend/main.js` that:
1. Checks for `.venv\Scripts\python.exe` (Windows) or `.venv/bin/python` (Unix)
2. Uses virtual environment Python if found
3. Falls back to system Python if no venv exists
4. Logs which Python is being used

**Location**: `frontend/main.js` - `getPythonExecutable()` function

---

## Issue 2: Portfolio Mode - Empty Strategies ✅ FIXED

**Problem**: Portfolio mode failed with "PORTFOLIO_STRATEGIES empty" error

**Root Cause**: When portfolio mode is enabled but no per-ticker strategy parameters are specified, the backend receives an empty dictionary and rejects it.

**Solution**: Auto-populate default RSI parameters for all tickers when none are specified
- Uses the first RSI_PERIOD value (default: 14)
- Uses the first RSI_BUY_BELOW value (default: 30)
- Uses the first RSI_SELL_ABOVE value (default: 70)
- Applies these defaults to all tickers in the portfolio

**Location**: `frontend/renderer.js` - `collectBacktestConfig()` function

**Code Added**:
```javascript
// If no strategies specified, use default RSI params for all tickers
if (Object.keys(config.PORTFOLIO_STRATEGIES).length === 0 && config.TICKERS) {
  const defaultRsiPeriod = config.RSI_PERIOD && config.RSI_PERIOD.length > 0 ? config.RSI_PERIOD[0] : 14;
  const defaultRsiBuy = config.RSI_BUY_BELOW && config.RSI_BUY_BELOW.length > 0 ? config.RSI_BUY_BELOW[0] : 30;
  const defaultRsiSell = config.RSI_SELL_ABOVE && config.RSI_SELL_ABOVE.length > 0 ? config.RSI_SELL_ABOVE[0] : 70;
  
  config.TICKERS.forEach(ticker => {
    config.PORTFOLIO_STRATEGIES[ticker] = {
      rsi_period: defaultRsiPeriod,
      rsi_buy_below: defaultRsiBuy,
      rsi_sell_above: defaultRsiSell
    };
  });
  console.log(`[BACKTEST] Auto-populated portfolio strategies for ${config.TICKERS.length} tickers`);
}
```

---

## Issue 3: Ticker Validation ✅ ADDED

**Problem**: Need to ensure tickers are valid and weights are properly distributed

**Solution**: Added comprehensive validation before backtest starts

### Validations Added:

1. **Duplicate Ticker Detection**:
   - Checks for duplicate tickers in the list
   - Prevents running backtest with duplicates
   - Error message: "Duplicate tickers detected. Each ticker should only appear once."

2. **Portfolio Strategies Check**:
   - Warns if portfolio mode has no strategies defined
   - Allows continuation (auto-population will handle it)
   - Informative message about auto-population

3. **Weight Sum Validation**:
   - Checks if portfolio weights sum to ~1.0 after normalization
   - Logs warning if sum is off by more than 0.01
   - Helps catch weight configuration issues

**Location**: `frontend/renderer.js` - Run Backtest button click handler

---

## How Weights and Tickers Work Now

### Single Mode (PORTFOLIO_MODE = False):
- **Tickers**: Each ticker is backtested independently
- **No weight concerns**: Each backtest uses full capital
- **Result**: Multiple separate strategy results (one per ticker per parameter combo)

### Portfolio Mode (PORTFOLIO_MODE = True):
- **Tickers**: All tickers run together in one portfolio
- **Weights**: Define allocation across tickers
  - If specified: Normalized to sum to 1.0
  - If not specified: Equal weight (1/N for N tickers)
- **Strategies**: Each ticker needs RSI parameters
  - If specified: Uses provided params
  - If not specified: Auto-populated with defaults from Indicators section
- **Result**: Single portfolio equity curve combining all tickers

### Example Portfolio Configuration:

```javascript
{
  "TICKERS": ["AAPL", "MSFT", "GOOGL"],
  "PORTFOLIO_MODE": true,
  "PORTFOLIO_WEIGHTS": {
    "AAPL": 0.4,   // 40%
    "MSFT": 0.35,  // 35%
    "GOOGL": 0.25  // 25%
  },
  "PORTFOLIO_STRATEGIES": {
    "AAPL": {"rsi_period": 14, "rsi_buy_below": 30, "rsi_sell_above": 70},
    "MSFT": {"rsi_period": 14, "rsi_buy_below": 30, "rsi_sell_above": 70},
    "GOOGL": {"rsi_period": 14, "rsi_buy_below": 30, "rsi_sell_above": 70}
  }
}
```

---

## Testing Portfolio Mode

### Quick Test:
1. Go to Backtesting page
2. Enable "Portfolio Mode" checkbox
3. Enter tickers (e.g., "AAPL, MSFT, GOOGL")
4. Click "Auto-populate from Tickers" to set equal weights
5. Leave strategy section empty (will use defaults)
6. Click "Run Backtest"
7. Should complete successfully with auto-populated strategies

### Advanced Test:
1. Enable Portfolio Mode
2. Add custom weights for each ticker
3. Add custom RSI parameters for each ticker (optional)
4. Run backtest
5. Verify results combine all tickers properly

---

## Files Modified

1. **`frontend/main.js`**:
   - Added `getPythonExecutable()` function
   - Automatically detects and uses virtual environment

2. **`frontend/renderer.js`**:
   - Auto-populates portfolio strategies with defaults
   - Added duplicate ticker validation
   - Added weight sum validation
   - Enhanced error messages

---

## Summary

✅ **Virtual environment Python is now used automatically**
✅ **Portfolio mode works with auto-populated strategies**
✅ **Duplicate tickers are detected and prevented**
✅ **Weights are validated and normalized**
✅ **Clear error messages guide users**

The system is now more robust and user-friendly for both single and portfolio backtests!
