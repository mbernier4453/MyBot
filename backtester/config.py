#======================== Backtester config ========================
# Edit only these variables. Defaults fill anything missing.
# Legend: # ✅ implemented · # ⚠️ limited/conditional · # ⏳ not used

#=========================MAIN=========================
RUN_ID = "top_k_test2"                         # ✅ name or "auto" for timestamp
NOTES = ""                              # ⏳ freeform string per run
#TICKERS = ["UCC","UGE","DIG","UYG","RXL","UXI","UYM","URE","ROM","LTL","UPW", "SSO", "UPRO"]               # ✅ list of symbols
TICKERS = ["SPY", "QQQ"]               # ✅ list of symbols
INITIAL_CAPITAL = 100_000.0             # ✅
START = "2000-01-01"                    # ✅
END = "2025-09-01"                              # ✅ None = today
TIMESCALE = "1Day"                      # ⚠️ "1Day","5Min","15Min" (daily-only now)
BUY_HOLD_ENABLED = True                 # ✅ buy-hold baseline
BENCHMARK_ENABLED = True                # ✅ benchmark baseline
BENCHMARK_SYMBOL = "SPY"                # ✅ benchmark ticker
RF_ANNUAL = 0.02                        # ✅ 2% annual
PERIODS_PER_YEAR = 252                  # ✅ trading periods per year

#===========Portfolio Mode Config Example===============
PORTFOLIO_MODE = False  # master toggle
PORTFOLIO_WEIGHTS = {           # Fixed target weights (sum should be 1.0; if None -> equal weights auto)
    "SPY": 0.60,
    "QQQ": 0.40,
}
PORTFOLIO_TARGET_UTILIZATION = 0.95  # portion of capital to use (0.0–1.0)
PORTFOLIO_USE_PARAM_GRID = False  # False => use PORTFOLIO_STRATEGIES, True => use PORTFOLIO_PARAM_GRID
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



SEED = 42                               # ⏳
#=========================Entry========================
ENTRY_MODE = "ALL"             # ⏳ "ALL","ANY","EXPRESSION"- which signals to use
TARGET_WEIGHT = 0.95           # ✅ 0.0–1.0 per trade (for portfolio mode, this is % of ticker's % weight)
ORDER_TYPE = "MOO"             # ⚠️ "MOO","MOC","MKT","LMT" (MOO/MOC only)
ENTRY_FEES_BPS = 10            # ✅ in bps
SLIP_OPEN_BPS = 2              # ✅ entry slippage in bps
ENTRY_DELAY_BARS = 0           # ⏳ wait N bars after signal before entry
EXPIRE_AFTER_BARS = 0          # ⏳ 0 = signal never expires
RECHECK_ON_DELAY = False       # ⏳ if delayed, revalidate signal at execution bar
VICE_VERSA = True              # ⏳ take opposite on exit when opposite signal fires
ALLOW_PARTIAL_FILLS = False    # ⚠️ allow partial sizing when capital is short (currently always partial-int sizing)

#========================= Exit =========================
EXIT_MODE = "ANY"              # ⏳ "ALL","ANY","EXPRESSION","NONE"
EXIT_FEES_BPS = 10             # ✅ in bps
SLIP_CLOSE_BPS = 2             # ⚠️ exit slippage in bps  ---no effect when order type MOO
EXIT_DELAY_BARS = 0            # ⏳ wait N bars after signal before exit
# Risk management
STOP_ENABLED = True            # ⏳
STOP_TYPE = "percent"          # ⏳ "percent","atr","absolute"
STOP_VALUE = 0.05              # ⏳
TAKE_ENABLED = True            # ⏳
TAKE_TYPE = "percent"          # ⏳
TAKE_VALUE = 0.10              # ⏳
MAX_BARS_IN_TRADE = None       # ⏳ None = no limit
COOLDOWN_BARS_AFTER_RISK = 0   # ⏳
RISK_REENTRY = "none"          # ⏳ "none","immediate_if_opposite","wait_for_fresh_cross"

#========================= Data =========================
SOURCE = "yfinance"            # ✅ "yfinance","polygon" (yfinance only)
TZ = "America/New_York"        # ⏳
ADJUST = "split_and_div"       # ✅ "split_and_div","split_only","none"

#========================= Indicators ====================
# RSI grid (engine should sweep cartesian product if lists provided)
RSI_ENABLED = True                                          # ✅
RSI_PERIOD = [14]                      # ✅
# RSI_PERIOD = [12,13,14,15,16,17,18,19]                      # ✅
RSI_BUY_BELOW = [5,10,15,20,25,30,35,40]              # ✅
# RSI_BUY_BELOW = [5,10,15,20,25,30,35,40]              # ✅
RSI_SELL_ABOVE = [60,65,70,75,80,85]            # ✅
# RSI_SELL_ABOVE = [60,65,70,75,80,85]            # ✅

# Bollinger Bands
BOLLINGER_BANDS_ENABLED = False  # ⏳
BB_PERIOD = 20                    # ⏳
BB_STD_DEV = 2.0                  # ⏳
BB_BUY_SIDE = "lower"          # ⏳ "lower","upper","middle"
BB_SELL_SIDE = "upper"         # ⏳ "lower","upper","middle"

# EMA block
EMA_BLOCK_ENABLED = False       # ⏳
EMA_PRICE_CROSS = False         # ⏳
EMA_PRICE_CROSS_SIDE = "up"    # ⏳ "up","down"
EMA_PRICE_LEN = 21              # ⏳
EMA_MA_CROSS = False            # ⏳
EMA_MA_CROSS_SIDE = "up"       # ⏳ "up" means short crosses above long
EMA_SHORT = 20                  # ⏳
EMA_LONG = 40                   # ⏳
EMA_DISTANCE_PCT = 0.0         # ⏳ min gap at signal bar

# HMA block
HMA_BLOCK_ENABLED = False       # ⏳
HMA_PRICE_CROSS = False         # ⏳
HMA_PRICE_CROSS_SIDE = "down"   # ⏳
HMA_PRICE_LEN = 50              # ⏳
HMA_MA_CROSS = False            # ⏳
HMA_MA_CROSS_SIDE = "down"      # ⏳
HMA_SHORT = 50                  # ⏳
HMA_LONG = 100                  # ⏳
HMA_DISTANCE_PCT = 0.01         # ⏳

# Price to Moving Average
PRICE_TO_MA_ENABLED = False     # ⏳
PRICE_TO_MA_PERIOD = 21         # ⏳
PRICE_TO_MA_BUY = "above"                  # ⏳ "above","below"
PRICE_TO_MA_BUY_THRESHOLD = 0.015          # ⏳ 1.5%
PRICE_TO_MA_SELL = "below"                 # ⏳ "above","below"
PRICE_TO_MA_SELL_THRESHOLD = 0.015         # ⏳

#========================= Outputs =========================

CSV_DIR = "./results/csv"                 # ✅ path for metrics CSV when enabled
SAVE_METRICS = True                       # ✅ write metrics CSV rows

# Database
SAVE_TO_DUCKDB = True                     # ⏳ append results to a DuckDB file
RUNS_DB_PATH = "./results/runs.duckdb"    # ⏳ DuckDB database file path
SAVE_TRADES = True                        # ⏳ persist per-fill trades
SAVE_EQUITY = False                       # ⏳ persist equity curve per run
SAVE_VIZ_DATA = False                     # ⏳ persist 3D viz table

# Charts and reports
MAKE_CHARTS = True                # ✅ toggle charts for tearsheets + main standalone
CHART_PATH = "./results/charts"       # ✅ where to save main chart HTML

MAKE_TEARSHEETS = True                   # ✅ full report with KPIs and plots
RUN_CAPM = True                           # ✅ include CAPM analysis in tearsheet
TEARSHEETS_DIR = "./results/tearsheets"   # ✅ where to save tearsheets

# Print and selection
# TOP_BY = ["total_return", "sharpe", "sortino", "vol", "cagr"]      # ✅ metrics to sort by for top-K printout(s) ["total_return", "sharpe", "sortino", "vol", "maxdd", "cagr", "trades_total"]
TOP_BY = ["sharpe"]      # ✅ metrics to sort by for top-K printout(s) ["total_return", "sharpe", "sortino", "vol", "maxdd", "cagr", "trades_total"]
TOP_K = 3                           # ✅ top K to print/tearsheet per metric
PRINT_TOP_K = False                     # ✅ whether to print top-K summary
# Metadata snapshots
SAVE_CONFIG_SNAPSHOT = True               # ⏳ write a copy of this config under results
SAVE_GIT_COMMIT = True                    # ⏳ record git commit hash if repo present
SAVE_DATA_VERSION = True                  # ⏳ record data adapter + params used
