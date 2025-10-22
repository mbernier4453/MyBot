/**
 * API Wrapper Module
 * Centralized wrapper for all electronAPI calls
 * Makes it easier to mock/test and provides a single source of truth
 */

// ========================================
// DATABASE OPERATIONS
// ========================================

/**
 * Select a database file
 * @returns {Promise<{success: boolean, path?: string, message?: string}>}
 */
export async function selectDb() {
  return await window.electronAPI.selectDb();
}

/**
 * Get all runs from the database
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getRuns() {
  return await window.electronAPI.getRuns();
}

/**
 * Get strategies for a specific run
 * @param {string} runId - Run ID
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getStrategies(runId) {
  return await window.electronAPI.getStrategies(runId);
}

/**
 * Get buy & hold metrics for a run
 * @param {string} runId - Run ID
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function getBuyHoldMetrics(runId) {
  return await window.electronAPI.getBuyHoldMetrics(runId);
}

/**
 * Get portfolio data for a run
 * @param {string} runId - Run ID
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function getPortfolio(runId) {
  return await window.electronAPI.getPortfolio(runId);
}

/**
 * Get trades for a specific run and ticker
 * @param {string} runId - Run ID
 * @param {string} ticker - Ticker symbol
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getTrades(runId, ticker) {
  return await window.electronAPI.getTrades(runId, ticker);
}

/**
 * Get run summary data
 * @param {string} runId - Run ID
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function getRunSummary(runId) {
  return await window.electronAPI.getRunSummary(runId);
}

/**
 * Get comparison data for multiple runs
 * @param {Array<string>} runIds - Array of run IDs
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function getComparisonData(runIds) {
  return await window.electronAPI.getComparisonData(runIds);
}

/**
 * Get detailed strategy data
 * @param {string} strategyId - Strategy ID
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function getStrategyDetails(strategyId) {
  return await window.electronAPI.getStrategyDetails(strategyId);
}

/**
 * Delete a run from the database
 * @param {string} runId - Run ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function deleteRun(runId) {
  return await window.electronAPI.deleteRun(runId);
}

// ========================================
// BACKTESTING OPERATIONS
// ========================================

/**
 * Run a dynamic backtest
 * @param {Object} config - Backtest configuration
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function runDynamicBacktest(config) {
  return await window.electronAPI.runDynamicBacktest(config);
}

/**
 * Calculate CAPM metrics
 * @param {Array} strategyEquity - Strategy equity curve
 * @param {Array} benchmarkEquity - Benchmark equity curve
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function calculateCapm(strategyEquity, benchmarkEquity) {
  return await window.electronAPI.calculateCapm(strategyEquity, benchmarkEquity);
}

/**
 * Load preview data for strategy visualization
 * @param {Object} params - Preview parameters
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function loadPreviewData(params) {
  return await window.electronAPI.loadPreviewData(params);
}

/**
 * Save portfolio as a strategy
 * @param {string} runId - Run ID
 * @param {string} name - Strategy name
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function savePortfolioAsStrategy(runId, name) {
  return await window.electronAPI.savePortfolioAsStrategy(runId, name);
}

// ========================================
// FAVORITES OPERATIONS
// ========================================

/**
 * Get all favorites
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getFavorites() {
  return await window.electronAPI.getFavorites();
}

/**
 * Add an item to favorites
 * @param {Object} item - Favorite item
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function addFavorite(item) {
  return await window.electronAPI.addFavorite(item);
}

/**
 * Remove an item from favorites
 * @param {string} id - Favorite ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function removeFavorite(id) {
  return await window.electronAPI.removeFavorite(id);
}

/**
 * Get all folders
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getFolders() {
  return await window.electronAPI.getFolders();
}

/**
 * Create a new folder
 * @param {string} name - Folder name
 * @param {string} color - Folder color
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function createFolder(name, color) {
  return await window.electronAPI.createFolder(name, color);
}

/**
 * Delete a folder
 * @param {string} id - Folder ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function deleteFolder(id) {
  return await window.electronAPI.deleteFolder(id);
}

/**
 * Move a favorite to a folder
 * @param {string} favoriteId - Favorite ID
 * @param {string} folderId - Folder ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function moveToFolder(favoriteId, folderId) {
  return await window.electronAPI.moveToFolder(favoriteId, folderId);
}

// ========================================
// WATCHLIST OPERATIONS
// ========================================

/**
 * Get all watchlists
 * @returns {Promise<{success: boolean, data?: Array}>}
 */
export async function getWatchlists() {
  return await window.electronAPI.getWatchlists();
}

/**
 * Create a new watchlist
 * @param {string} name - Watchlist name
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {string} notes - Optional notes
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function createWatchlist(name, tickers, notes) {
  return await window.electronAPI.createWatchlist(name, tickers, notes);
}

/**
 * Delete a watchlist
 * @param {string} id - Watchlist ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function deleteWatchlist(id) {
  return await window.electronAPI.deleteWatchlist(id);
}

// ========================================
// POLYGON API OPERATIONS
// ========================================

/**
 * Connect to Polygon WebSocket
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function polygonConnect() {
  return await window.electronAPI.polygonConnect();
}

/**
 * Get historical bars from Polygon
 * @param {Object} params - Parameters for historical data request
 * @returns {Promise<{success: boolean, data?: Object}>}
 */
export async function polygonGetHistoricalBars(params) {
  return await window.electronAPI.polygonGetHistoricalBars(params);
}

// ========================================
// EVENT LISTENERS
// ========================================

/**
 * Listen for Polygon updates
 * @param {Function} callback - Callback function
 */
export function onPolygonUpdate(callback) {
  window.electronAPI.onPolygonUpdate(callback);
}

/**
 * Listen for Polygon initial load complete
 * @param {Function} callback - Callback function
 */
export function onPolygonInitialLoad(callback) {
  window.electronAPI.onPolygonInitialLoad(callback);
}

/**
 * Listen for Polygon connection status
 * @param {Function} callback - Callback function
 */
export function onPolygonStatus(callback) {
  window.electronAPI.onPolygonStatus(callback);
}

/**
 * Listen for Polygon errors
 * @param {Function} callback - Callback function
 */
export function onPolygonError(callback) {
  window.electronAPI.onPolygonError(callback);
}
