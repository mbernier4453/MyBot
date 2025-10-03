# S&P 500 Treemap - Current Configuration

## Stock List (100 Companies)

Currently tracking the **top 100 S&P 500 companies** by market cap:

AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, BRK.B, UNH, LLY,
JPM, V, XOM, JNJ, PG, MA, AVGO, HD, CVX, MRK,
ABBV, COST, PEP, KO, WMT, ADBE, CRM, MCD, CSCO, ACN,
TMO, ABT, LIN, NFLX, DHR, NKE, VZ, TXN, DIS, PM,
ORCL, WFC, NEE, BMY, RTX, CMCSA, INTC, AMD, UPS, HON,
IBM, QCOM, INTU, AMGN, GE, CAT, BA, SPGI, LOW, SBUX,
GS, T, AXP, BLK, GILD, ELV, DE, BKNG, MMC, PLD,
ISRG, ADI, SYK, TJX, ADP, MDLZ, VRTX, REGN, CVS, CI,
ZTS, LRCX, NOW, C, TMUS, MO, PGR, AMAT, SO, DUK,
ETN, BSX, CB, SCHW, EOG, BDX, HUM, SLB, PYPL, NOC

## Sizing Options

### Market Cap (Default) ⭐
- **Tile size** based on company market capitalization
- **Largest companies** get bigger tiles
- Most realistic representation of market weight
- Uses approximate values (~$100B scale)

### Volume
- **Tile size** based on trading volume
- **Most actively traded** stocks get bigger tiles
- Shows market activity and liquidity

### Equal Size
- All stocks get **equal-sized tiles**
- Better for seeing **every stock clearly**
- Focus purely on performance colors

## Ordering

Tiles are currently sorted by **performance** (best to worst):
- Best performers (highest %) at top-left
- Worst performers (lowest %) at bottom-right
- D3.js automatically arranges for optimal space usage

## Colors

- **Green intensity**: Based on positive % change (0% to 3%+)
- **Red intensity**: Based on negative % change (0% to -3%+)
- **Gray**: No change (0%)

## Tooltip Info

Hover over any tile to see:
- Ticker symbol
- Percentage change (with +/- sign)
- Current price
- Market capitalization (in billions)
- Trading volume (in millions)

## Connection Limits

If you see "Maximum connections exceeded":
- The app will **no longer auto-reconnect** to avoid hitting the limit
- Click the **"Reconnect" button** manually when ready
- Each reconnect counts toward your limit

## Future Enhancements

- [ ] Market cap-based sizing
- [ ] Full 500 stock coverage
- [ ] Sector grouping/filtering
- [ ] Click-through to detailed view
- [ ] Historical replay mode
- [ ] Custom watchlists
