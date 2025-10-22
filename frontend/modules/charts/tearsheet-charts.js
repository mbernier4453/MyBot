/**
 * Tearsheet Chart Display Module
 * Handles all tearsheet chart rendering (equity, drawdown, vol-matched, etc.)
 */

const TearsheetCharts = {
  /**
   * Display equity curve comparison chart
   * @param {Object} strategyEquity - Strategy equity curve {index, data, name}
   * @param {Object} buyholdEquity - Buy & hold equity curve
   * @param {Object} benchmarkEquity - Benchmark equity curve
   * @param {Array} events - Trade events to display as markers
   */
  displayEquityChart(strategyEquity, buyholdEquity, benchmarkEquity, events = []) {
    const traces = [];
    
    console.log('displayEquityChart called with:', {
      hasStrategy: !!strategyEquity,
      hasBuyHold: !!buyholdEquity,
      hasBenchmark: !!benchmarkEquity,
      eventsCount: events ? events.length : 0
    });
    
    // Strategy equity trace
    traces.push({
      x: strategyEquity.index,
      y: strategyEquity.data,
      type: 'scatter',
      mode: 'lines',
      name: strategyEquity.name || 'Strategy',
      line: { color: '#00aa55', width: 2.5 }
    });
    
    // Buy & Hold equity trace (same ticker)
    if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
      traces.push({
        x: buyholdEquity.index,
        y: buyholdEquity.data,
        type: 'scatter',
        mode: 'lines',
        name: buyholdEquity.name || 'Buy & Hold',
        line: { color: '#c8f0c8', width: 2.5 }
      });
    }
    
    // Benchmark equity trace (SPY)
    if (benchmarkEquity && benchmarkEquity.data && benchmarkEquity.data.length > 0) {
      traces.push({
        x: benchmarkEquity.index,
        y: benchmarkEquity.data,
        type: 'scatter',
        mode: 'lines',
        name: benchmarkEquity.name || 'Benchmark (SPY)',
        line: { color: '#808080', width: 2.5 }
      });
    }
    
    // Add trade markers
    if (events && events.length > 0) {
      // Create a map for faster lookup - need to normalize dates
      const equityMap = new Map();
      strategyEquity.index.forEach((dateStr, i) => {
        // Normalize to just date part (YYYY-MM-DD)
        const normalizedDate = new Date(dateStr).toISOString().split('T')[0];
        equityMap.set(normalizedDate, strategyEquity.data[i]);
      });
      
      // Convert trades to buy/sell events if needed
      let buyEvents = [];
      let sellEvents = [];
      
      events.forEach(trade => {
        if (trade.type === 'buy' || trade.type === 'sell') {
          // Already in events format
          if (trade.type === 'buy') buyEvents.push(trade);
          else sellEvents.push(trade);
        } else if (trade.entry_date || trade.exit_date) {
          // Trade format - convert to events
          if (trade.entry_date) {
            buyEvents.push({
              type: 'buy',
              ts: trade.entry_date,
              price: trade.entry_price,
              qty: trade.shares
            });
          }
          if (trade.exit_date) {
            sellEvents.push({
              type: 'sell',
              ts: trade.exit_date,
              price: trade.exit_price,
              qty: trade.shares
            });
          }
        }
      });
      
      console.log('Trade events:', { buyCount: buyEvents.length, sellCount: sellEvents.length });
      
      // Buy markers (green triangles pointing up)
      if (buyEvents.length > 0) {
        const buyX = [];
        const buyY = [];
        const buyText = [];
        const buyCustomdata = [];
        
        buyEvents.forEach(e => {
          const eventDate = new Date(e.ts).toISOString().split('T')[0];
          const equity = equityMap.get(eventDate);
          if (equity !== undefined) {
            buyX.push(e.ts);
            buyY.push(equity);
            buyText.push(e.qty || 0);
            buyCustomdata.push((e.price || 0).toFixed(2));
          }
        });
        
        if (buyX.length > 0) {
          traces.push({
            x: buyX,
            y: buyY,
            type: 'scatter',
            mode: 'markers',
            name: 'Buy',
            marker: {
              color: '#00cc55',
              size: 10,
              symbol: 'triangle-up',
              line: { color: '#ffffff', width: 1.5 }
            },
            hovertemplate: '<b>BUY</b><br>Date: %{x}<br>Qty: %{text}<br>Price: $%{customdata}<extra></extra>',
            text: buyText,
            customdata: buyCustomdata
          });
        }
      }
      
      // Sell markers (red triangles pointing down)
      if (sellEvents.length > 0) {
        const sellX = [];
        const sellY = [];
        const sellText = [];
        const sellCustomdata = [];
        
        sellEvents.forEach(e => {
          const eventDate = new Date(e.ts).toISOString().split('T')[0];
          const equity = equityMap.get(eventDate);
          if (equity !== undefined) {
            sellX.push(e.ts);
            sellY.push(equity);
            sellText.push(e.qty || 0);
            sellCustomdata.push((e.price || 0).toFixed(2));
          }
        });
        
        if (sellX.length > 0) {
          traces.push({
            x: sellX,
            y: sellY,
            type: 'scatter',
            mode: 'markers',
            name: 'Sell',
            marker: {
              color: '#ff4444',
              size: 10,
              symbol: 'triangle-down',
              line: { color: '#ffffff', width: 1.5 }
            },
            hovertemplate: '<b>SELL</b><br>Date: %{x}<br>Qty: %{text}<br>Price: $%{customdata}<extra></extra>',
            text: sellText,
            customdata: sellCustomdata
          });
        }
      }
    }
    
    const layout = {
      title: {
        text: 'Equity Curve Comparison',
        font: { color: '#e0e0e0', size: 18 }
      },
      xaxis: {
        title: 'Date',
        gridcolor: '#2a2a2a',
        griddash: 'dash',
        color: '#a0a0a0',
        showgrid: true
      },
      yaxis: {
        title: 'Portfolio Value ($)',
        gridcolor: '#2a2a2a',
        griddash: 'dash',
        color: '#a0a0a0',
        showgrid: true
      },
      plot_bgcolor: '#0a0a0a',
      paper_bgcolor: '#0a0a0a',
      font: { color: '#e0e0e0' },
      hovermode: 'closest',
      legend: {
        x: 0.01,
        y: 0.99,
        bgcolor: 'rgba(10, 10, 10, 0.9)',
        bordercolor: '#3e3e42',
        borderwidth: 1,
        font: { size: 12 }
      },
      margin: { l: 70, r: 40, t: 60, b: 60 },
      height: 550
    };
    
    window.addWatermark(layout);
    
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      scrollZoom: true
    };
    
    Plotly.newPlot('equityChart', traces, layout, config);
  },

  /**
   * Display volatility-matched comparison chart
   * Scales comparison equity to match strategy volatility
   */
  displayVolMatchedChart(strategyEquity, comparisonEquity, chartElementId, comparisonName) {
    if (!comparisonEquity || !comparisonEquity.data || comparisonEquity.data.length === 0) {
      document.getElementById(chartElementId).innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Data not available</div>';
      return;
    }
    
    // Calculate returns
    const stratReturns = [];
    const compReturns = [];
    const dates = [];
    
    for (let i = 1; i < strategyEquity.data.length; i++) {
      const stratRet = (strategyEquity.data[i] - strategyEquity.data[i-1]) / strategyEquity.data[i-1];
      const compRet = (comparisonEquity.data[i] - comparisonEquity.data[i-1]) / comparisonEquity.data[i-1];
      
      if (!isNaN(stratRet) && !isNaN(compRet) && isFinite(stratRet) && isFinite(compRet)) {
        stratReturns.push(stratRet);
        compReturns.push(compRet);
        dates.push(strategyEquity.index[i]);
      }
    }
    
    // Calculate vol-matched returns (scale comparison to match strategy vol)
    const stratVol = Math.sqrt(stratReturns.reduce((sum, r) => sum + r * r, 0) / stratReturns.length);
    const compVol = Math.sqrt(compReturns.reduce((sum, r) => sum + r * r, 0) / compReturns.length);
    const scaleFactor = compVol > 0 ? stratVol / compVol : 1;
    
    const volMatchedReturns = compReturns.map(r => r * scaleFactor);
    
    // Cumulative returns
    let stratCum = [100000];
    let compCum = [100000];
    
    for (let i = 0; i < stratReturns.length; i++) {
      stratCum.push(stratCum[stratCum.length - 1] * (1 + stratReturns[i]));
      compCum.push(compCum[compCum.length - 1] * (1 + volMatchedReturns[i]));
    }
    
    const traces = [
      {
        x: [strategyEquity.index[0], ...dates],
        y: stratCum,
        type: 'scatter',
        mode: 'lines',
        name: 'Strategy',
        line: { color: '#00aa55', width: 2 }
      },
      {
        x: [strategyEquity.index[0], ...dates],
        y: compCum,
        type: 'scatter',
        mode: 'lines',
        name: `${comparisonName} (Vol-Matched)`,
        line: { color: comparisonName.includes('Benchmark') ? '#808080' : '#c8f0c8', width: 2 }
      }
    ];
    
    const layout = {
      xaxis: { showticklabels: false, gridcolor: '#2a2a2a', griddash: 'dash', color: '#a0a0a0' },
      yaxis: { gridcolor: '#2a2a2a', griddash: 'dash', color: '#a0a0a0', showticklabels: true },
      plot_bgcolor: '#0a0a0a',
      paper_bgcolor: '#0a0a0a',
      font: { color: '#e0e0e0', size: 10 },
      margin: { l: 45, r: 10, t: 10, b: 25 },
      showlegend: true,
      legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(10, 10, 10, 0.8)' },
      hovermode: 'x unified'
    };
    
    window.addWatermark(layout);
    
    Plotly.newPlot(chartElementId, traces, layout, { displayModeBar: false, responsive: true, scrollZoom: true });
  },

  /**
   * Display drawdown comparison chart
   */
  displayDrawdownChart(strategyEquity, buyholdEquity, benchmarkEquity) {
    const calculateDrawdown = (equity) => {
      const drawdown = [];
      let peak = equity.data[0];
      
      for (let i = 0; i < equity.data.length; i++) {
        if (equity.data[i] > peak) peak = equity.data[i];
        const dd = (equity.data[i] - peak) / peak;
        drawdown.push(dd);
      }
      
      return drawdown;
    };
    
    const traces = [];
    
    // Strategy drawdown
    traces.push({
      x: strategyEquity.index,
      y: calculateDrawdown(strategyEquity),
      type: 'scatter',
      mode: 'lines',
      name: 'Strategy',
      line: { color: '#00aa55', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(0, 170, 85, 0.15)'
    });
    
    // Buy & Hold drawdown
    if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
      traces.push({
        x: buyholdEquity.index,
        y: calculateDrawdown(buyholdEquity),
        type: 'scatter',
        mode: 'lines',
        name: 'Buy & Hold',
        line: { color: '#c8f0c8', width: 2 },
        fill: 'tozeroy',
        fillcolor: 'rgba(200, 240, 200, 0.10)'
      });
    }
    
    // Benchmark drawdown
    if (benchmarkEquity && benchmarkEquity.data && benchmarkEquity.data.length > 0) {
      traces.push({
        x: benchmarkEquity.index,
        y: calculateDrawdown(benchmarkEquity),
        type: 'scatter',
        mode: 'lines',
        name: 'Benchmark',
        line: { color: '#808080', width: 2 },
        fill: 'tozeroy',
        fillcolor: 'rgba(128, 128, 128, 0.08)'
      });
    }
    
    const layout = {
      xaxis: { showticklabels: false, gridcolor: '#2a2a2a', griddash: 'dash', color: '#999999' },
      yaxis: { 
        gridcolor: '#2a2a2a',
        griddash: 'dash',
        color: '#999999',
        tickformat: '.0%',
        showticklabels: true
      },
      plot_bgcolor: '#0a0a0a',
      paper_bgcolor: '#0a0a0a',
      font: { color: '#e0e0e0', size: 10 },
      margin: { l: 45, r: 10, t: 10, b: 25 },
      showlegend: true,
      legend: { x: 0.02, y: 0.02, font: { size: 9 }, bgcolor: 'rgba(10, 10, 10, 0.8)' },
      hovermode: 'x unified'
    };
    
    window.addWatermark(layout);
    
    Plotly.newPlot('drawdownChart', traces, layout, { displayModeBar: false, responsive: true, scrollZoom: true });
  },

  /**
   * Display trade events list
   */
  displayTradeEvents(events) {
    const eventsDiv = document.getElementById('tradeEvents');
    
    if (!events || events.length === 0) {
      eventsDiv.innerHTML = '<p style="color: var(--text-secondary);">No trade events recorded</p>';
      return;
    }
    
    const eventsHtml = events.map(event => {
      // Parse timestamp - events use 'ts' field
      const date = new Date(event.ts).toLocaleDateString();
      // Events use 'type' field, not 'side'
      const type = event.type || 'unknown';
      const typeClass = type.toLowerCase();
      
      return `
        <div class="event-item">
          <span class="event-date">${date}</span>
          <span class="event-side ${typeClass}">${type.toUpperCase()}</span>
          <span class="event-details">
            ${event.qty || 0} shares @ $${window.formatNumber(event.price || 0, 2)}
            ${event.fee ? ` | Fee: $${window.formatNumber(event.fee, 2)}` : ''}
          </span>
        </div>
      `;
    }).join('');
    
    eventsDiv.innerHTML = eventsHtml;
  }
};

// Export as ES6 module
export default TearsheetCharts;

// Also expose to window for backward compatibility
window.TearsheetCharts = TearsheetCharts;
window.displayEquityChart = (strategyEquity, buyholdEquity, benchmarkEquity, events) => 
  TearsheetCharts.displayEquityChart(strategyEquity, buyholdEquity, benchmarkEquity, events);
window.displayVolMatchedChart = (strategyEquity, comparisonEquity, chartElementId, comparisonName) => 
  TearsheetCharts.displayVolMatchedChart(strategyEquity, comparisonEquity, chartElementId, comparisonName);
window.displayDrawdownChart = (strategyEquity, buyholdEquity, benchmarkEquity) => 
  TearsheetCharts.displayDrawdownChart(strategyEquity, buyholdEquity, benchmarkEquity);
window.displayTradeEvents = (events) => 
  TearsheetCharts.displayTradeEvents(events);
