/**
 * Polygon Treemap Module
 * S&P 500 Live Market Map visualization
 */

// State
let treemapData = new Map();
let lastUpdateTime = null;
let sp500SectorData = null; // Will be loaded from CSV via main process or sp500_data.js
let updateInterval = null;

const PolygonTreemap = {
  /**
   * Initialize Polygon connection and event listeners
   */
  async initialize() {
    console.log('[POLYGON TREEMAP] Initializing...');
    
    // Check if running in Electron or browser
    if (!window.electronAPI || !window.electronAPI.polygonGetSP500Data) {
      console.log('[POLYGON TREEMAP] Running in browser mode - using Socket.io');
      
      // Wait for Socket.io client to be available
      if (!window.socketIOClient) {
        console.log('[POLYGON TREEMAP] Waiting for Socket.io client...');
        await new Promise(resolve => {
          let attempts = 0;
          const checkInterval = setInterval(() => {
            attempts++;
            if (window.socketIOClient || attempts > 20) {
              clearInterval(checkInterval);
              if (window.socketIOClient) {
                console.log('[POLYGON TREEMAP] Socket.io client ready');
              } else {
                console.error('[POLYGON TREEMAP] Socket.io client not available after waiting');
              }
              resolve();
            }
          }, 100);
        });
      }
      
      await this.initializeBrowserMode();
      return;
    }

    // Load S&P 500 sector data from CSV
    try {
      const result = await window.electronAPI.polygonGetSP500Data();
      if (result.success) {
        sp500SectorData = result.data;
        console.log('Loaded S&P 500 sector data:', Object.keys(sp500SectorData).length, 'tickers');
      } else {
        console.error('Failed to load S&P 500 sector data');
      }
    } catch (error) {
      console.error('Error loading S&P 500 sector data:', error);
    }

    // Connect to Polygon on page load
    window.electronAPI.polygonConnect().then(result => {
      console.log('Polygon connection initiated:', result);
    });

    // Listen for updates
    window.electronAPI.onPolygonUpdate((data) => {
      treemapData.set(data.ticker, data);
      lastUpdateTime = new Date();
      this.updateLastUpdateDisplay();
      
      // Update watchlist data if this ticker is in the current watchlist
      // Note: This depends on window.currentWatchlist and window.watchlistStockData being available
      if (window.currentWatchlist && window.currentWatchlist.tickers.includes(data.ticker)) {
        window.watchlistStockData.set(data.ticker, data);
        if (!window.watchlistUpdateScheduled) {
          window.watchlistUpdateScheduled = true;
          setTimeout(() => {
            if (window.displayWatchlistStocks) {
              window.displayWatchlistStocks();
            }
            window.watchlistUpdateScheduled = false;
          }, 2000);
        }
      }
      
      // Redraw treemap periodically (every 5 seconds to avoid too frequent redraws)
      if (!window.treemapUpdateScheduled) {
        window.treemapUpdateScheduled = true;
        setTimeout(() => {
          this.drawTreemap();
          window.treemapUpdateScheduled = false;
        }, 5000);
      }
    });

    // Listen for initial data load complete
    window.electronAPI.onPolygonInitialLoad((data) => {
      console.log(`Initial data loaded: ${data.count} stocks`);
      this.drawTreemap(); // Draw immediately when initial data arrives
      
      // Refresh watchlist if one is selected
      if (window.currentWatchlist && window.loadWatchlistStockData) {
        window.loadWatchlistStockData();
      }
    });

    // Listen for connection status
    window.electronAPI.onPolygonStatus((status) => {
      const lastUpdateEl = document.getElementById('lastUpdate');
      const reconnectBtn = document.getElementById('reconnectBtn');
      
      if (status.connected) {
        lastUpdateEl.textContent = 'Connected';
        lastUpdateEl.style.color = '#00aa55';
        reconnectBtn.style.display = 'none';
      } else {
        lastUpdateEl.textContent = 'Disconnected';
        lastUpdateEl.style.color = '#ff4444';
        reconnectBtn.style.display = 'block';
      }
    });

    // Listen for errors
    window.electronAPI.onPolygonError((error) => {
      console.error('Polygon error:', error);
      const lastUpdateEl = document.getElementById('lastUpdate');
      lastUpdateEl.textContent = `Error: ${error}`;
      lastUpdateEl.style.color = '#ff4444';
    });

    // Reconnect button
    document.getElementById('reconnectBtn')?.addEventListener('click', () => {
      window.electronAPI.polygonConnect();
    });

    // Size-by selector
    document.getElementById('treemapSizeBy')?.addEventListener('change', () => {
      this.drawTreemap();
    });

    // Group-by selector
    document.getElementById('treemapGroupBy')?.addEventListener('change', () => {
      this.drawTreemap();
    });

    // Data source selector
    document.getElementById('treemapDataSource')?.addEventListener('change', (e) => {
      this.updateGroupByOptions(e.target.value);
      this.drawTreemap();
    });

    // Initialize group options based on initial data source
    const initialDataSource = document.getElementById('treemapDataSource')?.value || 'sp500';
    this.updateGroupByOptions(initialDataSource);

    // Update the "last updated" text every second
    setInterval(() => this.updateLastUpdateDisplay(), 1000);

    // Redraw on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (document.getElementById('homePage').classList.contains('active')) {
          this.drawTreemap();
        }
      }, 250);
    });

    // Initial draw when home page becomes active
    const homePageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('active') && mutation.target.id === 'homePage') {
          setTimeout(() => this.drawTreemap(), 100); // Small delay to ensure container is rendered
        }
      });
    });

    const homePage = document.getElementById('homePage');
    if (homePage) {
      homePageObserver.observe(homePage, { attributes: true, attributeFilter: ['class'] });
    }
  },

  /**
   * Initialize browser mode with WebSocket
   */
  async initializeBrowserMode() {
    console.log('[POLYGON TREEMAP] Initializing browser mode with WebSocket');
    
    // Load S&P 500 data from CSV file
    try {
      const response = await fetch('/spy503.csv');
      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      sp500SectorData = {};
      let tickerCount = 0;
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Parse CSV line (handle quoted fields)
        const values = this.parseCSVLine(lines[i]);
        if (values.length < 4) continue;
        
        const ticker = values[0];
        const sector = values[2]; // GICS Sector column
        
        sp500SectorData[ticker] = { sector };
        tickerCount++;
      }
      
      console.log('[POLYGON TREEMAP] Loaded', tickerCount, 'S&P 500 tickers from CSV');
    } catch (error) {
      console.error('[POLYGON TREEMAP] Error loading CSV:', error);
      return;
    }

    // Setup UI event listeners (same as Electron mode)
    document.getElementById('treemapSizeBy')?.addEventListener('change', () => {
      this.drawTreemap();
    });

    document.getElementById('treemapGroupBy')?.addEventListener('change', () => {
      this.drawTreemap();
    });

    document.getElementById('treemapDataSource')?.addEventListener('change', (e) => {
      this.updateGroupByOptions(e.target.value);
      this.drawTreemap();
    });

    document.getElementById('reconnectBtn')?.addEventListener('click', () => {
      this.connectBrowserWebSocket();
    });

    // Initialize group options
    const initialDataSource = document.getElementById('treemapDataSource')?.value || 'sp500';
    this.updateGroupByOptions(initialDataSource);

    // Update display every second
    setInterval(() => this.updateLastUpdateDisplay(), 1000);
    
    // Check every minute if we need to reset market closed flags (at 4 AM ET pre-market start)
    setInterval(() => {
      const now = new Date();
      const etHour = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
      const etMinute = now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' });
      
      // At 4:00 AM ET, reset all isMarketClosed flags to allow pre-market updates
      if (parseInt(etHour) === 4 && parseInt(etMinute) === 0) {
        console.log('[POLYGON TREEMAP] Pre-market start - resetting market closed flags');
        treemapData.forEach((data, ticker) => {
          if (data.isMarketClosed) {
            treemapData.set(ticker, { ...data, isMarketClosed: false });
          }
        });
        
        // Refresh data to get pre-market prices
        const tickers = Object.keys(sp500SectorData || {});
        const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
        if (tickers.length > 0 && apiKey) {
          this.fetchInitialData(tickers, apiKey);
        }
      }
    }, 60000); // Check every minute

    // Redraw on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (document.getElementById('homePage').classList.contains('active')) {
          this.drawTreemap();
        }
      }, 250);
    });

    // Initial draw when home page becomes active
    const homePageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('active') && mutation.target.id === 'homePage') {
          setTimeout(() => this.drawTreemap(), 100);
        }
      });
    });

    const homePage = document.getElementById('homePage');
    if (homePage) {
      homePageObserver.observe(homePage, { attributes: true, attributeFilter: ['class'] });
    }

    // Connect WebSocket
    await this.connectBrowserWebSocket();
  },

  /**
   * Parse CSV line handling quoted fields
   */
  parseCSVLine(line) {
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
  },

  /**
   * Connect to Polygon WebSocket in browser mode
   */
  async connectBrowserWebSocket() {
    const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
    if (!apiKey) {
      console.error('[POLYGON TREEMAP] No API key found');
      return;
    }

    const lastUpdateEl = document.getElementById('lastUpdate');
    const reconnectBtn = document.getElementById('reconnectBtn');

    try {
      // Get S&P 500 tickers
      let tickers = [];
      if (sp500SectorData) {
        tickers = Object.keys(sp500SectorData);
      } else {
        tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'V', 'UNH', 'JNJ'];
      }

      console.log(`[POLYGON TREEMAP] Subscribing to ${tickers.length} tickers via server WebSocket`);
      lastUpdateEl.textContent = 'Connecting...';
      lastUpdateEl.style.color = '#4a9eff';

      // Use Socket.io client instead of direct WebSocket
      const socketClient = window.socketIOClient;
      if (!socketClient) {
        console.error('[POLYGON TREEMAP] Socket.io client not available');
        console.error('[POLYGON TREEMAP] window.io exists?', typeof window.io);
        console.error('[POLYGON TREEMAP] window.socketIOClient exists?', typeof window.socketIOClient);
        lastUpdateEl.textContent = 'Socket.io not loaded';
        lastUpdateEl.style.color = '#ff4444';
        reconnectBtn.style.display = 'block';
        return;
      }
      
      console.log('[POLYGON TREEMAP] Socket.io client found, subscribing...');

      // Unsubscribe from previous subscription if exists
      if (this.socketUnsubscribe) {
        console.log('[POLYGON TREEMAP] Cleaning up old subscription to prevent duplicates');
        this.socketUnsubscribe();
        this.socketUnsubscribe = null;
      }

      // Subscribe to ticker updates via Socket.io
      this.socketUnsubscribe = socketClient.subscribe(tickers, (data) => {
        // Keep existing market cap from initial fetch
        const existingData = treemapData.get(data.ticker);
        const marketCap = existingData?.marketCap || null;
        
        // Check if market is closed - if so, don't update with after-hours data
        // This preserves the day's close price throughout after-hours and overnight
        if (existingData?.isMarketClosed) {
          // Market is closed - ignore after-hours updates to preserve day's % change
          return;
        }
        
        // During pre-market and market hours - update with live data
        const updatedData = {
          ...data,
          marketCap: marketCap || data.marketCap,
          isMarketClosed: false // Still in pre-market or market hours
        };
        
        treemapData.set(data.ticker, updatedData);
        lastUpdateTime = new Date();
        
        // Debounced redraw (every 5 seconds max)
        if (!window.treemapUpdateScheduled) {
          window.treemapUpdateScheduled = true;
          setTimeout(() => {
            this.drawTreemap();
            window.treemapUpdateScheduled = false;
          }, 5000);
        }
      });

      // Listen to connection status
      this.statusUnsubscribe = socketClient.onStatus((status) => {
        if (status.connected) {
          console.log('[POLYGON TREEMAP] Connected to server WebSocket');
          lastUpdateEl.textContent = 'Connected';
          lastUpdateEl.style.color = '#00aa55';
          reconnectBtn.style.display = 'none';
        } else {
          console.log('[POLYGON TREEMAP] Disconnected from server WebSocket');
          lastUpdateEl.textContent = 'Disconnected';
          lastUpdateEl.style.color = '#ff4444';
          reconnectBtn.style.display = 'block';
          
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            if (document.getElementById('treemapChart')) {
              console.log('[POLYGON TREEMAP] Auto-reconnecting...');
              socketClient.connect();
            }
          }, 5000);
        }
      });

      // Fetch initial data while waiting for WebSocket updates
      await this.fetchInitialData(tickers, apiKey);

    } catch (error) {
      console.error('[POLYGON TREEMAP] Error connecting WebSocket:', error);
      lastUpdateEl.textContent = 'Connection failed';
      lastUpdateEl.style.color = '#ff4444';
      reconnectBtn.style.display = 'block';
    }
  },

  /**
   * Fetch initial market data via REST API
   * Uses snapshot endpoint to get both today's data AND yesterday's close
   * Matches Electron logic from frontend/main.js lines 330-380
   */
  async fetchInitialData(tickers, apiKey) {
    console.log(`[POLYGON TREEMAP] Fetching initial data for ${tickers.length} tickers...`);
    const batchSize = 50; // Snapshot endpoint supports comma-separated tickers

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const tickersParam = batch.join(',');
      
      try {
        // Use snapshot endpoint - gives us today's data + yesterday's close
        const snapshotResponse = await fetch(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickersParam}&apiKey=${apiKey}`
        );
        const snapshotData = await snapshotResponse.json();

        if (snapshotData.status === 'OK' && snapshotData.tickers) {
          // Skip tickers known to fail on reference endpoint
          const skipMarketCap = new Set(['FI']);
          
          // Fetch market caps in parallel for this batch
          const marketCapPromises = batch.map(async ticker => {
            // Skip tickers that don't have reference data
            if (skipMarketCap.has(ticker)) {
              return { ticker, marketCap: null };
            }
            
            try {
              const detailsResponse = await fetch(
                `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`
              );
              
              // Silently handle 404s - some tickers don't have reference data
              if (!detailsResponse.ok) {
                return { ticker, marketCap: null };
              }
              
              const detailsData = await detailsResponse.json();
              return {
                ticker,
                marketCap: detailsData.status === 'OK' && detailsData.results?.market_cap 
                  ? detailsData.results.market_cap 
                  : null
              };
            } catch (err) {
              // Network errors only - 404s handled above
              return { ticker, marketCap: null };
            }
          });

          const marketCapResults = await Promise.all(marketCapPromises);
          const marketCapMap = new Map(marketCapResults.map(r => [r.ticker, r.marketCap]));

          // Process snapshot data - handle pre-market, market, and after-hours correctly
          snapshotData.tickers.forEach(snapshot => {
            // prevDay.c = yesterday's close (our baseline)
            const prevClose = snapshot.prevDay?.c || 100;
            
            // Determine current price based on market state:
            // - During pre-market/market hours: use latest tick (snapshot.min)
            // - After market close: lock in day's close (snapshot.day.c), ignore after-hours
            let currentPrice;
            
            if (snapshot.day?.c) {
              // Market has closed today - use the closing price (lock it in)
              currentPrice = snapshot.day.c;
            } else if (snapshot.min?.c) {
              // Pre-market or intraday - use latest minute bar
              currentPrice = snapshot.min.c;
            } else {
              // No data yet - use previous close
              currentPrice = prevClose;
            }
            
            // Calculate change from previous day's close
            const change = currentPrice - prevClose;
            const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;
            
            treemapData.set(snapshot.ticker, {
              ticker: snapshot.ticker,
              price: currentPrice,
              close: currentPrice,
              open: snapshot.day?.o || snapshot.min?.o || prevClose,
              high: snapshot.day?.h || snapshot.min?.h || currentPrice,
              low: snapshot.day?.l || snapshot.min?.l || currentPrice,
              volume: snapshot.day?.v || snapshot.min?.v || 0,
              prevClose: prevClose,
              change: change,
              changePercent: changePercent,
              marketCap: marketCapMap.get(snapshot.ticker),
              isMarketClosed: !!snapshot.day?.c // Flag to know if market is closed
            });
          });
        }
      } catch (err) {
        console.error(`[POLYGON TREEMAP] Error fetching batch:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    lastUpdateTime = new Date();
    console.log(`[POLYGON TREEMAP] Initial data loaded: ${treemapData.size} stocks with today's close vs yesterday's close`);
    this.drawTreemap();
  },

  /**
   * Fetch market data via REST API and draw treemap
   */
  async fetchAndDrawTreemap() {
    if (!window.POLYGON_API_KEY && !window.api?.POLYGON_API_KEY) {
      console.warn('[POLYGON TREEMAP] No API key configured');
      return;
    }

    const apiKey = window.POLYGON_API_KEY || window.api.POLYGON_API_KEY;
    const lastUpdateEl = document.getElementById('lastUpdate');
    
    try {
      lastUpdateEl.textContent = 'Updating...';
      lastUpdateEl.style.color = '#4a9eff';

      // Get top 50 S&P 500 stocks by market cap
      const topTickers = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'V', 'UNH',
        'XOM', 'JNJ', 'JPM', 'WMT', 'LLY', 'MA', 'PG', 'CVX', 'HD', 'ABBV',
        'MRK', 'COST', 'AVGO', 'KO', 'PEP', 'ORCL', 'MCD', 'ADBE', 'CSCO', 'TMO',
        'ACN', 'CRM', 'ABT', 'NFLX', 'DHR', 'NKE', 'LIN', 'AMD', 'TXN', 'DIS',
        'PM', 'NEE', 'VZ', 'UPS', 'T', 'RTX', 'INTU', 'QCOM', 'HON', 'SPGI'
      ];

      // Fetch previous close for all tickers in parallel
      const promises = topTickers.map(async (ticker) => {
        try {
          const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const changePercent = ((result.c - result.o) / result.o) * 100;
            
            return {
              ticker,
              price: result.c,
              open: result.o,
              high: result.h,
              low: result.l,
              volume: result.v,
              change: result.c - result.o,
              changePercent,
              timestamp: result.t
            };
          }
        } catch (error) {
          console.error(`[POLYGON TREEMAP] Error fetching ${ticker}:`, error);
        }
        return null;
      });

      const results = await Promise.all(promises);
      
      // Update treemapData
      treemapData.clear();
      results.forEach(data => {
        if (data) {
          treemapData.set(data.ticker, data);
        }
      });

      lastUpdateTime = new Date();
      lastUpdateEl.textContent = 'Updated just now';
      lastUpdateEl.style.color = '#00aa55';

      console.log('[POLYGON TREEMAP] Fetched data for', treemapData.size, 'stocks');
      
      // Draw treemap
      this.drawTreemap();
    } catch (error) {
      console.error('[POLYGON TREEMAP] Error fetching data:', error);
      lastUpdateEl.textContent = 'Error updating';
      lastUpdateEl.style.color = '#ff4444';
    }
  },

  /**
   * Update last update time display
   */
  updateLastUpdateDisplay() {
    if (!lastUpdateTime) return;
    
    const lastUpdateEl = document.getElementById('lastUpdate');
    const now = new Date();
    const seconds = Math.floor((now - lastUpdateTime) / 1000);
    
    if (seconds < 60) {
      lastUpdateEl.textContent = `Updated ${seconds}s ago`;
    } else {
      const minutes = Math.floor(seconds / 60);
      lastUpdateEl.textContent = `Updated ${minutes}m ago`;
    }
    lastUpdateEl.style.color = '#999999';
  },

  /**
   * Get GICS sector for a ticker from CSV data
   */
  getSectorForTicker(ticker) {
    try {
      // Use GICS sector from CSV data
      if (sp500SectorData && sp500SectorData[ticker]) {
        return sp500SectorData[ticker].sector || 'Other';
      }
    } catch (error) {
      console.error('Error getting sector for ticker:', ticker, error);
    }
    return 'Other';
  },

  /**
   * Get color for percent change
   */
  getColorForPercent(percent) {
    if (percent === null || percent === undefined) return '#404040';
    
    // Use theme colors for positive (green) and negative (red)
    if (percent > 0) {
      const intensity = Math.min(Math.abs(percent) / 3, 1); // Cap at 3% for full intensity
      const baseColor = window.getPositiveColor();
      
      // Darken the color based on intensity
      // Low intensity (near 0) = very dark, high intensity = full color
      // Scale from 0.2 (20% brightness) to 1.0 (100% brightness)
      const brightnessScale = 0.2 + (intensity * 0.8);
      
      // Apply darkening by reducing RGB values
      const hex = baseColor.replace('#', '');
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      
      r = Math.round(r * brightnessScale);
      g = Math.round(g * brightnessScale);
      b = Math.round(b * brightnessScale);
      
      return '#' + [r, g, b].map(x => {
        const hexVal = x.toString(16);
        return hexVal.length === 1 ? '0' + hexVal : hexVal;
      }).join('');
    } else if (percent < 0) {
      const intensity = Math.min(Math.abs(percent) / 3, 1);
      const baseColor = window.getNegativeColor();
      
      // Same darkening for negative
      const brightnessScale = 0.2 + (intensity * 0.8);
      
      const hex = baseColor.replace('#', '');
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      
      r = Math.round(r * brightnessScale);
      g = Math.round(g * brightnessScale);
      b = Math.round(b * brightnessScale);
      
      return '#' + [r, g, b].map(x => {
        const hexVal = x.toString(16);
        return hexVal.length === 1 ? '0' + hexVal : hexVal;
      }).join('');
    } else {
      return '#404040'; // Neutral gray for 0%
    }
  },

  /**
   * Navigate to charting page with a specific ticker
   */
  navigateToChart(ticker) {
    // Switch to charting page
    document.querySelectorAll('.main-tab').forEach(tab => {
      if (tab.dataset.mainTab === 'charting') {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.main-page').forEach(page => {
      page.classList.remove('active');
    });
    
    document.getElementById('chartingPage')?.classList.add('active');
    
    // Load the ticker in the chart
    setTimeout(() => {
      if (window.selectChartTicker) {
        window.selectChartTicker(ticker);
      }
    }, 100);
  },

  /**
   * Update group-by options based on data source
   */
  updateGroupByOptions(dataSource) {
    const groupBySelect = document.getElementById('treemapGroupBy');
    if (!groupBySelect) return;

    const currentValue = groupBySelect.value;
    
    // Clear existing options
    groupBySelect.innerHTML = '';
    
    if (dataSource === 'sp500') {
      // S&P 500: By Sector or No Grouping
      groupBySelect.innerHTML = `
        <option value="sector">By Sector</option>
        <option value="none">No Grouping</option>
      `;
      // Set to sector if current was watchlist, otherwise keep current
      groupBySelect.value = (currentValue === 'sector' || currentValue === 'none') ? currentValue : 'sector';
    } else if (dataSource === 'watchlists') {
      // Watchlists: By Watchlist or No Grouping
      groupBySelect.innerHTML = `
        <option value="watchlist">By Watchlist</option>
        <option value="none">No Grouping</option>
      `;
      // Set to watchlist if current was sector, otherwise keep current
      groupBySelect.value = (currentValue === 'watchlist' || currentValue === 'none') ? currentValue : 'watchlist';
    }
  },

  /**
   * Get watchlist data for treemap
   */
  async getWatchlistData() {
    try {
      // Load watchlists from Supabase first, fallback to localStorage
      let watchlists = [];
      
      if (window.supabase && window.getUserSettings) {
        try {
          const { data: { user } } = await window.supabase.auth.getUser();
          if (user) {
            const settings = await window.getUserSettings();
            if (settings && settings.watchlists) {
              watchlists = settings.watchlists;
              console.log('[TREEMAP] Loaded from Supabase:', watchlists.length, 'watchlists');
            }
          }
        } catch (error) {
          console.error('[TREEMAP] Error loading from Supabase:', error);
        }
      }
      
      // Fallback to localStorage if no Supabase data
      if (watchlists.length === 0) {
        const stored = localStorage.getItem('watchlists');
        if (stored) {
          try {
            watchlists = JSON.parse(stored);
            console.log('[TREEMAP] Loaded from localStorage:', watchlists.length, 'watchlists');
          } catch (error) {
            console.error('[TREEMAP] Error parsing localStorage watchlists:', error);
          }
        }
      }

      if (!Array.isArray(watchlists) || watchlists.length === 0) {
        console.log('[TREEMAP] No watchlists found');
        return [];
      }

      const allTickers = new Set();
      const tickerToWatchlist = new Map();

      // Collect all unique tickers and map them to watchlists
      watchlists.forEach(watchlist => {
        if (watchlist.tickers && Array.isArray(watchlist.tickers)) {
          watchlist.tickers.forEach(ticker => {
            allTickers.add(ticker);
            // If ticker is in multiple watchlists, use the first one
            if (!tickerToWatchlist.has(ticker)) {
              tickerToWatchlist.set(ticker, watchlist.name);
            }
          });
        }
      });

      // Request market data for these tickers if not already loaded
      const tickersToFetch = Array.from(allTickers).filter(ticker => !treemapData.has(ticker));
      if (tickersToFetch.length > 0) {
        console.log(`[TREEMAP] Fetching data for ${tickersToFetch.length} watchlist tickers...`);
        try {
          // Check if electronAPI exists (Electron mode)
          if (window.electronAPI && window.electronAPI.polygonFetchTickers) {
            await window.electronAPI.polygonFetchTickers(tickersToFetch);
            // Give it a moment to receive the data
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            // Server mode - fetch via Polygon API
            console.log('[TREEMAP] Server mode - fetching via Polygon API...');
            const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
            if (apiKey) {
              for (const ticker of tickersToFetch) {
                try {
                  const response = await fetch(
                    `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`
                  );
                  const data = await response.json();
                  
                  if (data.status === 'OK' && data.results?.[0]) {
                    const r = data.results[0];
                    const stockData = {
                      ticker,
                      price: r.c,
                      close: r.c,
                      open: r.o,
                      high: r.h,
                      low: r.l,
                      volume: r.v,
                      change: r.c - r.o,
                      changePercent: ((r.c - r.o) / r.o) * 100,
                      marketCap: null
                    };
                    treemapData.set(ticker, stockData);
                  }
                } catch (err) {
                  console.error(`[TREEMAP] Error fetching ${ticker}:`, err);
                }
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            } else {
              console.error('[TREEMAP] No Polygon API key available');
            }
          }
        } catch (error) {
          console.error('[TREEMAP] Error fetching watchlist tickers:', error);
        }
      }

      // Get market data for these tickers
      const dataArray = [];
      allTickers.forEach(ticker => {
        const data = treemapData.get(ticker);
        if (data && data.changePercent !== null) {
          dataArray.push({
            ...data,
            watchlistName: tickerToWatchlist.get(ticker)
          });
        }
      });

      console.log(`[TREEMAP] Loaded ${dataArray.length} stocks from ${watchlists.length} watchlists`);
      return dataArray;
    } catch (error) {
      console.error('Error loading watchlist data for treemap:', error);
      return [];
    }
  },

  /**
   * Draw the treemap visualization
   */
  async drawTreemap() {
    try {
      const container = document.getElementById('treemapContainer');
      if (!container) {
        console.warn('[POLYGON TREEMAP] Container not found');
        return;
      }
    
      console.log('[POLYGON TREEMAP] Drawing treemap with', treemapData.size, 'data points');
    
      // Get data source (S&P 500 or watchlists)
      const dataSource = document.getElementById('treemapDataSource')?.value || 'sp500';
      
      let dataArray;
      if (dataSource === 'watchlists') {
        // Get data from watchlists
        dataArray = await this.getWatchlistData();
      } else {
        // Get data from S&P 500 only (filter to only show S&P 500 stocks)
        dataArray = Array.from(treemapData.values()).filter(d => {
          // Only include if it's in the S&P 500 sector data
          return d.changePercent !== null && sp500SectorData && sp500SectorData[d.ticker];
        });
      }
      
      console.log('[POLYGON TREEMAP] Filtered data array length:', dataArray.length, 'sp500SectorData:', sp500SectorData ? Object.keys(sp500SectorData).length + ' tickers' : 'not loaded');
      
      if (dataArray.length === 0) {
        // Show loading message
        d3.select('#treemap').selectAll('*').remove();
        const svg = d3.select('#treemap');
        svg.append('text')
          .attr('x', '50%')
          .attr('y', '50%')
          .attr('text-anchor', 'middle')
          .attr('fill', '#666')
          .attr('font-size', '18px')
          .text(dataSource === 'watchlists' ? 'No watchlist data available...' : 'Waiting for market data...');
        return;
      }
      
      // Clear previous treemap
      d3.select('#treemap').selectAll('*').remove();
      
      // Get container dimensions (account for padding, ensure positive values)
      const width = Math.max(100, container.clientWidth - 20);
      const height = Math.max(100, container.clientHeight - 20);
      
      // Create SVG
      const svg = d3.select('#treemap')
        .attr('width', width)
        .attr('height', height);
      
      // Get sizing method and grouping
      const sizeBy = document.getElementById('treemapSizeBy')?.value || 'marketcap';
      const groupBy = document.getElementById('treemapGroupBy')?.value || 'sector';
      
      let root;
      
      if (groupBy === 'sector') {
        // Group by sector
        const sectorData = {};
        dataArray.forEach(d => {
          const sector = this.getSectorForTicker(d.ticker);
          if (!sectorData[sector]) {
            sectorData[sector] = [];
          }
          
          let value = 1;
          if (sizeBy === 'marketcap' && d.marketCap) {
            value = Math.abs(d.marketCap);
          } else if (sizeBy === 'volume' && d.volume) {
            value = Math.abs(d.volume);
          }
          
          sectorData[sector].push({
            name: d.ticker,
            value: value,
            percent: d.changePercent,
            change: d.change,
            close: d.close,
            volume: d.volume,
            marketCap: d.marketCap,
            sector: sector,
            data: d
          });
        });
        
        // Build hierarchical data
        root = d3.hierarchy({
          children: Object.entries(sectorData).map(([sector, stocks]) => ({
            name: sector,
            children: stocks
          }))
        })
        .sum(d => d.value)
        .sort((a, b) => (b.value || 0) - (a.value || 0));
        
      } else if (groupBy === 'watchlist') {
        // Group by watchlist
        const watchlistData = {};
        dataArray.forEach(d => {
          const watchlistName = d.watchlistName || 'Unknown';
          if (!watchlistData[watchlistName]) {
            watchlistData[watchlistName] = [];
          }
          
          let value = 1;
          if (sizeBy === 'marketcap' && d.marketCap) {
            value = Math.abs(d.marketCap);
          } else if (sizeBy === 'volume' && d.volume) {
            value = Math.abs(d.volume);
          }
          
          watchlistData[watchlistName].push({
            name: d.ticker,
            value: value,
            percent: d.changePercent,
            change: d.change,
            close: d.close,
            volume: d.volume,
            marketCap: d.marketCap,
            watchlist: watchlistName,
            data: d
          });
        });
        
        // Build hierarchical data
        root = d3.hierarchy({
          children: Object.entries(watchlistData).map(([watchlist, stocks]) => ({
            name: watchlist,
            children: stocks
          }))
        })
        .sum(d => d.value)
        .sort((a, b) => (b.value || 0) - (a.value || 0));
        
      } else {
        // No grouping - flat structure
        root = d3.hierarchy({
          children: dataArray.map(d => {
            let value = 1;
            if (sizeBy === 'marketcap' && d.marketCap) {
              value = Math.abs(d.marketCap);
            } else if (sizeBy === 'volume' && d.volume) {
              value = Math.abs(d.volume);
            }
            
            return {
              name: d.ticker,
              value: value,
              percent: d.changePercent,
              change: d.change,
              close: d.close,
              volume: d.volume,
              marketCap: d.marketCap,
              data: d
            };
          })
        })
        .sum(d => d.value)
        .sort((a, b) => (b.data?.percent || 0) - (a.data?.percent || 0));
      }
      
      // Create treemap layout
      const treemap = d3.treemap()
        .size([width, height])
        .paddingInner((groupBy === 'sector' || groupBy === 'watchlist') ? 3 : 2)
        .paddingOuter((groupBy === 'sector' || groupBy === 'watchlist') ? 3 : 2)
        .paddingTop((groupBy === 'sector' || groupBy === 'watchlist') ? 25 : 2)
        .round(true);
      
      treemap(root);
      
      if (groupBy === 'sector' || groupBy === 'watchlist') {
        // Draw sector/watchlist groups
        const groups = svg.selectAll('.group')
          .data(root.children)
          .join('g')
          .attr('class', 'group');
        
        // Group background rectangles
        groups.append('rect')
          .attr('class', 'group-bg')
          .attr('x', d => d.x0)
          .attr('y', d => d.y0)
          .attr('width', d => d.x1 - d.x0)
          .attr('height', d => d.y1 - d.y0)
          .attr('fill', 'rgba(0, 0, 0, 0.2)');
        
        // Group labels (sector name or watchlist name)
        groups.append('text')
          .attr('class', 'group-label')
          .attr('x', d => d.x0 + 8)
          .attr('y', d => d.y0 + 18)
          .attr('fill', getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e0e0e0')
          .text(d => d.data.name);
        
        // Draw stocks within groups
        const cells = groups.selectAll('.stock-cell')
          .data(d => d.leaves())
          .join('g')
          .attr('class', 'stock-cell')
          .attr('transform', d => `translate(${d.x0},${d.y0})`);
        
        cells.append('rect')
          .attr('class', 'treemap-cell')
          .attr('width', d => d.x1 - d.x0)
          .attr('height', d => d.y1 - d.y0)
          .attr('fill', d => this.getColorForPercent(d.data.percent))
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation();
            // Right-click or Ctrl+Click shows fundamentals, normal click navigates to chart
            if (event.ctrlKey || event.button === 2) {
              event.preventDefault();
              this.showFundamentals(d.data.name);
            } else {
              this.navigateToChart(d.data.name);
            }
          })
          .on('contextmenu', (event, d) => {
            event.preventDefault();
            this.showFundamentals(d.data.name);
          })
          .append('title')
          .text(d => {
            const volumeStr = d.data.volume ? (d.data.volume / 1000000).toFixed(1) + 'M' : 'N/A';
            const marketCapStr = d.data.marketCap ? '$' + (d.data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A';
            return `${d.data.name} (${d.data.sector})\n${d.data.percent ? (d.data.percent > 0 ? '+' : '') + d.data.percent.toFixed(2) : '0.00'}%\nPrice: $${d.data.close ? d.data.close.toFixed(2) : 'N/A'}\nMarket Cap: ${marketCapStr}\nVolume: ${volumeStr}`;
          });
        
        // Add stock labels
        cells.each(function(d) {
          const cellWidth = d.x1 - d.x0;
          const cellHeight = d.y1 - d.y0;
          const g = d3.select(this);
          
          if (cellWidth > 40 && cellHeight > 30) {
            g.append('text')
              .attr('class', 'treemap-text ticker')
              .attr('x', cellWidth / 2)
              .attr('y', cellHeight / 2 - 8)
              .text(d.data.name);
            
            if (d.data.percent !== null) {
              g.append('text')
                .attr('class', 'treemap-text percent')
                .attr('x', cellWidth / 2)
                .attr('y', cellHeight / 2 + 8)
                .text(`${d.data.percent > 0 ? '+' : ''}${d.data.percent.toFixed(2)}%`);
            }
          } else if (cellWidth > 25 && cellHeight > 20) {
            g.append('text')
              .attr('class', 'treemap-text ticker')
              .attr('x', cellWidth / 2)
              .attr('y', cellHeight / 2)
              .style('font-size', '10px')
              .text(d.data.name);
          }
        });
        
      } else {
        // No grouping - flat view
        const cells = svg.selectAll('.stock-cell')
          .data(root.leaves())
          .join('g')
          .attr('class', 'stock-cell')
          .attr('transform', d => `translate(${d.x0},${d.y0})`);
        
        cells.append('rect')
          .attr('class', 'treemap-cell')
          .attr('width', d => d.x1 - d.x0)
          .attr('height', d => d.y1 - d.y0)
          .attr('fill', d => this.getColorForPercent(d.data.percent))
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation();
            // Right-click or Ctrl+Click shows fundamentals, normal click navigates to chart
            if (event.ctrlKey || event.button === 2) {
              event.preventDefault();
              this.showFundamentals(d.data.name);
            } else {
              this.navigateToChart(d.data.name);
            }
          })
          .on('contextmenu', (event, d) => {
            event.preventDefault();
            this.showFundamentals(d.data.name);
          })
          .append('title')
          .text(d => {
            const volumeStr = d.data.volume ? (d.data.volume / 1000000).toFixed(1) + 'M' : 'N/A';
            const marketCapStr = d.data.marketCap ? '$' + (d.data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A';
            return `${d.data.name}\n${d.data.percent ? (d.data.percent > 0 ? '+' : '') + d.data.percent.toFixed(2) : '0.00'}%\nPrice: $${d.data.close ? d.data.close.toFixed(2) : 'N/A'}\nMarket Cap: ${marketCapStr}\nVolume: ${volumeStr}`;
          });
        
        cells.each(function(d) {
          const cellWidth = d.x1 - d.x0;
          const cellHeight = d.y1 - d.y0;
          const g = d3.select(this);
          
          if (cellWidth > 40 && cellHeight > 30) {
            g.append('text')
              .attr('class', 'treemap-text ticker')
              .attr('x', cellWidth / 2)
              .attr('y', cellHeight / 2 - 8)
              .text(d.data.name);
            
            if (d.data.percent !== null) {
              g.append('text')
                .attr('class', 'treemap-text percent')
                .attr('x', cellWidth / 2)
                .attr('y', cellHeight / 2 + 8)
                .text(`${d.data.percent > 0 ? '+' : ''}${d.data.percent.toFixed(2)}%`);
            }
          } else if (cellWidth > 25 && cellHeight > 20) {
            g.append('text')
              .attr('class', 'treemap-text ticker')
              .attr('x', cellWidth / 2)
              .attr('y', cellHeight / 2)
              .style('font-size', '10px')
              .text(d.data.name);
          }
        });
      }
    } catch (error) {
      console.error('Error drawing treemap:', error);
      const svg = d3.select('#treemap');
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', '50%')
        .attr('y', '50%')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ff4444')
        .attr('font-size', '16px')
        .text(`Error: ${error.message}`);
    }
  },

  /**
   * Show fundamentals panel for a ticker
   */
  async showFundamentals(ticker) {
    const panel = document.getElementById('fundamentalsPanel');
    const tickerEl = document.getElementById('fundamentalsTicker');
    const loadingEl = document.getElementById('fundamentalsLoading');
    const errorEl = document.getElementById('fundamentalsError');
    
    // Show panel and set ticker
    panel.style.display = 'flex';
    tickerEl.textContent = ticker;
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    
    // Clear previous data
    document.querySelectorAll('.fundamentals-table').forEach(table => {
      table.innerHTML = '';
    });
    
    // Initialize tab handlers if not already done
    if (!panel.dataset.initialized) {
      this.initializeFundamentalsPanel();
      panel.dataset.initialized = 'true';
    }
    
    // Load all fundamentals data
    try {
      const [balanceSheet, cashFlow, incomeStatement, ratios] = await Promise.all([
        window.electronAPI.polygonGetBalanceSheet(ticker, { timeframe: 'quarterly', limit: 4 }),
        window.electronAPI.polygonGetCashFlow(ticker, { timeframe: 'quarterly', limit: 4 }),
        window.electronAPI.polygonGetIncomeStatement(ticker, { timeframe: 'quarterly', limit: 4 }),
        window.electronAPI.polygonGetRatios(ticker)
      ]);
      
      console.log('Fundamentals data loaded:', { balanceSheet, cashFlow, incomeStatement, ratios });
      
      loadingEl.style.display = 'none';
      
      if (balanceSheet.success && balanceSheet.results && balanceSheet.results.length > 0) {
        this.renderBalanceSheet(balanceSheet.results);
      } else {
        console.warn('No balance sheet data available');
      }
      
      if (cashFlow.success && cashFlow.results && cashFlow.results.length > 0) {
        this.renderCashFlow(cashFlow.results);
      } else {
        console.warn('No cash flow data available');
      }
      
      if (incomeStatement.success && incomeStatement.results && incomeStatement.results.length > 0) {
        this.renderIncomeStatement(incomeStatement.results);
      } else {
        console.warn('No income statement data available');
      }
      
      if (ratios.success && ratios.results && ratios.results.length > 0) {
        this.renderRatios(ratios.results);
      } else {
        console.warn('No ratios data available');
      }
      
    } catch (error) {
      console.error('Error loading fundamentals:', error);
      loadingEl.style.display = 'none';
      errorEl.textContent = `Error loading fundamentals: ${error.message}`;
      errorEl.style.display = 'block';
    }
  },

  /**
   * Initialize fundamentals panel event handlers
   */
  initializeFundamentalsPanel() {
    // Tab switching
    document.querySelectorAll('.fundamentals-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.fundamentals-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Convert kebab-case to camelCase for ID (balance-sheet -> balanceSheet)
        const tabId = tabName.replace(/-./g, x => x[1].toUpperCase());
        
        // Update tab content
        document.querySelectorAll('.fundamentals-tab-content').forEach(c => c.classList.remove('active'));
        const targetTab = document.getElementById(`${tabId}Tab`);
        if (targetTab) {
          targetTab.classList.add('active');
        }
      });
    });
    
    // Close button
    document.getElementById('closeFundamentalsBtn').addEventListener('click', () => {
      document.getElementById('fundamentalsPanel').style.display = 'none';
    });
  },

  /**
   * Render balance sheet data
   */
  renderBalanceSheet(data) {
    if (!data || data.length === 0) return;
    
    const table = document.getElementById('balanceSheetTable');
    const periods = data.slice(0, 4).reverse(); // Show oldest to newest, max 4 quarters
    
    // Create header
    let html = '<thead><tr><th>Metric</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      html += `<th>${period.fiscal_year} Q${quarter}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Helper to format currency
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
    // Key metrics - using actual Polygon API field names
    const metrics = [
      { label: 'Total Assets', key: 'total_assets' },
      { label: 'Current Assets', key: 'total_current_assets' },
      { label: 'Cash & Equivalents', key: 'cash_and_equivalents' },
      { label: 'Total Liabilities', key: 'total_liabilities' },
      { label: 'Current Liabilities', key: 'total_current_liabilities' },
      { label: 'Long-term Debt', key: 'long_term_debt_and_capital_lease_obligations' },
      { label: 'Total Equity', key: 'total_equity' },
      { label: 'Retained Earnings', key: 'retained_earnings_deficit' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      periods.forEach(period => {
        const value = period[metric.key];
        html += `<td class="metric-value">${fmt(value)}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Render cash flow statement data
   */
  renderCashFlow(data) {
    if (!data || data.length === 0) return;
    
    const table = document.getElementById('cashFlowTable');
    const periods = data.slice(0, 4).reverse();
    
    let html = '<thead><tr><th>Metric</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      html += `<th>${period.fiscal_year} Q${quarter}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
    // Using actual Polygon API field names
    const metrics = [
      { label: 'Operating Cash Flow', key: 'net_cash_from_operating_activities' },
      { label: 'Investing Cash Flow', key: 'net_cash_from_investing_activities' },
      { label: 'Financing Cash Flow', key: 'net_cash_from_financing_activities' },
      { label: 'Net Cash Flow', key: 'net_cash_from_operating_activities' }, // Could calculate this
      { label: 'CapEx', key: 'purchase_of_property_plant_and_equipment' },
      { label: 'Dividends Paid', key: 'dividends' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      periods.forEach(period => {
        const value = period[metric.key];
        const cssClass = value < 0 ? 'negative-value' : 'positive-value';
        html += `<td class="metric-value ${cssClass}">${fmt(value)}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Render income statement data
   */
  renderIncomeStatement(data) {
    if (!data || data.length === 0) return;
    
    const table = document.getElementById('incomeStatementTable');
    const periods = data.slice(0, 4).reverse();
    
    let html = '<thead><tr><th>Metric</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      html += `<th>${period.fiscal_year} Q${quarter}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
    // Using actual Polygon API field names
    const metrics = [
      { label: 'Revenue', key: 'revenue' },
      { label: 'Cost of Revenue', key: 'cost_of_revenue' },
      { label: 'Gross Profit', key: 'gross_profit' },
      { label: 'Operating Expenses', key: 'total_operating_expenses' },
      { label: 'Operating Income', key: 'operating_income' },
      { label: 'Net Income', key: 'consolidated_net_income_loss' },
      { label: 'EPS (Basic)', key: 'basic_earnings_per_share', formatter: (v) => v != null ? `$${v.toFixed(2)}` : 'N/A' },
      { label: 'EPS (Diluted)', key: 'diluted_earnings_per_share', formatter: (v) => v != null ? `$${v.toFixed(2)}` : 'N/A' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      periods.forEach(period => {
        const value = period[metric.key];
        const formatted = metric.formatter ? metric.formatter(value) : fmt(value);
        const cssClass = value < 0 ? 'negative-value' : value > 0 ? 'positive-value' : '';
        html += `<td class="metric-value ${cssClass}">${formatted}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Render financial ratios
   */
  renderRatios(data) {
    if (!data || data.length === 0) return;
    
    const table = document.getElementById('ratiosTable');
    const latest = data[0];
    
    let html = '<thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
    
    // Calculate ratios from balance sheet and income statement data using actual Polygon field names
    const ratios = [
      { label: 'Current Ratio', value: latest.total_current_assets && latest.total_current_liabilities ? 
        (latest.total_current_assets / latest.total_current_liabilities).toFixed(2) : 'N/A' },
      { label: 'Quick Ratio', value: latest.total_current_assets && latest.inventories && latest.total_current_liabilities ? 
        ((latest.total_current_assets - latest.inventories) / latest.total_current_liabilities).toFixed(2) : 'N/A' },
      { label: 'Debt to Equity', value: latest.total_liabilities && latest.total_equity ? 
        (latest.total_liabilities / latest.total_equity).toFixed(2) : 'N/A' },
      { label: 'Return on Assets', value: latest.consolidated_net_income_loss && latest.total_assets ? 
        ((latest.consolidated_net_income_loss / latest.total_assets) * 100).toFixed(2) + '%' : 'N/A' },
      { label: 'Return on Equity', value: latest.consolidated_net_income_loss && latest.total_equity ? 
        ((latest.consolidated_net_income_loss / latest.total_equity) * 100).toFixed(2) + '%' : 'N/A' },
      { label: 'Gross Margin', value: latest.gross_profit && latest.revenue ? 
        ((latest.gross_profit / latest.revenue) * 100).toFixed(2) + '%' : 'N/A' },
      { label: 'Operating Margin', value: latest.operating_income && latest.revenue ? 
        ((latest.operating_income / latest.revenue) * 100).toFixed(2) + '%' : 'N/A' },
      { label: 'Net Margin', value: latest.consolidated_net_income_loss && latest.revenue ? 
        ((latest.consolidated_net_income_loss / latest.revenue) * 100).toFixed(2) + '%' : 'N/A' }
    ];
    
    ratios.forEach(ratio => {
      html += `<tr><td class="metric-label">${ratio.label}</td><td class="metric-value">${ratio.value}</td></tr>`;
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  }
};

// Export as ES6 module
export default PolygonTreemap;

// Expose to window for backward compatibility
window.PolygonTreemap = PolygonTreemap;
window.treemapData = treemapData;
window.updateLastUpdateDisplay = PolygonTreemap.updateLastUpdateDisplay.bind(PolygonTreemap);
window.drawTreemap = PolygonTreemap.drawTreemap.bind(PolygonTreemap);
// Use getter/setter for lastUpdateTime since it's a primitive that gets reassigned
Object.defineProperty(window, 'lastUpdateTime', {
  get: () => lastUpdateTime,
  set: (value) => { lastUpdateTime = value; }
});
