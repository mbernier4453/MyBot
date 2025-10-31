"""
Signals Module
Evaluates entry/exit conditions from frontend condition builder format
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Union


class SignalEvaluator:
    """Evaluates entry/exit signals based on conditions"""
    
    def __init__(self, df: pd.DataFrame, indicators: Dict[str, pd.Series]):
        """
        Args:
            df: DataFrame with OHLCV data
            indicators: Dict of calculated indicators
        """
        self.df = df
        self.indicators = indicators
        self.length = len(df)
    
    def evaluate_conditions(self, conditions: List[Dict[str, Any]], 
                          logic: str = 'all') -> pd.Series:
        """
        Evaluate a list of conditions and combine with AND/OR logic
        
        Args:
            conditions: List of condition dicts from frontend
            logic: 'all' (AND) or 'any' (OR)
        
        Returns:
            Boolean series indicating when conditions are met
        """
        if not conditions:
            return pd.Series([False] * self.length, index=self.df.index)
        
        # Evaluate each condition
        results = []
        for condition in conditions:
            result = self.evaluate_condition(condition)
            results.append(result)
        
        # Combine with specified logic
        if logic == 'all':
            # AND all conditions
            combined = results[0]
            for result in results[1:]:
                combined = combined & result
        else:  # 'any'
            # OR all conditions
            combined = results[0]
            for result in results[1:]:
                combined = combined | result
        
        return combined
    
    def evaluate_condition(self, condition: Dict[str, Any]) -> pd.Series:
        """
        Evaluate a single condition
        
        Condition format from frontend:
        {
            'type': 'price' | 'rsi' | 'ma',
            'comparison': 'crosses_above' | 'crosses_below' | 'above' | 'below',
            'source': 'close' | 'rsi' | indicator name,
            'target': number or indicator name,
            'params': {...}  # Additional params like periods
        }
        """
        cond_type = condition.get('type', 'price')
        comparison = condition.get('comparison', 'above')
        
        # Get source series
        source = self._get_series(condition.get('source', 'close'), condition.get('params', {}))
        
        # Get target series or value
        target = condition.get('target')
        if isinstance(target, (int, float)):
            target_series = pd.Series([float(target)] * self.length, index=self.df.index)
        else:
            target_series = self._get_series(target, condition.get('target_params', {}))
        
        # Evaluate comparison
        return self._compare(source, target_series, comparison)
    
    def _get_series(self, name: str, params: Dict[str, Any]) -> pd.Series:
        """Get a data series by name"""
        name_lower = name.lower()
        
        # Price columns
        if name_lower in ['close', 'open', 'high', 'low']:
            return self.df[name.capitalize()]
        
        # Volume
        if name_lower == 'volume':
            return self.df['Volume']
        
        # Indicators
        if name.upper() in self.indicators:
            return self.indicators[name.upper()]
        
        # Try variations
        for key in self.indicators.keys():
            if key.lower() == name_lower:
                return self.indicators[key]
        
        # Return zeros if not found
        print(f"[SIGNALS] Warning: Series '{name}' not found, returning zeros")
        return pd.Series([0.0] * self.length, index=self.df.index)
    
    def _compare(self, source: pd.Series, target: pd.Series, 
                comparison: str) -> pd.Series:
        """Compare two series with specified comparison operator"""
        
        if comparison == 'above' or comparison == '>':
            return source > target
        
        elif comparison == 'below' or comparison == '<':
            return source < target
        
        elif comparison == 'crosses_above':
            # True when source crosses above target
            prev_source = source.shift(1)
            prev_target = target.shift(1)
            return (prev_source <= prev_target) & (source > target)
        
        elif comparison == 'crosses_below':
            # True when source crosses below target
            prev_source = source.shift(1)
            prev_target = target.shift(1)
            return (prev_source >= prev_target) & (source < target)
        
        elif comparison == 'equals' or comparison == '==':
            return np.isclose(source, target, rtol=1e-5)
        
        elif comparison == 'greater_equal' or comparison == '>=':
            return source >= target
        
        elif comparison == 'less_equal' or comparison == '<=':
            return source <= target
        
        else:
            print(f"[SIGNALS] Unknown comparison: {comparison}, defaulting to 'above'")
            return source > target


def build_signals_from_config(df: pd.DataFrame, indicators: Dict[str, pd.Series],
                             config: Dict[str, Any]) -> tuple[pd.Series, pd.Series]:
    """
    Build entry and exit signals from frontend config
    
    Args:
        df: OHLCV DataFrame
        indicators: Dict of calculated indicators
        config: Config dict with 'entry_conditions', 'exit_conditions', etc.
    
    Returns:
        Tuple of (entry_signal, exit_signal) as boolean Series
    """
    evaluator = SignalEvaluator(df, indicators)
    
    # Entry conditions
    entry_conditions = config.get('entry_conditions', [])
    entry_logic = config.get('entry_logic', 'all')
    entry_signal = evaluator.evaluate_conditions(entry_conditions, entry_logic)
    
    # Exit conditions
    exit_conditions = config.get('exit_conditions', [])
    exit_logic = config.get('exit_logic', 'all')
    exit_signal = evaluator.evaluate_conditions(exit_conditions, exit_logic)
    
    return entry_signal, exit_signal


# Legacy compatibility functions
def build_signals(indicators: dict, **kwargs) -> tuple[pd.Series, pd.Series]:
    """
    Legacy function for simple RSI signals
    Kept for backward compatibility with old backtester
    """
    rsi = indicators.get('RSI')
    if rsi is None:
        raise ValueError("RSI indicator not found")
    
    rsi_buy_below = kwargs.get('rsi_buy_below')
    rsi_sell_above = kwargs.get('rsi_sell_above')
    use_rsi_bb = kwargs.get('use_rsi_bb', False)
    
    if use_rsi_bb:
        # Use Bollinger Bands on RSI
        rsi_bb_lower = indicators.get('RSI_BB_LOWER')
        rsi_bb_upper = indicators.get('RSI_BB_UPPER')
        
        if rsi_bb_lower is None or rsi_bb_upper is None:
            raise ValueError("RSI Bollinger Bands not calculated")
        
        entry_signal = rsi < rsi_bb_lower
        exit_signal = rsi > rsi_bb_upper
    else:
        # Use fixed thresholds
        if rsi_buy_below is None or rsi_sell_above is None:
            raise ValueError("RSI thresholds not provided")
        
        entry_signal = rsi < rsi_buy_below
        exit_signal = rsi > rsi_sell_above
    
    return entry_signal, exit_signal
