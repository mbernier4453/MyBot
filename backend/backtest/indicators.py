"""
Technical Indicators Module
Python implementations matching frontend/modules/indicators/calculations.js exactly
"""

import numpy as np
import pandas as pd
from typing import Union, Tuple, Dict

EPS32 = np.finfo(np.float32).eps


class Indicators:
    """Collection of technical indicator calculations"""
    
    @staticmethod
    def calculate_sma(prices: Union[pd.Series, np.ndarray], period: int) -> pd.Series:
        """Calculate Simple Moving Average"""
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        return prices.rolling(window=period, min_periods=period).mean()
    
    @staticmethod
    def calculate_ema(prices: Union[pd.Series, np.ndarray], period: int) -> pd.Series:
        """Calculate Exponential Moving Average"""
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        return prices.ewm(span=period, adjust=False, min_periods=period).mean()
    
    @staticmethod
    def calculate_wma(prices: Union[pd.Series, np.ndarray], period: int) -> pd.Series:
        """Calculate Weighted Moving Average"""
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        weights = np.arange(1, period + 1)
        
        def wma_calc(window):
            if len(window) < period or np.any(np.isnan(window)):
                return np.nan
            return np.sum(weights * window) / np.sum(weights)
        
        return prices.rolling(window=period, min_periods=period).apply(wma_calc, raw=True)
    
    @staticmethod
    def calculate_hma(prices: Union[pd.Series, np.ndarray], period: int) -> pd.Series:
        """Calculate Hull Moving Average"""
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        half_period = int(period / 2)
        sqrt_period = int(np.sqrt(period))
        
        wma_half = Indicators.calculate_wma(prices, half_period)
        wma_full = Indicators.calculate_wma(prices, period)
        
        # 2 * WMA(n/2) - WMA(n)
        raw_hma = 2 * wma_half - wma_full
        
        # Final WMA of sqrt(n)
        return Indicators.calculate_wma(raw_hma, sqrt_period)
    
    @staticmethod
    def calculate_kama(prices: Union[pd.Series, np.ndarray], period: int = 20, 
                      fast: int = 2, slow: int = 30) -> pd.Series:
        """Calculate Kaufman Adaptive Moving Average"""
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        prices_array = prices.to_numpy()
        n = len(prices_array)
        kama = np.full(n, np.nan)
        
        if n < period:
            return pd.Series(kama, index=prices.index)
        
        fast_sc = 2 / (fast + 1)
        slow_sc = 2 / (slow + 1)
        
        for i in range(period, n):
            # Efficiency ratio
            change = abs(prices_array[i] - prices_array[i - period])
            volatility = sum(abs(prices_array[i - j] - prices_array[i - j - 1]) 
                           for j in range(period))
            
            if volatility == 0:
                er = 0
            else:
                er = change / volatility
            
            # Smoothing constant
            sc = (er * (fast_sc - slow_sc) + slow_sc) ** 2
            
            # KAMA calculation
            if i == period:
                kama[i] = prices_array[i]
            else:
                kama[i] = kama[i - 1] + sc * (prices_array[i] - kama[i - 1])
        
        return pd.Series(kama, index=prices.index)
    
    @staticmethod
    def calculate_bb(prices: Union[pd.Series, np.ndarray], period: int = 20, 
                    std_dev: float = 2.0) -> Dict[str, pd.Series]:
        """
        Calculate Bollinger Bands
        Returns: dict with 'upper', 'middle', 'lower'
        """
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        middle = Indicators.calculate_sma(prices, period)
        std = prices.rolling(window=period, min_periods=period).std()
        
        upper = middle + (std * std_dev)
        lower = middle - (std * std_dev)
        
        return {'upper': upper, 'middle': middle, 'lower': lower}
    
    @staticmethod
    def calculate_atr(high: Union[pd.Series, np.ndarray], 
                     low: Union[pd.Series, np.ndarray],
                     close: Union[pd.Series, np.ndarray], 
                     period: int = 14) -> pd.Series:
        """Calculate Average True Range"""
        if isinstance(high, np.ndarray):
            high = pd.Series(high)
        if isinstance(low, np.ndarray):
            low = pd.Series(low)
        if isinstance(close, np.ndarray):
            close = pd.Series(close)
        
        # True Range
        prev_close = close.shift(1)
        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # ATR is EMA of TR
        atr = tr.ewm(span=period, adjust=False, min_periods=period).mean()
        
        return atr
    
    @staticmethod
    def calculate_kc(high: Union[pd.Series, np.ndarray],
                    low: Union[pd.Series, np.ndarray], 
                    close: Union[pd.Series, np.ndarray],
                    period: int = 20, multiplier: float = 2.0) -> Dict[str, pd.Series]:
        """
        Calculate Keltner Channels
        Returns: dict with 'upper', 'middle', 'lower'
        """
        if isinstance(close, np.ndarray):
            close = pd.Series(close)
        
        middle = Indicators.calculate_ema(close, period)
        atr = Indicators.calculate_atr(high, low, close, period)
        
        upper = middle + (atr * multiplier)
        lower = middle - (atr * multiplier)
        
        return {'upper': upper, 'middle': middle, 'lower': lower}
    
    @staticmethod
    def calculate_rsi(prices: Union[pd.Series, np.ndarray], period: int = 14) -> pd.Series:
        """
        Calculate RSI (Relative Strength Index)
        Uses Wilder's smoothing method (EMA)
        """
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        # Calculate price changes
        delta = prices.diff()
        
        # Separate gains and losses
        gains = delta.where(delta > 0, 0)
        losses = -delta.where(delta < 0, 0)
        
        # Calculate average gains and losses using Wilder's smoothing (EMA)
        avg_gains = gains.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
        avg_losses = losses.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
        
        # Calculate RS and RSI
        rs = avg_gains / avg_losses
        rsi = 100 - (100 / (1 + rs))
        
        # Handle edge cases
        rsi = rsi.fillna(50)  # When both gain and loss are 0
        
        return rsi
    
    @staticmethod
    def calculate_stoch_rsi(prices: Union[pd.Series, np.ndarray], 
                          rsi_period: int = 14, stoch_period: int = 14,
                          k_smooth: int = 3, d_smooth: int = 3) -> Dict[str, pd.Series]:
        """
        Calculate Stochastic RSI
        Returns: dict with 'k' and 'd' lines
        """
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        # Calculate RSI
        rsi = Indicators.calculate_rsi(prices, rsi_period)
        
        # Calculate Stochastic RSI
        rsi_min = rsi.rolling(window=stoch_period, min_periods=stoch_period).min()
        rsi_max = rsi.rolling(window=stoch_period, min_periods=stoch_period).max()
        
        stoch_rsi = ((rsi - rsi_min) / (rsi_max - rsi_min)) * 100
        stoch_rsi = stoch_rsi.fillna(50)  # When range is 0
        
        # Smooth %K line
        k_line = Indicators.calculate_sma(stoch_rsi, k_smooth)
        
        # Smooth %D line
        d_line = Indicators.calculate_sma(k_line, d_smooth)
        
        return {'k': k_line, 'd': d_line}
    
    @staticmethod
    def calculate_macd(prices: Union[pd.Series, np.ndarray],
                      fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
        """
        Calculate MACD (Moving Average Convergence Divergence)
        Returns: dict with 'macd', 'signal', 'histogram'
        """
        if isinstance(prices, np.ndarray):
            prices = pd.Series(prices)
        
        ema_fast = Indicators.calculate_ema(prices, fast)
        ema_slow = Indicators.calculate_ema(prices, slow)
        
        macd = ema_fast - ema_slow
        signal_line = Indicators.calculate_ema(macd, signal)
        histogram = macd - signal_line
        
        return {'macd': macd, 'signal': signal_line, 'histogram': histogram}
    
    @staticmethod
    def calculate_ma(prices: Union[pd.Series, np.ndarray], 
                    ma_type: str, period: int) -> pd.Series:
        """
        Calculate Moving Average based on type
        ma_type: 'SMA', 'EMA', 'HMA', 'WMA', 'KAMA'
        """
        ma_type = ma_type.upper()
        
        if ma_type == 'SMA':
            return Indicators.calculate_sma(prices, period)
        elif ma_type == 'EMA':
            return Indicators.calculate_ema(prices, period)
        elif ma_type == 'HMA':
            return Indicators.calculate_hma(prices, period)
        elif ma_type == 'WMA':
            return Indicators.calculate_wma(prices, period)
        elif ma_type == 'KAMA':
            return Indicators.calculate_kama(prices, period)
        else:
            return Indicators.calculate_sma(prices, period)
    
    @staticmethod
    def calculate_all(df: pd.DataFrame, indicators_config: dict) -> dict:
        """
        Calculate all requested indicators on a DataFrame
        
        Args:
            df: DataFrame with OHLCV columns
            indicators_config: Dict specifying which indicators to calculate
                Example: {
                    'rsi': {'period': 14},
                    'macd': {'fast': 12, 'slow': 26, 'signal': 9},
                    'bb': {'period': 20, 'std_dev': 2.0}
                }
        
        Returns:
            Dict mapping indicator names to their calculated values
        """
        results = {}
        
        close = df['Close']
        high = df['High']
        low = df['Low']
        
        for indicator_name, params in indicators_config.items():
            indicator_lower = indicator_name.lower()
            
            try:
                if indicator_lower == 'rsi':
                    period = params.get('period', 14)
                    results['RSI'] = Indicators.calculate_rsi(close, period)
                
                elif indicator_lower == 'macd':
                    fast = params.get('fast', 12)
                    slow = params.get('slow', 26)
                    signal = params.get('signal', 9)
                    macd_data = Indicators.calculate_macd(close, fast, slow, signal)
                    results['MACD'] = macd_data['macd']
                    results['MACD_SIGNAL'] = macd_data['signal']
                    results['MACD_HIST'] = macd_data['histogram']
                
                elif indicator_lower == 'bb' or indicator_lower == 'bollinger':
                    period = params.get('period', 20)
                    std_dev = params.get('std_dev', 2.0)
                    bb_data = Indicators.calculate_bb(close, period, std_dev)
                    results['BB_UPPER'] = bb_data['upper']
                    results['BB_MIDDLE'] = bb_data['middle']
                    results['BB_LOWER'] = bb_data['lower']
                
                elif indicator_lower == 'kc' or indicator_lower == 'keltner':
                    period = params.get('period', 20)
                    mult = params.get('multiplier', 2.0)
                    kc_data = Indicators.calculate_kc(high, low, close, period, mult)
                    results['KC_UPPER'] = kc_data['upper']
                    results['KC_MIDDLE'] = kc_data['middle']
                    results['KC_LOWER'] = kc_data['lower']
                
                elif indicator_lower == 'atr':
                    period = params.get('period', 14)
                    results['ATR'] = Indicators.calculate_atr(high, low, close, period)
                
                elif indicator_lower == 'stoch_rsi' or indicator_lower == 'stochrsi':
                    rsi_period = params.get('rsi_period', 14)
                    stoch_period = params.get('stoch_period', 14)
                    k_smooth = params.get('k_smooth', 3)
                    d_smooth = params.get('d_smooth', 3)
                    stoch_data = Indicators.calculate_stoch_rsi(close, rsi_period, 
                                                               stoch_period, k_smooth, d_smooth)
                    results['STOCH_RSI_K'] = stoch_data['k']
                    results['STOCH_RSI_D'] = stoch_data['d']
                
                elif indicator_lower in ['sma', 'ema', 'hma', 'wma', 'kama']:
                    period = params.get('period', 20)
                    ma = Indicators.calculate_ma(close, indicator_lower, period)
                    results[f'{indicator_lower.upper()}_{period}'] = ma
            
            except Exception as e:
                print(f"[INDICATORS] Error calculating {indicator_name}: {e}")
                continue
        
        return results


# Convenience functions for backward compatibility
def calculate_sma(prices, period):
    return Indicators.calculate_sma(prices, period)

def calculate_ema(prices, period):
    return Indicators.calculate_ema(prices, period)

def calculate_rsi(prices, period=14):
    return Indicators.calculate_rsi(prices, period)

def calculate_macd(prices, fast=12, slow=26, signal=9):
    return Indicators.calculate_macd(prices, fast, slow, signal)

def calculate_bb(prices, period=20, std_dev=2.0):
    return Indicators.calculate_bb(prices, period, std_dev)
