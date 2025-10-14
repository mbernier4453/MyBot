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

def rsi_bollinger_bands(rsi: pd.Series, period: int, std_dev: float = 2.0) -> tuple[pd.Series, pd.Series, pd.Series]:
    """
    Calculate Bollinger Bands around RSI.
    Returns: (middle, upper, lower) as pandas Series
    """
    # Middle band is SMA of RSI
    middle = rsi.rolling(window=period, min_periods=period).mean()
    
    # Standard deviation of RSI
    std = rsi.rolling(window=period, min_periods=period).std()
    
    # Upper and lower bands
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    
    return middle, upper, lower

def compute_basic(df: pd.DataFrame, *, 
                  rsi_period: int, 
                  rsi_bb_period: int = None,
                  rsi_bb_std_dev: float = None) -> dict[str, pd.Series]:
    """
    Compute indicators. Returns dict with RSI and optional Bollinger Bands.
    
    Args:
        df: DataFrame with OHLCV data
        rsi_period: RSI calculation period (default 14)
        rsi_bb_period: Bollinger Band period for RSI (default 20)
        rsi_bb_std_dev: Bollinger Band std dev multiplier (default 2.0)
    
    Returns:
        Dict with keys: RSI, RSI_BB_MIDDLE, RSI_BB_UPPER, RSI_BB_LOWER
    """
    out: dict[str, pd.Series] = {}
    if get("RSI_ENABLED"):
        out["RSI"] = rsi_sma(df["Close"], int(rsi_period))
        
        # Calculate Bollinger Bands around RSI if params provided
        if rsi_bb_period is not None:
            bb_period = int(rsi_bb_period)
            bb_std = float(rsi_bb_std_dev) if rsi_bb_std_dev is not None else 2.0
            middle, upper, lower = rsi_bollinger_bands(out["RSI"], bb_period, bb_std)
            out["RSI_BB_MIDDLE"] = middle
            out["RSI_BB_UPPER"] = upper
            out["RSI_BB_LOWER"] = lower
    return out
