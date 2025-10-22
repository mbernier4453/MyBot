/**
 * Backtest Runs Module
 * Manages run creation, editing, deletion, and state
 * New architecture: Each run contains entry conditions + exit conditions
 * Backend tests: every entry × every exit = N strategies per run
 */

import * as State from '../core/state.js';

// ========================================
// State Management
// ========================================

let runs = [];
let selectedRunId = null;
let nextRunId = 1;

// Load runs from localStorage on init
function initializeRuns() {
  const stored = localStorage.getItem('backtestRuns');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      runs = data.runs || [];
      nextRunId = data.nextRunId || 1;
      
      // Auto-select first run if exists
      if (runs.length > 0 && !selectedRunId) {
        selectedRunId = runs[0].id;
      }
      
      console.log(`[RUNS] Loaded ${runs.length} runs from localStorage`);
    } catch (e) {
      console.error('[RUNS] Failed to parse stored runs:', e);
      runs = [];
      nextRunId = 1;
    }
  } else {
    // Create default run for new users
    runs = [createDefaultRun()];
    selectedRunId = runs[0].id;
    saveRuns();
    console.log('[RUNS] Created default run');
  }
}

// Save runs to localStorage
function saveRuns() {
  const data = {
    runs,
    nextRunId,
    lastModified: new Date().toISOString()
  };
  localStorage.setItem('backtestRuns', JSON.stringify(data));
  console.log(`[RUNS] Saved ${runs.length} runs to localStorage`);
}

// Create a default run with sensible defaults
function createDefaultRun(type = 'strategy') {
  const base = {
    id: nextRunId++,
    name: type === 'portfolio' ? 'New Portfolio' : 'New Strategy',
    type: type, // 'strategy' | 'portfolio'
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };
  
  if (type === 'strategy') {
    // Strategy Run: tests tickers with entry/exit conditions
    return {
      ...base,
      tickers: ['AAPL'], // Default to 1 ticker (user can add more)
      
      // Entry conditions (1+ required)
      entryConditions: [
        {
          type: 'rsi',
          rsi_period: 14,
          interaction: 'crosses_below',
          target_type: 'Value',
          target_value: 30,
          position_type: 'long'
        }
      ],
      
      // Exit conditions (can include take profit, stop loss, or condition-based)
      exitConditions: [
        {
          type: 'rsi',
          rsi_period: 14,
          interaction: 'crosses_above',
          target_type: 'Value',
          target_value: 70
        }
      ],
      
      // Exit rules
      takeProfitEnabled: false,
      takeProfitType: 'percent',
      takeProfitPercent: 10,
      takeProfitDollar: 100,
      
      stopLossEnabled: false,
      stopLossType: 'percent',
      stopLossPercent: 5,
      stopLossDollar: 100,
      
      // Modes
      entryMode: 'all', // 'all' or 'any'
      exitMode: 'any'   // 'all' or 'any'
    };
  } else {
    // Portfolio Run: combines saved strategies with weights
    return {
      ...base,
      portfolioStrategies: [], // Array of { strategyId, weight }
      rebalancing: 'none' // 'none' | 'monthly' | 'quarterly'
    };
  }
}

// ========================================
// CRUD Operations
// ========================================

/**
 * Add a new run
 * @param {string} type - Run type: 'strategy' or 'portfolio'
 * @param {string} name - Optional name for the run
 * @returns {Object} The created run
 */
export function addRun(type = 'strategy', name = null) {
  const run = createDefaultRun(type);
  if (name) run.name = name;
  runs.push(run);
  selectedRunId = run.id;
  saveRuns();
  
  console.log('[RUNS] Added run:', run.type, run.name);
  return run;
}

/**
 * Delete a run by ID
 * @param {number} runId - Run ID to delete
 * @returns {boolean} Success
 */
export function deleteRun(runId) {
  const index = runs.findIndex(r => r.id === runId);
  if (index === -1) {
    console.error('[RUNS] Run not found:', runId);
    return false;
  }
  
  const deletedRun = runs[index];
  runs.splice(index, 1);
  
  // If we deleted the selected run, select another
  if (selectedRunId === runId) {
    selectedRunId = runs.length > 0 ? runs[0].id : null;
  }
  
  saveRuns();
  console.log('[RUNS] Deleted run:', deletedRun.name);
  return true;
}

/**
 * Duplicate a run
 * @param {number} runId - Run ID to duplicate
 * @returns {Object} The duplicated run
 */
export function duplicateRun(runId) {
  const run = getRun(runId);
  if (!run) {
    console.error('[RUNS] Run not found:', runId);
    return null;
  }
  
  const duplicate = {
    ...JSON.parse(JSON.stringify(run)), // Deep clone
    id: nextRunId++,
    name: `${run.name} (Copy)`,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };
  
  runs.push(duplicate);
  selectedRunId = duplicate.id;
  saveRuns();
  
  console.log('[RUNS] Duplicated run:', duplicate.name);
  return duplicate;
}

/**
 * Update a run
 * @param {number} runId - Run ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object} The updated run
 */
export function updateRun(runId, updates) {
  const run = getRun(runId);
  if (!run) {
    console.error('[RUNS] Run not found:', runId);
    return null;
  }
  
  Object.assign(run, updates);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Updated run:', run.name);
  return run;
}

/**
 * Get a run by ID
 * @param {number} runId - Run ID
 * @returns {Object|null} The run or null
 */
export function getRun(runId) {
  return runs.find(r => r.id === runId) || null;
}

/**
 * Get all runs
 * @returns {Array} All runs
 */
export function getAllRuns() {
  return runs;
}

/**
 * Get selected run
 * @returns {Object|null} The selected run or null
 */
export function getSelectedRun() {
  return selectedRunId ? getRun(selectedRunId) : null;
}

/**
 * Set selected run
 * @param {number} runId - Run ID to select
 */
export function setSelectedRun(runId) {
  if (runs.find(r => r.id === runId)) {
    selectedRunId = runId;
    console.log('[RUNS] Selected run:', runId);
  } else {
    console.error('[RUNS] Cannot select non-existent run:', runId);
  }
}

/**
 * Get selected run ID
 * @returns {number|null} Selected run ID
 */
export function getSelectedRunId() {
  return selectedRunId;
}

// ========================================
// Condition Management (per-run)
// ========================================

/**
 * Add entry condition to a run
 * @param {number} runId - Run ID
 * @param {Object} condition - Condition object
 * @returns {boolean} Success
 */
export function addEntryCondition(runId, condition) {
  const run = getRun(runId);
  if (!run) return false;
  
  run.entryConditions.push(condition);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Added entry condition to run:', run.name);
  return true;
}

/**
 * Remove entry condition from a run
 * @param {number} runId - Run ID
 * @param {number} index - Condition index
 * @returns {boolean} Success
 */
export function removeEntryCondition(runId, index) {
  const run = getRun(runId);
  if (!run || index < 0 || index >= run.entryConditions.length) return false;
  
  run.entryConditions.splice(index, 1);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Removed entry condition from run:', run.name);
  return true;
}

/**
 * Update entry condition in a run
 * @param {number} runId - Run ID
 * @param {number} index - Condition index
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success
 */
export function updateEntryCondition(runId, index, updates) {
  const run = getRun(runId);
  if (!run || index < 0 || index >= run.entryConditions.length) return false;
  
  Object.assign(run.entryConditions[index], updates);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  return true;
}

/**
 * Add exit condition to a run
 * @param {number} runId - Run ID
 * @param {Object} condition - Condition object
 * @returns {boolean} Success
 */
export function addExitCondition(runId, condition) {
  const run = getRun(runId);
  if (!run) return false;
  
  run.exitConditions.push(condition);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Added exit condition to run:', run.name);
  return true;
}

/**
 * Remove exit condition from a run
 * @param {number} runId - Run ID
 * @param {number} index - Condition index
 * @returns {boolean} Success
 */
export function removeExitCondition(runId, index) {
  const run = getRun(runId);
  if (!run || index < 0 || index >= run.exitConditions.length) return false;
  
  run.exitConditions.splice(index, 1);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Removed exit condition from run:', run.name);
  return true;
}

/**
 * Update exit condition in a run
 * @param {number} runId - Run ID
 * @param {number} index - Condition index
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success
 */
export function updateExitCondition(runId, index, updates) {
  const run = getRun(runId);
  if (!run || index < 0 || index >= run.exitConditions.length) return false;
  
  Object.assign(run.exitConditions[index], updates);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  return true;
}

// ========================================
// Portfolio Management (for portfolio runs)
// ========================================

/**
 * Add strategy to portfolio run
 * @param {number} runId - Portfolio run ID
 * @param {number} strategyId - Saved strategy ID
 * @param {number} weight - Weight (0-1)
 * @returns {boolean} Success
 */
export function addPortfolioStrategy(runId, strategyId, weight = 0.5) {
  const run = getRun(runId);
  if (!run || run.type !== 'portfolio') {
    console.error('[RUNS] Cannot add strategy to non-portfolio run');
    return false;
  }
  
  run.portfolioStrategies.push({ strategyId, weight });
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Added strategy to portfolio:', strategyId);
  return true;
}

/**
 * Remove strategy from portfolio run
 * @param {number} runId - Portfolio run ID
 * @param {number} index - Strategy index
 * @returns {boolean} Success
 */
export function removePortfolioStrategy(runId, index) {
  const run = getRun(runId);
  if (!run || run.type !== 'portfolio') return false;
  if (index < 0 || index >= run.portfolioStrategies.length) return false;
  
  run.portfolioStrategies.splice(index, 1);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Removed strategy from portfolio');
  return true;
}

/**
 * Update strategy weight in portfolio run
 * @param {number} runId - Portfolio run ID
 * @param {number} index - Strategy index
 * @param {number} weight - New weight
 * @returns {boolean} Success
 */
export function updatePortfolioStrategyWeight(runId, index, weight) {
  const run = getRun(runId);
  if (!run || run.type !== 'portfolio') return false;
  if (index < 0 || index >= run.portfolioStrategies.length) return false;
  
  run.portfolioStrategies[index].weight = weight;
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  return true;
}

/**
 * Normalize portfolio weights to sum to 1.0
 * @param {number} runId - Portfolio run ID
 * @returns {boolean} Success
 */
export function normalizePortfolioWeights(runId) {
  const run = getRun(runId);
  if (!run || run.type !== 'portfolio') return false;
  if (run.portfolioStrategies.length === 0) return false;
  
  const totalWeight = run.portfolioStrategies.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return false;
  
  run.portfolioStrategies.forEach(s => {
    s.weight = s.weight / totalWeight;
  });
  
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Normalized portfolio weights');
  return true;
}

// ========================================
// Ticker Management (for strategy runs)
// ========================================

/**
 * Set tickers for a strategy run
 * @param {number} runId - Strategy run ID
 * @param {Array<string>} tickers - Array of ticker symbols
 * @returns {boolean} Success
 */
export function setRunTickers(runId, tickers) {
  const run = getRun(runId);
  if (!run || run.type !== 'strategy') {
    console.error('[RUNS] Cannot set tickers on non-strategy run');
    return false;
  }
  
  run.tickers = tickers.map(t => t.toUpperCase().trim()).filter(t => t);
  run.modifiedAt = new Date().toISOString();
  saveRuns();
  
  console.log('[RUNS] Updated tickers:', run.tickers);
  return true;
}

// ========================================
// Initialization
// ========================================

// Initialize on module load
initializeRuns();

console.log('[INIT] Backtest Runs module loaded');
