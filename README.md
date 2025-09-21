# RSI Backtester MVP

Daily RSI strategy research with a small, modular codebase. Starts simple and grows via flags and small pure functions.

## Scope now

Data: yfinance only, adjusted OHLC, daily bars.

Indicators: RSI (SMA of gains/losses).

Signals: RSI threshold, long-only.

Engine: next-bar model, choose weight-based (fast) or share-based (execution realistic).

Frictions: fees in bps, optional open slippage.

Metrics: total return, CAGR, volatility, MaxDD, Sharpe using excess returns with a configurable risk-free rate.

## Folder layout
backtester/
config.py – run variables
data.py – load bars from yfinance
indicators.py – RSI now; registry ready for more
signals.py – builds entry/exit from indicator series
engine.py – backtest loop, execution model, RF-aware Sharpe
results.py – metrics and CSV writers

## Quick start

Use Python 3.11.

Create a venv and install requirements.txt.

Edit backtester/config.py:

symbols, timescale, tz, adjust

RSI_PERIOD, RSI_BUY, RSI_SELL

ORDER_TYPE 

INITIAL_CAP, TARGET_WEIGHT

FEES_BPS, SLIP_OPEN_BPS (start at 0 for parity checks)

RISK_FREE_RATE (annual)

Run your driver script that imports data, indicators, signals, engine, results and writes a CSV. CLI comes later.

Execution model (default)
Decide at close[t], execute at next open[t+1], mark PnL to close[t+1]. No look-ahead. Share model uses integer shares and fees on executed notional; weight model uses fractional exposure and fees on turnover.

Sharpe and risk-free
Engine converts RISK_FREE_RATE to daily (rf = annual_rf / 252). Sharpe uses excess daily return and sample stdev (ddof=1).

## Roadmap (short)

Weekly and monthly bars.

EMA/HMA/PriceToEMA and simple expression evaluator.

Stops, takes, max bars, cooldowns.

DuckDB outputs and tiny API for UI.

Polygon adapter.

## Notes

Keep slippage 0 until you match baselines.

Use weight model for grid sweeps. Use share model for execution realism.

### requirements.txt content:

numpy>=1.24
pandas>=2.0
yfinance>=0.2.40

Optional (add when used):
duckdb>=1.0.0
pyarrow>=15.0.0
fastapi>=0.110
uvicorn>=0.29
matplotlib>=3.8