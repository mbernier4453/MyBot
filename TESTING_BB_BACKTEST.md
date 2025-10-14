# RSI Bollinger Band Condition Support

## Changes Made

### Frontend - Strategy Condition Builder
✅ BB_TOP, BB_MID, BB_BOTTOM available as targets for RSI conditions
✅ Changed BB Std Dev from text input to slider (1.0 - 3.0, step 0.1)
✅ Period remains manual text input (supports comma-separated lists for grid)
✅ Delay bars field collects data (⚠️ backend implementation needed)

## How It Works

When you select **RSI** as your condition type, Bollinger Bands are available as targets:

### Creating an RSI Bollinger Band Condition:
1. **Add Condition** → Select **"RSI"**
2. **RSI Period**: `14` (or comma-list: `7,14,21` for grid)
3. **Target Type**: Select from dropdown:
   - `BB_TOP` - Upper Bollinger Band around RSI
   - `BB_MID` - Middle Band (SMA of RSI)
   - `BB_BOTTOM` - Lower Bollinger Band around RSI
   - (Also: `Value`, `SMA`, `EMA`, `HMA`, `KAMA`, `KC_*`)
4. **Period**: `20` (or `10,20,30` for grid) - BB calculation period
5. **BB Std Dev**: Slider from 1.0 to 3.0 (default: 2.0)
6. **Interaction**: 
   - `Cross` - RSI crosses through target
   - `Recross` - RSI crosses back
   - `Above` - RSI stays above target
   - `Below` - RSI stays below target
7. **Direction** (for Cross/Recross):
   - `RSI crosses UP through target`
   - `RSI crosses DOWN through target`
8. **Delay Bars**: 0 (number of bars to wait after signal)

### Example Strategies:

**Mean Reversion (Buy Oversold, Sell Overbought)**
- **Entry**: RSI(14) crosses DOWN through BB_BOTTOM(20, 2.0)
- **Exit**: RSI(14) crosses UP through BB_TOP(20, 2.0)

**Trend Following (Bollinger Breakout)**
- **Entry**: RSI(14) crosses UP through BB_TOP(20, 2.0)
- **Exit**: RSI(14) recrosses DOWN through BB_MID(20, 2.0)

**Range Trading**
- **Entry**: RSI(14) is BELOW BB_BOTTOM(20, 2.0)
- **Exit**: RSI(14) crosses UP through BB_MID(20, 2.0)

## Quick Test

### Setup Mean Reversion Strategy
1. Go to **Backtesting** tab
2. **Main Config**:
   - Tickers: `AAPL`
   - Dates: `2023-01-01` to Today
   - Capital: $100,000
3. Expand **Strategy Conditions** → Click Preview toggle to see it on charts
4. **Entry Condition**:
   - Add Condition → "RSI"
   - RSI Period: `14`
   - Target Type: `BB_BOTTOM`
   - Period: `20`
   - BB Std Dev: Slider to `2.0`
   - Interaction: `Cross`
   - Direction: `RSI crosses DOWN through target`
   - Delay Bars: `0`
5. **Exit Condition**:
   - Add Condition → "RSI"
   - RSI Period: `14`
   - Target Type: `BB_TOP`
   - Period: `20`
   - BB Std Dev: Slider to `2.0`
   - Interaction: `Cross`
   - Direction: `RSI crosses UP through target`
   - Delay Bars: `0`
6. **Run Backtest** button

### Check Results
- Results page → Find your Run ID
- View metrics: Return, Sharpe, Drawdown
- Click tearsheet to see trade details

## Understanding RSI Bollinger Bands

### What They Are
Bollinger Bands calculated around the RSI values instead of price:
- **BB_TOP**: RSI_SMA + (std_dev × multiplier)
- **BB_MID**: Simple Moving Average of RSI
- **BB_BOTTOM**: RSI_SMA - (std_dev × multiplier)

### When RSI Uses BB Targets
When you select **RSI** as the condition type:
- BB bands are **around the RSI values** (0-100 range)
- Period = how many RSI values to average
- Std Dev = band width multiplier

### When Price Uses BB Targets  
When you select **Price** as the condition type:
- BB bands are **around the price** (normal price BB)
- Period = how many price bars to average
- Std Dev = band width multiplier

## Grid Testing

You can test multiple parameter combinations by using comma-separated lists:

**Example**:
- RSI Period: `7,14,21` (tests 3 periods)
- BB Period: `10,20,30` (tests 3 periods)
- BB Std Dev: Slider (single value only)
- This creates: 3 × 3 = **9 parameter combinations**

The backtester will run all combinations and save results for comparison.

## Troubleshooting

### No results showing
- Check Python console for errors
- Verify tickers are valid and have data
- Ensure date range has sufficient data

### Wrong parameters in results
- Check console log for config collection
- Verify RSI dashboard values are being read correctly
- Check that `rsiBollingerPeriod` and `rsiBollingerStdDev` IDs exist

### Grid too large
- Reduce parameter ranges in `collectBacktestConfig()`
- Currently testing 2 RSI periods × 3 std devs = 6 combos per ticker
- Can change to single values: `config.RSI_PERIOD = [14]` for faster testing

## Next Steps

Once basic testing works:
1. **Add UI Controls**: Create dedicated BB parameter inputs in Backtesting page
2. **Strategy Preview**: Update preview charts to show BB bands
3. **Results Visualization**: Add BB parameter columns to results table
4. **Save/Load Configs**: Ensure BB params are saved with configs

## Notes for Tomorrow's Research

The system is now functional for:
- ✅ Running RSI backtests with Bollinger Bands
- ✅ Grid search across multiple BB configurations
- ✅ Comparing results to find optimal parameters
- ✅ Storing results in database with all parameters

You can:
1. Test different BB periods (20 vs 30)
2. Test different std dev multipliers (1.5, 2.0, 2.5)
3. Compare BB signals vs fixed thresholds
4. Find which configuration works best for your tickers
