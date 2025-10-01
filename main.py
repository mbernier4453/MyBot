from datetime import datetime
from backtester.settings import get, resolve_run_id, CONFIG
from backtester.data import load_bars
from backtester.engine import run_symbol
from backtester.grid import rsi_param_grid
from backtester.results import write_metrics_csv
from backtester.benchmarks import load_benchmark, buy_hold_equity, equity_from_returns
from backtester.metrics import kpis_from_equity, summarize_comparisons, get_benchmark_equity, get_buyhold_equity
from backtester.charts import equity_chart_html
from backtester.tearsheet import simple_metric_tearsheet  # put near top once
from backtester.tearsheet import per_strategy_tearsheet  # add near other imports
from backtester.portfolio_engine import simulate_portfolio
from backtester.tearsheet import portfolio_tearsheet
from backtester.data import get_data  # assuming this exists (data_adapter wrapper)
import backtester.db as bt_db
import os
import csv

def _bool(v, default=False):
    """Convert config value to bool."""
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "1", "yes", "on")
    return bool(v) if v is not None else default

def main():
    run_id = resolve_run_id()

    # Determine mode early
    is_portfolio = bool(get("PORTFOLIO_MODE", False) and not get("PORTFOLIO_USE_PARAM_GRID", False))
    mode = "portfolio" if is_portfolio else "single"

    # --- DB init (single place) ---
    db_file = None
    if get("SAVE_DB", False):
        db_file = bt_db.init_db(get("DB_PATH", "./results/db"))
        bt_db.ensure_run(db_file, run_id, mode, get("NOTES", ""))

    if is_portfolio:
        print(f"Portfolio Mode (strategies) | Run ID: {run_id}")

        def adapter(sym, start=None, end=None):
            return get_data(sym, start=start, end=end)

        result = simulate_portfolio(adapter)

        # Calculate effective weights (fallback equal weight)
        weights_eff = get("PORTFOLIO_WEIGHTS", None)
        if not weights_eff:
            tlist = get("TICKERS", [])
            if tlist:
                weights_eff = {t: 1 / len(tlist) for t in tlist}
            else:
                weights_eff = {}

        # --- DB persistence (portfolio) ---
        if db_file:
            bt_db.insert_portfolio_metrics(db_file, run_id, result.metrics)
            bt_db.insert_portfolio_weights(db_file, run_id, weights_eff)
            if get("SAVE_TRADES", True):
                bt_db.insert_trades(db_file, run_id, result.trades)

        if get("MAKE_TEARSHEETS", True):
            path = portfolio_tearsheet(
                run_id=run_id,
                equity=result.equity,
                buyhold_equity=result.buyhold_equity if get("BUY_HOLD_ENABLED", True) else None,
                benchmark_equity=result.benchmark_equity,
                per_ticker_equity=result.per_ticker_equity,
                metrics=result.metrics,
                weights=weights_eff,
                trades=result.trades,
                out_dir=get("TEARSHEETS_DIR", "./results/tearsheets"),
                chart_enabled=bool(get("MAKE_CHARTS", True))
            )
            print(f"Portfolio tearsheet -> {path}")

        if db_file:
            bt_db.finalize_run(db_file, run_id)
        return

    # ----- SINGLE STRATEGY MODE -----
    symbols = list(get("TICKERS"))
    dfs = load_bars(symbols)
    params_list = rsi_param_grid(CONFIG)
    print(f"Run ID: {run_id} | Grid size: {len(params_list)}")

    bench_eq_full = get_benchmark_equity()

    for sym in symbols:
        df = dfs[sym]
        recs = []
        bh_eq_full = get_buyhold_equity(df["Close"])

        for params in params_list:
            res = run_symbol(
                df,
                rsi_period=params["rsi_period"],
                rsi_buy_below=params["rsi_buy_below"],
                rsi_sell_above=params["rsi_sell_above"],
            )
            m = res["metrics"]
            strat_eq = res["equity"]
            extras = summarize_comparisons(strat_eq, bench_eq_full, bh_eq_full)

            if _bool(get("SAVE_METRICS"), True):
                out_csv = write_metrics_csv(
                    run_id, sym, CONFIG, m, params,
                    out_dir=get("CSV_DIR"),
                    extras=extras
                )

            # DB insert for strategy (FIX: use sym/params/m)
            if db_file:
                bt_db.insert_strategy_metrics(db_file, run_id, sym, params, m)

            recs.append((m, params, strat_eq, res.get("events")))
        top_by_list = get("TOP_BY", ["total_return"])
        top_k = int(get("TOP_K", 3))
        do_print = bool(get("PRINT_TOP_K", True))
        make_charts = bool(get("MAKE_CHARTS", True))
        make_tearsheets = bool(get("MAKE_TEARSHEETS", True))

        # recs should be a list of tuples: (metrics_dict, params_dict, equity_series, events_list)
        # Build per metric ranking
        min_trades_filter = int(get("MIN_TRADES_FILTER", 0) or 0)

        for metric_key in top_by_list:
            # Filter out entries missing the metric
            ranked = [r for r in recs if r[0].get(metric_key) is not None]
            if min_trades_filter > 0:
                filt = [r for r in ranked if r[0].get("trades_total", r[0].get("trades", 0)) >= min_trades_filter]
                if filt:  # only apply if we didn't wipe out all candidates
                    ranked = filt
            ranked.sort(key=lambda r: r[0].get(metric_key), reverse=True)

            if do_print:
                print(f"{sym} - top {top_k} by {metric_key} (min_trades>={min_trades_filter})")
                for (m, p, eq_series, events) in ranked[:top_k]:
                    print(f"  p={p.get('rsi_period')} b={p.get('rsi_buy_below')} s={p.get('rsi_sell_above')} | "
                          f"TR={m.get('total_return'):.4f} Sharpe={m.get('sharpe'):.3f} "
                          f"Sortino={m.get('sortino'):.3f} Vol={m.get('vol'):.3f} "
                          f"MDD={m.get('maxdd'):.3f} E/X={m.get('trades_entry')}/{m.get('trades_exit')}")

            if not make_charts and not make_tearsheets:
                continue  # nothing else to do

            # Preload benchmark / buy & hold series once (adjust names if different in your code)
            bench_series = bench_eq_full if get("BENCHMARK_ENABLED", False) and 'bench_eq_full' in locals() else None
            bh_series = bh_eq_full if get("BUY_HOLD_ENABLED", False) and 'bh_eq_full' in locals() else None

            for rank, (m, p, eq_series, events) in enumerate(ranked[:top_k], start=1):
                chart_path = None
                if make_charts:
                    # Save standalone equity chart (only when MAKE_CHARTS True)
                    chart_title = (f"{sym} {metric_key} rank {rank} | "
                                   f"p={p.get('rsi_period')} b={p.get('rsi_buy_below')} s={p.get('rsi_sell_above')}")
                    chart_path = equity_chart_html(
                        symbol=sym,
                        equity=eq_series,
                        buyhold=bh_series,
                        benchmark=bench_series,
                        events=events,
                        title=chart_title,
                        out_path=os.path.join(get("CHART_PATH", "./results/charts"),
                                              f"{run_id}_{sym}_{metric_key}_rank{rank}.html")
                    )

                if make_tearsheets:
                    ts_dir = get("TEARSHEETS_DIR", "./results/tearsheets")
                    os.makedirs(ts_dir, exist_ok=True)
                    ts_path = per_strategy_tearsheet(
                        symbol=sym,
                        metric=metric_key,
                        rank=rank,
                        metric_value=m.get(metric_key),
                        metrics_dict=m,
                        params=p,
                        equity=eq_series,
                        run_id=run_id,
                        out_dir=ts_dir,
                        benchmark_equity=bench_series,
                        buyhold_equity=bh_series,
                        chart_path=chart_path if make_charts else None
                    )
                    if do_print:
                        print(f"  Tearsheet saved: {ts_path}")

        # Per-symbol charts for top K of each metric
        if _bool(get("MAKE_EQUITY_CHARTS"), False) and recs:
            for key in top_by_list:
                if not recs or key not in recs[0][0]:
                    continue
                # Optional minimum trades filter (configurable, default 0)
                min_trades = int(get("MIN_TRADES_FILTER", 0) or 0)
                base = [r for r in recs if r[0].get("trades_total", 0) >= min_trades] or recs
                reverse = (key != "maxdd")
                
                def _sort_key(row):
                    val = row[0].get(key)
                    if val is None:
                        return float("-inf") if reverse else float("inf")
                    return val
                
                metric_sorted = sorted(base, key=_sort_key, reverse=reverse)
                
                # Create chart for top K of this metric
                for rank in range(min(chart_top_k, len(metric_sorted))):
                    m, p, eq, events = metric_sorted[rank]
                    
                    # Format parameters string
                    param_label = (
                        f"p={p.get('rsi_period')} "
                        f"b={p.get('rsi_buy_below')} "
                        f"s={p.get('rsi_sell_above')}"
                    )
                    
                    # Create descriptive title
                    metric_val = m.get(key, 'N/A')
                    if isinstance(metric_val, float):
                        metric_val = f"{metric_val:.3f}"
                    
                    title = f"{sym} Top #{rank+1} by {key.upper()} ({metric_val}) | {param_label}"
                    
                    chart_path = equity_chart_html(
                        sym,
                        eq,
                        buyhold=bh_eq_full,
                        benchmark=bench_eq_full,
                        events=events,
                        title=title,
                        out_path=f"charts/{run_id}_{sym}_{key}_rank{rank+1}.html"
                    )
                    print(f"Chart: {key} #{rank+1} -> {chart_path}")

    if _bool(get("SAVE_METRICS"), True) and out_csv:
        print(f"Metrics saved -> {out_csv}")

    if get("SAVE_DB", False) and 'db_file' in locals() and db_file:
        from backtester.db import finalize_run
        finalize_run(db_file, run_id)


if __name__ == "__main__":
    main()