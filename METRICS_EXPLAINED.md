# Trading Metrics Explained

## Win Rate vs Net Win Rate

### Win Rate
**Definition:** Percentage of trades that were profitable.

**Formula:** `Win Rate = Winning Trades / Total Trades`

**Example:**
- 10 total trades
- 7 winning trades (profit > 0)
- 3 losing trades (profit < 0)
- **Win Rate = 7/10 = 70%**

**What it tells you:** How often you're right. A 70% win rate means 70% of your trades made money.

---

### Net Win Rate
**Definition:** The difference between winning trades and losing trades as a percentage of total trades. Measures the *net* success rate.

**Formula:** `Net Win Rate = (Winning Trades - Losing Trades) / Total Trades`

**Example:**
- 10 total trades
- 7 winning trades
- 3 losing trades
- **Net Win Rate = (7 - 3) / 10 = 40%**

**What it tells you:** Your overall win/loss balance. 

---

## Why Both Matter

### Win Rate alone can be misleading:
- **High Win Rate (90%)** but small wins and huge losses = still lose money
- Example: 9 trades win $100 each = $900. 1 trade loses $2000 = Net: -$1100
- Win Rate: 90% (sounds great!)
- But you lost money overall

### Net Win Rate provides context:
- **Net Win Rate = (9 - 1) / 10 = 80%**
- Still doesn't show size of wins/losses, but shows you're winning much more often than losing

### Both together paint a better picture:
- **High Win Rate + High Net Win Rate** = Consistent winner
- **High Win Rate + Low Net Win Rate** = Many small wins, but losses cancel them out
- **Low Win Rate + Positive Net Win Rate** = Rare wins but they outweigh losses

---

## Other Important Metrics to Compare

### Average Trade PnL
Shows the *size* of your average profit/loss per trade. This is critical!

**Example Comparison:**

**Strategy A:**
- Win Rate: 90%
- Net Win Rate: 80%
- Avg Trade PnL: -$10
- **Result:** Losing money despite high win rate!

**Strategy B:**
- Win Rate: 40%
- Net Win Rate: -20%
- Avg Trade PnL: $50
- **Result:** Making money with low win rate! (Big wins > small losses)

---

## Best Practice

Always look at these metrics together:
1. **Win Rate** - How often you win
2. **Net Win Rate** - Win/loss balance
3. **Avg Trade PnL** - Average profit per trade
4. **Total Return** - Did you actually make money?
5. **Sharpe/Sortino** - Risk-adjusted returns

**The goal isn't to maximize win rate - it's to maximize total return with acceptable risk!**
