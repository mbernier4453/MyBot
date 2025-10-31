from __future__ import annotations
import os
import pandas as pd
import plotly.graph_objects as go
from .settings import get

def equity_chart_html(symbol: str,
                      equity: "pd.Series",
                      buyhold: "pd.Series | None" = None,
                      benchmark: "pd.Series | None" = None,
                      events: "list[dict] | None" = None,
                      title: str | None = None,
                      out_path: str | None = None) -> str | None:
    """
    Builds and saves the equity chart if out_path provided.
    Returns the path or None if saving failed.
    """
    title = title or f"{symbol} Equity"
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=equity.index, y=equity.values,
        name="Strategy", mode="lines",
        line=dict(color="#0b6d2f", width=2),
        hovertemplate="Date=%{x}<br>Strategy=%{y:.2f}<extra></extra>"
    ))

    if benchmark is not None:
        b_aligned = benchmark.reindex(equity.index).ffill()
        fig.add_trace(go.Scatter(
            x=b_aligned.index, y=b_aligned.values,
            name="Benchmark", mode="lines",
            line=dict(color="#7a7a7a", width=1.5),
            hovertemplate="Date=%{x}<br>Benchmark=%{y:.2f}<extra></extra>"
        ))

    if buyhold is not None:
        h_aligned = buyhold.reindex(equity.index).ffill()
        fig.add_trace(go.Scatter(
            x=h_aligned.index, y=h_aligned.values,
            name="Buy & Hold", mode="lines",
            line=dict(color="#ffffff", width=1.5),
            hovertemplate="Date=%{x}<br>BuyHold=%{y:.2f}<extra></extra>"
        ))

    if events:
        buys_x, buys_y, sells_x, sells_y = [], [], [], []
        for ev in events:
            ts = ev.get("ts")
            if ts not in equity.index:  # skip if date mismatch
                continue
            if ev.get("type") == "buy":
                buys_x.append(ts); buys_y.append(equity.loc[ts])
            elif ev.get("type") == "sell":
                sells_x.append(ts); sells_y.append(equity.loc[ts])
        if buys_x:
            fig.add_trace(go.Scatter(
                x=buys_x, y=buys_y, name="Buy", mode="markers",
                marker=dict(symbol="triangle-up", color="#00c853", size=9),
                hovertemplate="Buy<br>Date=%{x}<br>Equity=%{y:.2f}<extra></extra>"
            ))
        if sells_x:
            fig.add_trace(go.Scatter(
                x=sells_x, y=sells_y, name="Sell", mode="markers",
                marker=dict(symbol="triangle-down", color="#ff1744", size=9),
                hovertemplate="Sell<br>Date=%{x}<br>Equity=%{y:.2f}<extra></extra>"
            ))

    fig.update_layout(
        title=title,
        title_x=0.5,
        template="plotly_dark",
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="top", y=-0.18, x=0, font=dict(size=10)),
        margin=dict(l=55, r=20, t=55, b=65),
    )

    if out_path is None:
        charts_dir = get("CHART_PATH", "./results/charts")
        os.makedirs(charts_dir, exist_ok=True)
        out_path = os.path.join(charts_dir, f"{symbol}_equity.html")
    else:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

    try:
        html = fig.to_html(include_plotlyjs="cdn", full_html=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        return out_path
    except Exception:
        return None
