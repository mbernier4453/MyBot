const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const WebSocket = require('ws');
const { SP500_BY_SECTOR, MARKET_CAPS_BY_SECTOR } = require('./sp500_data.js');
require('dotenv').config();

let mainWindow;
let db = null;
let SQL = null;
let dbPath = null;
let polygonWs = null;
let stockData = new Map(); // Store latest data for each ticker
let isConnected = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  SQL = await initSqlJs();
  createWindow();
  
  // Connect to Polygon after window is created
  setTimeout(() => {
    connectPolygon();
  }, 1000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (db) {
    db.close();
  }
  if (polygonWs) {
    polygonWs.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

// Flatten all sectors into single ticker list
const SP500_TICKERS = Object.values(SP500_BY_SECTOR).flat();

// Flatten market caps from all sectors
const MARKET_CAPS = Object.values(MARKET_CAPS_BY_SECTOR).reduce((acc, sectorCaps) => {
  return { ...acc, ...sectorCaps };
}, {});

// Fetch initial snapshot data from Polygon REST API
async function fetchInitialData() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return;

  console.log('[POLYGON] Fetching initial snapshot data...');
  
  try {
    const https = require('https');
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${apiKey}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.status === 'OK' && response.tickers) {
            let count = 0;
            response.tickers.forEach(snapshot => {
              // Only process S&P 500 stocks
              if (SP500_TICKERS.includes(snapshot.ticker)) {
                const todaysChange = snapshot.todaysChangePerc || 0;
                const prevClose = snapshot.prevDay?.c || snapshot.day?.c || 100;
                const currentPrice = snapshot.day?.c || prevClose;
                
                const stockInfo = {
                  ticker: snapshot.ticker,
                  open: snapshot.day?.o || prevClose,
                  high: snapshot.day?.h || currentPrice,
                  low: snapshot.day?.l || currentPrice,
                  close: currentPrice,
                  volume: snapshot.day?.v || 0,
                  marketCap: (MARKET_CAPS[snapshot.ticker] || 100) * 1e9, // Convert billions to actual value
                  timestamp: Date.now(),
                  change: currentPrice - prevClose,
                  changePercent: todaysChange
                };
                
                stockData.set(snapshot.ticker, stockInfo);
                count++;
                
                // Send to renderer
                if (mainWindow) {
                  mainWindow.webContents.send('polygon-update', stockInfo);
                }
              }
            });
            
            console.log(`[POLYGON] Loaded ${count} stocks from snapshot`);
            if (mainWindow) {
              mainWindow.webContents.send('polygon-initial-load-complete', { count });
            }
          }
        } catch (error) {
          console.error('[POLYGON] Error parsing snapshot data:', error);
        }
      });
    }).on('error', (error) => {
      console.error('[POLYGON] Error fetching snapshot:', error);
    });
  } catch (error) {
    console.error('[POLYGON] Error in fetchInitialData:', error);
  }
}

// Polygon Websocket Connection
function connectPolygon() {
  const apiKey = process.env.POLYGON_API_KEY;
  
  if (!apiKey) {
    console.error('[POLYGON] API key not found in environment variables');
    if (mainWindow) {
      mainWindow.webContents.send('polygon-error', 'API key not configured');
    }
    return;
  }

  console.log('[POLYGON] Connecting to websocket...');
  polygonWs = new WebSocket('wss://socket.polygon.io/stocks');

  polygonWs.on('open', () => {
    console.log('[POLYGON] Connected');
    isConnected = true;
    
    // Authenticate
    polygonWs.send(JSON.stringify({ action: 'auth', params: apiKey }));
    
    // Subscribe to 1-minute aggregates for S&P 500 stocks
    const subscriptions = SP500_TICKERS.map(ticker => `AM.${ticker}`);
    polygonWs.send(JSON.stringify({ 
      action: 'subscribe', 
      params: subscriptions.join(',')
    }));
    
    if (mainWindow) {
      mainWindow.webContents.send('polygon-status', { connected: true });
    }
    
    // Fetch initial snapshot data
    setTimeout(() => {
      fetchInitialData();
    }, 2000); // Wait 2 seconds for subscriptions to complete
  });

  polygonWs.on('message', (data) => {
    try {
      const messages = JSON.parse(data);
      
      if (!Array.isArray(messages)) return;
      
      messages.forEach(msg => {
        // Handle status messages
        if (msg.ev === 'status') {
          console.log('[POLYGON] Status:', msg.message);
          return;
        }
        
        // Handle aggregate bars (AM = Aggregate Minute)
        if (msg.ev === 'AM') {
          const ticker = msg.sym;
          const data = {
            ticker: ticker,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            close: msg.c,
            volume: msg.v,
            marketCap: (MARKET_CAPS[ticker] || 100) * 1e9,
            timestamp: msg.s,
            change: null,
            changePercent: null
          };
          
          // Calculate change if we have previous data
          if (stockData.has(ticker)) {
            const prevData = stockData.get(ticker);
            data.change = data.close - prevData.open;
            data.changePercent = ((data.close - prevData.open) / prevData.open) * 100;
          }
          
          stockData.set(ticker, data);
          
          // Send update to renderer
          if (mainWindow) {
            mainWindow.webContents.send('polygon-update', data);
          }
        }
      });
    } catch (error) {
      console.error('[POLYGON] Error parsing message:', error);
    }
  });

  polygonWs.on('error', (error) => {
    console.error('[POLYGON] WebSocket error:', error);
    isConnected = false;
    if (mainWindow) {
      mainWindow.webContents.send('polygon-error', error.message);
    }
  });

  polygonWs.on('close', (code, reason) => {
    console.log('[POLYGON] Disconnected:', code, reason.toString());
    isConnected = false;
    if (mainWindow) {
      mainWindow.webContents.send('polygon-status', { connected: false });
    }
    
    // Don't auto-reconnect if we hit connection limit (code 1008)
    // User can manually reconnect via the UI button
    if (code !== 1008) {
      console.log('[POLYGON] Will attempt to reconnect in 10 seconds...');
      setTimeout(() => {
        if (mainWindow && !isConnected) {
          console.log('[POLYGON] Attempting to reconnect...');
          connectPolygon();
        }
      }, 10000);
    } else {
      console.log('[POLYGON] Connection limit reached. Use reconnect button to retry.');
    }
  });
}

// IPC Handlers for Polygon
ipcMain.handle('polygon-connect', () => {
  if (!isConnected && !polygonWs) {
    connectPolygon();
  }
  return { success: true, connected: isConnected };
});

ipcMain.handle('polygon-disconnect', () => {
  if (polygonWs) {
    polygonWs.close();
    polygonWs = null;
    isConnected = false;
  }
  return { success: true };
});

ipcMain.handle('polygon-get-all-data', () => {
  const data = Array.from(stockData.values());
  return { success: true, data };
});

// IPC Handlers
ipcMain.handle('select-db', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Database Files', extensions: ['db', 'sqlite', 'duckdb'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      if (db) db.close();
      const buffer = fs.readFileSync(result.filePaths[0]);
      db = new SQL.Database(buffer);
      dbPath = result.filePaths[0]; // Store the path for saving
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No file selected' };
});

// Helper function to save database to disk
function saveDatabase() {
  if (!db || !dbPath) {
    console.error('[BACKEND] Cannot save: no database or path');
    return false;
  }
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('[BACKEND] Database saved to:', dbPath);
    return true;
  } catch (error) {
    console.error('[BACKEND] Error saving database:', error);
    return false;
  }
}

ipcMain.handle('get-runs', async () => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare(`
      SELECT 
        run_id,
        notes,
        mode,
        started_at,
        completed_at,
        benchmark_equity_json
      FROM runs
      ORDER BY started_at DESC
    `);
    
    const runs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      
      // Parse benchmark equity if available
      if (row.benchmark_equity_json) {
        try {
          row.benchmark_equity = JSON.parse(row.benchmark_equity_json);
          delete row.benchmark_equity_json;
        } catch (e) {
          console.error('[BACKEND] Error parsing benchmark_equity_json:', e);
          row.benchmark_equity = null;
        }
      } else {
        row.benchmark_equity = null;
      }
      
      // Count results based on mode
      let resultCount = 0;
      if (row.mode === 'portfolio') {
        const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM portfolio WHERE run_id = ?');
        countStmt.bind([row.run_id]);
        if (countStmt.step()) {
          resultCount = countStmt.getAsObject().cnt;
        }
        countStmt.free();
      } else {
        const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM strategies WHERE run_id = ?');
        countStmt.bind([row.run_id]);
        if (countStmt.step()) {
          resultCount = countStmt.getAsObject().cnt;
        }
        countStmt.free();
      }
      
      row.result_count = resultCount;
      runs.push(row);
    }
    stmt.free();
    
    return { success: true, data: runs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-strategies', async (event, runId) => {
  console.log('[BACKEND] get-strategies called for runId:', runId);
  if (!db) {
    console.error('[BACKEND] No database connected');
    return { success: false, error: 'No database connected' };
  }
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id,
        run_id,
        ticker,
        total_return,
        cagr,
        sharpe,
        sortino,
        vol,
        maxdd,
        win_rate,
        net_win_rate,
        avg_trade_pnl,
        trades_total,
        params_json,
        metrics_json,
        created_at
      FROM strategies
      WHERE run_id = ?
      ORDER BY total_return DESC
    `);
    stmt.bind([runId]);
    
    const strategies = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      
      // Handle JSON parsing with NaN values
      try {
        // Replace NaN with null before parsing
        const paramsJson = (row.params_json || '{}').replace(/:\s*NaN/g, ': null');
        const metricsJson = (row.metrics_json || '{}').replace(/:\s*NaN/g, ': null');
        
        row.params = JSON.parse(paramsJson);
        row.metrics = JSON.parse(metricsJson);
      } catch (parseError) {
        console.warn('[BACKEND] JSON parse error for strategy:', parseError);
        row.params = {};
        row.metrics = {};
      }
      
      // Ensure numeric fields are valid (convert NaN to null for display)
      ['total_return', 'cagr', 'sharpe', 'sortino', 'vol', 'maxdd', 'win_rate', 'net_win_rate', 'avg_trade_pnl'].forEach(field => {
        if (row[field] !== row[field]) { // Check for NaN
          row[field] = null;
        }
      });
      
      strategies.push(row);
    }
    stmt.free();
    
    console.log(`[BACKEND] Loaded ${strategies.length} strategies for runId:`, runId);
    return { success: true, data: strategies };
  } catch (error) {
    console.error('[BACKEND] Error loading strategies:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-buyhold-metrics', async (event, runId) => {
  console.log('[BACKEND] get-buyhold-metrics called for runId:', runId);
  if (!db) {
    return { success: false, error: 'No database connected' };
  }
  
  try {
    // Get buy & hold metrics from metrics_json for each ticker
    const stmt = db.prepare(`
      SELECT 
        ticker,
        metrics_json
      FROM strategies
      WHERE run_id = ?
      GROUP BY ticker
    `);
    stmt.bind([runId]);
    
    const buyHoldMetrics = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        const metricsJson = (row.metrics_json || '{}').replace(/:\s*NaN/g, ': null');
        const metrics = JSON.parse(metricsJson);
        
        // Extract buy & hold metrics if they exist (keys are buyhold_*)
        if (metrics.buyhold_total_return !== undefined) {
          buyHoldMetrics[row.ticker] = {
            total_return: metrics.buyhold_total_return,
            cagr: metrics.buyhold_cagr,
            sharpe: metrics.buyhold_sharpe,
            sortino: metrics.buyhold_sortino,
            vol: null, // Buy & hold doesn't have separate vol stored in summarize_comparisons
            maxdd: metrics.buyhold_maxdd
          };
        }
      } catch (parseError) {
        console.warn('[BACKEND] JSON parse error for buy & hold metrics:', parseError);
      }
    }
    stmt.free();
    
    console.log(`[BACKEND] Loaded buy & hold metrics for ${Object.keys(buyHoldMetrics).length} tickers`);
    return { success: true, data: buyHoldMetrics };
  } catch (error) {
    console.error('[BACKEND] Error loading buy & hold metrics:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-portfolio', async (event, runId) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare(`
      SELECT 
        run_id,
        total_return,
        cagr,
        sharpe,
        sortino,
        vol,
        maxdd,
        win_rate,
        net_win_rate,
        avg_trade_pnl,
        trades_total,
        metrics_json,
        equity_json,
        buyhold_equity_json,
        per_ticker_equity_json,
        created_at
      FROM portfolio
      WHERE run_id = ?
    `);
    stmt.bind([runId]);
    
    if (!stmt.step()) {
      stmt.free();
      return { success: false, error: 'Portfolio not found' };
    }
    
    const portfolio = stmt.getAsObject();
    stmt.free();
    
    // Get weights
    const wStmt = db.prepare(`
      SELECT ticker, target_weight
      FROM portfolio_weights
      WHERE run_id = ?
      ORDER BY target_weight DESC
    `);
    wStmt.bind([runId]);
    
    const weights = [];
    while (wStmt.step()) {
      weights.push(wStmt.getAsObject());
    }
    wStmt.free();
    
    // Handle JSON parsing with NaN values
    try {
      const metricsJson = (portfolio.metrics_json || '{}').replace(/:\s*NaN/g, ': null');
      portfolio.metrics = JSON.parse(metricsJson);
    } catch (parseError) {
      console.warn('[BACKEND] JSON parse error for portfolio:', parseError);
      portfolio.metrics = {};
    }
    
    // Parse equity JSON data
    if (portfolio.equity_json) {
      try {
        portfolio.equity = JSON.parse(portfolio.equity_json);
      } catch (e) {
        console.warn('[BACKEND] Failed to parse equity_json:', e);
        portfolio.equity = null;
      }
    }
    
    if (portfolio.buyhold_equity_json) {
      try {
        portfolio.buyhold_equity = JSON.parse(portfolio.buyhold_equity_json);
      } catch (e) {
        console.warn('[BACKEND] Failed to parse buyhold_equity_json:', e);
        portfolio.buyhold_equity = null;
      }
    }
    
    if (portfolio.per_ticker_equity_json) {
      try {
        portfolio.per_ticker_equity = JSON.parse(portfolio.per_ticker_equity_json);
      } catch (e) {
        console.warn('[BACKEND] Failed to parse per_ticker_equity_json:', e);
        portfolio.per_ticker_equity = null;
      }
    }
    
    // Ensure numeric fields are valid
    ['total_return', 'cagr', 'sharpe', 'sortino', 'vol', 'maxdd', 'win_rate', 'net_win_rate', 'avg_trade_pnl'].forEach(field => {
      if (portfolio[field] !== portfolio[field]) { // Check for NaN
        portfolio[field] = null;
      }
    });
    
    portfolio.weights = weights;
    
    return { success: true, data: portfolio };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-trades', async (event, runId, ticker = null) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    let query = `
      SELECT 
        id,
        run_id,
        ticker,
        side,
        dt,
        shares,
        price,
        fees,
        pnl,
        extra_json
      FROM trades
      WHERE run_id = ?
    `;
    
    const params = [runId];
    if (ticker) {
      query += ' AND ticker = ?';
      params.push(ticker);
    }
    
    query += ' ORDER BY dt DESC';
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    
    const trades = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.extra = JSON.parse(row.extra_json || '{}');
      trades.push(row);
    }
    stmt.free();
    
    return { success: true, data: trades };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-run-summary', async (event, runId) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const run = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId);
    
    if (!run) {
      return { success: false, error: 'Run not found' };
    }
    
    let summary = { run };
    
    if (run.mode === 'portfolio') {
      const portfolio = await ipcMain.invoke('get-portfolio', event, runId);
      summary.portfolio = portfolio.data;
    } else {
      const strategies = await ipcMain.invoke('get-strategies', event, runId);
      summary.strategies = strategies.data;
    }
    
    return { success: true, data: summary };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-comparison-data', async (event, runIds) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const placeholders = runIds.map(() => '?').join(',');
    
    // Get portfolio runs
    const pStmt = db.prepare(`
      SELECT 
        p.*,
        r.notes,
        r.started_at
      FROM portfolio p
      JOIN runs r ON p.run_id = r.run_id
      WHERE p.run_id IN (${placeholders})
    `);
    pStmt.bind(runIds);
    
    const portfolios = [];
    while (pStmt.step()) {
      portfolios.push(pStmt.getAsObject());
    }
    pStmt.free();
    
    // Get strategy aggregates
    const sStmt = db.prepare(`
      SELECT 
        s.run_id,
        r.notes,
        r.started_at,
        AVG(s.total_return) as avg_return,
        AVG(s.sharpe) as avg_sharpe,
        AVG(s.sortino) as avg_sortino,
        MAX(s.total_return) as max_return,
        MIN(s.maxdd) as worst_drawdown,
        COUNT(*) as strategy_count
      FROM strategies s
      JOIN runs r ON s.run_id = r.run_id
      WHERE s.run_id IN (${placeholders})
      GROUP BY s.run_id
    `);
    sStmt.bind(runIds);
    
    const strategies = [];
    while (sStmt.step()) {
      strategies.push(sStmt.getAsObject());
    }
    sStmt.free();
    
    return { 
      success: true, 
      data: {
        portfolios,
        strategies
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-strategy-details', async (event, strategyId) => {
  console.log('[BACKEND] get-strategy-details called for strategyId:', strategyId);
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id,
        run_id,
        ticker,
        total_return,
        cagr,
        sharpe,
        sortino,
        vol,
        maxdd,
        win_rate,
        net_win_rate,
        avg_trade_pnl,
        trades_total,
        params_json,
        metrics_json,
        equity_json,
        events_json,
        buyhold_json,
        created_at
      FROM strategies
      WHERE id = ?
    `);
    stmt.bind([strategyId]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      
      // Parse JSON fields
      try {
        row.params = JSON.parse(row.params_json || '{}');
        row.metrics = JSON.parse((row.metrics_json || '{}').replace(/:\s*NaN/g, ': null'));
        row.equity = row.equity_json ? JSON.parse(row.equity_json) : null;
        row.buyhold_equity = row.buyhold_json ? JSON.parse(row.buyhold_json) : null;
        row.events = row.events_json ? JSON.parse(row.events_json) : [];
      } catch (parseError) {
        console.warn('[BACKEND] JSON parse error:', parseError);
        row.params = {};
        row.metrics = {};
        row.equity = null;
        row.buyhold_equity = null;
        row.events = [];
      }
      
      stmt.free();
      
      // Get benchmark equity from runs table
      const runStmt = db.prepare('SELECT benchmark_equity_json FROM runs WHERE run_id = ?');
      runStmt.bind([row.run_id]);
      if (runStmt.step()) {
        const runRow = runStmt.getAsObject();
        try {
          row.benchmark_equity = runRow.benchmark_equity_json ? JSON.parse(runRow.benchmark_equity_json) : null;
        } catch (e) {
          row.benchmark_equity = null;
        }
      }
      runStmt.free();
      
      console.log('[BACKEND] Strategy details loaded:', {
        id: row.id,
        ticker: row.ticker,
        hasEquity: !!row.equity,
        hasBuyHold: !!row.buyhold_equity,
        hasBenchmark: !!row.benchmark_equity,
        eventsCount: row.events.length
      });
      
      return { success: true, data: row };
    }
    
    stmt.free();
    return { success: false, error: 'Strategy not found' };
  } catch (error) {
    console.error('[BACKEND] Error loading strategy details:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calculate-capm', async (event, strategyEquity, benchmarkEquity) => {
  console.log('[BACKEND] calculate-capm called');
  
  try {
    const { spawn } = require('child_process');
    const pythonPath = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(__dirname, '..', 'calculate_capm.py');
    
    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [scriptPath]);
      
      let stdout = '';
      let stderr = '';
      
      // Send equity data as JSON to Python stdin
      python.stdin.write(JSON.stringify({
        strategy: strategyEquity,
        benchmark: benchmarkEquity
      }));
      python.stdin.end();
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          console.error('[BACKEND] CAPM calculation failed:', stderr);
          resolve({ success: false, error: stderr || 'CAPM calculation failed' });
        } else {
          try {
            const result = JSON.parse(stdout);
            console.log('[BACKEND] CAPM result:', result);
            resolve({ success: true, data: result });
          } catch (e) {
            console.error('[BACKEND] Failed to parse CAPM result:', e);
            resolve({ success: false, error: 'Failed to parse CAPM result' });
          }
        }
      });
      
      python.on('error', (err) => {
        console.error('[BACKEND] Failed to spawn Python process:', err);
        resolve({ success: false, error: err.message });
      });
    });
  } catch (error) {
    console.error('[BACKEND] Error in calculate-capm:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-run', async (event, runId) => {
  console.log('[BACKEND] delete-run called for runId:', runId);
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    // Delete from all related tables using exec for immediate execution
    db.exec(`
      DELETE FROM trades WHERE run_id = '${runId}';
      DELETE FROM portfolio_weights WHERE run_id = '${runId}';
      DELETE FROM portfolio WHERE run_id = '${runId}';
      DELETE FROM strategies WHERE run_id = '${runId}';
      DELETE FROM runs WHERE run_id = '${runId}';
    `);
    
    // Save database to persist the deletion
    if (!saveDatabase()) {
      return { success: false, error: 'Failed to save database after deletion' };
    }
    
    console.log('[BACKEND] Successfully deleted run:', runId);
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error deleting run:', error);
    return { success: false, error: error.message };
  }
});
