/**
 * Ratios Page Module
 * Displays financial ratios and metrics
 */

import tickerGroups from '../core/ticker-groups.js';

const RatiosPage = {
  currentTickers: [],
  currentTickerIndex: 0,
  currentGroup: 'None',

  /**
   * Initialize the ratios page
   */
  initialize() {
    // Populate watchlist selector
    this.populateWatchlistSelector();
    
    // Group selector
    const groupSelect = document.getElementById('ratiosGroupSelect');
    if (groupSelect) {
      groupSelect.value = 'None';
      this.currentGroup = 'None';
      
      groupSelect.addEventListener('change', (e) => {
        this.currentGroup = e.target.value;
        if (this.currentGroup !== 'None') {
          tickerGroups.setActiveGroup(this.currentGroup);
        }
        
        // Load ticker for this group if it exists
        if (this.currentGroup !== 'None') {
          const ticker = tickerGroups.getGroupTicker(this.currentGroup);
          if (ticker) {
            document.getElementById('ratiosTickerInput').value = ticker;
            // Don't auto-load on group switch, just populate the input
          } else {
            document.getElementById('ratiosTickerInput').value = '';
          }
        } else {
          document.getElementById('ratiosTickerInput').value = '';
        }
      });
    }
    
    // Subscribe to ticker changes for current group (only if not None)
    if (this.currentGroup !== 'None') {
      tickerGroups.subscribe(this.currentGroup, (ticker) => {
        const input = document.getElementById('ratiosTickerInput');
        if (input && input.value !== ticker) {
          input.value = ticker;
          this.loadRatios(ticker);
        }
      });
    }
    
    // Load button
    document.getElementById('loadRatiosBtn')?.addEventListener('click', () => {
      const input = document.getElementById('ratiosTickerInput').value.trim().toUpperCase();
      const tickers = input.split(',').map(t => t.trim()).filter(t => t);
      if (tickers.length > 0) {
        this.currentTickers = tickers;
        this.currentTickerIndex = 0;
        if (this.currentGroup !== 'None') {
          tickerGroups.setGroupTicker(this.currentGroup, tickers[0]);
        }
        this.loadRatios(tickers[0]);
      }
    });

    // Enter key on input
    document.getElementById('ratiosTickerInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const input = e.target.value.trim().toUpperCase();
        const tickers = input.split(',').map(t => t.trim()).filter(t => t);
        if (tickers.length > 0) {
          this.currentTickers = tickers;
          this.currentTickerIndex = 0;
          if (this.currentGroup !== 'None') {
            tickerGroups.setGroupTicker(this.currentGroup, tickers[0]);
          }
          this.loadRatios(tickers[0]);
        }
      }
    });
    
    // Watchlist selector
    document.getElementById('ratiosWatchlistSelect')?.addEventListener('change', (e) => {
      const watchlistId = parseInt(e.target.value);
      if (watchlistId && this.watchlistsData) {
        const watchlist = this.watchlistsData.find(w => w.id === watchlistId);
        if (watchlist) {
          const tickers = JSON.parse(watchlist.tickers_json || '[]');
          if (tickers.length > 0) {
            this.currentTickers = [...tickers];
            this.currentTickerIndex = 0;
            document.getElementById('ratiosTickerInput').value = this.currentTickers.join(', ');
            this.loadRatios(this.currentTickers[0]);
          }
        }
      }
    });
    
    // Ticker navigation buttons
    document.getElementById('ratiosPrevBtn')?.addEventListener('click', () => {
      if (this.currentTickerIndex > 0) {
        this.currentTickerIndex--;
        this.loadRatios(this.currentTickers[this.currentTickerIndex]);
      }
    });
    
    document.getElementById('ratiosNextBtn')?.addEventListener('click', () => {
      if (this.currentTickerIndex < this.currentTickers.length - 1) {
        this.currentTickerIndex++;
        this.loadRatios(this.currentTickers[this.currentTickerIndex]);
      }
    });
  },

  /**
   * Populate watchlist selector
   */
  async populateWatchlistSelector() {
    const select = document.getElementById('ratiosWatchlistSelect');
    if (!select) return;
    
    // Get watchlists from backend via IPC
    try {
      const result = await window.electronAPI.getWatchlists();
      if (result.success) {
        const watchlists = result.watchlists;
        
        // Clear and repopulate
        select.innerHTML = '<option value="">-- Select Watchlist --</option>';
        watchlists.forEach(w => {
          const tickers = JSON.parse(w.tickers_json || '[]');
          const option = document.createElement('option');
          option.value = w.id;
          option.textContent = `${w.name} (${tickers.length} stocks)`;
          select.appendChild(option);
        });
        
        // Store watchlists for later use
        this.watchlistsData = watchlists;
      }
    } catch (error) {
      console.error('Error loading watchlists:', error);
    }
  },

  /**
   * Load ratios for a ticker
   */
  async loadRatios(ticker) {
    
    const dataSection = document.getElementById('ratiosDataSection');
    const tickerEl = document.getElementById('ratiosPageTicker');
    const loadingEl = document.getElementById('ratiosPageLoading');
    const errorEl = document.getElementById('ratiosPageError');
    const contentEl = document.getElementById('ratiosPageContent');
    const prevBtn = document.getElementById('ratiosPrevBtn');
    const nextBtn = document.getElementById('ratiosNextBtn');
    
    // Show section and update ticker display
    dataSection.style.display = 'block';
    
    // Show ticker count and navigation buttons if multiple tickers
    if (this.currentTickers.length > 1) {
      tickerEl.textContent = `${ticker} (${this.currentTickerIndex + 1}/${this.currentTickers.length})`;
      prevBtn.style.display = 'inline-block';
      nextBtn.style.display = 'inline-block';
      prevBtn.disabled = this.currentTickerIndex === 0;
      nextBtn.disabled = this.currentTickerIndex === this.currentTickers.length - 1;
    } else {
      tickerEl.textContent = ticker;
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
    
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.innerHTML = '';
    
      try {
        const result = await window.electronAPI.polygonGetRatios(ticker);      loadingEl.style.display = 'none';
      
      if (result.success && result.results && result.results.length > 0) {
        this.renderRatios(result.results[0]);
      } else {
        errorEl.textContent = 'No ratio data available for this ticker';
        errorEl.style.display = 'block';
      }
      
    } catch (error) {
      console.error('Error loading ratios:', error);
      loadingEl.style.display = 'none';
      errorEl.textContent = `Error: ${error.message}`;
      errorEl.style.display = 'block';
    }
  },

  /**
   * Render ratios in cards
   */
  renderRatios(data) {
    const contentEl = document.getElementById('ratiosPageContent');
    
    // Helper to extract numeric value from Polygon API nested structure
    const getVal = (field) => field?.value ?? field ?? null;
    
    // Calculate all ratios
    const ratios = [
      // Liquidity Ratios
      {
        category: 'Liquidity',
        label: 'Current Ratio',
        value: (() => {
          const ca = getVal(data.current_assets);
          const cl = getVal(data.current_liabilities);
          return (ca && cl) ? (ca / cl).toFixed(2) : 'N/A';
        })(),
        description: 'Ability to pay short-term obligations'
      },
      {
        category: 'Liquidity',
        label: 'Quick Ratio',
        value: (() => {
          const ca = getVal(data.current_assets);
          const inv = getVal(data.inventory);
          const cl = getVal(data.current_liabilities);
          return (ca && cl) ? ((ca - (inv || 0)) / cl).toFixed(2) : 'N/A';
        })(),
        description: 'Ability to pay short-term debt without selling inventory'
      },
      {
        category: 'Liquidity',
        label: 'Cash Ratio',
        value: (() => {
          const cash = getVal(data.cash);
          const cl = getVal(data.current_liabilities);
          return (cash && cl) ? (cash / cl).toFixed(2) : 'N/A';
        })(),
        description: 'Most conservative liquidity measure'
      },
      
      // Leverage Ratios
      {
        category: 'Leverage',
        label: 'Debt to Equity',
        value: (() => {
          const liab = getVal(data.liabilities);
          const eq = getVal(data.equity);
          return (liab && eq) ? (liab / eq).toFixed(2) : 'N/A';
        })(),
        description: 'Financial leverage and risk'
      },
      {
        category: 'Leverage',
        label: 'Debt to Assets',
        value: (() => {
          const liab = getVal(data.liabilities);
          const assets = getVal(data.assets);
          return (liab && assets) ? ((liab / assets) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'Percentage of assets financed by debt'
      },
      {
        category: 'Leverage',
        label: 'Equity Multiplier',
        value: (() => {
          const assets = getVal(data.assets);
          const eq = getVal(data.equity);
          return (assets && eq) ? (assets / eq).toFixed(2) : 'N/A';
        })(),
        description: 'Financial leverage ratio'
      },
      
      // Profitability Ratios
      {
        category: 'Profitability',
        label: 'Gross Margin',
        value: (() => {
          const gp = getVal(data.gross_profit);
          const rev = getVal(data.revenues);
          return (gp && rev) ? ((gp / rev) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'Profitability after cost of goods sold'
      },
      {
        category: 'Profitability',
        label: 'Operating Margin',
        value: (() => {
          const oi = getVal(data.operating_income_loss);
          const rev = getVal(data.revenues);
          return (oi && rev) ? ((oi / rev) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'Operating efficiency'
      },
      {
        category: 'Profitability',
        label: 'Net Margin',
        value: (() => {
          const ni = getVal(data.net_income_loss);
          const rev = getVal(data.revenues);
          return (ni && rev) ? ((ni / rev) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'Bottom line profitability'
      },
      {
        category: 'Profitability',
        label: 'Return on Assets (ROA)',
        value: (() => {
          const ni = getVal(data.net_income_loss);
          const assets = getVal(data.assets);
          return (ni && assets) ? ((ni / assets) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'How efficiently assets generate profit'
      },
      {
        category: 'Profitability',
        label: 'Return on Equity (ROE)',
        value: (() => {
          const ni = getVal(data.net_income_loss);
          const eq = getVal(data.equity);
          return (ni && eq) ? ((ni / eq) * 100).toFixed(1) + '%' : 'N/A';
        })(),
        description: 'Return generated on shareholders equity'
      },
      
      // Efficiency Ratios
      {
        category: 'Efficiency',
        label: 'Asset Turnover',
        value: (() => {
          const rev = getVal(data.revenues);
          const assets = getVal(data.assets);
          return (rev && assets) ? (rev / assets).toFixed(2) : 'N/A';
        })(),
        description: 'Revenue generated per dollar of assets'
      },
      {
        category: 'Efficiency',
        label: 'Inventory Turnover',
        value: (() => {
          const cor = getVal(data.cost_of_revenue);
          const inv = getVal(data.inventory);
          return (cor && inv) ? (cor / inv).toFixed(2) : 'N/A';
        })(),
        description: 'How quickly inventory is sold'
      },
      
      // Per Share Metrics
      {
        category: 'Per Share',
        label: 'EPS (Basic)',
        value: (() => {
          const eps = getVal(data.basic_earnings_per_share);
          return (eps != null && typeof eps === 'number') ? `$${eps.toFixed(2)}` : 'N/A';
        })(),
        description: 'Earnings per share (basic)'
      },
      {
        category: 'Per Share',
        label: 'EPS (Diluted)',
        value: (() => {
          const eps = getVal(data.diluted_earnings_per_share);
          return (eps != null && typeof eps === 'number') ? `$${eps.toFixed(2)}` : 'N/A';
        })(),
        description: 'Earnings per share (diluted)'
      }
    ];
    
    // Render ratio cards
    let html = '';
    ratios.forEach(ratio => {
      html += `
        <div class="ratio-card">
          <div class="ratio-category">${ratio.category}</div>
          <div class="ratio-label">${ratio.label}</div>
          <div class="ratio-value">${ratio.value}</div>
          <div class="ratio-description">${ratio.description}</div>
        </div>
      `;
    });
    
    contentEl.innerHTML = html;
  }
};

// Listen for watchlist updates
if (window.electronAPI && window.electronAPI.onWatchlistsUpdated) {
  window.electronAPI.onWatchlistsUpdated(() => {
    console.log('[RATIOS] Watchlists updated, repopulating selector...');
    RatiosPage.populateWatchlistSelector();
  });
}

export default RatiosPage;
window.RatiosPage = RatiosPage;
