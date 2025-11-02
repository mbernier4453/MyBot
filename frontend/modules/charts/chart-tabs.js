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
    
    // Custom colors for this chart tab (null = use theme colors)
    this.customUpColor = null;
    this.customDownColor = null;
    this.customLineColor = null;
    
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
    
    // Legend toggle
    const legendToggle = content.querySelector('.chart-legend-toggle');
    legendToggle.addEventListener('change', (e) => {
      const legendEl = content.querySelector('.custom-chart-legend');
      if (legendEl) {
        if (e.target.checked) {
          legendEl.classList.remove('hidden');
        } else {
          legendEl.classList.add('hidden');
        }
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
    
    // Run Regression button
    const runRegressionBtn = content.querySelector('.chart-run-regression-btn');
    if (runRegressionBtn) {
      runRegressionBtn.addEventListener('click', () => {
        console.log('Run Regression button clicked');
        this.runRegression();
      });
    }
    
    // Update regression button visibility
    this.updateRegressionButtonVisibility();
    
    // Export button
    const exportBtn = content.querySelector('.chart-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.showExportDialog();
      });
    }
    
    // Load Preset button
    const loadPresetBtn = content.querySelector('.chart-load-preset-btn');
    if (loadPresetBtn) {
      loadPresetBtn.addEventListener('click', () => {
        this.showLoadPresetDialog();
      });
    }
    
    // Save Preset button
    const savePresetBtn = content.querySelector('.chart-save-preset-btn');
    if (savePresetBtn) {
      savePresetBtn.addEventListener('click', () => {
        this.showSavePresetDialog();
      });
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
    
    // Main ticker color inputs
    const mainUpColorInput = content.querySelector('.main-up-color-input');
    const mainDownColorInput = content.querySelector('.main-down-color-input');
    const mainLineColorInput = content.querySelector('.main-line-color-input');
    
    // Function to update color picker values with current theme colors
    const updateColorPickers = () => {
      if (mainUpColorInput && !this.customUpColor) {
        mainUpColorInput.value = window.getPositiveColor();
      }
      if (mainDownColorInput && !this.customDownColor) {
        mainDownColorInput.value = window.getNegativeColor();
      }
      if (mainLineColorInput && !this.customLineColor) {
        mainLineColorInput.value = '#4a9eff';
      }
    };
    
    // Initialize immediately
    updateColorPickers();
    
    // Also update after a short delay to catch CSS variables after they're loaded
    setTimeout(updateColorPickers, 100);
    
    // Add event listeners
    if (mainUpColorInput) {
      mainUpColorInput.addEventListener('change', (e) => {
        this.customUpColor = e.target.value;
        if (this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    if (mainDownColorInput) {
      mainDownColorInput.addEventListener('change', (e) => {
        this.customDownColor = e.target.value;
        if (this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
    if (mainLineColorInput) {
      mainLineColorInput.addEventListener('change', (e) => {
        this.customLineColor = e.target.value;
        if (this.chartData) {
          this.drawChart(this.chartData);
        }
      });
    }
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
  
  async setTicker(ticker, updateGroup = true) {
    console.log(`%c[ChartTab ${this.id}] setTicker`, 'color: cyan', 'ticker:', ticker, 'current:', this.ticker, 'updateGroup:', updateGroup, 'tabElement exists:', !!this.tabElement);
    
    // Set loading flag to prevent updateLiveInfo from using stale data
    this.isLoadingChart = true;
    
    this.ticker = ticker;
    this.updateTabLabel();
    
    // Only update group ticker if requested (to avoid cascading updates)
    if (updateGroup) {
      tickerGroups.setGroupTicker(this.group, ticker);
    }
    
  // Subscribe to websocket for this ticker (Electron only)
  if (window.electronAPI && window.electronAPI.polygonSubscribeTickers) {
    try {
      await window.electronAPI.polygonSubscribeTickers([ticker]);
      console.log(`[WEBSOCKET] Subscribed to ${ticker}`);
      
      // ALWAYS force fetch ticker data immediately for latest price
      console.log(`[WEBSOCKET] Force fetching latest data for ${ticker}`);
      await window.electronAPI.polygonFetchTickers([ticker]);
      
      // Wait a bit for the fetch to complete and update treemapData
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[WEBSOCKET] Failed to subscribe to ${ticker}:`, error);
    }
  }
  
  // Load chart first, THEN update live info
  await this.loadChart();
  
  // Clear loading flag after chart is loaded
  this.isLoadingChart = false;
  
  this.updateLiveInfo();
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
  
  isMarketOpen() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const time = hours * 100 + minutes;
    
    // Weekend
    if (day === 0 || day === 6) return false;
    
    // Regular hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 930;
    const marketClose = 1600;
    
    return time >= marketOpen && time < marketClose;
  }

  updateChartWithLiveData(ticker, wsData) {
    // Only update during market hours
    if (!this.isMarketOpen()) {
      console.log(`[LIVE CHART] Market closed, skipping chart update for ${ticker}`);
      return;
    }

    // Update main ticker
    if (this.ticker === ticker && this.chartData && this.chartData.length > 0) {
      const lastBar = this.chartData[this.chartData.length - 1];
      const now = new Date();
      const barTime = new Date(lastBar.t);
      
      // Check if this update is for the current bar (same day for daily, same period for intraday)
      const isSameBar = barTime.toDateString() === now.toDateString();
      
      if (isSameBar) {
        // Update the last bar with live data
        lastBar.c = wsData.close;
        lastBar.h = Math.max(lastBar.h, wsData.close);
        lastBar.l = Math.min(lastBar.l, wsData.close);
        lastBar.v = wsData.volume || lastBar.v;
        
        console.log(`[LIVE CHART] Updated ${ticker} bar - Close: $${wsData.close.toFixed(2)}, Vol: ${wsData.volume}`);
        
        // Redraw chart with updated data
        const { timespan } = this.getTimespanParams();
        this.drawChart(this.chartData, timespan);
      }
    }
    
    // Update overlays
    if (this.overlays && this.overlays.length > 0) {
      this.overlays.forEach(overlay => {
        if (overlay.ticker === ticker && overlay.data && overlay.data.length > 0) {
          const lastBar = overlay.data[overlay.data.length - 1];
          const now = new Date();
          const barTime = new Date(lastBar.t);
          const isSameBar = barTime.toDateString() === now.toDateString();
          
          if (isSameBar) {
            lastBar.c = wsData.close;
            lastBar.h = Math.max(lastBar.h, wsData.close);
            lastBar.l = Math.min(lastBar.l, wsData.close);
            lastBar.v = wsData.volume || lastBar.v;
            
            console.log(`[LIVE CHART] Updated overlay ${ticker} bar`);
            
            // Redraw chart with updated overlay data
            const { timespan } = this.getTimespanParams();
            this.drawChart(this.chartData, timespan);
          }
        }
      });
    }
  }

async updateLiveInfo(freshWsData = null) {
  if (!this.ticker) return;
  
  // Don't update if chart is currently loading (prevents showing wrong ticker's data)
  if (this.isLoadingChart) {
    console.log(`[LIVE INFO] Skipping ${this.ticker} - chart is loading`);
    return;
  }
  
  // Don't update if chart data hasn't loaded yet
  if (!this.chartData || this.chartData.length === 0) {
    console.log(`[LIVE INFO] Skipping ${this.ticker} - chart data not loaded yet`);
    return;
  }
  
  const isMarketOpen = this.isMarketOpen();
  
  // If market is closed and this was triggered by websocket, ignore it completely
  if (!isMarketOpen && freshWsData) {
    console.log(`[LIVE INFO] Ignoring websocket update for ${this.ticker} - market is closed`);
    return;
  }
  
  const content = this.contentElement;
  
  // Update ticker display
  const tickerEl = content.querySelector('.chart-live-ticker');
  if (tickerEl) tickerEl.textContent = this.ticker;
    
  // Get current price and volume
  let currentPrice = null;
  let currentVolume = null;
  let prevClose = null;
    
  // Use fresh websocket data if provided, otherwise get from treemapData
  const wsData = freshWsData || treemapData.get(this.ticker);
    
    // ONLY use websocket during regular market hours
    if (isMarketOpen && wsData) {
      currentPrice = wsData.close;
      currentVolume = wsData.volume;
      prevClose = wsData.prevClose;
      console.log(`[LIVE INFO] ${this.ticker} LIVE (market open): $${currentPrice} (prev: $${prevClose})`);
    } 
    // Use chart data when market is closed - IGNORE websocket completely
    else if (this.chartData && this.chartData.length > 0) {
      const lastBar = this.chartData[this.chartData.length - 1];
      currentPrice = lastBar.c;
      currentVolume = lastBar.v;
      
      // Get previous bar for % change
      if (this.chartData.length >= 2) {
        prevClose = this.chartData[this.chartData.length - 2].c;
      }
      console.log(`[LIVE INFO] ${this.ticker} CLOSE (market ${isMarketOpen ? 'open but no ws' : 'closed'}): $${currentPrice} (prev: $${prevClose})`);
    }
    
    // Update price
    const priceEl = content.querySelector('.chart-live-price');
    if (priceEl && currentPrice) {
      priceEl.textContent = `$${currentPrice.toFixed(2)}`;
    } else if (priceEl) {
      priceEl.textContent = '--';
    }
    
    // Update % change (from previous day close)
    const changeEl = content.querySelector('.chart-live-change');
    if (changeEl && currentPrice && prevClose) {
      const changePercent = ((currentPrice - prevClose) / prevClose) * 100;
      changeEl.innerHTML = `<span class="numeric">${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%</span>`;
      changeEl.style.backgroundColor = changePercent >= 0 ? '#00aa55' : '#ff4444';
      changeEl.style.color = 'white';
      console.log(`[LIVE INFO] ${this.ticker} change: ${changePercent.toFixed(2)}%`);
    } else if (changeEl) {
      changeEl.textContent = '--';
      changeEl.style.backgroundColor = '#666';
    }
    
    // Update volume
    const volumeEl = content.querySelector('.chart-live-volume');
    if (volumeEl && currentVolume) {
      const volDisplay = currentVolume >= 1e6 
        ? (currentVolume / 1e6).toFixed(2) + 'M'
        : currentVolume >= 1e3
        ? (currentVolume / 1e3).toFixed(1) + 'K'
        : currentVolume.toFixed(0);
      volumeEl.innerHTML = `Vol: <span class="numeric">${volDisplay}</span>`;
    } else if (volumeEl) {
      volumeEl.textContent = 'Vol: --';
    }
    
    // Update market cap
    const marketCapEl = content.querySelector('.chart-live-marketcap');
    if (marketCapEl && wsData && wsData.marketCap) {
      marketCapEl.innerHTML = 'MCap: <span class="numeric">$' + (wsData.marketCap / 1e9).toFixed(2) + 'B</span>';
    } else if (marketCapEl) {
      marketCapEl.textContent = '';
    }
  }
  
  updateCandlePercentage(bars) {
    if (!bars || bars.length === 0) return;
    
    const content = this.contentElement;
    const candleChangeEl = content.querySelector('.chart-candle-change');
    if (!candleChangeEl) return;
    
    // Calculate percentage from first to last candle
    const firstClose = bars[0].c;
    const lastClose = bars[bars.length - 1].c;
    const changePercent = ((lastClose - firstClose) / firstClose) * 100;
    
    // Update display
    candleChangeEl.innerHTML = `<span class="numeric">${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%</span>`;
    if (changePercent >= 0) {
      candleChangeEl.style.backgroundColor = '#00aa55';
      candleChangeEl.style.color = 'white';
    } else {
      candleChangeEl.style.backgroundColor = '#ff4444';
      candleChangeEl.style.color = 'white';
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
      // Subscribe to live updates for this ticker (Electron only)
      if (window.electronAPI && window.electronAPI.polygonSubscribeTickers) {
        try {
          await window.electronAPI.polygonSubscribeTickers([this.ticker]);
          console.log(`[CHART] Subscribed to ${this.ticker}`);
        } catch (subError) {
          console.warn(`[CHART] Failed to subscribe to ${this.ticker}:`, subError);
        }
      }
      
      const dateRange = this.getDateRange();
      const { timespan, multiplier } = this.getTimespanParams();
      
      let result;
      
      if (window.electronAPI && window.electronAPI.polygonGetHistoricalBars) {
        // Electron mode
        result = await window.electronAPI.polygonGetHistoricalBars({
          ticker: this.ticker,
          from: dateRange.from,
          to: dateRange.to,
          timespan,
          multiplier,
          includeExtendedHours: this.extendedHoursEnabled
        });
      } else {
        // Browser mode - use REST API
        const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
        if (!apiKey) {
          throw new Error('API key not available');
        }
        
        const url = `https://api.polygon.io/v2/aggs/ticker/${this.ticker}/range/${multiplier}/${timespan}/${dateRange.from}/${dateRange.to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
          throw new Error('No data available for this ticker and timeframe');
        }
        
        // Convert Polygon format to internal format
        result = {
          success: true,
          bars: data.results.map(bar => ({
            t: bar.t,
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v
          }))
        };
      }
      
      loadingEl.style.display = 'none';
      
      if (!result.success || !result.bars || result.bars.length === 0) {
        throw new Error('No data available for this ticker and timeframe');
      }
      
      // Store chart data - make a COPY if market is closed to prevent modifications
      if (this.isMarketOpen()) {
        this.chartData = result.bars;
      } else {
        // Deep copy to prevent any modifications when market is closed
        this.chartData = JSON.parse(JSON.stringify(result.bars));
        console.log(`[CHART] Froze chart data (market closed) - last bar close: $${this.chartData[this.chartData.length - 1].c}`);
      }
      this.drawChart(this.chartData, timespan);
      
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
    
    // Get colors - use custom colors if set, otherwise use theme colors
    const positiveColor = this.customUpColor || window.getPositiveColor();
    const negativeColor = this.customDownColor || window.getNegativeColor();
    
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
        
        // Always show real prices in hover text, even when normalized
        return `${date}<br>O: <span class="numeric">$${open[i].toFixed(2)}</span><br>H: <span class="numeric">$${high[i].toFixed(2)}</span><br>L: <span class="numeric">$${low[i].toFixed(2)}</span><br>C: <span class="numeric">$${close[i].toFixed(2)}</span>`;
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
      hovertemplate: 'Volume: <span class="numeric">%{y:,.0f}</span><extra></extra>'
    };
    
    const layout = {
      plot_bgcolor: '#000000',
      paper_bgcolor: '#000000',
      font: { family: 'Quantico, monospace', color: '#e0e0e0' },
      xaxis: {
        type: 'category',
        rangeslider: { visible: false },
        gridcolor: '#1a1a1a',
        griddash: 'dot',
        showgrid: false,
        tickangle: tickAngle,
        tickfont: { family: 'Quantico, monospace', size: tickFontSize },
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
        bgcolor: 'rgba(26, 26, 26, 0.85)',
        bordercolor: '#444',
        font: { family: 'Quantico, monospace', color: '#e0e0e0', size: 12 },
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
      
      // Use custom line color if set, otherwise default blue
      const lineColor = this.customLineColor || '#4a9eff';
      
      mainTrace = {
        type: 'scatter',
        mode: 'lines',
        x: dates,
        y: normalizedClose,
        name: this.ticker,
        line: { color: lineColor, width: 2 },
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
      // Hide Plotly legend - we use custom legend instead
      layout.showlegend = false;
      
      // Add name to main trace for hover
      if (this.chartType === 'line') {
        mainTrace.name = this.ticker;
        mainTrace.showlegend = false;
      } else {
        mainTrace.name = this.ticker;
        mainTrace.showlegend = false;
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
            line: { color: overlay.lineColor, width: 2 },
            xaxis: 'x',
            yaxis: 'y',
            hovertemplate: getOverlayHoverTemplate(),
            showlegend: false
          };
        } else {
          // Candlestick chart - use the stored up/down colors
          overlayTrace = {
            type: 'candlestick',
            x: overlayDates,
            open: normalizedOverlayOpen,
            high: normalizedOverlayHigh,
            low: normalizedOverlayLow,
            close: normalizedOverlayClose,
            name: overlay.ticker,
            increasing: { 
              line: { color: overlay.upColor, width: 1 },
              fillcolor: overlay.upColor
            },
            decreasing: { 
              line: { color: overlay.downColor, width: 1 },
              fillcolor: overlay.downColor
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
            showlegend: false
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
            color: overlay.lineColor  // Use line color for indicator inheritance
          });
        });
      }
      
      console.log('Data sources for indicators:', dataSources.length, dataSources.map(s => s.ticker));
      
      // Detect which indicators exist to set up axes properly
      const hasRSIorStochRSI = this.indicators.some(ind => ind.type === 'RSI' || ind.type === 'StochRSI');
      const hasATR = this.indicators.some(ind => ind.type === 'ATR');
      
      // Setup axis domains once based on which indicators are present
      if (hasRSIorStochRSI && hasATR) {
        // 4 panels: Main + Volume + RSI/StochRSI + ATR
        layout.yaxis.domain = [0.55, 1];    // Main chart: top 45%
        layout.yaxis2.domain = [0.38, 0.53]; // Volume: 15%
      } else if (hasRSIorStochRSI || hasATR) {
        // 3 panels: Main + Volume + one indicator
        layout.yaxis.domain = [0.40, 1];    // Main chart: top 60%
        layout.yaxis2.domain = [0.22, 0.38]; // Volume: 16%
      }
      
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
          
          // Store indicator values for CSV export
          if (!this.calculatedIndicators) {
            this.calculatedIndicators = {};
          }
          const indicatorKey = `${source.ticker}_${indicator.type}_${JSON.stringify(indicator.params)}`;
          this.calculatedIndicators[indicatorKey] = result;
          
          const dates = source.bars.map(b => formatDate(b.t));
          const baseColor = indicator.color || '#9b59b6'; // Use indicator's saved color
          
          // Use overlay-specific color if set, otherwise fall back to overlay's line color or indicator color
          let color;
          if (source.isMain) {
            color = baseColor;
          } else {
            // Check for overlay-specific indicator color
            color = (indicator.overlayColors && indicator.overlayColors[source.ticker]) 
                    ? indicator.overlayColors[source.ticker] 
                    : source.color;
          }
          
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
              name: `${label} ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1 : 0.8, dash: 'dash' },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: sourceIdx === 0, // Only show one legend entry
              legendgroup: `${indicator.type}-${indIdx}`,
              hovertemplate: `${source.ticker} ${label} Upper: %{y:.2f}<extra></extra>`
            });
            
            // Middle band
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedMiddle,
              name: `${label} ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1.5 : 1 },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: false,
              legendgroup: `${indicator.type}-${indIdx}`,
              hovertemplate: `${source.ticker} ${label} Middle: %{y:.2f}<extra></extra>`
            });
            
            // Lower band
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: normalizedLower,
              name: `${label} ${params}${tickerLabel}`,
              line: { color: color, width: source.isMain ? 1 : 0.8, dash: 'dash' },
              opacity: opacity,
              xaxis: 'x',
              yaxis: 'y',
              showlegend: false,
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
              hovertemplate: `${source.ticker} RSI: <span class="numeric">%{y:.2f}</span><extra></extra>`
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
              
              // Create y3 axis for RSI (domains already set above)
              const y3Domain = hasATR ? [0.19, 0.36] : [0, 0.20];
              layout.yaxis3 = {
                title: 'RSI',
                titlefont: { color: baseColor },
                tickfont: { color: baseColor },
                domain: y3Domain,
                range: [0, 100],
                showgrid: true,
                gridcolor: '#1a1a1a',
                zeroline: false
              };
            }
          } else if (indicator.type === 'StochRSI') {
            // Stochastic RSI overlays with RSI on y3 axis
            // result is {k: Array, d: Array}
            if (result && result.k && result.d) {
              // %K line
              traces.push({
                type: 'scatter',
                mode: 'lines',
                x: dates,
                y: result.k,
                name: `${source.ticker} StochRSI %K`,
                line: { color: color, width: source.isMain ? 2 : 1.5 },
                opacity: opacity,
                xaxis: 'x',
                yaxis: 'y3',
                showlegend: true,
                hovertemplate: `${source.ticker} StochRSI %K: <span class="numeric">%{y:.2f}</span><extra></extra>`
              });
              
              // %D line (use slightly darker/lighter color)
              const dColor = this.darkenColor(color, 0.3);
              traces.push({
                type: 'scatter',
                mode: 'lines',
                x: dates,
                y: result.d,
                name: `${source.ticker} StochRSI %D`,
                line: { color: dColor, width: source.isMain ? 1.5 : 1, dash: 'dash' },
                opacity: opacity,
                xaxis: 'x',
                yaxis: 'y3',
                showlegend: true,
                hovertemplate: `${source.ticker} StochRSI %D: <span class="numeric">%{y:.2f}</span><extra></extra>`
              });
            }
            
            // Setup y3 axis if not already done (shared with RSI)
            if (!layout.yaxis3 && sourceIdx === 0) {
              [20, 80].forEach((level, idx) => {
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  x: [dates[0], dates[dates.length - 1]],
                  y: [level, level],
                  name: idx === 0 ? 'StochRSI Levels' : '',
                  line: { color: '#666', width: 1, dash: 'dot' },
                  xaxis: 'x',
                  yaxis: 'y3',
                  showlegend: idx === 0,
                  hoverinfo: 'skip'
                });
              });
              
              // Create y3 axis for StochRSI (domains already set above)
              const y3Domain = hasATR ? [0.19, 0.36] : [0, 0.20];
              layout.yaxis3 = {
                title: 'StochRSI',
                titlefont: { color: baseColor },
                tickfont: { color: baseColor },
                domain: y3Domain,
                range: [0, 100],
                showgrid: true,
                gridcolor: '#1a1a1a',
                zeroline: false
              };
            } else if (layout.yaxis3 && sourceIdx === 0) {
              // RSI already created y3, update title to show both
              layout.yaxis3.title = 'RSI / StochRSI';
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
              hovertemplate: `${source.ticker} ATR: <span class="numeric">%{y:.2f}</span><extra></extra>`
            });
            
            // Setup y4 axis for ATR if not already done
            if (!layout.yaxis4 && sourceIdx === 0) {
              // Domains already set above - just create the axis
              const y4Domain = hasRSIorStochRSI ? [0, 0.17] : [0, 0.20];
              layout.yaxis4 = {
                title: 'ATR',
                titlefont: { color: baseColor },
                tickfont: { color: baseColor },
                domain: y4Domain,
                showgrid: true,
                gridcolor: '#1a1a1a',
                zeroline: false
              };
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
              hovertemplate: `${source.ticker} ${label}: <span class="numeric">%{y:.2f}</span><extra></extra>`
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
      // Force numeric font on all hover labels
      setTimeout(() => {
        const hoverTexts = chartCanvas.querySelectorAll('.hoverlayer text, g.hovertext text, .hoverlabel text');
        hoverTexts.forEach(el => {
          el.style.fontFamily = 'Quantico, monospace';
        });
      }, 50);
      
      // Update candle percentage display
      this.updateCandlePercentage(bars);
      
      // Store reference for drawing tools
      chartCanvas.plotlyChart = chartCanvas;
      
      // Create custom legend element
      let legendEl = chartCanvas.parentElement.querySelector('.custom-chart-legend');
      if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.className = 'custom-chart-legend';
        chartCanvas.parentElement.style.position = 'relative';
        chartCanvas.parentElement.appendChild(legendEl);
      }
      
      // Add hover handler for custom legend
      chartCanvas.on('plotly_hover', (data) => {
        if (!data.points || data.points.length === 0) return;
        
        const point = data.points[0];
        const xIndex = point.pointIndex;
        
        let html = '';
        
        // Get main ticker color (from candlestick)
        const mainColor = close[xIndex] >= open[xIndex] ? getPositiveColor() : getNegativeColor();
        
        // Always show main OHLC first with color indicator
        traces.forEach((trace, idx) => {
          if (trace.type === 'candlestick' && trace.name === this.ticker) {
            html += `<div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 12px; height: 12px; background: ${mainColor}; border-radius: 2px; margin-right: 6px;"></div>
              <span style="font-weight: bold;">${trace.name}</span>
            </div>`;
            if (trace.open && trace.open[xIndex] !== undefined) {
              html += `<div style="margin-left: 18px;">O: <span class="numeric">$${trace.open[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">H: <span class="numeric">$${trace.high[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">L: <span class="numeric">$${trace.low[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">C: <span class="numeric">$${trace.close[xIndex].toFixed(2)}</span></div>`;
            }
          }
        });
        
        // Show overlay stocks OHLC with their colors
        if (this.overlays && this.overlays.length > 0) {
          this.overlays.forEach(overlay => {
            const overlayTrace = traces.find(t => t.type === 'candlestick' && t.name === overlay.ticker);
            if (overlayTrace && overlayTrace.open && overlayTrace.open[xIndex] !== undefined) {
              // Determine if this candle is up or down
              const isUp = overlayTrace.close[xIndex] >= overlayTrace.open[xIndex];
              const candleColor = isUp ? overlay.upColor : overlay.downColor;
              
              html += `<div style="display: flex; align-items: center; margin-top: 8px; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; background: ${candleColor}; border-radius: 2px; margin-right: 6px;"></div>
                <span style="font-weight: bold;">${overlay.ticker}</span>
              </div>`;
              html += `<div style="margin-left: 18px;">O: <span class="numeric">$${overlayTrace.open[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">H: <span class="numeric">$${overlayTrace.high[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">L: <span class="numeric">$${overlayTrace.low[xIndex].toFixed(2)}</span></div>`;
              html += `<div style="margin-left: 18px;">C: <span class="numeric">$${overlayTrace.close[xIndex].toFixed(2)}</span></div>`;
            } else {
              // For line charts, use the line color
              const lineTrace = traces.find(t => t.type === 'scatter' && t.name === overlay.ticker);
              if (lineTrace && lineTrace.y && lineTrace.y[xIndex] !== undefined) {
                html += `<div style="display: flex; align-items: center; margin-top: 8px; margin-bottom: 4px;">
                  <div style="width: 12px; height: 12px; background: ${overlay.lineColor}; border-radius: 2px; margin-right: 6px;"></div>
                  <span style="font-weight: bold;">${overlay.ticker}: <span class="numeric">${lineTrace.y[xIndex].toFixed(2)}</span></span>
                </div>`;
              }
            }
          });
        }
        
        // Then show indicators in order with their colors
        if (this.indicators && this.indicators.length > 0) {
          this.indicators.forEach(ind => {
            // Find all traces for this indicator (might be multiple for main + overlays)
            const indTraces = traces.filter(t => 
              t.type === 'scatter' && 
              t.name && 
              t.name.includes(ind.type) &&
              t.y && 
              t.y[xIndex] !== undefined && 
              t.y[xIndex] !== null
            );
            
            // Group BB/KC bands together
            if (ind.type === 'BB' || ind.type === 'KC') {
              // BB/KC create 3 traces per ticker (main + overlays), process in groups of 3
              for (let i = 0; i < indTraces.length; i += 3) {
                const trace1 = indTraces[i];
                const trace2 = indTraces[i + 1];
                const trace3 = indTraces[i + 2];
                
                if (trace1 && trace2 && trace3) {
                  const traceColor = trace1.line ? trace1.line.color : ind.color;
                  
                  // Get the 3 values and sort them
                  const values = [
                    trace1.y[xIndex],
                    trace2.y[xIndex],
                    trace3.y[xIndex]
                  ].sort((a, b) => a - b); // Sort ascending (lower, middle, upper)
                  
                  const lower = values[0].toFixed(2);
                  const middle = values[1].toFixed(2);
                  const upper = values[2].toFixed(2);
                  
                  html += `<div style="display: flex; align-items: center; margin-top: 4px;">
                    <div style="width: 12px; height: 12px; background: ${traceColor}; border-radius: 2px; margin-right: 6px;"></div>
                    <span>${trace1.name}: <span class="numeric">${lower}</span> <span class="numeric">${middle}</span> <span class="numeric">${upper}</span></span>
                  </div>`;
                }
              }
            } else {
              // Normal indicator - show each trace separately
              indTraces.forEach(indTrace => {
                const traceColor = indTrace.line ? indTrace.line.color : ind.color;
                html += `<div style="display: flex; align-items: center; margin-top: 4px;">
                  <div style="width: 12px; height: 12px; background: ${traceColor}; border-radius: 2px; margin-right: 6px;"></div>
                  <span>${indTrace.name}: <span class="numeric">${indTrace.y[xIndex].toFixed(2)}</span></span>
                </div>`;
              });
            }
          });
        }
        
        legendEl.innerHTML = html || '<div>No data</div>';
      });
      
      chartCanvas.on('plotly_unhover', () => {
        legendEl.innerHTML = '<div style="color: #666;">Hover over chart</div>';
      });
      
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
    
    // Check if already added
    if (this.overlays.find(o => o.ticker === ticker)) {
      alert(`${ticker} is already added as an overlay`);
      return;
    }
    
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
      
      let result;
      
      if (window.electronAPI && window.electronAPI.polygonGetHistoricalBars) {
        // Electron mode
        result = await window.electronAPI.polygonGetHistoricalBars({
          ticker: ticker,
          from: dateRange.from,
          to: dateRange.to,
          timespan,
          multiplier,
          includeExtendedHours: this.extendedHoursEnabled
        });
      } else {
        // Browser mode - use REST API
        const apiKey = window.POLYGON_API_KEY || window.api?.POLYGON_API_KEY;
        if (!apiKey) {
          throw new Error('API key not available');
        }
        
        const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${dateRange.from}/${dateRange.to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
          throw new Error('No data available for this ticker');
        }
        
        // Convert Polygon format to internal format
        result = {
          success: true,
          bars: data.results.map(bar => ({
            t: bar.t,
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v
          }))
        };
      }
      
      if (!result.success || !result.bars || result.bars.length === 0) {
        throw new Error('No data available for this ticker');
      }
      
      // Calculate auto-lightened colors based on overlay index
      const overlayIndex = this.overlays.length;
      const lightenFactor = (overlayIndex + 1) * 0.25; // 25%, 50%, 75%, etc.
      
      const basePositiveColor = getPositiveColor();
      const baseNegativeColor = getNegativeColor();
      const increasingColor = lightenColor(basePositiveColor, lightenFactor);
      const decreasingColor = lightenColor(baseNegativeColor, lightenFactor);
      
      // Generate line color (random but can be changed by user)
      const lineColor = this.getRandomColor();
      
      // Add to overlays array with three separate colors
      this.overlays.push({
        ticker: ticker,
        data: result.bars,
        upColor: increasingColor,
        downColor: decreasingColor,
        lineColor: lineColor
      });
      
      // Update the Fields list (includes both overlays and indicators)
      this.updateIndicatorsList();
      
      // Redraw chart with overlays
      if (this.chartData) {
        this.drawChart(this.chartData);
      }

      // Update regression button visibility
      this.updateRegressionButtonVisibility();
      
    } catch (error) {
      // Update regression button visibility
      this.updateRegressionButtonVisibility();
      
      alert(`Error adding overlay: ${error.message}`);
    }
  }
  
  removeOverlay(ticker) {
    // Unsubscribe from live updates (Electron only)
    if (window.electronAPI && window.electronAPI.polygonUnsubscribeTickers) {
      window.electronAPI.polygonUnsubscribeTickers([ticker])
        .then(() => console.log(`[CHART] Unsubscribed from overlay ${ticker}`))
        .catch(err => console.warn(`[CHART] Failed to unsubscribe from ${ticker}:`, err));
    }
    
    // Remove from array
    this.overlays = this.overlays.filter(o => o.ticker !== ticker);
    
    // Update the Fields list
    this.updateIndicatorsList();
    
    // Redraw chart
    if (this.chartData) {
      this.drawChart(this.chartData);
    }

    // Update regression button visibility
    this.updateRegressionButtonVisibility();
  }
  
  getRandomColor() {
    const colors = [
      '#FF1744', '#4ecdc4', '#45b7d1', '#feca57', '#ff9ff3',
      '#54a0ff', '#48dbfb', '#00d2d3', '#1dd1a1', '#10ac84',
      '#ee5a6f', '#c44569', '#f368e0', '#ff9ff3', '#a29bfe'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  updateRegressionButtonVisibility() {
    const content = this.contentElement;
    const runRegressionBtn = content.querySelector('.chart-run-regression-btn');
    if (runRegressionBtn) {
      if (this.overlays && this.overlays.length > 0) {
        runRegressionBtn.style.display = 'block';
      } else {
        runRegressionBtn.style.display = 'none';
      }
    }
  }

  async runRegression() {
    if (!this.chartData || !this.overlays || this.overlays.length === 0) {
      alert('No overlay tickers available for regression analysis.');
      return;
    }

    try {
      const content = this.contentElement;
      const runRegressionBtn = content.querySelector('.chart-run-regression-btn');
      
      // Show loading state
      const originalText = runRegressionBtn.textContent;
      runRegressionBtn.textContent = 'Running Regression...';
      runRegressionBtn.disabled = true;
      
      const mainTicker = this.ticker;
      
      // Prepare main data from bars array
      const mainData = {
        timestamps: this.chartData.map(bar => bar.t),
        closes: this.chartData.map(bar => bar.c)
      };
      
      // Prepare overlay data with already loaded data
      const overlayData = this.overlays.map(overlay => ({
        ticker: overlay.ticker,
        color: overlay.lineColor,  // Use lineColor for regression plots
        timestamps: overlay.data.map(bar => bar.t),
        closes: overlay.data.map(bar => bar.c)
      }));

      let result;
      
      // Call backend for regression calculation
      if (window.electronAPI && window.electronAPI.calculateRegression) {
        // Electron mode
        result = await window.electronAPI.calculateRegression(mainTicker, mainData, overlayData);
      } else {
        // Browser mode - call REST API via proxy
        const response = await fetch('/api/regression/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mainTicker,
            mainData,
            overlayData
          })
        });
        
        if (!response.ok) {
          throw new Error(`Regression API failed: ${response.statusText}`);
        }
        
        result = await response.json();
      }
      
      // Reset button state
      runRegressionBtn.textContent = originalText;
      runRegressionBtn.disabled = false;
      
      if (!result.success) {
        alert(`Regression failed: ${result.error}`);
        return;
      }

      // Display results
      console.log('[REGRESSION] Result from backend:', result);
      console.log('[REGRESSION] Number of results:', result.results?.length);
      result.results?.forEach((r, idx) => {
        console.log(`[REGRESSION] Result ${idx}:`, {
          ticker: r.ticker,
          beta: r.beta,
          spreadLength: r.spread?.length,
          spreadSample: r.spread?.slice(0, 5)
        });
      });
      this.displayRegressionResults(result);
      
      // Scroll to regression results
      setTimeout(() => {
        const regressionSection = content.querySelector('.regression-results-section');
        if (regressionSection) {
          regressionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch (error) {
      console.error('Error running regression:', error);
      alert('An error occurred during regression analysis.');
      
      // Reset button state on error
      const content = this.contentElement;
      const runRegressionBtn = content.querySelector('.chart-run-regression-btn');
      if (runRegressionBtn) {
        runRegressionBtn.textContent = 'Run Regression';
        runRegressionBtn.disabled = false;
      }
    }
  }

  showExportDialog() {
    if (!this.chartData) {
      alert('No chart data available to export.');
      return;
    }

    const modal = document.getElementById('exportModal');
    if (!modal) {
      console.error('Export modal not found');
      return;
    }

    // Show modal
    modal.style.display = 'flex';

    // Get buttons
    const pngBtn = document.getElementById('exportPngBtn');
    const csvBtn = document.getElementById('exportCsvBtn');

    // Remove any existing listeners
    const newPngBtn = pngBtn.cloneNode(true);
    const newCsvBtn = csvBtn.cloneNode(true);
    pngBtn.parentNode.replaceChild(newPngBtn, pngBtn);
    csvBtn.parentNode.replaceChild(newCsvBtn, csvBtn);

    // Add click handlers
    newPngBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      this.exportAsPNG();
    });

    newCsvBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      this.exportAsCSV();
    });
  }

  async exportAsPNG() {
    const content = this.contentElement;
    const chartCanvas = content.querySelector('.chart-canvas');
    
    if (!chartCanvas || typeof Plotly === 'undefined') {
      alert('Chart not ready for export.');
      return;
    }

    try {
      // Export main chart (includes all panels: candlestick, volume, RSI, ATR)
      await Plotly.downloadImage(chartCanvas, {
        format: 'png',
        width: 1920,
        height: 1080,
        filename: `${this.ticker}_chart_${new Date().toISOString().split('T')[0]}`
      });
      
      console.log('Chart exported as PNG successfully');
    } catch (err) {
      console.error('PNG export error:', err);
      alert('Failed to export chart as PNG.');
    }
  }

  exportAsCSV() {
    try {
      const rows = [];
      
      // Build header row
      const headers = ['Date', 'Time'];
      
      // Main ticker columns
      headers.push(
        `${this.ticker}_Open`,
        `${this.ticker}_High`,
        `${this.ticker}_Low`,
        `${this.ticker}_Close`,
        `${this.ticker}_Volume`
      );
      
      // Overlay ticker columns
      this.overlays.forEach(overlay => {
        headers.push(
          `${overlay.ticker}_Open`,
          `${overlay.ticker}_High`,
          `${overlay.ticker}_Low`,
          `${overlay.ticker}_Close`,
          `${overlay.ticker}_Volume`
        );
      });
      
      // Indicator columns
      this.indicators.forEach(ind => {
        const paramStr = Object.values(ind.params || {}).join(',');
        const indicatorName = `${ind.type}(${paramStr})`;
        
        // Band indicators (BB, KC) have 3 values: upper, middle, lower
        if (ind.type === 'BB' || ind.type === 'KC') {
          // Main ticker indicator
          headers.push(
            `${this.ticker}_${indicatorName}_Upper`,
            `${this.ticker}_${indicatorName}_Middle`,
            `${this.ticker}_${indicatorName}_Lower`
          );
          
          // Overlay indicators
          this.overlays.forEach(overlay => {
            headers.push(
              `${overlay.ticker}_${indicatorName}_Upper`,
              `${overlay.ticker}_${indicatorName}_Middle`,
              `${overlay.ticker}_${indicatorName}_Lower`
            );
          });
        } else {
          // Single value indicators (SMA, EMA, RSI, ATR, etc.)
          headers.push(`${this.ticker}_${indicatorName}`);
          
          // Overlay indicators
          this.overlays.forEach(overlay => {
            headers.push(`${overlay.ticker}_${indicatorName}`);
          });
        }
      });
      
      rows.push(headers);
      
      // Build data rows
      for (let i = 0; i < this.chartData.length; i++) {
        const bar = this.chartData[i];
        const date = new Date(bar.t);
        const row = [
          date.toISOString().split('T')[0],
          date.toTimeString().split(' ')[0]
        ];
        
        // Main ticker data
        row.push(bar.o, bar.h, bar.l, bar.c, bar.v);
        
        // Overlay data
        this.overlays.forEach(overlay => {
          const overlayBar = overlay.data[i];
          if (overlayBar) {
            row.push(overlayBar.o, overlayBar.h, overlayBar.l, overlayBar.c, overlayBar.v);
          } else {
            row.push('', '', '', '', '');
          }
        });
        
        // Indicator data - use pre-calculated values
        this.indicators.forEach(ind => {
          // Get indicator value for main ticker from stored calculations
          const mainKey = `${this.ticker}_${ind.type}_${JSON.stringify(ind.params)}`;
          const mainIndicatorData = this.calculatedIndicators && this.calculatedIndicators[mainKey];
          
          if (mainIndicatorData) {
            // Handle different indicator result formats
            if (ind.type === 'BB' || ind.type === 'KC') {
              // Band indicators have upper, middle, lower
              const upperVal = mainIndicatorData.upper && mainIndicatorData.upper[i];
              const middleVal = mainIndicatorData.middle && mainIndicatorData.middle[i];
              const lowerVal = mainIndicatorData.lower && mainIndicatorData.lower[i];
              row.push(upperVal !== undefined ? upperVal.toFixed(2) : '');
              row.push(middleVal !== undefined ? middleVal.toFixed(2) : '');
              row.push(lowerVal !== undefined ? lowerVal.toFixed(2) : '');
            } else {
              // Single value indicators (SMA, EMA, RSI, ATR, etc.)
              const val = Array.isArray(mainIndicatorData) ? mainIndicatorData[i] : mainIndicatorData;
              row.push(val !== undefined && val !== null ? val.toFixed(2) : '');
            }
          } else {
            // Fallback to old calculation method
            const mainValue = this.calculateIndicatorValue(ind, this.chartData, i);
            row.push(mainValue !== null ? mainValue : '');
          }
          
          // Get indicator values for overlays
          this.overlays.forEach(overlay => {
            const overlayKey = `${overlay.ticker}_${ind.type}_${JSON.stringify(ind.params)}`;
            const overlayIndicatorData = this.calculatedIndicators && this.calculatedIndicators[overlayKey];
            
            if (overlayIndicatorData) {
              if (ind.type === 'BB' || ind.type === 'KC') {
                const upperVal = overlayIndicatorData.upper && overlayIndicatorData.upper[i];
                const middleVal = overlayIndicatorData.middle && overlayIndicatorData.middle[i];
                const lowerVal = overlayIndicatorData.lower && overlayIndicatorData.lower[i];
                row.push(upperVal !== undefined ? upperVal.toFixed(2) : '');
                row.push(middleVal !== undefined ? middleVal.toFixed(2) : '');
                row.push(lowerVal !== undefined ? lowerVal.toFixed(2) : '');
              } else {
                const val = Array.isArray(overlayIndicatorData) ? overlayIndicatorData[i] : overlayIndicatorData;
                row.push(val !== undefined && val !== null ? val.toFixed(2) : '');
              }
            } else {
              const overlayValue = this.calculateIndicatorValue(ind, overlay.data, i);
              row.push(overlayValue !== null ? overlayValue : '');
            }
          });
        });
        
        rows.push(row);
      }
      
      // Convert to CSV string
      const csvContent = rows.map(row => row.join(',')).join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.ticker}_chart_data_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Exported ${rows.length - 1} rows of data to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV: ' + error.message);
    }
  }

  calculateIndicatorValue(indicator, data, index) {
    // Simple calculation for common indicators
    // For more complex indicators, this would need to be expanded
    const { type, params } = indicator;
    
    if (index < 0 || index >= data.length) return null;
    
    switch (type) {
      case 'SMA':
      case 'EMA': {
        const period = params.period || 20;
        if (index < period - 1) return null;
        
        let sum = 0;
        for (let i = 0; i < period; i++) {
          sum += data[index - i].c;
        }
        return (sum / period).toFixed(2);
      }
      case 'RSI': {
        const period = params.period || 14;
        if (index < period) return null;
        // Simplified RSI calculation would go here
        return null;
      }
      case 'VWAP': {
        return ((data[index].h + data[index].l + data[index].c) / 3).toFixed(2);
      }
      default:
        return null;
    }
  }

  showRegressionExportDialog() {
    if (!this.regressionResults) {
      alert('No regression analysis results available to export.');
      return;
    }
    
    const modal = document.getElementById('regressionExportModal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    const pngBtn = document.getElementById('exportRegressionPngBtn');
    const csvBtn = document.getElementById('exportRegressionCsvBtn');
    
    // Clone buttons to remove old listeners
    const newPngBtn = pngBtn.cloneNode(true);
    const newCsvBtn = csvBtn.cloneNode(true);
    pngBtn.parentNode.replaceChild(newPngBtn, pngBtn);
    csvBtn.parentNode.replaceChild(newCsvBtn, csvBtn);
    
    newPngBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      this.exportRegressionAsPNG();
    });
    
    newCsvBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      this.exportRegressionAsCSV();
    });
  }

  async exportRegressionAsPNG() {
    const content = this.contentElement;
    const regressionSection = content.querySelector('.regression-results-section');
    
    if (!regressionSection || typeof Plotly === 'undefined') {
      alert('Regression analysis not ready for export.');
      return;
    }

    try {
      const tabId = this.id;
      const { results } = this.regressionResults;
      
      // Export the combined regression chart
      const combinedDiv = document.getElementById(`regression-combined-tab${tabId}`);
      
      if (combinedDiv) {
        await Plotly.downloadImage(combinedDiv, {
          format: 'png',
          width: 1920,
          height: 400 * results.length,
          filename: `${this.ticker}_regression_analysis_${new Date().toISOString().split('T')[0]}`
        });
        console.log('Combined regression chart exported as PNG successfully');
      } else {
        alert('Regression chart not found.');
      }
    } catch (err) {
      console.error('Regression PNG export error:', err);
      alert('Failed to export regression chart as PNG.');
    }
  }

  exportRegressionAsCSV() {
    try {
      const { mainTicker, results } = this.regressionResults;
      const rows = [];
      
      // Build header row
      const headers = ['Ticker', 'Beta', 'Alpha', 'R_Squared', 'Correlation'];
      
      // Add data point headers for each overlay
      results.forEach(r => {
        headers.push(`${mainTicker}_Returns`, `${r.ticker}_Returns`, `${r.ticker}_Predicted`, `${r.ticker}_Residual`);
      });
      
      rows.push(headers);
      
      // Add summary statistics row for each overlay
      results.forEach(r => {
        const row = [
          r.ticker,
          r.beta.toFixed(6),
          r.alpha.toFixed(6),
          r.r_squared.toFixed(6),
          r.correlation.toFixed(6)
        ];
        
        // Add empty cells for data points
        results.forEach(() => {
          row.push('', '', '', '');
        });
        
        rows.push(row);
      });
      
      // Add blank row
      rows.push([]);
      
      // Add data points header
      const dataHeaders = ['Index'];
      results.forEach(r => {
        dataHeaders.push(`${mainTicker}_Returns`, `${r.ticker}_Returns`, `${r.ticker}_Predicted`, `${r.ticker}_Residual`);
      });
      rows.push(dataHeaders);
      
      // Find max length across all results
      const maxLength = Math.max(...results.map(r => r.x_data.length));
      
      // Add data points
      for (let i = 0; i < maxLength; i++) {
        const row = [i];
        
        results.forEach(r => {
          if (i < r.x_data.length) {
            const predicted = r.alpha + r.beta * r.x_data[i];
            const residual = r.y_data[i] - predicted;
            row.push(
              r.y_data[i].toFixed(6),
              r.x_data[i].toFixed(6),
              predicted.toFixed(6),
              residual.toFixed(6)
            );
          } else {
            row.push('', '', '', '');
          }
        });
        
        rows.push(row);
      }
      
      // Convert to CSV string
      const csvContent = rows.map(row => row.join(',')).join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mainTicker}_regression_analysis_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Exported regression analysis to CSV with ${results.length} overlays`);
    } catch (error) {
      console.error('Error exporting regression CSV:', error);
      alert('Failed to export regression CSV: ' + error.message);
    }
  }

  displayRegressionResults(result) {
    const { mainTicker, results, dataPoints } = result;
    const content = this.contentElement;
    
    console.log('[DISPLAY] Displaying regression results:', { mainTicker, resultCount: results?.length, dataPoints });
    
    // Remove any existing regression results
    const existingResults = content.querySelector('.regression-results-section');
    if (existingResults) {
      existingResults.remove();
    }
    
    // Generate unique IDs using tab ID
    const tabId = this.id;
    
    // Create results section HTML
    const resultsHtml = `
      <div class="regression-results-section">
        <div class="regression-header">
          <h3>Regression Analysis: ${mainTicker} vs Overlays (${dataPoints} data points)</h3>
          <button class="chart-export-regression-btn">Export Regression</button>
        </div>
        
        <div class="regression-summary-table">
          <table>
            <thead>
              <tr>
                <th>Color</th>
                <th>Ticker</th>
                <th>Beta (β)</th>
                <th>Alpha (α)</th>
                <th>R²</th>
                <th>Correlation</th>
              </tr>
            </thead>
            <tbody>
              ${results.map((r, idx) => `
                <tr>
                  <td>
                    <input type="color" class="regression-color-picker" 
                           data-ticker="${r.ticker}" 
                           data-index="${idx}" 
                           value="${r.color}" 
                           style="width: 30px; height: 25px; border: 1px solid #444; background: none; cursor: pointer;" />
                  </td>
                  <td style="color: ${r.color}; font-weight: bold;" class="regression-ticker-name" data-ticker="${r.ticker}">${r.ticker}</td>
                  <td>${r.beta.toFixed(4)}</td>
                  <td>${r.alpha.toFixed(4)}</td>
                  <td>${r.r_squared.toFixed(4)}</td>
                  <td>${r.correlation.toFixed(4)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="regression-combined-chart" id="regression-combined-tab${tabId}"></div>
      </div>
    `;
    
    // Find the chart canvas and insert results after it
    const chartCanvas = content.querySelector('.chart-canvas');
    chartCanvas.insertAdjacentHTML('afterend', resultsHtml);
    
    // Add event listener for regression export button
    const exportRegressionBtn = content.querySelector('.chart-export-regression-btn');
    if (exportRegressionBtn) {
      exportRegressionBtn.addEventListener('click', () => {
        this.showRegressionExportDialog();
      });
    }
    
    // Add event listeners for color pickers
    const colorPickers = content.querySelectorAll('.regression-color-picker');
    colorPickers.forEach(picker => {
      picker.addEventListener('change', (e) => {
        const ticker = e.target.dataset.ticker;
        const newColor = e.target.value;
        const idx = parseInt(e.target.dataset.index);
        
        // Update the result color
        results[idx].color = newColor;
        
        // Update the ticker name color in the table
        const tickerNameCell = content.querySelector(`.regression-ticker-name[data-ticker="${ticker}"]`);
        if (tickerNameCell) {
          tickerNameCell.style.color = newColor;
        }
        
        // Redraw the chart with new color
        this.plotCombinedRegressionChart(`regression-combined-tab${tabId}`, mainTicker, results);
      });
    });
    
    // Store regression data for export
    this.regressionResults = { mainTicker, results, dataPoints };
    
    // Plot combined regression chart with subplots
    this.plotCombinedRegressionChart(`regression-combined-tab${tabId}`, mainTicker, results);
  }

  plotCombinedRegressionChart(containerId, mainTicker, results) {
    const traces = [];
    const numOverlays = results.length;
    
    // Calculate subplot dimensions - each overlay gets 2 subplots
    const totalRows = numOverlays * 2;
    
    results.forEach((result, idx) => {
      const { ticker, color, alpha, beta, x_data, y_data, spread, timestamps } = result;
      
      // Calculate row positions (2 rows per overlay: scatter + residual)
      const scatterRow = idx * 2 + 1;
      const residualRow = idx * 2 + 2;
      
      // Darken color for regression line
      const darkerColor = this.darkenColor(color, 0.4);
      
      // === SCATTER PLOT TRACES ===
      const xMin = Math.min(...x_data);
      const xMax = Math.max(...x_data);
      const yMin = alpha + beta * xMin;
      const yMax = alpha + beta * xMax;
      
      traces.push({
        x: x_data,
        y: y_data,
        mode: 'markers',
        type: 'scatter',
        name: `${ticker} Data`,
        marker: { color: color, size: 4, opacity: 0.5 },
        xaxis: `x${scatterRow}`,
        yaxis: `y${scatterRow}`,
        showlegend: true,
        legendgroup: ticker
      });
      
      traces.push({
        x: [xMin, xMax],
        y: [yMin, yMax],
        mode: 'lines',
        type: 'scatter',
        name: `β=${beta.toFixed(4)}`,
        line: { color: darkerColor, width: 3 },
        xaxis: `x${scatterRow}`,
        yaxis: `y${scatterRow}`,
        showlegend: true,
        legendgroup: ticker
      });
      
      // === RESIDUAL PLOT TRACES ===
      if (spread && timestamps && spread.length > 0) {
        const dates = timestamps.map(ts => new Date(ts));
        
        traces.push({
          x: dates,
          y: spread,
          mode: 'lines',
          type: 'scatter',
          name: `${ticker} Residual`,
          line: { color: color, width: 2 },
          xaxis: `x${residualRow}`,
          yaxis: `y${residualRow}`,
          showlegend: true,
          legendgroup: ticker
        });
        
        traces.push({
          x: [dates[0], dates[dates.length - 1]],
          y: [0, 0],
          mode: 'lines',
          type: 'scatter',
          name: '',
          line: { color: '#ff6b6b', width: 2, dash: 'dash' },
          xaxis: `x${residualRow}`,
          yaxis: `y${residualRow}`,
          showlegend: false,
          hoverinfo: 'skip'
        });
      }
    });
    
    // Build layout
    const rowHeight = 1.0 / totalRows;
    const gap = 0.02;
    
    const layout = {
      height: 400 * numOverlays,
      plot_bgcolor: '#000000',
      paper_bgcolor: '#000000',
      font: { family: 'Quantico, monospace', color: '#e0e0e0', size: 11 },
      showlegend: false,
      margin: { l: 60, r: 20, t: 40, b: 60 },
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: '#000000',
        bordercolor: '#4ecdc4',
        font: { family: 'Quantico, monospace', color: '#ffffff', size: 12 }
      },
      annotations: []
    };
    
    // Add axis configurations
    results.forEach((result, idx) => {
      const scatterRow = idx * 2 + 1;
      const residualRow = idx * 2 + 2;
      
      const scatterDomain = [
        1 - (scatterRow * rowHeight) + gap,
        1 - ((scatterRow - 1) * rowHeight) - gap
      ];
      const residualDomain = [
        1 - (residualRow * rowHeight) + gap,
        1 - ((residualRow - 1) * rowHeight) - gap
      ];
      
      // Add title annotation only for scatter plot
      const scatterYPos = (scatterDomain[0] + scatterDomain[1]) / 2 + (scatterDomain[1] - scatterDomain[0]) * 0.45;
      
      layout.annotations.push({
        text: `${result.ticker} Regression`,
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: scatterYPos,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { family: 'Quantico, monospace', size: 14, color: '#e0e0e0', weight: 'bold' }
      });
      
      layout[`xaxis${scatterRow}`] = {
        title: '',
        titlefont: { family: 'Quantico, monospace', color: '#e0e0e0' },
        gridcolor: '#1a1a1a',
        zerolinecolor: '#333',
        tickfont: { family: 'Quantico, monospace', color: '#999' },
        anchor: `y${scatterRow}`
      };
      
      layout[`yaxis${scatterRow}`] = {
        title: '',
        titlefont: { family: 'Quantico, monospace', color: '#e0e0e0' },
        gridcolor: '#1a1a1a',
        zerolinecolor: '#333',
        tickfont: { family: 'Quantico, monospace', color: '#999' },
        domain: scatterDomain,
        anchor: `x${scatterRow}`
      };
      
      layout[`xaxis${residualRow}`] = {
        title: '',
        titlefont: { family: 'Quantico, monospace', color: '#e0e0e0' },
        gridcolor: '#1a1a1a',
        zerolinecolor: '#333',
        tickfont: { family: 'Quantico, monospace', color: '#999' },
        type: 'date',
        anchor: `y${residualRow}`
      };
      
      layout[`yaxis${residualRow}`] = {
        title: 'Residual',
        titlefont: { family: 'Quantico, monospace', color: '#e0e0e0' },
        gridcolor: '#1a1a1a',
        zerolinecolor: '#ff6b6b',
        tickfont: { family: 'Quantico, monospace', color: '#999' },
        zeroline: true,
        zerolinewidth: 2,
        domain: residualDomain,
        anchor: `x${residualRow}`
      };
    });
    
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };
    
    window.Plotly.newPlot(containerId, traces, layout, config);
  }

  plotRegressionChart(containerId, mainTicker, result) {
    const { ticker, color, alpha, beta, x_data, y_data } = result;

    // Calculate regression line points
    const xMin = Math.min(...x_data);
    const xMax = Math.max(...x_data);
    const yMin = alpha + beta * xMin;
    const yMax = alpha + beta * xMax;

    // Darken the color for regression line
    const darkerColor = this.darkenColor(color, 0.4);

    const scatterTrace = {
      x: x_data,
      y: y_data,
      mode: 'markers',
      type: 'scatter',
      name: 'Data Points',
      marker: {
        color: color,
        size: 4,
        opacity: 0.5
      }
    };

    const regressionTrace = {
      x: [xMin, xMax],
      y: [yMin, yMax],
      mode: 'lines',
      type: 'scatter',
      name: `β = ${beta.toFixed(4)}`,
      line: {
        color: darkerColor,
        width: 3
      }
    };

    const layout = {
      title: `${mainTicker} vs ${ticker} (β=${beta.toFixed(4)}, R²=${result.r_squared.toFixed(4)})`,
      xaxis: {
        title: `${ticker} Price`,
        gridcolor: '#2a2a2a',
        zerolinecolor: '#444',
        titlefont: { family: 'Quantico, monospace' },
        tickfont: { family: 'Quantico, monospace' }
      },
      yaxis: {
        title: `${mainTicker} Price`,
        gridcolor: '#2a2a2a',
        zerolinecolor: '#444',
        titlefont: { family: 'Quantico, monospace' },
        tickfont: { family: 'Quantico, monospace' }
      },
      plot_bgcolor: '#1a1a1a',
      paper_bgcolor: '#1a1a1a',
      font: { family: 'Quantico, monospace', color: '#e0e0e0', size: 11 },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(26, 26, 26, 0.8)',
        bordercolor: '#444',
        borderwidth: 1,
        font: { family: 'Quantico, monospace' }
      },
      margin: { l: 60, r: 20, t: 40, b: 60 }
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    window.Plotly.newPlot(containerId, [scatterTrace, regressionTrace], layout, config);
  }

  plotSpreadChart(containerId, mainTicker, result) {
    const { ticker, color, alpha, beta, spread, timestamps } = result;
    
    if (!spread || !timestamps || spread.length === 0) {
      console.error('[SPREAD CHART] Missing or empty spread/timestamps data for', ticker);
      return;
    }
    
    // Convert timestamps to dates (timestamps are already in milliseconds from Python)
    const dates = timestamps.map(ts => new Date(ts));
    
    // Calculate spread statistics for y-axis range
    const maxSpread = Math.max(...spread);
    const minSpread = Math.min(...spread);
    const spreadRange = maxSpread - minSpread;
    const yPadding = spreadRange * 0.1; // 10% padding
    
    const spreadTrace = {
      x: dates,
      y: spread,
      mode: 'lines',
      type: 'scatter',
      name: `Residual`,
      line: {
        color: color,
        width: 2
      }
    };
    
    // Add zero line
    const zeroLine = {
      x: [dates[0], dates[dates.length - 1]],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      name: 'Zero',
      line: {
        color: '#ff6b6b',
        width: 2,
        dash: 'dash'
      },
      showlegend: false
    };
    
    const layout = {
      title: `Residual: ${mainTicker} - (${alpha.toFixed(2)} + ${beta.toFixed(4)} × ${ticker})`,
      xaxis: {
        title: 'Date',
        gridcolor: '#2a2a2a',
        zerolinecolor: '#444',
        type: 'date'
      },
      yaxis: {
        title: 'Residual ($)',
        gridcolor: '#2a2a2a',
        zerolinecolor: '#ff6b6b',
        zeroline: true,
        zerolinewidth: 2,
        range: [minSpread - yPadding, maxSpread + yPadding]
      },
      plot_bgcolor: '#1a1a1a',
      paper_bgcolor: '#1a1a1a',
      font: { color: '#e0e0e0', size: 11 },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(26, 26, 26, 0.8)',
        bordercolor: '#444',
        borderwidth: 1
      },
      margin: { l: 60, r: 20, t: 40, b: 60 }
    };
    
    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };
    
    window.Plotly.newPlot(containerId, [spreadTrace, zeroLine], layout, config);
  }

  darkenColor(color, factor) {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Darken
    const newR = Math.floor(r * (1 - factor));
    const newG = Math.floor(g * (1 - factor));
    const newB = Math.floor(b * (1 - factor));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  
  showLoadPresetDialog() {
    const modal = document.getElementById('loadPresetModal');
    if (!modal) return;
    
    const presetList = document.getElementById('presetList');
    const presets = this.getPresets();
    
    if (presets.length === 0) {
      presetList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No saved presets</p>';
    } else {
      presetList.innerHTML = presets.map((preset, idx) => `
        <div class="preset-item" data-index="${idx}">
          <button class="preset-item-delete" onclick="event.stopPropagation();" data-index="${idx}">Delete</button>
          <div class="preset-item-name">${preset.name}</div>
          <div class="preset-item-details">
            ${preset.ticker} | ${preset.timeframe} | ${preset.overlays?.length || 0} overlays | ${preset.indicators?.length || 0} indicators
          </div>
        </div>
      `).join('');
      
      // Add click handlers
      presetList.querySelectorAll('.preset-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.index);
          this.loadPreset(presets[idx]);
          modal.style.display = 'none';
        });
      });
      
      // Add delete handlers
      presetList.querySelectorAll('.preset-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          this.deletePreset(idx);
          this.showLoadPresetDialog(); // Refresh list
        });
      });
    }
    
    modal.style.display = 'flex';
  }
  
  showSavePresetDialog() {
    const modal = document.getElementById('savePresetModal');
    if (!modal) return;
    
    const input = document.getElementById('presetNameInput');
    input.value = '';
    
    const confirmBtn = document.getElementById('confirmSavePresetBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) {
        alert('Please enter a preset name');
        return;
      }
      
      this.savePreset(name);
      modal.style.display = 'none';
    });
    
    modal.style.display = 'flex';
  }
  
  getPresets() {
    const stored = localStorage.getItem('chartPresets');
    return stored ? JSON.parse(stored) : [];
  }
  
  savePreset(name) {
    const preset = {
      name,
      ticker: this.ticker,
      timeframe: this.timeframe,
      chartType: this.chartType,
      overlays: this.overlays.map(o => ({
        ticker: o.ticker,
        chartType: o.chartType,
        upColor: o.upColor,
        downColor: o.downColor,
        lineColor: o.lineColor
      })),
      indicators: this.indicators.map(ind => ({
        type: ind.type,
        params: ind.params,
        color: ind.color,
        overlayColors: ind.overlayColors
      })),
      customUpColor: this.customUpColor,
      customDownColor: this.customDownColor,
      customLineColor: this.customLineColor
    };
    
    const presets = this.getPresets();
    presets.push(preset);
    localStorage.setItem('chartPresets', JSON.stringify(presets));
    
    console.log('Preset saved:', name);
  }
  
  deletePreset(index) {
    const presets = this.getPresets();
    presets.splice(index, 1);
    localStorage.setItem('chartPresets', JSON.stringify(presets));
  }
  
  async loadPreset(preset) {
    console.log('Loading preset:', preset);
    
    // Clear current state
    this.overlays = [];
    this.indicators = [];
    
    // Load ticker
    this.ticker = preset.ticker;
    this.timeframe = preset.timeframe || '1day';
    this.chartType = preset.chartType || 'candlestick';
    
    // Load custom colors
    this.customUpColor = preset.customUpColor;
    this.customDownColor = preset.customDownColor;
    this.customLineColor = preset.customLineColor;
    
    // Update UI elements
    const content = this.contentElement;
    const tickerDisplay = content.querySelector('.chart-live-ticker');
    if (tickerDisplay) tickerDisplay.textContent = preset.ticker;
    
    const timeframeSelect = content.querySelector('.chart-timeframe-select');
    if (timeframeSelect) timeframeSelect.value = preset.timeframe;
    
    const chartTypeSelect = content.querySelector('.chart-type-select');
    if (chartTypeSelect) chartTypeSelect.value = preset.chartType;
    
    // Update color pickers
    const upColorInput = content.querySelector('.main-up-color-input');
    const downColorInput = content.querySelector('.main-down-color-input');
    const lineColorInput = content.querySelector('.main-line-color-input');
    if (upColorInput && preset.customUpColor) upColorInput.value = preset.customUpColor;
    if (downColorInput && preset.customDownColor) downColorInput.value = preset.customDownColor;
    if (lineColorInput && preset.customLineColor) lineColorInput.value = preset.customLineColor;
    
    // Load main ticker data
    await this.loadChart();
    
    // Load overlays
    if (preset.overlays && preset.overlays.length > 0) {
      for (const overlay of preset.overlays) {
        await this.addOverlay(overlay.ticker, overlay);
      }
    }
    
    // Load indicators
    if (preset.indicators && preset.indicators.length > 0) {
      for (const ind of preset.indicators) {
        // Ensure each indicator has a unique ID (must be integer for proper comparison)
        if (!ind.id) {
          ind.id = Date.now() + Math.floor(Math.random() * 10000);
        }
        this.indicators.push(ind);
      }
      this.updateIndicatorsList();
      
      // Redraw chart with indicators
      if (this.chartData) {
        const { timespan } = this.getTimespanParams();
        this.drawChart(this.chartData, timespan);
      }
    }
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
    
    const hasFieldsToShow = this.indicators.length > 0 || (this.overlays && this.overlays.length > 0);
    
    if (!hasFieldsToShow) {
      indicatorsList.style.display = 'none';
      indicatorsContainer.innerHTML = '';
      return;
    }
    
    indicatorsList.style.display = 'block';
    
    let html = '';
    
    // Add overlay tickers first
    if (this.overlays && this.overlays.length > 0) {
      html += this.overlays.map(overlay => {
        const upColor = overlay.upColor || getPositiveColor();
        const downColor = overlay.downColor || getNegativeColor();
        const lineColor = overlay.lineColor || '#4ecdc4';
        
        return `
          <div class="indicator-row" style="
            display: flex;
            align-items: center;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-left: 3px solid ${lineColor};
            border-radius: 4px;
            padding: 6px 10px;
            margin-bottom: 6px;
          ">
            <span style="font-weight: 600; font-size: 12px; color: var(--text-primary); margin-right: 12px; min-width: 50px;">
              ${overlay.ticker}
            </span>
            <div style="display: flex; gap: 4px; align-items: center; margin-right: 8px;">
              <div style="display: flex; flex-direction: column; align-items: center;">
                <input type="color" class="overlay-color-input" data-overlay-ticker="${overlay.ticker}" data-color-type="up"
                       value="${upColor}" 
                       style="width: 24px; height: 20px; border: none; border-radius: 2px; cursor: pointer;"
                       title="Up candle color">
                <span style="font-size: 9px; color: var(--text-secondary); margin-top: 2px;">▲</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center;">
                <input type="color" class="overlay-color-input" data-overlay-ticker="${overlay.ticker}" data-color-type="down"
                       value="${downColor}" 
                       style="width: 24px; height: 20px; border: none; border-radius: 2px; cursor: pointer;"
                       title="Down candle color">
                <span style="font-size: 9px; color: var(--text-secondary); margin-top: 2px;">▼</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center;">
                <input type="color" class="overlay-color-input" data-overlay-ticker="${overlay.ticker}" data-color-type="line"
                       value="${lineColor}" 
                       style="width: 24px; height: 20px; border: none; border-radius: 2px; cursor: pointer;"
                       title="Line color">
                <span style="font-size: 9px; color: var(--text-secondary); margin-top: 2px;">─</span>
              </div>
            </div>
            <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto; margin-right: 8px;">Overlay</span>
            <button class="overlay-remove-btn" data-overlay-ticker="${overlay.ticker}" style="
              background: none;
              border: none;
              color: var(--text-secondary);
              cursor: pointer;
              padding: 0;
              font-size: 18px;
              line-height: 1;
            " title="Remove overlay">×</button>
          </div>
        `;
      }).join('');
    }
    
    // Add indicators
    html += this.indicators.map(ind => {
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
      
      // Build overlay color pickers for this indicator
      let overlayColorsHTML = '';
      if (this.overlays && this.overlays.length > 0) {
        overlayColorsHTML = this.overlays.map(overlay => {
          // Get or initialize color for this indicator on this overlay
          if (!ind.overlayColors) ind.overlayColors = {};
          const overlayColor = ind.overlayColors[overlay.ticker] || overlay.lineColor;
          
          return `
            <div style="display: flex; flex-direction: column; align-items: center; margin-left: 4px;">
              <input type="color" class="indicator-overlay-color-input" 
                     data-indicator-id="${ind.id}" 
                     data-overlay-ticker="${overlay.ticker}"
                     value="${overlayColor}" 
                     style="width: 20px; height: 18px; border: none; border-radius: 2px; cursor: pointer;"
                     title="Color for ${overlay.ticker}">
              <span style="font-size: 8px; color: var(--text-secondary); margin-top: 1px;">${overlay.ticker}</span>
            </div>
          `;
        }).join('');
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
                 title="Main ticker color">
          <span style="font-weight: 600; font-size: 12px; color: var(--text-primary); margin-right: 12px; min-width: 50px;">
            ${ind.type}
          </span>
          ${paramsHTML}
          ${overlayColorsHTML}
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
    
    indicatorsContainer.innerHTML = html;
    
    // Add overlay color change listeners
    indicatorsList.querySelectorAll('.overlay-color-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const ticker = e.target.dataset.overlayTicker;
        const colorType = e.target.dataset.colorType; // 'up', 'down', or 'line'
        const color = e.target.value;
        
        // Update overlay color
        const overlay = this.overlays.find(o => o.ticker === ticker);
        if (overlay) {
          if (colorType === 'up') {
            overlay.upColor = color;
          } else if (colorType === 'down') {
            overlay.downColor = color;
          } else if (colorType === 'line') {
            overlay.lineColor = color;
            // Update the border color immediately
            const row = e.target.closest('.indicator-row');
            if (row) {
              row.style.borderLeft = `3px solid ${color}`;
            }
          }
          
          // Redraw chart with new color
          if (this.chartData) {
            this.drawChart(this.chartData);
          }
        }
      });
    });
    
    // Add overlay remove listeners
    indicatorsList.querySelectorAll('.overlay-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ticker = e.target.dataset.overlayTicker;
        this.removeOverlay(ticker);
      });
    });
    
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
    
    // Add overlay-specific indicator color change listeners
    indicatorsList.querySelectorAll('.indicator-overlay-color-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.indicatorId);
        const ticker = e.target.dataset.overlayTicker;
        const color = e.target.value;
        
        // Update indicator's overlay-specific color
        const indicator = this.indicators.find(ind => ind.id === id);
        if (indicator) {
          if (!indicator.overlayColors) indicator.overlayColors = {};
          indicator.overlayColors[ticker] = color;
          
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
      case 'StochRSI':
        return window.calculateStochRSI(close, params.rsiPeriod, params.stochPeriod, params.kSmooth, params.dSmooth);
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
  
  // Set up websocket listener to update live info when data comes in (Electron only)
  if (window.electronAPI && window.electronAPI.onPolygonUpdate) {
    window.electronAPI.onPolygonUpdate((data) => {
      const updateTime = new Date().toLocaleTimeString();
      console.log(`[WEBSOCKET UPDATE ${updateTime}] ${data.ticker}:`, {
        price: data.close,
        volume: data.volume,
        changePercent: data.changePercent,
        prevClose: data.prevClose,
        timestamp: data.timestamp
      });
    
    // Update all chart tabs showing this ticker (main or overlay)
    chartTabs.forEach(tab => {
      const hasThisTicker = tab.ticker === data.ticker || 
                           (tab.overlays && tab.overlays.some(o => o.ticker === data.ticker));
      
      if (hasThisTicker) {
        console.log(`[WEBSOCKET UPDATE] Updating chart tab ${tab.id} for ${data.ticker}`);
        
        // Update live info display with fresh websocket data
        if (tab.ticker === data.ticker) {
          tab.updateLiveInfo(data);
        }
        
        // Update chart with live data (includes main ticker and overlays)
        tab.updateChartWithLiveData(data.ticker, data);
      }
    });
    });
  } else {
    console.log('[CHART TABS] Running in browser mode - live updates disabled');
  }
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
