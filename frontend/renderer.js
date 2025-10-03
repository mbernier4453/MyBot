// State
let currentDb = null;
let currentRun = null;
let allRuns = [];
let selectedRuns = new Set();
let currentStrategies = [];
let currentTrades = [];
let buyHoldMetrics = {};

// DOM Elements
const selectDbBtn = document.getElementById('selectDbBtn');
const dbPathEl = document.getElementById('dbPath');
const runsList = document.getElementById('runsList');
const statusText = document.getElementById('statusText');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Filters
const runSearch = document.getElementById('runSearch');
const modeFilter = document.getElementById('modeFilter');
const tickerFilter = document.getElementById('tickerFilter');
const sortBy = document.getElementById('sortBy');
const sortDesc = document.getElementById('sortDesc');
const tradeSearch = document.getElementById('tradeSearch');
const sideFilter = document.getElementById('sideFilter');
const compareBtn = document.getElementById('compareBtn');

// Initialize
selectDbBtn.addEventListener('click', selectDatabase);
runSearch?.addEventListener('input', filterRuns);
modeFilter?.addEventListener('change', filterRuns);
tickerFilter?.addEventListener('change', filterStrategies);
sortBy?.addEventListener('change', filterStrategies);
sortDesc?.addEventListener('change', filterStrategies);
tradeSearch?.addEventListener('input', filterTrades);
sideFilter?.addEventListener('change', filterTrades);
compareBtn?.addEventListener('click', compareRuns);

// Function to switch to a specific tab
function switchToTab(tabName) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  const targetTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  const targetContent = document.getElementById(`${tabName}Tab`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    console.log('Tab clicked:', targetTab, 'Current run:', currentRun);
    
    switchToTab(targetTab);
    
    // Load data for specific tabs
    if (currentRun) {
      if (targetTab === 'strategies') {
        console.log('Loading strategies for tab switch');
        loadStrategies(currentRun.run_id);
      } else if (targetTab === 'portfolio') {
        loadPortfolio(currentRun.run_id);
      } else if (targetTab === 'trades') {
        loadTrades(currentRun.run_id);
      }
    } else {
      console.warn('No current run selected');
    }
  });
});

// Database Selection
async function selectDatabase() {
  setStatus('Selecting database...');
  const result = await window.electronAPI.selectDb();
  
  if (result.success) {
    currentDb = result.path;
    dbPathEl.textContent = result.path;
    setStatus('Database connected');
    loadRuns();
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

// Load Runs
async function loadRuns() {
  setStatus('Loading runs...');
  const result = await window.electronAPI.getRuns();
  
  if (result.success) {
    allRuns = result.data;
    displayRuns(allRuns);
    setStatus(`Loaded ${allRuns.length} runs`);
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayRuns(runs) {
  if (!runs || runs.length === 0) {
    runsList.innerHTML = '<div class="empty-state"><p>No runs found</p></div>';
    return;
  }
  
  runsList.innerHTML = runs.map(run => {
    const startDate = new Date(run.started_at * 1000).toLocaleString();
    
    // Calculate duration properly
    let duration = 'Running...';
    if (run.completed_at && run.started_at) {
      const durationSeconds = run.completed_at - run.started_at;
      if (durationSeconds >= 60) {
        duration = (durationSeconds / 60).toFixed(1) + ' min';
      } else if (durationSeconds > 0) {
        duration = durationSeconds.toFixed(1) + ' sec';
      } else {
        duration = '< 1 sec';
      }
    }
    
    return `
      <div class="run-item" data-run-id="${run.run_id}">
        <div class="run-item-header">
          <span class="run-id">${run.run_id}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="run-mode ${run.mode}">${run.mode || 'single'}</span>
            <button class="btn-delete-run" onclick="deleteRun('${run.run_id}', event)" title="Delete run">🗑️</button>
          </div>
        </div>
        <div class="run-info">📅 ${startDate}</div>
        <div class="run-info">⏱️ ${duration} • ${run.result_count || 0} results</div>
        ${run.notes ? `<div class="run-notes">${run.notes}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click handlers
  document.querySelectorAll('.run-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const runId = item.dataset.runId;
      
      if (e.ctrlKey || e.metaKey) {
        // Multi-select for comparison
        if (selectedRuns.has(runId)) {
          selectedRuns.delete(runId);
          item.classList.remove('selected');
        } else {
          selectedRuns.add(runId);
          item.classList.add('selected');
        }
        compareBtn.disabled = selectedRuns.size < 2;
      } else {
        // Single select
        document.querySelectorAll('.run-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedRuns.clear();
        selectedRuns.add(runId);
        compareBtn.disabled = true;
        
        const run = allRuns.find(r => r.run_id === runId);
        if (run) {
          currentRun = run;
          
          // Switch to overview tab
          switchToTab('overview');
          
          // Load all run data
          loadRunDetails(run);
          loadStrategies(runId);
          loadPortfolio(runId);
          loadTrades(runId);
        }
      }
    });
  });
}

// Filter Runs
function filterRuns() {
  const searchTerm = runSearch.value.toLowerCase();
  const mode = modeFilter.value;
  
  const filtered = allRuns.filter(run => {
    const matchesSearch = run.run_id.toLowerCase().includes(searchTerm) ||
                         (run.notes && run.notes.toLowerCase().includes(searchTerm));
    const matchesMode = !mode || run.mode === mode;
    return matchesSearch && matchesMode;
  });
  
  displayRuns(filtered);
}

// Load Run Details
async function loadRunDetails(run) {
  const overviewTab = document.getElementById('overviewTab');
  
  setStatus('Loading run details...');
  
  // Build overview
  const startDate = new Date(run.started_at * 1000).toLocaleString();
  const endDate = run.completed_at 
    ? new Date(run.completed_at * 1000).toLocaleString()
    : 'In Progress';
  const duration = run.completed_at 
    ? ((run.completed_at - run.started_at) / 60).toFixed(1) + ' minutes'
    : 'N/A';
  
  let overviewHtml = `
    <div class="overview-content">
      <div class="info-section">
        <h3>Run Information</h3>
        <div class="info-row">
          <span class="info-label">Run ID:</span>
          <span class="info-value">${run.run_id}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mode:</span>
          <span class="info-value">${run.mode || 'single'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Started:</span>
          <span class="info-value">${startDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Completed:</span>
          <span class="info-value">${endDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Duration:</span>
          <span class="info-value">${duration}</span>
        </div>
        ${run.notes ? `
        <div class="info-row">
          <span class="info-label">Notes:</span>
          <span class="info-value">${run.notes}</span>
        </div>
        ` : ''}
      </div>
  `;
  
  // Load metrics based on mode
  if (run.mode === 'portfolio') {
    const result = await window.electronAPI.getPortfolio(run.run_id);
    if (result.success) {
      const p = result.data;
      overviewHtml += `
        <div class="metrics-grid">
          ${createMetricCard('Total Return', formatPercent(p.total_return), p.total_return >= 0)}
          ${createMetricCard('CAGR', formatPercent(p.cagr), p.cagr >= 0)}
          ${createMetricCard('Sharpe Ratio', formatNumber(p.sharpe, 2), p.sharpe >= 0)}
          ${createMetricCard('Sortino Ratio', formatNumber(p.sortino, 2), p.sortino >= 0)}
          ${createMetricCard('Volatility', formatPercent(p.vol))}
          ${createMetricCard('Max Drawdown', formatPercent(p.maxdd), false)}
          ${createMetricCard('Win Rate', formatPercent(p.win_rate), p.win_rate >= 0.5)}
          ${createMetricCard('Total Trades', p.trades_total || 0)}
        </div>
      `;
    }
  } else {
    console.log('Loading strategies for single mode run:', run.run_id);
    const result = await window.electronAPI.getStrategies(run.run_id);
    console.log('Strategies result in overview:', result);
    
    if (result.success && result.data.length > 0) {
      const strategies = result.data;
      // Store for later use in strategies tab
      currentStrategies = strategies;
      console.log(`Loaded ${strategies.length} strategies into currentStrategies`);
      
      // Filter out null/NaN values for calculations
      const validReturns = strategies.filter(s => s.total_return !== null && !isNaN(s.total_return));
      const validSharpes = strategies.filter(s => s.sharpe !== null && !isNaN(s.sharpe) && isFinite(s.sharpe));
      const validDrawdowns = strategies.filter(s => s.maxdd !== null && !isNaN(s.maxdd));
      
      const avgReturn = validReturns.length > 0 
        ? validReturns.reduce((sum, s) => sum + s.total_return, 0) / validReturns.length 
        : 0;
      
      // Calculate MEDIAN Sharpe (sort and take middle value)
      const medianSharpe = validSharpes.length > 0
        ? (() => {
            const sorted = validSharpes.map(s => s.sharpe).sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          })()
        : 0;
      
      const maxReturn = validReturns.length > 0
        ? Math.max(...validReturns.map(s => s.total_return))
        : 0;
      
      // Worst drawdown = MAX (most negative, closest to -100%)
      const worstDrawdown = validDrawdowns.length > 0
        ? Math.max(...validDrawdowns.map(s => Math.abs(s.maxdd))) * -1
        : 0;
      
      overviewHtml += `
        <div class="metrics-grid">
          ${createMetricCard('Strategies', strategies.length)}
          ${createMetricCard('Avg Return', formatPercent(avgReturn), avgReturn >= 0)}
          ${createMetricCard('Best Return', formatPercent(maxReturn), maxReturn >= 0)}
          ${createMetricCard('Median Sharpe', formatNumber(medianSharpe, 2), medianSharpe >= 0)}
          ${createMetricCard('Worst Drawdown', formatPercent(worstDrawdown), false)}
          ${createMetricCard('Unique Tickers', new Set(strategies.map(s => s.ticker)).size)}
        </div>
      `;
    } else {
      console.warn('No strategies found or error:', result);
    }
  }
  
  overviewHtml += '</div>';
  overviewTab.innerHTML = overviewHtml;
  
  setStatus('Ready');
}

// Load Strategies
async function loadStrategies(runId) {
  console.log('loadStrategies called for runId:', runId);
  setStatus('Loading strategies...');
  const result = await window.electronAPI.getStrategies(runId);
  const bhResult = await window.electronAPI.getBuyHoldMetrics(runId);
  
  console.log('getStrategies result:', result);
  console.log('getBuyHoldMetrics result:', bhResult);
  
  if (result.success) {
    currentStrategies = result.data;
    if (bhResult.success) {
      buyHoldMetrics = bhResult.data;
    }
    
    // Populate ticker dropdown
    const uniqueTickers = [...new Set(currentStrategies.map(s => s.ticker))].sort();
    tickerFilter.innerHTML = '<option value="">All Tickers</option>' + 
      uniqueTickers.map(ticker => `<option value="${ticker}">${ticker}</option>`).join('');
    
    console.log(`Loaded ${currentStrategies.length} strategies`);
    displayStrategies(currentStrategies);
    setStatus(`Loaded ${currentStrategies.length} strategies`);
  } else {
    console.error('Error loading strategies:', result.error);
    document.getElementById('strategiesContent').innerHTML = 
      '<div class="empty-state"><p>No strategies found</p></div>';
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayStrategies(strategies) {
  if (!strategies || strategies.length === 0) {
    document.getElementById('strategiesContent').innerHTML = 
      '<div class="empty-state"><p>No strategies to display</p></div>';
    return;
  }
  
  const hasBuyHoldData = Object.keys(buyHoldMetrics).length > 0;
  
  // Helper function to get comparison class for a metric
  function getComparisonClass(stratValue, bhValue, higherIsBetter = true) {
    if (!hasBuyHoldData || stratValue === null || stratValue === undefined || bhValue === null || bhValue === undefined) {
      return ''; // No comparison possible
    }
    
    const isBetter = higherIsBetter ? stratValue > bhValue : stratValue < bhValue;
    return isBetter ? 'positive-value' : 'negative-value';
  }
  
  const noticeHtml = !hasBuyHoldData ? 
    `<div style="background: var(--bg-secondary); padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 3px solid var(--warning-color, #FFA500);">
      <strong>Note:</strong> Buy & hold comparison data not available. Re-run your backtest with the updated code to enable color-coded performance comparison.
    </div>` : '';
  
  const html = `
    ${noticeHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Total Return</th>
          <th>CAGR</th>
          <th>Sharpe</th>
          <th>Sortino</th>
          <th>Volatility</th>
          <th>Max DD</th>
          <th>Win Rate</th>
          <th>Trades</th>
          <th>Parameters</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${strategies.map(s => {
          const bh = buyHoldMetrics[s.ticker] || {};
          return `
          <tr class="strategy-row" data-strategy-id="${s.id}" style="cursor: pointer;">
            <td class="ticker-cell">${s.ticker}</td>
            <td class="${getComparisonClass(s.total_return, bh.total_return, true)}">
              ${formatPercent(s.total_return)}
            </td>
            <td class="${getComparisonClass(s.cagr, bh.cagr, true)}">
              ${formatPercent(s.cagr)}
            </td>
            <td class="${getComparisonClass(s.sharpe, bh.sharpe, true)}">
              ${formatNumber(s.sharpe, 2)}
            </td>
            <td class="${getComparisonClass(s.sortino, bh.sortino, true)}">
              ${formatNumber(s.sortino, 2)}
            </td>
            <td class="${getComparisonClass(s.vol, bh.vol, false)}">
              ${formatPercent(s.vol)}
            </td>
            <td class="${getComparisonClass(s.maxdd, bh.maxdd, false)}">
              ${formatPercent(s.maxdd)}
            </td>
            <td>${formatPercent(s.win_rate)}</td>
            <td>${s.trades_total || 0}</td>
            <td style="font-size: 11px; color: var(--text-secondary);">
              ${Object.entries(s.params || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
            </td>
            <td>
              <button class="btn-view-tearsheet" onclick="event.stopPropagation(); viewTearsheet(${s.id})">
                View Tearsheet
              </button>
            </td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('strategiesContent').innerHTML = html;
  
  // Add click handlers to strategy rows
  document.querySelectorAll('.strategy-row').forEach(row => {
    row.addEventListener('click', () => {
      const strategyId = parseInt(row.dataset.strategyId);
      displayStrategyOverview(strategyId);
    });
  });
}

async function displayStrategyOverview(strategyId) {
  // Find the strategy in current strategies
  const strategy = currentStrategies.find(s => s.id === strategyId);
  if (!strategy) {
    console.error('Strategy not found:', strategyId);
    return;
  }
  
  // Switch to overview tab
  switchToTab('overview');
  
  // Display strategy details in overview
  const bh = buyHoldMetrics[strategy.ticker] || {};
  const hasBuyHold = Object.keys(bh).length > 0;
  
  const overviewHtml = `
    <div style="padding: 20px;">
      <h2 style="margin-bottom: 20px; color: var(--accent-green);">${strategy.ticker} - Strategy #${strategy.id}</h2>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="metric-card">
          <div class="metric-label">Total Return</div>
          <div class="metric-value" style="color: ${strategy.total_return >= 0 ? 'var(--positive)' : 'var(--negative)'};">
            ${formatPercent(strategy.total_return)}
          </div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.total_return)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">CAGR</div>
          <div class="metric-value">${formatPercent(strategy.cagr)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.cagr)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Sharpe Ratio</div>
          <div class="metric-value">${formatNumber(strategy.sharpe, 2)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatNumber(bh.sharpe, 2)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Sortino Ratio</div>
          <div class="metric-value">${formatNumber(strategy.sortino, 2)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatNumber(bh.sortino, 2)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Volatility</div>
          <div class="metric-value">${formatPercent(strategy.vol)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.vol)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Max Drawdown</div>
          <div class="metric-value" style="color: var(--negative);">${formatPercent(strategy.maxdd)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.maxdd)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Win Rate</div>
          <div class="metric-value">${formatPercent(strategy.win_rate)}</div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Total Trades</div>
          <div class="metric-value">${strategy.trades_total || 0}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="margin-bottom: 10px;">Parameters</h3>
        <div style="background: var(--bg-secondary); padding: 15px; border-radius: 6px; font-family: 'SF Mono', 'Monaco', monospace; font-size: 12px;">
          ${Object.entries(strategy.params || {}).map(([k, v]) => 
            `<div style="margin-bottom: 5px;"><span style="color: var(--text-secondary);">${k}:</span> <span style="color: var(--accent-green);">${v}</span></div>`
          ).join('')}
        </div>
      </div>
      
      <button class="btn-view-tearsheet" onclick="viewTearsheet(${strategy.id})" style="padding: 12px 24px; font-size: 14px;">
        View Full Tearsheet
      </button>
    </div>
  `;
  
  document.getElementById('overviewTab').innerHTML = overviewHtml;
}

function filterStrategies() {
  const selectedTicker = tickerFilter.value;
  const sortField = sortBy.value;
  const descending = sortDesc.checked;
  
  let filtered = currentStrategies;
  
  // Filter by ticker if one is selected
  if (selectedTicker) {
    filtered = filtered.filter(s => s.ticker === selectedTicker);
  }
  
  // Sort
  filtered.sort((a, b) => {
    const valA = a[sortField] || 0;
    const valB = b[sortField] || 0;
    return descending ? valB - valA : valA - valB;
  });
  
  displayStrategies(filtered);
}

// Load Portfolio
async function loadPortfolio(runId) {
  setStatus('Loading portfolio...');
  const result = await window.electronAPI.getPortfolio(runId);
  
  if (result.success) {
    displayPortfolio(result.data);
    setStatus('Portfolio loaded');
  } else {
    document.getElementById('portfolioContent').innerHTML = 
      '<div class="empty-state"><p>No portfolio data available</p></div>';
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayPortfolio(portfolio) {
  const html = `
    <div class="metrics-grid">
      ${createMetricCard('Total Return', formatPercent(portfolio.total_return), portfolio.total_return >= 0)}
      ${createMetricCard('CAGR', formatPercent(portfolio.cagr), portfolio.cagr >= 0)}
      ${createMetricCard('Sharpe Ratio', formatNumber(portfolio.sharpe, 2), portfolio.sharpe >= 0)}
      ${createMetricCard('Sortino Ratio', formatNumber(portfolio.sortino, 2), portfolio.sortino >= 0)}
      ${createMetricCard('Volatility', formatPercent(portfolio.vol))}
      ${createMetricCard('Max Drawdown', formatPercent(portfolio.maxdd), false)}
      ${createMetricCard('Win Rate', formatPercent(portfolio.win_rate), portfolio.win_rate >= 0.5)}
      ${createMetricCard('Net Win Rate', formatPercent(portfolio.net_win_rate))}
      ${createMetricCard('Avg Trade P&L', formatNumber(portfolio.avg_trade_pnl, 2))}
      ${createMetricCard('Total Trades', portfolio.trades_total || 0)}
    </div>
    
    ${portfolio.weights && portfolio.weights.length > 0 ? `
      <div class="info-section">
        <h3>Portfolio Weights</h3>
        <div class="weights-grid">
          ${portfolio.weights.map(w => `
            <div class="weight-card">
              <div class="weight-ticker">${w.ticker}</div>
              <div class="weight-value">${formatPercent(w.target_weight)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  
  document.getElementById('portfolioContent').innerHTML = html;
}

// Load Trades
async function loadTrades(runId, ticker = null) {
  setStatus('Loading trades...');
  const result = await window.electronAPI.getTrades(runId, ticker);
  
  if (result.success) {
    currentTrades = result.data;
    displayTrades(currentTrades);
    setStatus(`Loaded ${currentTrades.length} trades`);
  } else {
    document.getElementById('tradesContent').innerHTML = 
      '<div class="empty-state"><p>No trades found</p></div>';
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayTrades(trades) {
  if (!trades || trades.length === 0) {
    document.getElementById('tradesContent').innerHTML = 
      '<div class="empty-state"><p>No trades to display</p></div>';
    return;
  }
  
  const html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Ticker</th>
          <th>Side</th>
          <th>Shares</th>
          <th>Price</th>
          <th>Fees</th>
          <th>P&L</th>
        </tr>
      </thead>
      <tbody>
        ${trades.map(t => `
          <tr>
            <td>${new Date(t.dt).toLocaleString()}</td>
            <td class="ticker-cell">${t.ticker}</td>
            <td>
              <span style="color: ${t.side === 'buy' ? 'var(--positive)' : 'var(--negative)'}">
                ${t.side.toUpperCase()}
              </span>
            </td>
            <td>${t.shares}</td>
            <td>$${formatNumber(t.price, 2)}</td>
            <td>$${formatNumber(t.fees, 2)}</td>
            <td class="${t.pnl >= 0 ? 'positive-value' : 'negative-value'}">
              ${t.pnl ? '$' + formatNumber(t.pnl, 2) : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('tradesContent').innerHTML = html;
}

function filterTrades() {
  const searchTerm = tradeSearch.value.toLowerCase();
  const side = sideFilter.value;
  
  let filtered = currentTrades.filter(t => {
    const matchesSearch = t.ticker.toLowerCase().includes(searchTerm);
    const matchesSide = !side || t.side === side;
    return matchesSearch && matchesSide;
  });
  
  displayTrades(filtered);
}

// Compare Runs
async function compareRuns() {
  if (selectedRuns.size < 2) return;
  
  setStatus('Loading comparison data...');
  const runIds = Array.from(selectedRuns);
  const result = await window.electronAPI.getComparisonData(runIds);
  
  if (result.success) {
    displayComparison(result.data);
    setStatus('Comparison ready');
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayComparison(data) {
  const { portfolios, strategies } = data;
  
  let html = '<div class="comparison-grid">';
  
  // Portfolio comparisons
  portfolios.forEach(p => {
    html += `
      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-run-id">${p.run_id}</span>
          <span class="run-mode portfolio">Portfolio</span>
        </div>
        <div class="comparison-metrics">
          ${createInfoRow('Return', formatPercent(p.total_return))}
          ${createInfoRow('Sharpe', formatNumber(p.sharpe, 2))}
          ${createInfoRow('Sortino', formatNumber(p.sortino, 2))}
          ${createInfoRow('Max DD', formatPercent(p.maxdd))}
          ${createInfoRow('Win Rate', formatPercent(p.win_rate))}
        </div>
      </div>
    `;
  });
  
  // Strategy comparisons
  strategies.forEach(s => {
    html += `
      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-run-id">${s.run_id}</span>
          <span class="run-mode single">Single</span>
        </div>
        <div class="comparison-metrics">
          ${createInfoRow('Strategies', s.strategy_count)}
          ${createInfoRow('Avg Return', formatPercent(s.avg_return))}
          ${createInfoRow('Best Return', formatPercent(s.max_return))}
          ${createInfoRow('Avg Sharpe', formatNumber(s.avg_sharpe, 2))}
          ${createInfoRow('Worst DD', formatPercent(s.worst_drawdown))}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  document.getElementById('compareContent').innerHTML = html;
}

// Helper Functions
function createMetricCard(label, value, isPositive = null) {
  let valueClass = '';
  if (isPositive !== null) {
    valueClass = isPositive ? 'positive' : 'negative';
  }
  
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value ${valueClass}">${value}</div>
    </div>
  `;
}

function createInfoRow(label, value) {
  return `
    <div class="info-row">
      <span class="info-label">${label}:</span>
      <span class="info-value">${value}</span>
    </div>
  `;
}

function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? 'var(--negative)' : 'var(--text-secondary)';
}

// Tearsheet Functions
async function viewTearsheet(strategyId) {
  const modal = document.getElementById('tearsheetModal');
  const loading = document.getElementById('tearsheetLoading');
  const content = document.getElementById('tearsheetContent');
  
  // Show modal with loading state
  modal.classList.add('show');
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    // Load strategy details
    const result = await window.electronAPI.getStrategyDetails(strategyId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load strategy details');
    }
    
    const strategy = result.data;
    
    // Update title
    document.getElementById('tearsheetTitle').textContent = 
      `${strategy.ticker} - Strategy #${strategy.id}`;
    
    // Show content early so DOM elements are accessible
    loading.style.display = 'none';
    content.style.display = 'block';
    
    // Display metrics
    displayTearsheetMetrics(strategy);
    
    // Calculate and display CAPM (only if benchmark is available)
    if (strategy.equity && strategy.benchmark_equity) {
      await displayCapmMetrics(strategy, strategy.benchmark_equity);
    } else {
      document.getElementById('tearsheetCapm').innerHTML = 
        '<p style="color: var(--text-secondary); font-size: 11px; text-align: center; padding: 20px;">CAPM analysis not available (benchmark disabled or missing)</p>';
    }
    
    // Display equity chart
    if (strategy.equity) {
      displayEquityChart(strategy.equity, strategy.buyhold_equity, strategy.benchmark_equity, strategy.events);
    } else {
      document.getElementById('equityChart').innerHTML = 
        '<p style="color: var(--text-secondary);">Equity data not available</p>';
    }
    
    // Display vol-matched charts
    if (strategy.equity && strategy.benchmark_equity) {
      displayVolMatchedChart(strategy.equity, strategy.benchmark_equity, 'volMatchedBenchChart', 'Benchmark');
    } else {
      document.getElementById('volMatchedBenchChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Benchmark not available</div>';
    }
    
    if (strategy.equity && strategy.buyhold_equity) {
      displayVolMatchedChart(strategy.equity, strategy.buyhold_equity, 'volMatchedBuyHoldChart', 'Buy & Hold');
    } else {
      document.getElementById('volMatchedBuyHoldChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Buy & Hold not available</div>';
    }
    
    // Display drawdown chart
    if (strategy.equity) {
      displayDrawdownChart(strategy.equity, strategy.buyhold_equity, strategy.benchmark_equity);
    } else {
      document.getElementById('drawdownChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Data not available</div>';
    }
    
    // Display trade events
    displayTradeEvents(strategy.events);
    
  } catch (error) {
    console.error('Error loading tearsheet:', error);
    loading.innerHTML = `
      <div class="error-state" style="color: var(--negative); text-align: center;">
        <p>❌ Failed to load tearsheet</p>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 10px;">
          ${error.message}
        </p>
      </div>
    `;
  }
}

function closeTearsheet() {
  document.getElementById('tearsheetModal').classList.remove('show');
}

function displayTearsheetMetrics(strategy) {
  const m = strategy.metrics || {};
  
  // Get buy & hold and benchmark metrics from the metrics object
  const stratMetrics = {
    total_return: strategy.total_return,
    cagr: strategy.cagr,
    sharpe: strategy.sharpe,
    sortino: strategy.sortino,
    vol: strategy.vol,
    maxdd: strategy.maxdd
  };
  
  const bhMetrics = {
    total_return: m.buyhold_total_return,
    cagr: m.buyhold_cagr,
    sharpe: m.buyhold_sharpe,
    sortino: m.buyhold_sortino,
    vol: m.buyhold_vol || m.vol, // Fallback
    maxdd: m.buyhold_maxdd
  };
  
  const benchMetrics = {
    total_return: m.bench_total_return,
    cagr: m.bench_cagr,
    sharpe: m.bench_sharpe,
    sortino: m.bench_sortino,
    vol: m.bench_vol || m.vol, // Fallback
    maxdd: m.bench_maxdd
  };
  
  function formatMetricValue(value, isPercent = false, higherIsBetter = true) {
    if (value === null || value === undefined || isNaN(value)) return '<span style="color: var(--text-secondary);">N/A</span>';
    
    const formatted = isPercent ? formatPercent(value) : formatNumber(value, 3);
    return `<span class="metric-value">${formatted}</span>`;
  }
  
  const metricsHtml = `
    <div class="metric-row metric-row-header">
      <div>Metric</div>
      <div style="text-align: right;">Strategy</div>
      <div style="text-align: right;">Buy & Hold</div>
      <div style="text-align: right;">Benchmark</div>
    </div>
    <div class="metric-row">
      <div class="metric-label">Total Return</div>
      ${formatMetricValue(stratMetrics.total_return, true)}
      ${formatMetricValue(bhMetrics.total_return, true)}
      ${formatMetricValue(benchMetrics.total_return, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">CAGR</div>
      ${formatMetricValue(stratMetrics.cagr, true)}
      ${formatMetricValue(bhMetrics.cagr, true)}
      ${formatMetricValue(benchMetrics.cagr, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sharpe</div>
      ${formatMetricValue(stratMetrics.sharpe, false)}
      ${formatMetricValue(bhMetrics.sharpe, false)}
      ${formatMetricValue(benchMetrics.sharpe, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sortino</div>
      ${formatMetricValue(stratMetrics.sortino, false)}
      ${formatMetricValue(bhMetrics.sortino, false)}
      ${formatMetricValue(benchMetrics.sortino, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Volatility</div>
      ${formatMetricValue(stratMetrics.vol, true)}
      ${formatMetricValue(bhMetrics.vol, true)}
      ${formatMetricValue(benchMetrics.vol, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Max Drawdown</div>
      ${formatMetricValue(stratMetrics.maxdd, true)}
      ${formatMetricValue(bhMetrics.maxdd, true)}
      ${formatMetricValue(benchMetrics.maxdd, true)}
    </div>
  `;
  
  document.getElementById('tearsheetMetrics').innerHTML = metricsHtml;
  
  // Display trade summary
  const tradeSummaryHtml = `
    <div class="simple-metric">
      <span class="simple-metric-label">Total Trades</span>
      <span class="simple-metric-value">${strategy.trades_total || 0}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Win Rate</span>
      <span class="simple-metric-value">${formatPercent(strategy.win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Net Win Rate</span>
      <span class="simple-metric-value">${formatPercent(strategy.net_win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Avg Trade P&L</span>
      <span class="simple-metric-value">$${formatNumber(strategy.avg_trade_pnl, 2)}</span>
    </div>
  `;
  
  document.getElementById('tradeSummary').innerHTML = tradeSummaryHtml;
}

async function displayCapmMetrics(strategy, benchmarkEquity) {
  const capmDiv = document.getElementById('tearsheetCapm');
  capmDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 11px;">Calculating...</div>';
  
  try {
    // Calculate CAPM for strategy vs benchmark
    const stratResult = await window.electronAPI.calculateCapm(strategy.equity, benchmarkEquity);
    
    if (!stratResult.success) {
      throw new Error(stratResult.error || 'CAPM calculation failed');
    }
    
    const stratCapm = stratResult.data;
    
    // Calculate CAPM for buy & hold vs benchmark if available
    let bhCapm = null;
    if (strategy.buyhold_equity) {
      const bhResult = await window.electronAPI.calculateCapm(strategy.buyhold_equity, benchmarkEquity);
      if (bhResult.success) {
        bhCapm = bhResult.data;
      }
    }
    
    const capmHtml = `
      <div class="metric-row header">
        <div></div>
        <div>Strategy</div>
        <div>Buy & Hold</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Alpha</div>
        <div>${formatPercent(stratCapm.alpha)}</div>
        <div>${bhCapm ? formatPercent(bhCapm.alpha) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Beta</div>
        <div>${formatNumber(stratCapm.beta, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.beta, 3) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">R²</div>
        <div>${formatNumber(stratCapm.r_squared, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.r_squared, 3) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Tracking Error</div>
        <div>${formatPercent(stratCapm.tracking_error)}</div>
        <div>${bhCapm ? formatPercent(bhCapm.tracking_error) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Info Ratio</div>
        <div>${formatNumber(stratCapm.information_ratio, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.information_ratio, 3) : 'N/A'}</div>
      </div>
    `;
    
    capmDiv.innerHTML = capmHtml;
    
  } catch (error) {
    console.error('CAPM calculation error:', error);
    capmDiv.innerHTML = `
      <div style="color: var(--negative); text-align: center; padding: 10px; font-size: 11px;">
        CAPM calculation failed
      </div>
    `;
  }
}

function displayEquityChart(strategyEquity, buyholdEquity, benchmarkEquity, events = []) {
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
    line: { color: '#006633', width: 2.5 }
  });
  
  // Buy & Hold equity trace (same ticker)
  if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
    traces.push({
      x: buyholdEquity.index,
      y: buyholdEquity.data,
      type: 'scatter',
      mode: 'lines',
      name: buyholdEquity.name || 'Buy & Hold',
      line: { color: '#228B22', width: 2.5 }
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
      line: { color: '#00aa55', width: 2.5 }
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
    
    // Separate buy and sell events
    const buyEvents = events.filter(e => e.type === 'buy');
    const sellEvents = events.filter(e => e.type === 'sell');
    
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
      gridcolor: '#1a3d1a',
      color: '#a0a0a0',
      showgrid: true
    },
    yaxis: {
      title: 'Portfolio Value ($)',
      gridcolor: '#1a3d1a',
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
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };
  
  Plotly.newPlot('equityChart', traces, layout, config);
}

function displayTradeEvents(events) {
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
          ${event.qty || 0} shares @ $${formatNumber(event.price || 0, 2)}
          ${event.fee ? ` | Fee: $${formatNumber(event.fee, 2)}` : ''}
        </span>
      </div>
    `;
  }).join('');
  
  eventsDiv.innerHTML = eventsHtml;
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('tearsheetModal');
  if (e.target === modal) {
    closeTearsheet();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTearsheet();
  }
});

// Delete Run Function
async function deleteRun(runId, event) {
  // Stop propagation to prevent selecting the run
  event.stopPropagation();
  
  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete run "${runId}"?\n\nThis will permanently delete all associated strategies, trades, and results.`);
  
  if (!confirmed) {
    return;
  }
  
  setStatus('Deleting run...');
  
  try {
    const result = await window.electronAPI.deleteRun(runId);
    
    if (result.success) {
      setStatus(`Run "${runId}" deleted successfully`);
      
      // If this was the current run, clear the details panel
      if (currentRun === runId) {
        currentRun = null;
        document.getElementById('overviewTab').innerHTML = 
          '<div class="empty-state"><p>👈 Select a run to view details</p></div>';
        document.getElementById('strategiesContent').innerHTML = 
          '<div class="empty-state"><p>No strategies to display</p></div>';
        document.getElementById('portfolioContent').innerHTML = 
          '<div class="empty-state"><p>No portfolio data available</p></div>';
        document.getElementById('tradesContent').innerHTML = 
          '<div class="empty-state"><p>No trades to display</p></div>';
      }
      
      // Refresh the runs list
      await loadRuns();
    } else {
      setStatus(`Error deleting run: ${result.error}`, true);
      alert(`Failed to delete run: ${result.error}`);
    }
  } catch (error) {
    console.error('Error deleting run:', error);
    setStatus('Error deleting run', true);
    alert(`Failed to delete run: ${error.message}`);
  }
}

function displayVolMatchedChart(strategyEquity, comparisonEquity, chartElementId, comparisonName) {
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
      line: { color: '#006633', width: 2 }
    },
    {
      x: [strategyEquity.index[0], ...dates],
      y: compCum,
      type: 'scatter',
      mode: 'lines',
      name: `${comparisonName} (Vol-Matched)`,
      line: { color: '#228B22', width: 2 }
    }
  ];
  
  const layout = {
    xaxis: { showticklabels: false, gridcolor: '#1a3d1a', color: '#a0a0a0' },
    yaxis: { gridcolor: '#1a3d1a', color: '#a0a0a0', showticklabels: true },
    plot_bgcolor: '#0a0a0a',
    paper_bgcolor: '#0a0a0a',
    font: { color: '#e0e0e0', size: 10 },
    margin: { l: 45, r: 10, t: 10, b: 25 },
    showlegend: true,
    legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(10, 10, 10, 0.8)' },
    hovermode: 'x unified'
  };
  
  Plotly.newPlot(chartElementId, traces, layout, { displayModeBar: false, responsive: true });
}

function displayDrawdownChart(strategyEquity, buyholdEquity, benchmarkEquity) {
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
    line: { color: '#006633', width: 2 },
    fill: 'tozeroy',
    fillcolor: 'rgba(0, 102, 51, 0.2)'
  });
  
  // Buy & Hold drawdown
  if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
    traces.push({
      x: buyholdEquity.index,
      y: calculateDrawdown(buyholdEquity),
      type: 'scatter',
      mode: 'lines',
      name: 'Buy & Hold',
      line: { color: '#228B22', width: 2 }
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
      line: { color: '#00aa55', width: 2 }
    });
  }
  
  const layout = {
    xaxis: { showticklabels: false, gridcolor: '#3e3e42', color: '#999999' },
    yaxis: { 
      gridcolor: '#3e3e42', 
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
  
  Plotly.newPlot('drawdownChart', traces, layout, { displayModeBar: false, responsive: true });
}
