/**
 * Polygon Treemap Module
 * S&P 500 Live Market Map visualization
 */

// State
let treemapData = new Map();
let lastUpdateTime = null;
let sp500SectorData = null; // Will be loaded from CSV via main process

const PolygonTreemap = {
  /**
   * Initialize Polygon connection and event listeners
   */
  async initialize() {
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
   * Draw the treemap visualization
   */
  drawTreemap() {
    try {
      const container = document.getElementById('treemapContainer');
      if (!container) {
        console.warn('Treemap container not found');
        return;
      }
    
      // Get data array from map
      const dataArray = Array.from(treemapData.values()).filter(d => d.changePercent !== null);
      
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
          .text('Waiting for market data...');
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
      
      // Get sizing method
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
        .paddingInner(groupBy === 'sector' ? 3 : 2)
        .paddingOuter(groupBy === 'sector' ? 3 : 2)
        .paddingTop(groupBy === 'sector' ? 25 : 2)
        .round(true);
      
      treemap(root);
      
      if (groupBy === 'sector') {
        // Draw sector groups
        const sectorGroups = svg.selectAll('.sector')
          .data(root.children)
          .join('g')
          .attr('class', 'sector');
        
        // Sector background rectangles
        sectorGroups.append('rect')
          .attr('class', 'sector-group')
          .attr('x', d => d.x0)
          .attr('y', d => d.y0)
          .attr('width', d => d.x1 - d.x0)
          .attr('height', d => d.y1 - d.y0)
          .attr('fill', 'rgba(0, 0, 0, 0.2)');
        
        // Sector labels
        sectorGroups.append('text')
          .attr('class', 'sector-label')
          .attr('x', d => d.x0 + 8)
          .attr('y', d => d.y0 + 18)
          .text(d => d.data.name);
        
        // Draw stocks within sectors
        const cells = sectorGroups.selectAll('.stock-cell')
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
