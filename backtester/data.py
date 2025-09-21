"""
Fetch OHLCV via yfinance. Normalize columns whether single- or multi-index.
No caching.
"""
import pandas as pd
import yfinance as yf
from .settings import get

OHLCV = ["Open", "High", "Low", "Close", "Volume"]

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a DataFrame with columns exactly OHLCV.
    Works for:
      - flat columns
      - MultiIndex with ('Field','Ticker') or ('Ticker','Field')
    """
    if df.empty:
        return df

    cols = df.columns

    # Case 1: already flat with required fields
    if not isinstance(cols, pd.MultiIndex):
        missing = [c for c in OHLCV if c not in cols]
        if missing:
            # Some yfinance builds name columns oddly; try to coerce casing
            raise KeyError(f"Missing columns after download: {missing}")
        return df[OHLCV]

    # Case 2: MultiIndex. Pick the element that matches each OHLCV once.
    picked = {}
    for field in OHLCV:
        # Find the first column tuple that contains the field at any level
        matches = [c for c in cols if field in c]
        if not matches:
            raise KeyError(f"Field '{field}' not found in yfinance columns {list(cols)}")
        picked[field] = df[matches[0]]

    out = pd.concat(picked, axis=1)
    out.columns = OHLCV
    return out

def load_bars(symbols: list[str]) -> dict[str, pd.DataFrame]:
    source = get("SOURCE")
    if source != "yfinance":
        raise NotImplementedError("Only yfinance supported")

    start, end = get("START"), get("END")
    auto_adjust = get("ADJUST") == "split_and_div"

    out: dict[str, pd.DataFrame] = {}
    for s in symbols:
        df = yf.download(
            s,
            start=start,
            end=end,
            interval="1d",
            auto_adjust=auto_adjust,
            progress=False,
            group_by="column",  # prefer field-first layout
        )
        if df.empty:
            continue

        df = _normalize_columns(df)

        # Types and index
        df = df.astype({
            "Open": "float32",
            "High": "float32",
            "Low": "float32",
            "Close": "float32",
            "Volume": "float64",
        }).dropna()
        df.index = pd.to_datetime(df.index, utc=True)

        out[s] = df

    if not out:
        raise ValueError("No data loaded")
    return out
