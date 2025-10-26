const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const WebSocket = require('ws');
const { SP500_BY_SECTOR, MARKET_CAPS_BY_SECTOR } = require('./sp500_data.js');
const DebugLogger = require('./debug-logger.js');

require('dotenv').config();

// Initialize debug logger
const debugLogger = new DebugLogger(path.join(__dirname, 'logs'));
console.log('[STARTUP] Debug logger initialized');

let mainWindow;
let db = null;
let SQL = null;
let dbPath = null;
let polygonWs = null;
let stockData = new Map(); // Store latest data for each ticker
let isConnected = false;
let reconnectTimeout = null;

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
  
  // Open DevTools always (for debugging)
  mainWindow.webContents.openDevTools();
  
  // Setup renderer process logging
  debugLogger.setupRendererLogging(mainWindow);
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

app.on('before-quit', function () {
  console.log('[APP] Cleaning up before quit...');
  
  // Clear any pending reconnect attempts
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Close websocket properly
  if (polygonWs) {
    try {
      isConnected = false;
      polygonWs.removeAllListeners();
      polygonWs.close(1000, 'Application closing');
      polygonWs = null;
    } catch (e) {
      console.error('[APP] Error closing websocket:', e.message);
    }
  }
  if (db) {
    try {
      db.close();
      db = null;
    } catch (e) {
      console.error('[APP] Error closing database:', e.message);
    }
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Load S&P 500 tickers from CSV
let SP500_TICKERS = [];
let SP500_DATA = {}; // Will store sector and sub-industry info

function loadSP500CSV() {
  try {
    const fs = require('fs');
    const path = require('path');
    const csvPath = path.join(__dirname, '../spy503.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('[POLYGON] CSV file not found, using fallback list');
      SP500_TICKERS = Object.values(SP500_BY_SECTOR).flat();
      return;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Parse CSV line (handle quoted fields)
      const values = parseCSVLine(lines[i]);
      if (values.length < 4) continue;
      
      const ticker = values[0];
      SP500_TICKERS.push(ticker);
      SP500_DATA[ticker] = {
        name: values[1],
        sector: values[2],
        subIndustry: values[3]
      };
    }
    
    console.log(`[POLYGON] Loaded ${SP500_TICKERS.length} S&P 500 tickers from CSV`);
  } catch (error) {
    console.error('[POLYGON] Error loading CSV:', error);
    SP500_TICKERS = Object.values(SP500_BY_SECTOR).flat();
  }
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Load CSV on startup
loadSP500CSV();

// Add sector ETFs for watchlist support
const SECTOR_ETFS = ['XLK', 'XLF', 'XLV', 'XLY', 'XLP', 'XLE', 'XLI', 'XLU', 'XLRE', 'XLC', 'XLB'];

// Flatten market caps from all sectors (fallback only)
const MARKET_CAPS = Object.values(MARKET_CAPS_BY_SECTOR).reduce((acc, sectorCaps) => {
  return { ...acc, ...sectorCaps };
}, {});

// Add market caps for sector ETFs (approximate values in billions)
SECTOR_ETFS.forEach(etf => {
  MARKET_CAPS[etf] = 10; // Default 10B for ETFs
});

// Fetch ALL S&P 500 stocks using Polygon's ticker list API
async function fetchAllSP500Tickers() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return SP500_TICKERS;
  
  try {
    const https = require('https');
    const url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${apiKey}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.results) {
              // Filter for S&P 500 stocks (you can improve this filter)
              const tickers = response.results
                .filter(t => t.market === 'stocks' && t.primary_exchange)
                .map(t => t.ticker)
                .slice(0, 500); // Get first 500
              console.log(`[POLYGON] Fetched ${tickers.length} tickers from API`);
              resolve(tickers.length > 400 ? tickers : SP500_TICKERS);
            } else {
              resolve(SP500_TICKERS);
            }
          } catch (error) {
            console.error('[POLYGON] Error parsing tickers:', error);
            resolve(SP500_TICKERS);
          }
        });
      }).on('error', (error) => {
        console.error('[POLYGON] Error fetching tickers:', error);
        resolve(SP500_TICKERS);
      });
    });
  } catch (error) {
    return SP500_TICKERS;
  }
}

// Cache for market caps (persists between app restarts)
const marketCapCache = new Map();
const MARKET_CAP_CACHE_FILE = path.join(app.getPath('userData'), 'market-caps-cache.json');
const CACHE_EXPIRY_HOURS = 24; // Refresh once per day

// Load market cap cache from disk
function loadMarketCapCache() {
  try {
    if (fs.existsSync(MARKET_CAP_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MARKET_CAP_CACHE_FILE, 'utf8'));
      if (data.timestamp && Date.now() - data.timestamp < CACHE_EXPIRY_HOURS * 3600000) {
        console.log(`[POLYGON] Loaded ${Object.keys(data.caps).length} cached market caps`);
        Object.entries(data.caps).forEach(([ticker, cap]) => {
          marketCapCache.set(ticker, cap);
        });
        return true;
      }
    }
  } catch (error) {
    console.error('[POLYGON] Error loading market cap cache:', error);
  }
  return false;
}

// Save market cap cache to disk
function saveMarketCapCache() {
  try {
    const data = {
      timestamp: Date.now(),
      caps: Object.fromEntries(marketCapCache)
    };
    fs.writeFileSync(MARKET_CAP_CACHE_FILE, JSON.stringify(data));
    console.log(`[POLYGON] Saved ${marketCapCache.size} market caps to cache`);
  } catch (error) {
    console.error('[POLYGON] Error saving market cap cache:', error);
  }
}

// Fetch initial snapshot data from Polygon REST API
// Gets ALL S&P 500 stocks for display, but doesn't subscribe to websocket
async function fetchInitialData() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return;

  // Use CSV ticker list
  console.log(`[POLYGON] Fetching snapshot data for ${SP500_TICKERS.length} S&P 500 stocks...`);
  
  try {
    const https = require('https');
    
    // Try loading from cache first
    const cacheLoaded = loadMarketCapCache();
    
    const marketCaps = new Map(marketCapCache);
    
    // Only fetch missing market caps
    const tickersToFetch = cacheLoaded 
      ? SP500_TICKERS.filter(t => !marketCaps.has(t))
      : SP500_TICKERS;
    
    if (tickersToFetch.length > 0) {
      console.log(`[POLYGON] Fetching market caps for ${tickersToFetch.length} tickers (${SP500_TICKERS.length - tickersToFetch.length} cached)...`);
      
      // Aggressive parallel fetching: 50 requests at a time with shorter delays
      const marketCapBatchSize = 50;
      const marketCapDelay = 250; // 250ms between batches = 200 requests/second effective rate
      
      for (let i = 0; i < tickersToFetch.length; i += marketCapBatchSize) {
        const batch = tickersToFetch.slice(i, i + marketCapBatchSize);
        const batchPromises = batch.map(ticker => {
          return new Promise((resolve) => {
            const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`;
            https.get(url, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                try {
                  const response = JSON.parse(data);
                  if (response.results && response.results.market_cap) {
                    marketCaps.set(ticker, response.results.market_cap);
                    marketCapCache.set(ticker, response.results.market_cap);
                  }
                } catch (error) {
                  console.error(`[POLYGON] Error parsing market cap for ${ticker}:`, error);
                }
                resolve();
              });
            }).on('error', () => resolve());
          });
        });
        
        await Promise.all(batchPromises);
        console.log(`[POLYGON] Fetched market caps: ${i + batch.length}/${tickersToFetch.length}`);
        
        // Delay between batches
        if (i + marketCapBatchSize < tickersToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, marketCapDelay));
        }
      }
      
      // Save updated cache
      saveMarketCapCache();
    }
    
    console.log(`[POLYGON] Market cap fetch complete: ${marketCaps.size} tickers`);
    
    // Now fetch snapshot data
    // Batch tickers into groups of 50 (Polygon limit per request)
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < SP500_TICKERS.length; i += batchSize) {
      batches.push(SP500_TICKERS.slice(i, i + batchSize));
    }
    
    console.log(`[POLYGON] Fetching ${batches.length} batches of tickers...`);
    let totalCount = 0;
    let batchesCompleted = 0;
    
    // Fetch each batch
    batches.forEach((batch, batchIndex) => {
      const tickersParam = batch.join(',');
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickersParam}&apiKey=${apiKey}`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.status === 'OK' && response.tickers) {
              response.tickers.forEach(snapshot => {
                const prevClose = snapshot.prevDay?.c || snapshot.day?.c || 100;
                const currentPrice = snapshot.day?.c || prevClose;
                
                // Calculate change from previous day's close
                const change = currentPrice - prevClose;
                const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;
                
                // Use real market cap from API fetch
                const marketCap = marketCaps.get(snapshot.ticker) || null;
                
                // Log first ticker to verify data structure
                if (batchIndex === 0 && totalCount === 0) {
                  console.log(`[POLYGON] Sample data for ${snapshot.ticker}:`, {
                    marketCap: marketCap,
                    price: currentPrice,
                    volume: snapshot.day?.v
                  });
                }
                
                const stockInfo = {
                  ticker: snapshot.ticker,
                  open: snapshot.day?.o || prevClose,
                  high: snapshot.day?.h || currentPrice,
                  low: snapshot.day?.l || currentPrice,
                  close: currentPrice,
                  volume: snapshot.day?.v || 0, // REAL volume from snapshot
                  prevClose: prevClose,
                  marketCap: marketCap, // REAL market cap from ticker details API
                  timestamp: Date.now(),
                  change: change,
                  changePercent: changePercent
                };
                
                stockData.set(snapshot.ticker, stockInfo);
                totalCount++;
                
                // Send to renderer
                if (mainWindow) {
                  mainWindow.webContents.send('polygon-update', stockInfo);
                }
              });
              
              console.log(`[POLYGON] Batch ${batchIndex + 1}/${batches.length} complete: ${response.tickers.length} stocks (total: ${totalCount})`);
            }
          } catch (error) {
            console.error(`[POLYGON] Error parsing batch ${batchIndex + 1}:`, error);
          }
        });
      }).on('error', (error) => {
        console.error(`[POLYGON] Error fetching batch ${batchIndex + 1}:`, error);
      });
    });
    
    // Wait a bit for all batches (using simple timeout since forEach doesn't support await)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`[POLYGON] All batches complete! Loaded ${totalCount} of ${SP500_TICKERS.length} S&P 500 stocks`);
    if (mainWindow) {
      mainWindow.webContents.send('polygon-initial-load-complete', { count: totalCount });
    }
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
    
    // Do NOT subscribe to any tickers initially
    // Will subscribe dynamically when user opens watchlists or charts
    console.log('[POLYGON] WebSocket ready - waiting for user to view tickers');
    
    if (mainWindow) {
      mainWindow.webContents.send('polygon-status', { connected: true });
    }
    
    // Fetch initial snapshot data for ALL tickers (including ETFs)
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
          
          // Get previous data to preserve prevClose and marketCap
          const prevData = stockData.get(ticker);
          const prevClose = prevData?.prevClose || msg.c;
          const marketCap = prevData?.marketCap || null; // Keep market cap from initial fetch (no hardcoded fallback)
          const currentPrice = msg.c;
          const change = currentPrice - prevClose;
          const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;
          
          if (ticker === 'AAPL') {
            console.log(`[WEBSOCKET] ${ticker}: prevClose=$${prevClose.toFixed(2)}, current=$${currentPrice.toFixed(2)}, change=${changePercent.toFixed(2)}%`);
          }
          
          const data = {
            ticker: ticker,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            close: currentPrice,
            volume: msg.v, // Real-time volume from websocket
            prevClose: prevClose,
            marketCap: marketCap, // Preserve real market cap from initial fetch
            timestamp: msg.s,
            change: change,
            changePercent: changePercent
          };
          
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
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
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
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (polygonWs) {
    polygonWs.close(1000, 'User disconnected');
    polygonWs = null;
    isConnected = false;
  }
  return { success: true };
});

ipcMain.handle('polygon-get-all-data', () => {
  const data = Array.from(stockData.values());
  console.log(`[POLYGON] polygonGetAllData called, returning ${data.length} stocks`);
  return data; // Return array directly for compatibility
});

// Fetch snapshot data for specific tickers (not in S&P 500)
ipcMain.handle('polygon-fetch-tickers', async (event, tickers) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'No API key' };
  }
  
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return { success: false, error: 'Invalid tickers array' };
  }
  
  try {
    const https = require('https');
    const tickersParam = tickers.join(',');
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickersParam}&apiKey=${apiKey}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'OK' && response.tickers) {
              const results = [];
              response.tickers.forEach(snapshot => {
                const prevClose = snapshot.prevDay?.c || snapshot.day?.c || 100;
                const currentPrice = snapshot.day?.c || prevClose;
                const change = currentPrice - prevClose;
                const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;
                const marketCap = (MARKET_CAPS[snapshot.ticker] || 100) * 1e9; // Use hardcoded market caps
                
                const stockInfo = {
                  ticker: snapshot.ticker,
                  open: snapshot.day?.o || prevClose,
                  high: snapshot.day?.h || currentPrice,
                  low: snapshot.day?.l || currentPrice,
                  close: currentPrice,
                  volume: snapshot.day?.v || 0,
                  prevClose: prevClose,
                  marketCap: marketCap,
                  timestamp: Date.now(),
                  change: change,
                  changePercent: changePercent
                };
                
                stockData.set(snapshot.ticker, stockInfo);
                results.push(stockInfo);
                
                // Send to renderer
                if (mainWindow) {
                  mainWindow.webContents.send('polygon-update', stockInfo);
                }
              });
              
              console.log(`[POLYGON] Fetched ${results.length} tickers: ${tickers.join(', ')}`);
              resolve({ success: true, data: results });
            } else {
              console.error('[POLYGON] Error fetching tickers:', response.error);
              resolve({ success: false, error: response.error || 'Unknown error' });
            }
          } catch (error) {
            console.error('[POLYGON] Parse error:', error);
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        console.error('[POLYGON] Request error:', error);
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get ticker details (including market cap) from Polygon
ipcMain.handle('polygon-get-ticker-details', async (event, ticker) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'No API key' };
  }
  
  try {
    const https = require('https');
    const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'OK' && response.results) {
              resolve({ success: true, data: response.results });
            } else {
              resolve({ success: false, error: response.error || 'Unknown error' });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get S&P 500 ticker list and metadata
ipcMain.handle('polygon-get-sp500-data', () => {
  return {
    success: true,
    tickers: SP500_TICKERS,
    data: SP500_DATA
  };
});

// Subscribe to additional tickers dynamically
ipcMain.handle('polygon-subscribe-tickers', (event, tickers) => {
  if (!polygonWs || !isConnected) {
    return { success: false, error: 'Not connected to Polygon' };
  }
  
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return { success: false, error: 'Invalid tickers array' };
  }
  
  try {
    const subscriptions = tickers.map(ticker => `AM.${ticker}`);
    polygonWs.send(JSON.stringify({ 
      action: 'subscribe', 
      params: subscriptions.join(',')
    }));
    console.log(`[POLYGON] Dynamically subscribed to: ${tickers.join(', ')}`);
    return { success: true, tickers };
  } catch (error) {
    console.error('[POLYGON] Error subscribing to tickers:', error);
    return { success: false, error: error.message };
  }
});

// Unsubscribe from tickers dynamically
ipcMain.handle('polygon-unsubscribe-tickers', (event, tickers) => {
  if (!polygonWs || !isConnected) {
    return { success: false, error: 'Not connected to Polygon' };
  }
  
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return { success: false, error: 'Invalid tickers array' };
  }
  
  try {
    const subscriptions = tickers.map(ticker => `AM.${ticker}`);
    polygonWs.send(JSON.stringify({ 
      action: 'unsubscribe', 
      params: subscriptions.join(',')
    }));
    console.log(`[POLYGON] Unsubscribed from: ${tickers.join(', ')}`);
    return { success: true, tickers };
  } catch (error) {
    console.error('[POLYGON] Error unsubscribing from tickers:', error);
    return { success: false, error: error.message };
  }
});

// Fetch historical bars for candlestick chart
ipcMain.handle('polygon-get-historical-bars', async (event, { ticker, from, to, timespan, multiplier, includeExtendedHours }) => {
  const apiKey = process.env.POLYGON_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'Polygon API key not configured' };
  }

  try {
    // For daily/weekly/monthly aggregates, use regular aggregates endpoint
    // For intraday (minute/hour), use includeOtc parameter which actually works
    let url;
    
    // Use includeOtc parameter for all timespans to control extended hours
    const extendedHours = includeExtendedHours ? 'true' : 'false';
    
    if (timespan === 'day' || timespan === 'week' || timespan === 'month') {
      // For daily+ data, includeOtc affects whether extended hours are included in OHLC
      url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=desc&limit=50000&includeOtc=${extendedHours}&apiKey=${apiKey}`;
      console.log(`Fetching ${timespan} data (Extended Hours: ${extendedHours}): ${ticker}`);
    } else {
      // For intraday data (minute/hour), includeOtc controls extended hours data
      url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=desc&limit=50000&includeOtc=${extendedHours}&apiKey=${apiKey}`;
      console.log(`Fetching intraday data: ${ticker} (Extended Hours: ${extendedHours})`);
    }
    
    console.log(`Date Range: ${from} to ${to} (${multiplier} ${timespan})`);
    console.log(`URL: ${url.replace(apiKey, 'HIDDEN')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log(`API returned ${data.results.length} bars`);
      console.log(`First bar from API: ${new Date(data.results[0].t).toISOString()}`);
      console.log(`Last bar from API: ${new Date(data.results[data.results.length - 1].t).toISOString()}`);
      
      // Reverse bars since API returns descending order (newest first)
      let bars = data.results.reverse();
      
      // For intraday data when extended hours are OFF, filter by time
      if (!includeExtendedHours && (timespan === 'minute' || timespan === 'hour')) {
        console.log(`Filtering out extended hours (before: ${bars.length} bars)`);
        bars = bars.filter(bar => {
          const date = new Date(bar.t);
          const hour = date.getUTCHours() - 4; // Convert to ET (approximate)
          const minute = date.getUTCMinutes();
          const timeInMinutes = hour * 60 + minute;
          
          // For multi-hour bars (like 4-hour), check if bar START overlaps with regular hours
          // Regular market hours: 9:30 AM (570 min) to 4:00 PM (960 min) ET
          // Keep bar if it starts during market hours OR if it would contain market hours
          if (timespan === 'hour' && multiplier > 1) {
            // For 4-hour bars: keep if bar starts between 6:30 AM and 4:00 PM
            // This ensures we get bars that include regular market hours
            return timeInMinutes >= 390 && timeInMinutes < 960;
          } else {
            // For minute and 1-hour bars: strict filtering
            return timeInMinutes >= 570 && timeInMinutes < 960;
          }
        });
        console.log(`After filtering: ${bars.length} bars`);
      }
      
      console.log(`Received ${bars.length} bars for ${ticker}`);
      return { 
        success: true, 
        bars: bars,
        ticker: data.ticker,
        resultsCount: bars.length
      };
    } else {
      console.error('No data received from Polygon:', data);
      return { 
        success: false, 
        error: data.error || 'No data available for the specified period' 
      };
    }
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Fundamentals API - Balance Sheet
ipcMain.handle('polygon-get-balance-sheet', async (event, ticker, options = {}) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('[MAIN] No Polygon API key found in environment');
    return { success: false, error: 'No API key' };
  }
  
  try {
    const https = require('https');
    const { timeframe = 'quarterly', limit = 4 } = options;
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`;
    
    console.log(`[MAIN] Fetching balance sheet for ${ticker}: ${url.replace(apiKey, 'API_KEY')}`);
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'OK' && response.results) {
              // Filter to only balance sheet data
              const balanceSheets = response.results
                .filter(r => r.financials && r.financials.balance_sheet)
                .map(r => ({
                  ...r.financials.balance_sheet,
                  period_end: r.end_date,
                  fiscal_year: r.fiscal_year,
                  fiscal_quarter: r.fiscal_period,
                  timeframe: r.timeframe,
                  filing_date: r.filing_date,
                  cik: r.cik,
                  ticker: ticker
                }));
              resolve({ success: true, results: balanceSheets });
            } else {
              resolve({ success: false, error: response.error || 'No data available' });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fundamentals API - Cash Flow Statement
ipcMain.handle('polygon-get-cash-flow', async (event, ticker, options = {}) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'No API key' };
  }
  
  try {
    const https = require('https');
    const { timeframe = 'quarterly', limit = 4 } = options;
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'OK' && response.results) {
              // Filter to only cash flow data
              const cashFlows = response.results
                .filter(r => r.financials && r.financials.cash_flow_statement)
                .map(r => ({
                  ...r.financials.cash_flow_statement,
                  period_end: r.end_date,
                  fiscal_year: r.fiscal_year,
                  fiscal_quarter: r.fiscal_period,
                  timeframe: r.timeframe,
                  filing_date: r.filing_date,
                  cik: r.cik,
                  ticker: ticker
                }));
              resolve({ success: true, results: cashFlows });
            } else {
              resolve({ success: false, error: response.error || 'No data available' });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fundamentals API - Income Statement
ipcMain.handle('polygon-get-income-statement', async (event, ticker, options = {}) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'No API key' };
  }
  
  try {
    const https = require('https');
    const { timeframe = 'quarterly', limit = 4 } = options;
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'OK' && response.results) {
              // Filter to only income statement data
              const incomeStatements = response.results
                .filter(r => r.financials && r.financials.income_statement)
                .map(r => ({
                  ...r.financials.income_statement,
                  period_end: r.end_date,
                  fiscal_year: r.fiscal_year,
                  fiscal_quarter: r.fiscal_period,
                  timeframe: r.timeframe,
                  filing_date: r.filing_date,
                  cik: r.cik,
                  ticker: ticker
                }));
              resolve({ success: true, results: incomeStatements });
            } else {
              resolve({ success: false, error: response.error || 'No data available' });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fundamentals API - Financial Ratios
ipcMain.handle('polygon-get-ratios', async (event, ticker, options = {}) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('[MAIN] No Polygon API key found in environment');
    return { success: false, error: 'No API key' };
  }
  
  try {
    const https = require('https');
    // Get historical data - 20 quarters by default
    const limit = options.limit || 20;
    const timeframe = options.timeframe || 'quarterly';
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`;
    
    console.log(`[MAIN] Fetching ratios for ${ticker}: ${url.replace(apiKey, 'API_KEY')}`);
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        console.log(`[MAIN] Ratios API response status code: ${res.statusCode}`);
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            console.log(`[MAIN] Ratios raw response length: ${data.length} chars`);
            const response = JSON.parse(data);
            console.log(`[MAIN] Ratios response status: ${response.status}, results: ${response.results?.length || 0}`);
            if (response.status !== 'OK') {
              console.error('[MAIN] Ratios API error:', response.error || response.message || response.status || 'Unknown error');
              console.error('[MAIN] Full response:', JSON.stringify(response).substring(0, 500));
            }
            if (response.status === 'OK' && response.results) {
              resolve({ success: true, results: response.results, ticker: ticker });
            } else {
              resolve({ success: false, error: response.error || 'No data' });
            }
          } catch (parseError) {
            console.error('[MAIN] Ratios JSON parse error:', parseError.message);
            console.error('[MAIN] Ratios raw data:', data.substring(0, 500));
            resolve({ success: false, error: parseError.message });
          }
        });
      }).on('error', (error) => {
        console.error('[MAIN] Ratios HTTP error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('[MAIN] Ratios outer error:', error.message);
    return { success: false, error: error.message };
  }
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
      
      // Create folders table for organizing saved strategies
      db.run(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at REAL DEFAULT (julianday('now')),
          color TEXT DEFAULT '#888'
        )
      `);
      
      // Create favorites table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          run_id TEXT,
          ticker TEXT,
          strategy_id INTEGER,
          folder_id INTEGER,
          data_json TEXT,
          created_at REAL DEFAULT (julianday('now')),
          notes TEXT,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);
      
      // Create saved_strategies table for portfolio nesting
      db.run(`
        CREATE TABLE IF NOT EXISTS saved_strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          source_run_id TEXT NOT NULL,
          source_type TEXT NOT NULL,
          weights_json TEXT NOT NULL,
          strategy_params_json TEXT,
          notes TEXT,
          created_at REAL
        )
      `);
      
      // Create watchlists table for ticker groups
      db.run(`
        CREATE TABLE IF NOT EXISTS watchlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          tickers_json TEXT NOT NULL,
          created_at REAL DEFAULT (julianday('now')),
          notes TEXT
        )
      `);
      
      saveDatabase();
      
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
    // Get buy & hold metrics from metrics_json with buyhold_ prefix
    const stmt = db.prepare(`
      SELECT 
        ticker,
        metrics_json
      FROM strategies
      WHERE run_id = ? AND buyhold_json IS NOT NULL
      GROUP BY ticker
    `);
    stmt.bind([runId]);
    
    const buyHoldMetrics = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        if (row.metrics_json) {
          const metrics = JSON.parse(row.metrics_json);
          
          // Extract buyhold_ prefixed metrics
          buyHoldMetrics[row.ticker] = {
            total_return: metrics.buyhold_total_return || null,
            cagr: metrics.buyhold_cagr || null,
            sharpe: metrics.buyhold_sharpe || null,
            sortino: metrics.buyhold_sortino || null,
            vol: metrics.buyhold_vol || null,
            maxdd: metrics.buyhold_maxdd || null
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
    
    // Transform data if needed (from our storage format to Python script format)
    const transformEquity = (equity) => {
      if (equity && equity.equity && equity.dates) {
        return {
          data: equity.equity,
          index: equity.dates,
          name: equity.name || 'Equity'
        };
      }
      return equity; // Already in correct format
    };
    
    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [scriptPath]);
      
      let stdout = '';
      let stderr = '';
      
      // Send equity data as JSON to Python stdin
      python.stdin.write(JSON.stringify({
        strategy: transformEquity(strategyEquity),
        benchmark: transformEquity(benchmarkEquity)
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

// ========== Favorites Handlers ==========

ipcMain.handle('get-favorites', async () => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('SELECT * FROM favorites ORDER BY created_at DESC');
    const favorites = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.data_json) {
        row.data = JSON.parse(row.data_json);
      }
      favorites.push(row);
    }
    stmt.free();
    return { success: true, data: favorites };
  } catch (error) {
    console.error('[BACKEND] Error getting favorites:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-favorite', async (event, item) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    console.log('[BACKEND] Adding favorite:', item);
    
    // Check if folder_id column exists, if not add it
    try {
      const checkStmt = db.prepare('SELECT folder_id FROM favorites LIMIT 1');
      checkStmt.free();
    } catch (e) {
      // Column doesn't exist, add it
      console.log('[BACKEND] Adding folder_id column to favorites table');
      db.run('ALTER TABLE favorites ADD COLUMN folder_id INTEGER');
    }
    
    const stmt = db.prepare(`
      INSERT INTO favorites (type, name, run_id, ticker, strategy_id, folder_id, data_json, created_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      item.type,
      item.name,
      item.run_id || null,
      item.ticker || null,
      item.strategy_id || null,
      item.folder_id || null,
      item.data_json || null,
      Date.now() / 1000,
      item.notes || null
    ]);
    stmt.free();
    
    saveDatabase();
    console.log('[BACKEND] Favorite added successfully');
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error adding favorite:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-favorite', async (event, id) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('DELETE FROM favorites WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error removing favorite:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-portfolio-as-strategy', async (event, runId, name) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    // Get portfolio data
    const portfolioStmt = db.prepare('SELECT * FROM portfolio WHERE run_id = ?');
    portfolioStmt.bind([runId]);
    
    if (!portfolioStmt.step()) {
      portfolioStmt.free();
      return { success: false, error: 'Portfolio not found' };
    }
    
    const portfolio = portfolioStmt.getAsObject();
    portfolioStmt.free();
    
    // Get weights
    const weightsStmt = db.prepare('SELECT ticker, target_weight FROM portfolio_weights WHERE run_id = ? ORDER BY target_weight DESC');
    weightsStmt.bind([runId]);
    
    const weights = {};
    while (weightsStmt.step()) {
      const row = weightsStmt.getAsObject();
      weights[row.ticker] = row.target_weight;
    }
    weightsStmt.free();
    
    // Get strategy parameters for each ticker (if available)
    const strategiesStmt = db.prepare('SELECT ticker, params_json FROM strategies WHERE run_id = ?');
    strategiesStmt.bind([runId]);
    
    const strategyParams = {};
    while (strategiesStmt.step()) {
      const row = strategiesStmt.getAsObject();
      if (row.params_json) {
        strategyParams[row.ticker] = JSON.parse(row.params_json);
      }
    }
    strategiesStmt.free();
    
    // Save as reusable strategy
    const saveStmt = db.prepare(`
      INSERT OR REPLACE INTO saved_strategies (name, source_run_id, source_type, weights_json, strategy_params_json, created_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    saveStmt.run([
      name,
      runId,
      'portfolio',
      JSON.stringify(weights),
      JSON.stringify(strategyParams),
      Date.now() / 1000,
      `Saved from portfolio run: ${runId}`
    ]);
    saveStmt.free();
    
    saveDatabase();
    return { success: true, message: `Portfolio saved as strategy: ${name}` };
  } catch (error) {
    console.error('[BACKEND] Error saving portfolio as strategy:', error);
    return { success: false, error: error.message };
  }
});

// Folder operations
ipcMain.handle('get-folders', async () => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    // Ensure folders table exists
    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at REAL DEFAULT (julianday('now')),
          color TEXT DEFAULT '#888'
        )
      `);
    } catch (createError) {
      console.log('[BACKEND] Folders table already exists or error:', createError.message);
    }
    
    const stmt = db.prepare('SELECT * FROM folders ORDER BY created_at DESC');
    const folders = [];
    while (stmt.step()) {
      folders.push(stmt.getAsObject());
    }
    stmt.free();
    return { success: true, data: folders };
  } catch (error) {
    console.error('[BACKEND] Error getting folders:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, name, color = '#888') => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare(`
      INSERT INTO folders (name, color, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run([name, color, Date.now() / 1000]);
    stmt.free();
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error creating folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-folder', async (event, folderId) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    // Remove folder_id from favorites in this folder (set to NULL)
    const updateStmt = db.prepare('UPDATE favorites SET folder_id = NULL WHERE folder_id = ?');
    updateStmt.run([folderId]);
    updateStmt.free();
    
    // Delete the folder
    const deleteStmt = db.prepare('DELETE FROM folders WHERE id = ?');
    deleteStmt.run([folderId]);
    deleteStmt.free();
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error deleting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-to-folder', async (event, favoriteId, folderId) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('UPDATE favorites SET folder_id = ? WHERE id = ?');
    stmt.run([folderId, favoriteId]);
    stmt.free();
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error moving to folder:', error);
    return { success: false, error: error.message };
  }
});

// Watchlist operations
ipcMain.handle('get-watchlists', async () => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('SELECT * FROM watchlists ORDER BY created_at DESC');
    const watchlists = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.tickers_json) {
        row.tickers = JSON.parse(row.tickers_json);
        row.stock_count = row.tickers.length;
      }
      watchlists.push(row);
    }
    stmt.free();
    return { success: true, watchlists };
  } catch (error) {
    console.error('[BACKEND] Error getting watchlists:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-watchlist', async (event, name, tickers, notes) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('INSERT INTO watchlists (name, tickers_json, notes) VALUES (?, ?, ?)');
    stmt.run([name, JSON.stringify(tickers), notes || null]);
    stmt.free();
    
    saveDatabase();
    
    // Notify all windows that watchlists changed
    if (mainWindow) {
      mainWindow.webContents.send('watchlists-updated');
    }
    
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error creating watchlist:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-watchlist', async (event, id) => {
  if (!db) return { success: false, error: 'No database connected' };
  
  try {
    const stmt = db.prepare('DELETE FROM watchlists WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    
    saveDatabase();
    
    // Notify all windows that watchlists changed
    if (mainWindow) {
      mainWindow.webContents.send('watchlists-updated');
    }
    
    return { success: true };
  } catch (error) {
    console.error('[BACKEND] Error deleting watchlist:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// Market Breadth Indicators
// ============================================

ipcMain.handle('breadth-get-ad-line', async (event, { days = 252, forceRefresh = false }) => {
  return new Promise((resolve, reject) => {
    console.log(`[BREADTH] Fetching A/D Line data (${days} days, refresh: ${forceRefresh})`);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'backend', 'market_breadth_cli.py');
    
    const pythonProcess = spawn(pythonCommand, [scriptPath, 'ad-line', '--days', days.toString()], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`[BREADTH] A/D Line process exited with code: ${code}`);
      console.log(`[BREADTH] A/D Line stdout length: ${stdout.length}`);
      console.log(`[BREADTH] A/D Line stderr length: ${stderr.length}`);
      
      if (code !== 0) {
        console.error('[BREADTH] A/D Line error code:', code);
        console.error('[BREADTH] A/D Line stderr:', stderr);
        console.error('[BREADTH] A/D Line stdout:', stdout);
        resolve({ success: false, error: stderr || stdout || 'Process failed' });
      } else {
        try {
          console.log('[BREADTH] A/D Line stdout preview:', stdout.substring(0, 200));
          const result = JSON.parse(stdout);
          console.log(`[BREADTH] A/D Line data loaded: ${result.data?.length || 0} records`);
          resolve(result);
        } catch (e) {
          console.error('[BREADTH] JSON parse error:', e.message);
          console.error('[BREADTH] Raw stdout:', stdout.substring(0, 500));
          resolve({ success: false, error: `Parse error: ${e.message}` });
        }
      }
    });
  });
});

ipcMain.handle('breadth-get-tick-proxy', async (event, { date = null, forceRefresh = false }) => {
  return new Promise((resolve, reject) => {
    console.log(`[BREADTH] Fetching TICK proxy data (date: ${date || 'today'}, refresh: ${forceRefresh})`);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'backend', 'market_breadth_cli.py');
    const args = ['tick'];
    if (date) args.push('--date', date);
    
    const pythonProcess = spawn(pythonCommand, [scriptPath, ...args], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[BREADTH] TICK proxy error:', stderr);
        resolve({ success: false, error: stderr || 'Process failed' });
      } else {
        try {
          const result = JSON.parse(stdout);
          console.log(`[BREADTH] TICK proxy data loaded: ${result.data?.length || 0} records`);
          resolve(result);
        } catch (e) {
          console.error('[BREADTH] JSON parse error:', e.message);
          resolve({ success: false, error: 'Failed to parse response' });
        }
      }
    });
  });
});

ipcMain.handle('breadth-get-highs-lows', async (event, { days = 252, forceRefresh = false }) => {
  return new Promise((resolve, reject) => {
    console.log(`[BREADTH] Fetching Highs/Lows data (${days} days, refresh: ${forceRefresh})`);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'backend', 'market_breadth_cli.py');
    
    const pythonProcess = spawn(pythonCommand, [scriptPath, 'highs-lows', '--days', days.toString()], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`[BREADTH] Highs/Lows process exited with code: ${code}`);
      console.log(`[BREADTH] Highs/Lows stdout length: ${stdout.length}`);
      console.log(`[BREADTH] Highs/Lows stderr length: ${stderr.length}`);
      
      if (code !== 0) {
        console.error('[BREADTH] Highs/Lows error code:', code);
        console.error('[BREADTH] Highs/Lows stderr:', stderr);
        console.error('[BREADTH] Highs/Lows stdout:', stdout);
        resolve({ success: false, error: stderr || stdout || 'Process failed' });
      } else {
        try {
          console.log('[BREADTH] Highs/Lows stdout preview:', stdout.substring(0, 200));
          const result = JSON.parse(stdout);
          console.log(`[BREADTH] Highs/Lows data loaded: ${result.data?.length || 0} records`);
          resolve(result);
        } catch (e) {
          console.error('[BREADTH] JSON parse error:', e.message);
          console.error('[BREADTH] Raw stdout:', stdout.substring(0, 500));
          resolve({ success: false, error: `Parse error: ${e.message}` });
        }
      }
    });
  });
});

ipcMain.handle('breadth-get-percent-ma', async (event, { days = 252, forceRefresh = false }) => {
  return new Promise((resolve, reject) => {
    console.log(`[BREADTH] Fetching Percent Above MA data (${days} days, refresh: ${forceRefresh})`);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'backend', 'market_breadth_cli.py');
    
    const pythonProcess = spawn(pythonCommand, [scriptPath, 'percent-ma', '--days', days.toString()], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`[BREADTH] Percent MA process exited with code: ${code}`);
      console.log(`[BREADTH] Percent MA stdout length: ${stdout.length}`);
      console.log(`[BREADTH] Percent MA stderr length: ${stderr.length}`);
      
      if (code !== 0) {
        console.error('[BREADTH] Percent MA error code:', code);
        console.error('[BREADTH] Percent MA stderr:', stderr);
        console.error('[BREADTH] Percent MA stdout:', stdout);
        resolve({ success: false, error: stderr || stdout || 'Process failed' });
      } else {
        try {
          console.log('[BREADTH] Percent MA stdout preview:', stdout.substring(0, 200));
          const result = JSON.parse(stdout);
          console.log(`[BREADTH] Percent MA data loaded: ${result.data?.length || 0} records`);
          resolve(result);
        } catch (e) {
          console.error('[BREADTH] JSON parse error:', e.message);
          console.error('[BREADTH] Raw stdout:', stdout.substring(0, 500));
          resolve({ success: false, error: `Parse error: ${e.message}` });
        }
      }
    });
  });
});

// ============================================
// Backtester - Direct Python Subprocess
// ============================================

const { spawn } = require('child_process');

// Helper function to find the correct Python executable
function getPythonExecutable() {
  const projectRoot = path.join(__dirname, '..');
  
  // Check for virtual environment
  if (process.platform === 'win32') {
    // Windows: check for .venv\Scripts\python.exe
    const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
      console.log('[BACKTESTER] Using virtual environment Python:', venvPython);
      return venvPython;
    }
  } else {
    // Unix: check for .venv/bin/python
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPython)) {
      console.log('[BACKTESTER] Using virtual environment Python:', venvPython);
      return venvPython;
    }
  }
  
  // Fallback to system Python
  const systemPython = process.platform === 'win32' ? 'python' : 'python3';
  console.log('[BACKTESTER] Using system Python:', systemPython);
  return systemPython;
}

// Run backtest directly as Python subprocess
ipcMain.handle('backtest-run', async (event, config) => {
  return new Promise((resolve, reject) => {
    console.log('[BACKTESTER] Starting backtest subprocess...');
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'run_backtest.py');
    const configJson = JSON.stringify(config);
    
    // Spawn Python process
    const pythonProcess = spawn(pythonCommand, [scriptPath, configJson], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = [];
    let lastProgress = null;

    // Parse stdout for JSON progress messages
    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          output.push(msg);
          
          if (msg.type === 'progress') {
            lastProgress = msg;
            // Send progress updates to renderer
            if (mainWindow) {
              mainWindow.webContents.send('backtest-progress', msg);
            }
          } else if (msg.type === 'result') {
            // Final result
            if (mainWindow) {
              mainWindow.webContents.send('backtest-complete', msg);
            }
          }
        } catch (e) {
          // Not JSON, just log it
          console.log('[BACKTESTER]', line);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('[BACKTESTER ERROR]', data.toString());
    });

    pythonProcess.on('error', (error) => {
      console.error('[BACKTESTER] Process error:', error);
      reject({ success: false, error: error.message });
    });

    pythonProcess.on('exit', (code) => {
      console.log(`[BACKTESTER] Process exited with code ${code}`);
      
      // Find result message in output
      const result = output.find(msg => msg.type === 'result');
      
      if (code === 0 && result) {
        resolve({
          success: result.success,
          run_id: result.run_id,
          output: output
        });
      } else if (result) {
        resolve({
          success: false,
          error: result.error,
          traceback: result.traceback,
          output: output
        });
      } else {
        resolve({
          success: false,
          error: `Process exited with code ${code}`,
          output: output
        });
      }
    });
  });
});

// Run dynamic backtest from frontend config
ipcMain.handle('run-dynamic-backtest', async (event, config) => {
  return new Promise((resolve, reject) => {
    console.log('[DYNAMIC BACKTEST] Running with config:', config);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'dynamic_backtest.py');
    const configJson = JSON.stringify(config);
    
    // Spawn Python process
    const pythonProcess = spawn(pythonCommand, [scriptPath, configJson], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('[DYNAMIC BACKTEST ERROR]', data.toString());
    });

    pythonProcess.on('error', (error) => {
      console.error('[DYNAMIC BACKTEST] Process error:', error);
      resolve({ success: false, error: error.message });
    });

    pythonProcess.on('exit', (code) => {
      console.log(`[DYNAMIC BACKTEST] Process exited with code ${code}`);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: 'Failed to parse backtest results',
            details: output
          });
        }
      } else {
        resolve({
          success: false,
          error: `Process exited with code ${code}`,
          stderr: errorOutput
        });
      }
    });
  });
});

// Load preview data for strategy visualization
ipcMain.handle('load-preview-data', async (event, params) => {
  return new Promise((resolve, reject) => {
    console.log('[PREVIEW] Loading data for visualization:', params);
    
    const pythonCommand = getPythonExecutable();
    const scriptPath = path.join(__dirname, '..', 'backend', 'preview', 'load_preview_data.py');
    const paramsJson = JSON.stringify(params);
    
    // Spawn Python process
    const pythonProcess = spawn(pythonCommand, [scriptPath, paramsJson], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('[PREVIEW ERROR]', data.toString());
    });

    pythonProcess.on('error', (error) => {
      console.error('[PREVIEW] Process error:', error);
      resolve({ success: false, error: error.message });
    });

    pythonProcess.on('exit', (code) => {
      console.log(`[PREVIEW] Process exited with code ${code}`);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: 'Failed to parse preview data',
            details: output
          });
        }
      } else {
        resolve({
          success: false,
          error: `Process exited with code ${code}`,
          stderr: errorOutput
        });
      }
    });
  });
});

// ===== DEBUG LOGGING IPC HANDLERS =====
ipcMain.handle('debug-get-logs', () => {
  return debugLogger.getAllLogs();
});

ipcMain.handle('debug-get-main-logs', () => {
  return debugLogger.getMainLogs();
});

ipcMain.handle('debug-get-renderer-logs', () => {
  return debugLogger.getRendererLogs();
});
