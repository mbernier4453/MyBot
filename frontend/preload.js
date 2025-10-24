const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDb: () => ipcRenderer.invoke('select-db'),
  getRuns: () => ipcRenderer.invoke('get-runs'),
  getStrategies: (runId) => ipcRenderer.invoke('get-strategies', runId),
  getBuyHoldMetrics: (runId) => ipcRenderer.invoke('get-buyhold-metrics', runId),
  getPortfolio: (runId) => ipcRenderer.invoke('get-portfolio', runId),
  getTrades: (runId, ticker) => ipcRenderer.invoke('get-trades', runId, ticker),
  getRunSummary: (runId) => ipcRenderer.invoke('get-run-summary', runId),
  getComparisonData: (runIds) => ipcRenderer.invoke('get-comparison-data', runIds),
  getStrategyDetails: (strategyId) => ipcRenderer.invoke('get-strategy-details', strategyId),
  calculateCapm: (strategyEquity, benchmarkEquity) => ipcRenderer.invoke('calculate-capm', strategyEquity, benchmarkEquity),
  deleteRun: (runId) => ipcRenderer.invoke('delete-run', runId),
  
  // Favorites
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  addFavorite: (item) => ipcRenderer.invoke('add-favorite', item),
  removeFavorite: (id) => ipcRenderer.invoke('remove-favorite', id),
  savePortfolioAsStrategy: (runId, name) => ipcRenderer.invoke('save-portfolio-as-strategy', runId, name),
  
  // Folders
  getFolders: () => ipcRenderer.invoke('get-folders'),
  createFolder: (name, color) => ipcRenderer.invoke('create-folder', name, color),
  deleteFolder: (id) => ipcRenderer.invoke('delete-folder', id),
  moveToFolder: (favoriteId, folderId) => ipcRenderer.invoke('move-to-folder', favoriteId, folderId),
  
  // Watchlists
  getWatchlists: () => ipcRenderer.invoke('get-watchlists'),
  createWatchlist: (name, tickers, notes) => ipcRenderer.invoke('create-watchlist', name, tickers, notes),
  deleteWatchlist: (id) => ipcRenderer.invoke('delete-watchlist', id),
  onWatchlistsUpdated: (callback) => ipcRenderer.on('watchlists-updated', () => callback()),
  
  // Polygon API
  polygonConnect: () => ipcRenderer.invoke('polygon-connect'),
  polygonDisconnect: () => ipcRenderer.invoke('polygon-disconnect'),
  polygonGetAllData: () => ipcRenderer.invoke('polygon-get-all-data'),
  polygonFetchTickers: (tickers) => ipcRenderer.invoke('polygon-fetch-tickers', tickers),
  polygonGetTickerDetails: (ticker) => ipcRenderer.invoke('polygon-get-ticker-details', ticker),
  polygonGetSP500Data: () => ipcRenderer.invoke('polygon-get-sp500-data'),
  polygonSubscribeTickers: (tickers) => ipcRenderer.invoke('polygon-subscribe-tickers', tickers),
  polygonUnsubscribeTickers: (tickers) => ipcRenderer.invoke('polygon-unsubscribe-tickers', tickers),
  polygonGetHistoricalBars: (params) => ipcRenderer.invoke('polygon-get-historical-bars', params),
  polygonGetBalanceSheet: (ticker, options) => ipcRenderer.invoke('polygon-get-balance-sheet', ticker, options),
  polygonGetCashFlow: (ticker, options) => ipcRenderer.invoke('polygon-get-cash-flow', ticker, options),
  polygonGetIncomeStatement: (ticker, options) => ipcRenderer.invoke('polygon-get-income-statement', ticker, options),
  polygonGetRatios: (ticker, options) => ipcRenderer.invoke('polygon-get-ratios', ticker, options),
  onPolygonUpdate: (callback) => ipcRenderer.on('polygon-update', (event, data) => callback(data)),
  onPolygonStatus: (callback) => ipcRenderer.on('polygon-status', (event, status) => callback(status)),
  onPolygonError: (callback) => ipcRenderer.on('polygon-error', (event, error) => callback(error)),
  onPolygonInitialLoad: (callback) => ipcRenderer.on('polygon-initial-load-complete', (event, data) => callback(data)),
  
  // Backtester
  backtestRun: (config) => ipcRenderer.invoke('backtest-run', config),
  onBacktestProgress: (callback) => ipcRenderer.on('backtest-progress', (event, data) => callback(data)),
  onBacktestComplete: (callback) => ipcRenderer.on('backtest-complete', (event, data) => callback(data)),
  
  // Dynamic Backtester (new system)
  runDynamicBacktest: (config) => ipcRenderer.invoke('run-dynamic-backtest', config),
  
  // Strategy Preview
  loadPreviewData: (params) => ipcRenderer.invoke('load-preview-data', params),
  
  // Debug Logging
  debugGetLogs: () => ipcRenderer.invoke('debug-get-logs'),
  debugGetMainLogs: () => ipcRenderer.invoke('debug-get-main-logs'),
  debugGetRendererLogs: () => ipcRenderer.invoke('debug-get-renderer-logs'),
  debugSendLog: (level, message) => ipcRenderer.send('renderer-log', { level, message })
});
