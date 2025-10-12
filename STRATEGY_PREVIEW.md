# Strategy Preview Feature

## Overview
The strategy preview feature allows you to visualize your strategy conditions in real-time as you build them, using 1 year of S&P 500 (SPY) historical data.

## How It Works

### 1. Enable Live Preview
- In the **Strategy Conditions** section header, you'll see a "Live Preview" checkbox
- Check this box to enable real-time strategy visualization
- The preview will automatically load 1 year of S&P 500 daily data

### 2. Building Your Strategy
As you add entry and exit conditions:
- Each condition automatically generates its own chart
- Entry conditions are marked with **green upward arrows (↑)** numbered sequentially
- Exit conditions are marked with **red downward arrows (↓)** numbered sequentially
- The chart shows when that specific condition would have triggered

### 3. Multiple Parameter Values
When you enter comma-separated values for grid backtesting (e.g., "20,50,200" for periods):
- All parameter combinations are shown on the **same chart**
- This helps you compare how different parameter values affect signal timing
- Hover over arrows to see exact dates and prices

### 4. Chart Features
Each chart includes:
- **Price line**: S&P 500 closing prices
- **Indicator overlays**: MAs, Bollinger Bands, etc. (if applicable)
- **Signal markers**: Numbered arrows showing when conditions trigger
- **Interactive controls**: Zoom, pan, and hover for details
- **Legend**: Shows all indicators and their parameters

### 5. Auto-Refresh
The preview automatically refreshes when you:
- Add a new condition
- Remove a condition
- Change any condition parameter
- Toggle between entry/exit conditions

You can also manually refresh using the **"Refresh Preview"** button.

## Condition Type Visualizations

### Timing Conditions
- Shows the time range on the price chart
- Signals appear during the specified time window
- Useful for intraday strategies

### Price Conditions
- **Target Type = Value**: Horizontal line at the specified price
- **Target Type = SMA/EMA/etc.**: Moving average line overlaid on price
- **Bollinger Bands**: Upper, middle, lower bands shown
- **Keltner Channels**: Upper, middle, lower channels shown
- Arrows appear when price interacts with the target (touch/cross/recross)

### RSI Conditions
- RSI indicator shown (typically 0-100 range)
- Target line or MA overlaid on RSI
- Arrows when RSI crosses thresholds or interacts with target

### MA Crossover
- **Fast MA**: Green line
- **Slow MA**: Red line
- Arrows at crossover points (bullish or bearish)

## Implementation Details

### Frontend Components

#### HTML (`index.html`)
```html
<!-- Toggle in section header -->
<input type="checkbox" id="previewToggle" onchange="toggleStrategyPreview()" />

<!-- Preview container -->
<div id="strategyPreviewContainer">
  <div id="previewStatus"></div>
  <div id="previewCharts"></div>
</div>
```

#### JavaScript (`renderer.js`)
Key functions:
- `toggleStrategyPreview()`: Show/hide preview container and load data
- `initializeStrategyPreview()`: Fetch S&P 500 data from backend
- `refreshStrategyPreview()`: Regenerate all charts based on current conditions
- `createConditionChart()`: Create Plotly chart for single condition
- `calculateConditionSignals()`: Determine when condition triggers
- `createIndicatorTraces()`: Add indicator overlays (MAs, bands, etc.)
- `calculateSimpleMA()`: Calculate moving averages

#### Backend (`load_preview_data.py`)
- Uses `yfinance` to download historical data
- Returns JSON with dates, OHLCV arrays
- Cached in frontend to avoid repeated downloads

### Data Flow
1. User checks "Live Preview" toggle
2. Frontend calls `window.electronAPI.loadPreviewData({ticker: 'SPY', period: '1y', interval: '1d'})`
3. Main process spawns Python script `load_preview_data.py`
4. Script downloads data via yfinance and returns JSON
5. Frontend caches data in `cachedSP500Data`
6. Frontend generates Plotly charts for each condition
7. Charts auto-refresh on any condition change

### Grid Backtesting Support
When parameters contain comma-separated lists:
- All combinations shown on same chart
- Example: Period "20,50,200" shows 3 MA lines
- Signals calculated for each parameter value
- Arrows numbered by condition (not by parameter variation)

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic visualization with S&P 500 data
- ✅ Entry/Exit condition charts
- ✅ Numbered arrow markers
- ✅ Auto-refresh on changes
- ✅ Toggle to enable/disable

### Phase 2 (Planned)
- [ ] Actual signal calculation for each condition type
- [ ] RSI subplot for RSI conditions
- [ ] More accurate timing condition visualization
- [ ] Touch/Cross/Recross logic implementation
- [ ] Direction field (above/below) visualization

### Phase 3 (Future)
- [ ] Multi-timeframe support (1min, 5min, 15min, 1hour, 4hour, 1day)
- [ ] Custom ticker selection (preview your actual trading instrument)
- [ ] Combined signals chart showing ALL conditions together
- [ ] Backtest statistics on preview data
- [ ] Trade markers (actual entry/exit pairs with P&L)

### Phase 4 (Advanced)
- [ ] Real-time data preview (connect to live feeds)
- [ ] Parameter optimization heatmaps
- [ ] Walk-forward analysis visualization
- [ ] Monte Carlo simulation on preview data
- [ ] Export preview charts to PNG/PDF

## Technical Notes

### Performance
- Data is cached after first load (no repeated API calls)
- Charts use Plotly.js (hardware accelerated rendering)
- Only active conditions are charted (removed conditions don't persist)
- Debouncing on input changes prevents excessive refreshes

### Dependencies
- **Frontend**: Plotly.js (already included via CDN)
- **Backend**: yfinance (Python package for historical data)
- **IPC**: Electron IPC for Python subprocess communication

### Error Handling
- Preview continues to work even if data load fails
- Error messages shown in `previewStatus` div
- Graceful degradation (can build strategy without preview)
- Retry mechanism for network failures

## Usage Tips

1. **Start with preview OFF** when building complex strategies (better performance)
2. **Enable preview** when you want to validate a specific condition
3. **Use refresh button** if you suspect data is stale
4. **Zoom into specific date ranges** to see signals more clearly
5. **Compare parameter variations** by using comma-separated values
6. **Check signal density** - too many signals may indicate bad parameters
7. **Validate timing** - ensure signals align with your strategy intent

## Known Limitations

1. **Simplified signal calculation**: Current implementation uses placeholder logic
2. **Single ticker only**: Preview always uses SPY (S&P 500)
3. **Daily data only**: Intraday timeframes not yet supported
4. **No position tracking**: Shows signals but not actual trades
5. **Performance**: Many conditions with many parameters may slow rendering

These limitations will be addressed in future phases.
