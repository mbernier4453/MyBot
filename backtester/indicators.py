"""
Indicators. RSI uses SMA of gains/losses.
"""
import numpy as np
import pandas as pd
from .settings import get

EPS32 = np.finfo(np.float32).eps

def rsi_sma(close: pd.Series, period: int) -> pd.Series:
    # Force 1-D float32
    c = pd.Series(close).astype("float32").to_numpy().ravel()
    n = c.size
    out = np.full(n, np.nan, dtype=np.float32)
    if n <= period:
        return pd.Series(out, index=close.index)

    diff = np.zeros(n, dtype=np.float32)
    diff[1:] = c[1:] - c[:-1]

    gains = np.maximum(diff, 0.0)
    losses = np.maximum(-diff, 0.0)

    csg = gains.cumsum(dtype=np.float64)
    csl = losses.cumsum(dtype=np.float64)

    sum_g = csg[period:] - csg[:-period]
    sum_l = csl[period:] - csl[:-period]

    avg_g = sum_g / period
    avg_l = sum_l / period

    rsi = np.empty_like(avg_g, dtype=np.float32)
    both0 = (avg_g == 0) & (avg_l == 0)
    onlyg = (avg_g > 0) & (avg_l == 0)
    onlyl = (avg_g == 0) & (avg_l > 0)
    other = ~(both0 | onlyg | onlyl)

    rsi[both0] = 50.0
    rsi[onlyg] = 100.0
    rsi[onlyl] = 0.0
    rs = avg_g[other] / np.maximum(avg_l[other], EPS32)
    rsi[other] = 100.0 - 100.0 / (1.0 + rs)

    out[period:] = rsi
    return pd.Series(out, index=close.index, dtype="float32")

def compute_basic(df: pd.DataFrame, *, rsi_period: int) -> dict[str, pd.Series]:
    out: dict[str, pd.Series] = {}
    if get("RSI_ENABLED"):
        out["RSI"] = rsi_sma(df["Close"], int(rsi_period))
    return out
