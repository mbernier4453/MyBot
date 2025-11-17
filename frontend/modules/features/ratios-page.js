/**
 * Ratios Page Module
 * Displays financial ratios and metrics
 */

import tickerGroups from '../core/ticker-groups.js';

const RatiosPage = {
  currentTickers: [],
  currentTickerIndex: 0,
  currentGroup: 'None',
  groupSubscription: null, // Store subscription callback for cleanup

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
        const oldGroup = this.currentGroup;
        this.currentGroup = e.target.value;
        
        // Unsubscribe from old group
        if (oldGroup !== 'None' && this.groupSubscription) {
          tickerGroups.unsubscribe(oldGroup, this.groupSubscription);
          this.groupSubscription = null;
        }
        
        if (this.currentGroup !== 'None') {
          tickerGroups.setActiveGroup(this.currentGroup);
          
          // Create subscription callback for new group
          this.groupSubscription = (ticker) => {
            const input = document.getElementById('ratiosTickerInput');
            if (input && input.value !== ticker) {
              console.log('[RATIOS] Group', this.currentGroup, 'changed to ticker', ticker);
              input.value = ticker;
              this.loadRatios(ticker);
            }
          };
          
          // Subscribe to new group
          tickerGroups.subscribe(this.currentGroup, this.groupSubscription);
          
          // Load ticker for this group if it exists
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
      const watchlistId = e.target.value;
      if (watchlistId && this.watchlistsData) {
        const watchlist = this.watchlistsData.find(w => (w.id || w.name) === watchlistId);
        if (watchlist && watchlist.tickers && watchlist.tickers.length > 0) {
          this.currentTickers = [...watchlist.tickers];
          this.currentTickerIndex = 0;
          document.getElementById('ratiosTickerInput').value = this.currentTickers.join(', ');
          this.loadRatios(this.currentTickers[0]);
        }
      }
    });
    
    // Timeframe selector
    document.getElementById('ratiosTimeframeSelect')?.addEventListener('change', (e) => {
      if (this.currentTickers && this.currentTickers.length > 0) {
        this.loadRatios(this.currentTickers[this.currentTickerIndex]);
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
    
    try {
      // Load watchlists from localStorage (same as chart-tabs.js)
      const stored = localStorage.getItem('watchlists');
      let watchlists = [];
      
      if (stored) {
        try {
          watchlists = JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing watchlists from localStorage:', error);
        }
      }
      
      // Clear and repopulate
      select.innerHTML = '<option value="">-- Select Watchlist --</option>';
      
      if (Array.isArray(watchlists) && watchlists.length > 0) {
        watchlists.forEach(w => {
          const option = document.createElement('option');
          option.value = w.id || w.name;
          option.textContent = `${w.name} (${w.tickers.length} stocks)`;
          select.appendChild(option);
        });
        
        // Store watchlists for later use
        this.watchlistsData = watchlists;
      } else {
        select.innerHTML = '<option value="">No watchlists found</option>';
      }
    } catch (error) {
      console.error('Error loading watchlists:', error);
      select.innerHTML = '<option value="">Error loading watchlists</option>';
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
    const timeframeSelect = document.getElementById('ratiosTimeframeSelect');
    
    // Get selected timeframe
    const timeframe = timeframeSelect?.value || 'quarterly';
    const limit = timeframe === 'quarterly' ? 20 : 10; // 5 years quarterly or 10 years annual
    
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
      const result = await window.electronAPI.polygonGetRatios(ticker, { limit, timeframe });
      loadingEl.style.display = 'none';
      
      if (result.success && result.results && result.results.length > 0) {
        this.renderRatios(result.results, timeframe);
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
   * Render ratios with historical bar charts
   */
  renderRatios(periods, timeframe) {
    const contentEl = document.getElementById('ratiosPageContent');
    
    // Helper to extract numeric value from Polygon API nested structure
    const getVal = (field) => field?.value ?? field ?? null;
    
    // Calculate all ratios for all periods
    const calculateRatio = (period, formula) => {
      const data = {
        ...period.financials?.balance_sheet,
        ...period.financials?.income_statement,
        ...period.financials?.cash_flow_statement
      };
      return formula(data);
    };
    
    // Define all ratio calculations
    const ratioDefinitions = [
      // Liquidity Ratios
      {
        category: 'Liquidity',
        label: 'Current Ratio',
        formula: (data) => {
          const ca = getVal(data.current_assets);
          const cl = getVal(data.current_liabilities);
          return (ca && cl) ? ca / cl : null;
        },
        description: 'Ability to pay short-term obligations',
        suffix: ''
      },
      {
        category: 'Liquidity',
        label: 'Quick Ratio',
        formula: (data) => {
          const ca = getVal(data.current_assets);
          const inv = getVal(data.inventory);
          const cl = getVal(data.current_liabilities);
          return (ca && cl) ? (ca - (inv || 0)) / cl : null;
        },
        description: 'Ability to pay short-term debt without selling inventory',
        suffix: ''
      },
      {
        category: 'Liquidity',
        label: 'Cash Ratio',
        formula: (data) => {
          const cash = getVal(data.cash);
          const cl = getVal(data.current_liabilities);
          return (cash && cl) ? cash / cl : null;
        },
        description: 'Most conservative liquidity measure',
        suffix: ''
      },
      
      // Leverage Ratios
      {
        category: 'Leverage',
        label: 'Debt to Equity',
        formula: (data) => {
          const liab = getVal(data.liabilities);
          const eq = getVal(data.equity);
          return (liab && eq) ? liab / eq : null;
        },
        description: 'Financial leverage and risk',
        suffix: ''
      },
      {
        category: 'Leverage',
        label: 'Debt to Assets',
        formula: (data) => {
          const liab = getVal(data.liabilities);
          const assets = getVal(data.assets);
          return (liab && assets) ? (liab / assets) * 100 : null;
        },
        description: 'Percentage of assets financed by debt',
        suffix: '%'
      },
      {
        category: 'Leverage',
        label: 'Equity Multiplier',
        formula: (data) => {
          const assets = getVal(data.assets);
          const eq = getVal(data.equity);
          return (assets && eq) ? assets / eq : null;
        },
        description: 'Financial leverage ratio',
        suffix: ''
      },
      
      // Profitability Ratios
      {
        category: 'Profitability',
        label: 'Gross Margin',
        formula: (data) => {
          const gp = getVal(data.gross_profit);
          const rev = getVal(data.revenues);
          return (gp && rev) ? (gp / rev) * 100 : null;
        },
        description: 'Profitability after cost of goods sold',
        suffix: '%'
      },
      {
        category: 'Profitability',
        label: 'Operating Margin',
        formula: (data) => {
          const oi = getVal(data.operating_income_loss);
          const rev = getVal(data.revenues);
          return (oi && rev) ? (oi / rev) * 100 : null;
        },
        description: 'Operating efficiency',
        suffix: '%'
      },
      {
        category: 'Profitability',
        label: 'Net Margin',
        formula: (data) => {
          const ni = getVal(data.net_income_loss);
          const rev = getVal(data.revenues);
          return (ni && rev) ? (ni / rev) * 100 : null;
        },
        description: 'Bottom line profitability',
        suffix: '%'
      },
      {
        category: 'Profitability',
        label: 'Return on Assets (ROA)',
        formula: (data) => {
          const ni = getVal(data.net_income_loss);
          const assets = getVal(data.assets);
          return (ni && assets) ? (ni / assets) * 100 : null;
        },
        description: 'How efficiently assets generate profit',
        suffix: '%'
      },
      {
        category: 'Profitability',
        label: 'Return on Equity (ROE)',
        formula: (data) => {
          const ni = getVal(data.net_income_loss);
          const eq = getVal(data.equity);
          return (ni && eq) ? (ni / eq) * 100 : null;
        },
        description: 'Return generated on shareholders equity',
        suffix: '%'
      },
      
      // Efficiency Ratios
      {
        category: 'Efficiency',
        label: 'Asset Turnover',
        formula: (data) => {
          const rev = getVal(data.revenues);
          const assets = getVal(data.assets);
          return (rev && assets) ? rev / assets : null;
        },
        description: 'Revenue generated per dollar of assets',
        suffix: ''
      },
      {
        category: 'Efficiency',
        label: 'Inventory Turnover',
        formula: (data) => {
          const cor = getVal(data.cost_of_revenue);
          const inv = getVal(data.inventory);
          return (cor && inv) ? cor / inv : null;
        },
        description: 'How quickly inventory is sold',
        suffix: ''
      },
      
      // Per Share Metrics
      {
        category: 'Per Share',
        label: 'EPS (Basic)',
        formula: (data) => {
          const eps = getVal(data.basic_earnings_per_share);
          return (eps != null && typeof eps === 'number') ? eps : null;
        },
        description: 'Earnings per share (basic)',
        suffix: '$',
        isPrefix: true
      },
      {
        category: 'Per Share',
        label: 'EPS (Diluted)',
        formula: (data) => {
          const eps = getVal(data.diluted_earnings_per_share);
          return (eps != null && typeof eps === 'number') ? eps : null;
        },
        description: 'Earnings per share (diluted)',
        suffix: '$',
        isPrefix: true
      }
    ];
    
    // Calculate historical values for each ratio
    const ratios = ratioDefinitions.map(def => {
      const values = periods.map(period => calculateRatio(period, def.formula));
      const labels = periods.map(period => {
        const date = new Date(period.end_date || period.filing_date);
        const year = date.getFullYear();
        
        if (timeframe === 'annual') {
          // For annual: just show year
          return year.toString();
        } else {
          // For quarterly: Q# 'YY
          const yearShort = year.toString().slice(-2);
          const quarter = period.fiscal_period || 'Q' + Math.ceil((date.getMonth() + 1) / 3);
          return `${quarter} '${yearShort}`;
        }
      });
      
      return {
        ...def,
        values: values,
        labels: labels
      };
    });
    
    // Render ratio cards with bar charts
    let html = '';
    ratios.forEach(ratio => {
      // Get the most recent value
      const latestValue = ratio.values.find(v => v !== null);
      const displayValue = latestValue !== null && latestValue !== undefined
        ? (ratio.isPrefix ? `${ratio.suffix}${latestValue.toFixed(2)}` : `${latestValue.toFixed(2)}${ratio.suffix}`)
        : 'N/A';
      
      html += `
        <div class="ratio-card">
          <div class="ratio-category">${ratio.category}</div>
          <div class="ratio-label">${ratio.label}</div>
          <div class="ratio-value">${displayValue}</div>
          <div class="ratio-description">${ratio.description}</div>
          <div class="ratio-chart-container">
            <canvas class="ratio-chart" data-ratio="${ratio.label}"></canvas>
          </div>
        </div>
      `;
    });
    
    contentEl.innerHTML = html;
    
    // Render charts after DOM is updated
    setTimeout(() => {
      ratios.forEach(ratio => {
        const canvas = contentEl.querySelector(`canvas[data-ratio="${ratio.label}"]`);
        if (canvas) {
          this.renderBarChart(canvas, ratio.values, ratio.labels, timeframe);
        }
      });
    }, 0);
  },
  
  /**
   * Render a bar chart on canvas
   */
  renderBarChart(canvas, values, labels, timeframe) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size - make it bigger
    const width = canvas.offsetWidth;
    const height = 150; // Increased from 80
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    // Get colors from CSS variables - fallback to ensure visibility
    const rootStyles = getComputedStyle(document.documentElement);
    const positiveColor = rootStyles.getPropertyValue('--positive').trim() || '#00cc55';
    const negativeColor = rootStyles.getPropertyValue('--negative').trim() || '#ff4444';
    let textColor = rootStyles.getPropertyValue('--text-primary').trim();
    
    // Ensure text color is valid and visible (not black on black)
    if (!textColor || textColor === '#000000' || textColor === 'black') {
      textColor = '#e0e0e0'; // Default to light gray
    }
    
    // Filter out null values
    const validIndices = values.map((v, i) => v !== null ? i : null).filter(i => i !== null);
    const validValues = validIndices.map(i => values[i]);
    const validLabels = validIndices.map(i => labels[i]);
    
    if (validValues.length === 0) {
      // No data to render
      ctx.fillStyle = textColor;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', width / 2, height / 2);
      return;
    }
    
    // Calculate min/max for scaling
    const minValue = Math.min(...validValues);
    const maxValue = Math.max(...validValues);
    const range = maxValue - minValue;
    const padding = { top: 15, bottom: 30, left: 5, right: 5 }; // Increased for bigger chart
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = (width - padding.left - padding.right) / validValues.length;
    
    // Draw bars
    validValues.forEach((value, i) => {
      const x = padding.left + i * barWidth;
      const barHeight = range !== 0 ? ((value - minValue) / range) * chartHeight : chartHeight / 2;
      const y = padding.top + chartHeight - barHeight;
      
      // Choose color based on value
      ctx.fillStyle = value >= 0 ? positiveColor : negativeColor;
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    });
    
    // Draw zero line if range crosses zero
    if (minValue < 0 && maxValue > 0) {
      const zeroY = padding.top + chartHeight * (maxValue / range);
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw labels - larger font for bigger chart
    ctx.fillStyle = textColor;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    
    // For quarterly data with 20 periods, show every 3rd label to avoid crowding
    // For annual data with 10 periods, show every other label
    const labelInterval = timeframe === 'quarterly' ? 3 : 2;
    
    validLabels.forEach((label, i) => {
      if (i % labelInterval === 0 || i === validLabels.length - 1) {
        const x = padding.left + i * barWidth + barWidth / 2;
        ctx.fillText(label, x, height - 8);
      }
    });
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
