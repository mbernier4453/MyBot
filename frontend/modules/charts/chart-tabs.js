/**
 * Chart Tab System Module
 * Multi-tab charting interface with overlays and live updates
 */

import tickerGroups from '../core/ticker-groups.js';
import drawingTools from './drawing-tools.js';

// =====================================================
// CHART TAB SYSTEM
// =====================================================

let chartTabs = [];
let activeChartTabId = null;
let nextChartTabId = 1;

// DOM element references (initialized when DOM is ready)
let chartNewTabBtn = null;
let sidebarToggleBtn = null;

class ChartTab {
  constructor(id, group = null) {
    this.id = id;
    this.group = group || tickerGroups.getActiveGroup(); // Assign to current active group
    this.ticker = null;
    this.timeframe = '1Y';
    this.interval = 'day';
    this.chartType = 'candlestick';
    this.extendedHoursEnabled = true;
    this.crosshairLocked = false;
    this.normalizeMode = 'off'; // off, index100, cumret, zscore, volscale, log
    this.anchorMode = 'first'; // first, date
    this.anchorDate = null;
    this.lookback = 60; // For zscore and volscale
    this.chartData = null;
    this.liveData = new Map();
    this.overlays = []; // Array to store overlay tickers
    this.indicators = []; // Array to store indicators {type, params, id}
    
    // Create tab element
    this.tabElement = this.createTabElement();
    
    // Create content element from template
    this.contentElement = this.createContentElement();
    
    // Initialize event listeners for this tab's controls
    this.initializeControls();
    
    // Initialize group selector AFTER controls are initialized
    this.initializeGroupSelector();
    
    // Validate initial interval for the default 1Y timeframe
    this.validateIntervalForTimeframe();
    
    // Subscribe to ticker changes for this group AFTER DOM is created
    this.groupSubscription = (ticker) => {
      if (ticker && ticker !== this.ticker && this.tabElement && this.contentElement) {
        this.setTicker(ticker, false); // Don't update group to prevent loops
      }
    };
    tickerGroups.subscribe(this.group, this.groupSubscription);
    
    // Check if group already has a ticker
    const groupTicker = tickerGroups.getGroupTicker(this.group);
    if (groupTicker && this.tabElement && this.contentElement) {
      this.ticker = groupTicker;
      this.updateTabLabel();
    }
  }
  
  initializeGroupSelector() {
    const groupSelect = this.contentElement.querySelector('.chart-tab-group-select');
    if (!groupSelect) return;
    
    // Set initial value to this tab's group
    groupSelect.value = this.group;
    
    // Handle group changes
    groupSelect.addEventListener('change', (e) => {
      const oldGroup = this.group;
      const newGroup = e.target.value;
      
      // Unsubscribe from old group
      if (this.groupSubscription) {
        tickerGroups.unsubscribe(oldGroup, this.groupSubscription);
      }
      
      // Update tab's group
      this.group = newGroup;
      
      // Subscribe to new group
      tickerGroups.subscribe(this.group, this.groupSubscription);
      
      // Load the new group's ticker if it exists
      const groupTicker = tickerGroups.getGroupTicker(this.group);
      if (groupTicker) {
        this.setTicker(groupTicker, false); // Don't update group, just sync to it
      }
      
      console.log(`Tab ${this.id} switched from group ${oldGroup} to ${newGroup}`);
    });
  }
  
  createTabElement() {
    const tab = document.createElement('div');
    tab.className = 'chart-tab';
    tab.dataset.tabId = this.id;
    tab.innerHTML = `
      <span class="chart-tab-label">New Chart</span>
      <button class="chart-tab-close">X</button>
    `;
    
    // Tab click to activate
    tab.addEventListener('click', (e) => {
      if (!e.target.classList.contains('chart-tab-close')) {
        activateChartTab(this.id);
      }
    });
    
    // Close button
    tab.querySelector('.chart-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeChartTab(this.id);
    });
    
    return tab;
  }
  
  createContentElement() {
    const template = document.getElementById('chartTabTemplate');
    const content = template.content.cloneNode(true).firstElementChild;
    content.dataset.tabId = this.id;
    return content;
  }
  
  initializeControls() {
    // ...existing code...
    const content = this.contentElement;
    
    // Timeframe
    const timeframeSelect = content.querySelector('.chart-timeframe-select');
    timeframeSelect.addEventListener('change', () => {
      this.timeframe = timeframeSelect.value;
      this.validateIntervalForTimeframe();
      if (this.ticker) {
        this.loadChartWithOverlays();
      }
    });
    
    // Interval
    const intervalSelect = content.querySelector('.chart-interval-select');
    intervalSelect.addEventListener('change', () => {
      this.interval = intervalSelect.value;
      this.updateExtendedHoursVisibility();
      if (this.ticker) {
        this.loadChartWithOverlays();
      }
    });
    
    // Normalize mode selector
    const normalizeModeSelect = content.querySelector('.chart-normalize-mode');
    const normalizeAnchor = content.querySelector('.chart-normalize-anchor');
    const normalizeLookback = content.querySelector('.chart-normalize-lookback');
    const anchorModeSelect = content.querySelector('.chart-anchor-mode');
    const anchorDateInput = content.querySelector('.chart-anchor-date');
    const lookbackInput = content.querySelector('.chart-lookback-input');
    
    if (normalizeModeSelect) {
      normalizeModeSelect.addEventListener('change', (e) => {
        this.normalizeMode = e.target.value;
        
        // Show/hide anchor and lookback controls based on mode
        const needsAnchor = ['index100', 'cumret', 'log'].includes(this.normalizeMode);
        const needsLookback = ['zscore', 'volscale'].includes(this.normalizeMode);
        
        normalizeAnchor.style.display = needsAnchor ? '' : 'none';
        normalizeLookback.style.display = needsLookback ? '' : 'none';
        
        if (this.ticker && this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    
    if (anchorModeSelect) {
      anchorModeSelect.addEventListener('change', (e) => {
        this.anchorMode = e.target.value;
        anchorDateInput.style.display = e.target.value === 'date' ? '' : 'none';
        
        if (this.ticker && this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    
    if (anchorDateInput) {
      anchorDateInput.addEventListener('change', (e) => {
        this.anchorDate = e.target.value;
        if (this.ticker && this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    
    if (lookbackInput) {
      lookbackInput.addEventListener('change', (e) => {
        this.lookback = parseInt(e.target.value) || 60;
        if (this.ticker && this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    
    // Extended hours
    const extendedHoursToggle = content.querySelector('.chart-extended-hours-checkbox');
    extendedHoursToggle.addEventListener('change', () => {
      this.extendedHoursEnabled = extendedHoursToggle.checked;
      if (this.ticker) {
        this.loadChartWithOverlays();
      }
    });
    
    // Chart type
    const chartTypeSelect = content.querySelector('.chart-type-select');
    chartTypeSelect.addEventListener('change', () => {
      this.chartType = chartTypeSelect.value;
      if (this.ticker && this.chartData) {
        this.drawChart(this.chartData);
      }
    });
    
    // Crosshair lock
    const crosshairLockToggle = content.querySelector('.chart-crosshair-lock-toggle');
    crosshairLockToggle.addEventListener('change', (e) => {
      this.crosshairLocked = e.target.checked;
      const chartCanvas = content.querySelector('.chart-canvas');
      
      if (this.crosshairLocked) {
        // Lock crosshair
        Plotly.relayout(chartCanvas, {
          'yaxis.showspikes': false,
          'hovermode': 'x'
        });
      } else {
        // Unlock crosshair
        Plotly.relayout(chartCanvas, {
          'yaxis.showspikes': true,
          'hovermode': 'closest'
        });
      }
    });
    
    // Add Overlay button
    const addOverlayBtn = content.querySelector('.chart-add-overlay-btn');
    if (addOverlayBtn) {
      addOverlayBtn.addEventListener('click', () => {
        console.log('Add Overlay button clicked');
        this.showOverlayDialog();
      });
    } else {
      console.error('Add Overlay button not found in content');
    }
    
    // Add Indicator button
    const addIndicatorBtn = content.querySelector('.chart-add-indicator-btn');
    if (addIndicatorBtn) {
      addIndicatorBtn.addEventListener('click', () => {
        this.showIndicatorDialog();
      });
    }
    
    // Indicators dropdown toggle
    const indicatorsHeader = content.querySelector('.indicators-header');
    if (indicatorsHeader) {
      indicatorsHeader.addEventListener('click', () => {
        const container = content.querySelector('.chart-indicators-container');
        const toggle = content.querySelector('.indicators-toggle');
        if (container.style.display === 'none') {
          container.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          container.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    }
    
    // Ticker selector dropdown
    this.initializeTickerSelector();
  }
  
  initializeTickerSelector() {
    const content = this.contentElement;
    
    // Ticker display click to toggle dropdown
    const tickerDisplay = content.querySelector('.chart-live-ticker');
    const dropdownBtn = content.querySelector('.ticker-dropdown-btn');
    const dropdownMenu = content.querySelector('.ticker-dropdown-menu');
    
    console.log('Ticker selector elements:', {
      tickerDisplay: !!tickerDisplay,
      dropdownBtn: !!dropdownBtn,
      dropdownMenu: !!dropdownMenu
    });
    
    if (!dropdownMenu) {
      console.error('Dropdown menu not found in content');
      return;
    }
    
    const openDropdown = () => {
      dropdownMenu.style.display = 'block';
      this.loadWatchlistsInDropdown();
      
      // Focus the input field
      const tickerInput = content.querySelector('.chart-ticker-input');
      if (tickerInput) {
        setTimeout(() => tickerInput.focus(), 50);
      }
    };
    
    const toggleDropdown = () => {
      const isVisible = dropdownMenu.style.display === 'block';
      if (isVisible) {
        dropdownMenu.style.display = 'none';
      } else {
        openDropdown();
      }
    };
    
    if (tickerDisplay) {
      tickerDisplay.addEventListener('click', toggleDropdown);
    }
    
    if (dropdownBtn) {
      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
    }
    
    // Keyboard shortcut: Ctrl+T to open ticker selector
    const keyboardHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        openDropdown();
      } else if (e.key === 'Escape' && dropdownMenu.style.display === 'block') {
        dropdownMenu.style.display = 'none';
      }
    };
    
    // Add keyboard listener when tab is active
    document.addEventListener('keydown', keyboardHandler);
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!content.contains(e.target) || (!dropdownMenu.contains(e.target) && e.target !== tickerDisplay && e.target !== dropdownBtn)) {
        dropdownMenu.style.display = 'none';
      }
    });
    
    // Ticker input
    const tickerInput = content.querySelector('.chart-ticker-input');
    if (tickerInput) {
      tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const ticker = tickerInput.value.trim().toUpperCase();
          if (ticker) {
            this.setTicker(ticker);
            dropdownMenu.style.display = 'none';
            tickerInput.value = '';
          }
        }
      });
      
      // Also handle Escape to close dropdown
      tickerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          dropdownMenu.style.display = 'none';
        }
      });
    }
    
    // Watchlist selector
    const watchlistSelect = content.querySelector('.chart-watchlist-select');
    if (watchlistSelect) {
      watchlistSelect.addEventListener('change', () => {
        const watchlistName = watchlistSelect.value;
        if (watchlistName) {
          this.loadTickersFromWatchlist(watchlistName);
        }
      });
    }
  }
  
  async loadWatchlistsInDropdown() {
    const content = this.contentElement;
    const watchlistSelect = content.querySelector('.chart-watchlist-select');
    
    if (!watchlistSelect) {
      console.error('Watchlist select element not found');
      return;
    }
    
    try {
      // Load watchlists from localStorage (same as watchlists page)
      const stored = localStorage.getItem('watchlists');
      let watchlists = [];
      
      if (stored) {
        try {
          watchlists = JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing watchlists from localStorage:', error);
        }
      }
      
      watchlistSelect.innerHTML = '<option value="">Choose watchlist...</option>';
      
      if (Array.isArray(watchlists) && watchlists.length > 0) {
        watchlists.forEach(w => {
          const option = document.createElement('option');
          option.value = w.name;
          option.textContent = w.name;
          watchlistSelect.appendChild(option);
        });
      } else {
        watchlistSelect.innerHTML = '<option value="">No watchlists found</option>';
      }
    } catch (error) {
      console.error('Error loading watchlists:', error);
      watchlistSelect.innerHTML = '<option value="">Error loading watchlists</option>';
    }
  }
  
  async loadTickersFromWatchlist(watchlistName) {
    const content = this.contentElement;
    const tickerListContainer = content.querySelector('.chart-ticker-list-dropdown');
    if (!tickerListContainer) return;
    
    try {
      // Load watchlists from localStorage
      const stored = localStorage.getItem('watchlists');
      let watchlists = [];
      
      if (stored) {
        try {
          watchlists = JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing watchlists from localStorage:', error);
        }
      }
      
      const watchlist = watchlists.find(w => w.name === watchlistName);
      
      if (watchlist && watchlist.tickers) {
        tickerListContainer.innerHTML = '';
        watchlist.tickers.forEach(ticker => {
          const item = document.createElement('div');
          item.className = 'ticker-item';
          item.textContent = ticker;
          item.addEventListener('click', () => {
            this.setTicker(ticker);
            content.querySelector('.ticker-dropdown-menu').style.display = 'none';
          });
          tickerListContainer.appendChild(item);
        });
      } else {
        tickerListContainer.innerHTML = '<div style="padding: 12px; color: #666;">No tickers in this watchlist</div>';
      }
    } catch (error) {
      console.error('Error loading tickers from watchlist:', error);
    }
  }
  
  validateIntervalForTimeframe() {
    const content = this.contentElement;
    const intervalSelect = content.querySelector('.chart-interval-select');
    const currentInterval = intervalSelect.value;
    
    const validIntervals = {
      '1D': ['1', '5', '15', '30', '60'],
      '5D': ['5', '15', '30', '60', '240'],
      '1M': ['15', '30', '60', '240', 'day'],
      '3M': ['15', '30', '60', '240', 'day'],
      'YTD': ['day'],
      '1Y': ['day', 'week'],
      '2Y': ['day', 'week'],
      '5Y': ['day', 'week', 'month'],
      '10Y': ['week', 'month'],
      'ALL': ['week', 'month']
    };
    
    const allowed = validIntervals[this.timeframe] || ['day'];
    
    Array.from(intervalSelect.options).forEach(option => {
      option.disabled = !allowed.includes(option.value);
    });
    
    if (!allowed.includes(currentInterval)) {
      intervalSelect.value = allowed[allowed.length - 1];
      this.interval = intervalSelect.value;
    }
    
    setTimeout(() => this.updateExtendedHoursVisibility(), 0);
  }
  
  updateExtendedHoursVisibility() {
    const content = this.contentElement;
    const extendedHoursToggle = content.querySelector('.chart-extended-hours-toggle');
    const intradayTimeframes = ['1D', '5D', '1M', '3M'];
    
    if (extendedHoursToggle) {
      if (intradayTimeframes.includes(this.timeframe)) {
        extendedHoursToggle.style.display = '';
      } else {
        extendedHoursToggle.style.display = 'none';
      }
    }
  }
  
  setTicker(ticker, updateGroup = true) {
    console.log(`%c[ChartTab ${this.id}] setTicker`, 'color: cyan', 'ticker:', ticker, 'current:', this.ticker, 'updateGroup:', updateGroup, 'tabElement exists:', !!this.tabElement);
    this.ticker = ticker;
    this.updateTabLabel();
    
    // Only update group ticker if requested (to avoid cascading updates)
    if (updateGroup) {
      tickerGroups.setGroupTicker(this.group, ticker);
    }
    
    this.updateLiveInfo();
    this.loadChart();
  }
  
  updateTabLabel() {
    console.log(`%c[ChartTab ${this.id}] updateTabLabel`, 'color: yellow', 'tabElement:', !!this.tabElement, 'ticker:', this.ticker, 'group:', this.group);
    if (!this.tabElement) {
      console.warn(`[ChartTab ${this.id}] updateTabLabel: No tabElement`);
      return;
    }
    const label = this.tabElement.querySelector('.chart-tab-label');
    console.log(`%c[ChartTab ${this.id}] label element:`, 'color: yellow', !!label);
    if (label) {
      const newText = this.ticker ? `${this.ticker} (${this.group})` : `Chart ${this.id}`;
      console.log(`%c[ChartTab ${this.id}] Setting label text to:`, 'color: lime', newText);
      label.textContent = newText;
      console.log(`%c[ChartTab ${this.id}] Label text is now:`, 'color: lime', label.textContent);
    } else {
      console.warn(`[ChartTab ${this.id}] updateTabLabel: No label element found`);
    }
  }
  
  updateLiveInfo() {
    if (!this.ticker) return;
    
    const content = this.contentElement;
    
    // ALWAYS update ticker display, even if no treemap data
    const tickerEl = content.querySelector('.chart-live-ticker');
    if (tickerEl) tickerEl.textContent = this.ticker;
    
    const data = treemapData.get(this.ticker);
    
    if (data) {
      // Update price
      const priceEl = content.querySelector('.chart-live-price');
      if (priceEl) priceEl.textContent = `$${data.close.toFixed(2)}`;
      
      // Update change
      const changeEl = content.querySelector('.chart-live-change');
      if (changeEl) {
        const changePercent = data.changePercent;
        changeEl.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        changeEl.style.backgroundColor = changePercent >= 0 ? '#00aa55' : '#ff4444';
        changeEl.style.color = 'white';
      }
      
      // Update volume
      const volumeEl = content.querySelector('.chart-live-volume');
      if (volumeEl) volumeEl.textContent = 'Vol: ' + (data.volume / 1e6).toFixed(2) + 'M';
      
      // Update market cap
      const marketCapEl = content.querySelector('.chart-live-marketcap');
      if (marketCapEl && data.marketCap) {
        marketCapEl.textContent = 'MCap: $' + (data.marketCap / 1e9).toFixed(2) + 'B';
      }
    }
  }
  
  async loadChart(retryCount = 0) {
    if (!this.ticker) return;
    
    const content = this.contentElement;
    const chartCanvas = content.querySelector('.chart-canvas');
    const loadingEl = content.querySelector('.chart-loading');
    const emptyStateEl = content.querySelector('.chart-empty-state');
    
    // Show loading
    chartCanvas.innerHTML = '';
    loadingEl.style.display = 'block';
    emptyStateEl.style.display = 'none';
    
    // Update loading message with better styling
    const retryText = retryCount > 0 ? ` (Attempt ${retryCount + 1}/4)` : '';
    loadingEl.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 3px solid var(--border-color);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        "></div>
        <p style="
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
        ">Loading chart data${retryText}...</p>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    try {
      // Subscribe to live updates for this ticker
      try {
        await window.electronAPI.polygonSubscribeTickers([this.ticker]);
        console.log(`[CHART] Subscribed to ${this.ticker}`);
      } catch (subError) {
        console.warn(`[CHART] Failed to subscribe to ${this.ticker}:`, subError);
      }
      
      const dateRange = this.getDateRange();
      const { timespan, multiplier } = this.getTimespanParams();
      
      const result = await window.electronAPI.polygonGetHistoricalBars({
        ticker: this.ticker,
        from: dateRange.from,
        to: dateRange.to,
        timespan,
        multiplier,
        includeExtendedHours: this.extendedHoursEnabled
      });
      
      loadingEl.style.display = 'none';
      
      if (!result.success || !result.bars || result.bars.length === 0) {
        throw new Error('No data available for this ticker and timeframe');
      }
      
      this.chartData = result.bars;
      this.drawChart(result.bars, timespan);
      
    } catch (error) {
      loadingEl.style.display = 'none';
      
      // Check if it's a timeout error and retry up to 3 times
      const isTimeoutError = error.message && (
        error.message.includes('timeout') || 
        error.message.includes('Timeout') ||
        error.message.includes('fetch failed')
      );
      
      if (isTimeoutError && retryCount < 3) {
        console.log(`Retrying chart load (attempt ${retryCount + 1}/3)...`);
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.loadChart(retryCount + 1);
      }
      
      // Show error message with better styling
      const errorMsg = isTimeoutError 
        ? 'Connection timeout. Please check your internet connection and try again.'
        : error.message;
      
      chartCanvas.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 400px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 40px;
        ">
          <div style="
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(255, 68, 68, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
          ">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 style="
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
          ">Unable to Load Chart</h3>
          <p style="
            margin: 0 0 24px 0;
            color: var(--text-secondary);
            font-size: 14px;
            max-width: 400px;
            text-align: center;
            line-height: 1.5;
          ">${errorMsg}</p>
          <button onclick="getActiveChartTab()?.loadChart()" style="
            padding: 10px 24px;
            background: var(--accent-blue);
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
          " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='var(--accent-blue)'">
            Try Again
          </button>
        </div>
      `;
    }
  }
  
  async loadChartWithOverlays() {
    // Load main chart first
    await this.loadChart();
    
    // If we have overlays, reload them with the new settings
    if (this.overlays && this.overlays.length > 0) {
      const overlayTickers = this.overlays.map(o => o.ticker);
      
      // Clear existing overlays
      this.overlays = [];
      const content = this.contentElement;
      const overlaysContainer = content.querySelector('.chart-overlays-container');
      const overlaysList = content.querySelector('.chart-overlays-list');
      overlaysContainer.innerHTML = '';
      overlaysList.style.display = 'none';
      
      // Reload each overlay with new settings
      for (const ticker of overlayTickers) {
        await this.addOverlay(ticker);
      }
    }
  }
  
  getDateRange() {
    const now = new Date();
    const to = new Date(now.getTime());
    const from = new Date(now.getTime());
    const isIntraday = this.interval !== 'day' && this.interval !== 'week' && this.interval !== 'month';
    
    switch(this.timeframe) {
      case '1D':
        from.setHours(0, 0, 0, 0);
        break;
      case '5D':
        from.setTime(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '1M':
        from.setMonth(from.getMonth() - 1);
        break;
      case '3M':
        from.setMonth(from.getMonth() - 3);
        break;
      case 'YTD':
        // Set to January 1st of current year
        from.setMonth(0); // January
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        break;
      case '1Y':
        from.setFullYear(from.getFullYear() - 1);
        break;
      case '2Y':
        from.setFullYear(from.getFullYear() - 2);
        break;
      case '5Y':
        from.setFullYear(from.getFullYear() - 5);
        break;
      case '10Y':
        from.setFullYear(from.getFullYear() - 10);
        break;
      case 'ALL':
        from.setFullYear(from.getFullYear() - 20);
        break;
      default:
        from.setFullYear(from.getFullYear() - 1);
    }
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return { from: formatDate(from), to: formatDate(to) };
  }
  
  getTimespanParams() {
    const intervalMap = {
      '1': { timespan: 'minute', multiplier: 1 },
      '5': { timespan: 'minute', multiplier: 5 },
      '15': { timespan: 'minute', multiplier: 15 },
      '30': { timespan: 'minute', multiplier: 30 },
      '60': { timespan: 'hour', multiplier: 1 },
      '240': { timespan: 'hour', multiplier: 4 },
      'day': { timespan: 'day', multiplier: 1 },
      'week': { timespan: 'week', multiplier: 1 },
      'month': { timespan: 'month', multiplier: 1 }
    };
    
    return intervalMap[this.interval] || { timespan: 'day', multiplier: 1 };
  }
  
  // Normalization helper methods
  normalizeData(prices, anchorIdx) {
    if (this.normalizeMode === 'off' || prices.length === 0) {
      return prices;
    }
    
    const anchor = anchorIdx !== undefined ? anchorIdx : 0;
    const basePrice = prices[anchor];
    
    switch (this.normalizeMode) {
      case 'index100':
        // Index to 100: Nt = 100 * Pt / Pt0
        return prices.map(p => (p / basePrice) * 100);
        
      case 'cumret':
        // Cumulative return: Nt = (Pt / Pt0) - 1
        return prices.map(p => (p / basePrice) - 1);
        
      case 'log':
        // Log index: Nt = ln(Pt) - ln(Pt0)
        return prices.map(p => Math.log(p) - Math.log(basePrice));
        
      case 'zscore':
        // Z-score: Zt = (Pt - μL) / σL
        return this.calculateZScore(prices, this.lookback);
        
      case 'volscale':
        // Volatility scale: Nt = Pt * σ* / σL
        return this.calculateVolScale(prices, this.lookback, 1.0);
        
      default:
        return prices;
    }
  }
  
  calculateZScore(prices, lookback) {
    const result = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < lookback - 1) {
        result.push(null); // Not enough data
        continue;
      }
      
      const window = prices.slice(Math.max(0, i - lookback + 1), i + 1);
      const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const std = Math.sqrt(variance);
      
      result.push(std > 0 ? (prices[i] - mean) / std : 0);
    }
    return result;
  }
  
  calculateVolScale(prices, lookback, targetVol) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const result = [prices[0]]; // First price unchanged
    
    for (let i = 1; i < prices.length; i++) {
      if (i < lookback) {
        result.push(prices[i]);
        continue;
      }
      
      const window = returns.slice(Math.max(0, i - lookback), i);
      const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const std = Math.sqrt(variance);
      
      const scale = std > 0 ? targetVol / std : 1;
      result.push(prices[i] * scale);
    }
    
    return result;
  }
  
  getAnchorIndex(bars) {
    if (this.anchorMode === 'first' || !this.anchorDate) {
      return 0;
    }
    
    // Find index of anchor date
    const anchorTime = new Date(this.anchorDate).getTime();
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].t >= anchorTime) {
        return i;
      }
    }
    return 0; // Fallback to first bar
  }
  
  drawChart(bars, timespan) {
    // ...existing code...
    const content = this.contentElement;
    const chartCanvas = content.querySelector('.chart-canvas');
    
    // If timespan not provided, derive it from interval
    if (!timespan) {
      const { timespan: ts } = this.getTimespanParams();
      timespan = ts;
    }
    
    // Helper function to format dates consistently
    // Uses the main bars array to determine multi-day logic
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      
      if (timespan === 'month') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      } else if (timespan === 'week') {
        return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
      } else if (timespan === 'day') {
        return date.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
      } else if (timespan === 'hour') {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
      } else {
        // Minute intervals - check if main data spans multiple days
        const firstBar = bars[0];
        const lastBar = bars[bars.length - 1];
        const firstDate = new Date(firstBar.t);
        const lastDate = new Date(lastBar.t);
        const spanMultipleDays = firstDate.toDateString() !== lastDate.toDateString();
        
        if (spanMultipleDays) {
          return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        } else {
          return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
      }
    };
    
    // Prepare formatted data for main ticker
    const dates = [];
    const open = [];
    const high = [];
    const low = [];
    const close = [];
    const volume = [];
    
    const totalBars = bars.length;
    let tickAngle = -45;
    let tickFontSize = 10;
    
    if (totalBars > 500) {
      tickAngle = -90;
      tickFontSize = 8;
    }
    
    bars.forEach((bar) => {
      dates.push(formatDate(bar.t));
      open.push(bar.o);
      high.push(bar.h);
      low.push(bar.l);
      close.push(bar.c);
      volume.push(bar.v);
    });
    
    // Get anchor index for normalization
    const anchorIdx = this.getAnchorIndex(bars);
    
    // Normalize data using the new system
    const normalizedClose = this.normalizeData(close, anchorIdx);
    const normalizedOpen = this.normalizeData(open, anchorIdx);
    const normalizedHigh = this.normalizeData(high, anchorIdx);
    const normalizedLow = this.normalizeData(low, anchorIdx);
    
    // Check if normalization produced null values (e.g., z-score with insufficient data)
    const hasNulls = normalizedClose.some(v => v === null);
    
    // Get theme colors for base candlestick
    const positiveColor = getPositiveColor();
    const negativeColor = getNegativeColor();
    
    const candlestickTrace = {
      type: 'candlestick',
      x: dates,
      open: normalizedOpen,
      high: normalizedHigh,
      low: normalizedLow,
      close: normalizedClose,
      name: this.ticker,
      increasing: { 
        line: { color: positiveColor, width: 1 },
        fillcolor: positiveColor
      },
      decreasing: { 
        line: { color: negativeColor, width: 1 },
        fillcolor: negativeColor
      },
      xaxis: 'x',
      yaxis: 'y',
      hoverinfo: 'text',
      text: dates.map((date, i) => {
        if (normalizedClose[i] === null) return `${date}<br>Insufficient data`;
        
        const formatValue = (val) => {
          if (this.normalizeMode === 'off') return `$${val.toFixed(2)}`;
          if (this.normalizeMode === 'cumret') return `${(val * 100).toFixed(2)}%`;
          return val.toFixed(2);
        };
        
        if (this.normalizeMode === 'off') {
          return `${date}<br>O: $${open[i].toFixed(2)}<br>H: $${high[i].toFixed(2)}<br>L: $${low[i].toFixed(2)}<br>C: $${close[i].toFixed(2)}`;
        } else {
          return `${date}<br>O: ${formatValue(normalizedOpen[i])}<br>H: ${formatValue(normalizedHigh[i])}<br>L: ${formatValue(normalizedLow[i])}<br>C: ${formatValue(normalizedClose[i])}`;
        }
      })
    };
    
    // Determine volume bar colors based on close vs open - use same colors as candlesticks
    const volumeColors = volume.map((v, i) => {
      const isPositive = close[i] >= open[i];
      // Add transparency to match volume bar style
      const baseColor = isPositive ? positiveColor : negativeColor;
      // Convert hex to rgba with 20% opacity
      return baseColor + '33';
    });
    
    const volumeTrace = {
      type: 'bar',
      x: dates,
      y: volume,
      name: 'Volume',
      marker: {
        color: volumeColors
      },
      xaxis: 'x',
      yaxis: 'y2',
      hovertemplate: 'Volume: %{y:,.0f}<extra></extra>'
    };
    
    const layout = {
      plot_bgcolor: '#000000',
      paper_bgcolor: '#000000',
      font: { color: '#e0e0e0' },
      xaxis: {
        type: 'category',
        rangeslider: { visible: false },
        gridcolor: '#1a1a1a',
        griddash: 'dot',
        showgrid: false,
        tickangle: tickAngle,
        tickfont: { size: tickFontSize },
        nticks: Math.min(15, Math.ceil(totalBars / 20)),
        automargin: true,
        showspikes: true,
        spikemode: 'across',
        spikesnap: 'cursor',
        spikecolor: '#666',
        spikethickness: 0.5,
        spikedash: 'dot'
      },
      yaxis: {
        domain: [0.23, 1],
        gridcolor: '#1a1a1a',
        griddash: 'dot',
        showgrid: true,
        tickprefix: this.normalizeMode === 'off' ? '$' : '',
        ticksuffix: this.normalizeMode === 'cumret' ? '%' : '',
        showspikes: true,
        spikemode: 'across',
        spikesnap: 'cursor',
        spikecolor: '#666',
        spikethickness: 0.5,
        spikedash: 'dot'
      },
      yaxis2: {
        title: '',
        domain: [0, 0.18],
        gridcolor: '#1a1a1a',
        showgrid: false,
        showticklabels: false
      },
      margin: { l: 60, r: 40, t: 10, b: 80 },
      hovermode: 'x',
      hoverlabel: {
        bgcolor: 'rgba(26, 26, 26, 0.95)',
        bordercolor: '#444',
        font: { color: '#e0e0e0', size: 12 },
        align: 'left',
        namelength: -1
      },
      showlegend: false,
      dragmode: 'pan'
    };
    
    window.addWatermark(layout);
    
    const config = {
      responsive: true,
      displayModeBar: false, // Hide the modebar completely
      displaylogo: false,
      scrollZoom: false, // Disable default scroll zoom, we'll handle it with Ctrl
      editable: false,
      staticPlot: false
    };
    
    let mainTrace;
    if (this.chartType === 'line') {
      const getHoverTemplate = () => {
        if (this.normalizeMode === 'off') return '%{x}<br>Close: $%{y:.2f}<extra></extra>';
        if (this.normalizeMode === 'cumret') return '%{x}<br>Return: %{y:.2%}<extra></extra>';
        if (this.normalizeMode === 'index100') return '%{x}<br>Index: %{y:.2f}<extra></extra>';
        if (this.normalizeMode === 'zscore') return '%{x}<br>Z-Score: %{y:.2f}<extra></extra>';
        if (this.normalizeMode === 'log') return '%{x}<br>Log: %{y:.4f}<extra></extra>';
        return '%{x}<br>Value: %{y:.2f}<extra></extra>';
      };
      
      mainTrace = {
        type: 'scatter',
        mode: 'lines',
        x: dates,
        y: normalizedClose,
        name: this.ticker,
        line: { color: '#4a9eff', width: 2 },
        xaxis: 'x',
        yaxis: 'y',
        hovertemplate: getHoverTemplate()
      };
    } else {
      mainTrace = candlestickTrace;
    }
    
    // Prepare traces array
    const traces = [mainTrace, volumeTrace];
    
    // Add overlay traces
    if (this.overlays && this.overlays.length > 0) {
      // Show legend if we have overlays
      layout.showlegend = true;
      layout.legend = {
        x: 0,
        y: 1,
        bgcolor: 'rgba(26, 26, 26, 0.8)',
        bordercolor: '#444',
        borderwidth: 1,
        font: { color: '#e0e0e0', size: 11 }
      };
      
      // Add name to main trace for legend
      if (this.chartType === 'line') {
        mainTrace.name = this.ticker;
        mainTrace.showlegend = true;
      } else {
        mainTrace.name = this.ticker;
        mainTrace.showlegend = true;
      }
      
      // Add each overlay with the same chart type as main
      this.overlays.forEach((overlay, overlayIndex) => {
        const overlayDates = [];
        const overlayOpen = [];
        const overlayHigh = [];
        const overlayLow = [];
        const overlayClose = [];
        
        // Use the same date formatting function (references main bars for consistency)
        overlay.data.forEach((bar) => {
          overlayDates.push(formatDate(bar.t));
          overlayOpen.push(bar.o);
          overlayHigh.push(bar.h);
          overlayLow.push(bar.l);
          overlayClose.push(bar.c);
        });
        
        // Get anchor index for this overlay (same logic as main)
        const overlayAnchorIdx = this.anchorMode === 'first' ? 0 : this.getAnchorIndex(overlay.data);
        
        // Normalize overlay data using the same system as main
        const normalizedOverlayClose = this.normalizeData(overlayClose, overlayAnchorIdx);
        const normalizedOverlayOpen = this.normalizeData(overlayOpen, overlayAnchorIdx);
        const normalizedOverlayHigh = this.normalizeData(overlayHigh, overlayAnchorIdx);
        const normalizedOverlayLow = this.normalizeData(overlayLow, overlayAnchorIdx);
        
        let overlayTrace;
        
        if (this.chartType === 'line') {
          const getOverlayHoverTemplate = () => {
            if (this.normalizeMode === 'off') return '%{x}<br>' + overlay.ticker + ': $%{y:.2f}<extra></extra>';
            if (this.normalizeMode === 'cumret') return '%{x}<br>' + overlay.ticker + ': %{y:.2%}<extra></extra>';
            if (this.normalizeMode === 'index100') return '%{x}<br>' + overlay.ticker + ': %{y:.2f}<extra></extra>';
            if (this.normalizeMode === 'zscore') return '%{x}<br>' + overlay.ticker + ': %{y:.2f}<extra></extra>';
            return '%{x}<br>' + overlay.ticker + ': %{y:.2f}<extra></extra>';
          };
          
          overlayTrace = {
            type: 'scatter',
            mode: 'lines',
            x: overlayDates,
            y: normalizedOverlayClose,
            name: overlay.ticker,
            line: { color: overlay.color, width: 2 },
            xaxis: 'x',
            yaxis: 'y',
            hovertemplate: getOverlayHoverTemplate(),
            showlegend: true
          };
        } else {
          // Candlestick chart - lighten colors progressively
          // Each overlay gets progressively lighter green/red based on theme colors
          const lightenFactor = (overlayIndex + 1) * 0.25; // 25%, 50%, 75%, etc. (more visible)
          
          // Get theme colors and lighten them
          const basePositiveColor = getPositiveColor();
          const baseNegativeColor = getNegativeColor();
          const increasingColor = lightenColor(basePositiveColor, lightenFactor);
          const decreasingColor = lightenColor(baseNegativeColor, lightenFactor);
          
          overlayTrace = {
            type: 'candlestick',
            x: overlayDates,
            open: normalizedOverlayOpen,
            high: normalizedOverlayHigh,
            low: normalizedOverlayLow,
            close: normalizedOverlayClose,
            name: overlay.ticker,
            increasing: { 
              line: { color: increasingColor, width: 1 },
              fillcolor: increasingColor
            },
            decreasing: { 
              line: { color: decreasingColor, width: 1 },
              fillcolor: decreasingColor
            },
            xaxis: 'x',
            yaxis: 'y',
            hoverinfo: 'text',
            text: overlayDates.map((date, i) => {
              if (normalizedOverlayClose[i] === null) return `${overlay.ticker}<br>${date}<br>Insufficient data`;
              
              const formatValue = (val) => {
                if (this.normalizeMode === 'off') return `$${val.toFixed(2)}`;
                if (this.normalizeMode === 'cumret') return `${(val * 100).toFixed(2)}%`;
                return val.toFixed(2);
              };
              
              if (this.normalizeMode === 'off') {
                return `${overlay.ticker}<br>${date}<br>O: $${overlayOpen[i].toFixed(2)}<br>H: $${overlayHigh[i].toFixed(2)}<br>L: $${overlayLow[i].toFixed(2)}<br>C: $${overlayClose[i].toFixed(2)}`;
              } else {
                return `${overlay.ticker}<br>${date}<br>O: ${formatValue(normalizedOverlayOpen[i])}<br>H: ${formatValue(normalizedOverlayHigh[i])}<br>L: ${formatValue(normalizedOverlayLow[i])}<br>C: ${formatValue(normalizedOverlayClose[i])}`;
              }
            }),
            showlegend: true
          };
        }
        
        traces.push(overlayTrace);
      });
    }
    
    // Add indicators for main ticker and all overlays
    if (this.indicators && this.indicators.length > 0) {
      // Build list of all data sources (main + overlays)
      const dataSources = [
        { ticker: this.ticker, bars: bars, isMain: true }
      ];
      
      // Add overlays
      if (this.overlays && this.overlays.length > 0) {
        this.overlays.forEach(overlay => {
          dataSources.push({
            ticker: overlay.ticker,
            bars: overlay.data,
            isMain: false,
            color: overlay.color
          });
        });
      }
      
      console.log('Data sources for indicators:', dataSources.length, dataSources.map(s => s.ticker));
      
      // Apply each indicator to each data source
      this.indicators.forEach((indicator, indIdx) => {
        console.log('Processing indicator:', indicator.type, 'for', dataSources.length, 'sources');
        
        dataSources.forEach((source, sourceIdx) => {
          console.log('  Calculating', indicator.type, 'for', source.ticker, '- bars:', source.bars.length);
          
          const result = this.calculateIndicator(indicator, { bars: source.bars });
          
          console.log('  Indicator result:', indicator.type, 'for', source.ticker, '- result:', !!result);
          
          if (!result) {
            console.warn('  No result from calculateIndicator for', indicator.type, source.ticker);
            return;
          }
          
          const dates = source.bars.map(b => formatDate(b.t));
          const baseColor = indicator.color || '#9b59b6'; // Use indicator's saved color
          
          // Use overlay color for overlays, indicator color for main
          const color = source.isMain ? baseColor : source.color;
          const tickerLabel = source.isMain ? '' : ` (${source.ticker})`;
          const opacity = source.isMain ? 1.0 : 0.6;
          
          console.log('  Adding trace for', source.ticker, indicator.type, '- color:', color);
          
          // Handle different indicator types
          if (indicator.type === 'BB' || indicator.type === 'KC') {
            // Band indicators return {upper, middle, lower}
            const label = indicator.type === 'BB' ? 'BB' : 'KC';
            const params = indicator.type === 'BB' 
              ? `(${indicator.params.period},${indicator.params.stdDev})`
              : `(${indicator.params.period},${indicator.params.multiplier})`;
            
            // Normalize indicator values if needed (except RSI/ATR)
            const anchorIdx = this.getAnchorIndex(source.bars);
            const normalizedUpper = this.normalizeData(result.upper, anchorIdx);
            const normalizedMiddle = this.normalizeData(result.middle, anchorIdx);
            const normalizedLower = this.normalizeData(result.lower, anchorIdx);
            
            // Upper band
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedUpper,
              name: `${label} Upper ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1 : 0.8, dash: 'dash' },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: sourceIdx === 0, // Only show in legend once
              legendgroup: `${indicator.type}-${indIdx}`,
              hovertemplate: `${source.ticker} ${label} Upper: %{y:.2f}<extra></extra>`
            });
            
            // Middle band
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedMiddle,
              name: `${label} Middle ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1.5 : 1 },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: sourceIdx === 0,
              legendgroup: `${indicator.type}-${indIdx}`,
              hovertemplate: `${source.ticker} ${label} Middle: %{y:.2f}<extra></extra>`
            });
            
            // Lower band
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedLower,
              name: `${label} Lower ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1 : 0.8, dash: 'dash' },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: false, // Don't show lower in legend
              legendgroup: `${indicator.type}-${indIdx}`,
              hovertemplate: `${source.ticker} ${label} Lower: %{y:.2f}<extra></extra>`
            });
          } else if (indicator.type === 'RSI') {
            // RSI uses tertiary y-axis (separate panel below volume)
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: result,
              name: `${source.ticker} RSI(${indicator.params.period})`,
              line: { color: color, width: source.isMain ? 2 : 1.5 },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y3',
              showlegend: true,
              hovertemplate: `${source.ticker} RSI: %{y:.2f}<extra></extra>`
            });
            
            // Only add RSI reference lines and axis setup once
            if (!layout.yaxis3 && sourceIdx === 0) {
              [30, 70].forEach((level, idx) => {
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  x: [dates[0], dates[dates.length - 1]],
                  y: [level, level],
                  name: idx === 0 ? 'RSI Levels' : '',
                  line: { color: '#666', width: 1, dash: 'dot' },
                  xaxis: 'x',
                  yaxis: 'y3',
                  showlegend: idx === 0,
                  hoverinfo: 'skip'
                });
              });
              
              // Update layout to include y3 axis for RSI (separate panel)
              // Adjust main chart to make room
              layout.yaxis.domain = [0.40, 1]; // Main chart top 60%
              layout.yaxis2.domain = [0.22, 0.38]; // Volume middle 16%
              layout.yaxis3 = {
                title: 'RSI',
                titlefont: { color: baseColor },
                tickfont: { color: baseColor },
                domain: [0, 0.20], // RSI panel bottom 20%
                range: [0, 100],
                showgrid: true,
                gridcolor: '#1a1a1a',
                zeroline: false
              };
            }
          } else if (indicator.type === 'ATR') {
            // ATR uses its own y-axis (y4) separate from RSI
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: result,
              name: `${source.ticker} ATR(${indicator.params.period})`,
              line: { color: color, width: source.isMain ? 2 : 1.5 },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y4',
              showlegend: true,
              hovertemplate: `${source.ticker} ATR: %{y:.2f}<extra></extra>`
            });
            
            // Setup y4 axis for ATR if not already done
            if (!layout.yaxis4 && sourceIdx === 0) {
              // If RSI exists (y3), adjust all domains to fit 4 panels
              if (layout.yaxis3) {
                layout.yaxis.domain = [0.55, 1];    // Main chart: top 45%
                layout.yaxis2.domain = [0.38, 0.53]; // Volume: 15%
                layout.yaxis3.domain = [0.19, 0.36]; // RSI: 17%
                layout.yaxis4 = {                    // ATR: bottom 17%
                  title: 'ATR',
                  titlefont: { color: baseColor },
                  tickfont: { color: baseColor },
                  domain: [0, 0.17],
                  showgrid: true,
                  gridcolor: '#1a1a1a',
                  zeroline: false
                };
              } else {
                // No RSI, just ATR - use 3 panels
                layout.yaxis.domain = [0.40, 1];
                layout.yaxis2.domain = [0.22, 0.38];
                layout.yaxis4 = {
                  title: 'ATR',
                  titlefont: { color: baseColor },
                  tickfont: { color: baseColor },
                  domain: [0, 0.20],
                  showgrid: true,
                  gridcolor: '#1a1a1a',
                  zeroline: false
                };
              }
            }
          } else {
            // Simple line indicators (SMA, EMA, HMA, KAMA)
            let label = indicator.type;
            if (indicator.type === 'KAMA') {
              label += `(${indicator.params.period},${indicator.params.fast},${indicator.params.slow})`;
            } else {
              label += `(${indicator.params.period})`;
            }
            
            // Normalize indicator values if needed (matches price normalization)
            const anchorIdx = this.getAnchorIndex(source.bars);
            const normalizedResult = this.normalizeData(result, anchorIdx);
            
            const trace = {
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedResult,
              name: `${source.ticker} ${label}`,
              line: { color: color, width: source.isMain ? 2 : 1.5 },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: true,
              hovertemplate: `${source.ticker} ${label}: %{y:.2f}<extra></extra>`
            };
            
            console.log('  Created trace:', {
              name: trace.name,
              xLength: trace.x.length,
              yLength: trace.y.length,
              yFirst5: trace.y.slice(0, 5),
              yLast5: trace.y.slice(-5),
              color: trace.line.color
            });
            
            traces.push(trace);
          }
        });
      });
    }
    
    console.log('About to call Plotly.newPlot with', traces.length, 'traces');
    console.log('Trace names:', traces.map(t => t.name));
    if (traces.length > 0) {
      console.log('First trace details:', {
        name: traces[0].name,
        type: traces[0].type,
        mode: traces[0].mode,
        xLength: traces[0].x ? traces[0].x.length : 0,
        yLength: traces[0].y ? traces[0].y.length : 0,
        yaxis: traces[0].yaxis
      });
    }
    
    // Calculate chart height based on number of panels
    // Base height for main chart + volume, additional height for RSI/ATR panels
    const hasRSI = layout.yaxis3 !== undefined;
    const hasATR = layout.yaxis4 !== undefined;
    let chartHeight = 600; // Base height
    if (hasRSI && hasATR) {
      chartHeight = 900; // 4 panels: main + volume + RSI + ATR
    } else if (hasRSI || hasATR) {
      chartHeight = 750; // 3 panels: main + volume + one indicator
    }
    layout.height = chartHeight;
    
    // Return the promise so we can chain handlers
    return Plotly.newPlot(chartCanvas, traces, layout, config).then(() => {
      // Store reference for drawing tools
      chartCanvas.plotlyChart = chartCanvas;
      
      // Initialize drawing tools mouse handlers after chart is ready
      if (window.drawingTools) {
        drawingTools.initializeChartMouseEvents();
        drawingTools.enableShapeEditing(chartCanvas);
        console.log('[CHART] Drawing tools initialized for chart with shape editing enabled');
      }
    });
    
    // Enable Ctrl+scroll zoom (zoom around mouse position) with improved performance
    let zoomTimeout = null;
    chartCanvas.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        
        // Clear any pending zoom
        if (zoomTimeout) {
          clearTimeout(zoomTimeout);
        }
        
        const delta = e.deltaY;
        const xaxis = chartCanvas._fullLayout.xaxis;
        const yaxis = chartCanvas._fullLayout.yaxis;
        
        // Get mouse position relative to plot area
        const plotBbox = chartCanvas.querySelector('.plotly .xy').getBoundingClientRect();
        const mouseX = e.clientX - plotBbox.left;
        const relativeX = mouseX / plotBbox.width;
        
        // X-axis zoom - more aggressive zoom factor
        const xRange = xaxis.range;
        const xWidth = xRange[1] - xRange[0];
        const xZoomFactor = delta > 0 ? 1.1 : 0.9; // Faster zoom
        const xNewWidth = xWidth * xZoomFactor;
        const xMousePos = xRange[0] + (xWidth * relativeX);
        const xNewMin = xMousePos - (xNewWidth * relativeX);
        const xNewMax = xMousePos + (xNewWidth * (1 - relativeX));
        
        // Y-axis zoom - more aggressive zoom factor
        const yRange = yaxis.range;
        const yHeight = yRange[1] - yRange[0];
        const yZoomFactor = delta > 0 ? 1.1 : 0.9; // Faster zoom
        const yNewHeight = yHeight * yZoomFactor;
        const yCenter = (yRange[0] + yRange[1]) / 2;
        
        // Apply zoom immediately for responsiveness
        Plotly.relayout(chartCanvas, {
          'xaxis.range': [xNewMin, xNewMax],
          'yaxis.range': [yCenter - yNewHeight / 2, yCenter + yNewHeight / 2]
        });
      }
    }, { passive: false });
    
    // Hover positioning
    let isHovering = false;
    let animationFrameId = null;
    
    function repositionHoverLabels() {
      const hoverGroups = chartCanvas.querySelectorAll('.hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.setAttribute('transform', 'translate(80, 80)');
        if (!group.classList.contains('positioned')) {
          group.classList.add('positioned');
        }
      });
      
      if (isHovering) {
        animationFrameId = requestAnimationFrame(repositionHoverLabels);
      }
    }
    
    chartCanvas.on('plotly_hover', function(data) {
      isHovering = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      repositionHoverLabels();
    });
    
    chartCanvas.on('plotly_unhover', function() {
      isHovering = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      const hoverGroups = chartCanvas.querySelectorAll('.hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    });
  }
  
  showOverlayDialog() {
    console.log('showOverlayDialog called');
    
    // Create custom dialog
    const content = this.contentElement;
    const dialogHTML = `
      <div class="overlay-dialog-backdrop" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      ">
        <div class="overlay-dialog" style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 24px;
          min-width: 400px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        ">
          <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Add Overlay</h3>
          <p style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 14px;">
            Enter a ticker symbol to overlay on this chart
          </p>
          <input type="text" id="overlayTickerInput" placeholder="e.g., MSFT, GOOGL, TSLA" style="
            width: 100%;
            padding: 12px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
            margin-bottom: 20px;
          " />
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="overlayDialogCancel" style="
              padding: 10px 20px;
              background: transparent;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              color: var(--text-primary);
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
            ">Cancel</button>
            <button id="overlayDialogAdd" style="
              padding: 10px 20px;
              background: var(--accent-blue);
              border: none;
              border-radius: 4px;
              color: white;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
            ">Add Overlay</button>
          </div>
        </div>
      </div>
    `;
    
    // Add dialog to page
    const dialogContainer = document.createElement('div');
    dialogContainer.innerHTML = dialogHTML;
    document.body.appendChild(dialogContainer);
    
    const input = document.getElementById('overlayTickerInput');
    const addBtn = document.getElementById('overlayDialogAdd');
    const cancelBtn = document.getElementById('overlayDialogCancel');
    const backdrop = dialogContainer.querySelector('.overlay-dialog-backdrop');
    
    // Focus input
    setTimeout(() => input.focus(), 100);
    
    // Handle add
    const handleAdd = async () => {
      const ticker = input.value.trim().toUpperCase();
      console.log('User entered ticker:', ticker);
      
      if (!ticker) {
        input.style.borderColor = '#ff4444';
        return;
      }
      
      // Don't add if it's the main ticker
      if (ticker === this.ticker) {
        alert('This ticker is already the main chart');
        return;
      }
      
      // Don't add if already in overlays
      if (this.overlays.some(o => o.ticker === ticker)) {
        alert('This ticker is already overlaid');
        return;
      }
      
      // Close dialog
      dialogContainer.remove();
      
      // Add overlay
      await this.addOverlay(ticker);
    };
    
    // Handle cancel
    const handleCancel = () => {
      console.log('Dialog cancelled');
      dialogContainer.remove();
    };
    
    // Event listeners
    addBtn.addEventListener('click', handleAdd);
    cancelBtn.addEventListener('click', handleCancel);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) handleCancel();
    });
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAdd();
      if (e.key === 'Escape') handleCancel();
    });
  }
  
  async addOverlay(ticker) {
    const content = this.contentElement;
    const overlaysList = content.querySelector('.chart-overlays-list');
    const overlaysContainer = content.querySelector('.chart-overlays-container');
    
    // Show loading indicator
    const loadingItem = document.createElement('div');
    loadingItem.className = 'overlay-item overlay-loading';
    loadingItem.innerHTML = `
      <span class="overlay-ticker">${ticker}</span>
      <span style="color: #666; font-size: 11px; margin-left: auto;">Loading...</span>
    `;
    overlaysContainer.appendChild(loadingItem);
    overlaysList.style.display = 'block';
    
    try {
      // Subscribe to live updates for this overlay ticker
      try {
        await window.electronAPI.polygonSubscribeTickers([ticker]);
        console.log(`[CHART] Subscribed to overlay ${ticker}`);
      } catch (subError) {
        console.warn(`[CHART] Failed to subscribe to overlay ${ticker}:`, subError);
      }
      
      // Fetch data for overlay ticker with same date range
      const dateRange = this.getDateRange();
      const { timespan, multiplier } = this.getTimespanParams();
      
      const result = await window.electronAPI.polygonGetHistoricalBars({
        ticker: ticker,
        from: dateRange.from,
        to: dateRange.to,
        timespan,
        multiplier,
        includeExtendedHours: this.extendedHoursEnabled
      });
      
      // Remove loading indicator
      loadingItem.remove();
      
      if (!result.success || !result.bars || result.bars.length === 0) {
        throw new Error('No data available for this ticker');
      }
      
      // Generate a random color for this overlay
      const color = this.getRandomColor();
      
      // Add to overlays array
      this.overlays.push({
        ticker: ticker,
        data: result.bars,
        color: color
      });
      
      // Add to UI
      const overlayItem = document.createElement('div');
      overlayItem.className = 'overlay-item';
      overlayItem.innerHTML = `
        <span class="overlay-color-box" style="background-color: ${color};"></span>
        <span class="overlay-ticker">${ticker}</span>
        <button class="overlay-remove-btn" data-ticker="${ticker}">X—</button>
      `;
      
      overlayItem.querySelector('.overlay-remove-btn').addEventListener('click', () => {
        this.removeOverlay(ticker);
      });
      
      overlaysContainer.appendChild(overlayItem);
      overlaysList.style.display = 'block';
      
      // Redraw chart with overlays
      if (this.chartData) {
        this.drawChart(this.chartData);
      }
      
    } catch (error) {
      // Remove loading indicator
      loadingItem.remove();
      
      // Hide overlay list if no overlays
      if (this.overlays.length === 0) {
        overlaysList.style.display = 'none';
      }
      
      alert(`Error adding overlay: ${error.message}`);
    }
  }
  
  removeOverlay(ticker) {
    const content = this.contentElement;
    const overlaysContainer = content.querySelector('.chart-overlays-container');
    const overlaysList = content.querySelector('.chart-overlays-list');
    
    // Unsubscribe from live updates
    window.electronAPI.polygonUnsubscribeTickers([ticker])
      .then(() => console.log(`[CHART] Unsubscribed from overlay ${ticker}`))
      .catch(err => console.warn(`[CHART] Failed to unsubscribe from ${ticker}:`, err));
    
    // Remove from array
    this.overlays = this.overlays.filter(o => o.ticker !== ticker);
    
    // Remove from UI
    const overlayItem = Array.from(overlaysContainer.children).find(
      item => item.querySelector('.overlay-remove-btn').dataset.ticker === ticker
    );
    if (overlayItem) {
      overlayItem.remove();
    }
    
    // Hide list if no overlays
    if (this.overlays.length === 0) {
      overlaysList.style.display = 'none';
    }
    
    // Redraw chart
    if (this.chartData) {
      this.drawChart(this.chartData);
    }
  }
  
  getRandomColor() {
    const colors = [
      '#FF1744', '#4ecdc4', '#45b7d1', '#feca57', '#ff9ff3',
      '#54a0ff', '#48dbfb', '#00d2d3', '#1dd1a1', '#10ac84',
      '#ee5a6f', '#c44569', '#f368e0', '#ff9ff3', '#a29bfe'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  showIndicatorDialog() {
    console.log('showIndicatorDialog called');
    
    // Get modal
    const modal = document.getElementById('addIndicatorModal');
    if (!modal) {
      console.error('Indicator modal not found in DOM');
      return;
    }
    
    console.log('Modal found, showing...');
    
    // Show modal (use flex for proper centering)
    modal.style.display = 'flex';
    
    // Get elements
    const typeSelect = document.getElementById('indicatorTypeSelect');
    const paramsContainer = document.getElementById('indicatorParamsContainer');
    const addBtn = document.getElementById('addIndicatorBtn');
    
    console.log('Elements found:', { typeSelect: !!typeSelect, paramsContainer: !!paramsContainer, addBtn: !!addBtn });
    
    // Reset form
    typeSelect.value = '';
    paramsContainer.style.display = 'none';
    document.querySelectorAll('#indicatorParamsContainer > div').forEach(div => {
      div.style.display = 'none';
    });
    
    // Type change handler
    const handleTypeChange = () => {
      const type = typeSelect.value;
      
      // Hide all param divs first
      document.querySelectorAll('#indicatorParamsContainer > div').forEach(div => {
        div.style.display = 'none';
      });
      
      if (!type) {
        paramsContainer.style.display = 'none';
        return;
      }
      
      paramsContainer.style.display = 'block';
      
      // Show relevant params based on type
      switch(type) {
        case 'SMA':
        case 'EMA':
        case 'HMA':
          const maParamsDiv = document.getElementById('maParams');
          maParamsDiv.style.display = 'block';
          
          // Setup period type toggle
          const periodTypeSelect = document.getElementById('maPeriodType');
          const periodBarsDiv = document.getElementById('maPeriodBars');
          const periodTimeDiv = document.getElementById('maPeriodTime');
          
          if (periodTypeSelect && periodBarsDiv && periodTimeDiv) {
            periodTypeSelect.onchange = (e) => {
              if (e.target.value === 'bars') {
                periodBarsDiv.style.display = 'block';
                periodTimeDiv.style.display = 'none';
              } else {
                periodBarsDiv.style.display = 'none';
                periodTimeDiv.style.display = 'block';
              }
            };
          }
          break;
        case 'KAMA':
          document.getElementById('kamaParams').style.display = 'block';
          break;
        case 'BB':
          document.getElementById('bbParams').style.display = 'block';
          break;
        case 'KC':
          document.getElementById('kcParams').style.display = 'block';
          break;
        case 'RSI':
          document.getElementById('rsiParams').style.display = 'block';
          break;
        case 'ATR':
          document.getElementById('atrParams').style.display = 'block';
          break;
      }
    };
    
    // Remove old listeners
    const newTypeSelect = typeSelect.cloneNode(true);
    typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    // Add new listeners
    newTypeSelect.addEventListener('change', handleTypeChange);
    
    newAddBtn.addEventListener('click', () => {
      const type = newTypeSelect.value;
      if (!type) return;
      
      // Get params based on type
      let params = {};
      switch(type) {
        case 'SMA':
        case 'EMA':
        case 'HMA':
          // Check if using bars or time period
          const periodType = document.getElementById('maPeriodType');
          if (periodType && periodType.value === 'time') {
            params.period = parseInt(document.getElementById('maPeriodTimeSelect').value);
          } else {
            params.period = parseInt(document.getElementById('maPeriod').value);
          }
          break;
        case 'KAMA':
          params.period = parseInt(document.getElementById('kamaPeriod').value);
          params.fast = parseInt(document.getElementById('kamaFast').value);
          params.slow = parseInt(document.getElementById('kamaSlow').value);
          break;
        case 'BB':
          params.period = parseInt(document.getElementById('bbPeriod').value);
          params.stdDev = parseFloat(document.getElementById('bbStdDev').value);
          break;
        case 'KC':
          params.period = parseInt(document.getElementById('kcPeriod').value);
          params.multiplier = parseFloat(document.getElementById('kcMultiplier').value);
          break;
        case 'RSI':
          params.period = parseInt(document.getElementById('rsiPeriod').value);
          break;
        case 'ATR':
          params.period = parseInt(document.getElementById('atrPeriod').value);
          break;
      }
      
      console.log('Adding indicator:', type, params);
      this.addIndicator(type, params);
      modal.style.display = 'none';
    });
  }
  
  addIndicator(type, params) {
    const id = Date.now();
    const indicatorColors = ['#9b59b6', '#e74c3c', '#f39c12', '#1abc9c', '#3498db', '#e67e22'];
    const color = indicatorColors[this.indicators.length % indicatorColors.length];
    const indicator = { id, type, params, color };
    this.indicators.push(indicator);
    
    console.log('Indicator added:', indicator);
    console.log('Total indicators:', this.indicators.length);
    console.log('Chart data exists:', !!this.chartData);
    
    // Update UI
    this.updateIndicatorsList();
    
    // Redraw chart
    if (this.chartData) {
      console.log('Redrawing chart with indicators...');
      this.drawChart(this.chartData);
    } else {
      console.warn('No chart data to redraw');
    }
  }
  
  removeIndicator(id) {
    this.indicators = this.indicators.filter(ind => ind.id !== id);
    this.updateIndicatorsList();
    
    if (this.chartData) {
      this.drawChart(this.chartData);
    }
  }
  
  updateIndicatorsList() {
    const content = this.contentElement;
    const indicatorsList = content.querySelector('.chart-indicators-list');
    const indicatorsContainer = content.querySelector('.chart-indicators-container');
    
    if (!indicatorsList || !indicatorsContainer) return;
    
    if (this.indicators.length === 0) {
      indicatorsList.style.display = 'none';
      indicatorsContainer.innerHTML = '';
      return;
    }
    
    indicatorsList.style.display = 'block';
    indicatorsContainer.innerHTML = this.indicators.map(ind => {
      const color = ind.color || '#9b59b6'; // Use saved color or default
      
      let paramsHTML = '';
      
      // Build editable parameter inputs based on indicator type
      if (ind.type === 'SMA' || ind.type === 'EMA' || ind.type === 'HMA') {
        paramsHTML = `
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Period:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="period" 
                 value="${ind.params.period}" min="1" max="500" 
                 style="width: 50px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 8px;">
        `;
      } else if (ind.type === 'KAMA') {
        paramsHTML = `
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Period:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="period" 
                 value="${ind.params.period}" min="1" max="500" 
                 style="width: 45px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 6px;">
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Fast:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="fast" 
                 value="${ind.params.fast}" min="1" max="100" 
                 style="width: 40px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 6px;">
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Slow:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="slow" 
                 value="${ind.params.slow}" min="1" max="100" 
                 style="width: 40px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 8px;">
        `;
      } else if (ind.type === 'BB') {
        paramsHTML = `
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Period:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="period" 
                 value="${ind.params.period}" min="1" max="500" 
                 style="width: 45px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 6px;">
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">StdDev:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="stdDev" 
                 value="${ind.params.stdDev}" min="0.5" max="5" step="0.1" 
                 style="width: 45px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 8px;">
        `;
      } else if (ind.type === 'KC') {
        paramsHTML = `
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Period:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="period" 
                 value="${ind.params.period}" min="1" max="500" 
                 style="width: 45px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 6px;">
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Mult:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="multiplier" 
                 value="${ind.params.multiplier}" min="0.5" max="5" step="0.1" 
                 style="width: 45px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 8px;">
        `;
      } else if (ind.type === 'RSI' || ind.type === 'ATR') {
        paramsHTML = `
          <label style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Period:</label>
          <input type="number" class="indicator-param-input" data-indicator-id="${ind.id}" data-param="period" 
                 value="${ind.params.period}" min="1" max="500" 
                 style="width: 50px; padding: 2px 4px; background: var(--bg-primary); border: 1px solid var(--border-color); 
                        border-radius: 3px; color: var(--text-primary); font-size: 11px; margin-right: 8px;">
        `;
      }
      
      return `
        <div class="indicator-row" style="
          display: flex;
          align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 3px solid ${color};
          border-radius: 4px;
          padding: 6px 10px;
          margin-bottom: 6px;
        ">
          <input type="color" class="indicator-color-input" data-indicator-id="${ind.id}" 
                 value="${color}" 
                 style="width: 30px; height: 24px; border: none; border-radius: 3px; cursor: pointer; margin-right: 8px;"
                 title="Change color">
          <span style="font-weight: 600; font-size: 12px; color: var(--text-primary); margin-right: 12px; min-width: 50px;">
            ${ind.type}
          </span>
          ${paramsHTML}
          <button class="indicator-remove-btn" data-indicator-id="${ind.id}" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            margin-left: auto;
            padding: 0;
            font-size: 18px;
            line-height: 1;
          " title="Remove indicator">×</button>
        </div>
      `;
    }).join('');
    
    // Add color change listeners
    indicatorsList.querySelectorAll('.indicator-color-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.indicatorId);
        const color = e.target.value;
        
        // Update indicator color
        const indicator = this.indicators.find(ind => ind.id === id);
        if (indicator) {
          indicator.color = color;
          
          // Update the border color immediately
          const row = e.target.closest('.indicator-row');
          if (row) {
            row.style.borderLeft = `3px solid ${color}`;
          }
          
          // Redraw chart with new color
          if (this.chartData) {
            this.drawChart(this.chartData);
          }
        }
      });
    });
    
    // Add input change listeners for live parameter editing
    indicatorsList.querySelectorAll('.indicator-param-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.indicatorId);
        const param = e.target.dataset.param;
        const value = param === 'stdDev' || param === 'multiplier' 
          ? parseFloat(e.target.value) 
          : parseInt(e.target.value);
        
        // Update indicator params
        const indicator = this.indicators.find(ind => ind.id === id);
        if (indicator) {
          indicator.params[param] = value;
          
          // Redraw chart with new params
          if (this.chartData) {
            this.drawChart(this.chartData);
          }
        }
      });
    });
    
    // Add remove listeners
    indicatorsList.querySelectorAll('.indicator-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.indicatorId);
        this.removeIndicator(id);
      });
    });
  }
  
  calculateIndicator(indicator, data) {
    const { type, params } = indicator;
    
    console.log('calculateIndicator called:', type, 'params:', params, 'bars:', data.bars.length);
    console.log('First bar structure:', data.bars[0]);
    console.log('Bar keys:', Object.keys(data.bars[0]));
    
    // Check if bars have 'c' instead of 'close' (common in financial APIs)
    const close = data.bars.map(b => b.c || b.close);
    const high = data.bars.map(b => b.h || b.high);
    const low = data.bars.map(b => b.l || b.low);
    
    console.log('First 5 close prices:', close.slice(0, 5));
    console.log('Close prices type check:', close.slice(0, 5).map(c => typeof c));
    
    // Access indicators from window (exposed by calculations.js)
    if (!window.calculateSMA) {
      console.error('Indicators module not loaded - window.calculateSMA is', typeof window.calculateSMA);
      return null;
    }
    
    let result;
    switch(type) {
      case 'SMA':
        console.log('Calculating SMA with period:', params.period, 'close prices:', close.length);
        result = window.calculateSMA(close, params.period);
        console.log('SMA result:', result ? result.length : 'null', 'first non-null:', result ? result.find(v => v !== null) : 'none');
        console.log('Last 5 SMA values:', result ? result.slice(-5) : 'none');
        return result;
      case 'EMA':
        return window.calculateEMA(close, params.period);
      case 'HMA':
        return window.calculateHMA(close, params.period);
      case 'KAMA':
        return window.calculateKAMA(close, params.period, params.fast, params.slow);
      case 'BB':
        return window.calculateBB(close, params.period, params.stdDev);
      case 'KC':
        return window.calculateKC(high, low, close, params.period, params.multiplier);
      case 'RSI':
        return window.calculateRSIArray(close, params.period);
      case 'ATR':
        return window.calculateATR(high, low, close, params.period);
      default:
        console.error('Unknown indicator type:', type);
        return null;
    }
  }
  
}

function createChartTab() {
  // Default to 'None' group for new tabs (no syncing)
  let groupForNewTab = 'None';
  
  const tab = new ChartTab(nextChartTabId++, groupForNewTab);
  chartTabs.push(tab);
  
  // Add to DOM
  document.getElementById('chartTabsContainer').appendChild(tab.tabElement);
  document.getElementById('chartTabContents').appendChild(tab.contentElement);
  
  // Activate the new tab
  activateChartTab(tab.id);
  
  // Automatically open ticker selector and focus input
  setTimeout(() => {
    const dropdownMenu = tab.contentElement.querySelector('.ticker-dropdown-menu');
    const tickerInput = tab.contentElement.querySelector('.chart-ticker-input');
    
    if (dropdownMenu) {
      dropdownMenu.style.display = 'block';
      tab.loadWatchlistsInDropdown();
    }
    
    if (tickerInput) {
      tickerInput.focus();
    }
  }, 50);
  
  return tab;
}

function activateChartTab(tabId) {
  activeChartTabId = tabId;
  
  chartTabs.forEach(tab => {
    const isActive = tab.id === tabId;
    tab.tabElement.classList.toggle('active', isActive);
    tab.contentElement.classList.toggle('active', isActive);
  });
  
  // Redraw the active tab's chart after a short delay to fix sizing issues
  // This ensures the canvas has the correct dimensions after tab switch
  const activeTab = chartTabs.find(t => t.id === tabId);
  if (activeTab && activeTab.chartData) {
    setTimeout(() => {
      activeTab.drawChart(activeTab.chartData).then(() => {
        // Reinitialize mouse handlers for new chart after redraw
        if (window.drawingTools) {
          const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
          drawingTools.initializeChartMouseEvents();
          drawingTools.enableShapeEditing(chartCanvas);
          console.log('[CHART] Drawing tools reinitialized after tab switch with shape editing');
        }
      });
    }, 10);
  }
}

function closeChartTab(tabId) {
  const index = chartTabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  const tab = chartTabs[index];
  
  // Remove from DOM
  tab.tabElement.remove();
  tab.contentElement.remove();
  
  // Remove from array
  chartTabs.splice(index, 1);
  
  // If we closed the active tab, activate another
  if (activeChartTabId === tabId && chartTabs.length > 0) {
    // Activate the tab to the left, or the first tab
    const newActiveIndex = Math.max(0, index - 1);
    activateChartTab(chartTabs[newActiveIndex].id);
  }
  
  // If no tabs left, create a new one
  if (chartTabs.length === 0) {
    createChartTab();
  }
}

function getActiveChartTab() {
  return chartTabs.find(t => t.id === activeChartTabId);
}

// Initialize chart tabs system (called after DOM is ready)
function initializeChartTabs() {
  // Get DOM element references
  chartNewTabBtn = document.getElementById('chartNewTabBtn');
  sidebarToggleBtn = document.getElementById('sidebarToggle');
  
  // Initialize drawing toolbar
  const toolbarContainer = document.getElementById('drawingToolbarContainer');
  if (toolbarContainer) {
    const toolbar = drawingTools.createToolbar();
    toolbarContainer.appendChild(toolbar);
    
    // Don't initialize mouse handlers here - they'll be initialized after each chart is created
  }
  
  // Setup toolbar toggle button
  const toggleBtn = document.getElementById('drawingToolbarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      drawingTools.expand();
    });
  }
  
  // New tab button
  chartNewTabBtn?.addEventListener('click', () => {
    createChartTab();
  });
  
  // Create initial tab
  if (chartTabs.length === 0) {
    createChartTab();
  }
  
  // Show sidebar toggle button initially
  sidebarToggleBtn?.classList.add('visible');
}

// =====================================================

// Export functions for external use
export const ChartTabSystem = {
  initialize: initializeChartTabs,
  createTab: createChartTab,
  activateTab: activateChartTab,
  closeTab: closeChartTab,
  getActiveTab: getActiveChartTab,
  getAllTabs: () => chartTabs,
  drawingTools: drawingTools,
  ChartTab
};

// Expose to window for backward compatibility
window.ChartTabSystem = ChartTabSystem;
window.createChartTab = createChartTab;
window.activateChartTab = activateChartTab;
window.closeChartTab = closeChartTab;
window.drawingTools = drawingTools;
window.getActiveChartTab = getActiveChartTab;
window.initializeChartTabs = initializeChartTabs;
window.selectChartTicker = (ticker) => {
  const tab = getActiveChartTab();
  if (tab) tab.setTicker(ticker);
};

export default ChartTabSystem;
