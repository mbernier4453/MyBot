"""
Builds boolean entry/exit signals from indicator series.
MVP: uses RSI thresholds. If you add more indicators, OR them (ANY logic).
"""

import pandas as pd
from .settings import get

#========================= Signals =========================
def build_signals(ind: dict[str, pd.Series], *, rsi_buy_below: float, rsi_sell_above: float
) -> tuple[pd.Series, pd.Series]:
    idx = next(iter(ind.values())).index
    entry = pd.Series(False, index=idx)
    exit_ = pd.Series(False, index=idx)

    if "RSI" in ind:
        r = ind["RSI"]
        entry |= (r < float(rsi_buy_below))
        exit_  |= (r > float(rsi_sell_above))

    return entry.astype(bool), exit_.astype(bool)

