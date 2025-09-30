from __future__ import annotations
import os
import pandas as pd
import plotly.graph_objects as go
from .settings import get

def equity_chart_html(symbol: str,
                      equity: pd.Series,
                      buyhold: pd.Series | None = None,
                      benchmark: pd.Series | None = None,
                      events: list[dict] | None = None,
                      title: str | None = None,
                      out_path: str | None = None) -> str:
    """
    Single canonical equity chart (strategy + optional benchmark + buy & hold + trade markers).
    Colors & styling standardized so tearsheets can embed this file.
    """
    ensure_dir = lambda p: os.makedirs(os.path.dirname(p), exist_ok=True) if os.path.dirname(p) else None
    fig = go.Figure()

    # Strategy (dark green)
    fig.add_trace(go.Scatter(
        x=equity.index,
        y=equity.values,
        name="Strategy",
        mode="lines",
        line=dict(color="#0b6d2f", width=2),
        hovertemplate="Date=%{x}<br>Strategy=%{y:.2f}<extra></extra>"
    ))

    # Benchmark (grey)
    if benchmark is not None:
        bench_aligned = benchmark.reindex(equity.index).ffill()
        fig.add_trace(go.Scatter(
            x=bench_aligned.index,
            y=bench_aligned.values,
            name="Benchmark",
            mode="lines",
            line=dict(color="#7a7a7a", width=1.5),
            hovertemplate="Date=%{x}<br>Benchmark=%{y:.2f}<extra></extra>"
        ))

    # Buy & Hold (white)
    if buyhold is not None:
        bh_aligned = buyhold.reindex(equity.index).ffill()
        fig.add_trace(go.Scatter(
            x=bh_aligned.index,
            y=bh_aligned.values,
            name="Buy & Hold",
            mode="lines",
            line=dict(color="#ffffff", width=1.5),
            hovertemplate="Date=%{x}<br>BuyHold=%{y:.2f}<extra></extra>"
        ))

    # Trade markers (green buys / red sells)
    if events:
        buys_x, buys_y, sells_x, sells_y = [], [], [], []
        for ev in events:
            ev_ts = ev.get("ts")
            if ev_ts not in equity.index:
                continue
            if ev.get("type") == "buy":
                buys_x.append(ev_ts); buys_y.append(equity.loc[ev_ts])
            elif ev.get("type") == "sell":
                sells_x.append(ev_ts); sells_y.append(equity.loc[ev_ts])
        if buys_x:
            fig.add_trace(go.Scatter(
                x=buys_x, y=buys_y,
                name="Buy",
                mode="markers",
                marker=dict(symbol="triangle-up", color="#00c853", size=9),
                hovertemplate="Buy<br>Date=%{x}<br>Equity=%{y:.2f}<extra></extra>"
            ))
        if sells_x:
            fig.add_trace(go.Scatter(
                x=sells_x, y=sells_y,
                name="Sell",
                mode="markers",
                marker=dict(symbol="triangle-down", color="#ff1744", size=9),
                hovertemplate="Sell<br>Date=%{x}<br>Equity=%{y:.2f}<extra></extra>"
            ))

    fig.update_layout(
        title=title or f"{symbol} Equity",
        title_x=0.5,
        template="plotly_dark",
        hovermode="x unified",
        legend=dict(
            orientation="h",
            yanchor="top",
            y=-0.18,          # move legend below chart
            x=0,
            font=dict(size=10)
        ),
        margin=dict(l=55, r=20, t=55, b=65),
    )

    html = fig.to_html(include_plotlyjs="cdn", full_html=True)
    if not out_path:
        charts_dir = get("CHART_DIR", "./charts")
        os.makedirs(charts_dir, exist_ok=True)
        out_path = os.path.join(charts_dir, f"{symbol}_equity.html")
    ensure_dir(out_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return out_path
