"""
Load ALL-CAPS from backtester/config.py, overlay on defaults, expose CONFIG.
Lists are preserved (needed for grid runs).
"""
from importlib import import_module
from datetime import datetime

DEFAULTS = {
    # Run + data
    "RUN_ID": "auto",
    "TICKERS": ["AAPL"],
    "INITIAL_CAPITAL": 100_000.0,
    "START": "2020-01-01",
    "END": None,
    "TIMESCALE": "1Day",
    "SOURCE": "yfinance",
    "TZ": "America/New_York",
    "ADJUST": "split_and_div",

    # Metrics
    "RF_ANNUAL": 0.0,
    "PERIODS_PER_YEAR": 252,

    # Execution
    "ENTRY_MODE": "ALL",
    "TARGET_WEIGHT": 0.95,
    "ORDER_TYPE": "MOO",
    "ENTRY_FEES_BPS": 0.0,
    "EXIT_FEES_BPS": 0.0,
    "SLIP_OPEN_BPS": 0.0,
    "SLIP_CLOSE_BPS": 0.0,
    "ENTRY_DELAY_BARS": 0,
    "EXIT_DELAY_BARS": 0,
    "EXPIRE_AFTER_BARS": 0,
    "RECHECK_ON_DELAY": False,
    "VICE_VERSA": True,
    "ALLOW_PARTIAL_FILLS": False,
    "EXIT_MODE": "ANY",

    # Risk toggles (engine may ignore in MVP)
    "STOP_ENABLED": False,
    "STOP_TYPE": "percent",
    "STOP_VALUE": 0.05,
    "TAKE_ENABLED": False,
    "TAKE_TYPE": "percent",
    "TAKE_VALUE": 0.10,
    "MAX_BARS_IN_TRADE": None,
    "COOLDOWN_BARS_AFTER_RISK": 0,
    "RISK_REENTRY": "none",

    # Indicators (lists allowed for grid)
    "RSI_ENABLED": True,
    "RSI_PERIOD": [14],
    "RSI_BUY_BELOW": [30],
    "RSI_SELL_ABOVE": [70],

    # Outputs
    "CSV_DIR": "./results/csv",
    "PRINT_TOP_K": 3,

}

def _load_user():
    try:
        return import_module("backtester.config")
    except Exception:
        return None

def _upper_vars(mod):
    if mod is None:
        return {}
    return {k: getattr(mod, k) for k in dir(mod) if k.isupper()}

USER = _upper_vars(_load_user())

# Preserve lists for grid use
CONFIG = {**DEFAULTS, **USER}

def get(key, fallback=None):
    return CONFIG.get(key, fallback)

def resolve_run_id():
    rid = get("RUN_ID")
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S") if not rid or rid == "auto" else rid
