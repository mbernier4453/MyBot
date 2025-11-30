# RSI and MACD

## Overview

The **Relative Strength Index (RSI)** and **Moving Average Convergence Divergence (MACD)** are two of the most popular momentum indicators in technical analysis. They help identify overbought/oversold conditions and trend reversals.

## Relative Strength Index (RSI)

### What is RSI?

RSI is a momentum oscillator that measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions.

**Scale:** 0 to 100

**Key Levels:**
- **Above 70:** Overbought (potential reversal down)
- **Below 30:** Oversold (potential reversal up)
- **50:** Neutral zone

### Calculation

RSI uses **Wilder's smoothing method**:

```
RS = Average Gain / Average Loss (over 14 periods)
RSI = 100 - (100 / (1 + RS))
```

**Default period:** 14 days/candles

### Interpretation

✅ **Bullish Signals:**
- RSI crosses above 30 (exiting oversold)
- Bullish divergence: Price makes lower low, RSI makes higher low

⚠️ **Bearish Signals:**
- RSI crosses below 70 (exiting overbought)
- Bearish divergence: Price makes higher high, RSI makes lower high

### Important Notes

⚠️ **Common Mistakes:**
- Don't sell just because RSI > 70 in a strong uptrend
- Don't buy just because RSI < 30 in a strong downtrend
- RSI can stay overbought/oversold for extended periods

**Better Strategy:** Combine RSI with trend analysis. In an uptrend, look for RSI pullbacks to 40-50 as buying opportunities.

## Moving Average Convergence Divergence (MACD)

### What is MACD?

MACD shows the relationship between two exponential moving averages (EMAs) and helps identify changes in momentum, strength, and direction of a trend.

**Components:**
1. **MACD Line** = 12-period EMA - 26-period EMA
2. **Signal Line** = 9-period EMA of MACD Line
3. **Histogram** = MACD Line - Signal Line

### Interpretation

✅ **Bullish Signals:**
- MACD crosses above Signal Line (bullish crossover)
- MACD crosses above zero line
- Positive histogram growing (increasing momentum)

⚠️ **Bearish Signals:**
- MACD crosses below Signal Line (bearish crossover)
- MACD crosses below zero line
- Negative histogram growing (increasing downward momentum)

### Divergences

**Bullish Divergence:**
- Price makes lower low
- MACD makes higher low
- **Signal:** Potential trend reversal up

**Bearish Divergence:**
- Price makes higher high
- MACD makes lower high
- **Signal:** Potential trend reversal down

## Using RSI and MACD Together

### Strategy: Confluence Trading

**Buy Signal (all must align):**
1. RSI crosses above 30
2. MACD bullish crossover
3. Price above 50-day moving average

**Sell Signal:**
1. RSI crosses below 70
2. MACD bearish crossover
3. Price below 50-day moving average

### Real Example

**Tesla (TSLA) - October 2024:**
- Price: $250
- RSI: Dropped to 28 (oversold)
- MACD: Bullish crossover at -5
- **Action:** Buy signal
- **Result:** Price rallied to $290 (+16%)

## Using αlpharhythm's RSI Dashboard

The **RSI Dashboard** in αlpharhythm provides:

### RSI History Table
Shows RSI highs/lows over:
- 3 months
- 6 months
- 1 year
- 2 years
- 5 years

**How to use:**
1. Navigate to the RSI tab
2. Select a ticker from your watchlist
3. Review historical RSI extremes
4. Compare current RSI to historical levels

### RSI Synergy Panel

Displays RSI across multiple timeframes:
- **Weekly**: Long-term trend
- **Daily**: Medium-term signals
- **60-min**: Intraday momentum
- **15-min**: Short-term scalping
- **5-min**: High-frequency trading

**Confluence Example:**
If all timeframes show RSI > 60, it's a **strong bullish trend**. If weekly is oversold but daily is overbought, expect **consolidation**.

## Common RSI/MACD Patterns

### Pattern 1: The Breakout

**Setup:**
- Price consolidating in range
- RSI between 40-60 (neutral)
- MACD flat near zero

**Signal:**
- Price breaks range
- RSI breaks above 60 or below 40
- MACD confirms with crossover

**Action:** Trade in direction of breakout

### Pattern 2: The Failed Breakout

**Setup:**
- Price makes new high
- RSI fails to make new high (bearish divergence)
- MACD showing weakening histogram

**Signal:** False breakout, prepare for reversal

### Pattern 3: The Oversold Bounce

**Setup:**
- Sharp price decline
- RSI drops below 20 (extreme oversold)
- MACD deeply negative

**Signal:**
- RSI turns up from below 30
- MACD histogram starts shrinking

**Action:** Buy for bounce trade (but set tight stop)

## Advanced Tips

### 1. Adjust RSI Period

**Standard:** 14 periods
**For faster signals:** 9 periods (more sensitive, more false signals)
**For slower signals:** 21 periods (less sensitive, fewer signals)

### 2. MACD Settings

**Standard:** 12, 26, 9
**For crypto/volatile assets:** 5, 13, 5 (faster)
**For long-term investing:** 19, 39, 9 (slower)

### 3. Multi-Timeframe Analysis

Always check RSI/MACD on:
- **Higher timeframe:** Overall trend direction
- **Entry timeframe:** Signal timing
- **Lower timeframe:** Entry precision

Example: If daily RSI is oversold, wait for 4-hour MACD bullish crossover before entering.

## Backtesting with αlpharhythm

Use the **Backtest** module to test RSI/MACD strategies:

### Sample Strategy

**Entry Conditions:**
- RSI crosses above 30
- MACD crosses above signal line

**Exit Conditions:**
- RSI crosses below 70
- MACD crosses below signal line

**Settings:**
- Timeframe: Daily
- Period: 2020-2024
- Symbol: SPY

Run this backtest to see historical performance metrics (Sharpe ratio, win rate, max drawdown).

## Key Takeaways

- RSI measures momentum on a 0-100 scale
- MACD shows trend changes through crossovers
- Both indicators work best **with confirmation** from other signals
- Don't rely on overbought/oversold levels alone
- Watch for **divergences** as powerful reversal signals
- Use αlpharhythm's RSI Dashboard for multi-timeframe analysis

**Next Lesson:** **Bollinger Bands** - Understanding volatility and mean reversion.
