# backtester/grid.py
from itertools import product
from typing import Dict, List

def rsi_param_grid(cfg: Dict) -> List[Dict]:
    """
    Generate parameter grid for RSI backtesting.
    Supports both fixed thresholds and Bollinger Band mode.
    
    Config keys:
        - RSI_PERIOD: RSI period(s) - int or list
        - USE_RSI_BB: Use Bollinger Bands instead of fixed thresholds (bool)
        - RSI_BB_PERIOD: Bollinger Band period(s) - int or list (optional)
        - RSI_BB_STD_DEV: Bollinger Band std dev multiplier(s) - float or list (optional)
        - RSI_BUY_BELOW: Fixed buy threshold(s) - float or list (for non-BB mode)
        - RSI_SELL_ABOVE: Fixed sell threshold(s) - float or list (for non-BB mode)
    """
    use_rsi_bb = cfg.get("USE_RSI_BB", False)
    
    # RSI period is always required
    ps = cfg.get("RSI_PERIOD")
    if not isinstance(ps, list):
        ps = [ps] if ps is not None else [14]
    
    if use_rsi_bb:
        # Bollinger Band mode
        bb_periods = cfg.get("RSI_BB_PERIOD")
        bb_stds = cfg.get("RSI_BB_STD_DEV")
        
        if not isinstance(bb_periods, list):
            bb_periods = [bb_periods] if bb_periods is not None else [20]
        if not isinstance(bb_stds, list):
            bb_stds = [bb_stds] if bb_stds is not None else [2.0]
        
        out = []
        for p, bb_p, bb_std in product(ps, bb_periods, bb_stds):
            out.append(dict(
                rsi_period=int(p),
                rsi_bb_period=int(bb_p),
                rsi_bb_std_dev=float(bb_std),
                use_rsi_bb=True
            ))
        return out
    else:
        # Fixed threshold mode
        bs = cfg.get("RSI_BUY_BELOW")
        ss = cfg.get("RSI_SELL_ABOVE")
        
        if not isinstance(bs, list):
            bs = [bs] if bs is not None else [30]
        if not isinstance(ss, list):
            ss = [ss] if ss is not None else [70]
        
        out = []
        for p, b, s in product(ps, bs, ss):
            if b >= s: 
                continue
            out.append(dict(
                rsi_period=int(p), 
                rsi_buy_below=float(b), 
                rsi_sell_above=float(s),
                use_rsi_bb=False
            ))
        return out
