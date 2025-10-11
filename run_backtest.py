#!/usr/bin/env python3
"""
Standalone script to run a backtest from the frontend.
Accepts JSON configuration via command line argument or stdin.
Outputs progress and results to stdout as JSON.
"""

import sys
import json
import traceback
from datetime import datetime

# Import backtester components
from backtester.settings import CONFIG, resolve_run_id
from backtester.data import load_bars, get_data
from backtester.engine import run_symbol
from backtester.grid import rsi_param_grid
from backtester.results import write_metrics_csv
from backtester.metrics import summarize_comparisons, get_benchmark_equity, get_buyhold_equity
from backtester.portfolio_engine import simulate_portfolio
import backtester.db as bt_db


def log_progress(status, progress=0, message='', **kwargs):
    """Output progress as JSON to stdout."""
    output = {
        'type': 'progress',
        'status': status,
        'progress': progress,
        'message': message,
        'timestamp': datetime.now().isoformat(),
        **kwargs
    }
    print(json.dumps(output), flush=True)


def log_result(success, run_id=None, error=None, **kwargs):
    """Output final result as JSON to stdout."""
    output = {
        'type': 'result',
        'success': success,
        'run_id': run_id,
        'error': error,
        'timestamp': datetime.now().isoformat(),
        **kwargs
    }
    print(json.dumps(output), flush=True)


def _bool(v, default=False):
    """Convert config value to bool."""
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "1", "yes", "on")
    return bool(v) if v is not None else default


def run_backtest(config):
    """Run backtest with the provided configuration."""
    try:
        log_progress('running', 0, 'Initializing backtest...')

        # Update CONFIG with received values
        for key, value in config.items():
            CONFIG[key] = value

        run_id = CONFIG.get('RUN_ID', 'auto')
        if run_id == 'auto':
            run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            CONFIG['RUN_ID'] = run_id

        # Determine mode
        is_portfolio = bool(CONFIG.get("PORTFOLIO_MODE", False) and not CONFIG.get("PORTFOLIO_USE_PARAM_GRID", False))
        mode = "portfolio" if is_portfolio else "single"

        log_progress('running', 5, f'Running in {mode} mode...', run_id=run_id)

        # Initialize database
        db_file = None
        if CONFIG.get("SAVE_DB", False):
            db_file = bt_db.init_db(CONFIG.get("DB_PATH", "./results/db"))
            bt_db.ensure_run(db_file, run_id, mode, CONFIG.get("NOTES", ""))

        if is_portfolio:
            log_progress('running', 20, 'Running portfolio simulation...')

            def adapter(sym, start=None, end=None):
                return get_data(sym, start=start, end=end)

            result = simulate_portfolio(adapter)

            # Calculate effective weights
            weights_eff = CONFIG.get("PORTFOLIO_WEIGHTS", None)
            if not weights_eff:
                tlist = CONFIG.get("TICKERS", [])
                if tlist:
                    weights_eff = {t: 1 / len(tlist) for t in tlist}
                else:
                    weights_eff = {}

            log_progress('running', 60, 'Saving portfolio results...')

            # Save to database
            if db_file:
                equity_json = result.equity.to_json(orient='split', date_format='iso')
                buyhold_json = None
                if result.buyhold_equity is not None:
                    buyhold_json = result.buyhold_equity.to_json(orient='split', date_format='iso')
                per_ticker_json = None
                if result.per_ticker_equity:
                    per_ticker_json = json.dumps({
                        ticker: eq.to_json(orient='split', date_format='iso')
                        for ticker, eq in result.per_ticker_equity.items()
                    })
                
                if result.benchmark_equity is not None:
                    bench_json = result.benchmark_equity.to_json(orient='split', date_format='iso')
                    config_json = json.dumps(CONFIG, default=str)
                    bt_db.update_run_benchmark(db_file, run_id, bench_json, config_json)
                
                bt_db.insert_portfolio_metrics(
                    db_file, run_id, result.metrics,
                    equity_json=equity_json,
                    buyhold_equity_json=buyhold_json,
                    per_ticker_equity_json=per_ticker_json
                )
                bt_db.insert_portfolio_weights(db_file, run_id, weights_eff)
                if CONFIG.get("SAVE_TRADES", True):
                    bt_db.insert_trades(db_file, run_id, result.trades)

            # Generate tearsheet
            log_progress('running', 75, 'Generating tearsheet...')
            if CONFIG.get("MAKE_TEARSHEET", True):
                from backtester.tearsheet import portfolio_tearsheet
                tearsheet_dir = CONFIG.get("TEARSHEET_DIR", "./results/tearsheets")
                tearsheet_path = portfolio_tearsheet(
                    run_id=run_id,
                    equity=result.equity,
                    buyhold_equity=result.buyhold_equity,
                    benchmark_equity=result.benchmark_equity,
                    per_ticker_equity=result.per_ticker_equity if result.per_ticker_equity else {},
                    metrics=result.metrics,
                    weights=weights_eff,
                    trades=result.trades,
                    out_dir=tearsheet_dir,
                    chart_enabled=CONFIG.get("MAKE_CHARTS", True)
                )
                log_progress('running', 85, f'Tearsheet saved: {tearsheet_path}')

            log_progress('running', 90, 'Finalizing portfolio backtest...')

        else:
            # Single strategy mode
            symbols = list(CONFIG.get("TICKERS", []))
            log_progress('running', 10, f'Loading data for {len(symbols)} symbols...')
            
            dfs = load_bars(symbols)
            params_list = rsi_param_grid(CONFIG)
            
            log_progress('running', 20, f'Running {len(params_list)} parameter combinations...')

            bench_eq_full = get_benchmark_equity()
            
            # Save benchmark equity to DB
            if db_file and bench_eq_full is not None:
                bench_eq_full.name = f"Benchmark ({CONFIG.get('BENCHMARK_SYMBOL', 'SPY')})"
                bench_json = bench_eq_full.to_json(orient='split', date_format='iso')
                config_json = json.dumps(CONFIG, default=str)
                bt_db.update_run_benchmark(db_file, run_id, bench_json, config_json)

            total_combos = len(symbols) * len(params_list)
            completed = 0

            for sym_idx, sym in enumerate(symbols):
                df = dfs[sym]
                bh_eq_full = get_buyhold_equity(df["Close"])
                if bh_eq_full is not None:
                    bh_eq_full.name = f"{sym} Buy & Hold"

                for params in params_list:
                    res = run_symbol(
                        df,
                        rsi_period=params["rsi_period"],
                        rsi_buy_below=params["rsi_buy_below"],
                        rsi_sell_above=params["rsi_sell_above"],
                    )
                    m = res["metrics"]
                    strat_eq = res["equity"]
                    events = res.get("events")
                    extras = summarize_comparisons(strat_eq, bench_eq_full, bh_eq_full)

                    if CONFIG.get("SAVE_METRICS", True):
                        out_csv = write_metrics_csv(
                            run_id, sym, CONFIG, m, params,
                            out_dir=CONFIG.get("CSV_DIR"),
                            extras=extras
                        )

                    # Merge buy & hold comparison metrics
                    m_with_comparisons = {**m, **extras}

                    # Save to database
                    if db_file:
                        strat_eq.name = f"{sym} Strategy"
                        equity_json = strat_eq.to_json(orient='split', date_format='iso')
                        buyhold_json = None
                        if bh_eq_full is not None:
                            buyhold_json = bh_eq_full.to_json(orient='split', date_format='iso')
                        events_json = None
                        if events:
                            events_json = json.dumps(events, default=str)
                        
                        bt_db.insert_strategy_metrics(
                            db_file, run_id, sym, params, m_with_comparisons,
                            equity_json=equity_json,
                            events_json=events_json,
                            buyhold_json=buyhold_json
                        )

                    completed += 1
                    progress = 20 + int((completed / total_combos) * 70)
                    log_progress('running', progress, f'Processing {sym} ({completed}/{total_combos})...')

        # Finalize
        if db_file:
            bt_db.finalize_run(db_file, run_id)

        log_progress('completed', 100, 'Backtest completed successfully!', run_id=run_id)
        log_result(True, run_id=run_id)

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        log_progress('error', 0, f'Error: {error_msg}')
        log_result(False, error=error_msg, traceback=error_trace)
        sys.exit(1)


def main():
    """Main entry point."""
    try:
        # Read configuration from command line argument or stdin
        if len(sys.argv) > 1:
            config_json = sys.argv[1]
        else:
            config_json = sys.stdin.read()
        
        config = json.loads(config_json)
        run_backtest(config)
        
    except json.JSONDecodeError as e:
        log_result(False, error=f"Invalid JSON configuration: {e}")
        sys.exit(1)
    except Exception as e:
        log_result(False, error=f"Unexpected error: {e}", traceback=traceback.format_exc())
        sys.exit(1)


if __name__ == '__main__':
    main()
