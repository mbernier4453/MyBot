# Strategy Condition Parameters - Implementation Summary

## ✅ Completed Features

### 1. **Position Type (Per-Condition)**
- **Location**: Each condition (Price, RSI, MA Crossover) has its own Position Type dropdown
- **Options**: Long or Short
- **Default**: Long
- **Arrow Colors**:
  - Long Entry: Green (#00ff00) triangle-up (▲)
  - Long Exit: Red (#ff0000) triangle-down (▼)
  - Short Entry: Dark Red (#8B0000) triangle-down (▼)
  - Short Exit: Dark Green (#006400) triangle-up (▲)

### 2. **Threshold Percentage**
- **Purpose**: Requires price/RSI to move X% beyond the target line before confirming crossover
- **Example**: With 2% threshold, price must cross AND move 2% past the target
- **Default**: 0% (immediate crossover detection)
- **Applies to**: Price, RSI, and MA Crossover conditions

### 3. **Delay Bars**
- **Purpose**: Wait N bars after crossover before triggering signal
- **Example**: Crossover at bar 100 with 2 delay bars → signal fires at bar 102
- **Default**: 0 bars (immediate signal)
- **Applies to**: All condition types
- **Implementation**: `signalIndex = Math.min(i + delayBars, prices.length - 1)`

### 4. **Cross Direction**
- **Price/RSI**: Above or Below
- **MA Crossover**: Bullish or Bearish
- **Working**: Yes, properly filters signals based on direction

### 5. **Bollinger Bands**
- **Target Types**: BB_TOP, BB_MID, BB_BOTTOM
- **Context-Sensitive**: 
  - Price condition + BB_BOTTOM = Bollinger Band around price
  - RSI condition + BB_BOTTOM = Bollinger Band around RSI values
- **Configurable**: Standard deviation slider (1.0 - 3.0)
- **Display**: Properly rendered on preview charts
- **Signal Detection**: Uses actual BB calculations for crossover detection

## 🔧 Changes Made

### Removed Global Position Type
- **Before**: Global radio button above Entry Conditions section
- **After**: Removed entirely - position type is now per-condition
- **Impact**: More flexible strategies (can mix long and short entries)

### Mirror Entry Default Changed
- **Before**: "Mirror Entry Conditions" checkbox was checked by default
- **After**: Unchecked by default
- **Impact**: Exit conditions must be manually added unless mirror is explicitly enabled
- **Benefit**: Cleaner previews, less confusion with double arrows

## 📊 Preview Charts

### Signal Display
- **Entry/Exit Arrows**: Positioned at the signal bar with proper colors
- **Legend**: Shows "Entry 1 (Long)", "Exit 1 (Short)", etc.
- **Multiple Lines**: When using comma-separated parameters, each combination gets its own line number

### Double Arrows Issue
**Cause**: Multiple parameter combinations or mirrored entry/exit at same bar
**Solution**: 
- Use single values (not comma-separated) for clean preview
- Uncheck "Mirror Entry" if you don't want exit signals
- In full backtest, position management prevents double entries

## 🎯 Take Profit & Stop Loss

### Already Implemented UI
Both features have complete UI forms with:

**Take Profit**:
- Enable/Disable checkbox
- Type: Percentage or Dollar Amount
- Target %: Default 10%
- Target $: Default $100

**Stop Loss**:
- Enable/Disable checkbox
- Type: Percentage or Dollar Amount
- Target %: Default 5%
- Target $: Default $100

**Data Collection**: Both are properly collected in config
**Status**: ✅ UI Complete, needs backend integration

## 🔄 Vice Versa
- **UI**: Checkbox exists in Exit Conditions section
- **Description**: "Reverse position on exit (Long→Short or Short→Long)"
- **Data Collection**: Captured as `config.VICE_VERSA`
- **Status**: ✅ UI Complete, needs backend logic

## 📝 Usage Notes

### Testing Threshold
Set threshold to 0.5% or 1% and watch how signals become more selective - only crossovers with sufficient momentum are captured.

### Testing Delay Bars
Set delay to 2-3 bars and observe arrows shifting forward in time from the actual crossover point. Useful for confirmation strategies.

### Clean Previews
For cleanest preview visualization:
1. Use single parameter values (no commas)
2. Uncheck "Mirror Entry" unless specifically testing
3. Manually add exit conditions with different parameters than entry

### Multiple Parameters
When using comma-separated values (e.g., RSI periods "10,14,20"):
- Creates separate parameter lines (Line 1, Line 2, Line 3)
- Each line is independently matched with exits
- More arrows = more parameter combinations being tested

## 🚀 Next Steps

### Backend Integration Needed
1. **Threshold Percentage**: Apply in actual backtest signal detection
2. **Delay Bars**: Shift signal timing in backtest execution
3. **Take Profit**: Exit when position gains X% or $X
4. **Stop Loss**: Exit when position loses X% or $X
5. **Vice Versa**: Reverse position instead of closing (Long→Short, Short→Long)
6. **Position Type**: Use condition's position_type to determine entry direction

### Frontend Polish
1. Add tooltip explanations for each parameter
2. Add "Show only entry" toggle for preview (hide exit arrows)
3. Add line number filtering in preview (show/hide specific parameter lines)
4. Add signal count summary per condition

## 🐛 Known Issues

### Resolved
✅ Position type was global - now per-condition  
✅ Delay bars not working - fixed collection property name mismatch  
✅ BB bands showing wrong values - fixed calculation logic  
✅ Signals not using BB crossovers - implemented proper detection  

### Active
⚠️ Double arrows can be confusing - mitigated by unchecking mirror entry default  

## 📖 Code Reference

### Key Functions
- `collectConditions(group)` - Lines 8580-8720 - Collects condition data from UI
- `calculateConditionSignals(condition, mode)` - Lines 9690+ - Detects crossover signals
- `createCombinedConditionChart()` - Lines 8934+ - Creates preview charts with entry/exit
- `matchEntryExitSignals()` - Lines 8796+ - Matches entry signals with exits

### Key Files
- `frontend/index.html` - Strategy builder UI forms
- `frontend/renderer.js` - Strategy logic and preview charts
- `backtester/` - Backend modules (not yet wired to new parameters)
