# backtester/engine.py
from __future__ import annotations
import pandas as pd
from .settings import get
from .indicators import compute_basic
from .signals import build_signals
from .metrics import kpis_from_equity

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

def run_symbol(
    df: pd.DataFrame, *,
    rsi_period: int,
    rsi_buy_below: float,
    rsi_sell_above: float
) -> dict:
    """
    Backtest RSI long only with MOO or MOC and integer shares.
    Decide at bar i close, execute at bar i+1 open or close, mark to bar i+1 close.
    Returns dict with equity series, metrics, and event markers.
    """
    # indicators and signals
    ind = compute_basic(df, rsi_period=int(rsi_period))
    entry_sig, exit_sig = build_signals(
        ind,
        rsi_buy_below=float(rsi_buy_below),
        rsi_sell_above=float(rsi_sell_above),
    )

    # config
    order_type = get("ORDER_TYPE")
    when = "next_open" if order_type == "MOO" else "next_close"
    fee_in = float(get("ENTRY_FEES_BPS", 0.0)) / 1e4
    fee_out = float(get("EXIT_FEES_BPS", 0.0)) / 1e4
    target_w = float(get("TARGET_WEIGHT", 1.0))
    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))
    slip_bps_open = float(get("SLIP_OPEN_BPS", 0.0))
    slip_bps_close = float(get("SLIP_CLOSE_BPS", 0.0))

    # state
    cash = init_cap
    shares = 0
    entries = 0
    exits = 0
    equity = [cash]
    events: list[dict] = []
    round_trip_pnls = []

    opens = df["Open"].to_numpy(dtype="float64")
    closes = df["Close"].to_numpy(dtype="float64")
    idx = df.index

    last_buy_price = None
    wins = 0
    closed_round_trips = 0

    # iterate
    for i in range(len(df) - 1):
        # entries
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
                events.append({
                    "ts": idx[i + 1],
                    "type": "buy",
                    "price": float(px),
                    "qty": int(qty),
                    "fee": float(fee),
                    "order_type": order_type,
                    "slippage_bps": slip_bps_open if when == "next_open" else slip_bps_close,
                })
                last_buy_price = px
        # Exit
        elif shares > 0 and bool(exit_sig.iloc[i]):
            px = _exec_price(opens[i + 1], closes[i + 1], "sell", when)
            # win/loss tracking
            if last_buy_price is not None:
                gross_pnl = (px - last_buy_price) * shares
                fee_cost = (last_buy_price * shares * fee_in) + (px * shares * fee_out)
                net_pnl = gross_pnl - fee_cost
                round_trip_pnls.append(net_pnl)
                closed_round_trips += 1
                if net_pnl > 0:
                    wins += 1
            last_buy_price = None
            notional = shares * px
            fee = fee_out * notional
            cash += notional - fee
            qty_sold = shares
            shares = 0
            exits += 1
            events.append({
                "ts": idx[i + 1],
                "type": "sell",
                "price": float(px),
                "qty": int(qty_sold),
                "fee": float(fee),
                "order_type": order_type,
                "slippage_bps": slip_bps_open if when == "next_open" else slip_bps_close,
            })

        # mark to close of i+1
        equity.append(cash + shares * closes[i + 1])

    equity_s = pd.Series(equity, index=idx[:len(equity)], name="equity")

    # kpis
    m = kpis_from_equity(equity_s)
    win_rate = (wins / closed_round_trips) if closed_round_trips > 0 else None
    net_win_rate = (wins / closed_round_trips) if closed_round_trips > 0 else None
    avg_trade_pnl = (sum(round_trip_pnls) / len(round_trip_pnls)) if round_trip_pnls else None
    m.update({
        "init_cap": init_cap,
        "trades_total": entries + exits,
        "trades_entry": entries,
        "trades_exit": exits,
        "win_rate": win_rate,
        "net_win_rate": net_win_rate,
        "avg_trade_pnl": avg_trade_pnl,
    })

    return {"equity": equity_s, "metrics": m, "events": events}
