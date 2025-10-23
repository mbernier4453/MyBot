/**
 * Ratios Page Module
 * Displays financial ratios and metrics
 */

import tickerGroups from '../core/ticker-groups.js';

const RatiosPage = {
  currentTicker: null,
  currentGroup: 'A',

  /**
   * Initialize the ratios page
   */
  initialize() {
    // Group selector
    const groupSelect = document.getElementById('ratiosGroupSelect');
    if (groupSelect) {
      groupSelect.value = tickerGroups.getActiveGroup();
      this.currentGroup = tickerGroups.getActiveGroup();
      
      groupSelect.addEventListener('change', (e) => {
        this.currentGroup = e.target.value;
        tickerGroups.setActiveGroup(this.currentGroup);
        
        // Load ticker for this group if it exists
        const ticker = tickerGroups.getGroupTicker(this.currentGroup);
        if (ticker) {
          document.getElementById('ratiosTickerInput').value = ticker;
          // Don't auto-load on group switch, just populate the input
        } else {
          document.getElementById('ratiosTickerInput').value = '';
        }
      });
    }
    
    // Subscribe to ticker changes for current group
    tickerGroups.subscribe(this.currentGroup, (ticker) => {
      const input = document.getElementById('ratiosTickerInput');
      if (input && input.value !== ticker) {
        input.value = ticker;
        this.loadRatios(ticker);
      }
    });
    
    // Load button
    document.getElementById('loadRatiosBtn')?.addEventListener('click', () => {
      const ticker = document.getElementById('ratiosTickerInput').value.trim().toUpperCase();
      if (ticker) {
        tickerGroups.setGroupTicker(this.currentGroup, ticker);
        this.loadRatios(ticker);
      }
    });

    // Enter key on input
    document.getElementById('ratiosTickerInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const ticker = e.target.value.trim().toUpperCase();
        if (ticker) {
          tickerGroups.setGroupTicker(this.currentGroup, ticker);
          this.loadRatios(ticker);
        }
      }
    });
  },

  /**
   * Load ratios for a ticker
   */
  async loadRatios(ticker) {
    this.currentTicker = ticker;
    
    const dataSection = document.getElementById('ratiosDataSection');
    const tickerEl = document.getElementById('ratiosPageTicker');
    const loadingEl = document.getElementById('ratiosPageLoading');
    const errorEl = document.getElementById('ratiosPageError');
    const contentEl = document.getElementById('ratiosPageContent');
    
    // Show section
    dataSection.style.display = 'block';
    tickerEl.textContent = ticker;
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

export default RatiosPage;
window.RatiosPage = RatiosPage;
