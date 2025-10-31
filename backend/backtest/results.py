"""
Simple CSV writer for run metrics. One row per (run_id, symbol, params).
Includes optional benchmark & buy-hold summaries (full-period), controlled by config.
"""
from __future__ import annotations
import csv, os
from datetime import datetime
from typing import Dict, Any

HEADER = [
    "timestamp_utc","run_id","symbol",
    "rsi_period","rsi_buy_below","rsi_sell_above",
    "order_type","entry_fees_bps","exit_fees_bps","slip_open_bps","slip_close_bps",
    "init_cap","end_cap","total_return","cagr","sharpe","sortino","vol","maxdd",
    "trades_total","trades_entry","trades_exit","bars",
    "rf_annual","periods_per_year",
    # toggles
    "benchmark_enabled","benchmark_symbol","buyhold_enabled",
    # alignment info
    "bars_aligned",
    # benchmark KPIs (full-period)
    "bench_end_cap","bench_total_return","bench_cagr","bench_sharpe","bench_sortino","bench_maxdd",
    # buy & hold KPIs (full-period)
    "buyhold_end_cap","buyhold_total_return","buyhold_cagr","buyhold_sharpe","buyhold_sortino","buyhold_maxdd",
]

def _ensure_file(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w", newline="") as f:
            csv.writer(f).writerow(HEADER)

def write_metrics_csv(run_id: str, symbol: str, config: Dict[str, Any],
                      metrics: Dict[str, Any], params: Dict[str, Any],
                      out_dir: str, extras: Dict[str, Any] | None = None) -> str:
    path = os.path.join(out_dir, f"{run_id}_metrics.csv")
    _ensure_file(path)

    ts = datetime.utcnow().isoformat(timespec="seconds")

    def _x(key):
        return None if extras is None else extras.get(key)

    row = [
        ts, run_id, symbol,
        params["rsi_period"], params["rsi_buy_below"], params["rsi_sell_above"],
        config.get("ORDER_TYPE"), config.get("ENTRY_FEES_BPS"), config.get("EXIT_FEES_BPS"),
        config.get("SLIP_OPEN_BPS"), config.get("SLIP_CLOSE_BPS"),
        metrics["init_cap"], metrics["end_cap"], metrics["total_return"], metrics["cagr"],
        metrics.get("sharpe"), metrics.get("sortino"), metrics.get("vol"), metrics.get("maxdd"),
        metrics.get("trades_total", metrics.get("trades", 0)),
        metrics.get("trades_entry", 0), metrics.get("trades_exit", 0),
        metrics["bars"],
        config.get("RF_ANNUAL"), config.get("PERIODS_PER_YEAR"),
        bool(config.get("BENCHMARK_ENABLED")), config.get("BENCHMARK_SYMBOL"),
        bool(config.get("BUY_HOLD_ENABLED")),
        _x("bars_aligned"),
        # benchmark kpis (full-period)
        _x("bench_end_cap"), _x("bench_total_return"), _x("bench_cagr"),
        _x("bench_sharpe"), _x("bench_sortino"), _x("bench_maxdd"),
        # buy & hold kpis (full-period)
        _x("buyhold_end_cap"), _x("buyhold_total_return"), _x("buyhold_cagr"),
        _x("buyhold_sharpe"), _x("buyhold_sortino"), _x("buyhold_maxdd"),
    ]

    with open(path, "a", newline="") as f:
        csv.writer(f).writerow(row)
    return path
