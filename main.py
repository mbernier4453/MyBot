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
import os

def _bool(v, default=False):
    """Convert config value to bool."""
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "1", "yes", "on")
    return bool(v) if v is not None else default

def main():
    run_id = resolve_run_id()

    symbols = list(get("TICKERS"))
    dfs = load_bars(symbols)

    params_list = rsi_param_grid(CONFIG)
    print(f"Run ID: {run_id} | Grid size: {len(params_list)}")

    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))
    top_k = int(get("PRINT_TOP_K", 3))
    chart_top_k = int(get("CHART_TOP_K", top_k))
    out_csv = None

    # Preload full benchmark series once (optional)
    bench_eq_full = get_benchmark_equity()

    for sym in symbols:
        df = dfs[sym]
        recs = []

        # Preload full buy-hold for symbol (optional)
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

            # Alignment extras (window-specific)
            extras = summarize_comparisons(strat_eq, bench_eq_full, bh_eq_full)

            if _bool(get("SAVE_METRICS"), True):
                out_csv = write_metrics_csv(
                    run_id, sym, CONFIG, m, params,
                    out_dir=get("CSV_DIR"),
                    extras=extras
                )

            recs.append((m, params, strat_eq, res.get("events")))

        top_by_list = list(get("TOP_BY", ["total_return"]))
        min_trades = int(get("MIN_TRADES_FOR_TOPS", 1))

        for key in top_by_list:
            if not recs or key not in recs[0][0]:
                continue
            # Filter by min trades if available
            base = [r for r in recs if r[0].get("trades_total", 0) >= min_trades] or recs
            reverse = (key != "maxdd")

            def _sort_key(row):
                val = row[0].get(key)
                # Put missing values at worst end
                if val is None:
                    return float("-inf") if reverse else float("inf")
                return val

            recs_sorted = sorted(base, key=_sort_key, reverse=reverse)

            print(f"{sym} - top {top_k} by {key}")
            for m, p, _, _ in recs_sorted[:top_k]:
                param_str = f"p={p['rsi_period']} b={p['rsi_buy_below']} s={p['rsi_sell_above']}"
                entry_exit = f"E/X={m.get('trades_entry', 0)}/{m.get('trades_exit', 0)}"
                print(f"  {param_str} | TR={m.get('total_return', 0):.4f} Sharpe={m.get('sharpe', 0):.3f} "
                      f"Sortino={m.get('sortino', 0):.3f} Vol={m.get('vol', 0):.3f} MDD={m.get('maxdd', 0):.3f} {entry_exit}")

            # Tearsheet generation
            if get("MAKE_TEARSHEETS", False):
                ts_dir = str(get("TEARSHEET_DIR", "./results/tearsheets"))
                ts_top_k = int(get("TEARSHEET_TOP_K", top_k))
                os.makedirs(ts_dir, exist_ok=True)
                for rank, (m, p, eq, events) in enumerate(recs_sorted[:ts_top_k], 1):
                    # Build (or reuse) chart first
                    chart_title = f"{sym} {key} rank {rank} | p={p['rsi_period']} b={p['rsi_buy_below']} s={p['rsi_sell_above']}"
                    chart_path = equity_chart_html(
                        sym,
                        eq,
                        buyhold=bh_eq_full if get("BUY_HOLD_ENABLED", False) else None,
                        benchmark=bench_eq_full if get("BENCHMARK_ENABLED", False) else None,
                        events=events,
                        title=chart_title,
                        out_path=os.path.join(get("CHART_DIR", "./charts"),
                                          f"{run_id}_{sym}_{key}_rank{rank}.html")
                    )
                    path = per_strategy_tearsheet(
                        symbol=sym,
                        metric=key,
                        rank=rank,
                        metric_value=m.get(key),
                        metrics_dict=m,
                        params=p,
                        equity=eq,
                        run_id=run_id,
                        out_dir=ts_dir,
                        benchmark_equity=bench_eq_full if get("BENCHMARK_ENABLED", False) else None,
                        buyhold_equity=bh_eq_full if get("BUY_HOLD_ENABLED", False) else None,
                        chart_path=chart_path
                    )
                    print(f"Tearsheet ({key} rank {rank}) -> {path}")

        # Per-symbol charts for top K of each metric
        if _bool(get("MAKE_EQUITY_CHARTS"), False) and recs:
            for key in top_by_list:
                if not recs or key not in recs[0][0]:
                    continue
                    
                # Get sorted results for this metric
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
                    param_str = f"p={p['rsi_period']} b={p['rsi_buy_below']} s={p['rsi_sell_above']}"
                    
                    # Create descriptive title
                    metric_val = m.get(key, 'N/A')
                    if isinstance(metric_val, float):
                        metric_val = f"{metric_val:.3f}"
                    
                    title = f"{sym} Top #{rank+1} by {key.upper()} ({metric_val}) | {param_str}"
                    
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

if __name__ == "__main__":
    main()