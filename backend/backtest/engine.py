"""
Backtesting Engine
Runs strategies using Polygon flat files data with flexible condition-based signals
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from .data_source import load_bars
from .indicators import Indicators
from .signals import SignalEvaluator, build_signals_from_config
from .metrics import kpis_from_equity


class BacktestEngine:
    """Main backtesting engine"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize engine with configuration
        
        Config keys:
            - symbols: List of ticker symbols
            - start_date: Start date 'YYYY-MM-DD'
            - end_date: End date 'YYYY-MM-DD'
            - initial_capital: Starting capital (default 100000)
            - order_type: 'MOO' or 'MOC' (default 'MOC')
            - slippage_bps: Slippage in basis points (default 0)
            - commission_bps: Commission in basis points (default 0)
            - indicators: Dict of indicators to calculate
            - entry_conditions: List of entry condition dicts
            - exit_conditions: List of exit condition dicts
        """
        self.config = config
        self.symbols = config.get('symbols', [])
        self.start_date = config.get('start_date')
        self.end_date = config.get('end_date')
        self.initial_capital = config.get('initial_capital', 100000.0)
        self.order_type = config.get('order_type', 'MOC')
        self.slippage_bps = config.get('slippage_bps', 0.0) / 10000
        self.commission_bps = config.get('commission_bps', 0.0) / 10000
        
    def run(self, symbol: str) -> Dict[str, Any]:
        """
        Run backtest for a single symbol
        
        Returns:
            Dict with keys: metrics, equity, trades, events
        """
        print(f"\n[ENGINE] Running backtest for {symbol}")
        
        # Load data
        data = load_bars([symbol], self.start_date, self.end_date)
        if symbol not in data or data[symbol].empty:
            raise ValueError(f"No data loaded for {symbol}")
        
        df = data[symbol]
        print(f"[ENGINE] Loaded {len(df)} bars from {df.index[0]} to {df.index[-1]}")
        
        # Calculate indicators
        indicators_config = self.config.get('indicators', {})
        indicators = Indicators.calculate_all(df, indicators_config)
        print(f"[ENGINE] Calculated {len(indicators)} indicators")
        
        # Build signals
        entry_signal, exit_signal = build_signals_from_config(df, indicators, self.config)
        print(f"[ENGINE] Entry signals: {entry_signal.sum()}, Exit signals: {exit_signal.sum()}")
        
        # Run simulation
        result = self._simulate_trades(df, entry_signal, exit_signal)
        
        # Calculate metrics
        equity = pd.Series(result['equity'], index=df.index)
        metrics = kpis_from_equity(equity)
        metrics['init_cap'] = self.initial_capital
        metrics['trades_entry'] = result['entries']
        metrics['trades_exit'] = result['exits']
        metrics['trades_total'] = result['entries'] + result['exits']
        
        print(f"[ENGINE] Final equity: ${metrics['end_cap']:.2f}, Return: {metrics['total_return']*100:.2f}%")
        print(f"[ENGINE] Trades: {metrics['trades_entry']} entries, {metrics['trades_exit']} exits")
        
        return {
            'metrics': metrics,
            'equity': equity,
            'trades': result['trades'],
            'events': result['events']
        }
    
    def _simulate_trades(self, df: pd.DataFrame, entry_signal: pd.Series,
                        exit_signal: pd.Series) -> Dict[str, Any]:
        """
        Simulate trading with entry/exit signals
        
        Returns:
            Dict with equity curve, trades, and events
        """
        cash = self.initial_capital
        shares = 0
        entries = 0
        exits = 0
        equity = [cash]
        trades = []
        events = []
        
        opens = df['Open'].values
        closes = df['Close'].values
        dates = df.index
        
        for i in range(len(df) - 1):
            current_date = dates[i]
            
            # Entry logic
            if shares == 0 and entry_signal.iloc[i]:
                # Determine execution price
                if self.order_type == 'MOO':
                    exec_price = opens[i + 1] * (1 + self.slippage_bps)
                else:  # MOC
                    exec_price = closes[i + 1] * (1 + self.slippage_bps)
                
                # Calculate position size (use all available capital)
                affordable = int(cash / exec_price)
                if affordable > 0:
                    shares = affordable
                    cost = shares * exec_price
                    commission = cost * self.commission_bps
                    cash -= (cost + commission)
                    entries += 1
                    
                    events.append({
                        'date': current_date,
                        'type': 'entry',
                        'price': exec_price,
                        'shares': shares
                    })
                    
                    trades.append({
                        'entry_date': current_date,
                        'entry_price': exec_price,
                        'shares': shares
                    })
            
            # Exit logic
            elif shares > 0 and exit_signal.iloc[i]:
                # Determine execution price
                if self.order_type == 'MOO':
                    exec_price = opens[i + 1] * (1 - self.slippage_bps)
                else:  # MOC
                    exec_price = closes[i + 1] * (1 - self.slippage_bps)
                
                # Close position
                proceeds = shares * exec_price
                commission = proceeds * self.commission_bps
                cash += (proceeds - commission)
                exits += 1
                
                events.append({
                    'date': current_date,
                    'type': 'exit',
                    'price': exec_price,
                    'shares': shares
                })
                
                # Update last trade
                if trades:
                    trades[-1].update({
                        'exit_date': current_date,
                        'exit_price': exec_price,
                        'pnl': (exec_price - trades[-1]['entry_price']) * shares
                    })
                
                shares = 0
            
            # Mark equity to market at close
            mark_price = closes[i + 1]
            equity_value = cash + shares * mark_price
            equity.append(equity_value)
        
        return {
            'equity': equity,
            'entries': entries,
            'exits': exits,
            'trades': trades,
            'events': events
        }
    
    def run_multiple(self) -> Dict[str, Dict[str, Any]]:
        """
        Run backtest for all configured symbols
        
        Returns:
            Dict mapping symbol -> results
        """
        results = {}
        for symbol in self.symbols:
            try:
                results[symbol] = self.run(symbol)
            except Exception as e:
                print(f"[ENGINE] Error running {symbol}: {e}")
                continue
        return results


def run_backtest(config: Dict[str, Any], symbol: str = None) -> Dict[str, Any]:
    """
    Convenience function to run a backtest
    
    Args:
        config: Backtest configuration dict
        symbol: Optional single symbol (if None, runs all symbols in config)
    
    Returns:
        Results dict or dict of results for multiple symbols
    """
    engine = BacktestEngine(config)
    
    if symbol:
        return engine.run(symbol)
    else:
        return engine.run_multiple()


# Preview function for quick testing
def preview_strategy(symbol: str, start_date: str, end_date: str,
                    indicators_config: Dict[str, Any],
                    entry_conditions: List[Dict[str, Any]],
                    exit_conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Quick preview of strategy signals without running full backtest
    
    Returns:
        Dict with: df, indicators, entry_signal, exit_signal
    """
    # Load data
    data = load_bars([symbol], start_date, end_date)
    if symbol not in data:
        raise ValueError(f"No data for {symbol}")
    
    df = data[symbol]
    
    # Calculate indicators
    indicators = Indicators.calculate_all(df, indicators_config)
    
    # Build signals
    config = {
        'entry_conditions': entry_conditions,
        'exit_conditions': exit_conditions
    }
    entry_signal, exit_signal = build_signals_from_config(df, indicators, config)
    
    return {
        'df': df,
        'indicators': indicators,
        'entry_signal': entry_signal,
        'exit_signal': exit_signal,
        'entry_count': entry_signal.sum(),
        'exit_count': exit_signal.sum()
    }
