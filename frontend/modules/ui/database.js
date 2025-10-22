// Database UI Module - Handles database selection, runs list, and filtering
import * as State from '../core/state.js';
import * as API from '../core/api.js';

// DOM Elements (will be set by init)
let dbPathEl, runsList, runSearch, modeFilter;
// compareBtn removed - Compare feature no longer needed

// Status message helper
function setStatus(message, isError = false) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
    statusText.className = isError ? 'error' : '';
  }
}

/**
 * Initialize DOM elements
 * Call this after DOM is loaded
 */
export function initializeDatabaseUI(elements) {
  dbPathEl = elements.dbPathEl;
  runsList = elements.runsList;
  runSearch = elements.runSearch;
  modeFilter = elements.modeFilter;
  // compareBtn removed - Compare feature no longer needed
  
  // Attach event listeners
  if (runSearch) {
    runSearch.addEventListener('input', filterRuns);
  }
  if (modeFilter) {
    modeFilter.addEventListener('change', filterRuns);
  }
  
  console.log('[DATABASE UI] Initialized');
}

/**
 * Select database file
 */
export async function selectDatabase() {
  setStatus('Selecting database...');
  const result = await API.selectDb();
  
  if (result.success) {
    State.setCurrentDb(result.path);
    dbPathEl.textContent = result.path;
    setStatus('Database connected');
    await loadRuns();
    
    // Trigger other loads that depend on database
    window.loadFavorites?.();
    window.loadWatchlistsForBacktest?.();
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

/**
 * Load all runs from database
 */
export async function loadRuns() {
  setStatus('Loading runs...');
  const result = await API.getRuns();
  
  if (result.success) {
    State.setAllRuns(result.data);
    displayRuns(State.getAllRuns());
    setStatus(`Loaded ${State.getAllRuns().length} runs`);
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

/**
 * Display runs in the sidebar
 */
export function displayRuns(runs) {
  if (!runs || runs.length === 0) {
    runsList.innerHTML = '<div class="empty-state"><p>No runs found</p></div>';
    return;
  }
  
  // Count single and portfolio runs for numbering
  let singleCount = 0;
  let portfolioCount = 0;
  
  runsList.innerHTML = runs.map(run => {
    const startDate = new Date(run.started_at * 1000).toLocaleString();
    
    // Calculate duration
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
    
    // Generate display label with counter
    let modeLabel;
    if (run.mode === 'portfolio') {
      portfolioCount++;
      modeLabel = `Portfolio (#${portfolioCount})`;
    } else {
      singleCount++;
      modeLabel = `Single (#${singleCount})`;
    }
    
    return `
      <div class="run-item" data-run-id="${run.run_id}">
        <div class="run-item-header">
          <span class="run-id">${run.run_id}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="run-mode ${run.mode === 'portfolio' ? 'portfolio' : 'single'}">${modeLabel}</span>
            <button class="btn-delete-run" data-run-id="${run.run_id}" title="Delete run">✕</button>
          </div>
        </div>
        <div class="run-info">${startDate}</div>
        <div class="run-info">${duration} • ${run.result_count || 0} strategies</div>
        ${run.notes ? `<div class="run-notes">${run.notes}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click handlers for run items
  document.querySelectorAll('.run-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Ignore clicks on delete button
      if (e.target.classList.contains('btn-delete-run')) {
        return;
      }
      
      const runId = item.dataset.runId;
      
      if (e.ctrlKey || e.metaKey) {
        // Multi-select for comparison
        const selectedRuns = State.getSelectedRuns();
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
        handleRunSelection(runId, item);
      }
    });
  });
  
  // Add delete button handlers
  document.querySelectorAll('.btn-delete-run').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const runId = btn.dataset.runId;
      // Call the global deleteRun function (still in renderer.js)
      if (window.deleteRun) {
        await window.deleteRun(runId, e);
      }
    });
  });
}

/**
 * Handle single run selection
 */
function handleRunSelection(runId, itemElement) {
  document.querySelectorAll('.run-item').forEach(i => i.classList.remove('selected'));
  itemElement.classList.add('selected');
  
  const selectedRuns = State.getSelectedRuns();
  selectedRuns.clear();
  selectedRuns.add(runId);
  // Compare button removed - no longer needed
  
  const run = State.getAllRuns().find(r => r.run_id === runId);
  if (run) {
    State.setCurrentRun(run);
    
    console.log('[DATABASE UI] Selected run:', run.run_id, 'Mode:', run.mode);
    
    // Reset Trades tab button
    const tradesBtn = document.querySelector('[data-tab="trades"]');
    if (tradesBtn) {
      tradesBtn.innerHTML = 'Trades';
      tradesBtn.style.color = '';
    }
    
    // Switch to overview tab first
    if (window.switchToTab) {
      window.switchToTab('overview');
    }
    
    // Update tab visibility based on run mode
    if (window.updateTabVisibility) {
      window.updateTabVisibility();
    }
    
    // Load run details
    if (window.loadRunDetails) {
      window.loadRunDetails(run);
    }
    
    // Load data based on mode
    if (run.mode === 'portfolio') {
      console.log('[DATABASE UI] Loading portfolio data...');
      if (window.loadPortfolio) window.loadPortfolio(runId);
      if (window.loadTrades) window.loadTrades(runId);
    } else {
      console.log('[DATABASE UI] Loading strategies data...');
      if (window.loadStrategies) window.loadStrategies(runId);
      
      const tradesContent = document.getElementById('tradesContent');
      if (tradesContent) {
        tradesContent.innerHTML = `
          <div class="empty-state">
            <p>Select a strategy to view its trades</p>
          </div>
        `;
      }
    }
  }
}

/**
 * Filter runs by search term and mode
 */
export function filterRuns() {
  const searchTerm = runSearch?.value?.toLowerCase() || '';
  const mode = modeFilter?.value || '';
  
  const filtered = State.getAllRuns().filter(run => {
    const matchesSearch = run.run_id.toLowerCase().includes(searchTerm) ||
                         (run.notes && run.notes.toLowerCase().includes(searchTerm));
    const matchesMode = !mode || run.mode === mode;
    return matchesSearch && matchesMode;
  });
  
  displayRuns(filtered);
}
