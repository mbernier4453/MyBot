# filepath: c:\Users\mabso\MyBot\backtester\portfolio_engine.py
import math
import pandas as pd
import numpy as np

from .settings import get
from .metrics import kpis_from_equity

# ---- Robust RSI resolver (handles absence of rsi in indicators) ----
_rsi_alias = None
try:
    # Try common exported names
    from .indicators import rsi as _rsi_alias  # type: ignore
except Exception:
    try:
        from .indicators import calc_rsi as _rsi_alias  # type: ignore
    except Exception:
        _rsi_alias = None

def _fallback_rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    r = 100 - (100 / (1 + rs))
    return r.bfill()

def _rsi(series: pd.Series, period: int) -> pd.Series:
    if _rsi_alias is not None:
        try:
            return _rsi_alias(series, period)  # type: ignore
        except Exception:
            pass
    return _fallback_rsi(series, period)
# -------------------------------------------------------------------

class PortfolioResult:
    def __init__(self, equity, per_ticker_equity, trades, buyhold_equity, benchmark_equity, per_ticker_positions):
        self.equity = equity
        self.per_ticker_equity = per_ticker_equity
        self.trades = trades
        self.buyhold_equity = buyhold_equity
        self.benchmark_equity = benchmark_equity
        self.per_ticker_positions = per_ticker_positions
        self.metrics = kpis_from_equity(equity)
        
        # Add buy & hold metrics
        if buyhold_equity is not None and len(buyhold_equity) > 0:
            bh_metrics = kpis_from_equity(buyhold_equity)
            self.metrics['buyhold_total_return'] = bh_metrics.get('total_return')
            self.metrics['buyhold_cagr'] = bh_metrics.get('cagr')
            self.metrics['buyhold_sharpe'] = bh_metrics.get('sharpe')
            self.metrics['buyhold_sortino'] = bh_metrics.get('sortino')
            self.metrics['buyhold_vol'] = bh_metrics.get('vol')
            self.metrics['buyhold_maxdd'] = bh_metrics.get('maxdd')
        
        # Add benchmark metrics
        if benchmark_equity is not None and len(benchmark_equity) > 0:
            bench_metrics = kpis_from_equity(benchmark_equity)
            self.metrics['bench_total_return'] = bench_metrics.get('total_return')
            self.metrics['bench_cagr'] = bench_metrics.get('cagr')
            self.metrics['bench_sharpe'] = bench_metrics.get('sharpe')
            self.metrics['bench_sortino'] = bench_metrics.get('sortino')
            self.metrics['bench_vol'] = bench_metrics.get('vol')
            self.metrics['bench_maxdd'] = bench_metrics.get('maxdd')
        
        # Add trade-specific metrics
        self._add_trade_metrics()
    
    def _add_trade_metrics(self):
        """Calculate trade-specific metrics from trades list."""
        if not self.trades:
            self.metrics['trades_total'] = 0
            self.metrics['trades_entry'] = 0
            self.metrics['trades_exit'] = 0
            self.metrics['win_rate'] = 0.0
            self.metrics['net_win_rate'] = 0.0
            self.metrics['avg_trade_pnl'] = 0.0
            return
        
        # Count trades
        entry_trades = [t for t in self.trades if t['side'] == 'buy']
        exit_trades = [t for t in self.trades if t['side'] == 'sell']
        
        self.metrics['trades_total'] = len(self.trades)
        self.metrics['trades_entry'] = len(entry_trades)
        self.metrics['trades_exit'] = len(exit_trades)
        
        # Calculate win rate and avg P&L from exit trades (which have pnl field)
        if exit_trades:
            pnls = [t.get('pnl', 0) for t in exit_trades]
            wins = [pnl for pnl in pnls if pnl > 0]
            
            self.metrics['win_rate'] = len(wins) / len(exit_trades) if exit_trades else 0.0
            
            # Net win rate: (wins - losses) / total_trades
            losses = [pnl for pnl in pnls if pnl < 0]
            self.metrics['net_win_rate'] = (len(wins) - len(losses)) / len(exit_trades) if exit_trades else 0.0
            
            # Average trade P&L
            self.metrics['avg_trade_pnl'] = sum(pnls) / len(pnls) if pnls else 0.0
        else:
            self.metrics['win_rate'] = 0.0
            self.metrics['net_win_rate'] = 0.0
            self.metrics['avg_trade_pnl'] = 0.0


def _load_price_series(symbol, data_adapter, start, end):
    df = data_adapter(symbol, start=start, end=end)
    if df is None or df.empty:
        raise ValueError(f"No data for {symbol}")
    if 'close' not in df.columns:
        for c in ['Close', 'adj_close', 'Adj Close']:
            if c in df.columns:
                df = df.rename(columns={c: 'close'})
                break
    return df[['close']].copy()


def simulate_portfolio(data_adapter):
    tickers = list(get("TICKERS", []))
    strategies = get("PORTFOLIO_STRATEGIES", {})
    weights_cfg = get("PORTFOLIO_WEIGHTS", None)
    utilization = float(get("PORTFOLIO_TARGET_UTILIZATION", 1.0))
    start = get("START", None)
    end = get("END", None)
    init_cap = float(get("INITIAL_CAPITAL", 100_000.0))

    if not tickers:
        raise ValueError("No TICKERS configured for portfolio mode.")
    if not strategies:
        raise ValueError("PORTFOLIO_STRATEGIES empty.")

    # Weights
    if weights_cfg:
        # Keep only weights for active tickers; warn on extras
        extra = [k for k in weights_cfg.keys() if k not in tickers]
        if extra:
            print(f"[Portfolio] Ignoring weights for non-listed symbols: {extra}")
        weights = {k: float(v) for k, v in weights_cfg.items() if k in tickers}
        if not weights:
            raise ValueError("After filtering, no valid weights remained.")
        total_w = sum(weights.values())
        if not np.isclose(total_w, 1.0):
            weights = {k: v / total_w for k, v in weights.items()}
    else:
        eq_w = 1.0 / len(tickers)
        weights = {t: eq_w for t in tickers}

    # Load price data
    price_map = {t: _load_price_series(t, data_adapter, start, end) for t in tickers}

    # Common index (intersection)
    common_index = None
    for df in price_map.values():
        common_index = df.index if common_index is None else common_index.intersection(df.index)
    common_index = common_index.sort_values()

    for t in tickers:
        price_map[t] = price_map[t].reindex(common_index).ffill()

    # RSI cache
    rsi_cache = {}
    for t in tickers:
        period_rsi = strategies[t]["rsi_period"]
        rsi_cache[t] = _rsi(price_map[t]['close'], period_rsi)

    # State
    cash = init_cap
    positions = {t: 0 for t in tickers}
    cost_basis = {t: 0.0 for t in tickers}
    per_ticker_equity = {t: [] for t in tickers}
    per_ticker_positions = {t: [] for t in tickers}
    equity_series = []
    buyhold_equity_vals = []
    trades = []

    # Buy & Hold baseline
    first_prices = {t: price_map[t]['close'].iloc[0] for t in tickers}
    bh_shares = {}
    remaining_bh_cash = init_cap
    for t in tickers:
        alloc = init_cap * weights[t]
        price = first_prices[t]
        shares = math.floor((alloc * utilization) / price)
        bh_shares[t] = shares
        remaining_bh_cash -= shares * price
    for dt in common_index:
        total_bh = remaining_bh_cash
        for t in tickers:
            total_bh += bh_shares[t] * price_map[t].loc[dt, 'close']
        buyhold_equity_vals.append(total_bh)
    buyhold_equity = pd.Series(buyhold_equity_vals, index=common_index, name="buyhold_equity")

    # Benchmark
    benchmark_equity = None
    if get("BENCHMARK_ENABLED", False):
        bench_symbol = get("BENCHMARK_SYMBOL", None)
        if bench_symbol:
            try:
                bench_df = _load_price_series(bench_symbol, data_adapter, start, end).reindex(common_index).ffill()
                bp = bench_df['close']
                benchmark_equity = pd.Series((bp / bp.iloc[0]) * init_cap, index=common_index, name="benchmark_equity")
            except Exception:
                benchmark_equity = None

    entry_fee_bps = float(get("ENTRY_FEES_BPS", 0))
    exit_fee_bps = float(get("EXIT_FEES_BPS", 0))
    slip_open_bps = float(get("SLIP_OPEN_BPS", 0))
    slip_close_bps = float(get("SLIP_CLOSE_BPS", 0))

    # Loop
    for dt in common_index:
        total_equity_before = cash + sum(positions[t] * price_map[t].loc[dt, 'close'] for t in tickers)

        for t in tickers:
            close_px = price_map[t].loc[dt, 'close']
            rsi_val = rsi_cache[t].loc[dt]
            conf = strategies[t]
            buy_below = conf["rsi_buy_below"]
            sell_above = conf["rsi_sell_above"]

            # Buy
            if positions[t] == 0 and rsi_val <= buy_below:
                target_dollars = total_equity_before * weights[t] * utilization
                desired = math.floor(target_dollars / close_px)
                max_afford = math.floor(cash / close_px) if close_px > 0 else 0
                qty = min(desired, max_afford)
                if qty > 0:
                    exec_price = close_px * (1 + slip_open_bps / 10000.0)
                    gross = qty * exec_price
                    fees = gross * (entry_fee_bps / 10000.0)
                    total_cost = gross + fees
                    if total_cost <= cash:
                        cash -= total_cost
                        positions[t] += qty
                        cost_basis[t] = exec_price
                        trades.append({
                            "date": dt, "ticker": t, "side": "buy",
                            "shares": qty, "price": exec_price, "fees": fees
                        })

            # Sell
            elif positions[t] > 0 and rsi_val >= sell_above:
                qty = positions[t]
                exec_price = close_px * (1 - slip_close_bps / 10000.0)
                gross = qty * exec_price
                fees = gross * (exit_fee_bps / 10000.0)
                proceeds = gross - fees
                cash += proceeds
                trades.append({
                    "date": dt, "ticker": t, "side": "sell",
                    "shares": qty, "price": exec_price, "fees": fees,
                    "pnl": (exec_price - cost_basis[t]) * qty - fees
                })
                positions[t] = 0
                cost_basis[t] = 0.0

        total_equity = cash + sum(positions[t] * price_map[t].loc[dt, 'close'] for t in tickers)
        equity_series.append(total_equity)

        for t in tickers:
            per_ticker_equity[t].append(positions[t] * price_map[t].loc[dt, 'close'])
            per_ticker_positions[t].append(positions[t])

    equity = pd.Series(equity_series, index=common_index, name="portfolio_equity")
    per_ticker_equity = {t: pd.Series(vals, index=common_index, name=f"{t}_equity")
                         for t, vals in per_ticker_equity.items()}

    return PortfolioResult(equity, per_ticker_equity, trades, buyhold_equity, benchmark_equity, per_ticker_positions)