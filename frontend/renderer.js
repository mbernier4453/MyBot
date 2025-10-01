// State
let currentDb = null;
let currentRun = null;
let allRuns = [];
let selectedRuns = new Set();
let currentStrategies = [];
let currentTrades = [];

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
const strategySearch = document.getElementById('strategySearch');
const sortBy = document.getElementById('sortBy');
const sortDesc = document.getElementById('sortDesc');
const tradeSearch = document.getElementById('tradeSearch');
const sideFilter = document.getElementById('sideFilter');
const compareBtn = document.getElementById('compareBtn');

// Initialize
selectDbBtn.addEventListener('click', selectDatabase);
runSearch?.addEventListener('input', filterRuns);
modeFilter?.addEventListener('change', filterRuns);
strategySearch?.addEventListener('input', filterStrategies);
sortBy?.addEventListener('change', filterStrategies);
sortDesc?.addEventListener('change', filterStrategies);
tradeSearch?.addEventListener('input', filterTrades);
sideFilter?.addEventListener('change', filterTrades);
compareBtn?.addEventListener('click', compareRuns);

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    tabContents.forEach(tc => tc.classList.remove('active'));
    document.getElementById(`${targetTab}Tab`).classList.add('active');
    
    // Load data for specific tabs
    if (currentRun) {
      if (targetTab === 'strategies') {
        loadStrategies(currentRun.run_id);
      } else if (targetTab === 'portfolio') {
        loadPortfolio(currentRun.run_id);
      } else if (targetTab === 'trades') {
        loadTrades(currentRun.run_id);
      }
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
    const duration = run.completed_at 
      ? ((run.completed_at - run.started_at) / 60).toFixed(1) + ' min'
      : 'Running...';
    
    return `
      <div class="run-item" data-run-id="${run.run_id}">
        <div class="run-item-header">
          <span class="run-id">${run.run_id}</span>
          <span class="run-mode ${run.mode}">${run.mode || 'single'}</span>
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
          loadRunDetails(run);
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
    const result = await window.electronAPI.getStrategies(run.run_id);
    if (result.success && result.data.length > 0) {
      const strategies = result.data;
      const avgReturn = strategies.reduce((sum, s) => sum + (s.total_return || 0), 0) / strategies.length;
      const avgSharpe = strategies.reduce((sum, s) => sum + (s.sharpe || 0), 0) / strategies.length;
      const maxReturn = Math.max(...strategies.map(s => s.total_return || 0));
      const worstDrawdown = Math.min(...strategies.map(s => s.maxdd || 0));
      
      overviewHtml += `
        <div class="metrics-grid">
          ${createMetricCard('Strategies', strategies.length)}
          ${createMetricCard('Avg Return', formatPercent(avgReturn), avgReturn >= 0)}
          ${createMetricCard('Best Return', formatPercent(maxReturn), maxReturn >= 0)}
          ${createMetricCard('Avg Sharpe', formatNumber(avgSharpe, 2), avgSharpe >= 0)}
          ${createMetricCard('Worst Drawdown', formatPercent(worstDrawdown), false)}
          ${createMetricCard('Unique Tickers', new Set(strategies.map(s => s.ticker)).size)}
        </div>
      `;
    }
  }
  
  overviewHtml += '</div>';
  overviewTab.innerHTML = overviewHtml;
  
  setStatus('Ready');
}

// Load Strategies
async function loadStrategies(runId) {
  setStatus('Loading strategies...');
  const result = await window.electronAPI.getStrategies(runId);
  
  if (result.success) {
    currentStrategies = result.data;
    displayStrategies(currentStrategies);
    setStatus(`Loaded ${currentStrategies.length} strategies`);
  } else {
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
  
  const html = `
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
        </tr>
      </thead>
      <tbody>
        ${strategies.map(s => `
          <tr>
            <td class="ticker-cell">${s.ticker}</td>
            <td class="${s.total_return >= 0 ? 'positive-value' : 'negative-value'}">
              ${formatPercent(s.total_return)}
            </td>
            <td class="${s.cagr >= 0 ? 'positive-value' : 'negative-value'}">
              ${formatPercent(s.cagr)}
            </td>
            <td>${formatNumber(s.sharpe, 2)}</td>
            <td>${formatNumber(s.sortino, 2)}</td>
            <td>${formatPercent(s.vol)}</td>
            <td class="negative-value">${formatPercent(s.maxdd)}</td>
            <td>${formatPercent(s.win_rate)}</td>
            <td>${s.trades_total || 0}</td>
            <td style="font-size: 11px; color: var(--text-secondary);">
              ${Object.entries(s.params || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('strategiesContent').innerHTML = html;
}

function filterStrategies() {
  const searchTerm = strategySearch.value.toLowerCase();
  const sortField = sortBy.value;
  const descending = sortDesc.checked;
  
  let filtered = currentStrategies.filter(s => 
    s.ticker.toLowerCase().includes(searchTerm)
  );
  
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
  if (value === null || value === undefined) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  return Number(value).toFixed(decimals);
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? 'var(--negative)' : 'var(--text-secondary)';
}
