# backtester/grid.py
from itertools import product
from typing import Dict, List

def rsi_param_grid(cfg: Dict) -> List[Dict]:
    ps = cfg.get("RSI_PERIOD")
    bs = cfg.get("RSI_BUY_BELOW")
    ss = cfg.get("RSI_SELL_ABOVE")
    if not (isinstance(ps, list) and isinstance(bs, list) and isinstance(ss, list)):
        # single run if lists are not present
        return [dict(rsi_period=cfg.get("RSI_PERIOD"),
                     rsi_buy_below=cfg.get("RSI_BUY_BELOW"),
                     rsi_sell_above=cfg.get("RSI_SELL_ABOVE"))]
    out = []
    for p, b, s in product(ps, bs, ss):
        if b >= s: 
            continue
        out.append(dict(rsi_period=int(p), rsi_buy_below=float(b), rsi_sell_above=float(s)))
    return out
