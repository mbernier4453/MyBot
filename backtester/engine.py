# backtester/engine.py
import pandas as pd
from .settings import get
from .indicators import compute_basic
from .signals import build_signals
from .metrics import kpis_from_equity  # returns sharpe/sortino/etc.

def _exec_price(open_px: float, close_px: float, side: str, when: str) -> float:
    """
    Price with configured slippage. when = 'next_open' for MOO, 'next_close' for MOC.
    """
    if when == "next_open":
        slip = float(get("SLIP_OPEN_BPS")) / 1e4
        base = open_px
    else:
        slip = float(get("SLIP_CLOSE_BPS")) / 1e4
        base = close_px
    return base * (1.0 + slip) if side == "buy" else base * (1.0 - slip)

def run_symbol(df: pd.DataFrame, *, rsi_period: int, rsi_buy_below: float, rsi_sell_above: float) -> dict:
    """
    Backtest RSI long-only with MOO/MOC execution and integer shares.
    Decide at bar i close, execute at bar i+1 open/close, mark to bar i+1 close.
    """
    # Indicators and signals
    ind = compute_basic(df, rsi_period=int(rsi_period))
    entry_sig, exit_sig = build_signals(ind, rsi_buy_below=float(rsi_buy_below), rsi_sell_above=float(rsi_sell_above))

    # Config
    order_type = get("ORDER_TYPE")
    when = "next_open" if order_type == "MOO" else "next_close"
    fee_in = float(get("ENTRY_FEES_BPS", 0.0)) / 1e4
    fee_out = float(get("EXIT_FEES_BPS", 0.0)) / 1e4
    target_w = float(get("TARGET_WEIGHT", 1.0))
    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))

    # State
    cash = init_cap
    shares = 0
    entries = 0
    exits = 0
    equity = [cash]

    opens = df["Open"].to_numpy(dtype="float64")
    closes = df["Close"].to_numpy(dtype="float64")
    idx = df.index

    # Iterate to n-2 so we can reference i+1 safely, then append mark-to-close(i+1)
    for i in range(len(df) - 1):
        # 1) Exits
        if shares > 0 and bool(exit_sig.iloc[i]):
            px = _exec_price(opens[i + 1], closes[i + 1], "sell", when)
            notional = shares * px
            fee = fee_out * notional
            cash += notional - fee
            shares = 0
            exits += 1

        # 2) Entries
        if shares == 0 and bool(entry_sig.iloc[i]):
            px = _exec_price(opens[i + 1], closes[i + 1], "buy", when)
            equity_open = cash
            target_dollars = target_w * equity_open
            affordable = int(cash // (px * (1.0 + fee_in)))
            target_q = int(target_dollars // px)
            qty = max(0, min(affordable, target_q))
            if qty > 0:
                notional = qty * px
                fee = fee_in * notional
                cash -= notional + fee
                shares = qty
                entries += 1

        # 3) Mark to close of i+1
        equity.append(cash + shares * closes[i + 1])

    equity_s = pd.Series(equity, index=idx[:len(equity)], name="equity")

    # KPIs
    m = kpis_from_equity(equity_s)  # expects Series indexed by datetime
    m.update({
        "init_cap": init_cap,
        "trades_total": entries + exits,
        "trades_entry": entries,
        "trades_exit": exits,
    })

    return {"equity": equity_s, "metrics": m}
