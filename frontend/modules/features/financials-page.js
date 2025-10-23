/**
 * Financials Page Module
 * Displays detailed financial statements
 */

import tickerGroups from '../core/ticker-groups.js';

const FinancialsPage = {
  currentTicker: null,
  currentTimeframe: 'quarterly',
  currentGroup: 'A',

  /**
   * Initialize the financials page
   */
  initialize() {
    // Group selector
    const groupSelect = document.getElementById('financialsGroupSelect');
    if (groupSelect) {
      groupSelect.value = tickerGroups.getActiveGroup();
      this.currentGroup = tickerGroups.getActiveGroup();
      
      groupSelect.addEventListener('change', (e) => {
        this.currentGroup = e.target.value;
        tickerGroups.setActiveGroup(this.currentGroup);
        
        // Load ticker for this group if it exists
        const ticker = tickerGroups.getGroupTicker(this.currentGroup);
        if (ticker) {
          document.getElementById('financialsTickerInput').value = ticker;
          // Don't auto-load on group switch, just populate the input
        } else {
          document.getElementById('financialsTickerInput').value = '';
        }
      });
    }
    
    // Subscribe to ticker changes for current group
    tickerGroups.subscribe(this.currentGroup, (ticker) => {
      const input = document.getElementById('financialsTickerInput');
      if (input && input.value !== ticker) {
        input.value = ticker;
        this.loadFinancials(ticker);
      }
    });
    
    // Load button
    document.getElementById('loadFinancialsBtn')?.addEventListener('click', () => {
      const ticker = document.getElementById('financialsTickerInput').value.trim().toUpperCase();
      if (ticker) {
        tickerGroups.setGroupTicker(this.currentGroup, ticker);
        this.loadFinancials(ticker);
      }
    });

    // Enter key on input
    document.getElementById('financialsTickerInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const ticker = e.target.value.trim().toUpperCase();
        if (ticker) {
          tickerGroups.setGroupTicker(this.currentGroup, ticker);
          this.loadFinancials(ticker);
        }
      }
    });

    // Timeframe selector
    document.querySelectorAll('input[name="financialsTimeframe"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentTimeframe = e.target.value;
        if (this.currentTicker) {
          this.loadFinancials(this.currentTicker);
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
    this.currentTicker = ticker;
    
    const dataSection = document.getElementById('financialsDataSection');
    const tickerEl = document.getElementById('financialsPageTicker');
    const loadingEl = document.getElementById('financialsPageLoading');
    const errorEl = document.getElementById('financialsPageError');
    
    // Show section
    dataSection.style.display = 'block';
    tickerEl.textContent = ticker;
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    
    // Clear previous data
    document.getElementById('balanceSheetPageTable').innerHTML = '';
    document.getElementById('incomeStatementPageTable').innerHTML = '';
    document.getElementById('cashFlowPageTable').innerHTML = '';
    
    try {
      const limit = this.currentTimeframe === 'quarterly' ? 8 : 5;
      
      console.log(`[FinancialsPage] Loading data for ${ticker}, timeframe: ${this.currentTimeframe}, limit: ${limit}`);
      
      const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
        window.electronAPI.polygonGetBalanceSheet(ticker, { timeframe: this.currentTimeframe, limit }),
        window.electronAPI.polygonGetIncomeStatement(ticker, { timeframe: this.currentTimeframe, limit }),
        window.electronAPI.polygonGetCashFlow(ticker, { timeframe: this.currentTimeframe, limit })
      ]);
      
      console.log('[FinancialsPage] API Responses:', {
        balanceSheet: { success: balanceSheet.success, count: balanceSheet.results?.length },
        incomeStatement: { success: incomeStatement.success, count: incomeStatement.results?.length },
        cashFlow: { success: cashFlow.success, count: cashFlow.results?.length }
      });
      
      loadingEl.style.display = 'none';
      
      console.log('[FinancialsPage] Loading hidden, loadingEl display:', loadingEl.style.display);
      console.log('[FinancialsPage] Data section display:', dataSection.style.display);
      
      if (balanceSheet.success && balanceSheet.results && balanceSheet.results.length > 0) {
        console.log('[FinancialsPage] Rendering balance sheet with', balanceSheet.results.length, 'periods');
        this.renderBalanceSheet(balanceSheet.results);
      } else {
        console.warn('[FinancialsPage] No balance sheet data:', balanceSheet);
      }
      
      if (incomeStatement.success && incomeStatement.results && incomeStatement.results.length > 0) {
        console.log('[FinancialsPage] Rendering income statement with', incomeStatement.results.length, 'periods');
        this.renderIncomeStatement(incomeStatement.results);
      } else {
        console.warn('[FinancialsPage] No income statement data:', incomeStatement);
      }
      
      if (cashFlow.success && cashFlow.results && cashFlow.results.length > 0) {
        console.log('[FinancialsPage] Rendering cash flow with', cashFlow.results.length, 'periods');
        this.renderCashFlow(cashFlow.results);
      } else {
        console.warn('No cash flow data');
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
    
    console.log('[FinancialsPage] Rendering balance sheet, periods:', periods.length);
    console.log('[FinancialsPage] First period keys:', Object.keys(periods[0]));
    
    let html = '<thead><tr><th>Metric</th>';
    periods.forEach(period => {
      const quarter = period.fiscal_quarter || period.fiscal_period || '';
      const label = this.currentTimeframe === 'quarterly' ? 
        `${period.fiscal_year} Q${quarter}` : 
        `FY ${period.fiscal_year}`;
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
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
    
    console.log('[FinancialsPage] Balance sheet HTML length:', html.length);
    console.log('[FinancialsPage] Table element display:', window.getComputedStyle(table).display);
    console.log('[FinancialsPage] Table parent display:', window.getComputedStyle(table.parentElement).display);
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
    
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
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
      { label: 'EPS (Basic)', key: 'basic_earnings_per_share', formatter: (v) => v != null && typeof v === 'number' ? `$${v.toFixed(2)}` : 'N/A' },
      { label: 'EPS (Diluted)', key: 'diluted_earnings_per_share', formatter: (v) => v != null && typeof v === 'number' ? `$${v.toFixed(2)}` : 'N/A' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      periods.forEach(period => {
        const val = period[metric.key];
        const formatted = metric.formatter ? metric.formatter(val) : fmt(val);
        const cssClass = val < 0 ? 'negative-value' : val > 0 ? 'positive-value' : '';
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
    
    const fmt = (val) => val != null ? `$${(val / 1e9).toFixed(2)}B` : 'N/A';
    
    const metrics = [
      { label: 'Operating Cash Flow', key: 'net_cash_from_operating_activities' },
      { label: 'Depreciation & Amortization', key: 'depreciation_depletion_and_amortization' },
      { label: 'Change in Working Capital', key: 'change_in_other_operating_assets_and_liabilities_net' },
      { label: 'Investing Cash Flow', key: 'net_cash_from_investing_activities' },
      { label: 'CapEx', key: 'purchase_of_property_plant_and_equipment' },
      { label: 'Financing Cash Flow', key: 'net_cash_from_financing_activities' },
      { label: 'Dividends Paid', key: 'dividends' },
      { label: 'Debt Issuance/Repayment', key: 'long_term_debt_issuances_repayments' },
      { label: 'Net Change in Cash', key: 'change_in_cash_and_equivalents' }
    ];
    
    metrics.forEach(metric => {
      html += `<tr><td class="metric-label">${metric.label}</td>`;
      periods.forEach(period => {
        const val = period[metric.key];
        const cssClass = val < 0 ? 'negative-value' : 'positive-value';
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
