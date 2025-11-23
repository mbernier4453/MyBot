/**
 * Financials Page Module
 * Displays detailed financial statements
 */

import tickerGroups from '../core/ticker-groups.js';

const FinancialsPage = {
  currentTickers: [],
  currentTimeframe: 'quarterly',
  currentGroup: 'None',
  currentTickerIndex: 0,
  currentData: null, // Store current data for export
  groupSubscription: null, // Store subscription callback for cleanup

  /**
   * Initialize the financials page
   */
  initialize() {
    // Populate watchlist selector
    this.populateWatchlistSelector();
    
    // Group selector
    const groupSelect = document.getElementById('financialsGroupSelect');
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
            const input = document.getElementById('financialsTickerInput');
            if (input && input.value !== ticker) {
              console.log('[FINANCIALS] Group', this.currentGroup, 'changed to ticker', ticker);
              input.value = ticker;
              this.currentTickers = [ticker];
              this.currentTickerIndex = 0;
              this.loadFinancials(ticker);
            }
          };
          
          // Subscribe to new group
          tickerGroups.subscribe(this.currentGroup, this.groupSubscription);
          
          // Load ticker for this group if it exists
          const ticker = tickerGroups.getGroupTicker(this.currentGroup);
          if (ticker) {
            document.getElementById('financialsTickerInput').value = ticker;
            // Don't auto-load on group switch, just populate the input
          } else {
            document.getElementById('financialsTickerInput').value = '';
          }
        } else {
          document.getElementById('financialsTickerInput').value = '';
        }
      });
    }
    
    // Load button
    document.getElementById('loadFinancialsBtn')?.addEventListener('click', () => {
      const input = document.getElementById('financialsTickerInput').value.trim().toUpperCase();
      const tickers = input.split(',').map(t => t.trim()).filter(t => t);
      if (tickers.length > 0) {
        this.currentTickers = tickers;
        this.currentTickerIndex = 0;
        if (this.currentGroup !== 'None') {
          tickerGroups.setGroupTicker(this.currentGroup, tickers[0]);
        }
        this.loadFinancials(tickers[0]);
      }
    });

    // Enter key on input
    document.getElementById('financialsTickerInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const input = e.target.value.trim().toUpperCase();
        const tickers = input.split(',').map(t => t.trim()).filter(t => t);
        if (tickers.length > 0) {
          this.currentTickers = tickers;
          this.currentTickerIndex = 0;
          if (this.currentGroup !== 'None') {
            tickerGroups.setGroupTicker(this.currentGroup, tickers[0]);
          }
          this.loadFinancials(tickers[0]);
        }
      }
    });

    // Timeframe selector
    document.querySelectorAll('input[name="financialsTimeframe"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        console.log('[FINANCIALS] Timeframe changed to:', e.target.value);
        this.currentTimeframe = e.target.value;
        if (this.currentTickers.length > 0) {
          console.log('[FINANCIALS] Reloading financials for:', this.currentTickers[this.currentTickerIndex]);
          this.loadFinancials(this.currentTickers[this.currentTickerIndex]);
        } else {
          console.log('[FINANCIALS] No tickers loaded, skipping reload');
        }
      });
    });

    // Statement tabs
    document.querySelectorAll('.financials-page-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const statement = e.target.dataset.statement;
        
        // Update tab buttons
        document.querySelectorAll('.financials-page-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update content
        document.querySelectorAll('.financials-statement-content').forEach(c => c.classList.remove('active'));
        const tabId = statement.replace(/-./g, x => x[1].toUpperCase()) + 'PageTab';
        document.getElementById(tabId)?.classList.add('active');
      });
    });
    
    // Watchlist selector
    document.getElementById('financialsWatchlistSelect')?.addEventListener('change', (e) => {
      const watchlistId = e.target.value;
      if (watchlistId && this.watchlistsData) {
        const watchlist = this.watchlistsData.find(w => (w.id || w.name) === watchlistId);
        if (watchlist && watchlist.tickers && watchlist.tickers.length > 0) {
          this.currentTickers = [...watchlist.tickers];
          this.currentTickerIndex = 0;
          document.getElementById('financialsTickerInput').value = this.currentTickers.join(', ');
          this.loadFinancials(this.currentTickers[0]);
        }
      }
    });
    
    // Ticker navigation buttons
    document.getElementById('financialsPrevBtn')?.addEventListener('click', () => {
      if (this.currentTickerIndex > 0) {
        this.currentTickerIndex--;
        this.loadFinancials(this.currentTickers[this.currentTickerIndex]);
      }
    });
    
    document.getElementById('financialsNextBtn')?.addEventListener('click', () => {
      if (this.currentTickerIndex < this.currentTickers.length - 1) {
        this.currentTickerIndex++;
        this.loadFinancials(this.currentTickers[this.currentTickerIndex]);
      }
    });
    
    // Download CSV button
    document.getElementById('downloadFinancialsCSV')?.addEventListener('click', () => {
      this.downloadCSV();
    });
  },

  /**
   * Populate watchlist selector
   */
  async populateWatchlistSelector() {
    const select = document.getElementById('financialsWatchlistSelect');
    if (!select) return;
    
    try {
      // Get watchlists from the watchlists module (handles Supabase + localStorage)
      let watchlists = [];
      
      if (window.WatchlistsModule && window.WatchlistsModule.getWatchlists) {
        watchlists = window.WatchlistsModule.getWatchlists();
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem('watchlists');
        if (stored) {
          try {
            watchlists = JSON.parse(stored);
          } catch (error) {
            console.error('[FINANCIALS] Error parsing watchlists from localStorage:', error);
          }
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
        console.log('[FINANCIALS] Loaded', watchlists.length, 'watchlists');
      } else {
        select.innerHTML = '<option value="">No watchlists found</option>';
        console.log('[FINANCIALS] No watchlists found');
      }
    } catch (error) {
      console.error('[FINANCIALS] Error loading watchlists:', error);
      select.innerHTML = '<option value="">Error loading watchlists</option>';
    }
  },

  /**
   * Create SVG sparkline
   */
  createSparkline(values, width = 100, height = 30) {
    if (!values || values.length === 0) return '';
    
    const validValues = values.filter(v => v != null && !isNaN(v));
    if (validValues.length === 0) return '';
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const range = max - min || 1;
    
    const points = validValues.map((val, i) => {
      const x = (i / (validValues.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    
    // Get colors from CSS variables
    const isPositive = validValues[validValues.length - 1] >= validValues[0];
    const positiveColor = getComputedStyle(document.documentElement).getPropertyValue('--positive').trim() || '#00cc55';
    const negativeColor = getComputedStyle(document.documentElement).getPropertyValue('--negative').trim() || '#ff4444';
    const color = isPositive ? positiveColor : negativeColor;
    
    return `<svg width="${width}" height="${height}" class="sparkline">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
    </svg>`;
  },

  /**
   * Calculate CAGR (Compound Annual Growth Rate)
   * Handles negative values by calculating growth rate even when crossing zero
   */
  calculateCAGR(startValue, endValue, periods) {
    // Need valid numbers and periods
    if (startValue == null || endValue == null || !isFinite(startValue) || !isFinite(endValue) || periods <= 0) {
      return null;
    }
    
    // Both zero or very close to zero
    if (Math.abs(startValue) < 0.01 && Math.abs(endValue) < 0.01) {
      return null;
    }
    
    const years = this.currentTimeframe === 'quarterly' ? periods / 4 : periods;
    
    // If start is zero or near-zero but end isn't, can't calculate traditional CAGR
    if (Math.abs(startValue) < 0.01) {
      return null;
    }
    
    // Traditional CAGR only works when both values have the same sign
    if ((startValue > 0 && endValue > 0) || (startValue < 0 && endValue < 0)) {
      // For negative values, calculate on absolute values
      const absStart = Math.abs(startValue);
      const absEnd = Math.abs(endValue);
      const growthRate = (Math.pow(absEnd / absStart, 1 / years) - 1) * 100;
      
      // If both negative, a decrease in absolute value is good (less negative)
      return startValue < 0 ? -growthRate : growthRate;
    } else {
      // Values crossed zero - calculate simple annualized change
      const totalChange = endValue - startValue;
      const avgValue = Math.abs(startValue);
      return (totalChange / avgValue / years) * 100;
    }
  },

  /**
   * Load financials for a ticker
   */
  async loadFinancials(ticker) {
    
    const dataSection = document.getElementById('financialsDataSection');
    const tickerEl = document.getElementById('financialsPageTicker');
    const loadingEl = document.getElementById('financialsPageLoading');
    const errorEl = document.getElementById('financialsPageError');
    const prevBtn = document.getElementById('financialsPrevBtn');
    const nextBtn = document.getElementById('financialsNextBtn');
    const sourceLink = document.getElementById('polygonSourceLink');
    
    // Show section and update ticker display
    dataSection.style.display = 'block';
    
    // Update Polygon.io source link for fact-checking
    if (sourceLink) {
      sourceLink.href = `https://polygon.io/quote/${ticker}`;
      sourceLink.style.display = 'inline';
    }
    
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
    
    // Clear previous data
    document.getElementById('balanceSheetPageTable').innerHTML = '';
    document.getElementById('incomeStatementPageTable').innerHTML = '';
    document.getElementById('cashFlowPageTable').innerHTML = '';
    
    try {
      // Get up to 5 years of data (20 quarters or 5 annual reports)
      const limit = this.currentTimeframe === 'quarterly' ? 20 : 5;
      
      let balanceSheet, incomeStatement, cashFlow;
      
      if (window.electronAPI && window.electronAPI.polygonGetBalanceSheet) {
        // Electron mode
        [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
          window.electronAPI.polygonGetBalanceSheet(ticker, { timeframe: this.currentTimeframe, limit }),
          window.electronAPI.polygonGetIncomeStatement(ticker, { timeframe: this.currentTimeframe, limit }),
          window.electronAPI.polygonGetCashFlow(ticker, { timeframe: this.currentTimeframe, limit })
        ]);
      } else {
        // Browser mode - use REST API
        const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
        if (!apiKey) {
          throw new Error('API key not available');
        }
        
        const timeframe = this.currentTimeframe === 'quarterly' ? 'quarterly' : 'annual';
        
        // Fetch all three financial statements in parallel
        const [bsResponse, isResponse, cfResponse] = await Promise.all([
          fetch(`https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`),
          fetch(`https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`),
          fetch(`https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=${timeframe}&limit=${limit}&apiKey=${apiKey}`)
        ]);
        
        const [bsData, isData, cfData] = await Promise.all([
          bsResponse.json(),
          isResponse.json(),
          cfResponse.json()
        ]);
        
        // Convert to expected format - preserve fiscal period metadata
        balanceSheet = {
          success: bsData.status === 'OK',
          results: bsData.results?.map(r => ({
            ...r.financials?.balance_sheet,
            fiscal_period: r.fiscal_period,
            fiscal_year: r.fiscal_year,
            fiscal_quarter: r.fiscal_period?.replace('Q', '')
          })).filter(r => r && Object.keys(r).length > 3) || []
        };
        
        incomeStatement = {
          success: isData.status === 'OK',
          results: isData.results?.map(r => ({
            ...r.financials?.income_statement,
            fiscal_period: r.fiscal_period,
            fiscal_year: r.fiscal_year,
            fiscal_quarter: r.fiscal_period?.replace('Q', '')
          })).filter(r => r && Object.keys(r).length > 3) || []
        };
        
        cashFlow = {
          success: cfData.status === 'OK',
          results: cfData.results?.map(r => ({
            ...r.financials?.cash_flow_statement,
            fiscal_period: r.fiscal_period,
            fiscal_year: r.fiscal_year,
            fiscal_quarter: r.fiscal_period?.replace('Q', '')
          })).filter(r => r && Object.keys(r).length > 3) || []
        };
      }
      
      loadingEl.style.display = 'none';
      
      // Store data for export
      this.currentData = {
        ticker,
        timeframe: this.currentTimeframe,
        balanceSheet: balanceSheet.results || [],
        incomeStatement: incomeStatement.results || [],
        cashFlow: cashFlow.results || []
      };
      
      if (balanceSheet.success && balanceSheet.results && balanceSheet.results.length > 0) {
        this.renderBalanceSheet(balanceSheet.results);
      }
      
      if (incomeStatement.success && incomeStatement.results && incomeStatement.results.length > 0) {
        this.renderIncomeStatement(incomeStatement.results);
      }
      
      if (cashFlow.success && cashFlow.results && cashFlow.results.length > 0) {
        this.renderCashFlow(cashFlow.results);
      }
      
    } catch (error) {
      console.error('Error loading financials:', error);
      loadingEl.style.display = 'none';
      errorEl.textContent = `Error: ${error.message}`;
      errorEl.style.display = 'block';
    }
  },

  /**
   * Render balance sheet
   */
  renderBalanceSheet(data) {
    const table = document.getElementById('balanceSheetPageTable');
    if (!table) {
      console.error('[FinancialsPage] Balance sheet table element not found!');
      return;
    }
    
    const periods = data.reverse();
    const growthLabel = this.currentTimeframe === 'quarterly' ? 'CQGR' : 'CAGR';
    
    let html = '<thead><tr><th>Metric</th><th>Trend</th><th>' + growthLabel + '</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      const label = this.currentTimeframe === 'quarterly' ? 
        `${period.fiscal_year} Q${quarter}` : 
        `FY ${period.fiscal_year}`;
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => {
      // Handle nested value objects from Polygon API
      const numVal = val?.value ?? val;
      return numVal != null ? `$${(numVal / 1e9).toFixed(2)}B` : 'N/A';
    };
    
    const getVal = (val) => {
      return val?.value ?? val ?? null;
    };
    
    const metrics = [
      { label: 'Total Assets', key: 'assets' },
      { label: 'Current Assets', key: 'current_assets' },
      { label: 'Cash', key: 'cash' },
      { label: 'Inventory', key: 'inventory' },
      { label: 'Noncurrent Assets', key: 'noncurrent_assets' },
      { label: 'Intangible Assets', key: 'intangible_assets' },
      { label: 'Total Liabilities', key: 'liabilities' },
      { label: 'Current Liabilities', key: 'current_liabilities' },
      { label: 'Accounts Payable', key: 'accounts_payable' },
      { label: 'Noncurrent Liabilities', key: 'noncurrent_liabilities' },
      { label: 'Total Equity', key: 'equity' },
      { label: 'Equity (Parent)', key: 'equity_attributable_to_parent' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      
      // Collect values for sparkline and CAGR
      const values = periods.map(p => getVal(p[metric.key]));
      
      // Add sparkline (right after metric name)
      html += `<td class="sparkline-cell">${this.createSparkline(values)}</td>`;
      
      // Add CAGR (right after sparkline)
      const firstVal = values[0];
      const lastVal = values[values.length - 1];
      const cagr = this.calculateCAGR(firstVal, lastVal, values.length - 1);
      const cagrText = cagr != null ? `${cagr > 0 ? '+' : ''}${cagr.toFixed(1)}%` : 'N/A';
      const cagrClass = cagr != null ? (cagr >= 0 ? 'positive-value' : 'negative-value') : '';
      html += `<td class="metric-value ${cagrClass}">${cagrText}</td>`;
      
      // Render period values (after trend and CAGR)
      periods.forEach(period => {
        html += `<td class="metric-value">${fmt(period[metric.key])}</td>`;
      });
      
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Render income statement
   */
  renderIncomeStatement(data) {
    const table = document.getElementById('incomeStatementPageTable');
    const periods = data.reverse();
    const growthLabel = this.currentTimeframe === 'quarterly' ? 'CQGR' : 'CAGR';
    
    let html = '<thead><tr><th>Metric</th><th>Trend</th><th>' + growthLabel + '</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      const label = this.currentTimeframe === 'quarterly' ? 
        `${period.fiscal_year} Q${quarter}` : 
        `FY ${period.fiscal_year}`;
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => {
      const numVal = val?.value ?? val;
      return numVal != null ? `$${(numVal / 1e9).toFixed(2)}B` : 'N/A';
    };
    
    const getVal = (val) => {
      return val?.value ?? val ?? null;
    };
    
    const metrics = [
      { label: 'Revenue', key: 'revenues' },
      { label: 'Cost of Revenue', key: 'cost_of_revenue' },
      { label: 'Gross Profit', key: 'gross_profit' },
      { label: 'R&D Expenses', key: 'research_and_development' },
      { label: 'SG&A Expenses', key: 'selling_general_and_administrative_expenses' },
      { label: 'Operating Expenses', key: 'operating_expenses' },
      { label: 'Operating Income', key: 'operating_income_loss' },
      { label: 'Interest Expense', key: 'interest_expense' },
      { label: 'Income Before Tax', key: 'income_loss_from_continuing_operations_before_tax' },
      { label: 'Income Tax', key: 'income_tax_expense_benefit' },
      { label: 'Net Income', key: 'net_income_loss' },
      { label: 'EPS (Basic)', key: 'basic_earnings_per_share', formatter: (v) => {
        const numVal = v?.value ?? v;
        return (numVal != null && typeof numVal === 'number') ? `$${numVal.toFixed(2)}` : 'N/A';
      }},
      { label: 'EPS (Diluted)', key: 'diluted_earnings_per_share', formatter: (v) => {
        const numVal = v?.value ?? v;
        return (numVal != null && typeof numVal === 'number') ? `$${numVal.toFixed(2)}` : 'N/A';
      }}
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      
      // Collect values for sparkline and CAGR
      const values = periods.map(p => getVal(p[metric.key]));
      
      // Add sparkline (right after metric name)
      html += `<td class="sparkline-cell">${this.createSparkline(values)}</td>`;
      
      // Add CAGR (right after sparkline)
      const firstVal = values[0];
      const lastVal = values[values.length - 1];
      const cagr = this.calculateCAGR(firstVal, lastVal, values.length - 1);
      const cagrText = cagr != null ? `${cagr > 0 ? '+' : ''}${cagr.toFixed(1)}%` : 'N/A';
      const cagrClass = cagr != null ? (cagr >= 0 ? 'positive-value' : 'negative-value') : '';
      html += `<td class="metric-value ${cagrClass}">${cagrText}</td>`;
      
      // Render period values (after trend and CAGR)
      periods.forEach(period => {
        const val = period[metric.key];
        const numVal = val?.value ?? val;
        const formatted = metric.formatter ? metric.formatter(val) : fmt(val);
        const cssClass = numVal < 0 ? 'negative-value' : numVal > 0 ? 'positive-value' : '';
        html += `<td class="metric-value ${cssClass}">${formatted}</td>`;
      });
      
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Render cash flow
   */
  renderCashFlow(data) {
    const table = document.getElementById('cashFlowPageTable');
    const periods = data.reverse();
    const growthLabel = this.currentTimeframe === 'quarterly' ? 'CQGR' : 'CAGR';
    
    let html = '<thead><tr><th>Metric</th><th>Trend</th><th>' + growthLabel + '</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      const label = this.currentTimeframe === 'quarterly' ? 
        `${period.fiscal_year} Q${quarter}` : 
        `FY ${period.fiscal_year}`;
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => {
      const numVal = val?.value ?? val;
      return numVal != null ? `$${(numVal / 1e9).toFixed(2)}B` : 'N/A';
    };
    
    const getVal = (val) => {
      return val?.value ?? val ?? null;
    };
    
    // Updated field names based on actual Polygon API response structure
    const metrics = [
      { label: 'Operating Cash Flow', key: 'net_cash_flow_from_operating_activities' },
      { label: 'Operating CF (Continuing)', key: 'net_cash_flow_from_operating_activities_continuing' },
      { label: 'Investing Cash Flow', key: 'net_cash_flow_from_investing_activities' },
      { label: 'Investing CF (Continuing)', key: 'net_cash_flow_from_investing_activities_continuing' },
      { label: 'Financing Cash Flow', key: 'net_cash_flow_from_financing_activities' },
      { label: 'Financing CF (Continuing)', key: 'net_cash_flow_from_financing_activities_continuing' },
      { label: 'Net Cash Flow', key: 'net_cash_flow' },
      { label: 'Net CF (Continuing)', key: 'net_cash_flow_continuing' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      
      // Collect values for sparkline and CAGR
      const values = periods.map(p => getVal(p[metric.key]));
      
      // Add sparkline (right after metric name)
      html += `<td class="sparkline-cell">${this.createSparkline(values)}</td>`;
      
      // Add CAGR (right after sparkline)
      const firstVal = values[0];
      const lastVal = values[values.length - 1];
      const cagr = this.calculateCAGR(firstVal, lastVal, values.length - 1);
      const cagrText = cagr != null ? `${cagr > 0 ? '+' : ''}${cagr.toFixed(1)}%` : 'N/A';
      const cagrClass = cagr != null ? (cagr >= 0 ? 'positive-value' : 'negative-value') : '';
      html += `<td class="metric-value ${cagrClass}">${cagrText}</td>`;
      
      // Render period values (after trend and CAGR)
      periods.forEach(period => {
        const val = period[metric.key];
        const numVal = val?.value ?? val;
        const cssClass = numVal < 0 ? 'negative-value' : 'positive-value';
        html += `<td class="metric-value ${cssClass}">${fmt(val)}</td>`;
      });
      
      html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
  },

  /**
   * Download financials data as CSV
   */
  downloadCSV() {
    if (!this.currentData || !this.currentData.ticker) {
      alert('No data to export');
      return;
    }

    const { ticker, timeframe, balanceSheet, incomeStatement, cashFlow } = this.currentData;
    
    // Create CSV content
    let csv = `Financial Data for ${ticker} (${timeframe})\n\n`;
    
    // Helper to extract value
    const getVal = (val) => val?.value ?? val ?? '';
    
    // Balance Sheet
    if (balanceSheet.length > 0) {
      csv += 'BALANCE SHEET\n';
      csv += 'Metric,' + balanceSheet.map(p => {
        const q = p.fiscal_quarter || p.fiscal_period || '';
        return timeframe === 'quarterly' ? `${p.fiscal_year} Q${q}` : `FY ${p.fiscal_year}`;
      }).join(',') + '\n';
      
      const bsMetrics = [
        { label: 'Total Assets', key: 'assets' },
        { label: 'Current Assets', key: 'current_assets' },
        { label: 'Cash', key: 'cash' },
        { label: 'Inventory', key: 'inventory' },
        { label: 'Noncurrent Assets', key: 'noncurrent_assets' },
        { label: 'Intangible Assets', key: 'intangible_assets' },
        { label: 'Total Liabilities', key: 'liabilities' },
        { label: 'Current Liabilities', key: 'current_liabilities' },
        { label: 'Accounts Payable', key: 'accounts_payable' },
        { label: 'Noncurrent Liabilities', key: 'noncurrent_liabilities' },
        { label: 'Total Equity', key: 'equity' },
        { label: 'Equity (Parent)', key: 'equity_attributable_to_parent' }
      ];
      
      bsMetrics.forEach(m => {
        csv += `${m.label},` + balanceSheet.map(p => getVal(p[m.key])).join(',') + '\n';
      });
      csv += '\n';
    }
    
    // Income Statement
    if (incomeStatement.length > 0) {
      csv += 'INCOME STATEMENT\n';
      csv += 'Metric,' + incomeStatement.map(p => {
        const q = p.fiscal_quarter || p.fiscal_period || '';
        return timeframe === 'quarterly' ? `${p.fiscal_year} Q${q}` : `FY ${p.fiscal_year}`;
      }).join(',') + '\n';
      
      const isMetrics = [
        { label: 'Revenues', key: 'revenues' },
        { label: 'Cost of Revenue', key: 'cost_of_revenue' },
        { label: 'Gross Profit', key: 'gross_profit' },
        { label: 'Operating Expenses', key: 'operating_expenses' },
        { label: 'R&D', key: 'research_and_development' },
        { label: 'SG&A', key: 'selling_general_and_administrative_expenses' },
        { label: 'Operating Income', key: 'operating_income_loss' },
        { label: 'Interest Expense', key: 'interest_expense' },
        { label: 'Income Before Tax', key: 'income_loss_from_continuing_operations_before_tax' },
        { label: 'Income Tax', key: 'income_tax_expense_benefit' },
        { label: 'Net Income', key: 'net_income_loss' },
        { label: 'EPS Basic', key: 'basic_earnings_per_share' },
        { label: 'EPS Diluted', key: 'diluted_earnings_per_share' }
      ];
      
      isMetrics.forEach(m => {
        csv += `${m.label},` + incomeStatement.map(p => getVal(p[m.key])).join(',') + '\n';
      });
      csv += '\n';
    }
    
    // Cash Flow
    if (cashFlow.length > 0) {
      csv += 'CASH FLOW STATEMENT\n';
      csv += 'Metric,' + cashFlow.map(p => {
        const q = p.fiscal_quarter || p.fiscal_period || '';
        return timeframe === 'quarterly' ? `${p.fiscal_year} Q${q}` : `FY ${p.fiscal_year}`;
      }).join(',') + '\n';
      
      const cfMetrics = [
        { label: 'Operating Cash Flow', key: 'net_cash_flow_from_operating_activities' },
        { label: 'Operating CF (Continuing)', key: 'net_cash_flow_from_operating_activities_continuing' },
        { label: 'Investing Cash Flow', key: 'net_cash_flow_from_investing_activities' },
        { label: 'Investing CF (Continuing)', key: 'net_cash_flow_from_investing_activities_continuing' },
        { label: 'Financing Cash Flow', key: 'net_cash_flow_from_financing_activities' },
        { label: 'Financing CF (Continuing)', key: 'net_cash_flow_from_financing_activities_continuing' },
        { label: 'Net Cash Flow', key: 'net_cash_flow' },
        { label: 'Net CF (Continuing)', key: 'net_cash_flow_continuing' }
      ];
      
      cfMetrics.forEach(m => {
        csv += `${m.label},` + cashFlow.map(p => getVal(p[m.key])).join(',') + '\n';
      });
    }
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker}_financials_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Listen for watchlist updates
if (window.electronAPI && window.electronAPI.onWatchlistsUpdated) {
  window.electronAPI.onWatchlistsUpdated(() => {
    console.log('[FINANCIALS] Watchlists updated, repopulating selector...');
    FinancialsPage.populateWatchlistSelector();
  });
}

export default FinancialsPage;
window.FinancialsPage = FinancialsPage;
