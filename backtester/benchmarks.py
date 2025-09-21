# backtester/benchmarks.py
"""
Benchmark and buy-hold helpers.
"""
from __future__ import annotations
import pandas as pd
import yfinance as yf

OHLCV = ["Open", "High", "Low", "Close", "Volume"]

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    if isinstance(df.columns, pd.MultiIndex):
        # pick the first match for each field
        picked = {}
        for field in OHLCV:
            matches = [c for c in df.columns if field in c]
            if not matches:
                raise KeyError(f"Field '{field}' missing in yfinance result")
            picked[field] = df[matches[0]]
        out = pd.concat(picked, axis=1)
        out.columns = OHLCV
        return out
    # flat
    return df[OHLCV]

def load_benchmark(symbol: str, *, start: str | None, end: str | None, auto_adjust: bool = True) -> pd.DataFrame:
    """
    Return OHLCV for benchmark with UTC index and float dtypes.
    """
    df = yf.download(
        symbol, start=start, end=end, interval="1d",
        auto_adjust=auto_adjust, progress=False, group_by="column"
    )
    if df.empty:
        raise ValueError(f"No benchmark data for {symbol}")
    df = _normalize_columns(df).astype({
        "Open": "float32", "High": "float32", "Low": "float32", "Close": "float32", "Volume": "float64"
    }).dropna()
    df.index = pd.to_datetime(df.index, utc=True)
    return df

def buy_hold_equity(close: pd.Series, init_capital: float) -> pd.Series:
    """
    Adjusted buy-and-hold equity: invest all at t0, reinvest implicitly via adjusted close.
    Equity_t = init_capital * Close_t / Close_0
    """
    c = close.astype("float64")
    eq = init_capital * (c / c.iloc[0])
    eq.name = "buy_hold_equity"
    return eq

def equity_from_returns(returns: pd.Series, init_capital: float) -> pd.Series:
    """
    Equity from simple returns series. Starts at init_capital.
    """
    r = returns.fillna(0.0).astype("float64")
    eq = init_capital * (1.0 + r).cumprod()
    eq.name = "equity_from_returns"
    return eq
