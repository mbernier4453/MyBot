#======================== Backtester Configuration ========================
# Core configuration for RSI-based backtesting system
# All values are implemented and functional

#========================= Run Settings =========================
RUN_ID = "EditingtheEngine"                     # Run identifier or "auto" for timestamp
NOTES = "Testing strategy + buy/hold + benchmark"  # Optional description
TICKERS = ["XLP", "XLF", "XLK"]                 # List of symbols to backtest
# TICKERS = [
#     "XLP",  # Consumer Staples Select Sector SPDR
#     "XLF",  # Financial Select Sector SPDR
#     "XLK",  # Technology Select Sector SPDR
#     "XLE",  # Energy Select Sector SPDR
#     "XLY",  # Consumer Discretionary Select Sector SPDR
#     "XLI",  # Industrial Select Sector SPDR
#     "XLV",  # Health Care Select Sector SPDR
#     "XLB",  # Materials Select Sector SPDR
#     "XLU",  # Utilities Select Sector SPDR
#     "XLRE", # Real Estate Select Sector SPDR
#     "XLC",  # Communication Services Select Sector SPDR
#     "UCC",  # ProShares Ultra Consumer Services (2x leveraged)
#     "UGE",  # ProShares Ultra Consumer Goods (2x leveraged)
#     "DIG",  # ProShares Ultra Oil & Gas (2x leveraged)
#     "UYG",  # ProShares Ultra Financials (2x leveraged)
#     "RXL",  # ProShares Ultra Health Care (2x leveraged)
#     "UXI",  # ProShares Ultra Industrials (2x leveraged)
#     "UYM",  # ProShares Ultra Basic Materials (2x leveraged)
#     "URE",  # ProShares Ultra Real Estate (2x leveraged)
#     "ROM",  # ProShares Ultra Technology (2x leveraged)
#     "LTL",  # ProShares Ultra Telecommunications (2x leveraged)
#     "UPW"   # ProShares Ultra Utilities (2x leveraged)
# ]
INITIAL_CAPITAL = 100_000.0
START = "2000-01-01"
END = "2025-09-01"                      # None = today
TIMESCALE = "1Day"                      # Currently only daily supported
BUY_HOLD_ENABLED = True                 # Include buy & hold comparison
BENCHMARK_ENABLED = True                # Include benchmark comparison
BENCHMARK_SYMBOL = "QQQ"                # Benchmark ticker
RF_ANNUAL = 0.02                        # Risk-free rate (2% annual)
PERIODS_PER_YEAR = 252                  # Trading days per year

#========================= Portfolio Mode =========================
PORTFOLIO_MODE = False  # Enable portfolio mode (multi-symbol strategies)
PORTFOLIO_WEIGHTS = {           # Fixed allocation weights (sum to 1.0, or None for equal weights)
    "SPY": 0.40,
    "QQQ": 0.60,
}
PORTFOLIO_TARGET_UTILIZATION = 0.95  # Portion of capital to deploy (0.0–1.0)
PORTFOLIO_USE_PARAM_GRID = False  # False = use PORTFOLIO_STRATEGIES, True = use PORTFOLIO_PARAM_GRID
PORTFOLIO_STRATEGIES = {
    "SPY": {
        "rsi_period": 14,
        "rsi_buy_below": 40,
        "rsi_sell_above": 80,
    },
    "QQQ": {
        "rsi_period": 19,
        "rsi_buy_below": 35,
        "rsi_sell_above": 75,
    },
}
PORTFOLIO_PARAM_GRID = {
    "SPY": [
        {"rsi_period": 14, "rsi_buy_below": 40, "rsi_sell_above": 80},
        {"rsi_period": 21, "rsi_buy_below": 35, "rsi_sell_above": 78},
    ],
    "QQQ": [
        {"rsi_period": 10, "rsi_buy_below": 38, "rsi_sell_above": 82},
        {"rsi_period": 16, "rsi_buy_below": 37, "rsi_sell_above": 79},
    ],
}

#========================= Trade Execution =========================
TARGET_WEIGHT = 0.95           # Position size as fraction of capital (0.0–1.0)
ORDER_TYPE = "MOO"             # Order type: "MOO" (Market-on-Open) or "MOC" (Market-on-Close)
ENTRY_FEES_BPS = 10            # Entry transaction fees in basis points
SLIP_OPEN_BPS = 2              # Entry slippage in basis points
EXIT_FEES_BPS = 10             # Exit transaction fees in basis points
SLIP_CLOSE_BPS = 2             # Exit slippage in basis points

#========================= Data Source =========================
SOURCE = "yfinance"            # Data source: "yfinance" (only option currently)
ADJUST = "split_and_div"       # Price adjustment: "split_and_div", "split_only", or "none"

#========================= RSI Strategy Parameters =========================
RSI_ENABLED = True
RSI_PERIOD = [14]              # RSI lookback period(s) - list for parameter grid
# RSI_PERIOD = [12,13,14,15,16,17,18,19]  # Full grid example
RSI_BUY_BELOW = [5,10,15,20,25,30,35,40,45]    # Buy threshold(s)
RSI_SELL_ABOVE = [55,60,65,70,75,80,85,90,95]  # Sell threshold(s)

#========================= Output & Storage =========================
# CSV Export
CSV_DIR = "./results/csv"
SAVE_METRICS = True            # Export metrics to CSV

# Database
SAVE_DB = True                 # Save results to SQLite database
DB_PATH = "./results/db"       # Database folder (backtests.db will be created here)
SAVE_TRADES = True             # Store individual trade records

# Tearsheets (generated on-demand from frontend)
TEARSHEETS_DIR = "./results/tearsheets"
