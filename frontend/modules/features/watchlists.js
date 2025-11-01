/**
 * Watchlists Module
 * Manage user watchlists for tracking stocks
 */

import { escapeHtml } from '../core/formatters.js';

// State
let watchlists = [];
let currentWatchlist = null;
let watchlistStockData = new Map();
let editingWatchlistId = null;

// Reference to main treemap data from polygon-treemap module
// This will be populated by the main treemap when it loads data
const treemapData = new Map();

// Load watchlists from localStorage
function loadWatchlists() {
  const stored = localStorage.getItem('watchlists');
  if (stored) {
    try {
      watchlists = JSON.parse(stored);
    } catch (error) {
      console.error('Error loading watchlists:', error);
      watchlists = [];
    }
  }
  displayWatchlists();
}

// Save watchlists to localStorage
function saveWatchlistsToStorage() {
  localStorage.setItem('watchlists', JSON.stringify(watchlists));
}

// Display watchlists in sidebar
function displayWatchlists() {
  const listEl = document.getElementById('watchlistsList');
  const searchQuery = document.getElementById('watchlistSearch')?.value.toLowerCase() || '';
  
  const filtered = watchlists.filter(w => 
    w.name.toLowerCase().includes(searchQuery) || 
    (w.description && w.description.toLowerCase().includes(searchQuery))
  );
  
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No watchlists ${searchQuery ? 'found' : 'yet'}</p>
        <p style="font-size: 12px; color: #666;">${searchQuery ? 'Try a different search' : 'Create your first watchlist'}</p>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = filtered.map(w => `
    <div class="watchlist-item ${currentWatchlist?.id === w.id ? 'active' : ''}" data-id="${w.id}">
      <div class="watchlist-item-name">${escapeHtml(w.name)}</div>
      <div class="watchlist-item-info">${w.tickers.length} stocks</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.watchlist-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectWatchlist(id);
    });
  });
}

// Select a watchlist
function selectWatchlist(id) {
  currentWatchlist = watchlists.find(w => w.id === id);
  if (!currentWatchlist) return;
  
  // Update UI
  displayWatchlists(); // Refresh active state
  document.getElementById('watchlistEmpty').style.display = 'none';
  document.getElementById('watchlistContent').style.display = 'flex';
  document.getElementById('watchlistTreemapView').style.display = 'none';
  
  document.getElementById('watchlistName').textContent = currentWatchlist.name;
  document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
  
  // Load stock data for this watchlist
  loadWatchlistStockData();
  displayWatchlistStocks();
}

// Load stock data for current watchlist
async function loadWatchlistStockData() {
  if (!currentWatchlist) return;
  
  console.log('[WATCHLISTS] Loading stock data for watchlist:', currentWatchlist.name);
  console.log('[WATCHLISTS] Tickers to load:', currentWatchlist.tickers);
  
  // Clear existing data for this watchlist
  watchlistStockData.clear();
  
  // Check if we can get data from the window-level polygon treemap data
  // This is populated by the main polygon-treemap module via websocket
  let foundCount = 0;
  currentWatchlist.tickers.forEach(ticker => {
    // Try to get from window.treemapData (exposed by polygon-treemap module)
    if (window.treemapData && window.treemapData.has(ticker)) {
      const data = window.treemapData.get(ticker);
      watchlistStockData.set(ticker, data);
      treemapData.set(ticker, data);
      foundCount++;
      console.log('[WATCHLISTS] Loaded data for', ticker, 'from treemap cache');
    }
  });
  
  console.log('[WATCHLISTS] Loaded', foundCount, 'of', currentWatchlist.tickers.length, 'stocks from cache');
  
  // For any tickers not found in cache, fetch them specifically
  const missingTickers = currentWatchlist.tickers.filter(ticker => !watchlistStockData.has(ticker));
  
  if (missingTickers.length > 0) {
    console.log('[WATCHLISTS] Fetching missing tickers:', missingTickers);
    try {
      if (window.electronAPI && window.electronAPI.polygonGetAllData) {
        // Electron mode - use IPC
        const allData = await window.electronAPI.polygonGetAllData();
        
        if (allData && Array.isArray(allData)) {
          allData.forEach(stock => {
            if (missingTickers.includes(stock.ticker)) {
              watchlistStockData.set(stock.ticker, stock);
              treemapData.set(stock.ticker, stock);
              foundCount++;
            }
          });
        }
        
        // For tickers still missing (not in S&P 500), fetch directly
        const stillMissing = missingTickers.filter(ticker => !watchlistStockData.has(ticker));
        if (stillMissing.length > 0) {
          console.log('[WATCHLISTS] Fetching non-S&P500 tickers:', stillMissing);
          const result = await window.electronAPI.polygonFetchTickers(stillMissing);
          
          if (result.success && result.data) {
            result.data.forEach(stock => {
              watchlistStockData.set(stock.ticker, stock);
              treemapData.set(stock.ticker, stock);
              foundCount++;
            });
            console.log('[WATCHLISTS] Fetched', result.data.length, 'additional tickers');
          }
        }
      } else {
        // Browser mode - use REST API
        const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
        if (!apiKey) {
          console.error('[WATCHLISTS] No API key available');
          return;
        }
        
        for (const ticker of missingTickers) {
          try {
            // Check treemapData first (already loaded from home page)
            if (treemapData.has(ticker)) {
              watchlistStockData.set(ticker, treemapData.get(ticker));
              foundCount++;
              continue;
            }
            
            // Fetch from Polygon API
            const response = await fetch(
              `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.results?.[0]) {
              const r = data.results[0];
              const stockData = {
                ticker,
                price: r.c,
                open: r.o,
                high: r.h,
                low: r.l,
                volume: r.v,
                change: r.c - r.o,
                changePercent: ((r.c - r.o) / r.o) * 100
              };
              
              watchlistStockData.set(ticker, stockData);
              treemapData.set(ticker, stockData);
              foundCount++;
            }
          } catch (err) {
            console.error(`[WATCHLISTS] Error fetching ${ticker}:`, err);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      console.log('[WATCHLISTS] Total loaded:', foundCount, 'of', currentWatchlist.tickers.length);
    } catch (error) {
      console.error('[WATCHLISTS] Error fetching tickers:', error);
    }
  }
  
  // Always refresh display (will show "Loading..." for missing stocks)
  displayWatchlistStocks();
}

// Display stocks in table
function displayWatchlistStocks() {
  const tbody = document.getElementById('watchlistTableBody');
  
  if (!currentWatchlist || currentWatchlist.tickers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
          No stocks in this watchlist. Click "Add Stock" to get started.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = currentWatchlist.tickers.map(ticker => {
    const data = watchlistStockData.get(ticker);
    
    if (!data) {
      return `
        <tr>
          <td class="stock-ticker">${ticker}</td>
          <td colspan="5" style="color: #666;">Loading...</td>
          <td><button class="remove-stock-btn" onclick="removeStockFromWatchlist('${ticker}')">Remove</button></td>
        </tr>
      `;
    }
    
    const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
    const changeSign = data.changePercent >= 0 ? '+' : '';
    
    return `
      <tr>
        <td class="stock-ticker">${ticker}</td>
        <td class="${changeClass}">$${data.close ? data.close.toFixed(2) : 'N/A'}</td>
        <td class="${changeClass}">${changeSign}${data.change ? data.change.toFixed(2) : '0.00'}</td>
        <td class="${changeClass}">${changeSign}${data.changePercent ? data.changePercent.toFixed(2) : '0.00'}%</td>
        <td>${data.volume ? (data.volume / 1000000).toFixed(1) + 'M' : 'N/A'}</td>
        <td class="${changeClass}">${data.marketCap ? '$' + (data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}</td>
        <td><button class="remove-stock-btn" onclick="removeStockFromWatchlist('${ticker}')">Remove</button></td>
      </tr>
    `;
  }).join('');
}

// Create watchlist modal
document.getElementById('createWatchlistBtn')?.addEventListener('click', () => {
  editingWatchlistId = null;
  document.getElementById('watchlistModalTitle').textContent = 'Create Watchlist';
  document.getElementById('watchlistNameInput').value = '';
  document.getElementById('watchlistDescInput').value = '';
  document.getElementById('watchlistModal').style.display = 'flex';
  document.getElementById('watchlistNameInput').focus();
});

// Edit watchlist
document.getElementById('editWatchlistBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  editingWatchlistId = currentWatchlist.id;
  document.getElementById('watchlistModalTitle').textContent = 'Edit Watchlist';
  document.getElementById('watchlistNameInput').value = currentWatchlist.name;
  document.getElementById('watchlistDescInput').value = currentWatchlist.description || '';
  document.getElementById('watchlistModal').style.display = 'flex';
  document.getElementById('watchlistNameInput').focus();
});

// Save watchlist
document.getElementById('saveWatchlistBtn')?.addEventListener('click', () => {
  const name = document.getElementById('watchlistNameInput').value.trim();
  const description = document.getElementById('watchlistDescInput').value.trim();
  
  if (!name) {
    alert('Please enter a watchlist name');
    return;
  }
  
  if (editingWatchlistId) {
    // Edit existing
    const watchlist = watchlists.find(w => w.id === editingWatchlistId);
    if (watchlist) {
      watchlist.name = name;
      watchlist.description = description;
    }
  } else {
    // Create new
    const newWatchlist = {
      id: Date.now().toString(),
      name: name,
      description: description,
      tickers: [],
      createdAt: Date.now()
    };
    watchlists.push(newWatchlist);
    currentWatchlist = newWatchlist;
    selectWatchlist(newWatchlist.id);
  }
  
  saveWatchlistsToStorage();
  displayWatchlists();
  document.getElementById('watchlistModal').style.display = 'none';
});

// Delete watchlist
document.getElementById('deleteWatchlistBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  if (confirm(`Are you sure you want to delete "${currentWatchlist.name}"?`)) {
    watchlists = watchlists.filter(w => w.id !== currentWatchlist.id);
    saveWatchlistsToStorage();
    currentWatchlist = null;
    
    document.getElementById('watchlistEmpty').style.display = 'flex';
    document.getElementById('watchlistContent').style.display = 'none';
    displayWatchlists();
  }
});

// Add stock modal
document.getElementById('addStockBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  document.getElementById('stockTickersInput').value = '';
  document.getElementById('addStockModal').style.display = 'flex';
  document.getElementById('stockTickersInput').focus();
});

// Add stocks to watchlist
document.getElementById('addStocksBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  const input = document.getElementById('stockTickersInput').value.trim();
  if (!input) {
    alert('Please enter at least one ticker symbol');
    return;
  }
  
  const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
  const newTickers = tickers.filter(t => !currentWatchlist.tickers.includes(t));
  
  if (newTickers.length === 0) {
    alert('All tickers are already in this watchlist');
    return;
  }
  
  currentWatchlist.tickers.push(...newTickers);
  saveWatchlistsToStorage();
  
  // Subscribe to new tickers in Polygon websocket
  if (window.electronAPI && window.electronAPI.polygonSubscribeTickers) {
    window.electronAPI.polygonSubscribeTickers(newTickers)
      .then(result => {
        if (result.success) {
          console.log('[WATCHLISTS] Subscribed to new tickers:', newTickers.join(', '));
        }
      })
      .catch(err => console.error('[WATCHLISTS] Error subscribing to tickers:', err));
  }
  
  document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
  loadWatchlistStockData();
  displayWatchlistStocks();
  displayWatchlists();
  
  document.getElementById('addStockModal').style.display = 'none';
});

// Remove stock from watchlist
window.removeStockFromWatchlist = function(ticker) {
  if (!currentWatchlist) return;
  
  if (confirm(`Remove ${ticker} from this watchlist?`)) {
    currentWatchlist.tickers = currentWatchlist.tickers.filter(t => t !== ticker);
    saveWatchlistsToStorage();
    
    document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
    watchlistStockData.delete(ticker);
    displayWatchlistStocks();
    displayWatchlists();
  }
};

// View watchlist as treemap
document.getElementById('viewTreemapBtn')?.addEventListener('click', () => {
  if (!currentWatchlist || currentWatchlist.tickers.length === 0) {
    alert('Add stocks to this watchlist first');
    return;
  }
  
  document.getElementById('watchlistContent').style.display = 'none';
  document.getElementById('watchlistTreemapView').style.display = 'flex';
  document.getElementById('treemapWatchlistName').textContent = currentWatchlist.name;
  
  setTimeout(() => drawWatchlistTreemap(), 100);
});

// Back to list
document.getElementById('backToListBtn')?.addEventListener('click', () => {
  document.getElementById('watchlistTreemapView').style.display = 'none';
  document.getElementById('watchlistContent').style.display = 'flex';
});

// Get color for percent change (same logic as polygon-treemap)
function getColorForPercent(percent) {
  if (percent === null || percent === undefined) return '#404040';
  
  // Use theme colors for positive (green) and negative (red)
  if (percent > 0) {
    const intensity = Math.min(Math.abs(percent) / 3, 1); // Cap at 3% for full intensity
    const baseColor = window.getPositiveColor ? window.getPositiveColor() : '#00aa55';
    
    // Darken the color based on intensity
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
  } else if (percent < 0) {
    const intensity = Math.min(Math.abs(percent) / 3, 1);
    const baseColor = window.getNegativeColor ? window.getNegativeColor() : '#e74c3c';
    
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
  }
  
  return '#404040'; // Zero or neutral
}

// Draw watchlist treemap
function drawWatchlistTreemap() {
  try {
    const container = document.getElementById('watchlistTreemapContainer');
    if (!container) return;
    
    const dataArray = Array.from(watchlistStockData.values()).filter(d => d.changePercent !== null);
    
    if (dataArray.length === 0) {
      const svg = d3.select('#watchlistTreemap');
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', '50%')
        .attr('y', '50%')
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '18px')
        .text('Loading watchlist data...');
      return;
    }
    
    d3.select('#watchlistTreemap').selectAll('*').remove();
    
    const width = container.clientWidth - 20;
    const height = container.clientHeight - 20;
    
    const svg = d3.select('#watchlistTreemap')
      .attr('width', width)
      .attr('height', height);
    
    const sizeBy = document.getElementById('watchlistTreemapSizeBy')?.value || 'marketcap';
    
    const root = d3.hierarchy({
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
    
    const treemap = d3.treemap()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .round(true);
    
    treemap(root);
    
    const cells = svg.selectAll('.stock-cell')
      .data(root.leaves())
      .join('g')
      .attr('class', 'stock-cell')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);
    
    cells.append('rect')
      .attr('class', 'treemap-cell')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => getColorForPercent(d.data.percent))
      .attr('rx', 2)
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
      
      if (cellWidth > 50 && cellHeight > 35) {
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
      } else if (cellWidth > 30 && cellHeight > 25) {
        g.append('text')
          .attr('class', 'treemap-text ticker')
          .attr('x', cellWidth / 2)
          .attr('y', cellHeight / 2)
          .style('font-size', '11px')
          .text(d.data.name);
      }
    });
    
    document.getElementById('watchlistLastUpdate').textContent = `${dataArray.length} stocks loaded`;
    document.getElementById('watchlistLastUpdate').style.color = '#00aa55';
    
  } catch (error) {
    console.error('Error drawing watchlist treemap:', error);
  }
}

// Watchlist treemap size selector
document.getElementById('watchlistTreemapSizeBy')?.addEventListener('change', () => {
  drawWatchlistTreemap();
});

// Search watchlists
document.getElementById('watchlistSearch')?.addEventListener('input', () => {
  displayWatchlists();
});

// Update watchlist stock data when main treemap updates (Electron only)
if (window.electronAPI && window.electronAPI.onPolygonUpdate) {
  const originalOnPolygonUpdate = window.electronAPI.onPolygonUpdate;
  window.electronAPI.onPolygonUpdate((data) => {
    // Call original handler
    treemapData.set(data.ticker, data);
    lastUpdateTime = new Date();
    updateLastUpdateDisplay();
  
  if (!window.treemapUpdateScheduled) {
    window.treemapUpdateScheduled = true;
    setTimeout(() => {
      drawTreemap();
      window.treemapUpdateScheduled = false;
    }, 5000);
  }
  
  // Update watchlist data if ticker is in current watchlist
  if (currentWatchlist && currentWatchlist.tickers.includes(data.ticker)) {
    watchlistStockData.set(data.ticker, data);
    
    // Update table if in list view
    if (document.getElementById('watchlistContent').style.display === 'flex') {
      displayWatchlistStocks();
    }
    
    // Update treemap if in treemap view
    if (document.getElementById('watchlistTreemapView').style.display === 'flex') {
      if (!window.watchlistTreemapUpdateScheduled) {
        window.watchlistTreemapUpdateScheduled = true;
        setTimeout(() => {
          drawWatchlistTreemap();
          window.watchlistTreemapUpdateScheduled = false;
        }, 5000);
      }
    }
  }
  
  // Update chart if this is the currently selected ticker
  if (currentChartTicker === data.ticker) {
    // Update live info panel
    updateChartLiveInfo(data.ticker);
    
    // Update chart ticker list if visible
    const tickerItem = document.querySelector(`.ticker-list-item[data-ticker="${data.ticker}"]`);
    if (tickerItem) {
      const priceEl = tickerItem.querySelector('.ticker-list-price');
      if (priceEl) {
        priceEl.textContent = `$${data.close.toFixed(2)}`;
        const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
        priceEl.className = `ticker-list-price ${changeClass}`;
      }
    }
    
    // Update live candle if enabled and chart is visible
    if (liveUpdateEnabled && currentChartData && document.getElementById('chartingPage').classList.contains('active')) {
      const now = Date.now();
      // Update chart every 30 seconds max to avoid too frequent redraws
      if (now - lastChartUpdate > 30000) {
        lastChartUpdate = now;
        
        // For intraday charts, we could append the latest data
        // For now, we'll just update the last bar with live data
        const interval = document.getElementById('chartInterval')?.value;
        if (interval !== 'day') {
          updateLiveCandle(data);
        }
      }
    }
  }
  });
}

/**
 * Initialize watchlist event listeners
 */
function initializeWatchlistEventListeners() {
  // Load watchlists from localStorage
  console.log('[WATCHLISTS] Loading watchlists from localStorage...');
  loadWatchlists();
  
  // Modal close handlers
  document.getElementById('cancelWatchlistBtn')?.addEventListener('click', () => {
    document.getElementById('watchlistModal').style.display = 'none';
  });

  document.getElementById('cancelAddStockBtn')?.addEventListener('click', () => {
    document.getElementById('addStockModal').style.display = 'none';
  });
}

// Export module
const WatchlistsModule = {
  loadWatchlists,
  saveWatchlistsToStorage,
  displayWatchlists,
  selectWatchlist,
  loadWatchlistStockData,
  displayWatchlistStocks,
  drawWatchlistTreemap,
  initializeWatchlistEventListeners,
  // State getters
  getWatchlists: () => watchlists,
  getCurrentWatchlist: () => currentWatchlist,
  getWatchlistStockData: () => watchlistStockData
};

export default WatchlistsModule;

// Listen for watchlist updates from other parts of the app
if (window.electronAPI && window.electronAPI.onWatchlistsUpdated) {
  window.electronAPI.onWatchlistsUpdated(() => {
    console.log('[WATCHLISTS] Received watchlists-updated event, reloading...');
    loadWatchlists();
  });
}

// Expose to window for backward compatibility
window.watchlists = watchlists;
window.currentWatchlist = currentWatchlist;
window.watchlistStockData = watchlistStockData;
window.loadWatchlists = loadWatchlists;
window.displayWatchlistStocks = displayWatchlistStocks;
