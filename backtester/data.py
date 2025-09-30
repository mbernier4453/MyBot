"""
Fetch OHLCV via yfinance. Normalize columns whether single- or multi-index.
No caching.
"""
import os
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

def get_data(symbol: str, start=None, end=None):
    """
    Unified loader returning a DataFrame with at least a 'close' column.
    Priority:
      1) Local CSV: ./data/{symbol}.csv   (config DATA_DIR override)
         Expected columns: date, close (case-insensitive) OR typical OHLCV.
      2) yfinance download (if installed)
    Date filters (start/end) applied after load if possible.
    """
    data_dir = get("DATA_DIR", "./data")
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, f"{symbol}.csv")

    df = None

    # 1) Local CSV
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            # Try to detect date column
            date_col = None
            for c in ["date", "Date", "timestamp", "Timestamp"]:
                if c in df.columns:
                    date_col = c
                    break
            if date_col:
                df[date_col] = pd.to_datetime(df[date_col])
                df = df.set_index(date_col).sort_index()
        except Exception:
            df = None

    # 2) yfinance fallback
    if df is None:
        try:
            yf_df = yf.download(symbol, start=start, end=end, progress=False, auto_adjust=False)
            if not yf_df.empty:
                yf_df.index.name = "date"
                df = yf_df
        except Exception:
            pass

    if df is None or df.empty:
        raise ValueError(f"Unable to load data for {symbol}")

    # --- begin replace block (column normalization + ensure 'close') ---
    # Normalize / flatten column names safely (handles tuples / MultiIndex)
    flat_cols = []
    for col in df.columns:
        if isinstance(col, tuple):
            parts = [str(p) for p in col if p not in (None, "", " ")]
            name = "_".join(parts) if parts else "col"
            flat_cols.append(name.lower())
        else:
            flat_cols.append(str(col).lower())
    df.columns = flat_cols

    # If still MultiIndex (safety)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            "_".join(str(p) for p in tup if p not in (None, "", " ")).lower()
            for tup in df.columns.to_flat_index()
        ]

    # Create 'close' if needed
    if "close" not in df.columns:
        for alt in ["adj_close", "adjclose", "adj close", "price", "last", "close_"]:
            if alt in df.columns:
                df = df.rename(columns={alt: "close"})
                break
    if "close" not in df.columns:
        candidates = [c for c in df.columns if "close" in c]
        if candidates:
            df = df.rename(columns={candidates[0]: "close"})
    if "close" not in df.columns:
        raise ValueError(f"No close column found for {symbol}")
    # --- end replace block ---

    # Optional date trimming (keep this after the block)
    if start and isinstance(df.index, pd.DatetimeIndex):
        df = df[df.index >= pd.to_datetime(start)]
    if end and isinstance(df.index, pd.DatetimeIndex):
        df = df[df.index <= pd.to_datetime(end)]

    return df
