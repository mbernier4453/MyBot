/**
 * RSI Dashboard Module
 * RSI analysis and basket screening functionality
 */

import tickerGroups from '../core/ticker-groups.js';

// ========================================
// RSI Dashboard Functions
// ========================================

let rsiCurrentWatchlist = null;
let rsiSelectedSymbol = null;
let rsiBasketData = [];

// Helper function to get date range for a given timeframe
function getDateRange(timeframe, interval) {
  const now = new Date();
  const to = new Date(now.getTime());
  const from = new Date(now.getTime());
  
  switch(timeframe) {
    case '1D':
      from.setHours(0, 0, 0, 0);
      break;
    case '5D':
      from.setTime(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case '1M':
      from.setMonth(from.getMonth() - 1);
      break;
    case '3M':
      from.setMonth(from.getMonth() - 3);
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
    default:
      from.setFullYear(from.getFullYear() - 1);
  }
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return { from: formatDate(from), to: formatDate(to) };
}

// Helper function to get timespan parameters for Polygon API
function getTimespanParams(interval) {
  const intervalMap = {
    '1': { timespan: 'minute', multiplier: 1 },
    '5': { timespan: 'minute', multiplier: 5 },
    '15': { timespan: 'minute', multiplier: 15 },
    '30': { timespan: 'minute', multiplier: 30 },
    '60': { timespan: 'hour', multiplier: 1 },
    '240': { timespan: 'hour', multiplier: 4 },
    'day': { timespan: 'day', multiplier: 1 },
    'week': { timespan: 'week', multiplier: 1 },
    'month': { timespan: 'month', multiplier: 1 }
  };
  
  return intervalMap[interval] || { timespan: 'day', multiplier: 1 };
}

// Helper function to fetch market data for RSI calculations
async function fetchRSIMarketData(ticker, timeframe, interval) {
  try {
    const dateRange = getDateRange(timeframe, interval);
    const { timespan, multiplier } = getTimespanParams(interval);
    
    // Check if running in Electron or browser
    if (window.electronAPI && window.electronAPI.polygonGetHistoricalBars) {
      // Electron mode - use IPC
      const result = await window.electronAPI.polygonGetHistoricalBars({
        ticker: ticker,
        from: dateRange.from,
        to: dateRange.to,
        timespan: timespan,
        multiplier: multiplier,
        includeExtendedHours: false
      });
      
      if (result.success && result.bars && result.bars.length > 0) {
        return result.bars;
      }
    } else if (window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY) {
      // Browser mode - use REST API directly
      const apiKey = window.POLYGON_API_KEY || window.api.POLYGON_API_KEY;
      const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${dateRange.from}/${dateRange.to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Convert Polygon format to internal format
        return data.results.map(bar => ({
          timestamp: bar.t,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v
        }));
      }
    } else {
      console.error('[RSI DASHBOARD] No Polygon API key configured');
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}
// END INDICATOR CALCULATION FUNCTIONS
// ========================================

// Calculate RSI using Wilder's smoothing method (original - returns object array)
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    return null;
  }

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;

  // Calculate RSI values
  const rsiValues = [];
  
  for (let i = period; i < changes.length; i++) {
    const currentChange = changes[i];
    const gain = currentChange > 0 ? currentChange : 0;
    const loss = currentChange < 0 ? Math.abs(currentChange) : 0;
    
    // Wilder's smoothing
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    rsiValues.push({ rsi, index: i + 1 });
  }

  return rsiValues;
}

// Calculate Bollinger Bands for RSI
function calculateRSIBollinger(rsiValues, period = 20, stdDevMultiplier = 2) {
  if (!rsiValues || rsiValues.length < period) {
    return null;
  }

  // Convert to normalized format: {rsi: number, index: number}
  // Handle both plain number arrays and object arrays
  const normalizedValues = rsiValues.map((val, idx) => {
    if (typeof val === 'number') {
      return { rsi: val, index: idx };
    } else if (val && typeof val.rsi === 'number') {
      return { rsi: val.rsi, index: val.index !== undefined ? val.index : idx };
    } else {
      return null;
    }
  }).filter(val => val !== null && !isNaN(val.rsi));
  
  if (normalizedValues.length < period) {
    return null;
  }

  const result = [];
  
  for (let i = period - 1; i < normalizedValues.length; i++) {
    const slice = normalizedValues.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val.rsi, 0);
    const mean = sum / period;
    
    const squaredDiffs = slice.map(val => Math.pow(val.rsi - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const stdDev = Math.sqrt(variance);
    
    result.push({
      rsi: normalizedValues[i].rsi,
      sma: mean,
      upper: mean + (stdDevMultiplier * stdDev),
      lower: mean - (stdDevMultiplier * stdDev),
      index: normalizedValues[i].index
    });
  }
  
  return result;
}

// Initialize RSI Dashboard
function initializeRSIDashboard() {
  const sourceSelect = document.getElementById('rsiSourceSelect');
  const watchlistGroup = document.getElementById('rsiWatchlistGroup');
  const tickerGroup = document.getElementById('rsiTickerGroup');
  const groupSelectGroup = document.getElementById('rsiGroupSelectGroup');
  const watchlistSelect = document.getElementById('rsiWatchlistSelect');
  const groupSelect = document.getElementById('rsiGroupSelect');
  const refreshBtn = document.getElementById('rsiRefreshBtn');
  const tickerInput = document.getElementById('rsiTickerInput');

  let currentGroupSubscription = null;

  // Populate watchlist dropdown - get from WatchlistsModule (handles Supabase + localStorage)
  let watchlists = [];
  if (window.WatchlistsModule && window.WatchlistsModule.getWatchlists) {
    watchlists = window.WatchlistsModule.getWatchlists();
    console.log('[RSI] Loaded', watchlists.length, 'watchlists from WatchlistsModule');
  } else {
    // Fallback to localStorage
    watchlists = JSON.parse(localStorage.getItem('watchlists')) || [];
    console.log('[RSI] Loaded', watchlists.length, 'watchlists from localStorage');
  }
  
  watchlistSelect.innerHTML = '<option value="">Choose a watchlist...</option>';
  watchlists.forEach(wl => {
    const option = document.createElement('option');
    option.value = wl.name;
    option.textContent = wl.name;
    watchlistSelect.appendChild(option);
  });

  // Subscribe to group ticker changes
  function subscribeToGroup(group, loadExisting = false) {
    // Unsubscribe from previous group
    if (currentGroupSubscription) {
      tickerGroups.unsubscribe(currentGroupSubscription.group, currentGroupSubscription.callback);
    }

    if (group && group !== 'None') {
      const callback = (ticker) => {
        // Only load if in single ticker mode and ticker changed
        if (ticker && sourceSelect.value === 'single' && tickerInput.value !== ticker) {
          console.log(`[RSI] Group ${group} changed to ticker ${ticker}`);
          tickerInput.value = ticker;
          loadRSISingleTicker(ticker, group);
        }
      };
      
      tickerGroups.subscribe(group, callback);
      currentGroupSubscription = { group, callback };
      
      // Only load existing ticker if explicitly requested
      if (loadExisting) {
        const existingTicker = tickerGroups.getGroupTicker(group);
        if (existingTicker && existingTicker !== tickerInput.value) {
          console.log(`[RSI] Loading existing ticker ${existingTicker} from group ${group}`);
          tickerInput.value = existingTicker;
          loadRSISingleTicker(existingTicker, group);
        }
      }
    } else {
      currentGroupSubscription = null;
    }
  }

  // Toggle between watchlist and single ticker mode
  sourceSelect.addEventListener('change', () => {
    if (sourceSelect.value === 'watchlist') {
      watchlistGroup.style.display = 'flex';
      tickerGroup.style.display = 'none';
      groupSelectGroup.style.display = 'none';
    } else {
      watchlistGroup.style.display = 'none';
      tickerGroup.style.display = 'flex';
      groupSelectGroup.style.display = 'flex';
      // Subscribe to current group when switching to single ticker mode (but don't auto-load)
      subscribeToGroup(groupSelect.value, false);
    }
  });

  // Group selection change
  groupSelect.addEventListener('change', () => {
    // When user changes group, load the ticker if it exists
    subscribeToGroup(groupSelect.value, true);
  });

  // Load watchlist data
  watchlistSelect.addEventListener('change', () => {
    if (watchlistSelect.value) {
      loadRSIWatchlistData(watchlistSelect.value);
    }
  });

  // Refresh button
  refreshBtn.addEventListener('click', () => {
    if (sourceSelect.value === 'watchlist' && watchlistSelect.value) {
      loadRSIWatchlistData(watchlistSelect.value);
    } else if (sourceSelect.value === 'single') {
      const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
      if (ticker) {
        const group = groupSelect.value;
        loadRSISingleTicker(ticker, group);
      }
    }
  });

  // Enter key for ticker input
  document.getElementById('rsiTickerInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
      if (ticker) {
        const group = groupSelect.value;
        loadRSISingleTicker(ticker, group);
      }
    }
  });

  // RSI period change - reload all data
  document.getElementById('rsiPeriod').addEventListener('change', async () => {
    // Update all headers first
    updateRSIHeaders();
    
    const sourceSelect = document.getElementById('rsiSourceSelect');
    const watchlistSelect = document.getElementById('rsiWatchlistSelect');
    
    if (sourceSelect.value === 'watchlist' && watchlistSelect.value) {
      await loadRSIWatchlistData(watchlistSelect.value);
    } else if (sourceSelect.value === 'single') {
      const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
      if (ticker) {
        const group = document.getElementById('rsiGroupSelect')?.value || 'None';
        await loadRSISingleTicker(ticker, group);
      }
    }
    
    // After reloading data, refresh the chart if a symbol is selected
    if (rsiSelectedSymbol) {
      await selectRSISymbol(rsiSelectedSymbol);
    }
  });
  
  // Bollinger period change - refresh chart if symbol selected
  document.getElementById('rsiBollingerPeriod').addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });

  // Standard deviation slider
  const stdDevSlider = document.getElementById('rsiBollingerStdDev');
  const stdDevValue = document.getElementById('rsiStdDevValue');
  
  stdDevSlider.addEventListener('input', () => {
    stdDevValue.textContent = parseFloat(stdDevSlider.value).toFixed(1);
  });
  
  stdDevSlider.addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });
  
  // Chart time range change
  document.getElementById('rsiChartTimeRange').addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });
}

// Load RSI data for a watchlist
async function loadRSIWatchlistData(watchlistName) {
  console.log('Loading RSI data for watchlist:', watchlistName);
  
  // Get watchlists from WatchlistsModule (handles Supabase + localStorage)
  let watchlists = [];
  if (window.WatchlistsModule && window.WatchlistsModule.getWatchlists) {
    watchlists = window.WatchlistsModule.getWatchlists();
  } else {
    // Fallback to localStorage
    watchlists = JSON.parse(localStorage.getItem('watchlists')) || [];
  }
  
  const watchlist = watchlists.find(wl => wl.name === watchlistName);
  
  if (!watchlist || !watchlist.tickers || watchlist.tickers.length === 0) {
    console.log('No tickers in watchlist');
    return;
  }

  rsiCurrentWatchlist = watchlistName;
  rsiBasketData = [];

  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  // Fetch daily RSI for each ticker
  const promises = watchlist.tickers.map(async (ticker) => {
    try {
      // Get 1 year of daily data for RSI calculation
      const data = await fetchRSIMarketData(ticker, '1Y', 'day');
      
      if (data && data.length > rsiPeriod) {
        const closes = data.map(bar => bar.close || bar.c).filter(c => c !== null && c !== undefined && !isNaN(c));
        
        if (closes.length <= rsiPeriod) {
          console.warn(`${ticker}: Not enough valid price data after filtering`);
          return null;
        }
        
        const rsiValues = calculateRSI(closes, rsiPeriod);
        
        if (rsiValues && rsiValues.length > 0) {
          // calculateRSI returns array of numbers (or objects with .rsi property)
          // Handle both formats
          const lastRSI = rsiValues[rsiValues.length - 1];
          const currentRSI = typeof lastRSI === 'number' ? lastRSI : (lastRSI ? lastRSI.rsi : undefined);
          
          // Calculate Bollinger Bands for coloring
          let bollingerStatus = 'neutral';
          if (rsiValues.length >= 20) {
            const bollingerData = calculateRSIBollinger(rsiValues, 20);
            if (bollingerData && bollingerData.length > 0) {
              const lastBB = bollingerData[bollingerData.length - 1];
              if (lastBB && lastBB.upper !== undefined && lastBB.lower !== undefined) {
                if (currentRSI > lastBB.upper) {
                  bollingerStatus = 'overbought'; // Above upper band
                } else if (currentRSI < lastBB.lower) {
                  bollingerStatus = 'oversold'; // Below lower band
                }
              }
            }
          }
          
          // Final validation before returning
          if (currentRSI === undefined || currentRSI === null || isNaN(currentRSI)) {
            console.warn(`${ticker}: currentRSI is invalid:`, currentRSI);
            return null;
          }
          
          return {
            ticker,
            rsi: currentRSI,
            data: data,
            rsiValues: rsiValues,
            bollingerStatus: bollingerStatus
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching RSI for ${ticker}:`, error);
    }
    return null;
  });

  const results = await Promise.all(promises);
  rsiBasketData = results.filter(r => r !== null);

  // Sort by RSI descending
  rsiBasketData.sort((a, b) => b.rsi - a.rsi);

  updateRSIHeaders();
  renderRSIBasketTable();
  
  document.getElementById('rsiBasketCount').textContent = `${rsiBasketData.length} symbols`;
}

// Track loading state to prevent duplicate requests
let currentLoadingTicker = null;

// Load RSI data for a single ticker
async function loadRSISingleTicker(ticker, group = 'None') {
  console.log('Loading RSI data for single ticker:', ticker, 'Group:', group);
  
  // Prevent duplicate concurrent loads
  if (currentLoadingTicker === ticker) {
    console.log(`[RSI] Already loading ${ticker}, skipping duplicate request`);
    return;
  }
  
  currentLoadingTicker = ticker;
  
  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  try {
    const data = await fetchRSIMarketData(ticker, '1Y', 'day');
    console.log(`[RSI] Fetched data for ${ticker}:`, data ? `${data.length} bars` : 'null');
    
    if (data && data.length > rsiPeriod) {
      const closes = data.map(bar => bar.close || bar.c);
      console.log(`[RSI] Extracted ${closes.length} close prices`);
      const rsiValues = calculateRSI(closes, rsiPeriod);
      console.log(`[RSI] Calculated ${rsiValues?.length || 0} RSI values`);
      
      if (rsiValues && rsiValues.length > 0) {
        const currentRSI = rsiValues[rsiValues.length - 1].rsi;
        
        // Calculate Bollinger Bands for coloring
        let bollingerStatus = 'neutral';
        if (rsiValues.length >= 20) {
          const bollingerData = calculateRSIBollinger(rsiValues, 20);
          if (bollingerData && bollingerData.length > 0) {
            const lastBB = bollingerData[bollingerData.length - 1];
            if (currentRSI > lastBB.upper) {
              bollingerStatus = 'overbought';
            } else if (currentRSI < lastBB.lower) {
              bollingerStatus = 'oversold';
            }
          }
        }
        
        rsiBasketData = [{
          ticker,
          group,  // Store the group with the ticker
          rsi: currentRSI,
          data: data,
          rsiValues: rsiValues,
          bollingerStatus: bollingerStatus
        }];
        
        // Set the ticker in the group so it syncs to other tabs
        if (group && group !== 'None') {
          tickerGroups.setGroupTicker(group, ticker);
          console.log(`[RSI] Set ticker ${ticker} for group ${group}`);
        }
        
        console.log(`[RSI] Adding ${ticker} to basket. Basket now has ${rsiBasketData.length} items`);
        updateRSIHeaders();
        renderRSIBasketTable();
        document.getElementById('rsiBasketCount').textContent = '1 symbol';
        console.log(`[RSI] UI updated for ${ticker}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching RSI for ${ticker}:`, error);
  } finally {
    // Clear loading state
    currentLoadingTicker = null;
  }
}

// Update all headers with current RSI period
function updateRSIHeaders() {
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  // Update basket table column header
  const basketTableHeader = document.getElementById('rsiBasketTableHeader');
  if (basketTableHeader) {
    basketTableHeader.textContent = `RSI (${rsiPeriod}D)`;
  }
  
  // Update history panel header
  const historyHeader = document.getElementById('rsiHistoryHeader');
  if (historyHeader) {
    historyHeader.textContent = `RSI (${rsiPeriod}D)`;
  }
  
  // Update synergy table header
  const synergyTableHeader = document.getElementById('rsiSynergyTableHeader');
  if (synergyTableHeader) {
    synergyTableHeader.textContent = `Period (${rsiPeriod})`;
  }
  
  // Update chart panel header
  const chartHeader = document.getElementById('rsiChartHeader');
  if (chartHeader) {
    chartHeader.textContent = `Bollinger Bands of RSI (${rsiPeriod}D)`;
  }
}

// Render the basket table
// RSI Color Based on Bollinger Bands (20-period for basket):
// - Green (Oversold): RSI below lower Bollinger Band - Potential buying opportunity
// - Red (Overbought): RSI above upper Bollinger Band - Potential selling opportunity  
// - Gray/White (Neutral): RSI within Bollinger Bands - Normal trading range
function renderRSIBasketTable() {
  console.log(`[RSI] renderRSIBasketTable called with ${rsiBasketData.length} items`);
  const tbody = document.getElementById('rsiBasketTable').querySelector('tbody');
  if (!tbody) {
    console.error('[RSI] Could not find rsiBasketTable tbody element');
    return;
  }
  tbody.innerHTML = '';

  if (rsiBasketData.length === 0) {
    console.log('[RSI] No basket data, showing empty state');
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="2">No data available</td></tr>';
    return;
  }

  rsiBasketData.forEach(item => {
    // Skip items with invalid RSI
    if (!item || item.rsi === undefined || item.rsi === null || isNaN(item.rsi)) {
      return;
    }
    
    const row = document.createElement('tr');
    if (item.ticker === rsiSelectedSymbol) {
      row.classList.add('selected');
    }

    const tickerCell = document.createElement('td');
    tickerCell.textContent = item.ticker;

    const rsiCell = document.createElement('td');
    const rsiValue = item.rsi.toFixed(2);
    const status = item.bollingerStatus || 'neutral';
    
    rsiCell.innerHTML = `
      <div class="rsi-value-cell">
        <div class="rsi-value-bar" style="width: ${item.rsi}%; background: ${
          status === 'oversold' ? 'rgba(34, 197, 94, 0.4)' :
          status === 'overbought' ? 'rgba(239, 68, 68, 0.4)' :
          'rgba(150, 150, 150, 0.4)'
        }"></div>
        <span class="numeric ${
          status === 'oversold' ? 'rsi-oversold' :
          status === 'overbought' ? 'rsi-overbought' :
          'rsi-neutral'
        }">${rsiValue}</span>
      </div>
    `;

    row.appendChild(tickerCell);
    row.appendChild(rsiCell);

    row.addEventListener('click', () => {
      selectRSISymbol(item.ticker);
    });

    tbody.appendChild(row);
  });
}

// Select a symbol and load its details
async function selectRSISymbol(ticker) {
  console.log('Selected RSI symbol:', ticker);
  rsiSelectedSymbol = ticker;

  // Update all headers
  updateRSIHeaders();
  
  // Update selection in basket table
  renderRSIBasketTable();

  // Update panel headers with symbol names
  document.getElementById('rsiHistorySymbol').textContent = ticker;
  document.getElementById('rsiSynergySymbol').textContent = ticker;
  document.getElementById('rsiChartSymbol').textContent = ticker;

  // Find the ticker data
  const tickerData = rsiBasketData.find(item => item.ticker === ticker);
  console.log('[RSI] Found ticker data:', tickerData ? 'yes' : 'no', tickerData);
  
  if (tickerData) {
    console.log('[RSI] Rendering history chart...');
    await renderRSIHistory(ticker, tickerData);
    console.log('[RSI] Rendering synergy panel...');
    await renderRSISynergy(ticker);
    console.log('[RSI] Rendering Bollinger chart...');
    await renderRSIBollingerChart(ticker, tickerData);
    console.log('[RSI] All charts rendered');
  } else {
    console.error('[RSI] No data found for ticker:', ticker);
  }
}

// Render RSI History table
async function renderRSIHistory(ticker, tickerData) {
  console.log('[RSI] renderRSIHistory called for', ticker, 'data length:', tickerData?.data?.length);
  const tbody = document.getElementById('rsiHistoryTable').querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  const windows = [
    { name: '3M', days: 90 },
    { name: '6M', days: 180 },
    { name: '1Y', days: 365 },
    { name: '2Y', days: 730 },
    { name: '5Y', days: 1825 }
  ];

  tbody.innerHTML = '';

  for (const window of windows) {
    try {
      // Calculate the date range
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - window.days);

      // Filter data for this window
      const windowData = tickerData.data.filter(bar => {
        const barDate = new Date(bar.timestamp || bar.t);
        return barDate >= fromDate && barDate <= toDate;
      });

      // Get selected RSI period
      const rsiPeriodSelect = document.getElementById('rsiPeriod');
      const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
      
      if (windowData.length > rsiPeriod) {
        const closes = windowData.map(bar => bar.close || bar.c);
        const rsiValues = calculateRSI(closes, rsiPeriod);

        if (rsiValues && rsiValues.length > 0) {
          // Find min and max RSI
          let minRSI = Infinity;
          let maxRSI = -Infinity;
          let minDate = null;
          let maxDate = null;

          rsiValues.forEach((rsiItem, idx) => {
            const dataIdx = idx + 14; // RSI starts after 14 periods
            if (dataIdx < windowData.length) {
              // Handle both RSI function formats
              const rsiValue = typeof rsiItem === 'number' ? rsiItem : (rsiItem ? rsiItem.rsi : null);
              if (rsiValue !== null && rsiValue !== undefined) {
                if (rsiValue < minRSI) {
                  minRSI = rsiValue;
                  minDate = new Date(windowData[dataIdx].timestamp || windowData[dataIdx].t);
                }
                if (rsiValue > maxRSI) {
                  maxRSI = rsiValue;
                  maxDate = new Date(windowData[dataIdx].timestamp || windowData[dataIdx].t);
                }
              }
            }
          });

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${window.name}</td>
            <td class="synergy-rsi-low">${minRSI.toFixed(2)}</td>
            <td class="history-date">${minDate ? minDate.toLocaleDateString() : '-'}</td>
            <td class="synergy-rsi-high">${maxRSI.toFixed(2)}</td>
            <td class="history-date">${maxDate ? maxDate.toLocaleDateString() : '-'}</td>
          `;
          tbody.appendChild(row);
        }
      }
    } catch (error) {
      console.error(`Error calculating RSI for ${window.name}:`, error);
    }
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="5">No data available</td></tr>';
  }
}

// Render RSI Synergy table
async function renderRSISynergy(ticker) {
  const tbody = document.getElementById('rsiSynergyTable').querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';

  const timeframes = [
    { name: 'Weekly', timeframe: '1Y', interval: 'week' },
    { name: 'Daily', timeframe: '1Y', interval: 'day' },
    { name: '60 Min', timeframe: '1M', interval: '60' },
    { name: '15 Min', timeframe: '5D', interval: '15' },
    { name: '5 Min', timeframe: '5D', interval: '5' }
  ];

  tbody.innerHTML = '';

  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  for (const tf of timeframes) {
    try {
      const data = await fetchRSIMarketData(ticker, tf.timeframe, tf.interval);
      
      if (data && data.length > rsiPeriod) {
        const closes = data.map(bar => bar.close || bar.c);
        const rsiValues = calculateRSI(closes, rsiPeriod);
        
        if (rsiValues && rsiValues.length > 0) {
          const lastRSI = rsiValues[rsiValues.length - 1];
          // Handle both RSI function formats
          const currentRSI = typeof lastRSI === 'number' ? lastRSI : (lastRSI ? lastRSI.rsi : undefined);
          
          if (currentRSI === undefined || currentRSI === null || isNaN(currentRSI)) {
            continue; // Skip this timeframe if RSI is invalid
          }
          
          // Check Bollinger status for this timeframe
          let bollingerStatus = '';
          if (rsiValues.length >= 20) {
            const bollingerData = calculateRSIBollinger(rsiValues, 20);
            if (bollingerData && bollingerData.length > 0) {
              const lastBB = bollingerData[bollingerData.length - 1];
              if (currentRSI > lastBB.upper) {
                bollingerStatus = 'synergy-rsi-high';
              } else if (currentRSI < lastBB.lower) {
                bollingerStatus = 'synergy-rsi-low';
              }
            }
          }
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${tf.name}</td>
            <td class="${bollingerStatus}">${currentRSI.toFixed(2)}</td>
          `;
          tbody.appendChild(row);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${tf.name} RSI:`, error);
    }
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="2">No data available</td></tr>';
  }
}

// Render RSI Bollinger Bands chart
async function renderRSIBollingerChart(ticker, tickerData) {
  const chartDiv = document.getElementById('rsiBollingerChart');
  const loadingDiv = document.getElementById('rsiChartLoading');
  const emptyDiv = document.getElementById('rsiChartEmpty');

  emptyDiv.style.display = 'none';
  loadingDiv.style.display = 'flex';

  try {
    // Get selected RSI period, Bollinger period and std dev
    const rsiPeriodSelect = document.getElementById('rsiPeriod');
    const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
    const bollingerPeriodSelect = document.getElementById('rsiBollingerPeriod');
    const bollingerPeriod = parseInt(bollingerPeriodSelect?.value || '20');
    const stdDevSlider = document.getElementById('rsiBollingerStdDev');
    const stdDevMultiplier = parseFloat(stdDevSlider?.value || '2');
    
    // Get selected chart time range
    const timeRangeSelect = document.getElementById('rsiChartTimeRange');
    const timeRange = timeRangeSelect?.value || '1Y';
    
    // Fetch data based on selected time range
    // For 1Y, fetch 2Y so user can pan back to see more history
    const fetchRange = timeRange === '1Y' ? '2Y' : timeRange;
    const data = await fetchRSIMarketData(ticker, fetchRange, 'day');
    
    const minBars = rsiPeriod + bollingerPeriod; // Need RSI period + Bollinger period
    if (!data || data.length < minBars) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    const closes = data.map(bar => bar.close || bar.c);
    const dates = data.map(bar => new Date(bar.timestamp || bar.t));
    const rsiValues = calculateRSI(closes, rsiPeriod);
    
    if (!rsiValues || rsiValues.length < bollingerPeriod) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    const bollingerData = calculateRSIBollinger(rsiValues, bollingerPeriod, stdDevMultiplier);
    
    if (!bollingerData) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    // Prepare data for plotting
    const chartDates = bollingerData.map(item => dates[item.index]);
    const rsiLine = bollingerData.map(item => item.rsi);
    const upperBand = bollingerData.map(item => item.upper);
    const lowerBand = bollingerData.map(item => item.lower);

    // Check for data gaps (warn if gap > 7 days between consecutive bars)
    let hasSignificantGap = false;
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        console.warn(`${ticker}: Data gap detected - ${daysDiff.toFixed(0)} days between ${dates[i-1].toLocaleDateString()} and ${dates[i].toLocaleDateString()}`);
        hasSignificantGap = true;
      }
    }

    // Create traces
    const smaLine = bollingerData.map(item => item.sma);
    
    // Get CSS variables for colors
    const accentBlue = getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim() || '#00aa55';
    const accentGreen = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim() || '#006633';
    
    const upperTrace = {
      x: chartDates,
      y: upperBand,
      type: 'scatter',
      mode: 'lines',
      name: 'Upper Band',
      line: { color: accentGreen, width: 1.5, dash: 'dot' },
      hovertemplate: 'Upper: %{y:.2f}<extra></extra>',
      hoverlabel: { namelength: 0 }
    };

    const middleTrace = {
      x: chartDates,
      y: smaLine,
      type: 'scatter',
      mode: 'lines',
      name: `Middle (${bollingerPeriod}-SMA)`,
      line: { color: '#666', width: 1, dash: 'dash' },
      hovertemplate: `${bollingerPeriod}-SMA: %{y:.2f}<extra></extra>`,
      hoverlabel: { namelength: 0 }
    };

    const rsiTrace = {
      x: chartDates,
      y: rsiLine,
      type: 'scatter',
      mode: 'lines',
      name: `RSI (${rsiPeriod}D)`,
      line: { color: accentBlue, width: 2 },
      hovertemplate: `RSI(${rsiPeriod}): %{y:.2f}<extra></extra>`,
      hoverlabel: { namelength: 0 }
    };

    const lowerTrace = {
      x: chartDates,
      y: lowerBand,
      type: 'scatter',
      mode: 'lines',
      name: 'Lower Band',
      line: { color: accentGreen, width: 1.5, dash: 'dot' },
      hovertemplate: 'Lower: %{y:.2f}<extra></extra>',
      hoverlabel: { namelength: 0 }
    };

    // Reference lines at 30 and 70
    const oversoldLine = {
      x: chartDates,
      y: Array(chartDates.length).fill(30),
      type: 'scatter',
      mode: 'lines',
      name: 'Oversold (30)',
      line: { color: '#666', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false
    };

    const overboughtLine = {
      x: chartDates,
      y: Array(chartDates.length).fill(70),
      type: 'scatter',
      mode: 'lines',
      name: 'Overbought (70)',
      line: { color: '#666', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false
    };

    // Calculate x-axis range for 1Y option (show last year but allow panning back)
    let xAxisRange = undefined;
    if (timeRange === '1Y' && chartDates.length > 0) {
      const lastDate = new Date(chartDates[chartDates.length - 1]);
      const oneYearAgo = new Date(lastDate);
      oneYearAgo.setFullYear(lastDate.getFullYear() - 1);
      xAxisRange = [oneYearAgo.toISOString(), lastDate.toISOString()];
    }

    const layout = {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Quantico, monospace', color: '#e4e4e7', size: 11 },
      margin: { l: 60, r: 40, t: 10, b: 60 },
      xaxis: {
        gridcolor: '#1a1a1a',
        showgrid: false,
        rangeslider: { visible: false },
        showspikes: true,
        spikemode: 'across',
        spikesnap: 'cursor',
        spikecolor: '#666',
        spikethickness: 0.5,
        spikedash: 'dot',
        range: xAxisRange,
        tickfont: { family: 'Quantico, monospace' }
      },
      yaxis: {
        title: 'RSI',
        titlefont: { family: 'Quantico, monospace' },
        tickfont: { family: 'Quantico, monospace' },
        gridcolor: '#333',
        griddash: 'dot',
        gridwidth: 0.5,
        showgrid: true,
        range: [0, 100],
        showspikes: false
      },
      hovermode: 'x',
      dragmode: 'pan',
      showlegend: false  // Hide Plotly's legend, use custom one
    };

    window.addWatermark(layout);

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
    };

    Plotly.newPlot(chartDiv, [oversoldLine, overboughtLine, lowerTrace, middleTrace, rsiTrace, upperTrace], layout, config);
    
    // Force resize to prevent squished chart
    setTimeout(() => {
      Plotly.Plots.resize(chartDiv);
    }, 100);
    
    // Setup custom legend
    const legendEl = document.querySelector('.custom-rsi-legend');
    const currentValuesEl = document.getElementById('rsiCurrentValues');
    
    // Show current values (last data point)
    const lastRSI = rsiLine[rsiLine.length - 1];
    const lastUpper = upperBand[upperBand.length - 1];
    const lastLower = lowerBand[lowerBand.length - 1];
    
    currentValuesEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 12px; height: 12px; background: ${accentBlue}; border-radius: 2px;"></div>
        <span>RSI: ${lastRSI.toFixed(2)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 12px; height: 12px; background: ${accentGreen}; border-radius: 2px;"></div>
        <span>Upper: ${lastUpper.toFixed(2)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 12px; height: 12px; background: ${accentGreen}; border-radius: 2px;"></div>
        <span>Lower: ${lastLower.toFixed(2)}</span>
      </div>
    `;
    
    // Custom legend on hover
    chartDiv.on('plotly_hover', function(data) {
      if (!data.points || data.points.length === 0) return;
      
      const point = data.points[0];
      const xIndex = point.pointIndex;
      
      const rsiVal = rsiLine[xIndex];
      const upperVal = upperBand[xIndex];
      const lowerVal = lowerBand[xIndex];
      const smaVal = smaLine[xIndex];
      const dateStr = chartDates[xIndex].toLocaleDateString();
      
      let html = `<div style="margin-bottom: 4px; font-weight: bold;">${dateStr}</div>`;
      html += `<div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 12px; height: 12px; background: ${accentBlue}; border-radius: 2px; margin-right: 6px;"></div>
        <span>RSI: <span class="numeric">${rsiVal.toFixed(2)}</span></span>
      </div>`;
      html += `<div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 12px; height: 12px; background: ${accentGreen}; border-radius: 2px; margin-right: 6px;"></div>
        <span>Upper: <span class="numeric">${upperVal.toFixed(2)}</span></span>
      </div>`;
      html += `<div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 12px; height: 12px; background: ${accentGreen}; border-radius: 2px; margin-right: 6px;"></div>
        <span>Lower: <span class="numeric">${lowerVal.toFixed(2)}</span></span>
      </div>`;
      html += `<div style="display: flex; align-items: center;">
        <div style="width: 12px; height: 12px; background: #666; border-radius: 2px; margin-right: 6px;"></div>
        <span>SMA: <span class="numeric">${smaVal.toFixed(2)}</span></span>
      </div>`;
      
      legendEl.innerHTML = html;
      legendEl.style.display = 'block';
    });
    
    chartDiv.on('plotly_unhover', function() {
      legendEl.style.display = 'none';
    });
    
    loadingDiv.style.display = 'none';
  } catch (error) {
    console.error('Error rendering RSI Bollinger chart:', error);
    emptyDiv.style.display = 'flex';
    loadingDiv.style.display = 'none';
  }
}

// Initialize RSI dashboard when the page loads
setTimeout(() => {
  initializeRSIDashboard();
}, 1500);

// Check if database is already connected and load favorites (Electron only)
if (window.electronAPI && window.electronAPI.getFavorites) {
  setTimeout(async () => {
    console.log('[INIT] Checking for existing database connection...');
    try {
      // Try to get favorites - if it works, database is connected
      const result = await window.electronAPI.getFavorites();
      if (result.success) {
        console.log('[INIT] Database already connected, loading favorites and watchlists...');
        await loadFavorites();
        await loadWatchlistsForBacktest();
      } else {
        console.log('[INIT] No database connected yet');
      }
    } catch (error) {
      console.log('[INIT] No database connected:', error.message);
    }
  }, 500);
} else {
  console.log('[INIT] Running in browser mode - database features disabled');
}


// Export for external use
export const RSIDashboard = {
  initialize: initializeRSIDashboard,
  getCurrentWatchlist: () => rsiCurrentWatchlist,
  getSelectedSymbol: () => rsiSelectedSymbol,
  getBasketData: () => rsiBasketData
};

// Expose to window for backward compatibility
window.RSIDashboard = RSIDashboard;
window.initializeRSIDashboard = initializeRSIDashboard;

export default RSIDashboard;
