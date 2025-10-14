"""
Builds boolean entry/exit signals from indicator series.
Supports RSI thresholds and RSI Bollinger Band crossovers.
"""

import pandas as pd
from .settings import get

#========================= Signals =========================
def build_signals(ind: dict[str, pd.Series], *, 
                  rsi_buy_below: float = None, 
                  rsi_sell_above: float = None,
                  use_rsi_bb: bool = False
) -> tuple[pd.Series, pd.Series]:
    """
    Build entry/exit signals from indicators.
    
    Args:
        ind: Dictionary of indicator series (RSI, RSI_BB_UPPER, RSI_BB_LOWER, etc.)
        rsi_buy_below: Fixed RSI threshold for entry (e.g., 30)
        rsi_sell_above: Fixed RSI threshold for exit (e.g., 70)
        use_rsi_bb: If True, use Bollinger Bands instead of fixed thresholds
    
    Returns:
        Tuple of (entry_signal, exit_signal) boolean Series
    """
    idx = next(iter(ind.values())).index
    entry = pd.Series(False, index=idx)
    exit_ = pd.Series(False, index=idx)

    if "RSI" in ind:
        r = ind["RSI"]
        
        if use_rsi_bb and "RSI_BB_LOWER" in ind and "RSI_BB_UPPER" in ind:
            # Use Bollinger Bands: Buy when RSI crosses below lower band, sell when crosses above upper
            lower = ind["RSI_BB_LOWER"]
            upper = ind["RSI_BB_UPPER"]
            
            # Entry: RSI crosses below lower Bollinger Band (oversold)
            entry |= (r < lower)
            
            # Exit: RSI crosses above upper Bollinger Band (overbought)
            exit_ |= (r > upper)
        else:
            # Use fixed thresholds
            if rsi_buy_below is not None:
                entry |= (r < float(rsi_buy_below))
            if rsi_sell_above is not None:
                exit_ |= (r > float(rsi_sell_above))

    return entry.astype(bool), exit_.astype(bool)

