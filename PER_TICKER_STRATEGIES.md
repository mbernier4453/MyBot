# Per-Ticker Strategy System for Portfolio Mode

## Problem

When running portfolio backtests with tickers loaded from a watchlist, there was no way to specify different strategy parameters for each ticker. The system needed to be scalable for future indicators (MACD, Bollinger Bands, Moving Averages, etc.), not just RSI.

## Solution

Added a flexible two-mode system in the Portfolio Configuration:
1. **Simple Mode**: All tickers use the same strategy (from Indicators section)
2. **Custom Mode**: Each ticker gets its own editable strategy parameters (supports RSI now, designed for future indicators)

## New Features

### 1. Two-Button Approach

Located in the Portfolio Configuration section, below the Ticker Weights section.

#### Button 1: "🎯 Auto-populate with Default Strategies"
**Simple Mode** - All tickers use the same strategy

**What it does**:
- Sets portfolio to use the strategy defined in the Indicators section
- All tickers get the same RSI parameters (or MACD, Bollinger, etc. in the future)
- Shows a confirmation message
- No per-ticker inputs needed

**When to use**:
- You want all tickers to trade the same way
- Quick testing with default parameters
- You're confident one strategy works for all tickers

#### Button 2: "✏️ Custom Strategies for Each Ticker"
**Custom Mode** - Each ticker gets its own strategy parameters

**What it does**:
- Creates an editor for each ticker
- Shows sections for each enabled indicator (RSI, MACD, etc.)
- Pre-fills with defaults from Indicators section
- Each ticker can be customized independently

**When to use**:
- You want AAPL to be aggressive but MSFT conservative
- Different volatility levels require different thresholds
- You're optimizing per-ticker strategies

### 2. Scalable Indicator System

**Current Support**: RSI
- Period
- Buy Below threshold
- Sell Above threshold

**Future Support** (designed in, just needs backend):
- MACD (fast, slow, signal periods)
- Bollinger Bands (period, std dev, buy/sell triggers)
- Moving Average Crossovers (fast/slow periods)
- Volume indicators
- Custom combinations

**How it scales**:
Each indicator enabled in the Indicators section automatically appears in custom mode for each ticker. The UI is indicator-agnostic and will display whatever strategies are enabled.

### 3. Visual Design

**Simple Mode**:
- Green success message
- Shows ticker count
- One-click switch to custom mode

**Custom Mode**:
- Each ticker in its own card
- Indicator sections clearly labeled
- Color-coded (RSI in blue, MACD could be purple, etc.)
- Remove button for each ticker
- Switch back to simple mode button at top

## Workflows

### Workflow 1: Simple Mode (All Tickers Same Strategy)
1. Enable Portfolio Mode
2. Load tickers from watchlist (e.g., Mag7)
3. Click "📋 Auto-populate from Tickers" (sets equal weights)
4. Click "🎯 Auto-populate with Default Strategies" (simple mode)
5. Verify Indicators section has your desired RSI settings
6. Run backtest
7. **Result**: All 7 tickers trade with RSI 14/30/70 (or whatever's in Indicators)

### Workflow 2: Custom Mode (Different Strategy Per Ticker)
1. Enable Portfolio Mode
2. Load tickers from watchlist
3. Click "📋 Auto-populate from Tickers" (weights)
4. Click "✏️ Custom Strategies for Each Ticker" (custom mode)
5. **Customize each ticker**:
   - AAPL: RSI 14, Buy 25, Sell 75 (aggressive)
   - MSFT: RSI 14, Buy 30, Sell 70 (standard)
   - GOOGL: RSI 21, Buy 35, Sell 65 (conservative, longer period)
   - Etc.
6. Run backtest
7. **Result**: Each ticker trades with its own optimized parameters

## Example Configuration

```javascript
// For a portfolio with 3 tickers:
PORTFOLIO_WEIGHTS: {
  "AAPL": 0.40,   // 40% allocation
  "MSFT": 0.35,   // 35% allocation
  "GOOGL": 0.25   // 25% allocation
}

PORTFOLIO_STRATEGIES: {
  "AAPL": {
    "rsi_period": 14,
    "rsi_buy_below": 25,    // More aggressive
    "rsi_sell_above": 75
  },
  "MSFT": {
    "rsi_period": 14,
    "rsi_buy_below": 30,    // Standard
    "rsi_sell_above": 70
  },
  "GOOGL": {
    "rsi_period": 21,       // Longer period
    "rsi_buy_below": 35,    // More conservative
    "rsi_sell_above": 65
  }
}
```

## Technical Details

### Files Modified

1. **`frontend/index.html`**:
   - Added "Per-Ticker Strategy Parameters" section
   - Added auto-populate button
   - Added `portfolioStrategiesList` container

2. **`frontend/renderer.js`**:
   - Added `autoPopulateTickerStrategies()` function
   - Updated `collectBacktestConfig()` to read per-ticker strategies
   - Improved data parsing for strategy inputs

### Data Flow

1. User clicks "Auto-populate from Tickers"
2. Function reads tickers from main config or watchlist
3. Function reads default RSI values from Indicators section
4. Creates input rows for each ticker with defaults
5. User can edit any ticker's parameters
6. When running backtest, `collectBacktestConfig()` reads each row
7. Builds `PORTFOLIO_STRATEGIES` object with per-ticker params
8. Sends to backend for execution

### Fallback Behavior

If the "Per-Ticker Strategy Parameters" section is left empty:
- System uses default RSI parameters from Indicators section
- Applies same parameters to ALL tickers
- Logs message: "Auto-populated portfolio strategies for N tickers with default RSI params"

## Benefits

✅ **Flexible** - Different parameters for each ticker
✅ **Visual** - See all ticker strategies at once
✅ **Fast** - Auto-populate button for quick setup
✅ **Forgiving** - Falls back to defaults if left empty
✅ **Intuitive** - Clear labels and organized layout

## Testing

Try this workflow:
1. Go to Backtesting page
2. Enable Portfolio Mode
3. Load your Mag7 watchlist
4. Click "📋 Auto-populate from Tickers" (weights)
5. Click "🎯 Auto-populate from Tickers" (strategies)
6. Adjust some ticker parameters
7. Run backtest
8. Should see trades for each ticker with its specific RSI settings!
