/**
 * Run Preview Module
 * 
 * Handles preview chart generation for backtest runs.
 * Generates entry/exit signals based on conditions and visualizes them with Plotly.
 */

import * as BacktestRuns from './runs.js';

const RunPreview = {
  /**
   * Generate preview chart for a run
   * @param {number} runId - Run ID
   */
  async generate(runId) {
    console.log(`[PREVIEW] Generating preview for run ${runId}`);
    
    const run = BacktestRuns.getRun(runId);
    if (!run) {
      console.error('[PREVIEW] Run not found:', runId);
      return;
    }
    
    // Get selected ticker
    const tickerSelect = document.getElementById(`runPreviewTicker_${runId}`);
    const ticker = tickerSelect?.value;
    
    if (!ticker) {
      alert('Please select a ticker to preview');
      return;
    }
    
    const previewContainer = document.getElementById(`runPreview_${runId}`);
    previewContainer.innerHTML = '<div class="preview-loading">Loading price data for ' + ticker + '</div>';
    
    try {
      // Load preview from backend API - use last 6 months for fast preview
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 6 months ago
      
      // Import API module
      const API = await import('../core/api.js');
      
      // Format conditions
      const formattedEntry = this._formatConditions(run.entryConditions);
      const formattedExit = this._formatConditions(run.exitConditions);
      
      console.log('[PREVIEW] Frontend conditions:');
      console.log('  Entry:', JSON.stringify(run.entryConditions, null, 2));
      console.log('  Exit:', JSON.stringify(run.exitConditions, null, 2));
      console.log('[PREVIEW] Formatted for backend:');
      console.log('  Entry:', JSON.stringify(formattedEntry, null, 2));
      console.log('  Exit:', JSON.stringify(formattedExit, null, 2));
      
      // Build indicators config from conditions
      const indicators = this._extractIndicatorsFromConditions(run.entryConditions, run.exitConditions);
      console.log('[PREVIEW] Detected indicators:', JSON.stringify(indicators, null, 2));
      
      // Call backend preview API
      const result = await API.previewStrategy({
        ticker: ticker,
        startDate: startDate,
        endDate: endDate,
        indicators: indicators,
        entryConditions: formattedEntry,
        exitConditions: formattedExit
      });
      
      if (!result.success) {
        previewContainer.innerHTML = `<div class="preview-status" style="color: var(--accent-red);">Error loading data: ${result.error}</div>`;
        return;
      }
      
      const data = result.data;
      console.log(`[PREVIEW] Loaded ${data.summary.total_bars} bars with ${data.summary.entry_signals} entry signals and ${data.summary.exit_signals} exit signals`);
      
      // Convert API response to chart format
      const priceData = {
        dates: data.dates,
        open: data.ohlcv.open,
        high: data.ohlcv.high,
        low: data.ohlcv.low,
        close: data.ohlcv.close,
        volume: data.ohlcv.volume,
        indicators: data.indicators
      };
      
      // Convert signal arrays to indices
      const entrySignals = data.signals.entry
        .map((signal, idx) => signal ? idx : -1)
        .filter(idx => idx !== -1);
      const exitSignals = data.signals.exit
        .map((signal, idx) => signal ? idx : -1)
        .filter(idx => idx !== -1);
      
      console.log('[PREVIEW] Converted signals:', {
        entrySignals: entrySignals.length,
        exitSignals: exitSignals.length
      });
      
      // Render preview chart
      this._renderChart(runId, ticker, priceData, entrySignals, exitSignals, run);
      
    } catch (error) {
      console.error('[PREVIEW] Error generating preview:', error);
      previewContainer.innerHTML = `<div class="preview-status" style="color: var(--accent-red);">Error: ${error.message}</div>`;
    }
  },

  /**
   * Generate signals for preview based on conditions
   * @param {Array} conditions - Array of condition objects
   * @param {Object} priceData - Price data from API
   * @param {string} mode - 'all' or 'any'
   * @returns {Promise<Array>} Array of signal indices
   * @private
   */
  async _generateSignals(conditions, priceData, mode) {
    if (!conditions || conditions.length === 0) {
      return [];
    }
    
    console.log('[PREVIEW] Generating signals for', conditions.length, 'conditions, mode:', mode);
    
    const allSignalArrays = [];
    
    // Generate signals for each condition
    for (const cond of conditions) {
      console.log('[PREVIEW] Processing condition:', cond.type, cond);
      const signals = await this._generateConditionSignals(cond, priceData);
      console.log('[PREVIEW] Condition generated', signals.length, 'signals');
      allSignalArrays.push(signals);
    }
    
    // Combine signals based on mode
    if (mode === 'all') {
      // AND: Only indices where ALL conditions are true
      if (allSignalArrays.length === 0) return [];
      return allSignalArrays[0].filter(idx => 
        allSignalArrays.every(arr => arr.includes(idx))
      );
    } else {
      // OR: Indices where ANY condition is true
      const allIndices = new Set();
      allSignalArrays.forEach(arr => arr.forEach(idx => allIndices.add(idx)));
      return Array.from(allIndices).sort((a, b) => a - b);
    }
  },

  /**
   * Generate signals for a single condition
   * @param {Object} cond - Condition object
   * @param {Object} priceData - Price data
   * @returns {Promise<Array>} Array of signal indices
   * @private
   */
  async _generateConditionSignals(cond, priceData) {
    const signals = [];
    const { dates, open, high, low, close, volume } = priceData;
    
    // Calculate indicators based on condition type
    let sourceValues, targetValues;
    
    // STEP 1: Calculate source values (Price, RSI, MA)
    switch (cond.type) {
      case 'price':
        sourceValues = close;
        break;
      
      case 'rsi':
        sourceValues = calculateRSIArray(close, cond.rsi_period || 14);
        break;
      
      case 'ma':
        sourceValues = calculateMA(close, cond.ma_type, cond.ma_period);
        break;
      
      default:
        console.warn('[PREVIEW] Unknown condition type:', cond.type);
        return [];
    }
    
    // STEP 2: Calculate target values
    switch (cond.target_type) {
      case 'Value':
        targetValues = new Array(sourceValues.length).fill(cond.target_value || 0);
        break;
      
      case 'SMA':
        targetValues = calculateSMA(close, cond.target_period || 20);
        break;
      
      case 'EMA':
        targetValues = calculateEMA(close, cond.target_period || 20);
        break;
      
      case 'HMA':
        targetValues = calculateHMA(close, cond.target_period || 20);
        break;
      
      case 'KAMA':
        targetValues = calculateKAMA(close, cond.target_period || 20);
        break;
      
      case 'BB_TOP':
      case 'BB_MID':
      case 'BB_BOTTOM':
        const bb = calculateBB(close, cond.target_period || 20, cond.bb_std || 2.0);
        targetValues = cond.target_type === 'BB_TOP' ? bb.upper : 
                       cond.target_type === 'BB_BOTTOM' ? bb.lower : bb.middle;
        break;
      
      case 'KC_TOP':
      case 'KC_MID':
      case 'KC_BOTTOM':
        const kc = calculateKC(high, low, close, cond.target_period || 20, cond.kc_mult || 2.0);
        targetValues = cond.target_type === 'KC_TOP' ? kc.upper :
                       cond.target_type === 'KC_BOTTOM' ? kc.lower : kc.middle;
        break;
      
      default:
        console.warn('[PREVIEW] Unknown target type:', cond.target_type);
        return [];
    }
    
    // STEP 3: Detect signals based on interaction type
    const threshold = (cond.threshold_pct || 0) / 100; // Convert % to decimal
    
    console.log('[PREVIEW] Signal detection:', {
      type: cond.type,
      sourceLength: sourceValues.length,
      targetLength: targetValues.length,
      sourceNonNull: sourceValues.filter(v => v !== null && !isNaN(v)).length,
      targetNonNull: targetValues.filter(v => v !== null && !isNaN(v)).length,
      interaction: cond.interaction,
      threshold: threshold,
      sampleSource: sourceValues.slice(50, 60),
      sampleTarget: targetValues.slice(50, 60)
    });
    
    for (let i = 1; i < sourceValues.length; i++) {
      if (!sourceValues[i] || !targetValues[i]) continue;
      if (isNaN(sourceValues[i]) || isNaN(targetValues[i])) continue;
      
      const prev = sourceValues[i - 1];
      const curr = sourceValues[i];
      const targetPrev = targetValues[i - 1];
      const targetCurr = targetValues[i];
      
      if (!prev || !targetPrev || isNaN(prev) || isNaN(targetPrev)) continue;
      
      let triggered = false;
      
      switch (cond.interaction) {
        case 'cross':
          // Detect crossover in the specified direction
          if (cond.direction === 'above') {
            // Was below, now above (with threshold)
            if (prev <= targetPrev && curr >= targetCurr * (1 + threshold)) {
              triggered = true;
            }
          } else if (cond.direction === 'below') {
            // Was above, now below (with threshold)
            if (prev >= targetPrev && curr <= targetCurr * (1 - threshold)) {
              triggered = true;
            }
          }
          break;
        
        case 'above':
          // Currently above by threshold amount
          if (curr >= targetCurr * (1 + threshold)) {
            triggered = true;
          }
          break;
        
        case 'below':
          // Currently below by threshold amount  
          if (curr <= targetCurr * (1 - threshold)) {
            triggered = true;
          }
          break;
      }
      
      if (triggered) {
        // Apply delay bars
        const signalIndex = i + (cond.delay_bars || 0);
        if (signalIndex < sourceValues.length) {
          signals.push(signalIndex);
          
          // Log first few signals for debugging
          if (signals.length <= 3) {
            console.log('[PREVIEW] Signal triggered:', {
              index: i,
              signalIndex,
              prev,
              curr,
              targetPrev,
              targetCurr,
              interaction: cond.interaction,
              direction: cond.direction,
              threshold
            });
          }
        }
      }
    }
    
    console.log('[PREVIEW] Total signals found:', signals.length);
    
    return signals;
  },

  /**
   * Render the preview chart with Plotly
   * @private
   */
  _renderChart(runId, ticker, priceData, entrySignals, exitSignals, run) {
    const previewContainer = document.getElementById(`runPreview_${runId}`);
    
    // Check what indicators are used in conditions
    const usesRSI = [...(run.entryConditions || []), ...(run.exitConditions || [])]
      .some(c => c.type === 'rsi');
    
    const html = `
      <div class="preview-status">
        ✓ Preview generated for ${ticker} (${priceData.dates.length} bars)
        <div style="font-size: 11px; margin-top: 6px;">
          Entry signals: ${entrySignals.length} | Exit signals: ${exitSignals.length}
        </div>
      </div>
      <div id="previewChart_${runId}" class="preview-chart"></div>
      <div class="preview-legend">
        <div class="legend-item">
          <div class="legend-color" style="background: #2196F3;"></div>
          <span>Price</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #4CAF50;"></div>
          <span>Entry Signals (${entrySignals.length})</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #F44336;"></div>
          <span>Exit Signals (${exitSignals.length})</span>
        </div>
      </div>
    `;
    
    previewContainer.innerHTML = html;
    
    console.log('[PREVIEW] Rendering chart for run', runId, 'with RSI subplot:', usesRSI);
    
    // Prepare chart data
    const traces = [];
    
    // Determine if we need subplots
    const hasSubplots = usesRSI;
    
    // Price line chart (using close prices)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: priceData.dates,
      y: priceData.close,
      name: ticker + ' Price',
      line: {
        color: '#2196F3',
        width: 2
      },
      hovertemplate: '%{x}<br>Price: $%{y:.2f}<extra></extra>',
      xaxis: 'x',
      yaxis: 'y'
    });
    
    // Generate trade labels (A, B, C... Z, AA, BB, CC...)
    const getTradeLabel = (index) => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (index < 26) {
        return alphabet[index];
      } else {
        const letter = alphabet[index % 26];
        return letter + letter; // AA, BB, CC...
      }
    };
    
    // Pair entry and exit signals to create trades
    const trades = [];
    let entryIdx = 0;
    let exitIdx = 0;
    
    while (entryIdx < entrySignals.length && exitIdx < exitSignals.length) {
      const entryBar = entrySignals[entryIdx];
      const exitBar = exitSignals[exitIdx];
      
      if (entryBar < exitBar) {
        trades.push({
          entry: entryBar,
          exit: exitBar,
          label: getTradeLabel(trades.length)
        });
        entryIdx++;
        exitIdx++;
      } else {
        exitIdx++;
      }
    }
    
    // Entry signals with labels
    if (entrySignals.length > 0) {
      const entryX = [];
      const entryY = [];
      const entryText = [];
      const entryHover = [];
      
      entrySignals.forEach((barIdx, i) => {
        entryX.push(priceData.dates[barIdx]);
        entryY.push(priceData.close[barIdx] * 0.995); // Below price
        
        // Find if this entry is part of a trade
        const trade = trades.find(t => t.entry === barIdx);
        const label = trade ? trade.label : getTradeLabel(i);
        
        entryText.push(label);
        entryHover.push(`ENTRY ${label}<br>${priceData.dates[barIdx]}<br>Price: $${priceData.close[barIdx].toFixed(2)}`);
      });
      
      traces.push({
        type: 'scatter',
        mode: 'markers+text',
        x: entryX,
        y: entryY,
        text: entryText,
        textposition: 'bottom center',
        textfont: {
          family: 'Arial Black, sans-serif',
          size: 11,
          color: '#fff'
        },
        name: 'Entry',
        marker: {
          symbol: 'triangle-up',
          size: 18,
          color: '#4CAF50',
          line: { color: '#2e7d32', width: 2 }
        },
        hovertemplate: '%{hovertext}<extra></extra>',
        hovertext: entryHover,
        xaxis: 'x',
        yaxis: 'y'
      });
    }
    
    // Exit signals with labels
    if (exitSignals.length > 0) {
      const exitX = [];
      const exitY = [];
      const exitText = [];
      const exitHover = [];
      
      exitSignals.forEach((barIdx, i) => {
        exitX.push(priceData.dates[barIdx]);
        exitY.push(priceData.close[barIdx] * 1.005); // Above price
        
        // Find if this exit is part of a trade
        const trade = trades.find(t => t.exit === barIdx);
        const label = trade ? trade.label : getTradeLabel(i);
        
        exitText.push(label);
        exitHover.push(`EXIT ${label}<br>${priceData.dates[barIdx]}<br>Price: $${priceData.close[barIdx].toFixed(2)}`);
      });
      
      traces.push({
        type: 'scatter',
        mode: 'markers+text',
        x: exitX,
        y: exitY,
        text: exitText,
        textposition: 'top center',
        textfont: {
          family: 'Arial Black, sans-serif',
          size: 11,
          color: '#fff'
        },
        name: 'Exit',
        marker: {
          symbol: 'triangle-down',
          size: 18,
          color: '#F44336',
          line: { color: '#c62828', width: 2 }
        },
        hovertemplate: '%{hovertext}<extra></extra>',
        hovertext: exitHover,
        xaxis: 'x',
        yaxis: 'y'
      });
    }
    
    // Add RSI subplot if RSI is used in conditions
    if (usesRSI && priceData.indicators && priceData.indicators.rsi_14) {
      const rsiValues = priceData.indicators.rsi_14;
      
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: priceData.dates,
        y: rsiValues,
        name: 'RSI(14)',
        line: {
          color: '#9C27B0',
          width: 2
        },
        hovertemplate: '%{x}<br>RSI: %{y:.2f}<extra></extra>',
        xaxis: 'x',
        yaxis: 'y2'
      });
      
      // Add RSI overbought/oversold lines
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [priceData.dates[0], priceData.dates[priceData.dates.length - 1]],
        y: [70, 70],
        name: 'Overbought',
        line: {
          color: '#F44336',
          width: 1,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip',
        xaxis: 'x',
        yaxis: 'y2'
      });
      
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [priceData.dates[0], priceData.dates[priceData.dates.length - 1]],
        y: [30, 30],
        name: 'Oversold',
        line: {
          color: '#4CAF50',
          width: 1,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip',
        xaxis: 'x',
        yaxis: 'y2'
      });
    }
    
    // Build layout with subplots if needed
    const layout = {
      title: {
        text: `${ticker} - Strategy Preview`,
        font: { size: 16, color: '#e0e0e0' }
      },
      xaxis: { 
        title: 'Date', 
        type: 'date', 
        rangeslider: { visible: false },
        gridcolor: '#2a2a2a',
        showgrid: true,
        domain: [0, 1]
      },
      yaxis: { 
        title: 'Price ($)',
        gridcolor: '#2a2a2a',
        showgrid: true,
        domain: hasSubplots ? [0.35, 1] : [0, 1]
      },
      plot_bgcolor: '#0a0a0a',
      paper_bgcolor: '#111111',
      font: { color: '#e0e0e0', size: 12 },
      hovermode: 'closest',
      showlegend: true,
      legend: { 
        x: 0, 
        y: 1.15, 
        orientation: 'h',
        bgcolor: 'rgba(0,0,0,0)',
        font: { size: 11 }
      },
      margin: { t: 80, r: 30, b: 50, l: 70 },
      dragmode: 'pan'
    };
    
    // Add RSI subplot axis if needed
    if (hasSubplots) {
      layout.yaxis2 = {
        title: 'RSI',
        gridcolor: '#2a2a2a',
        showgrid: true,
        domain: [0, 0.3],
        range: [0, 100]
      };
    }
    
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToAdd: ['drawopenpath', 'eraseshape'],
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      scrollZoom: false // Disable scroll zoom
    };
    
    console.log('[PREVIEW] Creating Plotly chart with', traces.length, 'traces');
    console.log('[PREVIEW] Chart container ID:', `previewChart_${runId}`);
    
    try {
      Plotly.newPlot(`previewChart_${runId}`, traces, layout, config);
      console.log('[PREVIEW] Chart rendered successfully');
    } catch (error) {
      console.error('[PREVIEW] Error rendering chart:', error);
      previewContainer.innerHTML += `<div style="color: red; padding: 10px;">Chart error: ${error.message}</div>`;
    }
  },

  /**
   * Format conditions for backend API
   * Converts frontend condition format to backend expected format
   */
  _formatConditions(conditions) {
    if (!conditions || !Array.isArray(conditions)) {
      return [];
    }

    return conditions.map(cond => {
      // Backend expects: { source, comparison, target, threshold_pct?, delay_bars?, bb_std?, kc_mult? }
      // Frontend has various formats depending on condition type
      
      const baseCondition = {};
      
      if (cond.type === 'price') {
        // Price comparison: close > 100 or close crosses above sma_20 by 2%
        baseCondition.source = cond.priceType || 'close';
        baseCondition.comparison = cond.interaction === 'cross' 
          ? `crosses_${cond.direction || 'above'}` 
          : cond.interaction || 'above';
        
        // Target can be a value or an indicator
        if (cond.target_type === 'Value') {
          baseCondition.target = parseFloat(cond.target_value) || 0;
        } else {
          // MA target: sma_20, ema_50, bb_top, etc.
          const maType = cond.target_type.toLowerCase();
          const period = cond.target_period || 20;
          baseCondition.target = `${maType}_${period}`;
        }
      } else if (cond.type === 'rsi') {
        // RSI comparison: rsi < 30 or rsi crosses below 50
        const rsiPeriod = cond.rsi_period || 14;
        baseCondition.source = `rsi_${rsiPeriod}`;
        baseCondition.comparison = cond.interaction === 'cross'
          ? `crosses_${cond.direction || 'below'}`
          : cond.interaction || 'below';
        
        if (cond.target_type === 'Value') {
          baseCondition.target = parseFloat(cond.target_value) || 30;
        } else {
          const maType = cond.target_type.toLowerCase();
          const period = cond.target_period || 20;
          baseCondition.target = `${maType}_${period}`;
        }
      } else if (cond.type === 'ma') {
        // MA crossover: sma_50 crosses above sma_200
        const maType = cond.ma_type || 'sma';
        const period = cond.ma_period || 50;
        baseCondition.source = `${maType}_${period}`;
        baseCondition.comparison = cond.interaction === 'cross'
          ? `crosses_${cond.direction || 'above'}`
          : cond.interaction || 'above';
        
        if (cond.target_type === 'Value') {
          baseCondition.target = parseFloat(cond.target_value) || 0;
        } else {
          const targetType = cond.target_type.toLowerCase();
          const targetPeriod = cond.target_period || 200;
          baseCondition.target = `${targetType}_${targetPeriod}`;
        }
      } else {
        // Default format
        baseCondition.source = cond.source || cond.indicator || 'close';
        baseCondition.comparison = cond.comparison || 'above';
        baseCondition.target = cond.target !== undefined ? cond.target : (parseFloat(cond.value) || 0);
      }
      
      // Add optional advanced parameters if present
      if (cond.threshold_pct !== undefined && cond.threshold_pct !== 0) {
        baseCondition.threshold_pct = parseFloat(cond.threshold_pct);
      }
      if (cond.delay_bars !== undefined && cond.delay_bars !== 0) {
        baseCondition.delay_bars = parseInt(cond.delay_bars);
      }
      if (cond.bb_std !== undefined && cond.target_type?.includes('BB_')) {
        baseCondition.bb_std = parseFloat(cond.bb_std);
      }
      if (cond.kc_mult !== undefined && cond.target_type?.includes('KC_')) {
        baseCondition.kc_mult = parseFloat(cond.kc_mult);
      }
      
      return baseCondition;
    });
  },

  /**
   * Extract indicators config from conditions
   * Detects which indicators need to be calculated based on conditions
   */
  _extractIndicatorsFromConditions(entryConditions, exitConditions) {
    const indicators = {};
    const allConditions = [...(entryConditions || []), ...(exitConditions || [])];
    
    for (const cond of allConditions) {
      // RSI indicator
      if (cond.type === 'rsi') {
        const period = cond.rsi_period || 14;
        indicators[`rsi_${period}`] = { type: 'rsi', period: period };
      }
      
      // Moving averages in target
      if (cond.target_type === 'SMA' || cond.target_type === 'EMA' || 
          cond.target_type === 'HMA' || cond.target_type === 'KAMA') {
        const period = cond.target_period || 20;
        const key = `${cond.target_type.toLowerCase()}_${period}`;
        indicators[key] = { 
          type: cond.target_type.toLowerCase(), 
          period: period 
        };
      }
      
      // Bollinger Bands
      if (cond.target_type?.includes('BB_')) {
        const period = cond.target_period || 20;
        const std = cond.bb_std || 2.0;
        indicators[`bb_${period}`] = { 
          type: 'bollinger', 
          period: period,
          std_dev: std
        };
      }
      
      // Keltner Channels
      if (cond.target_type?.includes('KC_')) {
        const period = cond.target_period || 20;
        const mult = cond.kc_mult || 2.0;
        indicators[`kc_${period}`] = { 
          type: 'keltner', 
          period: period,
          atr_mult: mult
        };
      }
    }
    
    return indicators;
  }
};

// Export
export { RunPreview };

// Also expose to window
window.RunPreview = RunPreview;

console.log('[INIT] Run preview module loaded');
