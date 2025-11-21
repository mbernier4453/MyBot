/**
 * Candlestick Chart Module (Legacy)
 * Legacy candlestick charting functionality
 * Note: This is kept for reference and backward compatibility
 */

import * as State from '../core/state.js';

// =====================================================
// CANDLESTICK CHART FUNCTIONALITY (Legacy - for reference)
// =====================================================

// Get watchlists from state
const getWatchlists = () => State.getWatchlists();
const rerenderMainChart = () => {
  // Legacy function - placeholder for compatibility
  console.log('[Legacy] rerenderMainChart called - functionality moved to chart-tabs module');
};

// Chart normalization state
let chartNormalized = false;
const normalizeCheckbox = document.querySelector('.chart-normalize-checkbox');
if (normalizeCheckbox) {
  normalizeCheckbox.checked = false;
  normalizeCheckbox.addEventListener('change', () => {
    chartNormalized = normalizeCheckbox.checked;
    rerenderMainChart();
  });
}

let currentChartData = null;
let currentChartTicker = null;
let liveChartData = new Map(); // Store live candle data
let liveUpdateEnabled = true;
let lastChartUpdate = Date.now();

// Sidebar toggle functionality
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const closeSidebarBtn = document.getElementById('closeSidebar');
const chartSidebar = document.getElementById('chartSidebar');

sidebarToggleBtn?.addEventListener('click', () => {
  chartSidebar?.classList.remove('collapsed');
  sidebarToggleBtn?.classList.remove('visible');
});

closeSidebarBtn?.addEventListener('click', () => {
  chartSidebar?.classList.add('collapsed');
  sidebarToggleBtn?.classList.add('visible');
});

// Initialize chart watchlist dropdown
function initializeChartWatchlists() {
  const select = document.getElementById('chartWatchlistSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Choose a watchlist...</option>';
  
  const watchlists = getWatchlists();
  watchlists.forEach(w => {
    const option = document.createElement('option');
    option.value = w.id;
    option.textContent = `${w.name} (${w.tickers.length})`;
    select.appendChild(option);
  });
}

// Handle watchlist selection
document.getElementById('chartWatchlistSelect')?.addEventListener('change', (e) => {
  const watchlistId = e.target.value;
  if (!watchlistId) {
    document.getElementById('chartTickerList').innerHTML = `
      <div class="empty-state" style="padding: 20px; font-size: 12px;">
        Select a watchlist to see tickers
      </div>
    `;
    return;
  }
  
  const watchlists = getWatchlists();
  const watchlist = watchlists.find(w => w.id === watchlistId);
  if (!watchlist || watchlist.tickers.length === 0) {
    document.getElementById('chartTickerList').innerHTML = `
      <div class="empty-state" style="padding: 20px; font-size: 12px;">
        No tickers in this watchlist
      </div>
    `;
    return;
  }
  
  // Display tickers
  const tickerListHtml = watchlist.tickers.map(ticker => {
    const data = treemapData.get(ticker);
    const priceText = data ? `$${data.close.toFixed(2)}` : 'Loading...';
    const changeClass = data && data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
    
    return `
      <div class="ticker-list-item ${currentChartTicker === ticker ? 'active' : ''}" data-ticker="${ticker}">
        <span class="ticker-list-symbol">${ticker}</span>
        <span class="ticker-list-price ${changeClass}">${priceText}</span>
      </div>
    `;
  }).join('');
  
  document.getElementById('chartTickerList').innerHTML = tickerListHtml;
  
  // Add click handlers
  document.querySelectorAll('.ticker-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticker = item.dataset.ticker;
      selectChartTicker(ticker);
    });
  });
});

// Ticker input button
document.getElementById('chartTickerBtn')?.addEventListener('click', () => {
  const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
  if (ticker) {
    selectChartTicker(ticker);
  }
});

// Allow Enter key in ticker input
document.getElementById('chartTickerInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('chartTickerBtn')?.click();
  }
});

// Select a ticker for charting (updated for tabs)
async function selectChartTicker(ticker) {
  const activeTab = getActiveChartTab();
  if (activeTab) {
    activeTab.setTicker(ticker);
    // Close sidebar after selection
    chartSidebar?.classList.add('collapsed');
    sidebarToggleBtn?.classList.add('visible');
  }
}

// Legacy function (keeping for now)
async function selectChartTickerLegacy(ticker) {
  currentChartTicker = ticker;
  document.getElementById('chartTickerInput').value = ticker;
  
  // Update active state in ticker list
  document.querySelectorAll('.ticker-list-item').forEach(item => {
    if (item.dataset.ticker === ticker) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Show top info bar
  document.getElementById('chartLiveInfoTop').style.display = 'flex';
  document.getElementById('chartLiveTickerTop').textContent = ticker;
  
  // Update live info immediately
  updateChartLiveInfo(ticker);
  
  // Validate and adjust interval based on timeframe
  validateIntervalForTimeframe();
  
  // Load historical chart
  const timeframe = document.getElementById('chartTimeframe')?.value || '1Y';
  const interval = document.getElementById('chartInterval')?.value || 'day';
  await loadCandlestickChart(ticker, timeframe, interval);
}

// Update live info panel
function updateChartLiveInfo(ticker) {
  const data = treemapData.get(ticker);
  if (!data) return;
  
  // Log the calculation details
  console.log(`[LIVE INFO] ${ticker}:`);
  console.log(`  Current Price: $${data.close?.toFixed(2)}`);
  console.log(`  Previous Close: $${data.prevClose?.toFixed(2)}`);
  console.log(`  Change: $${data.change?.toFixed(2)}`);
  console.log(`  Change %: ${data.changePercent?.toFixed(2)}%`);
  
  const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
  const changeSign = data.changePercent >= 0 ? '+' : '';
  const priceText = `$${data.close ? data.close.toFixed(2) : 'N/A'}`;
  const changeText = `${changeSign}${data.changePercent ? data.changePercent.toFixed(2) : '0.00'}%`;
  const volumeText = data.volume ? (data.volume / 1000000).toFixed(1) + 'M' : 'N/A';
  const marketCapText = data.marketCap ? '$' + (data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A';
  
  // Update top bar
  const priceTopEl = document.getElementById('chartLivePriceTop');
  const changeTopEl = document.getElementById('chartLiveChangeTop');
  const volumeTopEl = document.getElementById('chartLiveVolumeTop');
  const marketCapTopEl = document.getElementById('chartLiveMarketCapTop');
  
  if (priceTopEl) priceTopEl.textContent = priceText;
  if (changeTopEl) {
    changeTopEl.textContent = changeText;
    changeTopEl.className = `live-change-large ${changeClass}`;
  }
  if (volumeTopEl) volumeTopEl.textContent = volumeText;
  if (marketCapTopEl) marketCapTopEl.textContent = marketCapText;
}

// Live update toggle
document.getElementById('liveUpdateToggle')?.addEventListener('change', (e) => {
  liveUpdateEnabled = e.target.checked;
});

// Show/hide extended hours toggle based on whether timeframe has intraday intervals
function updateExtendedHoursVisibility() {
  const timeframe = document.getElementById('chartTimeframe')?.value;
  const extendedHoursToggle = document.querySelector('.live-update-toggle:has(#extendedHoursToggle)');
  
  if (extendedHoursToggle) {
    // Show if timeframe has ANY intraday intervals available
    const intradayTimeframes = ['1D', '5D', '1M', '3M'];
    
    if (intradayTimeframes.includes(timeframe)) {
      extendedHoursToggle.style.display = '';
    } else {
      extendedHoursToggle.style.display = 'none';
    }
  }
}

// Validate interval for timeframe
function validateIntervalForTimeframe() {
  const timeframe = document.getElementById('chartTimeframe')?.value;
  const intervalSelect = document.getElementById('chartInterval');
  if (!timeframe || !intervalSelect) return;
  
  const currentInterval = intervalSelect.value;
  
  // Define valid intervals for each timeframe
  // Note: Polygon only keeps ~3 months of intraday data, so longer timeframes use daily+ intervals
  const validIntervals = {
    '1D': ['1', '5', '15', '30', '60'],
    '5D': ['5', '15', '30', '60', '240'],  // All intraday intervals
    '1M': ['15', '30', '60', '240', 'day'],  // 15min to daily
    '3M': ['15', '30', '60', '240', 'day'],  // 15min, 30min, 1hr, 4hr, daily
    '1Y': ['day', 'week'],
    '2Y': ['day', 'week'],
    '5Y': ['day', 'week', 'month'],
    '10Y': ['week', 'month'],
    'ALL': ['week', 'month']
  };
  
  const allowed = validIntervals[timeframe] || ['day'];
  
  // Disable all options first
  Array.from(intervalSelect.options).forEach(option => {
    option.disabled = !allowed.includes(option.value);
  });
  
  // If current interval is not valid, select the first valid one
  if (!allowed.includes(currentInterval)) {
    intervalSelect.value = allowed[allowed.length - 1]; // Default to largest valid interval
  }
  
  // Update extended hours visibility (use setTimeout to ensure DOM has updated)
  setTimeout(() => updateExtendedHoursVisibility(), 0);
}

// Timeframe/interval change handlers
document.getElementById('chartTimeframe')?.addEventListener('change', () => {
  validateIntervalForTimeframe();
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

document.getElementById('chartInterval')?.addEventListener('change', () => {
  updateExtendedHoursVisibility();
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Extended hours toggle
document.getElementById('extendedHoursToggle')?.addEventListener('change', () => {
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Chart type toggle
document.getElementById('chartType')?.addEventListener('change', () => {
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Calculate date range based on timeframe
// For intraday intervals on longer timeframes, we need to limit the range
// to avoid hitting API limits and to ensure we get recent data
function getDateRange(timeframe, interval = 'day') {
  const now = new Date();
  const to = new Date(now.getTime());  // Create explicit copy
  const from = new Date(now.getTime());  // Create explicit copy
  
  // Check if this is an intraday interval (minute or hour based)
  const isIntraday = interval !== 'day' && interval !== 'week' && interval !== 'month';
  
  switch(timeframe) {
    case '1D':
      // For 1D, show only today's data (start at midnight today)
      from.setHours(0, 0, 0, 0);
      break;
    case '5D':
      from.setTime(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case '1M':
      // Use days instead of setMonth to avoid date overflow issues
      from.setTime(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      break;
    case '3M':
      // Use days instead of setMonth to avoid date overflow issues (90 days = ~3 months)
      from.setTime(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      break;
    case '1Y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case '2Y':
      from.setFullYear(from.getFullYear() - 2);
      break;
    case '5Y':
      from.setFullYear(from.getFullYear() - 5);
      break;
    case '10Y':
      from.setFullYear(from.getFullYear() - 10);
      break;
    case 'ALL':
      // Go back 20 years for "all available"
      from.setFullYear(from.getFullYear() - 20);
      break;
    default:
      from.setFullYear(from.getFullYear() - 1);
  }
  
  // Format as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const result = {
    from: formatDate(from),
    to: formatDate(to)
  };
  
  console.log(`[DATE RANGE] Timeframe: ${timeframe}, From: ${result.from}, To: ${result.to}`);
  console.log(`[DATE DEBUG] From Date Object: ${from.toString()}`);
  console.log(`[DATE DEBUG] To Date Object: ${to.toString()}`);
  console.log(`[DATE DEBUG] Current Time: ${now.toString()}`);
  
  return result;
}

// Determine timespan and multiplier from interval
function getTimespanParams(interval) {
  if (interval === 'day') {
    return { timespan: 'day', multiplier: 1 };
  } else if (interval === 'week') {
    return { timespan: 'week', multiplier: 1 };
  } else if (interval === 'month') {
    return { timespan: 'month', multiplier: 1 };
  } else if (interval === '240') {
    // 4 hour = 240 minutes
    return { timespan: 'hour', multiplier: 4 };
  } else if (parseInt(interval) >= 60) {
    // Hour intervals
    return { timespan: 'hour', multiplier: parseInt(interval) / 60 };
  } else {
    // Minute intervals
    return { timespan: 'minute', multiplier: parseInt(interval) };
  }
}

// Load candlestick chart
async function loadCandlestickChart(ticker, timeframe, interval) {
  const chartDiv = document.getElementById('candlestickChart');
  const loadingDiv = document.getElementById('chartLoading');
  const emptyState = document.getElementById('chartEmptyState');
  
  // Hide empty state, show loading
  if (emptyState) emptyState.style.display = 'none';
  loadingDiv.style.display = 'block';
  chartDiv.innerHTML = '';
  
  try {
    const dateRange = getDateRange(timeframe, interval);
    const { timespan, multiplier } = getTimespanParams(interval);
    const extendedHoursCheckbox = document.getElementById('extendedHoursToggle');
    const extendedHours = extendedHoursCheckbox?.checked === true;
    
    console.log(`[CHART LOAD] ${ticker}:`);
    console.log(`  Timeframe: ${timeframe}, Interval: ${interval}`);
    console.log(`  Date Range: ${dateRange.from} to ${dateRange.to}`);
    console.log(`  Timespan: ${multiplier} ${timespan}`);
    console.log(`  Extended Hours Checkbox Checked: ${extendedHoursCheckbox?.checked}`);
    console.log(`  Extended Hours Parameter: ${extendedHours}`);
    
    const result = await window.electronAPI.polygonGetHistoricalBars({
      ticker: ticker,
      from: dateRange.from,
      to: dateRange.to,
      timespan: timespan,
      multiplier: multiplier,
      includeExtendedHours: extendedHours
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load chart data');
    }
    
    if (!result.bars || result.bars.length === 0) {
      throw new Error('No data available for this ticker and timeframe');
    }
    
    // Debug: Log first and last bar timestamps
    const firstBar = result.bars[0];
    const lastBar = result.bars[result.bars.length - 1];
    console.log(`[DATA CHECK] Received ${result.bars.length} bars`);
    console.log(`  First bar: ${new Date(firstBar.t).toISOString()}`);
    console.log(`  Last bar: ${new Date(lastBar.t).toISOString()}`);
    
    currentChartData = result.bars;
    drawCandlestickChart(ticker, result.bars, timespan, timeframe);
    
    loadingDiv.style.display = 'none';
    
  } catch (error) {
    console.error('Error loading chart:', error);
    loadingDiv.style.display = 'none';
    chartDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #e74c3c;">
        <div style="text-align: center;">
          <h3>Error Loading Chart</h3>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }
}

// Draw candlestick chart with no gaps (excludes non-trading days)
function drawCandlestickChart(ticker, bars, timespan, timeframe) {
  // Prepare data for Plotly
  // The key: use a categorical x-axis with only actual trading days/times
  
  const dates = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];
  
  // Determine tick angle and font size based on timeframe and data length
  const totalBars = bars.length;
  let tickAngle = -45;
  let tickFontSize = 10;
  let showEveryNth = 1;
  
  // Adjust display based on number of bars
  if (totalBars > 500) {
    tickAngle = -90;
    tickFontSize = 8;
    showEveryNth = Math.ceil(totalBars / 50); // Show ~50 labels max
  } else if (totalBars > 200) {
    showEveryNth = Math.ceil(totalBars / 100);
  }
  
  bars.forEach((bar, index) => {
    // Format timestamp based on timespan
    let dateLabel;
    const date = new Date(bar.t);
    
    if (timespan === 'month') {
      // Monthly: show month and year
      dateLabel = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short'
      });
    } else if (timespan === 'week') {
      // Weekly: show month, day, year
      dateLabel = date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (timespan === 'day') {
      // Daily: show date
      dateLabel = date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (timespan === 'hour') {
      // Hourly: Always show date and time for multi-day ranges
      dateLabel = date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        hour12: true
      });
    } else {
      // Minutes: Check if we span multiple days
      const firstBar = bars[0];
      const lastBar = bars[bars.length - 1];
      const firstDate = new Date(firstBar.t);
      const lastDate = new Date(lastBar.t);
      const spanMultipleDays = firstDate.toDateString() !== lastDate.toDateString();
      
      if (spanMultipleDays) {
        // Multi-day range: always show date + time
        dateLabel = date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } else {
        // Single day: show time only
        dateLabel = date.toLocaleTimeString('en-US', { 
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    }
    
    dates.push(dateLabel);
    open.push(bar.o);
    high.push(bar.h);
    low.push(bar.l);
    close.push(bar.c);
    volume.push(bar.v);
  });
  
  // Note: For daily bars, Polygon's API may include extended hours data in the OHLC by default
  // The includeOtc parameter primarily affects intraday (minute/hour) data
  // To get "regular hours only" daily data, we may need to use a different endpoint
  
  // Get chart type
  const chartType = document.getElementById('chartType')?.value || 'candlestick';
  
  // Create candlestick trace with solid filled candles
  // Get theme colors for candles
  const positiveColor = getPositiveColor();
  const negativeColor = getNegativeColor();
  
  const candlestickTrace = {
    type: 'candlestick',
    x: dates,
    open: open,
    high: high,
    low: low,
    close: close,
    name: ticker,
    increasing: { 
      line: { color: positiveColor, width: 1 },
      fillcolor: positiveColor  // Solid fill
    },
    decreasing: { 
      line: { color: negativeColor, width: 1 },
      fillcolor: negativeColor  // Solid fill
    },
    xaxis: 'x',
    yaxis: 'y',
    hoverinfo: 'text',  // Use custom hover text
    text: dates.map((date, i) => 
      `${date}<br>O: $${open[i].toFixed(2)}<br>H: $${high[i].toFixed(2)}<br>L: $${low[i].toFixed(2)}<br>C: $${close[i].toFixed(2)}`
    )
  };
  
  // Create volume trace with theme colors (33 = 20% opacity in hex)
  const volumeTrace = {
    type: 'bar',
    x: dates,
    y: volume,
    name: 'Volume',
    marker: {
      color: volume.map((v, i) => close[i] >= open[i] ? positiveColor + '33' : negativeColor + '33')
    },
    xaxis: 'x',
    yaxis: 'y2'
  };
  
  // Get chart title based on timespan
  let chartTitle = ticker;
  if (timespan === 'month') chartTitle += ' - Monthly';
  else if (timespan === 'week') chartTitle += ' - Weekly';
  else if (timespan === 'day') chartTitle += ' - Daily';
  else if (timespan === 'hour') chartTitle += ' - Hourly';
  else chartTitle += ' - Intraday';
  
  const extendedHours = document.getElementById('extendedHoursToggle')?.checked;
  if (extendedHours) chartTitle += ' (w/ Extended Hours)';
  
  const layout = {
    plot_bgcolor: '#000000',
    paper_bgcolor: '#000000',
    font: { family: 'Quantico, monospace', color: '#e0e0e0' },
    xaxis: {
      type: 'category', // KEY: Categorical x-axis = no gaps!
      rangeslider: { visible: false },
      gridcolor: '#1a1a1a',
      griddash: 'dot',
      showgrid: false,  // Hide vertical gridlines from dates
      tickangle: tickAngle,
      tickfont: { family: 'Quantico, monospace', size: tickFontSize },
      nticks: Math.min(15, Math.ceil(totalBars / 20)), // Much fewer ticks for cleaner look
      automargin: true,
      showspikes: true,  // Enable spike line
      spikemode: 'across',  // Draw line across entire plot
      spikesnap: 'cursor',  // Snap to cursor position
      spikecolor: '#666',  // Color of the crosshair line
      spikethickness: 0.5,  // Thinner line
      spikedash: 'dot'  // Dashed line
    },
    yaxis: {
      domain: [0.23, 1],  // More room above volume
      gridcolor: '#1a1a1a',
      griddash: 'dot',
      showgrid: true,  // Keep horizontal gridlines
      tickprefix: '$',
      showspikes: true,  // Enable horizontal spike line (will disable when locked)
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: '#666',
      spikethickness: 0.5,
      spikedash: 'dot'
    },
    yaxis2: {
      title: '',  // No title for volume axis
      domain: [0, 0.18],  // Increased height for volume chart
      gridcolor: '#1a1a1a',
      showgrid: false,
      showticklabels: false  // Hide volume numbers
    },
    margin: { l: 60, r: 40, t: 20, b: 140 },
    hovermode: 'closest',  // Changed from 'x unified' for better control
    hoverlabel: {
      bgcolor: 'rgba(26, 26, 26, 0.95)',  // Semi-transparent background
      bordercolor: '#444',
      font: { color: '#e0e0e0', size: 12 },
      align: 'left',
      namelength: -1  // Show full text
    },
    showlegend: false  // Hide legend completely
  };
  
  window.addWatermark(layout);
  
  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
    scrollZoom: true,
    editable: false,
    edits: {
      annotationPosition: false,
      annotationTail: false,
      annotationText: false,
      axisTitleText: false,
      colorbarPosition: false,
      colorbarTitleText: false,
      legendPosition: false,
      legendText: false,
      shapePosition: false,
      titleText: false
    },
    toImageButtonOptions: {
      format: 'png',
      filename: 'chart',
      height: 1080,
      width: 1920,
      scale: 2
    },
    modeBarButtonsToAdd: [{
      name: 'Pan',
      icon: Plotly.Icons.pan,
      click: function(gd) {
        Plotly.relayout(gd, 'dragmode', 'pan');
      }
    }]
  };
  
  // Set default drag mode to pan
  layout.dragmode = 'pan';
  layout.modebar = {
    ...layout.modebar,
    remove: ['select2d', 'lasso2d']
  };
  // Make all annotations non-editable
  if (layout.annotations) {
    layout.annotations.forEach(ann => {
      ann.editable = false;
      ann.captureevents = false;
    });
  }
  
  // Choose trace based on chart type
  let mainTrace;
  if (chartType === 'line') {
    // Create line chart trace
    mainTrace = {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: close,
      name: ticker,
      line: {
        color: '#4a9eff',
        width: 2
      },
      xaxis: 'x',
      yaxis: 'y',
      hovertemplate: '%{x}<br>Close: $%{y:.2f}<extra></extra>'
    };
  } else {
    mainTrace = candlestickTrace;
  }
  
  // Update volume trace hover
  volumeTrace.hovertemplate = 'Volume: %{y:,.0f}<extra></extra>';
  
  Plotly.newPlot('candlestickChart', [mainTrace, volumeTrace], layout, config).then(() => {
    const chartDiv = document.getElementById('candlestickChart');
    
    // Completely disable annotation dragging
    chartDiv._fullLayout._editing = false;
    
    // Also set pointer-events none on ALL annotations
    setTimeout(() => {
      const infoLayer = chartDiv.querySelector('.infolayer');
      if (infoLayer) {
        const annotations = infoLayer.querySelectorAll('g.annotation');
        annotations.forEach(ann => {
          ann.style.pointerEvents = 'none';
          ann.style.cursor = 'default';
        });
      }
    }, 100);
  });
  
  // Custom hover positioning to top-left
  // Use requestAnimationFrame to continuously reposition while hovering
  const chartDiv = document.getElementById('candlestickChart');
  let isHovering = false;
  let isCrosshairLocked = false;
  let animationFrameId = null;
  
  function repositionHoverLabels() {
    const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
    hoverGroups.forEach(group => {
      group.setAttribute('transform', 'translate(80, 80)');
      if (!group.classList.contains('positioned')) {
        group.classList.add('positioned');
      }
    });
    
    if (isHovering || isCrosshairLocked) {
      animationFrameId = requestAnimationFrame(repositionHoverLabels);
    }
  }
  
  chartDiv.on('plotly_hover', function(data) {
    isHovering = true;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    repositionHoverLabels();
  });
  
  chartDiv.on('plotly_unhover', function() {
    if (!isCrosshairLocked) {
      isHovering = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    }
  });
  
  // Crosshair lock functionality
  const crosshairLockToggle = document.getElementById('crosshairLockToggle');
  
  function applyCrosshairLock(isLocked) {
    isCrosshairLocked = isLocked;
    
    if (isCrosshairLocked) {
      // Enable crosshair lock - change hovermode to always show closest point
      // Remove horizontal crosshair line (only keep vertical)
      Plotly.relayout('candlestickChart', {
        'hovermode': 'x',
        'dragmode': false,  // Disable panning while locked
        'yaxis.showspikes': false  // Hide horizontal crosshair when locked
      });
      
      // Force hover on current mouse position
      isHovering = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      repositionHoverLabels();
    } else {
      // Disable crosshair lock - return to normal behavior
      // Restore horizontal crosshair line
      Plotly.relayout('candlestickChart', {
        'hovermode': 'closest',
        'dragmode': 'pan',
        'yaxis.showspikes': true  // Show horizontal crosshair when unlocked
      });
      
      isHovering = false;
      isCrosshairLocked = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      Plotly.Fx.unhover('candlestickChart');
      const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    }
  }
  
  crosshairLockToggle.addEventListener('change', function() {
    applyCrosshairLock(this.checked);
  });
  
  // Apply crosshair lock state on chart load if checkbox is checked
  if (crosshairLockToggle.checked) {
    setTimeout(() => applyCrosshairLock(true), 100);
  }
}

// Update live candle with websocket data
function updateLiveCandle(data) {
  if (!currentChartData || currentChartData.length === 0) return;
  
  try {
    // Get the last bar
    const lastBar = currentChartData[currentChartData.length - 1];
    const barTime = new Date(lastBar.t);
    const now = new Date();
    
    // Check if we're still in the same time period as the last bar
    const interval = document.getElementById('chartInterval')?.value;
    const { timespan, multiplier } = getTimespanParams(interval);
    
    let sameBar = false;
    if (timespan === 'minute') {
      // For minute bars, check if we're in the same minute interval
      const barMinute = Math.floor(barTime.getTime() / (multiplier * 60000));
      const nowMinute = Math.floor(now.getTime() / (multiplier * 60000));
      sameBar = barMinute === nowMinute;
    }
    
    if (sameBar) {
      // Update the last bar with live data
      lastBar.c = data.close;
      lastBar.h = Math.max(lastBar.h, data.close);
      lastBar.l = Math.min(lastBar.l, data.close);
      lastBar.v += data.volume || 0;
      
      // Redraw chart
      const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
      if (ticker) {
        drawCandlestickChart(ticker, currentChartData, timespan);
      }
    }
  } catch (error) {
    console.error('Error updating live candle:', error);
  }
}

// Update chart when window resizes
window.addEventListener('resize', () => {
  if (currentChartData && document.getElementById('candlestickChart').innerHTML) {
    const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
    const interval = document.getElementById('chartInterval')?.value;
    const { timespan } = getTimespanParams(interval);
    if (ticker) {
      drawCandlestickChart(ticker, currentChartData, timespan);
    }
  }
});

// Initialize chart watchlists when watchlists are loaded/updated
function refreshChartWatchlists() {
  initializeChartWatchlists();
}

// Call refresh when watchlist changes
// Note: saveWatchlistsToStorage is defined in the watchlists module
if (typeof window.saveWatchlistsToStorage !== 'undefined') {
  const originalSaveWatchlists = window.saveWatchlistsToStorage;
  window.saveWatchlistsToStorage = function() {
    originalSaveWatchlists();
    refreshChartWatchlists();
  };
}

// Initialize on load
setTimeout(() => {
  initializeChartWatchlists();
}, 1000);

// ========================================

// Export for external use
export const CandlestickChart = {
  loadChart: loadCandlestickChart,
  drawChart: drawCandlestickChart,
  rerender: rerenderMainChart,
  getNormalized: () => chartNormalized,
  setNormalized: (value) => { chartNormalized = value; }
};

// Expose to window for backward compatibility
window.CandlestickChart = CandlestickChart;
window.loadCandlestickChart = loadCandlestickChart;
window.drawCandlestickChart = drawCandlestickChart;
window.rerenderMainChart = rerenderMainChart;

export default CandlestickChart;
