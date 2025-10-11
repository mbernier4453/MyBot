# Portfolio Backtest Workflow

## Overview
Seamless one-button portfolio setup with flexible strategy selection.

## User Flow

### Step 1: Auto-populate Portfolio
Click **"Auto-populate from Tickers/Watchlist"** button

**What it does:**
- Loads tickers from either:
  - Manual input in Portfolio Mode's ticker field, OR
  - Currently selected watchlist
- Assigns equal weights to all tickers (auto-normalized)
- Creates a card for each ticker with:
  - Weight input (adjustable)
  - Strategy Type dropdown (initially empty)

**User sees:**
```
[AAPL]  Weight: 0.1429  Strategy: [-- Select Strategy --]
[GOOGL] Weight: 0.1429  Strategy: [-- Select Strategy --]
[MSFT]  Weight: 0.1429  Strategy: [-- Select Strategy --]
...
```

### Step 2: Select Strategy Type
For each ticker, select from dropdown:
- **RSI** - Relative Strength Index (available now)
- **MACD** - Moving Average Convergence Divergence (coming soon)
- **MA** - Moving Average Crossover (coming soon)
- **Bollinger** - Bollinger Bands (coming soon)

**When you select RSI:**
- Parameters section appears below the dropdown
- Shows 3 inputs: Period, Buy Below, Sell Above
- Pre-filled with defaults from Indicators section
- User can customize per-ticker

**When you select MA (future):**
- Parameters section shows: MA Type (SMA/EMA), Short Period, Long Period
- User enters values specific to that ticker

### Step 3: Customize Parameters (Optional)
- Adjust weights if desired (will auto-normalize to sum to 1.0)
- Modify strategy parameters per ticker
- Or leave defaults

### Step 4: Run Backtest
Click **"Run Backtest"** button

## Example Scenario

**Setup:**
- Load "Mag7" watchlist (7 tickers)
- Click auto-populate
- All 7 tickers appear with 0.1429 weight each

**Customization:**
- AAPL: Select RSI, use Period=14, Buy<30, Sell>70
- GOOGL: Select RSI, use Period=10, Buy<25, Sell>75 (more aggressive)
- MSFT: Select RSI, keep defaults
- AMZN: Select RSI, Period=20 (slower)
- TSLA: Leave strategy empty (will use default from Indicators)
- META: Select RSI, customize
- NVDA: Select RSI, customize

**Backend:**
- Each ticker with selected strategy gets its own config
- Tickers without strategy selection use defaults from Indicators section

## Why This Design?

### Problems with old approach:
❌ Too many buttons (auto-populate tickers, auto-populate weights, auto-populate strategies)
❌ Confusing "Simple vs Custom" modes
❌ Had to populate tickers THEN populate strategies separately
❌ Not scalable for multiple indicator types

### New approach:
✅ One button: "Auto-populate from Tickers/Watchlist"
✅ Strategy selection is dropdown per ticker (not a separate step)
✅ Parameters appear dynamically when you select strategy type
✅ Easily extensible: just add new options to dropdown + new parameter sections
✅ Clear, linear workflow: populate → select → customize → run

## Future: Adding New Indicators

**To add MACD:**
1. Add `<option value="macd">MACD</option>` to dropdown
2. Add case in `toggleStrategyParams()`:
```javascript
else if (strategyType === 'macd') {
  paramsDiv.innerHTML = `
    <div>MACD Parameters:</div>
    <input data-param="macd_fast" value="12" />
    <input data-param="macd_slow" value="26" />
    <input data-param="macd_signal" value="9" />
  `;
}
```
3. Add case in `collectBacktestConfig()` to read those params
4. Done! No changes to HTML structure needed

## Technical Notes

- **Weights:** Always normalized to sum to 1.0 before backend submission
- **Validation:** Checks for duplicate tickers on auto-populate
- **Fallback:** Tickers without strategy use default RSI from Indicators section
- **Data Structure:** 
  - `PORTFOLIO_WEIGHTS = { "AAPL": 0.2, "GOOGL": 0.3, ... }`
  - `PORTFOLIO_STRATEGIES = { "AAPL": { rsi_period: 14, ... }, ... }`
