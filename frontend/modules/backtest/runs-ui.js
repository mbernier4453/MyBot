/**
 * Backtest Runs UI Module
 * Handles the run sidebar display and interaction
 */

import * as BacktestRuns from './runs.js';
import * as State from '../core/state.js';

let runListElement = null;

/**
 * Initialize the runs UI
 * @param {Object} elements - DOM element references
 */
export function initializeRunsUI(elements) {
  runListElement = elements.runList;
  
  // Initial render
  renderRunList();
  
  console.log('[RUNS UI] Initialized');
}

/**
 * Render the complete run list
 */
export function renderRunList() {
  if (!runListElement) {
    console.error('[RUNS UI] Run list element not found');
    return;
  }
  
  const runs = BacktestRuns.getAllRuns();
  const selectedId = BacktestRuns.getSelectedRunId();
  
  let html = `
    <div class="runs-header">
      <h3>Backtest Runs</h3>
      <div class="runs-actions">
        <button class="btn-sm btn-primary" onclick="window.addNewStrategyRun()" title="New Strategy Run">
          + Strategy
        </button>
        <button class="btn-sm btn-secondary" onclick="window.addNewPortfolioRun()" title="New Portfolio Run">
          + Portfolio
        </button>
      </div>
    </div>
    <div class="runs-list">
  `;
  
  if (runs.length === 0) {
    html += `
      <div class="empty-state-small">
        <p>No runs yet</p>
        <p style="font-size: 11px; color: var(--text-secondary);">
          Create a Strategy or Portfolio run to get started
        </p>
      </div>
    `;
  } else {
    runs.forEach(run => {
      const isSelected = run.id === selectedId;
      const typeBadge = run.type === 'portfolio' ? 'Portfolio' : 'Strategy';
      const tickerCount = run.type === 'strategy' ? run.tickers.length : run.portfolioStrategies.length;
      const subtitle = run.type === 'strategy' 
        ? `${tickerCount} ticker${tickerCount !== 1 ? 's' : ''}`
        : `${tickerCount} strateg${tickerCount !== 1 ? 'ies' : 'y'}`;
      
      html += `
        <div class="run-item ${isSelected ? 'selected' : ''}" onclick="window.selectRun(${run.id})">
          <div class="run-header">
            <div class="run-type-badge ${run.type}">${typeBadge}</div>
            <div class="run-info">
              <div class="run-name">${run.name}</div>
              <div class="run-subtitle">${subtitle}</div>
            </div>
            <div class="run-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); window.duplicateRun(${run.id})" title="Duplicate">
                Dup
              </button>
              <button class="btn-icon btn-danger" onclick="event.stopPropagation(); window.deleteRun(${run.id})" title="Delete">
                Del
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }
  
  html += `</div>`;
  
  runListElement.innerHTML = html;
}

/**
 * Add a new strategy run
 */
export function addNewStrategyRun() {
  const run = BacktestRuns.addRun('strategy', 'New Strategy');
  renderRunList();
  renderRunDetails();
  console.log('[RUNS UI] Created new strategy run');
}

/**
 * Add a new portfolio run
 */
export function addNewPortfolioRun() {
  const run = BacktestRuns.addRun('portfolio', 'New Portfolio');
  renderRunList();
  renderRunDetails();
  console.log('[RUNS UI] Created new portfolio run');
}

/**
 * Select a run
 * @param {number} runId - Run ID to select
 */
export function selectRun(runId) {
  BacktestRuns.setSelectedRun(runId);
  renderRunList();
  renderRunDetails();
  console.log('[RUNS UI] Selected run:', runId);
}

/**
 * Duplicate a run
 * @param {number} runId - Run ID to duplicate
 */
export function duplicateRun(runId) {
  BacktestRuns.duplicateRun(runId);
  renderRunList();
  renderRunDetails();
  console.log('[RUNS UI] Duplicated run');
}

/**
 * Delete a run
 * @param {number} runId - Run ID to delete
 */
export function deleteRun(runId) {
  const run = BacktestRuns.getRun(runId);
  if (!run) return;
  
  if (confirm(`Delete run "${run.name}"?`)) {
    BacktestRuns.deleteRun(runId);
    renderRunList();
    renderRunDetails();
    console.log('[RUNS UI] Deleted run');
  }
}

/**
 * Render the details panel for the selected run
 */
export function renderRunDetails() {
  const run = BacktestRuns.getSelectedRun();
  const detailsElement = document.getElementById('runDetails');
  
  if (!detailsElement) {
    console.error('[RUNS UI] Run details element not found');
    return;
  }
  
  if (!run) {
    detailsElement.innerHTML = `
      <div class="empty-state">
        <p>No run selected</p>
        <p style="font-size: 12px; color: var(--text-secondary);">
          Select or create a run to configure it
        </p>
      </div>
    `;
    return;
  }
  
  // Render based on run type
  if (run.type === 'strategy') {
    renderStrategyRunDetails(run, detailsElement);
    // Load database strategies after rendering
    setTimeout(() => loadDatabaseStrategiesForRun(run.id), 0);
  } else {
    renderPortfolioRunDetails(run, detailsElement);
  }
}

/**
 * Render strategy run details
 * @param {Object} run - The run object
 * @param {HTMLElement} container - Container element
 */
function renderStrategyRunDetails(run, container) {
  const html = `
    <div class="run-details-header">
      <div class="run-type-badge ${run.type}">${run.type === 'strategy' ? 'Strategy' : 'Portfolio'}</div>
      <input type="text" 
             class="run-name-input" 
             value="${run.name}" 
             onchange="window.updateRunName(${run.id}, this.value)"
             placeholder="Run name...">
    </div>
    
    <div class="run-section">
      <label class="section-label">Tickers</label>
      <textarea id="runTickers" 
                class="form-input" 
                rows="2" 
                placeholder="AAPL, MSFT, GOOGL..."
                onchange="window.updateRunTickers(${run.id}, this.value)">${run.tickers.join(', ')}</textarea>
      <small class="field-hint">Enter one or more ticker symbols separated by commas</small>
    </div>
    
    <div class="run-section">
      <div class="section-header-with-action">
        <label class="section-label">Entry Conditions</label>
        <div class="condition-mode-selector">
          <label class="radio-label">
            <input type="radio" name="entryMode_${run.id}" value="all" ${run.entryMode === 'all' ? 'checked' : ''} 
                   onchange="window.updateRunEntryMode(${run.id}, this.value)">
            <span>All (AND)</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="entryMode_${run.id}" value="any" ${run.entryMode === 'any' ? 'checked' : ''} 
                   onchange="window.updateRunEntryMode(${run.id}, this.value)">
            <span>Any (OR)</span>
          </label>
        </div>
      </div>
      
      <div id="savedStrategiesEntry_${run.id}" class="saved-strategies-section">
        <!-- Database strategies will be loaded here -->
      </div>
      
      <div id="entryConditionsList_${run.id}" class="conditions-list">
        ${renderConditionsList(run.entryConditions, run.id, 'entry')}
      </div>
      
      <button class="btn-add-condition" onclick="window.addEntryConditionToRun(${run.id})">
        + Add Entry Condition
      </button>
    </div>
    
    <div class="run-section">
      <div class="section-header-with-action">
        <label class="section-label">Exit Conditions</label>
        <div class="condition-mode-selector">
          <label class="radio-label">
            <input type="radio" name="exitMode_${run.id}" value="all" ${run.exitMode === 'all' ? 'checked' : ''} 
                   onchange="window.updateRunExitMode(${run.id}, this.value)">
            <span>All (AND)</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="exitMode_${run.id}" value="any" ${run.exitMode === 'any' ? 'checked' : ''} 
                   onchange="window.updateRunExitMode(${run.id}, this.value)">
            <span>Any (OR)</span>
          </label>
        </div>
      </div>
      
      <div id="savedStrategiesExit_${run.id}" class="saved-strategies-section">
        <!-- Database strategies will be loaded here -->
      </div>
      
      <div id="exitConditionsList_${run.id}" class="conditions-list">
        ${renderConditionsList(run.exitConditions, run.id, 'exit')}
      </div>
      
      <button class="btn-add-condition" onclick="window.addExitConditionToRun(${run.id})">
        + Add Exit Condition
      </button>
      
      <div class="exit-rules-section">
        <label class="checkbox-label">
          <input type="checkbox" ${run.takeProfitEnabled ? 'checked' : ''} 
                 onchange="window.toggleRunTakeProfit(${run.id}, this.checked)">
          <span>Take Profit</span>
        </label>
        ${run.takeProfitEnabled ? `
          <div class="inline-fields">
            <select class="form-select" onchange="window.updateRunTakeProfitType(${run.id}, this.value)">
              <option value="percent" ${run.takeProfitType === 'percent' ? 'selected' : ''}>Percent</option>
              <option value="dollar" ${run.takeProfitType === 'dollar' ? 'selected' : ''}>Dollar</option>
            </select>
            <input type="number" 
                   class="form-input"
                   value="${run.takeProfitType === 'percent' ? run.takeProfitPercent : run.takeProfitDollar}" 
                   onchange="window.updateRunTakeProfitValue(${run.id}, this.value)"
                   step="0.1">
          </div>
        ` : ''}
        
        <label class="checkbox-label">
          <input type="checkbox" ${run.stopLossEnabled ? 'checked' : ''} 
                 onchange="window.toggleRunStopLoss(${run.id}, this.checked)">
          <span>Stop Loss</span>
        </label>
        ${run.stopLossEnabled ? `
          <div class="inline-fields">
            <select class="form-select" onchange="window.updateRunStopLossType(${run.id}, this.value)">
              <option value="percent" ${run.stopLossType === 'percent' ? 'selected' : ''}>Percent</option>
              <option value="dollar" ${run.stopLossType === 'dollar' ? 'selected' : ''}>Dollar</option>
            </select>
            <input type="number" 
                   class="form-input"
                   value="${run.stopLossType === 'percent' ? run.stopLossPercent : run.stopLossDollar}" 
                   onchange="window.updateRunStopLossValue(${run.id}, this.value)"
                   step="0.1">
          </div>
        ` : ''}
      </div>
    </div>
    
    <div class="run-section">
      <label class="section-label">Data Configuration</label>
      <div class="data-config-grid">
        <div class="config-field">
          <label class="field-label">Timeframe</label>
          <select class="form-select" onchange="window.updateRunTimeframe(${run.id}, this.value)">
            <option value="day" ${(run.timeframe || 'day') === 'day' ? 'selected' : ''}>Daily</option>
            <option value="hour" ${run.timeframe === 'hour' ? 'selected' : ''}>Hourly</option>
            <option value="15minute" ${run.timeframe === '15minute' ? 'selected' : ''}>15 Minute</option>
            <option value="5minute" ${run.timeframe === '5minute' ? 'selected' : ''}>5 Minute</option>
            <option value="minute" ${run.timeframe === 'minute' ? 'selected' : ''}>1 Minute</option>
          </select>
        </div>
        <div class="config-field">
          <label class="field-label">Start Date <span style="color: var(--text-secondary); font-weight: normal;">(optional)</span></label>
          <input type="date" 
                 class="form-input" 
                 value="${run.startDate || ''}"
                 onchange="window.updateRunStartDate(${run.id}, this.value)">
          <small class="field-hint">Leave empty for automatic (6 months for preview, 2 years for backtest)</small>
        </div>
        <div class="config-field">
          <label class="field-label">End Date <span style="color: var(--text-secondary); font-weight: normal;">(optional)</span></label>
          <input type="date" 
                 class="form-input" 
                 value="${run.endDate || ''}"
                 onchange="window.updateRunEndDate(${run.id}, this.value)">
          <small class="field-hint">Leave empty for today</small>
        </div>
      </div>
    </div>
    
    <div class="run-section">
      <label class="section-label">Strategy Preview</label>
      <div class="preview-controls">
        <select id="runPreviewTicker_${run.id}" class="form-select" style="flex: 1;">
          <option value="">Select a ticker...</option>
          ${run.tickers.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <button class="btn-primary" onclick="window.generateRunPreview(${run.id})">
          🔍 Generate Preview
        </button>
      </div>
      <div id="runPreview_${run.id}" class="run-preview-container">
        <p class="preview-hint">Select a ticker and click "Generate Preview" to visualize your strategy</p>
      </div>
    </div>
    
    <div class="run-actions-footer">
      <button class="btn btn-primary btn-run-backtest" onclick="window.runBacktestForRun(${run.id})">
        Run Backtest
      </button>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Render portfolio run details
 * @param {Object} run - The run object
 * @param {HTMLElement} container - Container element
 */
function renderPortfolioRunDetails(run, container) {
  const html = `
    <div class="run-details-header">
      <input type="text" 
             class="run-name-input" 
             value="${run.name}" 
             onchange="window.updateRunName(${run.id}, this.value)"
             placeholder="Portfolio name...">
      <div class="run-type-badge portfolio">Portfolio Run</div>
    </div>
    
    <div class="run-section">
      <div class="section-header-inline">
        <h4>Strategies</h4>
        <button class="btn-sm" onclick="window.addStrategyToPortfolio(${run.id})">+ Add Strategy</button>
      </div>
      <div id="portfolioStrategiesList_${run.id}" class="portfolio-strategies-list">
        ${renderPortfolioStrategies(run.portfolioStrategies, run.id)}
      </div>
      <button class="btn-sm btn-secondary" onclick="window.normalizePortfolioWeights(${run.id})">
        Normalize Weights to 100%
      </button>
    </div>
    
    <div class="run-section">
      <h4>Preview</h4>
      <div id="runPreview_${run.id}" class="run-preview">
        <p style="color: var(--text-secondary); font-size: 12px;">Portfolio preview will show here</p>
      </div>
    </div>
    
    <div class="run-actions-footer">
      <button class="btn btn-primary" onclick="window.runBacktestForRun(${run.id})">
        Run Portfolio Backtest
      </button>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Render a list of conditions with FULL details (like old backtest system)
 * @param {Array} conditions - Array of condition objects
 * @param {number} runId - Run ID
 * @param {string} type - 'entry' or 'exit'
 * @returns {string} HTML string
 */
function renderConditionsList(conditions, runId, type) {
  if (conditions.length === 0) {
    return `<p style="color: var(--text-secondary); font-size: 12px;">No ${type} conditions yet</p>`;
  }
  
  return conditions.map((cond, index) => {
    return renderConditionCard(cond, runId, type, index);
  }).join('');
}

/**
 * Render a single condition card with full details
 * @param {Object} cond - Condition object
 * @param {number} runId - Run ID
 * @param {string} type - 'entry' or 'exit'
 * @param {number} index - Index in array
 * @returns {string} HTML string
 */
function renderConditionCard(cond, runId, type, index) {
  const conditionTypeLabel = getConditionTypeLabel(cond.type);
  
  // Build details based on condition type
  let detailsHTML = '';
  
  switch (cond.type) {
    case 'timing':
      detailsHTML = `
        <div class="condition-detail"><strong>Time Window:</strong> ${cond.time1} - ${cond.time2}</div>
      `;
      break;
      
    case 'price':
      detailsHTML = `
        <div class="condition-detail"><strong>Position:</strong> ${cond.position_type || 'long'}</div>
        <div class="condition-detail"><strong>Target:</strong> ${cond.target_type} ${cond.target_type === 'Value' ? cond.target_value : `(${cond.target_period})`}</div>
        <div class="condition-detail"><strong>Interaction:</strong> ${cond.interaction} ${cond.direction ? `(${cond.direction})` : ''}</div>
        ${cond.threshold_pct !== undefined ? `<div class="condition-detail"><strong>Cross Threshold:</strong> ${cond.threshold_pct}% (how far price must cross)</div>` : ''}
        ${cond.delay_bars !== undefined ? `<div class="condition-detail"><strong>Delay:</strong> ${cond.delay_bars} bars</div>` : ''}
        ${cond.touches !== undefined ? `<div class="condition-detail"><strong>Touches:</strong> ${cond.touches}</div>` : ''}
      `;
      break;
      
    case 'rsi':
      detailsHTML = `
        <div class="condition-detail"><strong>Position:</strong> ${cond.position_type || 'long'}</div>
        <div class="condition-detail"><strong>RSI Period:</strong> ${cond.rsi_period}</div>
        <div class="condition-detail"><strong>Target:</strong> ${cond.target_type} ${cond.target_type === 'Value' ? cond.target_value : `(${cond.target_period})`}</div>
        <div class="condition-detail"><strong>Interaction:</strong> ${cond.interaction} ${cond.direction ? `(${cond.direction})` : ''}</div>
        ${cond.threshold_pct !== undefined ? `<div class="condition-detail"><strong>Cross Threshold:</strong> ${cond.threshold_pct}% (how far RSI must cross)</div>` : ''}
        ${cond.delay_bars !== undefined ? `<div class="condition-detail"><strong>Delay:</strong> ${cond.delay_bars} bars</div>` : ''}
      `;
      break;
      
    case 'ma_crossover':
      detailsHTML = `
        <div class="condition-detail"><strong>Position:</strong> ${cond.position_type || 'long'}</div>
        <div class="condition-detail"><strong>Fast MA:</strong> ${cond.fast_ma_type}(${cond.fast_period})</div>
        <div class="condition-detail"><strong>Slow MA:</strong> ${cond.slow_ma_type}(${cond.slow_period})</div>
        <div class="condition-detail"><strong>Direction:</strong> ${cond.direction}</div>
      `;
      break;
      
    default:
      detailsHTML = `<div class="condition-detail">${formatConditionSummary(cond)}</div>`;
  }
  
  // Add exit targeting info if this is an exit condition
  let targetingHTML = '';
  if (type === 'exit' && cond.target_entries) {
    if (cond.target_entries === 'all') {
      targetingHTML = `<div class="condition-targeting">Exits: <strong>All Entry Conditions</strong></div>`;
    } else if (Array.isArray(cond.target_entries)) {
      targetingHTML = `<div class="condition-targeting">Exits: <strong>Entry ${cond.target_entries.map((_, i) => `#${i+1}`).join(', ')}</strong></div>`;
    }
  }
  
  return `
    <div class="condition-card" data-condition-index="${index}">
      <div class="condition-header">
        <span class="condition-type-label">${conditionTypeLabel}</span>
        <div class="condition-actions">
          <button class="btn-icon-text" onclick="window.duplicateRunCondition(${runId}, '${type}', ${index})" title="Duplicate">Duplicate</button>
          <button class="btn-icon-text" onclick="window.editRunCondition(${runId}, '${type}', ${index})" title="Edit">Edit</button>
          <button class="btn-icon-text btn-danger" onclick="window.deleteRunCondition(${runId}, '${type}', ${index})" title="Delete">Delete</button>
        </div>
      </div>
      ${targetingHTML}
      <div class="condition-details">
        ${detailsHTML}
      </div>
    </div>
  `;
}

/**
 * Get human-readable label for condition type
 */
function getConditionTypeLabel(type) {
  const labels = {
    'timing': 'Timing',
    'price': 'Price',
    'rsi': 'RSI',
    'ma_crossover': 'MA Crossover',
    'macd': 'MACD',
    'sma': 'SMA',
    'ema': 'EMA',
    'volume': 'Volume',
    'bb': 'Bollinger Bands'
  };
  return labels[type] || type;
}

/**
 * Format condition as human-readable summary
 * @param {Object} condition - Condition object
 * @returns {string} Formatted string
 */
function formatConditionSummary(condition) {
  switch (condition.type) {
    case 'rsi':
      const rsiComp = condition.comparison?.replace(/_/g, ' ') || 'unknown';
      return `RSI(${condition.rsi_period}) ${rsiComp} ${condition.value}`;
    
    case 'macd':
      const signalText = condition.signal_type?.replace(/_/g, ' ') || 'unknown signal';
      return `MACD(${condition.fast_period}, ${condition.slow_period}, ${condition.signal_period}) - ${signalText}`;
    
    case 'sma':
    case 'ema':
      const maType = condition.type.toUpperCase();
      const crossDir = condition.signal === 'cross_above' ? 'crosses above' : 'crosses below';
      return `${maType}(${condition.fast_period}) ${crossDir} ${maType}(${condition.slow_period})`;
    
    case 'price':
      const priceComp = condition.comparison?.replace(/_/g, ' ') || 'unknown';
      return `Price ${priceComp} ${condition.value}`;
    
    case 'volume':
      const volComp = condition.comparison === 'greater_than' ? '>' : '<';
      return `Volume ${volComp} ${condition.multiplier}x SMA(${condition.ma_period})`;
    
    case 'bb':
      const bbSignal = condition.signal?.replace(/_/g, ' ') || 'unknown signal';
      return `BB(${condition.bb_period}, ${condition.bb_std}σ) - ${bbSignal}`;
    
    default:
      return `${condition.type} condition`;
  }
}

/**
 * Render portfolio strategies list
 * @param {Array} strategies - Array of {strategyId, weight}
 * @param {number} runId - Run ID
 * @returns {string} HTML string
 */
function renderPortfolioStrategies(strategies, runId) {
  if (strategies.length === 0) {
    return `<p style="color: var(--text-secondary); font-size: 12px;">No strategies added yet</p>`;
  }
  
  return strategies.map((strat, index) => {
    const weightPercent = (strat.weight * 100).toFixed(1);
    return `
      <div class="portfolio-strategy-item">
        <div class="strategy-info">
          <strong>Strategy #${strat.strategyId}</strong>
          <span class="strategy-weight">${weightPercent}%</span>
        </div>
        <div class="strategy-actions">
          <input type="number" 
                 value="${strat.weight}" 
                 step="0.01" 
                 min="0" 
                 max="1" 
                 onchange="window.updatePortfolioStrategyWeight(${runId}, ${index}, parseFloat(this.value))"
                 style="width: 80px;">
          <button class="btn-icon" onclick="window.removePortfolioStrategy(${runId}, ${index})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Load and display saved strategies from database for a run
 * @param {number} runId - The run ID
 * @param {string} conditionType - 'entry' or 'exit'
 */
export async function loadDatabaseStrategiesForRun(runId, conditionType) {
  const entryContainer = document.getElementById(`savedStrategiesEntry_${runId}`);
  const exitContainer = document.getElementById(`savedStrategiesExit_${runId}`);
  
  if (!entryContainer && !exitContainer) {
    console.log('[RUNS UI] No saved strategies containers found');
    return;
  }
  
  // Check if database is connected
  const dbPath = document.getElementById('dbPath')?.textContent;
  if (!dbPath || dbPath === 'No database selected') {
    if (entryContainer) entryContainer.innerHTML = '';
    if (exitContainer) exitContainer.innerHTML = '';
    return;
  }
  
  try {
    // Get favorites (saved strategies)
    const result = await window.electronAPI.getFavorites();
    
    if (!result.success || !result.data || result.data.length === 0) {
      if (entryContainer) entryContainer.innerHTML = '';
      if (exitContainer) exitContainer.innerHTML = '';
      return;
    }
    
    const favorites = result.data;
    
    // Render the strategies for both entry and exit
    const html = `
      <div class="saved-strategies-list">
        <div class="saved-strategies-header">Load from Database</div>
        ${favorites.map(fav => {
          const typeLabel = fav.type === 'strategy' ? 'Single' : 'Portfolio';
          const typeClass = fav.type === 'strategy' ? 'strategy' : 'portfolio';
          
          return `
            <div class="saved-strategy-item">
              <div class="saved-strategy-info">
                <span class="favorite-type-badge ${typeClass}">${typeLabel}</span>
                <span class="saved-strategy-name">${fav.name}</span>
              </div>
              <button class="btn-sm btn-secondary" 
                      onclick="window.loadSavedStrategyAsCondition(${runId}, ${fav.id}, 'entry')"
                      title="Use as entry condition">
                Use as Entry
              </button>
              <button class="btn-sm btn-secondary" 
                      onclick="window.loadSavedStrategyAsCondition(${runId}, ${fav.id}, 'exit')"
                      title="Use as exit condition">
                Use as Exit
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    if (entryContainer) entryContainer.innerHTML = html;
    if (exitContainer) exitContainer.innerHTML = html;
    
  } catch (error) {
    console.error('[RUNS UI] Error loading database strategies:', error);
  }
}

// Window functions for run configuration
window.updateRunTimeframe = (runId, timeframe) => {
  const run = BacktestRuns.getRun(runId);
  if (run) {
    run.timeframe = timeframe;
    BacktestRuns.saveRuns?.() || saveRunsToLocalStorage();
    console.log(`[RUNS UI] Updated timeframe for run ${runId} to ${timeframe}`);
  }
};

window.updateRunStartDate = (runId, startDate) => {
  const run = BacktestRuns.getRun(runId);
  if (run) {
    run.startDate = startDate || null;
    BacktestRuns.saveRuns?.() || saveRunsToLocalStorage();
    console.log(`[RUNS UI] Updated start date for run ${runId} to ${startDate || 'auto'}`);
  }
};

window.updateRunEndDate = (runId, endDate) => {
  const run = BacktestRuns.getRun(runId);
  if (run) {
    run.endDate = endDate || null;
    BacktestRuns.saveRuns?.() || saveRunsToLocalStorage();
    console.log(`[RUNS UI] Updated end date for run ${runId} to ${endDate || 'today'}`);
  }
};

// Helper to save runs if not exported from BacktestRuns
function saveRunsToLocalStorage() {
  const runs = BacktestRuns.getAllRuns();
  localStorage.setItem('backtestRuns', JSON.stringify(runs));
  console.log('[RUNS UI] Saved runs to localStorage');
}

console.log('[INIT] Backtest Runs UI module loaded');
