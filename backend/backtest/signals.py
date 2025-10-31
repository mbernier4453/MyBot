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
            'threshold_pct': 0-10 (optional, for crosses),
            'delay_bars': 0-10 (optional),
            'bb_std': 1-3 (optional, for BB channels),
            'kc_mult': 0.5-5 (optional, for KC channels),
            'params': {...}  # Additional params like periods
        }
        """
        cond_type = condition.get('type', 'price')
        comparison = condition.get('comparison', 'above')
        
        # Build params dict for channel indicators
        channel_params = {}
        if 'bb_std' in condition:
            channel_params['bb_std'] = condition['bb_std']
        if 'kc_mult' in condition:
            channel_params['kc_mult'] = condition['kc_mult']
        
        # Get source series
        source_params = {**condition.get('params', {}), **channel_params}
        source = self._get_series(condition.get('source', 'close'), source_params)
        
        # Get target series or value
        target = condition.get('target')
        if isinstance(target, (int, float)):
            target_series = pd.Series([float(target)] * self.length, index=self.df.index)
        else:
            target_params = {**condition.get('target_params', {}), **channel_params}
            target_series = self._get_series(target, target_params)
        
        # Get advanced parameters
        threshold_pct = condition.get('threshold_pct', 0)
        delay_bars = condition.get('delay_bars', 0)
        
        # Evaluate comparison
        signal = self._compare(source, target_series, comparison, threshold_pct)
        
        # Apply delay if specified
        if delay_bars > 0:
            signal = signal.shift(delay_bars).fillna(False)
        
        return signal
    
    def _get_series(self, name: str, params: Dict[str, Any]) -> pd.Series:
        """
        Get a data series by name
        
        Handles special formats from frontend:
        - bb_top_20, bb_mid_20, bb_bottom_20
        - kc_top_20, kc_mid_20, kc_bottom_20
        - sma_50, ema_200, rsi_14, etc.
        """
        name_lower = name.lower()
        
        # Price columns
        if name_lower in ['close', 'open', 'high', 'low']:
            return self.df[name.capitalize()]
        
        # Volume
        if name_lower == 'volume':
            return self.df['Volume']
        
        # Handle Bollinger Band channels: bb_top_20, bb_mid_20, bb_bottom_20
        if name_lower.startswith('bb_'):
            parts = name_lower.split('_')
            if len(parts) >= 3:
                band_type = parts[1]  # top, mid, bottom
                period = int(parts[2]) if parts[2].isdigit() else 20
                std_dev = params.get('bb_std', 2.0)
                
                # Calculate BB if not already present
                bb_key = f'BB_{band_type.upper()}'
                if bb_key not in self.indicators:
                    from backend.backtest.indicators import Indicators
                    close = self.df['Close']
                    bb_data = Indicators.calculate_bb(close, period, std_dev)
                    self.indicators['BB_UPPER'] = bb_data['upper']
                    self.indicators['BB_MIDDLE'] = bb_data['middle']
                    self.indicators['BB_LOWER'] = bb_data['lower']
                
                # Map band type to indicator key
                if band_type == 'top':
                    return self.indicators.get('BB_UPPER', pd.Series([0.0] * self.length, index=self.df.index))
                elif band_type == 'mid':
                    return self.indicators.get('BB_MIDDLE', pd.Series([0.0] * self.length, index=self.df.index))
                elif band_type == 'bottom':
                    return self.indicators.get('BB_LOWER', pd.Series([0.0] * self.length, index=self.df.index))
        
        # Handle Keltner Channel: kc_top_20, kc_mid_20, kc_bottom_20
        if name_lower.startswith('kc_'):
            parts = name_lower.split('_')
            if len(parts) >= 3:
                band_type = parts[1]  # top, mid, bottom
                period = int(parts[2]) if parts[2].isdigit() else 20
                mult = params.get('kc_mult', 2.0)
                
                # Calculate KC if not already present
                kc_key = f'KC_{band_type.upper()}'
                if kc_key not in self.indicators:
                    from backend.backtest.indicators import Indicators
                    high = self.df['High']
                    low = self.df['Low']
                    close = self.df['Close']
                    kc_data = Indicators.calculate_kc(high, low, close, period, mult)
                    self.indicators['KC_UPPER'] = kc_data['upper']
                    self.indicators['KC_MIDDLE'] = kc_data['middle']
                    self.indicators['KC_LOWER'] = kc_data['lower']
                
                # Map band type to indicator key
                if band_type == 'top':
                    return self.indicators.get('KC_UPPER', pd.Series([0.0] * self.length, index=self.df.index))
                elif band_type == 'mid':
                    return self.indicators.get('KC_MIDDLE', pd.Series([0.0] * self.length, index=self.df.index))
                elif band_type == 'bottom':
                    return self.indicators.get('KC_LOWER', pd.Series([0.0] * self.length, index=self.df.index))
        
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
                comparison: str, threshold_pct: float = 0) -> pd.Series:
        """
        Compare two series with specified comparison operator
        
        Args:
            source: Source data series
            target: Target data series
            comparison: Comparison operator ('above', 'crosses_above', etc.)
            threshold_pct: For crosses, percentage beyond target required (0-10)
                          Example: 2.0 means price must cross 2% beyond target
        """
        
        if comparison == 'above' or comparison == '>':
            return source > target
        
        elif comparison == 'below' or comparison == '<':
            return source < target
        
        elif comparison == 'crosses_above':
            # True when source crosses above target
            # With threshold: must cross above target * (1 + threshold_pct/100)
            prev_source = source.shift(1)
            prev_target = target.shift(1)
            
            if threshold_pct > 0:
                threshold_target = target * (1 + threshold_pct / 100)
                return (prev_source <= prev_target) & (source >= threshold_target)
            else:
                return (prev_source <= prev_target) & (source > target)
        
        elif comparison == 'crosses_below':
            # True when source crosses below target
            # With threshold: must cross below target * (1 - threshold_pct/100)
            prev_source = source.shift(1)
            prev_target = target.shift(1)
            
            if threshold_pct > 0:
                threshold_target = target * (1 - threshold_pct / 100)
                return (prev_source >= prev_target) & (source <= threshold_target)
            else:
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
