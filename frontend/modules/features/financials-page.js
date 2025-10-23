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

  /**
   * Initialize the financials page
   */
  initialize() {
    // Group selector
    const groupSelect = document.getElementById('financialsGroupSelect');
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
    
    // Subscribe to ticker changes for current group (only if not None)
    if (this.currentGroup !== 'None') {
      tickerGroups.subscribe(this.currentGroup, (ticker) => {
        const input = document.getElementById('financialsTickerInput');
        if (input && input.value !== ticker) {
          input.value = ticker;
          this.loadFinancials(ticker);
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
        this.currentTimeframe = e.target.value;
        if (this.currentTickers.length > 0) {
          this.loadFinancials(this.currentTickers[this.currentTickerIndex]);
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
  },

  /**
   * Load financials for a ticker
   */
  async loadFinancials(ticker) {
    
    const dataSection = document.getElementById('financialsDataSection');
    const tickerEl = document.getElementById('financialsPageTicker');
    const loadingEl = document.getElementById('financialsPageLoading');
    const errorEl = document.getElementById('financialsPageError');
    
    // Show section and update ticker display
    dataSection.style.display = 'block';
    
    // Show ticker count if multiple tickers
    if (this.currentTickers.length > 1) {
      tickerEl.textContent = `${ticker} (${this.currentTickerIndex + 1}/${this.currentTickers.length})`;
    } else {
      tickerEl.textContent = ticker;
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
      
      const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
        window.electronAPI.polygonGetBalanceSheet(ticker, { timeframe: this.currentTimeframe, limit }),
        window.electronAPI.polygonGetIncomeStatement(ticker, { timeframe: this.currentTimeframe, limit }),
        window.electronAPI.polygonGetCashFlow(ticker, { timeframe: this.currentTimeframe, limit })
      ]);
      
      loadingEl.style.display = 'none';
      
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
    
    let html = '<thead><tr><th>Metric</th>';
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
    
    let html = '<thead><tr><th>Metric</th>';
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
    
    const metrics = [
      { label: 'Revenue', key: 'revenue' },
      { label: 'Cost of Revenue', key: 'cost_of_revenue' },
      { label: 'Gross Profit', key: 'gross_profit' },
      { label: 'R&D Expenses', key: 'research_development' },
      { label: 'SG&A Expenses', key: 'selling_general_administrative' },
      { label: 'Operating Expenses', key: 'total_operating_expenses' },
      { label: 'Operating Income', key: 'operating_income' },
      { label: 'Interest Expense', key: 'interest_expense' },
      { label: 'Income Before Tax', key: 'income_before_income_taxes' },
      { label: 'Income Tax', key: 'income_taxes' },
      { label: 'Net Income', key: 'consolidated_net_income_loss' },
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
    
    let html = '<thead><tr><th>Metric</th>';
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
  }
};

export default FinancialsPage;
window.FinancialsPage = FinancialsPage;
