const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDb: () => ipcRenderer.invoke('select-db'),
  getRuns: () => ipcRenderer.invoke('get-runs'),
  getStrategies: (runId) => ipcRenderer.invoke('get-strategies', runId),
  getBuyHoldMetrics: (runId) => ipcRenderer.invoke('get-buyhold-metrics', runId),
  getPortfolio: (runId) => ipcRenderer.invoke('get-portfolio', runId),
  getTrades: (runId, ticker) => ipcRenderer.invoke('get-trades', runId, ticker),
  getRunSummary: (runId) => ipcRenderer.invoke('get-run-summary', runId),
  getComparisonData: (runIds) => ipcRenderer.invoke('get-comparison-data', runIds)
});
