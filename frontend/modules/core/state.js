/**
 * Global Application State
 * Centralized state management for the entire application
 */

// ========================================
// RESULTS PAGE STATE
// ========================================
export let currentDb = null;
export let currentRun = null;
export let allRuns = [];
export let selectedRuns = new Set();
export let currentStrategies = [];
export let currentTrades = [];
export let buyHoldMetrics = {};
export let currentSortField = 'total_return';
export let currentSortDesc = true;

// ========================================
// BACKTEST STATE
// ========================================
export let backtestDbPath = null;
export let backtestConfigs = JSON.parse(localStorage.getItem('backtestConfigs') || '[]');
export let configFolders = JSON.parse(localStorage.getItem('configFolders') || '[{"id": 0, "name": "Uncategorized"}]');

// ========================================
// POLYGON / TREEMAP STATE
// ========================================
export let treemapData = new Map();
export let lastUpdateTime = null;

// ========================================
// WATCHLIST STATE
// ========================================
export let watchlists = [];
export let currentWatchlist = null;
export let watchlistStockData = new Map();
export let editingWatchlistId = null;

// ========================================
// CHARTING STATE
// ========================================
export let chartTabs = [];
export let activeChartTabId = null;
export let nextChartTabId = 1;
export let chartNormalized = false;
export let currentChartData = null;
export let currentChartTicker = null;
export let liveChartData = new Map();
export let liveUpdateEnabled = true;
export let lastChartUpdate = Date.now();

// Expose currentChartTicker to window immediately (needed by preload script)
Object.defineProperty(window, 'currentChartTicker', {
  get: () => currentChartTicker,
  set: (value) => { currentChartTicker = value; }
});

// ========================================
// STATE SETTERS (for other modules to update state)
// ========================================

export function setCurrentDb(db) {
  currentDb = db;
}

export function setCurrentRun(run) {
  currentRun = run;
}

export function setAllRuns(runs) {
  allRuns = runs;
}

export function setSelectedRuns(runs) {
  selectedRuns = runs;
}

export function setCurrentStrategies(strategies) {
  currentStrategies = strategies;
}

export function setCurrentTrades(trades) {
  currentTrades = trades;
}

export function setBuyHoldMetrics(metrics) {
  buyHoldMetrics = metrics;
}

export function setCurrentSortField(field) {
  currentSortField = field;
}

export function setCurrentSortDesc(desc) {
  currentSortDesc = desc;
}

export function setBacktestDbPath(path) {
  backtestDbPath = path;
}

// ========================================
// STATE GETTERS (for other modules to read state)
// ========================================

export function getCurrentDb() {
  return currentDb;
}

export function getCurrentRun() {
  return currentRun;
}

export function getAllRuns() {
  return allRuns;
}

export function getSelectedRuns() {
  return selectedRuns;
}

export function getCurrentStrategies() {
  return currentStrategies;
}

export function getCurrentTrades() {
  return currentTrades;
}

export function getBuyHoldMetrics() {
  return buyHoldMetrics;
}

export function getCurrentSortField() {
  return currentSortField;
}

export function getCurrentSortDesc() {
  return currentSortDesc;
}

export function getBacktestDbPath() {
  return backtestDbPath;
}

export function getTreemapData() {
  return treemapData;
}

export function getLastUpdateTime() {
  return lastUpdateTime;
}

export function getWatchlists() {
  return watchlists;
}

export function getCurrentWatchlist() {
  return currentWatchlist;
}

export function getWatchlistStockData() {
  return watchlistStockData;
}

export function getEditingWatchlistId() {
  return editingWatchlistId;
}

export function getChartTabs() {
  return chartTabs;
}

export function getActiveChartTabId() {
  return activeChartTabId;
}

export function getNextChartTabId() {
  return nextChartTabId;
}

export function getChartNormalized() {
  return chartNormalized;
}

export function getCurrentChartData() {
  return currentChartData;
}

export function getCurrentChartTicker() {
  return currentChartTicker;
}

export function getLiveChartData() {
  return liveChartData;
}

export function getLiveUpdateEnabled() {
  return liveUpdateEnabled;
}

export function getLastChartUpdate() {
  return lastChartUpdate;
}

export function getBacktestConfigs() {
  return backtestConfigs;
}

export function getConfigFolders() {
  return configFolders;
}

export function setTreemapData(data) {
  treemapData = data;
}

export function setLastUpdateTime(time) {
  lastUpdateTime = time;
}

export function setWatchlists(lists) {
  watchlists = lists;
}

export function setCurrentWatchlist(watchlist) {
  currentWatchlist = watchlist;
}

export function setWatchlistStockData(data) {
  watchlistStockData = data;
}

export function setEditingWatchlistId(id) {
  editingWatchlistId = id;
}

export function setChartTabs(tabs) {
  chartTabs = tabs;
}

export function setActiveChartTabId(id) {
  activeChartTabId = id;
}

export function setNextChartTabId(id) {
  nextChartTabId = id;
}

export function setChartNormalized(normalized) {
  chartNormalized = normalized;
}

export function setCurrentChartData(data) {
  currentChartData = data;
}

export function setCurrentChartTicker(ticker) {
  currentChartTicker = ticker;
}

export function setLiveChartData(data) {
  liveChartData = data;
}

export function setLiveUpdateEnabled(enabled) {
  liveUpdateEnabled = enabled;
}

export function setLastChartUpdate(timestamp) {
  lastChartUpdate = timestamp;
}

// ========================================
// STATE PERSISTENCE (localStorage)
// ========================================

export function saveBacktestConfigs() {
  localStorage.setItem('backtestConfigs', JSON.stringify(backtestConfigs));
}

export function saveConfigFolders() {
  localStorage.setItem('configFolders', JSON.stringify(configFolders));
}

export function saveWatchlists() {
  localStorage.setItem('watchlists', JSON.stringify(watchlists));
}

// ========================================
// STATE INITIALIZATION
// ========================================

export function initializeState() {
  console.log('[STATE] Initializing application state...');
  
  // Load persisted state from localStorage
  backtestConfigs = JSON.parse(localStorage.getItem('backtestConfigs') || '[]');
  configFolders = JSON.parse(localStorage.getItem('configFolders') || '[{"id": 0, "name": "Uncategorized"}]');
  watchlists = JSON.parse(localStorage.getItem('watchlists') || '[]');
  
  console.log('[STATE] State initialized successfully');
}
