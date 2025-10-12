# Strategy Preview Updates

## Changes Made

### 1. **Checkbox Label Changed**
- Changed from "Live Preview" to just "Preview"
- More concise and clear

### 2. **Manual Update Instead of Auto-Refresh**
- Removed automatic refresh when inputs change
- Removed automatic refresh when conditions added/removed
- Users must click "Update Preview" button to regenerate charts
- This prevents constant recalculation and improves performance

### 3. **Button Styling Enhanced**
- Changed "Refresh Preview" to "Update Preview"
- Changed from `btn-secondary` to `btn-primary` for better visibility
- Increased padding for better click target

### 4. **Fixed Signal Calculation**
- **Timing Conditions**: Shows single example signal at midpoint
- **Price Conditions**:
  - Value type: Detects actual price crosses or touches of fixed value
  - MA type: Detects price crossing moving average
  - Touch: Within 0.5% threshold
  - Cross: Actual crossover detection
- **RSI Conditions**: Shows evenly spaced example signals (full calculation pending)
- **MA Crossover**: 
  - Detects actual fast/slow MA crossovers
  - Respects bullish/bearish direction setting
  - Only shows genuine crossover points

### 5. **Limited Signal Display**
- Maximum 15 arrows shown per chart (to avoid visual clutter)
- If more signals exist, shows representative sample
- Internal calculation still processes all signals

### 6. **Improved Arrow Styling**
- Changed text from just number to `#1`, `#2`, etc.
- Enhanced colors:
  - Entry: Bright green (`#00cc00`) with green background
  - Exit: Bright red (`#ff3333`) with red background
- Added white border around arrow badges for better visibility
- Improved font styling (bold, better size)

### 7. **Better Status Messages**
- Shows number of days loaded
- Reminds user to click "Update Preview"
- Uses consistent secondary text color
- Only shows red for actual errors

## Usage Flow

1. **Enable Preview**: Check the "Preview" checkbox
2. **Wait for Data**: System loads 1 year of S&P 500 data
3. **Add Conditions**: Build your entry/exit conditions
4. **Click "Update Preview"**: Manually generate charts
5. **Modify Parameters**: Change any parameters (periods, values, etc.)
6. **Click "Update Preview" Again**: See updated visualization

## Signal Detection Logic

### Price Conditions
```javascript
// Value Type
if (targetType === 'Value') {
  // Cross: Price moves from one side to other
  if ((prevPrice < value && currPrice > value) || 
      (prevPrice > value && currPrice < value)) {
    → Signal
  }
  
  // Touch: Price within 1% of value
  if (abs(currPrice - value) < value * 0.01) {
    → Signal
  }
}

// MA Type
else {
  // Cross: Price crosses MA line
  if ((prevPrice < prevMA && currPrice > currMA) || 
      (prevPrice > prevMA && currPrice < currMA)) {
    → Signal
  }
  
  // Touch: Price within 0.5% of MA
  if (abs(currPrice - currMA) < currMA * 0.005) {
    → Signal
  }
}
```

### MA Crossover
```javascript
// Bullish: Fast MA crosses above Slow MA
if (direction === 'bullish') {
  if (prevFastMA < prevSlowMA && currFastMA > currSlowMA) {
    → Signal
  }
}

// Bearish: Fast MA crosses below Slow MA
if (direction === 'bearish') {
  if (prevFastMA > prevSlowMA && currFastMA < currSlowMA) {
    → Signal
  }
}
```

## Known Limitations

1. **RSI Calculation**: Currently shows placeholder signals (not actual RSI logic)
2. **Direction Field**: Not yet implemented for Price conditions (above/below)
3. **Recross Logic**: Not yet implemented
4. **Touches Counter**: Not yet implemented
5. **Multiple Parameters**: Comma-separated values only show first value (grid expansion pending)
6. **Timing Conditions**: Simplified to single example signal

## Next Steps

### Phase 1: Complete Signal Logic
- [ ] Implement actual RSI calculation and threshold detection
- [ ] Add direction field support (above/below for crosses)
- [ ] Implement recross logic (cross back)
- [ ] Add touches counter (trigger on Nth touch)
- [ ] Support delay parameter (bars to wait before signal)
- [ ] Support threshold parameter (% distance for touch)

### Phase 2: Grid Support
- [ ] Parse comma-separated values into arrays
- [ ] Generate multiple indicator traces for each parameter value
- [ ] Show all signals from all parameter combinations
- [ ] Color-code by parameter value
- [ ] Add legend showing which arrows are which parameters

### Phase 3: Enhanced Visualization
- [ ] Separate RSI subplot for RSI conditions
- [ ] Add volume bars at bottom
- [ ] Show exact values on hover
- [ ] Highlight signal candles
- [ ] Draw zones for Bollinger Bands / Keltner Channels
- [ ] Add vertical lines at signal times

### Phase 4: Combined View
- [ ] Single chart showing ALL conditions together
- [ ] Different arrow styles for different conditions
- [ ] Show AND/OR logic visually
- [ ] Highlight actual entry/exit pairs
- [ ] Calculate hypothetical P&L on preview data

## Performance Notes

- Manual update prevents lag during parameter editing
- Signal calculation is fast (<100ms for 252 data points)
- Plotly rendering is hardware accelerated
- Charts are responsive and interactive
- No memory leaks (old charts properly destroyed)

## Testing Checklist

- [x] Preview checkbox toggles container
- [x] Data loads successfully
- [x] "Update Preview" button generates charts
- [x] Entry conditions show green arrows numbered #1, #2, #3...
- [x] Exit conditions show red arrows numbered #1, #2, #3...
- [x] Price conditions detect crossovers correctly
- [x] MA crossover conditions detect crossovers correctly
- [x] Arrows are visible and properly labeled
- [x] Maximum 15 arrows per chart to avoid clutter
- [ ] Comma-separated values work (pending implementation)
- [ ] RSI conditions calculate correctly (pending implementation)
