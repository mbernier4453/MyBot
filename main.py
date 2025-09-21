# main.py
from datetime import datetime
from backtester.settings import get, resolve_run_id, CONFIG
from backtester.data import load_bars
from backtester.engine import run_symbol
from backtester.grid import rsi_param_grid
from backtester.results import write_metrics_csv
from backtester.benchmarks import load_benchmark, buy_hold_equity, equity_from_returns
from backtester.metrics import kpis_from_equity


def _bool(v, default=False):
    return bool(v) if v is not None else default


def _series_kpis(eq):
    """
    Wrap metrics.kpis_from_equity so callers don't need to know its internals.
    Returns only the fields we write to CSV for bench/buy-hold.
    """
    k = kpis_from_equity(eq)
    return {
        "end_cap": k["end_cap"],
        "total_return": k["total_return"],
        "cagr": k["cagr"],
        "sharpe": k["sharpe"],
        "sortino": k["sortino"],
        "maxdd": k["maxdd"],
    }


def main():
    run_id = resolve_run_id()

    symbols = list(get("TICKERS"))
    dfs = load_bars(symbols)

    params_list = rsi_param_grid(CONFIG)
    print(f"Run ID: {run_id} | Grid size: {len(params_list)}")

    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))
    top_k = int(get("PRINT_TOP_K", 3))
    out_csv = None

    # ---- Optional benchmark (load once) ----
    bench_enabled = _bool(get("BENCHMARK_ENABLED"), False)
    bench_symbol = get("BENCHMARK_SYMBOL", "SPY")
    bench_df = None
    bench_eq_full = None
    bench_kpis_full = None
    if bench_enabled:
        bench_df = load_benchmark(
            bench_symbol,
            start=get("START"),
            end=get("END"),
            auto_adjust=(get("ADJUST") == "split_and_div"),
        )
        bench_ret = bench_df["Close"].pct_change()
        bench_eq_full = equity_from_returns(bench_ret, init_cap)
        bench_kpis_full = _series_kpis(bench_eq_full)

    for sym in symbols:
        df = dfs[sym]
        recs = []

        # ---- Optional buy & hold (compute once per ticker) ----
        bh_enabled = _bool(get("BUY_HOLD_ENABLED"), False)
        bh_eq_full = buy_hold_equity(df["Close"], init_cap) if bh_enabled else None
        bh_kpis_full = _series_kpis(bh_eq_full) if bh_enabled else None

        for params in params_list:
            res = run_symbol(
                df,
                rsi_period=params["rsi_period"],
                rsi_buy_below=params["rsi_buy_below"],
                rsi_sell_above=params["rsi_sell_above"],
            )
            m = res["metrics"]
            eq = res["equity"]  # strategy equity series

            # Bars aligned = strategy bars (we’re not recomputing bench/bh per window)
            bars_aligned = int(len(eq))

            extras = {
                "bars_aligned": bars_aligned,
                # benchmark block (same per row; computed once)
                "bench_end_cap": bench_kpis_full["end_cap"] if bench_kpis_full else None,
                "bench_total_return": bench_kpis_full["total_return"] if bench_kpis_full else None,
                "bench_cagr": bench_kpis_full["cagr"] if bench_kpis_full else None,
                "bench_sharpe": bench_kpis_full["sharpe"] if bench_kpis_full else None,
                "bench_sortino": bench_kpis_full["sortino"] if bench_kpis_full else None,
                "bench_maxdd": bench_kpis_full["maxdd"] if bench_kpis_full else None,
                # buy-hold block (same per row; computed once)
                "buyhold_end_cap": bh_kpis_full["end_cap"] if bh_kpis_full else None,
                "buyhold_total_return": bh_kpis_full["total_return"] if bh_kpis_full else None,
                "buyhold_cagr": bh_kpis_full["cagr"] if bh_kpis_full else None,
                "buyhold_sharpe": bh_kpis_full["sharpe"] if bh_kpis_full else None,
                "buyhold_sortino": bh_kpis_full["sortino"] if bh_kpis_full else None,
                "buyhold_maxdd": bh_kpis_full["maxdd"] if bh_kpis_full else None,
            }

            if _bool(get("SAVE_METRICS"), True):
                out_csv = write_metrics_csv(
                    run_id, sym, CONFIG, m, params, get("CSV_DIR", "./results/csv"), extras=extras
                )

            recs.append((m, params))

        # ---- Print Top-K by total return ----
        recs.sort(key=lambda x: x[0]["total_return"], reverse=True)
        print(f"{sym} — top {top_k} by total_return")
        for m, p in recs[:top_k]:
            print(
                f"  p={p['rsi_period']} b={p['rsi_buy_below']} s={p['rsi_sell_above']} | "
                f"TR={m['total_return']:.4f} Sharpe={m['sharpe']:.3f} "
                f"Vol={m['vol']:.3f} MDD={m['maxdd']:.3f} "
                f"E/X={m.get('trades_entry',0)}/{m.get('trades_exit',0)}"
            )

    if _bool(get("SAVE_METRICS"), True) and out_csv:
        print(f"Metrics saved -> {out_csv}")


if __name__ == "__main__":
    main()
