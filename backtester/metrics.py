# backtester/metrics.py
from __future__ import annotations
import numpy as np
import pandas as pd
from .settings import get
from .benchmarks import load_benchmark, equity_from_returns, buy_hold_equity

# ---------- core KPI helpers ----------
def _downside_std(excess: pd.Series) -> float:
    neg = excess.copy()
    neg[neg > 0] = 0.0
    return float(neg.std(ddof=1))

def max_drawdown(equity: pd.Series) -> float:
    eq = equity.astype("float64").to_numpy()
    run_max = np.maximum.accumulate(eq)
    dd = 1.0 - (eq / np.maximum(run_max, 1e-12))
    return float(dd.max(initial=0.0))

def kpis_from_equity(equity: pd.Series) -> dict:
    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))
    per_year = float(get("PERIODS_PER_YEAR", 252))
    rf_annual = float(get("RF_ANNUAL", 0.0))
    rf_daily = rf_annual / per_year if per_year > 0 else 0.0

    eq = equity.astype("float64")
    rets = eq.pct_change().dropna()
    end_cap = float(eq.iloc[-1])
    total_return = end_cap / init_cap - 1.0

    if rets.empty:
        return dict(end_cap=end_cap, total_return=total_return,
                    cagr=np.nan, sharpe=np.nan, sortino=np.nan,
                    vol=np.nan, maxdd=np.nan, bars=len(eq))

    years = len(rets) / per_year if per_year > 0 else np.nan
    cagr = (end_cap / init_cap) ** (1.0 / years) - 1.0 if years and years > 0 else np.nan

    excess = rets - rf_daily
    mu = float(excess.mean())
    sd = float(excess.std(ddof=1))
    dsd = _downside_std(excess)
    sharpe = (mu / sd) * np.sqrt(per_year) if sd > 0 else np.nan
    sortino = (mu / dsd) * np.sqrt(per_year) if dsd > 0 else np.nan
    vol = float(rets.std(ddof=1)) * np.sqrt(per_year)
    mdd = max_drawdown(eq)

    return dict(end_cap=end_cap, total_return=total_return, cagr=cagr,
                sharpe=sharpe, sortino=sortino, vol=vol, maxdd=mdd, bars=len(eq))

# ---------- series providers (computed once) ----------
_bench_eq_full: pd.Series | None = None

def get_benchmark_equity() -> pd.Series | None:
    if not bool(get("BENCHMARK_ENABLED", False)):
        return None
    global _bench_eq_full
    if _bench_eq_full is not None:
        return _bench_eq_full
    sym = get("BENCHMARK_SYMBOL", "SPY")
    df = load_benchmark(
        sym,
        start=get("START"),
        end=get("END"),
        auto_adjust=(get("ADJUST") == "split_and_div"),
    )
    _bench_eq_full = equity_from_returns(df["Close"].pct_change(), float(get("INITIAL_CAPITAL", 100_000.0)))
    return _bench_eq_full

def get_buyhold_equity(close: pd.Series) -> pd.Series | None:
    if not bool(get("BUY_HOLD_ENABLED", False)):
        return None
    return buy_hold_equity(close, float(get("INITIAL_CAPITAL", 100_000.0)))

# ---------- alignment + summary for one strategy curve ----------
# simple per-process caches keyed by window
_bench_cache: dict[tuple[int,int,int], dict] = {}
_bh_cache: dict[tuple[int,int,int], dict] = {}

def summarize_comparisons(strat_eq: pd.Series,
                          bench_eq_full: pd.Series | None,
                          bh_eq_full: pd.Series | None) -> dict:
    """Align benchmark/buy-hold to strategy window and return KPI summaries once per window."""
    if len(strat_eq) == 0:
        return dict(
            bars_aligned=0,
            bench_end_cap=None, bench_total_return=None, bench_cagr=None,
            bench_sharpe=None, bench_sortino=None, bench_maxdd=None,
            buyhold_end_cap=None, buyhold_total_return=None, buyhold_cagr=None,
            buyhold_sharpe=None, buyhold_sortino=None, buyhold_maxdd=None,
        )

    key = (strat_eq.index[0].value, strat_eq.index[-1].value, len(strat_eq))
    out = dict(bars_aligned=len(strat_eq))

    # Benchmark
    if bench_eq_full is not None:
        if key not in _bench_cache:
            bm = bench_eq_full.reindex(strat_eq.index).ffill()
            _bench_cache[key] = kpis_from_equity(bm)
        b = _bench_cache[key]
        out.update(
            bench_end_cap=b["end_cap"], bench_total_return=b["total_return"], bench_cagr=b["cagr"],
            bench_sharpe=b["sharpe"], bench_sortino=b["sortino"], bench_maxdd=b["maxdd"],
        )
    else:
        out.update(
            bench_end_cap=None, bench_total_return=None, bench_cagr=None,
            bench_sharpe=None, bench_sortino=None, bench_maxdd=None,
        )

    # Buy-and-hold
    if bh_eq_full is not None:
        if key not in _bh_cache:
            bh = bh_eq_full.reindex(strat_eq.index).ffill()
            _bh_cache[key] = kpis_from_equity(bh)
        h = _bh_cache[key]
        out.update(
            buyhold_end_cap=h["end_cap"], buyhold_total_return=h["total_return"], buyhold_cagr=h["cagr"],
            buyhold_sharpe=h["sharpe"], buyhold_sortino=h["sortino"], buyhold_maxdd=h["maxdd"],
        )
    else:
        out.update(
            buyhold_end_cap=None, buyhold_total_return=None, buyhold_cagr=None,
            buyhold_sharpe=None, buyhold_sortino=None, buyhold_maxdd=None,
        )
    return out
