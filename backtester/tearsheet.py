from __future__ import annotations
import pandas as pd
from typing import Optional, List, Dict, Any
from .charts import equity_chart_html
from .metrics import kpis_from_equity
from .capm import calculate_capm_metrics  # already present earlier
from .settings import get
import json
import numpy as np

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
    os.makedirs(out_dir, exist_ok=True)

    pstr = f"p={params.get('rsi_period')} b={params.get('rsi_buy_below')} s={params.get('rsi_sell_above')}"
    def _fmt(v):
        if v is None: return "-"
        if isinstance(v, (int, float)): return f"{v:.4f}"
        return str(v)

    # Strategy metrics table
    fields = [
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
    metric_rows = "".join(f"<tr><td>{lbl}</td><td>{_fmt(metrics_dict.get(k))}</td></tr>" for lbl, k in fields)

    # Main equity chart iframe
    if chart_path and os.path.exists(chart_path):
        rel = os.path.relpath(chart_path, out_dir)
        chart_embed = f"<iframe src='{rel}' class='chart-frame'></iframe>"
    else:
        chart_embed = "<div style='color:#aaa;font-size:0.75rem;'>Chart not available.</div>"

    bench_enabled = bool(get("BENCHMARK_ENABLED", False)) and benchmark_equity is not None
    bh_enabled = bool(get("BUY_HOLD_ENABLED", False)) and buyhold_equity is not None

    # Comparison table (Strategy / Benchmark / Buy & Hold)
    compare_table = ""
    comp_cols = [("Strategy", equity)]
    if bench_enabled: comp_cols.append(("Benchmark", benchmark_equity))
    if bh_enabled: comp_cols.append(("Buy & Hold", buyhold_equity))
    if len(comp_cols) > 1:
        from .metrics import kpis_from_equity
        comp_fields = [
            ("Total Return", "total_return"),
            ("CAGR", "cagr"),
            ("Sharpe", "sharpe"),
            ("Sortino", "sortino"),
            ("Vol", "vol"),
            ("Max DD", "maxdd"),
        ]
        comp_data = []
        for label, ser in comp_cols:
            try:
                km = kpis_from_equity(ser)
            except Exception:
                km = {}
            comp_data.append((label, km))
        header_row = "".join(f"<th>{lab}</th>" for lab, _ in comp_data)
        body_rows = []
        for row_lbl, key in comp_fields:
            cells = "".join(f"<td>{_fmt(km.get(key))}</td>" for _, km in comp_data)
            body_rows.append(f"<tr><td>{row_lbl}</td>{cells}</tr>")
        compare_table = f"""
<div class="box">
  <h2>Comparison</h2>
  <table class="cmp">
    <thead><tr><th>Metric</th>{header_row}</tr></thead>
    <tbody>{''.join(body_rows)}</tbody>
  </table>
</div>
"""

    # CAPM multi-column
    capm_block = ""
    if get("RUN_CAPM", False) and bench_enabled:
        capm_cols = [("Strategy", equity), ("Benchmark", benchmark_equity)]
        if bh_enabled:
            capm_cols.append(("Buy & Hold", buyhold_equity))
        capm_rows_map = [
            ("Alpha (ann)", "alpha"),
            ("Beta", "beta"),
            ("R²", "r_squared"),
            ("Tracking Err", "tracking_error"),
            ("Info Ratio", "information_ratio"),
        ]
        col_results = []
        for label, ser in capm_cols:
            try:
                if label == "Benchmark":
                    col_results.append({
                        "alpha": 0.0, "beta": 1.0, "r_squared": 1.0,
                        "tracking_error": 0.0, "information_ratio": 0.0
                    })
                else:
                    from .capm import calculate_capm_metrics
                    col_results.append(calculate_capm_metrics(ser, benchmark_equity))
            except Exception:
                col_results.append({})
        header = "".join(f"<th>{lab}</th>" for lab, _ in capm_cols)
        body = []
        for lbl, key in capm_rows_map:
            cells = "".join(f"<td>{_fmt(r.get(key))}</td>" for r in col_results)
            body.append(f"<tr><td>{lbl}</td>{cells}</tr>")
        capm_block = f"""
<div class="box">
  <h2>CAPM</h2>
  <table class="cmp">
    <thead><tr><th>Metric</th>{header}</tr></thead>
    <tbody>{''.join(body)}</tbody>
  </table>
</div>
"""

    # Helper for drawdown series
    def _dd_series(series):
        a = series.astype(float).to_numpy()
        if a.size == 0:
            return []
        run_max = _np.maximum.accumulate(a)
        return (a / run_max) - 1.0

    date_json = _json.dumps([d.isoformat() for d in equity.index])

    # Drawdown trace(s)
    subcharts = []  # will hold dicts {id, script, title}
    try:
        dd_traces = []
        # Strategy
        strat_dd = _dd_series(equity)
        dd_traces.append(f"""{{
          x:{date_json},
          y:{_json.dumps([float(v) for v in strat_dd])},
          name:'Strategy DD',
          mode:'lines',
          line:{{width:1,color:'rgba(0,0,0,0)'}},
          fill:'tozeroy',
          fillcolor:'rgba(11,109,47,0.50)',
          hovertemplate:'Date=%{{x}}<br>Strategy DD=%{{y:.2%}}<extra></extra>'
        }}""")
        if bench_enabled:
            b_aligned = benchmark_equity.reindex(equity.index).ffill()
            b_dd = _dd_series(b_aligned)
            dd_traces.append(f"""{{
              x:{date_json},
              y:{_json.dumps([float(v) for v in b_dd])},
              name:'Benchmark DD',
              mode:'lines',
              line:{{width:1,color:'#444'}},
              fill:'tozeroy',
              fillcolor:'rgba(80,80,80,0.55)',
              hovertemplate:'Date=%{{x}}<br>Benchmark DD=%{{y:.2%}}<extra></extra>'
            }}""")
        if bh_enabled:
            h_aligned = buyhold_equity.reindex(equity.index).ffill()
            h_dd = _dd_series(h_aligned)
            dd_traces.append(f"""{{
              x:{date_json},
              y:{_json.dumps([float(v) for v in h_dd])},
              name:'Buy & Hold DD',
              mode:'lines',
              line:{{width:1,color:'#bbb'}},
              fill:'tozeroy',
              fillcolor:'rgba(230,230,230,0.30)',
              hovertemplate:'Date=%{{x}}<br>BuyHold DD=%{{y:.2%}}<extra></extra>'
            }}""")
        subcharts.append((
            "dd_multi",
            f"Plotly.newPlot('dd_multi', [{','.join(dd_traces)}], {{margin:{{l:45,r:15,t:25,b:35}},yaxis:{{tickformat:'.0%',title:'Drawdown',titlefont:{{color:'#eee'}},tickfont:{{color:'#eee'}}}},xaxis:{{showgrid:false,tickfont:{{color:'#eee'}}}},hovermode:'x unified',legend:{{orientation:'h',y:-0.24,font:{{color:'#eee',size:10}}}},paper_bgcolor:'#1c1c1c',plot_bgcolor:'#1c1c1c'}}, {{responsive:true,displayModeBar:false}});",
            "Drawdown Overlay"
        ))
    except Exception:
        pass

    # Vol-matched charts
    def _vol_match(label, other_series, dom_id):
        a_other = other_series.reindex(equity.index).ffill()
        rs = equity.pct_change().dropna()
        ro = a_other.pct_change().dropna()
        common = rs.index.intersection(ro.index)
        if len(common) < 10: return
        rs = rs.loc[common]; ro = ro.loc[common]
        if ro.std() == 0: return
        scale = rs.std() / ro.std()
        ro_scaled = ro * scale
        base = float(equity.loc[common[0]])
        strat_curve = (1 + rs).cumprod() * base
        other_curve = (1 + ro_scaled).cumprod() * base
        xj = _json.dumps([d.isoformat() for d in common])
        ys = _json.dumps([float(v) for v in strat_curve])
        yo = _json.dumps([float(v) for v in other_curve])
        script = f"""
Plotly.newPlot('{dom_id}', [
 {{"x":{xj},"y":{ys},"type":"scatter","mode":"lines","name":"Strategy","line":{{"color":"#0b6d2f","width":2}},"hovertemplate":"Date=%{{x}}<br>Strategy=%{{y:.2f}}<extra></extra>"}},
 {{"x":{xj},"y":{yo},"type":"scatter","mode":"lines","name":"{label} (vol-matched)","line":{{"color":"#aaa","width":1.5}},"hovertemplate":"Date=%{{x}}<br>{label} VM=%{{y:.2f}}<extra></extra>"}}
], {{"margin":{{"l":50,"r":15,"t":25,"b":35}},"hovermode":"x unified","legend":{{"orientation":"h","y":-0.24,"font":{{"size":10,"color":"#eee"}}}},"paper_bgcolor":"#1c1c1c","plot_bgcolor":"#1c1c1c","xaxis":{{"tickfont":{{"color":"#eee"}}}},"yaxis":{{"tickfont":{{"color":"#eee"}}}}}}, {{"responsive":true,"displayModeBar":false}});
"""
        subcharts.append((dom_id, script, f"Vol-Matched {label}"))

    if bench_enabled:
        _vol_match("Benchmark", benchmark_equity, "vol_bench")
    if bh_enabled:
        _vol_match("Buy & Hold", buyhold_equity, "vol_bh")

    # Build subcharts row (all three side-by-side if present)
    subcharts_row_html = ""
    if subcharts:
        boxes = []
        scripts = []
        for dom_id, script, title_txt in subcharts:
            boxes.append(f"""
<div class="sub-chart">
  <h3>{title_txt}</h3>
  <div id="{dom_id}" class="mini-chart"></div>
</div>
""")
            scripts.append(script)
        subcharts_row_html = f"""
<div class="sub-charts-row">
  {''.join(boxes)}
</div>
<script>
{''.join(scripts)}
</script>
"""

    metric_val_fmt = _fmt(metric_value)

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
  </div>
  <div class="right-col">
    {chart_embed}
  </div>
</div>
{subcharts_row_html}
</body>
</html>
"""
    path = os.path.join(out_dir, f"{run_id}_{symbol}_{metric}_rank{rank}.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path