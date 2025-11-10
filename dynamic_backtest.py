#!/usr/bin/env python3
"""
Dynamic Backtest - Runs backtests from frontend JSON config
Minimal v1: RSI conditions only (cross above/below value)
Grid search: Each condition combination = separate backtest run
"""
import sys
import json
import os
import pandas as pd
import numpy as np
from datetime import datetime
from itertools import product
from pathlib import Path
from dotenv import load_dotenv

# Load .env from workspace root
root_dir = Path(__file__).parent
load_dotenv(root_dir / '.env')

from backtester.indicators import rsi_sma
from backtester.settings import get
from backtester import db as db_module
from backtester.metrics import kpis_from_equity
from backtester.benchmarks import buy_hold_equity
from backtester.data_loader import load_bars

def validate_config(config):
    """Quick validation of required fields"""
    required = ['tickers', 'startDate', 'endDate', 'initialCapital', 'entryConditions']
    for field in required:
        if field not in config:
            return False, f"Missing required field: {field}"
    return True, None

def fetch_data(ticker, start_date, end_date, interval='1d'):
    """Download price data"""
    try:
        data = load_bars(ticker, start_date, end_date)
        if data.empty:
            return None, f"No data for {ticker}"
        return data, None
    except Exception as e:
        return None, str(e)

def parse_param_value(value):
    """
    Parse a parameter value that might be a string, number, or comma-separated list.
    Returns a single value (not a list) - used AFTER grid expansion.
    """
    if isinstance(value, list):
        # Should not happen after grid expansion, but take first element if it does
        return value[0] if value else 0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # If it contains comma, take first value (shouldn't happen after preprocessing)
        if ',' in value:
            return float(value.split(',')[0].strip())
        return float(value)
    return float(value)

def preprocess_condition_for_grid(condition):
    """Convert comma-separated strings in condition to arrays for grid expansion"""
    processed = {}
    for key, value in condition.items():
        if isinstance(value, str) and ',' in value:
            # Parse comma-separated values into list
            try:
                processed[key] = [float(v.strip()) for v in value.split(',') if v.strip()]
            except ValueError:
                # If not numeric, keep as string
                processed[key] = value
        else:
            processed[key] = value
    return processed

def generate_rsi_signals(df, condition):
    """
    Generate entry/exit signals for RSI conditions
    Currently supports: RSI with VALUE target only
    Note: This is called AFTER grid expansion, so all values should be single numbers
    """
    # Get RSI period (after grid expansion, should be a single number)
    rsi_period = int(parse_param_value(condition.get('rsi_period', 14)))
    
    interaction = condition.get('interaction')
    target_type = condition.get('target_type')
    
    # Calculate RSI (ensure we pass a Series, not DataFrame)
    close_series = df['Close'].squeeze() if hasattr(df['Close'], 'squeeze') else df['Close']
    rsi = rsi_sma(close_series, rsi_period)
    
    # Only handle VALUE target for now
    if target_type != 'Value':
        print(f"[DYNAMIC] Target type '{target_type}' not yet supported, skipping", file=sys.stderr)
        return None, None  # Not implemented yet
    
    # Get target value (after grid expansion, should be a single number)
    value = float(parse_param_value(condition.get('target_value', condition.get('value', 50))))
    
    # Handle direction field (frontend sends 'cross' + 'above'/'below' separately)
    direction = condition.get('direction', '')
    if interaction == 'cross' and direction:
        interaction = f'cross_{direction}'  # Combine to 'cross_above' or 'cross_below'
    
    # Generate signals based on interaction
    signals = pd.Series(False, index=df.index)
    
    if interaction == 'cross_above':
        # Entry when RSI crosses above value
        signals = (rsi > value) & (rsi.shift(1) <= value)
    elif interaction == 'cross_below':
        # Entry when RSI crosses below value
        signals = (rsi < value) & (rsi.shift(1) >= value)
    elif interaction == 'above':
        # Entry when RSI is above value
        signals = (rsi > value)
    elif interaction == 'below':
        # Entry when RSI is below value
        signals = (rsi < value)
    else:
        print(f"[DYNAMIC] Unknown interaction '{interaction}' with direction '{direction}'", file=sys.stderr)
        return None, None
    
    return signals.fillna(False), rsi

def generate_rsi_bollinger_signals(df, condition):
    """
    Generate entry/exit signals for RSI Bollinger Bands conditions
    RSI crosses above/below Bollinger Bands (upper/lower)
    """
    # Get parameters (after grid expansion, should be single numbers)
    rsi_period = int(parse_param_value(condition.get('rsi_period', 14)))
    bb_period = int(parse_param_value(condition.get('target_period', 20)))  # BB period comes from target_period
    bb_std = float(parse_param_value(condition.get('bb_std', 2.0)))  # Changed from std_dev to bb_std
    
    interaction = condition.get('interaction')
    target_type = condition.get('target_type')
    
    # Calculate RSI
    close_series = df['Close'].squeeze() if hasattr(df['Close'], 'squeeze') else df['Close']
    rsi = rsi_sma(close_series, rsi_period)
    
    # Calculate Bollinger Bands on RSI
    # SMA of RSI values
    rsi_sma_line = rsi.rolling(window=bb_period).mean()
    # Standard deviation of RSI values
    rsi_std = rsi.rolling(window=bb_period).std()
    # Upper and Lower bands
    upper_band = rsi_sma_line + (bb_std * rsi_std)
    lower_band = rsi_sma_line - (bb_std * rsi_std)
    
    # Only handle Bollinger Band targets - frontend uses BB_TOP, BB_MID, BB_BOTTOM
    if target_type in ['BB_TOP', 'Upper Band']:
        # Signals based on interaction with upper band
        signals = pd.Series(False, index=df.index)
        
        direction = condition.get('direction', 'below')
        threshold_pct = float(condition.get('threshold_pct', 0)) / 100.0
        delay_bars = int(condition.get('delay_bars', 0))
        
        if interaction == 'cross' and direction:
            interaction = f'cross_{direction}'
        
        if interaction == 'cross_above':
            # RSI crosses above upper band
            for i in range(1, len(rsi)):
                if pd.isna(rsi.iloc[i]) or pd.isna(rsi.iloc[i-1]) or pd.isna(upper_band.iloc[i]) or pd.isna(upper_band.iloc[i-1]):
                    continue
                crossed_up = (rsi.iloc[i-1] < upper_band.iloc[i-1]) and (rsi.iloc[i] > upper_band.iloc[i])
                if crossed_up:
                    move_amount = rsi.iloc[i] - upper_band.iloc[i]
                    threshold_amount = upper_band.iloc[i] * threshold_pct
                    if move_amount >= threshold_amount:
                        signal_idx = min(i + delay_bars, len(signals) - 1)
                        signals.iloc[signal_idx] = True
        elif interaction == 'cross_below':
            # RSI crosses below upper band (comes back down)
            for i in range(1, len(rsi)):
                if pd.isna(rsi.iloc[i]) or pd.isna(rsi.iloc[i-1]) or pd.isna(upper_band.iloc[i]) or pd.isna(upper_band.iloc[i-1]):
                    continue
                crossed_down = (rsi.iloc[i-1] > upper_band.iloc[i-1]) and (rsi.iloc[i] < upper_band.iloc[i])
                if crossed_down:
                    move_amount = upper_band.iloc[i] - rsi.iloc[i]
                    threshold_amount = upper_band.iloc[i] * threshold_pct
                    if move_amount >= threshold_amount:
                        signal_idx = min(i + delay_bars, len(signals) - 1)
                        signals.iloc[signal_idx] = True
        elif interaction == 'above':
            # RSI is above upper band
            signals = (rsi > upper_band)
        elif interaction == 'below':
            # RSI is below upper band
            signals = (rsi < upper_band)
        else:
            print(f"[DYNAMIC] Unknown BB interaction '{interaction}'", file=sys.stderr)
            return None, None
            
    elif target_type in ['BB_BOTTOM', 'Lower Band']:
        # Signals based on interaction with lower band
        signals = pd.Series(False, index=df.index)
        
        direction = condition.get('direction', 'above')
        threshold_pct = float(condition.get('threshold_pct', 0)) / 100.0  # Convert percentage to decimal
        delay_bars = int(condition.get('delay_bars', 0))
        
        if interaction == 'cross' and direction:
            interaction = f'cross_{direction}'
        
        if interaction == 'cross_above':
            # RSI crosses above lower band (comes back up)
            # Match frontend logic: check previous bar below, current bar above, with threshold
            for i in range(1, len(rsi)):
                if pd.isna(rsi.iloc[i]) or pd.isna(rsi.iloc[i-1]) or pd.isna(lower_band.iloc[i]) or pd.isna(lower_band.iloc[i-1]):
                    continue
                crossed_up = (rsi.iloc[i-1] < lower_band.iloc[i-1]) and (rsi.iloc[i] > lower_band.iloc[i])
                if crossed_up:
                    # Check threshold: RSI must move threshold_pct beyond target
                    move_amount = rsi.iloc[i] - lower_band.iloc[i]
                    threshold_amount = lower_band.iloc[i] * threshold_pct
                    if move_amount >= threshold_amount:
                        # Apply delay
                        signal_idx = min(i + delay_bars, len(signals) - 1)
                        signals.iloc[signal_idx] = True
        elif interaction == 'cross_below':
            # RSI crosses below lower band
            for i in range(1, len(rsi)):
                if pd.isna(rsi.iloc[i]) or pd.isna(rsi.iloc[i-1]) or pd.isna(lower_band.iloc[i]) or pd.isna(lower_band.iloc[i-1]):
                    continue
                crossed_down = (rsi.iloc[i-1] > lower_band.iloc[i-1]) and (rsi.iloc[i] < lower_band.iloc[i])
                if crossed_down:
                    move_amount = lower_band.iloc[i] - rsi.iloc[i]
                    threshold_amount = lower_band.iloc[i] * threshold_pct
                    if move_amount >= threshold_amount:
                        signal_idx = min(i + delay_bars, len(signals) - 1)
                        signals.iloc[signal_idx] = True
        elif interaction == 'above':
            # RSI is above lower band
            signals = (rsi > lower_band)
        elif interaction == 'below':
            # RSI is below lower band
            signals = (rsi < lower_band)
        else:
            print(f"[DYNAMIC] Unknown BB interaction '{interaction}'", file=sys.stderr)
            return None, None
            
    elif target_type == 'BB_MID':
        # Signals based on interaction with middle band (SMA)
        signals = pd.Series(False, index=df.index)
        
        direction = condition.get('direction', '')
        if interaction == 'cross' and direction:
            interaction = f'cross_{direction}'
        
        if interaction == 'cross_above':
            # RSI crosses above middle band
            signals = (rsi > rsi_sma_line) & (rsi.shift(1) <= rsi_sma_line.shift(1))
        elif interaction == 'cross_below':
            # RSI crosses below middle band
            signals = (rsi < rsi_sma_line) & (rsi.shift(1) >= rsi_sma_line.shift(1))
        elif interaction == 'above':
            # RSI is above middle band
            signals = (rsi > rsi_sma_line)
        elif interaction == 'below':
            # RSI is below middle band
            signals = (rsi < rsi_sma_line)
        else:
            print(f"[DYNAMIC] Unknown BB interaction '{interaction}'", file=sys.stderr)
            return None, None
    else:
        print(f"[DYNAMIC] Target type '{target_type}' not supported for Bollinger Bands", file=sys.stderr)
        return None, None
    
    return signals.fillna(False), rsi

def run_simple_backtest(df, entry_signals, exit_signals, initial_capital, position_size_pct=100):
    """
    Simple backtest execution
    Buy at close when entry signal, sell at close when exit signal
    """
    cash = initial_capital
    shares = 0
    equity_curve = []
    trades = []
    
    # Debug: Log signal counts
    entry_count = entry_signals.sum()
    exit_count = exit_signals.sum()
    print(f"[BACKTEST] Entry signals: {entry_count}, Exit signals: {exit_count}", file=sys.stderr)
    print(f"[BACKTEST] First 10 entry signal dates: {df.index[entry_signals].tolist()[:10]}", file=sys.stderr)
    print(f"[BACKTEST] First 10 exit signal dates: {df.index[exit_signals].tolist()[:10]}", file=sys.stderr)
    
    for i in range(len(df)):
        date = df.index[i]
        # Extract scalar value to avoid FutureWarning
        close_price = df['Close'].iloc[i]
        if hasattr(close_price, 'item'):
            close_price = close_price.item()
        else:
            close_price = float(close_price)
        
        # Check exit first (if we have a position)
        if shares > 0 and exit_signals.iloc[i]:
            # Sell - UPDATE the last trade with exit info
            cash += shares * close_price
            if trades and 'entry_date' in trades[-1] and 'exit_date' not in trades[-1]:
                trades[-1]['exit_date'] = str(date)
                trades[-1]['exit_price'] = float(close_price)
                trades[-1]['pnl'] = float(shares * close_price - (shares * trades[-1]['entry_price']))
            shares = 0
        
        # Check entry (if we don't have a position)
        elif shares == 0 and entry_signals.iloc[i]:
            # Buy
            position_value = cash * (position_size_pct / 100.0)
            shares = int(position_value / close_price)
            if shares > 0:
                cost = shares * close_price
                cash -= cost
                trades.append({
                    'entry_date': str(date),
                    'entry_price': float(close_price),
                    'shares': int(shares)
                })
        
        # Mark to market
        portfolio_value = cash + (shares * close_price)
        equity_curve.append(float(portfolio_value))
    
    return equity_curve, trades

def expand_condition_grid(condition):
    """
    Expand a single condition into all parameter combinations
    e.g. rsi_period: [14, 21] and value: [30, 35] → 4 conditions
    """
    # Find all grid parameters (those that are lists)
    grid_params = {}
    static_params = {}
    
    for key, value in condition.items():
        if isinstance(value, list) and len(value) > 0:
            grid_params[key] = value
        else:
            static_params[key] = value
    
    # If no grid params, return single condition
    if not grid_params:
        return [condition]
    
    # Generate all combinations
    param_names = list(grid_params.keys())
    param_values = list(grid_params.values())
    combinations = list(product(*param_values))
    
    # Create condition for each combination
    expanded = []
    for combo in combinations:
        new_condition = static_params.copy()
        for i, param_name in enumerate(param_names):
            new_condition[param_name] = combo[i]
        expanded.append(new_condition)
    
    return expanded

def run_single_backtest(df, entry_cond, exit_conds, initial_capital, buyhold_enabled=False, benchmark_df=None):
    """Run one backtest with given conditions
    
    Args:
        df: Price data for the ticker
        entry_cond: Entry condition dict
        exit_conds: List of exit conditions
        initial_capital: Starting capital
        buyhold_enabled: If True, calculate buy & hold equity
        benchmark_df: Optional benchmark DataFrame (aligned to same date range)
    """
    # Generate entry signals - detect condition type
    cond_type = entry_cond.get('type', 'rsi')
    target_type = entry_cond.get('target_type', 'Value')
    
    # Check if this is a Bollinger Band condition
    # Frontend uses BB_TOP, BB_MID, BB_BOTTOM
    if target_type and target_type.startswith('BB_'):
        entry_signals, rsi_values = generate_rsi_bollinger_signals(df, entry_cond)
    elif cond_type == 'rsi':
        entry_signals, rsi_values = generate_rsi_signals(df, entry_cond)
    else:
        return None, f"Condition type '{cond_type}' not yet supported"
    
    if entry_signals is None:
        return None, 'Failed to generate entry signals'
    
    # Generate exit signals
    if exit_conds and len(exit_conds) > 0:
        # Use first exit condition for now
        exit_cond = exit_conds[0]
        exit_type = exit_cond.get('type', 'rsi')
        exit_target = exit_cond.get('target_type', 'Value')
        
        # Check if exit is Bollinger Band condition
        if exit_target and exit_target.startswith('BB_'):
            exit_signals, _ = generate_rsi_bollinger_signals(df, exit_cond)
        elif exit_type == 'rsi':
            exit_signals, _ = generate_rsi_signals(df, exit_cond)
        else:
            # Default: opposite of entry
            exit_cond = entry_cond.copy()
            if 'cross' in exit_cond.get('interaction', ''):
                direction = exit_cond.get('direction', '')
                if direction == 'above':
                    exit_cond['direction'] = 'below'
                elif direction == 'below':
                    exit_cond['direction'] = 'above'
            
            # Use same function as entry
            if target_type and target_type.startswith('BB_'):
                exit_signals, _ = generate_rsi_bollinger_signals(df, exit_cond)
            else:
                exit_signals, _ = generate_rsi_signals(df, exit_cond)
    else:
        # Default: opposite of entry
        exit_cond = entry_cond.copy()
        if 'cross' in exit_cond.get('interaction', ''):
            direction = exit_cond.get('direction', '')
            if direction == 'above':
                exit_cond['direction'] = 'below'
            elif direction == 'below':
                exit_cond['direction'] = 'above'
        
        # Use same function as entry
        if target_type and target_type.startswith('BB_'):
            exit_signals, _ = generate_rsi_bollinger_signals(df, exit_cond)
        else:
            exit_signals, _ = generate_rsi_signals(df, exit_cond)
    
    # Run backtest
    equity_curve, trades = run_simple_backtest(
        df, 
        entry_signals, 
        exit_signals, 
        initial_capital,
        position_size_pct=100
    )
    
    # Convert equity curve to pandas Series for metrics calculation
    equity_series = pd.Series(equity_curve, index=df.index[:len(equity_curve)])
    
    # Calculate comprehensive metrics using kpis_from_equity
    kpis = kpis_from_equity(equity_series)
    
    # Calculate trade-specific metrics
    closed_trades = [t for t in trades if 'exit_date' in t and 'pnl' in t]
    winning_trades = [t for t in closed_trades if t.get('pnl', 0) > 0]
    
    win_rate = (len(winning_trades) / len(closed_trades)) if closed_trades else 0.0
    net_win_rate = win_rate  # Same for now, could be different with fees
    avg_trade_pnl = sum([t.get('pnl', 0) for t in closed_trades]) / len(closed_trades) if closed_trades else 0.0
    trades_total = len(trades)
    
    # Build comprehensive metrics dict
    metrics = {
        'total_return': kpis['total_return'] * 100,  # Convert to percentage
        'cagr': kpis['cagr'] * 100 if not np.isnan(kpis['cagr']) else None,
        'sharpe': kpis['sharpe'] if not np.isnan(kpis['sharpe']) else None,
        'sortino': kpis['sortino'] if not np.isnan(kpis['sortino']) else None,
        'vol': kpis['vol'] * 100 if not np.isnan(kpis['vol']) else None,
        'maxdd': kpis['maxdd'] * 100 if not np.isnan(kpis['maxdd']) else None,
        'win_rate': win_rate,
        'net_win_rate': net_win_rate,
        'avg_trade_pnl': avg_trade_pnl,
        'trades_total': trades_total,
        'num_trades': len(closed_trades),  # For backwards compat
        'final_equity': equity_curve[-1]
    }
    
    # Calculate buy & hold if enabled
    buyhold_equity = None
    buyhold_json = None
    buyhold_metrics = {}
    if buyhold_enabled:
        try:
            buyhold_equity = buy_hold_equity(df['Close'], initial_capital)
            # If it's a DataFrame, extract the Series
            if isinstance(buyhold_equity, pd.DataFrame):
                buyhold_equity = buyhold_equity.iloc[:, 0]
            # Convert index to timezone-naive if needed
            index_to_use = buyhold_equity.index
            if hasattr(index_to_use, 'tz') and index_to_use.tz is not None:
                index_to_use = index_to_use.tz_localize(None)
            # Convert to dict for JSON serialization
            buyhold_json = json.dumps({
                'equity': buyhold_equity.tolist(),
                'dates': [d.strftime('%Y-%m-%d') for d in index_to_use]
            })
            # Calculate full metrics for buy & hold
            bh_kpis = kpis_from_equity(buyhold_equity)
            # Convert to percentages to match strategy format
            buyhold_metrics = {
                'total_return': bh_kpis['total_return'] * 100,
                'cagr': bh_kpis['cagr'] * 100 if not np.isnan(bh_kpis['cagr']) else None,
                'sharpe': bh_kpis['sharpe'] if not np.isnan(bh_kpis['sharpe']) else None,
                'sortino': bh_kpis['sortino'] if not np.isnan(bh_kpis['sortino']) else None,
                'vol': bh_kpis['vol'] * 100 if not np.isnan(bh_kpis['vol']) else None,
                'maxdd': bh_kpis['maxdd'] * 100 if not np.isnan(bh_kpis['maxdd']) else None,
            }
        except Exception as e:
            print(f"[DYNAMIC] Warning: Failed to calculate buy & hold: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            # Continue without buy & hold for this strategy
    
    # Calculate benchmark equity if provided
    benchmark_json = None
    benchmark_metrics = {}
    if benchmark_df is not None and not benchmark_df.empty:
        try:
            # Convert equity_series index to UTC to match benchmark
            equity_index_utc = equity_series.index
            if hasattr(equity_index_utc, 'tz'):
                if equity_index_utc.tz is None:
                    # Make it timezone-aware (UTC)
                    equity_index_utc = equity_index_utc.tz_localize('UTC')
            else:
                equity_index_utc = pd.DatetimeIndex(equity_index_utc).tz_localize('UTC')
            
            # Align benchmark to strategy dates
            benchmark_aligned = benchmark_df.reindex(equity_index_utc, method='ffill')
            if 'Close' in benchmark_aligned.columns and not benchmark_aligned['Close'].isna().all():
                benchmark_equity = buy_hold_equity(benchmark_aligned['Close'], initial_capital)
                # If it's a DataFrame, extract the Series
                if isinstance(benchmark_equity, pd.DataFrame):
                    benchmark_equity = benchmark_equity.iloc[:, 0]
                # Convert index to timezone-naive for JSON
                index_to_use = benchmark_equity.index
                if hasattr(index_to_use, 'tz') and index_to_use.tz is not None:
                    index_to_use = index_to_use.tz_localize(None)
                benchmark_json = json.dumps({
                    'equity': benchmark_equity.tolist(),
                    'dates': [d.strftime('%Y-%m-%d') for d in index_to_use]
                })
                # Calculate full metrics for benchmark
                bench_kpis = kpis_from_equity(benchmark_equity)
                # Convert to percentages to match strategy format
                benchmark_metrics = {
                    'total_return': bench_kpis['total_return'] * 100,
                    'cagr': bench_kpis['cagr'] * 100 if not np.isnan(bench_kpis['cagr']) else None,
                    'sharpe': bench_kpis['sharpe'] if not np.isnan(bench_kpis['sharpe']) else None,
                    'sortino': bench_kpis['sortino'] if not np.isnan(bench_kpis['sortino']) else None,
                    'vol': bench_kpis['vol'] * 100 if not np.isnan(bench_kpis['vol']) else None,
                    'maxdd': bench_kpis['maxdd'] * 100 if not np.isnan(bench_kpis['maxdd']) else None,
                }
        except Exception as e:
            print(f"[DYNAMIC] Warning: Failed to calculate benchmark equity: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            # Continue without benchmark for this strategy
    
    # Prepare equity curve for JSON
    try:
        # Convert index to timezone-naive if needed
        index_to_use = equity_series.index
        if hasattr(index_to_use, 'tz') and index_to_use.tz is not None:
            index_to_use = index_to_use.tz_localize(None)
        
        equity_json = json.dumps({
            'equity': equity_series.tolist(),
            'dates': [d.strftime('%Y-%m-%d') for d in index_to_use]
        })
    except Exception as e:
        print(f"[DYNAMIC] Warning: Failed to serialize equity: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        equity_json = None
    
    # Prepare events (trades) for JSON
    try:
        events_json = json.dumps(trades)
    except Exception as e:
        print(f"[DYNAMIC] Warning: Failed to serialize events: {e}", file=sys.stderr)
        events_json = None
    
    return {
        'metrics': metrics,
        'entry_condition': entry_cond,
        'trades': trades[:5],  # First 5 trades only
        'equity_json': equity_json,
        'events_json': events_json,
        'buyhold_json': buyhold_json,
        'buyhold_metrics': buyhold_metrics,
        'benchmark_json': benchmark_json,
        'benchmark_metrics': benchmark_metrics
    }, None

def run_dynamic_backtest(config):
    """Main entry point - runs grid search over all condition combinations"""
    # Validate
    valid, error = validate_config(config)
    if not valid:
        return {'success': False, 'error': error}
    
    # Get params
    tickers = config['tickers']
    if isinstance(tickers, str):
        tickers = [t.strip() for t in tickers.split(',')]
    
    start_date = config['startDate']
    end_date = config['endDate']
    initial_capital = float(config['initialCapital'])
    
    # Check toggles for buy & hold and benchmark
    buyhold_enabled = config.get('buyHoldEnabled', False)
    benchmark_enabled = config.get('benchmarkEnabled', False)
    benchmark_symbol = config.get('benchmarkSymbol', 'SPY')
    
    # Load benchmark data if enabled
    benchmark_df = None
    benchmark_config = None
    if benchmark_enabled:
        try:
            from backtester.benchmarks import load_benchmark
            benchmark_df = load_benchmark(benchmark_symbol, start=start_date, end=end_date)
            benchmark_config = {
                'symbol': benchmark_symbol,
                'start': start_date,
                'end': end_date
            }
            print(f"[DYNAMIC] Loaded benchmark {benchmark_symbol} with {len(benchmark_df)} bars", file=sys.stderr)
        except Exception as e:
            print(f"[DYNAMIC] Warning: Failed to load benchmark {benchmark_symbol}: {e}", file=sys.stderr)
            benchmark_enabled = False  # Disable if load fails
    
    # Get entry conditions
    entry_conditions = config.get('entryConditions', [])
    if not entry_conditions:
        return {'success': False, 'error': 'No entry conditions specified'}
    
    # Get exit conditions and preprocess them too (but don't expand into grid)
    exit_conditions_raw = config.get('exitConditions', [])
    exit_conditions = []
    for exit_cond in exit_conditions_raw:
        # Preprocess to convert comma-separated strings, but use first value only
        processed = preprocess_condition_for_grid(exit_cond)
        # Take first value from any arrays (we don't do grid search on exits yet)
        simplified = {}
        for key, value in processed.items():
            if isinstance(value, list):
                simplified[key] = value[0]  # Use first value only
            else:
                simplified[key] = value
        exit_conditions.append(simplified)
    
    # Structure: 1 RUN per ENTRY CONDITION (not per grid variation!)
    # Each run contains: all grid variations × all tickers as strategies
    print(f"[DYNAMIC] Creating {len(entry_conditions)} runs (1 per entry condition)", file=sys.stderr)
    
    all_runs_data = []
    
    for cond_idx, raw_entry_cond in enumerate(entry_conditions):
        print(f"\n[DYNAMIC] === RUN {cond_idx + 1}/{len(entry_conditions)} ===", file=sys.stderr)
        print(f"[DYNAMIC] Raw condition: {raw_entry_cond}", file=sys.stderr)
        
        # Preprocess and expand THIS condition into grid
        processed = preprocess_condition_for_grid(raw_entry_cond)
        grid_variations = expand_condition_grid(processed)
        print(f"[DYNAMIC] Expanded to {len(grid_variations)} grid variation(s)", file=sys.stderr)
        
        # Test ALL grid variations × ALL tickers for this run
        all_strategies_for_run = []
        
        for grid_idx, grid_var in enumerate(grid_variations):
            print(f"[DYNAMIC] Grid variation {grid_idx + 1}/{len(grid_variations)}: {grid_var}", file=sys.stderr)
            
            for ticker in tickers:
                print(f"[DYNAMIC]   Testing {ticker}...", file=sys.stderr)
                
                # Fetch data
                df, error = fetch_data(ticker, start_date, end_date)
                if error:
                    print(f"[DYNAMIC]   Skipping {ticker}: {error}", file=sys.stderr)
                    continue
                
                # Run backtest
                result, error = run_single_backtest(df, grid_var, exit_conditions, initial_capital, 
                                                    buyhold_enabled, benchmark_df)
                
                if error:
                    print(f"[DYNAMIC]   Error with {ticker}: {error}", file=sys.stderr)
                    continue
                
                # Store result with ticker and grid variation info
                result['ticker'] = ticker
                result['grid_variation'] = grid_var
                all_strategies_for_run.append(result)
        
        if all_strategies_for_run:
            all_runs_data.append({
                'base_condition': raw_entry_cond,  # Original condition from config
                'num_grid_variations': len(grid_variations),
                'strategies': all_strategies_for_run
            })
            print(f"[DYNAMIC] Run {cond_idx + 1} complete: {len(all_strategies_for_run)} strategies", file=sys.stderr)
    
    if not all_runs_data:
        return {'success': False, 'error': 'No successful backtest runs'}
    
    print(f"\n[DYNAMIC] Completed {len(all_runs_data)} runs with strategies", file=sys.stderr)
    
    # Save to database if requested
    saved_run_ids = []
    if config.get('saveToDatabase', False):
        db_path = config.get('databasePath') or os.path.join(os.path.dirname(__file__), 'results', 'db', 'backtests.db')
        try:
            # Initialize database
            db_file = db_module.init_db(db_path)
            print(f"[DYNAMIC] Saving to database: {db_file}", file=sys.stderr)
            
            base_notes = config.get('notes', 'Dynamic grid search')
            
            # Each run_data = 1 database run with ALL grid variations × ALL tickers as strategies
            for run_idx, run_data in enumerate(all_runs_data):
                base_cond = run_data['base_condition']
                strategies = run_data['strategies']
                num_grids = run_data['num_grid_variations']
                
                # Generate unique run ID
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                run_id = f"dynamic_run{run_idx+1}_{timestamp}"
                
                # Build descriptive notes
                condition_str = str(base_cond)
                notes = f"{base_notes} | Base: {condition_str} | {num_grids} grid variations × {len(tickers)} tickers = {len(strategies)} strategies"
                
                # Save run metadata (use 'single' mode for now)
                db_module.ensure_run(db_file, run_id, 'single', notes)
                
                # Save each strategy (ticker × grid variation combination)
                benchmark_json_for_run = None
                for strategy in strategies:
                    ticker = strategy['ticker']
                    grid_var = strategy['grid_variation']
                    params = {
                        'base_condition': base_cond,
                        'grid_variation': grid_var,
                        'exit_conditions': exit_conditions
                    }
                    # Use the comprehensive metrics
                    metrics = strategy['metrics'].copy()
                    
                    # Add buy & hold metrics with prefix
                    buyhold_metrics = strategy.get('buyhold_metrics', {})
                    for key, value in buyhold_metrics.items():
                        metrics[f'buyhold_{key}'] = value
                    
                    # Add benchmark metrics with prefix
                    benchmark_metrics = strategy.get('benchmark_metrics', {})
                    for key, value in benchmark_metrics.items():
                        metrics[f'benchmark_{key}'] = value
                    
                    # Include equity, events, and buyhold JSON data for tearsheet
                    equity_json = strategy.get('equity_json')
                    events_json = strategy.get('events_json')
                    buyhold_json = strategy.get('buyhold_json')
                    # Capture benchmark from first strategy (all have same benchmark)
                    if benchmark_json_for_run is None:
                        benchmark_json_for_run = strategy.get('benchmark_json')
                    db_module.insert_strategy_metrics(db_file, run_id, ticker, params, metrics, 
                                                     equity_json, events_json, buyhold_json)
                
                # Save benchmark at run level if available
                if benchmark_json_for_run and benchmark_config:
                    benchmark_config_json = json.dumps(benchmark_config)
                    db_module.update_run_benchmark(db_file, run_id, benchmark_json_for_run, benchmark_config_json)
                
                # Finalize the run (mark as completed)
                db_module.finalize_run(db_file, run_id)
                saved_run_ids.append(run_id)
                
                print(f"[DYNAMIC] Saved run {run_id} with {len(strategies)} strategies", file=sys.stderr)
                
                # Small delay to ensure unique timestamps
                import time
                time.sleep(0.1)
            
            print(f"[DYNAMIC] Saved {len(saved_run_ids)} runs to database", file=sys.stderr)
        except Exception as e:
            print(f"[DYNAMIC] Warning: Failed to save to database: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    
    # Find overall best result across all runs
    all_strategies = []
    for run_data in all_runs_data:
        all_strategies.extend(run_data['strategies'])
    
    # Sort by total_return in metrics
    all_strategies.sort(key=lambda x: x['metrics']['total_return'], reverse=True)
    best_strategy = all_strategies[0] if all_strategies else None
    
    return {
        'success': True,
        'tickers': tickers,
        'num_tickers': len(tickers),
        'num_entry_conditions': len(entry_conditions),
        'total_runs': len(all_runs_data),
        'total_strategies': len(all_strategies),
        'successful_runs': len(all_runs_data),
        'best_result': best_strategy,
        'run_ids': saved_run_ids
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No config provided'}))
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        result = run_dynamic_backtest(config)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Script error: {str(e)}'}))
        sys.exit(1)
