const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let mainWindow;
let db = null;
let SQL = null;

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

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') app.quit();
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
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No file selected' };
});

ipcMain.handle('get-runs', async () => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare(`
      SELECT 
        run_id,
        notes,
        mode,
        started_at,
        completed_at
      FROM runs
      ORDER BY started_at DESC
    `);
    
    const runs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      
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
        created_at
      FROM strategies
      WHERE run_id = ?
      ORDER BY total_return DESC
    `);
    stmt.bind([runId]);
    
    const strategies = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.params = JSON.parse(row.params_json || '{}');
      row.metrics = JSON.parse(row.metrics_json || '{}');
      strategies.push(row);
    }
    stmt.free();
    
    return { success: true, data: strategies };
  } catch (error) {
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
    
    portfolio.metrics = JSON.parse(portfolio.metrics_json || '{}');
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
