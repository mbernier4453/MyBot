/**
 * Backtest execution module
 * Handles running full backtests via backend API
 */

import { runBacktest as apiRunBacktest } from '../core/api.js';
import { getRun } from './runs.js';

/**
 * Run a backtest for a specific run configuration
 * @param {number} runId - Run ID to execute
 */
export async function runBacktestForRun(runId) {
  console.log(`[BACKTEST] Starting backtest for run ${runId}`);
  
  const run = getRun(runId);
  if (!run) {
    console.error(`[BACKTEST] Run ${runId} not found`);
    alert('Run configuration not found');
    return;
  }
  
  // Validate run has required data
  if (!run.tickers || run.tickers.length === 0) {
    alert('Please select at least one ticker');
    return;
  }
  
  if (!run.entryConditions || run.entryConditions.length === 0) {
    alert('Please add at least one entry condition');
    return;
  }
  
  try {
    // Show loading state
    const statusDiv = document.getElementById('backtest-status');
    if (statusDiv) {
      statusDiv.innerHTML = '<div class="status-loading">Running backtest...</div>';
      statusDiv.style.display = 'block';
    }
    
    // Select database location
    const dbPath = await selectDatabaseLocation(run.name);
    if (!dbPath) {
      console.log('[BACKTEST] User cancelled database selection');
      return;
    }
    
    console.log(`[BACKTEST] Using database: ${dbPath}`);
    
    // Prepare backtest parameters
    const params = {
      name: run.name,
      tickers: run.tickers,
      startDate: run.startDate || '2023-01-01',
      endDate: run.endDate || new Date().toISOString().split('T')[0],
      indicators: run.indicators || {},
      entryConditions: formatConditions(run.entryConditions),
      exitConditions: formatConditions(run.exitConditions),
      initialCapital: run.initialCapital || 100000,
      positionSizing: run.positionSizing || 'equal',
      maxPositions: run.maxPositions || 10,
      slippage: run.slippage || 0.001,
      commission: run.commission || 0.001,
      dbPath: dbPath
    };
    
    console.log('[BACKTEST] Submitting backtest with params:', params);
    
    // Call backend API
    const result = await apiRunBacktest(params);
    
    if (result.success) {
      console.log('[BACKTEST] Backtest completed successfully:', result.data);
      
      // Show success message
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="status-success">
            <h3>Backtest Complete!</h3>
            <p>Run ID: ${result.data.run_id}</p>
            <p>Total Trades: ${result.data.total_trades || 0}</p>
            <p>Results saved to: ${dbPath}</p>
            <button onclick="window.viewBacktestResults('${result.data.run_id}')">View Results</button>
          </div>
        `;
      }
      
      // Store result reference
      run.lastBacktestResult = {
        run_id: result.data.run_id,
        timestamp: new Date().toISOString(),
        dbPath: dbPath
      };
      
      // Save run
      const { saveRuns } = await import('./runs.js');
      saveRuns();
      
    } else {
      throw new Error(result.error || 'Backtest failed');
    }
    
  } catch (error) {
    console.error('[BACKTEST] Error running backtest:', error);
    
    const statusDiv = document.getElementById('backtest-status');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="status-error">
          <h3>Backtest Failed</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
    
    alert(`Backtest failed: ${error.message}`);
  }
}

/**
 * Select database location for storing results
 * @param {string} runName - Name of the run for default filename
 * @returns {Promise<string|null>} - Selected database path or null if cancelled
 */
async function selectDatabaseLocation(runName) {
  return new Promise((resolve) => {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>Select Database Location</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); window.dbSelectResolve(null);">&times;</button>
        </div>
        <div class="modal-body">
          <p>Choose where to save backtest results:</p>
          
          <div class="db-options">
            <div class="db-option">
              <input type="radio" id="db-new" name="db-choice" value="new" checked>
              <label for="db-new">
                <strong>Create New Database</strong>
                <p>Save results to a new database file</p>
              </label>
            </div>
            
            <div class="db-option">
              <input type="radio" id="db-existing" name="db-choice" value="existing">
              <label for="db-existing">
                <strong>Use Existing Database</strong>
                <p>Append results to an existing database</p>
              </label>
            </div>
            
            <div class="db-option">
              <input type="radio" id="db-default" name="db-choice" value="default">
              <label for="db-default">
                <strong>Use Default Database</strong>
                <p>Save to: results/db/backtests.db</p>
              </label>
            </div>
          </div>
          
          <div id="db-path-section" style="display: none; margin-top: 20px;">
            <label>Database Path:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="db-path-input" class="form-control" readonly style="flex: 1;">
              <button class="btn btn-secondary" onclick="window.browseForDatabase()">Browse...</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); window.dbSelectResolve(null);">Cancel</button>
          <button class="btn btn-primary" onclick="window.confirmDatabaseSelection()">Continue</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store resolve function
    window.dbSelectResolve = resolve;
    
    // Handle radio button changes
    const radios = modal.querySelectorAll('input[name="db-choice"]');
    const pathSection = modal.querySelector('#db-path-section');
    const pathInput = modal.querySelector('#db-path-input');
    
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'new' || radio.value === 'existing') {
          pathSection.style.display = 'block';
          pathInput.value = '';
        } else {
          pathSection.style.display = 'none';
          pathInput.value = 'results/db/backtests.db';
        }
      });
    });
    
    // Browse for database
    window.browseForDatabase = async () => {
      const choice = modal.querySelector('input[name="db-choice"]:checked').value;
      const isExisting = choice === 'existing';
      
      // Use Electron dialog if available
      if (window.electronAPI && window.electronAPI.selectDatabase) {
        const path = await window.electronAPI.selectDatabase(isExisting);
        if (path) {
          pathInput.value = path;
        }
      } else {
        // Fallback: create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db';
        
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            pathInput.value = file.path || file.name;
          }
        };
        
        input.click();
      }
    };
    
    // Confirm selection
    window.confirmDatabaseSelection = () => {
      const choice = modal.querySelector('input[name="db-choice"]:checked').value;
      let dbPath;
      
      if (choice === 'default') {
        dbPath = 'results/db/backtests.db';
      } else {
        dbPath = pathInput.value;
        if (!dbPath) {
          alert('Please select a database file');
          return;
        }
      }
      
      // If creating new database, suggest filename
      if (choice === 'new' && !dbPath.endsWith('.db')) {
        const safeName = runName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        dbPath = `results/db/${safeName}_${Date.now()}.db`;
      }
      
      modal.remove();
      resolve(dbPath);
      
      // Cleanup
      delete window.dbSelectResolve;
      delete window.browseForDatabase;
      delete window.confirmDatabaseSelection;
    };
  });
}

/**
 * Format conditions for backend API
 * Same logic as preview.js
 */
function formatConditions(conditions) {
  if (!conditions || !Array.isArray(conditions)) {
    return [];
  }

  return conditions.map(cond => {
    const baseCondition = {};
    
    if (cond.type === 'price') {
      baseCondition.source = cond.priceType || 'close';
      baseCondition.comparison = cond.interaction === 'cross' 
        ? `crosses_${cond.direction || 'above'}` 
        : cond.interaction || 'above';
      
      if (cond.target_type === 'Value') {
        baseCondition.target = parseFloat(cond.target_value) || 0;
      } else {
        const maType = cond.target_type.toLowerCase();
        const period = cond.target_period || 20;
        baseCondition.target = `${maType}_${period}`;
      }
    } else if (cond.type === 'rsi') {
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
      baseCondition.source = cond.source || cond.indicator || 'close';
      baseCondition.comparison = cond.comparison || 'above';
      baseCondition.target = cond.target !== undefined ? cond.target : (parseFloat(cond.value) || 0);
    }
    
    // Add advanced parameters
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
}

/**
 * View results for a completed backtest
 */
export async function viewBacktestResults(runId) {
  console.log(`[BACKTEST] Viewing results for run ${runId}`);
  // TODO: Implement results viewer
  // Switch to results tab and load data
  const { switchToPage } = await import('../ui/tabs.js');
  switchToPage('results');
}

// Export to window for onclick handlers
window.runBacktestForRun = runBacktestForRun;
window.viewBacktestResults = viewBacktestResults;

console.log('[INIT] Backtest execution module loaded');
