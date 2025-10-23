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
      console.log(`[RatiosPage] Loading ratios for ${ticker}`);
      
      const result = await window.electronAPI.polygonGetRatios(ticker);
      
      console.log('[RatiosPage] API Response:', {
        success: result.success,
        hasResults: !!result.results,
        count: result.results?.length
      });
      
      if (result.results && result.results.length > 0) {
        console.log('[RatiosPage] First result structure:', Object.keys(result.results[0]));
      }
      
      loadingEl.style.display = 'none';
      
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
    
    // Calculate all ratios
    const ratios = [
      // Liquidity Ratios
      {
        category: 'Liquidity',
        label: 'Current Ratio',
        value: data.total_current_assets && data.total_current_liabilities ? 
          (data.total_current_assets / data.total_current_liabilities).toFixed(2) : 'N/A',
        description: 'Ability to pay short-term obligations'
      },
      {
        category: 'Liquidity',
        label: 'Quick Ratio',
        value: data.total_current_assets && data.inventories && data.total_current_liabilities ? 
          ((data.total_current_assets - data.inventories) / data.total_current_liabilities).toFixed(2) : 'N/A',
        description: 'Ability to pay short-term debt without selling inventory'
      },
      {
        category: 'Liquidity',
        label: 'Cash Ratio',
        value: data.cash_and_equivalents && data.total_current_liabilities ? 
          (data.cash_and_equivalents / data.total_current_liabilities).toFixed(2) : 'N/A',
        description: 'Most conservative liquidity measure'
      },
      
      // Leverage Ratios
      {
        category: 'Leverage',
        label: 'Debt to Equity',
        value: data.total_liabilities && data.total_equity ? 
          (data.total_liabilities / data.total_equity).toFixed(2) : 'N/A',
        description: 'Financial leverage and risk'
      },
      {
        category: 'Leverage',
        label: 'Debt to Assets',
        value: data.total_liabilities && data.total_assets ? 
          ((data.total_liabilities / data.total_assets) * 100).toFixed(1) + '%' : 'N/A',
        description: 'Percentage of assets financed by debt'
      },
      {
        category: 'Leverage',
        label: 'Equity Multiplier',
        value: data.total_assets && data.total_equity ? 
          (data.total_assets / data.total_equity).toFixed(2) : 'N/A',
        description: 'Financial leverage ratio'
      },
      
      // Profitability Ratios
      {
        category: 'Profitability',
        label: 'Gross Margin',
        value: data.gross_profit && data.revenue ? 
          ((data.gross_profit / data.revenue) * 100).toFixed(1) + '%' : 'N/A',
        description: 'Profitability after cost of goods sold'
      },
      {
        category: 'Profitability',
        label: 'Operating Margin',
        value: data.operating_income && data.revenue ? 
          ((data.operating_income / data.revenue) * 100).toFixed(1) + '%' : 'N/A',
        description: 'Operating efficiency'
      },
      {
        category: 'Profitability',
        label: 'Net Margin',
        value: data.consolidated_net_income_loss && data.revenue ? 
          ((data.consolidated_net_income_loss / data.revenue) * 100).toFixed(1) + '%' : 'N/A',
        description: 'Bottom line profitability'
      },
      {
        category: 'Profitability',
        label: 'Return on Assets (ROA)',
        value: data.consolidated_net_income_loss && data.total_assets ? 
          ((data.consolidated_net_income_loss / data.total_assets) * 100).toFixed(1) + '%' : 'N/A',
        description: 'How efficiently assets generate profit'
      },
      {
        category: 'Profitability',
        label: 'Return on Equity (ROE)',
        value: data.consolidated_net_income_loss && data.total_equity ? 
          ((data.consolidated_net_income_loss / data.total_equity) * 100).toFixed(1) + '%' : 'N/A',
        description: 'Return generated on shareholders equity'
      },
      
      // Efficiency Ratios
      {
        category: 'Efficiency',
        label: 'Asset Turnover',
        value: data.revenue && data.total_assets ? 
          (data.revenue / data.total_assets).toFixed(2) : 'N/A',
        description: 'Revenue generated per dollar of assets'
      },
      {
        category: 'Efficiency',
        label: 'Inventory Turnover',
        value: data.cost_of_revenue && data.inventories ? 
          (data.cost_of_revenue / data.inventories).toFixed(2) : 'N/A',
        description: 'How quickly inventory is sold'
      },
      
      // Per Share Metrics
      {
        category: 'Per Share',
        label: 'EPS (Basic)',
        value: (data.basic_earnings_per_share != null && typeof data.basic_earnings_per_share === 'number') ? 
          `$${data.basic_earnings_per_share.toFixed(2)}` : 'N/A',
        description: 'Earnings per share (basic)'
      },
      {
        category: 'Per Share',
        label: 'EPS (Diluted)',
        value: (data.diluted_earnings_per_share != null && typeof data.diluted_earnings_per_share === 'number') ? 
          `$${data.diluted_earnings_per_share.toFixed(2)}` : 'N/A',
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
