from __future__ import annotations
import pandas as pd
from typing import Optional, List, Dict, Any
from .charts import equity_chart_html
from .metrics import kpis_from_equity
from .capm import calculate_capm_metrics  # already present earlier
from .settings import get
import json
import numpy as np

def _format_metric(value, metric_key: str = "") -> str:
    """Format metric values for display in tearsheets.
    
    Percentages: 2 decimal places (e.g., 6.42%)
    Regular numbers: 2 decimal places
    CAPM metrics: 4 decimal places (alpha, beta, etc.)
    """
    if value is None or (isinstance(value, float) and (np.isnan(value) or np.isinf(value))):
        return "N/A"
    
    if not isinstance(value, (int, float)):
        return str(value)
    
    # CAPM metrics keep 4 decimals
    capm_keys = ['alpha', 'beta', 'r_squared', 'correlation', 'tracking_error', 
                 'information_ratio', 'treynor_ratio']
    if any(key in metric_key.lower() for key in capm_keys):
        return f"{value:.4f}"
    
    # Percentage metrics (convert to percentage and add %)
    pct_keys = ['return', 'cagr', 'vol', 'maxdd', 'dd', 'drawdown', 'win_rate', 'net_win_rate']
    if any(key in metric_key.lower() for key in pct_keys):
        return f"{value * 100:.2f}%"
    
    # Ratios and regular numbers
    return f"{value:.2f}"

def _drawdown_series(equity):
    arr = equity.astype(float).to_numpy()
    run_max = np.maximum.accumulate(arr)
    dd = (arr / run_max) - 1.0
    return dd

class TearsheetGenerator:
    def __init__(self, symbol: str, strategy_results: List[tuple], 
                 benchmark_equity: Optional[pd.Series] = None,
                 buyhold_equity: Optional[pd.Series] = None):
        self.symbol = symbol
        self.results = strategy_results  # [(metrics, params, equity, events), ...]
        self.benchmark_equity = benchmark_equity
        self.buyhold_equity = buyhold_equity
        
    def generate_tearsheet(self, run_id: str, top_k: int = 3, 
                          ranking_metrics: List[str] = None) -> str:
        """Generate comprehensive tearsheet HTML with toggleable sections."""
        if not ranking_metrics:
            ranking_metrics = ["total_return", "sharpe", "sortino", "maxdd"]
            
        html_sections = []
        html_sections.append(self._generate_header(run_id))
        html_sections.append(self._generate_summary_table(top_k, ranking_metrics))
        
        # CAPM Analysis Section
        if self.benchmark_equity is not None:
            html_sections.append(self._generate_capm_section(top_k))
        
        # Chart sections (toggleable)
        html_sections.append(self._generate_chart_sections(top_k, ranking_metrics))
        
        # Detailed metrics tables
        html_sections.append(self._generate_detailed_metrics(top_k, ranking_metrics))
        
        # Trade analysis
        html_sections.append(self._generate_trade_analysis(top_k))
        
        return self._wrap_html(html_sections, run_id)
    
    def _generate_capm_section(self, top_k: int) -> str:
        """Generate CAPM analysis for top strategies."""
        capm_html = ['<div class="capm-section">']  # Fixed
        capm_html.append('<h3>📊 CAMP Analysis</h3>')
        
        for i, (metrics, params, equity, events) in enumerate(self.results[:top_k]):
            param_str = f"p={params['rsi_period']} b={params['rsi_buy_below']} s={params['rsi_sell_above']}"
            
            # Calculate CAPM metrics
            capm_data = calculate_capm_metrics(equity, self.benchmark_equity)
            rolling_data = rolling_beta_alpha(equity, self.benchmark_equity, window=252)
            
            capm_html.append(f'<div class="strategy-capm" id="capm-{i}">')  # Fixed
            capm_html.append(f'<h4>Strategy #{i+1}: {param_str}</h4>')      # Fixed
            capm_html.append('<div class="capm-metrics">')                   # Fixed
            capm_html.append(f'<span class="metric">Alpha: {capm_data["alpha"]:.4f}</span>')
            capm_html.append(f'<span class="metric">Beta: {capm_data["beta"]:.4f}</span>')
            capm_html.append(f'<span class="metric">R²: {capm_data["r_squared"]:.4f}</span>')
            capm_html.append(f'<span class="metric">Tracking Error: {capm_data["tracking_error"]:.4f}</span>')
            capm_html.append(f'<span class="metric">Information Ratio: {capm_data["information_ratio"]:.4f}</span>')
            capm_html.append('</div>')
            
            # Rolling beta chart (toggleable)
            capm_html.append(f'<button onclick="toggleChart(\'rolling-beta-{i}\')">📈 Toggle Rolling Beta/Alpha</button>')
            capm_html.append(f'<div id="rolling-beta-{i}" class="chart-container" style="display:none;">')
            capm_html.append(self._generate_rolling_beta_chart(rolling_data, i))  # Fixed
            capm_html.append('</div>')
            capm_html.append('</div>')
        
        capm_html.append('</div>')  # Fixed
        return '\n'.join(capm_html)

def simple_metric_tearsheet(symbol: str,
                            metric: str,
                            ranked_records: list,
                            top_k: int,
                            run_id: str,
                            out_dir: str = "./results/tearsheets") -> str:
    """
    ranked_records: list of (metrics_dict, params_dict, equity_series, events)
    Assumed already sorted for the metric.
    """
    import os, json
    os.makedirs(out_dir, exist_ok=True)
    picks = ranked_records[:top_k]

    # Build rows + chart scripts
    rows = []
    chart_blocks = []
    scripts = []

    for i, (m, p, eq, events) in enumerate(picks, 1):
        param_str = f"p={p['rsi_period']} b={p['rsi_buy_below']} s={p['rsi_sell_above']}"
        rows.append(
            f"<tr>"
            f"<td>{i}</td>"
            f"<td>{param_str}</td>"
            f"<td>{m.get('total_return'):.4f}</td>"
            f"<td>{m.get('cagr'):.4f}</td>"
            f"<td>{m.get('sharpe'):.3f}</td>"
            f"<td>{m.get('sortino'):.3f}</td>"
            f"<td>{m.get('vol'):.3f}</td>"
            f"<td>{m.get('maxdd'):.3f}</td>"
            f"<td>{m.get('trades_total')}</td>"
            f"</tr>"
        )
        div_id = f"chart_{metric}_{i}"
        chart_blocks.append(
            f"<div class='chart-block'>"
            f"<button onclick=\"toggle('{div_id}')\">Toggle #{i} {param_str}</button>"
            f"<div id='{div_id}' class='chart' style='display:none;'></div>"
            f"</div>"
        )
        # Serialize equity
        x = json.dumps([d.isoformat() for d in eq.index])
        y = json.dumps([float(v) for v in eq.values])
        scripts.append(
            f"""
(function(){{
  Plotly.newPlot('{div_id}', [{{
      x:{x}, y:{y}, mode:'lines', name:'Equity', line:{{width:2}}
  }}], {{
      title:'{param_str}',
      margin:{{l:40,r:10,t:30,b:25}},
      hovermode:'x unified'
  }}, {{responsive:true}});
}})();
"""
        )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>{symbol} | {metric} | Tearsheet</title>
<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
<style>
body {{background:#111;color:#eee;font-family:Arial,sans-serif;margin:0;padding:1rem 1.25rem;}}
h1,h2 {{margin:0 0 .75rem;}}
table {{width:100%;border-collapse:collapse;font-size:0.8rem;}}
th,td {{padding:4px 6px;border-bottom:1px solid #333;text-align:right;}}
th:first-child,td:first-child {{text-align:left;}}
.chart-block {{margin:.5rem 0 1rem;}}
button {{background:#333;color:#eee;border:1px solid #444;padding:4px 10px;font-size:.65rem;cursor:pointer;border-radius:4px;}}
button:hover {{background:#444;}}
.chart {{height:320px;}}
.meta {{font-size:.7rem;color:#bbb;margin-bottom:1rem;}}
</style>
<script>
function toggle(id){{
  var el=document.getElementById(id);
  if(!el)return;
  el.style.display = (el.style.display==='none') ? 'block' : 'none';
}}
</script>
</head>
<body>
<h1>{symbol} – Top {len(picks)} by {metric}</h1>
<div class="meta">
  Run: {run_id} | Total strategies evaluated: {len(ranked_records)}
</div>
<h2>Summary</h2>
<table>
  <thead>
    <tr>
      <th>#</th><th>Params</th><th>Total Return</th><th>CAGR</th>
      <th>Sharpe</th><th>Sortino</th><th>Vol</th><th>MaxDD</th><th>Trades</th>
    </tr>
  </thead>
  <tbody>
    {''.join(rows)}
  </tbody>
</table>
<h2>Equity Charts</h2>
{''.join(chart_blocks)}
<script>
{''.join(scripts)}
</script>
</body>
</html>
"""
    path = os.path.join(out_dir, f"{run_id}_{symbol}_{metric}_tearsheet.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path

def per_strategy_tearsheet(symbol: str,
                           metric: str,
                           rank: int,
                           metric_value,
                           metrics_dict: dict,
                           params: dict,
                           equity: "pd.Series",
                           run_id: str,
                           out_dir: str,
                           benchmark_equity: "pd.Series | None" = None,
                           buyhold_equity: "pd.Series | None" = None,
                           chart_path: str | None = None) -> str:
    import os, json as _json, numpy as _np
    from .settings import get
    os.makedirs(out_dir, exist_ok=True)

    # -------- Config toggles --------
    make_charts_flag = bool(get("MAKE_CHARTS", True))
    run_capm = bool(get("RUN_CAPM", False)) and benchmark_equity is not None
    bench_enabled = benchmark_equity is not None and bool(get("BENCHMARK_ENABLED", False))
    bh_enabled = buyhold_equity is not None and bool(get("BUY_HOLD_ENABLED", False))

    pstr = f"p={params.get('rsi_period')} b={params.get('rsi_buy_below')} s={params.get('rsi_sell_above')}"
    # -------- Metrics table --------
    metric_fields = [
        ("Total Return", "total_return"),
        ("CAGR", "cagr"),
        ("Sharpe", "sharpe"),
        ("Sortino", "sortino"),
        ("Vol", "vol"),
        ("Max DD", "maxdd"),
        ("Win Rate", "win_rate"),
        ("Net Win Rate", "net_win_rate"),
        ("Avg Trade PnL", "avg_trade_pnl"),
        ("Entries", "trades_entry"),
        ("Exits", "trades_exit"),
        ("Trades", "trades_total"),
    ]
    metric_rows = "".join(
        f"<tr><td>{lbl}</td><td>{_format_metric(metrics_dict.get(key), key)}</td></tr>"
        for lbl, key in metric_fields
    )

    # -------- Comparison table (always define) --------
    compare_table = ""
    if bench_enabled or bh_enabled:
        try:
            from .metrics import kpis_from_equity
            cols = [("Strategy", equity)]
            if bench_enabled: cols.append(("Benchmark", benchmark_equity))
            if bh_enabled: cols.append(("Buy & Hold", buyhold_equity))
            comp_map = [
                ("Total Return", "total_return"),
                ("CAGR", "cagr"),
                ("Sharpe", "sharpe"),
                ("Sortino", "sortino"),
                ("Vol", "vol"),
                ("Max DD", "maxdd"),
            ]
            klist = []
            for lbl, ser in cols:
                try:
                    klist.append((lbl, kpis_from_equity(ser)))
                except Exception:
                    klist.append((lbl, {}))
            header = "".join(f"<th>{lbl}</th>" for lbl, _ in klist)
            body = []
            for row_lbl, key in comp_map:
                body.append(
                    "<tr><td>{}</td>{}</tr>".format(
                        row_lbl,
                        "".join(f"<td>{_format_metric(k.get(key), key)}</td>" for _, k in klist)
                    )
                )
            compare_table = f"""
    <div class="box">
      <h2>Comparison</h2>
      <table class="cmp">
        <thead><tr><th>Metric</th>{header}</tr></thead>
        <tbody>{''.join(body)}</tbody>
      </table>
    </div>
    """
        except Exception:
            compare_table = ""

    # -------- CAPM --------
    capm_block = ""
    if run_capm:
        try:
            from .capm import calculate_capm_metrics
            cols = [("Strategy", equity), ("Benchmark", benchmark_equity)]
            if bh_enabled:
                cols.append(("Buy & Hold", buyhold_equity))
            capm_rows = [
                ("Alpha (ann)", "alpha"),
                ("Beta", "beta"),
                ("R²", "r_squared"),
                ("Tracking Err", "tracking_error"),
                ("Info Ratio", "information_ratio"),
            ]
            results = []
            for lbl, ser in cols:
                if lbl == "Benchmark":
                    results.append({
                        "alpha": 0.0, "beta": 1.0, "r_squared": 1.0,
                        "tracking_error": 0.0, "information_ratio": 0.0
                    })
                else:
                    try:
                        results.append(calculate_capm_metrics(ser, benchmark_equity))
                    except Exception:
                        results.append({})
            header = "".join(f"<th>{lbl}</th>" for lbl, _ in cols)
            body_lines = []
            for row_lbl, key in capm_rows:
                body_lines.append(
                    "<tr><td>{}</td>{}</tr>".format(
                        row_lbl,
                        "".join(f"<td>{_format_metric(r.get(key), key)}</td>" for r in results)
                    )
                )
            capm_block = f"""
    <div class="box">
      <h2>CAPM</h2>
      <table class="cmp">
        <thead><tr><th>Metric</th>{header}</tr></thead>
        <tbody>{''.join(body_lines)}</tbody>
      </table>
    </div>
    """
        except Exception:
            capm_block = ""

    # -------- Main equity chart embed (or none) --------
    if make_charts_flag and chart_path and os.path.exists(chart_path):
        chart_embed = f"<iframe src='{os.path.relpath(chart_path, out_dir)}' class='chart-frame'></iframe>"
    else:
        chart_embed = ""  # no placeholder when disabled; silent removal

    # -------- Subcharts (only if charts enabled) --------
    subcharts_row_html = ""
    if make_charts_flag:
        subcharts = []

        # Drawdown
        try:
            def _dd_series(series):
                a = series.astype(float).to_numpy()
                if a.size == 0:
                    return []
                rm = _np.maximum.accumulate(a)
                return (a / rm) - 1.0

            dates = [d.isoformat() for d in equity.index]
            dates_json = _json.dumps(dates)

            dd_traces = []

            strat_dd = _dd_series(equity)
            dd_traces.append(f"""{{
              "x":{dates_json},
              "y":{_json.dumps([float(v) for v in strat_dd])},
              "name":"Strategy DD",
              "mode":"lines",
              "line":{{"width":1,"color":"rgba(0,0,0,0)"}},
              "fill":"tozeroy",
              "fillcolor":"rgba(11,109,47,0.50)",
              "hovertemplate":"Date=%{{x}}<br>Strategy DD=%{{y:.2%}}<extra></extra>"
            }}""")

            if bench_enabled:
                b_dd = _dd_series(benchmark_equity.reindex(equity.index).ffill())
                dd_traces.append(f"""{{
                  "x":{dates_json},
                  "y":{_json.dumps([float(v) for v in b_dd])},
                  "name":"Benchmark DD",
                  "mode":"lines",
                  "line":{{"width":1,"color":"#444"}},
                  "fill":"tozeroy",
                  "fillcolor":"rgba(80,80,80,0.55)",
                  "hovertemplate":"Date=%{{x}}<br>Benchmark DD=%{{y:.2%}}<extra></extra>"
                }}""")

            if bh_enabled:
                h_dd = _dd_series(buyhold_equity.reindex(equity.index).ffill())
                dd_traces.append(f"""{{
                  "x":{dates_json},
                  "y":{_json.dumps([float(v) for v in h_dd])},
                  "name":"Buy & Hold DD",
                  "mode":"lines",
                  "line":{{"width":1,"color":"#bbb"}},
                  "fill":"tozeroy",
                  "fillcolor":"rgba(230,230,230,0.30)",
                  "hovertemplate":"Date=%{{x}}<br>BuyHold DD=%{{y:.2%}}<extra></extra>"
                }}""")

            dd_layout = _json.dumps({
                "margin": {"l": 45, "r": 15, "t": 25, "b": 35},
                "yaxis": {"tickformat": ".0%", "title": "Drawdown",
                          "titlefont": {"color": "#eee"}, "tickfont": {"color": "#eee"}},
                "xaxis": {"showgrid": False, "tickfont": {"color": "#eee"}},
                "hovermode": "x unified",
                "legend": {"orientation": "h", "y": -0.24,
                           "font": {"color": "#eee", "size": 10}},
                "paper_bgcolor": "#1c1c1c",
                "plot_bgcolor": "#1c1c1c"
            })
            dd_script = (
                f"Plotly.newPlot('dd_multi', [{','.join(dd_traces)}], "
                f"{dd_layout}, {{responsive:true,displayModeBar:false}});"
            )
            subcharts.append(("dd_multi", dd_script, "Drawdown Overlay"))
        except Exception:
            pass  # safe fail

        # Vol-matched helper
        def _vol_match(label, other_series, dom_id):
            try:
                a_other = other_series.reindex(equity.index).ffill()
                rs = equity.pct_change().dropna()
                ro = a_other.pct_change().dropna()
                common = rs.index.intersection(ro.index)
                if len(common) < 10:
                    return
                rs = rs.loc[common]
                ro = ro.loc[common]
                if ro.std() == 0:
                    return
                scale = rs.std() / ro.std()
                ro_scaled = ro * scale
                base = float(equity.loc[common[0]])
                strat_curve = (1 + rs).cumprod() * base
                other_curve = (1 + ro_scaled).cumprod() * base
                xj = _json.dumps([d.isoformat() for d in common])
                ys = _json.dumps([float(v) for v in strat_curve])
                yo = _json.dumps([float(v) for v in other_curve])
                layout_vm = _json.dumps({
                    "margin": {"l": 50, "r": 15, "t": 25, "b": 35},
                    "hovermode": "x unified",
                    "legend": {"orientation": "h", "y": -0.24,
                               "font": {"size": 10, "color": "#eee"}},
                    "paper_bgcolor": "#1c1c1c",
                    "plot_bgcolor": "#1c1c1c",
                    "xaxis": {"tickfont": {"color": "#eee"}},
                    "yaxis": {"tickfont": {"color": "#eee"}}
                })
                script = f"""
Plotly.newPlot('{dom_id}', [
  {{"x":{xj},"y":{ys},"type":"scatter","mode":"lines","name":"Strategy",
    "line":{{"color":"#0b6d2f","width":2}},
    "hovertemplate":"Date=%{{x}}<br>Strategy=%{{y:.2f}}<extra></extra>"}},
  {{"x":{xj},"y":{yo},"type":"scatter","mode":"lines","name":"{label} (vol-matched)",
    "line":{{"color":"#aaa","width":1.5}},
    "hovertemplate":"Date=%{{x}}<br>{label} VM=%{{y:.2f}}<extra></extra>"}}
], {layout_vm}, {{responsive:true,displayModeBar:false}});
"""
                subcharts.append((dom_id, script, f"Vol-Matched {label}"))
            except Exception:
                return

        if bench_enabled:
            _vol_match("Benchmark", benchmark_equity, "vol_bench")
        if bh_enabled:
            _vol_match("Buy & Hold", buyhold_equity, "vol_bh")

        if subcharts:
            boxes, scripts = [], []
            for dom_id, script, title_txt in subcharts:
                boxes.append(f"""
<div class="sub-chart">
  <h3>{title_txt}</h3>
  <div id="{dom_id}" class="mini-chart"></div>
</div>""")
                scripts.append(script)
            subcharts_row_html = f"""
<div class="sub-charts-row">
  {''.join(boxes)}
</div>
<script>
{''.join(scripts)}
</script>
"""

    # -------- Final values & HTML --------
    metric_val_fmt = _format_metric(metric_value, metric)
    right_col = f"""
  <div class="right-col">
    {chart_embed}
  </div>""" if make_charts_flag and chart_embed else ""

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>{symbol} {metric} rank {rank}</title>
<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
<style>
body {{background:#111;color:#eee;font-family:Arial,sans-serif;margin:0;padding:1rem 1.25rem;}}
h1 {{margin:0 0 .6rem;font-size:1.05rem;}}
h2 {{margin:0 0 .4rem;font-size:.8rem;letter-spacing:.5px;font-weight:600;}}
h3 {{margin:0 0 .35rem;font-size:.7rem;font-weight:600;letter-spacing:.5px;}}
.meta span {{margin-right:1rem;font-size:.62rem;color:#bbb;display:inline-block;}}
.layout-top {{display:flex;flex-wrap:nowrap;gap:1rem;align-items:flex-start;}}
.left-col {{flex:0 0 340px;display:flex;flex-direction:column;gap:.9rem;}}
.right-col {{flex:1 1 auto;min-width:460px;display:flex;flex-direction:column;}}
.chart-frame {{width:100%;height:500px;border:1px solid #222;border-radius:6px;background:#000;}}
.box {{background:#1c1c1c;border:1px solid #222;padding:.6rem .7rem;border-radius:6px;box-sizing:border-box;overflow:hidden;}}
table {{width:100%;border-collapse:collapse;font-size:.66rem;}}
td,th {{padding:3px 5px;border-bottom:1px solid #2a2a2a;text-align:right;white-space:nowrap;}}
td:first-child,th:first-child {{text-align:left;}}
table.cmp th {{font-weight:600;}}
.param {{color:#ffcc66;font-weight:600;}}
.sub-charts-row {{display:flex;gap:1rem;margin-top:1rem;}}
.sub-chart {{flex:1 1 0;background:#1c1c1c;border:1px solid #222;padding:.55rem .6rem;border-radius:6px;box-sizing:border-box;overflow:hidden;min-width:0;}}
.mini-chart {{height:260px;border:1px solid #222;border-radius:6px;background:#000;}}
</style>
</head>
<body>
<h1>{symbol} | {metric} rank {rank}</h1>
<div class="meta">
  <span>Run: {run_id}</span>
  <span>Metric value: {metric_val_fmt}</span>
  <span class="param">{pstr}</span>
</div>
<div class="layout-top">
  <div class="left-col">
    <div class="box">
      <h2>Strategy Metrics</h2>
      <table>{metric_rows}</table>
    </div>
    {compare_table}
    {capm_block}
  </div>{right_col}
</div>
{subcharts_row_html}
</body>
</html>
"""
    path = os.path.join(out_dir, f"{run_id}_{symbol}_{metric}_rank{rank}.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path

def portfolio_tearsheet(run_id: str,
                        equity: "pd.Series",
                        buyhold_equity: "pd.Series | None",
                        benchmark_equity: "pd.Series | None",
                        per_ticker_equity: "dict[str,pd.Series]",
                        metrics: dict,
                        weights: dict,
                        trades: "list[dict]",
                        out_dir: str,
                        chart_enabled: bool = True) -> str:
    import os, json as _json, numpy as _np
    from .settings import get
    from .metrics import kpis_from_equity
    os.makedirs(out_dir, exist_ok=True)

    make_charts_flag = bool(get("MAKE_CHARTS", True)) and chart_enabled
    run_capm = bool(get("RUN_CAPM", False)) and benchmark_equity is not None
    bench_enabled = benchmark_equity is not None and bool(get("BENCHMARK_ENABLED", False))
    bh_enabled = buyhold_equity is not None and bool(get("BUY_HOLD_ENABLED", True))

    # ---- Metrics table (reuse same fields as per_strategy) ----
    metric_fields = [
        ("Total Return","total_return"),
        ("CAGR","cagr"),
        ("Sharpe","sharpe"),
        ("Sortino","sortino"),
        ("Vol","vol"),
        ("Max DD","maxdd"),
        ("Win Rate","win_rate"),
        ("Net Win Rate","net_win_rate"),
        ("Avg Trade PnL","avg_trade_pnl"),
        ("Trades","trades_total"),
    ]
    metric_rows = "".join(f"<tr><td>{lbl}</td><td>{_format_metric(metrics.get(k), k)}</td></tr>"
                          for lbl,k in metric_fields)

    # ---- Comparison table (Portfolio / Benchmark / Buy&Hold) ----
    compare_table = ""
    if bench_enabled or bh_enabled:
        cols = [("Portfolio", equity)]
        if bench_enabled: cols.append(("Benchmark", benchmark_equity))
        if bh_enabled: cols.append(("Buy & Hold", buyhold_equity))
        comp_map = [
            ("Total Return","total_return"),
            ("CAGR","cagr"),
            ("Sharpe","sharpe"),
            ("Sortino","sortino"),
            ("Vol","vol"),
            ("Max DD","maxdd"),
        ]
        klist = []
        for lbl, ser in cols:
            try: klist.append((lbl, kpis_from_equity(ser)))
            except Exception: klist.append((lbl, {}))
        header = "".join(f"<th>{lbl}</th>" for lbl,_ in klist)
        body = []
        for row_lbl, key in comp_map:
            body.append("<tr><td>{}</td>{}</tr>".format(
                row_lbl,
                "".join(f"<td>{_format_metric(k.get(key), key)}</td>" for _,k in klist)
            ))
        compare_table = f"""
    <div class="box">
      <h2>Comparison</h2>
      <table class="cmp">
        <thead><tr><th>Metric</th>{header}</tr></thead>
        <tbody>{''.join(body)}</tbody>
      </table>
    </div>"""

    # ---- CAPM ----
    capm_block = ""
    if run_capm:
        try:
            from .capm import calculate_capm_metrics
            cols = [("Portfolio", equity), ("Benchmark", benchmark_equity)]
            if bh_enabled: cols.append(("Buy & Hold", buyhold_equity))
            rows_map = [
                ("Alpha (ann)","alpha"),
                ("Beta","beta"),
                ("R²","r_squared"),
                ("Tracking Err","tracking_error"),
                ("Info Ratio","information_ratio"),
            ]
            results = []
            for lbl, ser in cols:
                if lbl == "Benchmark":
                    results.append({"alpha":0,"beta":1,"r_squared":1,"tracking_error":0,"information_ratio":0})
                else:
                    try: results.append(calculate_capm_metrics(ser, benchmark_equity))
                    except Exception: results.append({})
            header = "".join(f"<th>{lbl}</th>" for lbl,_ in cols)
            body_lines = []
            for rl,key in rows_map:
                body_lines.append("<tr><td>{}</td>{}</tr>".format(
                    rl, "".join(f"<td>{_format_metric(r.get(key), key)}</td>" for r in results)
                ))
            capm_block = f"""
    <div class="box">
      <h2>CAPM</h2>
      <table class="cmp">
        <thead><tr><th>Metric</th>{header}</tr></thead>
        <tbody>{''.join(body_lines)}</tbody>
      </table>
    </div>"""
        except Exception:
            capm_block = ""

    # ---- Per-ticker allocation table ----
    final_port_val = float(equity.iloc[-1])
    pt_rows = []
    for t, ser in per_ticker_equity.items():
        first_val = float(ser.iloc[0])
        final_val = float(ser.iloc[-1])
        tgt_w = weights.get(t, 0.0)
        contrib = (final_val / final_port_val) if final_port_val else 0
        ret = (final_val / first_val - 1) if first_val else 0
        pt_rows.append(
            f"<tr><td>{t}</td><td>{tgt_w:.2%}</td>"
            f"<td>{final_val:,.2f}</td><td>{contrib:.2%}</td><td>{ret:.2%}</td></tr>"
        )
    per_ticker_table = f"""
    <div class="box">
      <h2>Per-Ticker</h2>
      <table>
        <thead><tr><th>Ticker</th><th>Target W</th><th>Final Value</th><th>Contribution</th><th>Return*</th></tr></thead>
        <tbody>{''.join(pt_rows)}</tbody>
      </table>
      <div class="note">*Return based on series value change (not cost basis).</div>
    </div>"""

    # ---- Trades table ----
    trade_rows = []
    if trades and len(trades) > 0:
        for tr in trades:
            dt = tr.get("date")
            if hasattr(dt, "isoformat"): dt = dt.isoformat()
            elif hasattr(dt, "strftime"): dt = dt.strftime("%Y-%m-%d")
            pnl = tr.get('pnl')
            pnl_str = f"${pnl:.2f}" if pnl is not None else "N/A"
            trade_rows.append(
                f"<tr><td>{dt}</td><td>{tr.get('ticker')}</td><td>{tr.get('side')}</td>"
                f"<td>{tr.get('shares')}</td><td>${tr.get('price', 0):.2f}</td>"
                f"<td>${tr.get('fees',0):.2f}</td><td>{pnl_str}</td></tr>"
            )
    
    trades_content = ''.join(trade_rows) if trade_rows else '<tr><td colspan="7" style="text-align:center;color:#888;">No trades executed</td></tr>'
    
    trades_table = f"""
    <div class="box">
      <h2>Trades ({len(trades) if trades else 0})</h2>
      <div class="trades-wrap">
        <table class="trades">
          <thead><tr><th>Date</th><th>Sym</th><th>Side</th><th>Qty</th><th>Price</th><th>Fees</th><th>PnL</th></tr></thead>
          <tbody>{trades_content}</tbody>
        </table>
      </div>
    </div>"""

    # ---- Main Chart ----
    chart_embed = ""
    if make_charts_flag:
        import plotly.graph_objects as go
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=equity.index, y=equity.values, name="Portfolio",
                                 mode="lines", line=dict(color="#0b6d2f", width=2)))
        if bench_enabled:
            fig.add_trace(go.Scatter(x=benchmark_equity.index, y=benchmark_equity.values, name="Benchmark",
                                     mode="lines", line=dict(color="#888", width=1.5)))
        if bh_enabled:
            fig.add_trace(go.Scatter(x=buyhold_equity.index, y=buyhold_equity.values, name="Buy & Hold",
                                     mode="lines", line=dict(color="#ffffff", width=1.2)))
        fig.update_layout(
            title="Portfolio Equity",
            title_x=0.5,
            template="plotly_dark",
            hovermode="x unified",
            legend=dict(orientation="h", y=-0.18, font=dict(size=10)),
            margin=dict(l=55,r=20,t=55,b=60)
        )
        chart_embed = f"<div class='chart-frame'>{fig.to_html(include_plotlyjs='cdn', full_html=False)}</div>"

    # ---- Subcharts (drawdown + vol-match) ----
    subcharts_row_html = ""
    if make_charts_flag:
        subcharts = []
        try:
            def _dd_series(series):
                a = series.astype(float).to_numpy()
                if a.size == 0: return []
                rm = _np.maximum.accumulate(a)
                return (a / rm) - 1
            dates = [d.isoformat() for d in equity.index]
            dates_json = _json.dumps(dates)
            dd_traces = []
            dd_traces.append(f"""{{
              "x":{dates_json},
              "y":{_json.dumps([float(v) for v in _dd_series(equity)])},
              "name":"Portfolio DD","mode":"lines",
              "line":{{"width":1,"color":"rgba(0,0,0,0)"}},
              "fill":"tozeroy","fillcolor":"rgba(11,109,47,0.45)",
              "hovertemplate":"Date=%{{x}}<br>Portfolio DD=%{{y:.2%}}<extra></extra>"
            }}""")
            if bench_enabled:
                bench_dd = _dd_series(benchmark_equity.reindex(equity.index).ffill())
                dd_traces.append(f"""{{
                  "x":{dates_json},
                  "y":{_json.dumps([float(v) for v in bench_dd])},
                  "name":"Benchmark DD","mode":"lines",
                  "line":{{"width":1,"color":"#555"}},
                  "fill":"tozeroy","fillcolor":"rgba(90,90,90,0.55)",
                  "hovertemplate":"Date=%{{x}}<br>Benchmark DD=%{{y:.2%}}<extra></extra>"
                }}""")
            if bh_enabled:
                bh_dd = _dd_series(buyhold_equity.reindex(equity.index).ffill())
                dd_traces.append(f"""{{
                  "x":{dates_json},
                  "y":{_json.dumps([float(v) for v in bh_dd])},
                  "name":"Buy & Hold DD","mode":"lines",
                  "line":{{"width":1,"color":"#bbb"}},
                  "fill":"tozeroy","fillcolor":"rgba(240,240,240,0.30)",
                  "hovertemplate":"Date=%{{x}}<br>BH DD=%{{y:.2%}}<extra></extra>"
                }}""")
            dd_layout = _json.dumps({
                "margin":{"l":45,"r":15,"t":25,"b":35},
                "yaxis":{"tickformat":".0%","title":"Drawdown",
                         "titlefont":{"color":"#eee"},"tickfont":{"color":"#eee"}},
                "xaxis":{"showgrid":False,"tickfont":{"color":"#eee"}},
                "hovermode":"x unified",
                "legend":{"orientation":"h","y":-0.24,"font":{"color":"#eee","size":10}},
                "paper_bgcolor":"#1c1c1c","plot_bgcolor":"#1c1c1c"
            })
            dd_script = f"Plotly.newPlot('dd_multi', [{','.join(dd_traces)}], {dd_layout}, {{responsive:true,displayModeBar:false}});"
            subcharts.append(("dd_multi", dd_script, "Drawdown Overlay"))
        except Exception:
            pass

        def _vol_match(label, other_series, dom_id):
            try:
                oth = other_series.reindex(equity.index).ffill()
                rs = equity.pct_change().dropna()
                ro = oth.pct_change().dropna()
                common = rs.index.intersection(ro.index)
                if len(common) < 10: return
                rs = rs.loc[common]; ro = ro.loc[common]
                if ro.std() == 0: return
                scale = rs.std() / ro.std()
                ro_scaled = ro * scale
                base = float(equity.loc[common[0]])
                strat_curve = (1+rs).cumprod()*base
                other_curve = (1+ro_scaled).cumprod()*base
                xj = _json.dumps([d.isoformat() for d in common])
                ys = _json.dumps([float(v) for v in strat_curve])
                yo = _json.dumps([float(v) for v in other_curve])
                layout_vm = _json.dumps({
                    "margin":{"l":50,"r":15,"t":25,"b":35},
                    "hovermode":"x unified",
                    "legend":{"orientation":"h","y":-0.24,"font":{"size":10,"color":"#eee"}},
                    "paper_bgcolor":"#1c1c1c","plot_bgcolor":"#1c1c1c",
                    "xaxis":{"tickfont":{"color":"#eee"}},
                    "yaxis":{"tickfont":{"color":"#eee"}}
                })
                script = f"""
Plotly.newPlot('{dom_id}', [
  {{"x":{xj},"y":{ys},"type":"scatter","mode":"lines","name":"Portfolio",
    "line":{{"color":"#0b6d2f","width":2}},
    "hovertemplate":"Date=%{{x}}<br>Portfolio=%{{y:.2f}}<extra></extra>"}},
  {{"x":{xj},"y":{yo},"type":"scatter","mode":"lines","name":"{label} (vol-matched)",
    "line":{{"color":"#aaa","width":1.5}},
    "hovertemplate":"Date=%{{x}}<br>{label} VM=%{{y:.2f}}<extra></extra>"}}
], {layout_vm}, {{responsive:true,displayModeBar:false}});
"""
                subcharts.append((dom_id, script, f"Vol-Matched {label}"))
            except Exception:
                return

        if bench_enabled: _vol_match("Benchmark", benchmark_equity, "vol_bench")
        if bh_enabled: _vol_match("Buy & Hold", buyhold_equity, "vol_bh")

        if subcharts:
            boxes = []
            scripts = []
            for dom_id, script, ttl in subcharts:
                boxes.append(f"""
<div class="sub-chart">
  <h3>{ttl}</h3>
  <div id="{dom_id}" class="mini-chart"></div>
</div>""")
                scripts.append(script)
            subcharts_row_html = f"""
<div class="sub-charts-row">
  {''.join(boxes)}
</div>
<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
<script>
{''.join(scripts)}
</script>
"""

    # ---- Right column ----
    right_col = f"""
  <div class="right-col">
    {chart_embed}
    {subcharts_row_html}
  </div>""" if make_charts_flag else ""

    # ---- Weights summary string ----
    w_summary = ", ".join(f"{k}:{v:.0%}" for k,v in weights.items())

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Portfolio Tearsheet {run_id}</title>
<style>
body {{background:#111;color:#eee;font-family:Arial,sans-serif;margin:0;padding:1rem 1.25rem;}}
h1 {{margin:0 0 .6rem;font-size:1.05rem;}}
h2 {{margin:0 0 .4rem;font-size:.8rem;letter-spacing:.5px;font-weight:600;}}
h3 {{margin:0 0 .35rem;font-size:.7rem;font-weight:600;letter-spacing:.5px;}}
.meta span {{margin-right:1rem;font-size:.62rem;color:#bbb;display:inline-block;}}
.layout-top {{display:flex;flex-wrap:nowrap;gap:1rem;align-items:flex-start;}}
.left-col {{flex:0 0 360px;display:flex;flex-direction:column;gap:.9rem;}}
.right-col {{flex:1 1 auto;min-width:460px;display:flex;flex-direction:column;gap:1rem;}}
.chart-frame {{width:100%;height:500px;border:1px solid #222;border-radius:6px;background:#000;}}
.box {{background:#1c1c1c;border:1px solid #222;padding:.6rem .7rem;border-radius:6px;box-sizing:border-box;overflow:hidden;}}
table {{width:100%;border-collapse:collapse;font-size:.66rem;}}
td,th {{padding:3px 5px;border-bottom:1px solid #2a2a2a;text-align:right;white-space:nowrap;}}
td:first-child,th:first-child {{text-align:left;}}
table.cmp th {{font-weight:600;}}
.note {{font-size:.55rem;color:#777;margin-top:.35rem;}}
.trades-wrap {{max-height:260px;overflow:auto;margin-top:.4rem;border:1px solid #222;border-radius:4px;}}
.trades thead th {{position:sticky;top:0;background:#222;}}
.sub-charts-row {{display:flex;gap:1rem;margin-top:1rem;}}
.sub-chart {{flex:1 1 0;background:#1c1c1c;border:1px solid #222;padding:.55rem .6rem;border-radius:6px;box-sizing:border-box;overflow:hidden;min-width:0;}}
.mini-chart {{height:260px;border:1px solid #222;border-radius:6px;background:#000;}}
</style>
</head>
<body>
<h1>Portfolio Tearsheet</h1>
<div class="meta">
  <span>Run: {run_id}</span>
  <span>Weights: {w_summary}</span>
  <span>Total Return: {_format_metric(metrics.get('total_return'), 'total_return')}</span>
  <span>Sharpe: {_format_metric(metrics.get('sharpe'), 'sharpe')}</span>
</div>
<div class="layout-top">
  <div class="left-col">
    <div class="box">
      <h2>Portfolio Metrics</h2>
      <table>{metric_rows}</table>
    </div>
    {compare_table}
    {capm_block}
    {per_ticker_table}
    {trades_table}
  </div>{right_col}
</div>
</body>
</html>
"""
    path = os.path.join(out_dir, f"{run_id}_portfolio.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path