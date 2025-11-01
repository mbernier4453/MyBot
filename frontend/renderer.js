// Import modules
import * as State from './modules/core/state.js';
import * as Utils from './modules/core/utils.js';
import * as API from './modules/core/api.js';
import tickerGroups from './modules/core/ticker-groups.js';
import * as DatabaseUI from './modules/ui/database.js';
import * as TabsUI from './modules/ui/tabs.js';
import * as BacktestConfig from './modules/backtest/config.js';
import * as BacktestRuns from './modules/backtest/runs.js';
import * as BacktestRunsUI from './modules/backtest/runs-ui.js';
import { RunPreview } from './modules/backtest/preview.js';
import { FavoritesUI } from './modules/features/favorites.js';
import { ConditionModals } from './modules/backtest/conditions.js';
import * as BacktestExecution from './modules/backtest/execution.js';
import Indicators from './modules/indicators/calculations.js';
import ConfigManagerModule from './modules/backtest/config-manager.js'; // Import early for color functions
import PolygonTreemap from './modules/features/polygon-treemap.js';
import FinancialsPage from './modules/features/financials-page.js';
import RatiosPage from './modules/features/ratios-page.js';
import ChartTabSystem from './modules/charts/chart-tabs.js';
import CandlestickChart from './modules/charts/candlestick.js';
import RSIDashboard from './modules/features/rsi-dashboard.js';
import * as Formatters from './modules/core/formatters.js';

console.log('[INIT] BacktestConfig module functions:', Object.keys(BacktestConfig));
console.log('[INIT] BacktestRuns module functions:', Object.keys(BacktestRuns));
console.log('[INIT] BacktestRunsUI module functions:', Object.keys(BacktestRunsUI));
console.log('[INIT] FavoritesUI module functions:', Object.keys(FavoritesUI));
console.log('[INIT] ConditionModals module functions:', Object.keys(ConditionModals));
console.log('[APP] Modules loaded successfully!');
console.log('[APP] Utils functions available:', Object.keys(Utils).length);
console.log('[APP] API functions available:', Object.keys(API).length);
console.log('[APP] DatabaseUI functions available:', Object.keys(DatabaseUI).length);
console.log('[APP] TabsUI functions available:', Object.keys(TabsUI).length);

console.log('[RENDERER] Module loaded, preparing to initialize DOM...');

// Initialize state
State.initializeState();

// State - TODO: Migrate to use State module
// NOTE: currentRun now managed by State module - use State.getCurrentRun() and State.setCurrentRun()
let currentDb = null;
let allRuns = [];
let selectedRuns = new Set();
let currentStrategies = [];
let currentTrades = [];
let buyHoldMetrics = {};
let currentSortField = 'total_return';
let currentSortDesc = true;

// DOM Elements - will be initialized after DOM loads
let selectDbBtn, dbPathEl, runsList, statusText, tabs, tabContents;
let runSearch, modeFilter, tickerFilter, tradeSearch, sideFilter;
// compareBtn removed - Compare feature no longer needed
let backtestDbPathInput, selectBacktestDbBtn, clearBacktestDbBtn;
let backtestDbPath = null; // Stores the selected database path
let mainTabs, mainPages;

// Function to switch to a specific tab
// Tab management - delegated to TabsUI module
const switchToTab = TabsUI.switchToTab;

// CRITICAL: Expose switchToTab to window IMMEDIATELY
window.switchToTab = switchToTab;
console.log('[INIT] Exposed switchToTab:', typeof window.switchToTab);

// Main navigation and tab switching will be initialized in initializeDOMElements()

// Database functions - now handled by DatabaseUI module
const selectDatabase = () => DatabaseUI.selectDatabase();
const loadRuns = () => DatabaseUI.loadRuns();
const displayRuns = (runs) => DatabaseUI.displayRuns(runs);
const filterRuns = () => DatabaseUI.filterRuns();

// Favorites functions - now handled by FavoritesUI module
const loadFavorites = () => FavoritesUI.loadFavorites();
const addToFavorites = (...args) => FavoritesUI.addToFavorites(...args);
const removeFavorite = (id) => FavoritesUI.removeFavorite(id);
const loadFavorite = (...args) => FavoritesUI.loadFavorite(...args);
const toggleFolder = (id) => FavoritesUI.toggleFolder(id);

// Chart utilities - expose addWatermark for chart modules
window.addWatermark = Utils.addWatermark;
const createNewFolder = () => FavoritesUI.createNewFolder();
const promptCreateFolder = () => FavoritesUI.promptCreateFolder();
const closeCreateFolderModal = () => FavoritesUI.closeCreateFolderModal();
const deleteFolderPrompt = (...args) => FavoritesUI.deleteFolderPrompt(...args);
const closeDeleteFolderModal = () => FavoritesUI.closeDeleteFolderModal();
const showMoveToFolderDialog = (id) => FavoritesUI.showMoveToFolderDialog(id);
const promptSavePortfolioAsStrategy = (runId) => FavoritesUI.promptSavePortfolioAsStrategy(runId);
const closeSaveStrategyModal = () => FavoritesUI.closeSaveStrategyModal();
const openCreateFolderModalFromStrategy = () => FavoritesUI.openCreateFolderModalFromStrategy();

// Expose favorites functions to window
window.addToFavorites = addToFavorites;
window.removeFavorite = removeFavorite;
window.loadFavorite = loadFavorite;
window.toggleFolder = toggleFolder;
window.createNewFolder = createNewFolder;
window.promptCreateFolder = promptCreateFolder;
window.closeCreateFolderModal = closeCreateFolderModal;
window.deleteFolderPrompt = deleteFolderPrompt;
window.closeDeleteFolderModal = closeDeleteFolderModal;
window.showMoveToFolderDialog = showMoveToFolderDialog;
window.promptSavePortfolioAsStrategy = promptSavePortfolioAsStrategy;
window.closeSaveStrategyModal = closeSaveStrategyModal;
window.openCreateFolderModalFromStrategy = openCreateFolderModalFromStrategy;

// Condition modal functions - now handled by ConditionModals module
const showRunConditionTypeModal = (...args) => ConditionModals.showTypeModal(...args);
const showRunConditionConfigModal = (...args) => ConditionModals.showConfigModal(...args);

// Expose condition modal functions to window
window.showRunConditionTypeModal = showRunConditionTypeModal;
window.showRunConditionConfigModal = showRunConditionConfigModal;
window.toggleModalTargetFields = () => ConditionModals.toggleTargetFields();
window.toggleModalDirectionField = () => ConditionModals.toggleDirectionField();

// Load and Display Favorites with Folders - REMOVED (now in FavoritesUI module)
// Condition Modals - REMOVED (now in ConditionModals module)
// Update tab visibility based on run mode
function updateTabVisibility() {
  const currentRun = State.getCurrentRun();
  console.log('updateTabVisibility called, currentRun:', currentRun);
  const strategiesBtn = document.getElementById('strategiesBtn');
  const portfolioBtn = document.getElementById('portfolioBtn');
  const tradesBtn = document.getElementById('tradesBtn');
  
  console.log('Found buttons:', { strategiesBtn, portfolioBtn, tradesBtn });
  
  if (!currentRun) {
    console.log('No current run, skipping visibility update');
    return;
  }
  
  if (currentRun.mode === 'portfolio') {
    // Portfolio mode: hide Strategies tab, show Portfolio tab
    console.log('Portfolio mode: hiding Strategies, showing Portfolio');
    if (strategiesBtn) strategiesBtn.style.display = 'none';
    if (portfolioBtn) portfolioBtn.style.display = '';
    if (tradesBtn) tradesBtn.style.display = '';
  } else {
    // Single mode: show Strategies tab, hide Portfolio tab
    console.log('Single mode: showing Strategies, hiding Portfolio');
    if (strategiesBtn) strategiesBtn.style.display = '';
    if (portfolioBtn) portfolioBtn.style.display = 'none';
    if (tradesBtn) tradesBtn.style.display = '';
  }
}
window.updateTabVisibility = updateTabVisibility;

// The duplicate old versions here have been removed to prevent conflicts

// Toggle favorites section (keep this event listener)
document.getElementById('toggleFavorites')?.addEventListener('click', () => {
  const btn = document.getElementById('toggleFavorites');
  const list = document.getElementById('favoritesList');
  
  btn.classList.toggle('collapsed');
  list.classList.toggle('collapsed');
});

// CRITICAL: Expose backtest runs UI functions to window
window.addNewStrategyRun = BacktestRunsUI.addNewStrategyRun;
window.addNewPortfolioRun = BacktestRunsUI.addNewPortfolioRun;
window.selectRun = BacktestRunsUI.selectRun;
window.duplicateRun = BacktestRunsUI.duplicateRun;
window.deleteRun = BacktestRunsUI.deleteRun;

// Update functions that modify run and re-render
window.updateRunName = (id, name) => {
  BacktestRuns.updateRun(id, { name });
  BacktestRunsUI.renderRunDetails();
};

window.updateRunTickers = (id, value) => {
  const tickers = value.split(',').map(t => t.trim()).filter(t => t);
  BacktestRuns.setRunTickers(id, tickers);
  
  BacktestRunsUI.renderRunDetails();
};

window.updateRunEntryMode = (id, mode) => {
  BacktestRuns.updateRun(id, { entryMode: mode });
  BacktestRunsUI.renderRunDetails();
};

window.updateRunExitMode = (id, mode) => {
  BacktestRuns.updateRun(id, { exitMode: mode });
  BacktestRunsUI.renderRunDetails();
};

window.toggleRunTakeProfit = (id, enabled) => {
  BacktestRuns.updateRun(id, { takeProfitEnabled: enabled });
  BacktestRunsUI.renderRunDetails();
};

window.toggleRunStopLoss = (id, enabled) => {
  BacktestRuns.updateRun(id, { stopLossEnabled: enabled });
  BacktestRunsUI.renderRunDetails();
};

window.updateRunTakeProfitType = (id, type) => {
  BacktestRuns.updateRun(id, { takeProfitType: type });
  BacktestRunsUI.renderRunDetails();
};

window.updateRunTakeProfitValue = (id, value) => {
  const key = BacktestRuns.getRun(id).takeProfitType === 'percent' ? 'takeProfitPercent' : 'takeProfitDollars';
  BacktestRuns.updateRun(id, { [key]: parseFloat(value) });
};

window.updateRunStopLossType = (id, type) => {
  BacktestRuns.updateRun(id, { stopLossType: type });
  BacktestRunsUI.renderRunDetails();
};

window.updateRunStopLossValue = (id, value) => {
  const key = BacktestRuns.getRun(id).stopLossType === 'percent' ? 'stopLossPercent' : 'stopLossDollars';
  BacktestRuns.updateRun(id, { [key]: parseFloat(value) });
};

// Condition management functions
// Condition Types - Simplified to 3 main types
const CONDITION_TYPES_FOR_RUNS = {
  price: { label: 'Price', description: 'Price interaction with a target value or moving average' },
  rsi: { label: 'RSI', description: 'RSI interaction with a target value or moving average' },
  ma: { label: 'Moving Average', description: 'Moving average crossover or interaction' }
};

const MA_TYPES_FOR_RUNS = ['Value', 'SMA', 'EMA', 'HMA', 'KAMA', 'BB_TOP', 'BB_MID', 'BB_BOTTOM', 'KC_TOP', 'KC_MID', 'KC_BOTTOM'];

window.addEntryConditionToRun = (runId) => {
  showRunConditionTypeModal(runId, 'entry');
};

window.addExitConditionToRun = (runId) => {
  showRunConditionTypeModal(runId, 'exit');
};

window.removeEntryConditionFromRun = (runId, index) => {
  BacktestRuns.removeEntryCondition(runId, index);
  BacktestRunsUI.renderRunDetails();
};

window.removeExitConditionFromRun = (runId, index) => {
  BacktestRuns.removeExitCondition(runId, index);
  BacktestRunsUI.renderRunDetails();
};

window.duplicateRunCondition = (runId, type, index) => {
  const run = BacktestRuns.getRun(runId);
  if (!run) return;
  
  // Get the condition to duplicate
  const conditions = type === 'entry' ? run.entryConditions : run.exitConditions;
  const condition = conditions[index];
  if (!condition) return;
  
  // Create a deep copy
  const duplicate = JSON.parse(JSON.stringify(condition));
  
  // Add the duplicate
  if (type === 'entry') {
    BacktestRuns.addEntryCondition(runId, duplicate);
  } else {
    BacktestRuns.addExitCondition(runId, duplicate);
  }
  
  BacktestRunsUI.renderRunDetails();
  console.log(`[RUNS] Duplicated ${type} condition #${index}`);
};

window.editCondition = (runId, conditionGroup, index) => {
  const run = BacktestRuns.getRun(runId);
  if (!run) return;
  
  const conditions = conditionGroup === 'entry' ? run.entryConditions : run.exitConditions;
  const condition = conditions[index];
  if (!condition) return;
  
  // Open type selector modal first, passing the existing condition for editing
  showRunConditionTypeModal(runId, conditionGroup, condition, index);
};

// Aliases for condition management (used by runs-ui.js)
window.deleteRunCondition = (runId, type, index) => {
  if (type === 'entry') {
    window.removeEntryConditionFromRun(runId, index);
  } else {
    window.removeExitConditionFromRun(runId, index);
  }
};

window.editRunCondition = (runId, type, index) => {
  window.editCondition(runId, type === 'entry' ? 'entry' : 'exit', index);
};

// Generate preview for a run
window.generateRunPreview = async (runId) => {
  await RunPreview.generate(runId);
};

// Load saved strategy as a condition for a run
window.loadSavedStrategyAsCondition = async (runId, favoriteId, conditionType) => {
  console.log('[RUNS] Loading saved strategy as condition:', {runId, favoriteId, conditionType});
  
  try {
    // Get the favorite data
    const result = await window.electronAPI.getFavorite(favoriteId);
    if (!result.success) {
      console.error('[RUNS] Failed to get favorite:', result.error);
      alert('Failed to load strategy: ' + result.error);
      return;
    }
    
    const favorite = result.data;
    console.log('[RUNS] Loaded favorite:', favorite);
    
    // Parse the data_json to get the conditions
    const data = JSON.parse(favorite.data_json || '{}');
    console.log('[RUNS] Parsed favorite data:', data);
    
    // Extract conditions from the saved strategy
    // The old system saved conditions directly in data_json
    const entryConditions = data.entry_conditions || data.entryConditions || [];
    const exitConditions = data.exit_conditions || data.exitConditions || [];
    
    console.log('[RUNS] Found conditions:', {
      entry: entryConditions.length,
      exit: exitConditions.length
    });
    
    if (entryConditions.length === 0 && exitConditions.length === 0) {
      console.warn('[RUNS] No conditions found in saved strategy');
      alert('This saved strategy has no conditions to load.');
      return;
    }
    
    // Add conditions based on type requested
    if (conditionType === 'entry' && entryConditions.length > 0) {
      entryConditions.forEach(condition => {
        BacktestRuns.addEntryCondition(runId, condition);
      });
      console.log(`[RUNS] Added ${entryConditions.length} entry conditions`);
    } else if (conditionType === 'exit' && exitConditions.length > 0) {
      exitConditions.forEach(condition => {
        BacktestRuns.addExitCondition(runId, condition);
      });
      console.log(`[RUNS] Added ${exitConditions.length} exit conditions`);
    } else {
      alert(`No ${conditionType} conditions found in this strategy.`);
      return;
    }
    
    // Refresh the UI
    BacktestRunsUI.renderRunDetails();
  } catch (error) {
    console.error('[RUNS] Error loading saved strategy:', error);
    alert('Error loading saved strategy: ' + error.message);
  }
};

// Portfolio management functions
window.addStrategyToPortfolio = (runId) => {
  // This will open a modal to select a saved strategy
  console.log(`[PORTFOLIO] Add strategy to portfolio run ${runId}`);
  // TODO: Implement strategy selection modal
};

window.removeStrategyFromPortfolio = (runId, index) => {
  BacktestRuns.removePortfolioStrategy(runId, index);
  BacktestRunsUI.renderRunDetails();
};

window.updatePortfolioWeight = (runId, index, weight) => {
  BacktestRuns.updatePortfolioStrategyWeight(runId, index, parseFloat(weight));
  BacktestRunsUI.renderRunDetails();
};

window.normalizePortfolioWeights = (runId) => {
  BacktestRuns.normalizePortfolioWeights(runId);
  BacktestRunsUI.renderRunDetails();
};

// Run backtest functions
window.runStrategyBacktest = async (runId) => {
  console.log(`[BACKTEST] Running strategy backtest for run ${runId}`);
  // TODO: Integrate with existing backtest execution
};

// Click outside modal to close
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// ============================================================================
// CHART TAB KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', (e) => {
  // Ctrl+T: Create new chart tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createChartTab();
    return;
  }
  
  // Ctrl+W: Close current chart tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    const activeTab = ChartTabSystem.getActiveTab();
    if (activeTab) {
      closeChartTab(activeTab.id);
    }
    return;
  }
  
  // Ctrl+Tab: Next tab
  if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const chartTabs = ChartTabSystem.getAllTabs();
    const activeChartTabId = ChartTabSystem.getActiveTab()?.id;
    const currentIndex = chartTabs.findIndex(t => t.id === activeChartTabId);
    if (currentIndex !== -1 && chartTabs.length > 1) {
      const nextIndex = (currentIndex + 1) % chartTabs.length;
      activateChartTab(chartTabs[nextIndex].id);
    }
    return;
  }
  
  // Ctrl+Shift+Tab: Previous tab
  if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    const chartTabs = ChartTabSystem.getAllTabs();
    const activeChartTabId = ChartTabSystem.getActiveTab()?.id;
    const currentIndex = chartTabs.findIndex(t => t.id === activeChartTabId);
    if (currentIndex !== -1 && chartTabs.length > 1) {
      const prevIndex = (currentIndex - 1 + chartTabs.length) % chartTabs.length;
      activateChartTab(chartTabs[prevIndex].id);
    }
    return;
  }
});

// MUST be at end of file after all functions are defined
console.log('[INIT] Exposing functions to window scope...');
// Note: All onclick handler functions are now exposed to window immediately after their definitions
// This ensures they're available when HTML with onclick handlers is dynamically generated
// No need for duplicate assignments here - all functions are already exposed above

// Initialize DOM elements and event listeners after DOM is ready
function initializeDOMElements() {
  console.log('[INIT] Initializing DOM elements and event listeners...');
  
  // Get DOM elements
  selectDbBtn = document.getElementById('selectDbBtn');
  dbPathEl = document.getElementById('dbPath');
  runsList = document.getElementById('runsList');
  statusText = document.getElementById('statusText');
  tabs = document.querySelectorAll('.tab');
  tabContents = document.querySelectorAll('.tab-content');
  
  console.log('[INIT] Found tabs:', tabs.length);
  console.log('[INIT] Found tab contents:', tabContents.length);
  
  // Filters
  runSearch = document.getElementById('runSearch');
  modeFilter = document.getElementById('modeFilter');
  tickerFilter = document.getElementById('tickerFilter');
  tradeSearch = document.getElementById('tradeSearch');
  sideFilter = document.getElementById('sideFilter');
  // compareBtn removed - Compare feature no longer needed
  
  // Backtest elements
  backtestDbPathInput = document.getElementById('backtestDbPath');
  selectBacktestDbBtn = document.getElementById('selectBacktestDbBtn');
  clearBacktestDbBtn = document.getElementById('clearBacktestDbBtn');
  
  // Main navigation
  mainTabs = document.querySelectorAll('.main-tab');
  mainPages = document.querySelectorAll('.main-page');
  
  // Initialize DatabaseUI module
  DatabaseUI.initializeDatabaseUI({
    dbPathEl,
    runsList,
    runSearch,
    modeFilter
    // compareBtn removed - no longer needed
  });
  
  // Attach event listeners
  selectDbBtn?.addEventListener('click', DatabaseUI.selectDatabase);
  
  // Backtest DB selector listeners
  if (selectBacktestDbBtn) {
    selectBacktestDbBtn.addEventListener('click', async () => {
      const result = await window.electronAPI.selectDb();
      if (result.success) {
        backtestDbPath = result.path;
        backtestDbPathInput.value = result.path;
        console.log('[BACKTEST] Database path selected:', backtestDbPath);
      }
    });
  }
  
  if (clearBacktestDbBtn) {
    clearBacktestDbBtn.addEventListener('click', () => {
      backtestDbPath = null;
      backtestDbPathInput.value = '';
      console.log('[BACKTEST] Using default database path');
    });
  }
  
  // Initialize backtest runs UI
  const runList = document.getElementById('runList');
  const runDetails = document.getElementById('runDetails');
  if (runList && runDetails) {
    BacktestRunsUI.initializeRunsUI({ runList, runDetails });
    console.log('[INIT] Backtest runs UI initialized');
  } else {
    console.warn('[INIT] Backtest runs UI elements not found (runList:', runList, 'runDetails:', runDetails, ')');
  }
  
  // Initialize tab management (main navigation and results sub-tabs)
  TabsUI.initializeTabManagement({
    mainTabs,
    mainPages,
    tabs,
    tabContents
  });
  
  console.log('[INIT] DOM initialization complete');
  
  // Initialize extracted modules
  console.log('[INIT] Initializing PolygonTreemap...');
  PolygonTreemap.initialize();
  
  console.log('[INIT] Initializing Financials Page...');
  FinancialsPage.initialize();
  
  console.log('[INIT] Initializing Ratios Page...');
  RatiosPage.initialize();
  
  console.log('[INIT] Initializing RSIDashboard...');
  RSIDashboard.initialize();
  
  console.log('[INIT] Initializing Chart Tabs...');
  initializeChartTabs();
  
  // Load favorites on startup (use setTimeout to ensure everything is ready)
  setTimeout(() => {
    console.log('[INIT] Loading favorites...');
    loadFavorites().catch(err => {
      console.error('[INIT] Failed to load favorites on startup:', err);
    });
    
    // Load watchlists for financials and ratios pages
    console.log('[INIT] Loading watchlist selectors...');
    FinancialsPage.populateWatchlistSelector();
    RatiosPage.populateWatchlistSelector();
  }, 100);
}

// Listen for watchlist updates (Electron only)
if (window.electronAPI && window.electronAPI.onWatchlistsUpdated) {
  window.electronAPI.onWatchlistsUpdated(() => {
    console.log('[RENDERER] Watchlists updated, reloading chart ticker lists');
    // Reload watchlists for all chart tabs
    if (typeof window.loadWatchlistsForCharts === 'function') {
      window.loadWatchlistsForCharts();
    }
  });
}

// Call init when DOM is ready
console.log('[RENDERER] Setting up DOM ready listener, readyState:', document.readyState);
if (document.readyState === 'loading') {
  console.log('[RENDERER] DOM still loading, adding DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', initializeDOMElements);
} else {
  // DOM is already loaded
  console.log('[RENDERER] DOM already loaded, calling initializeDOMElements immediately');
  initializeDOMElements();
}



