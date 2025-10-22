/**
 * Backtest Configuration Module
 * Handles backtesting configuration UI, event listeners, and backtest execution
 */

// State for config management
let backtestConfigs = JSON.parse(localStorage.getItem('backtestConfigs') || '[]');
let configFolders = JSON.parse(localStorage.getItem('configFolders') || '[{"id": 0, "name": "Uncategorized"}]');

// Load watchlists for ticker selection (from localStorage like charting page)
function loadWatchlistsForBacktest() {
  try {
    const stored = localStorage.getItem('watchlists');
    let watchlists = [];
    if (stored) {
      try {
        watchlists = JSON.parse(stored);
      } catch (error) {
        console.error('[BACKTEST] Error parsing watchlists:', error);
        watchlists = [];
      }
    }
    
    const select = document.getElementById('tickerWatchlistSelect');
    if (select) {
      select.innerHTML = '<option value="">Select a watchlist...</option>';
      watchlists.forEach((wl, index) => {
        const option = document.createElement('option');
        option.value = index; // Use array index as ID
        const stockCount = wl.tickers ? wl.tickers.length : 0;
        option.textContent = `${wl.name} (${stockCount} stocks)`;
        option.dataset.tickers = JSON.stringify(wl.tickers || []);
        select.appendChild(option);
      });
      console.log(`[BACKTEST] Loaded ${watchlists.length} watchlists from localStorage`);
    }
  } catch (e) {
    console.error('[BACKTEST] Failed to load watchlists:', e);
  }
}

// Toggle ticker source (manual vs watchlist)
const tickerSourceRadios = document.querySelectorAll('input[name="tickerSource"]');
tickerSourceRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const manualInput = document.getElementById('manualTickersInput');
    const watchlistInput = document.getElementById('watchlistTickersInput');
    
    if (e.target.value === 'manual') {
      manualInput.style.display = 'block';
      watchlistInput.style.display = 'none';
    } else {
      manualInput.style.display = 'none';
      watchlistInput.style.display = 'block';
    }
  });
});

// Toggle portfolio source (tickers vs strategies)
const portfolioSourceRadios = document.querySelectorAll('input[name="portfolioSource"]');
portfolioSourceRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const tickerWeights = document.getElementById('portfolioTickerWeights');
    const strategyWeights = document.getElementById('portfolioStrategyWeights');
    
    if (e.target.value === 'tickers') {
      tickerWeights.style.display = 'block';
      strategyWeights.style.display = 'none';
    } else {
      tickerWeights.style.display = 'none';
      strategyWeights.style.display = 'block';
    }
  });
});

// Initialize watchlists on page load
setTimeout(() => {
  loadWatchlistsForBacktest();
}, 500);

// Toggle section collapse/expand
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
    
    // Update arrow direction
    const header = section.previousElementSibling;
    if (header) {
      const h3 = header.querySelector('h3');
      if (h3) {
        h3.textContent = section.classList.contains('collapsed') 
          ? h3.textContent.replace('â–¼', 'â–¶') 
          : h3.textContent.replace('â–¶', 'â–¼');
      }
    }
  }
}
window.toggleSection = toggleSection;

// Portfolio mode toggle
const portfolioModeCheckbox = document.getElementById('portfolioMode');
if (portfolioModeCheckbox) {
  portfolioModeCheckbox.addEventListener('change', (e) => {
    const portfolioSettings = document.getElementById('portfolioSettings');
    if (portfolioSettings) {
      portfolioSettings.style.display = e.target.checked ? 'block' : 'none';
    }
  });
}

// Use param grid toggle
const useParamGridCheckbox = document.getElementById('useParamGrid');
if (useParamGridCheckbox) {
  useParamGridCheckbox.addEventListener('change', (e) => {
    const portfolioStrategies = document.getElementById('portfolioStrategies');
    const portfolioParamGrid = document.getElementById('portfolioParamGrid');
    
    if (e.target.checked) {
      portfolioStrategies.style.display = 'none';
      portfolioParamGrid.style.display = 'block';
    } else {
      portfolioStrategies.style.display = 'block';
      portfolioParamGrid.style.display = 'none';
    }
  });
}

// End date "Use Today" toggle
const endDateTodayCheckbox = document.getElementById('endDateToday');
const endDateInput = document.getElementById('endDate');
if (endDateTodayCheckbox && endDateInput) {
  endDateTodayCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      endDateInput.value = '';
      endDateInput.disabled = true;
    } else {
      endDateInput.disabled = false;
      // Set to today's date when unchecked
      const today = new Date().toISOString().split('T')[0];
      endDateInput.value = today;
    }
  });
  
  // Initialize state
  if (endDateTodayCheckbox.checked) {
    endDateInput.value = '';
    endDateInput.disabled = true;
  }
}

// Auto-populate portfolio: loads tickers, assigns weights, leaves strategy empty for user selection
function autoPopulatePortfolio() {
  // Get tickers from main configuration section
  let tickers = [];
  const tickerSource = document.querySelector('input[name="tickerSource"]:checked')?.value;
  
  if (tickerSource === 'manual') {
    // Get from manual ticker input
    const tickersInput = document.getElementById('tickers')?.value.trim();
    if (tickersInput) {
      tickers = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
    }
  } else if (tickerSource === 'watchlist') {
    // Get from watchlist selection
    const watchlistSelect = document.getElementById('tickerWatchlistSelect');
    const selectedOption = watchlistSelect?.options[watchlistSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.tickers) {
      tickers = JSON.parse(selectedOption.dataset.tickers);
    }
  }
  
  if (tickers.length === 0) {
    alert('Please enter tickers in Main Configuration or select a watchlist first');
    return;
  }

  // Check for duplicates
  const uniqueTickers = [...new Set(tickers)];
  if (uniqueTickers.length !== tickers.length) {
    alert('Duplicate tickers detected. Please remove duplicates.');
    return;
  }

  const list = document.getElementById('portfolioTickersList');
  list.innerHTML = '';

  // Equal weighting
  const equalWeight = (1.0 / tickers.length).toFixed(4);

  tickers.forEach(ticker => {
    const tickerCard = document.createElement('div');
    tickerCard.className = 'ticker-card';
    tickerCard.style.cssText = 'margin-bottom: 15px; padding: 15px; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;';

    tickerCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <strong style="font-size: 1.1em; color: #fff;">${ticker}</strong>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="margin: 0; color: #888; font-size: 0.9em;">Weight:</label>
          <input type="number" step="0.01" class="form-control" value="${equalWeight}" 
                 data-ticker="${ticker}" data-field="weight" style="width: 80px; background: #1a1a1a; color: #fff; border: 1px solid #444;">
        </div>
      </div>
      
      <div style="margin-top: 10px;">
        <label style="font-size: 0.9em; margin-bottom: 5px; display: block; color: #888;">Strategy Type:</label>
        <select class="form-control" data-ticker="${ticker}" data-field="strategy_type" 
                onchange="toggleStrategyParams('${ticker}', this.value)" 
                style="margin-bottom: 10px; background: #1a1a1a; color: #fff; border: 1px solid #444;">
          <option value="">-- Select Strategy --</option>
          <option value="rsi">RSI</option>
          <option value="macd">MACD (Coming Soon)</option>
          <option value="ma">Moving Average (Coming Soon)</option>
          <option value="bollinger">Bollinger Bands (Coming Soon)</option>
        </select>
        
        <div id="strategyParams_${ticker}" style="display: none;"></div>
      </div>
    `;

    list.appendChild(tickerCard);
  });
  
  console.log(`[PORTFOLIO] Auto-populated ${tickers.length} tickers with equal weights`);
}
window.autoPopulatePortfolio = autoPopulatePortfolio;

// Toggle strategy parameters based on selected strategy type
function toggleStrategyParams(ticker, strategyType) {
  const paramsDiv = document.getElementById(`strategyParams_${ticker}`);
  
  if (!strategyType) {
    paramsDiv.style.display = 'none';
    paramsDiv.innerHTML = '';
    return;
  }
  
  paramsDiv.style.display = 'block';
  
  if (strategyType === 'rsi') {
    // Get defaults from Indicators section
    const rsiPeriods = document.getElementById('rsiPeriod')?.value?.split(',').map(p => p.trim())[0] || '14';
    const rsiBuy = document.getElementById('rsiBuyBelow')?.value?.split(',').map(p => p.trim())[0] || '30';
    const rsiSell = document.getElementById('rsiSellAbove')?.value?.split(',').map(p => p.trim())[0] || '70';
    
    paramsDiv.innerHTML = `
      <div style="padding: 10px; background: #1a1a1a; border-radius: 4px; border: 1px solid #444;">
        <strong style="font-size: 0.9em; color: #03A9F4;">RSI Parameters:</strong>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px;">
          <div>
            <label style="font-size: 0.85em; color: #888;">Period:</label>
            <input type="number" class="form-control" value="${rsiPeriods}" 
                   data-ticker="${ticker}" data-param="rsi_period"
                   style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
          </div>
          <div>
            <label style="font-size: 0.85em; color: #888;">Buy Below:</label>
            <input type="number" class="form-control" value="${rsiBuy}" 
                   data-ticker="${ticker}" data-param="rsi_buy_below"
                   style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
          </div>
          <div>
            <label style="font-size: 0.85em; color: #888;">Sell Above:</label>
            <input type="number" class="form-control" value="${rsiSell}" 
                   data-ticker="${ticker}" data-param="rsi_sell_above"
                   style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
          </div>
        </div>
      </div>
    `;
  } else if (strategyType === 'ma') {
    // Future: MA parameters
    paramsDiv.innerHTML = `
      <div style="padding: 10px; background: #1a1a1a; border-radius: 4px; border: 1px solid #444;">
        <strong style="font-size: 0.9em; color: #03A9F4;">Moving Average Parameters:</strong>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px;">
          <div>
            <label style="font-size: 0.85em; color: #888;">MA Type:</label>
            <select class="form-control" data-ticker="${ticker}" data-param="ma_type"
                    style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
              <option value="sma">SMA</option>
              <option value="ema">EMA</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.85em; color: #888;">Short Period:</label>
            <input type="number" class="form-control" value="20" 
                   data-ticker="${ticker}" data-param="ma_short_period"
                   style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
          </div>
          <div>
            <label style="font-size: 0.85em; color: #888;">Long Period:</label>
            <input type="number" class="form-control" value="50" 
                   data-ticker="${ticker}" data-param="ma_long_period"
                   style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
          </div>
        </div>
      </div>
    `;
  }
  // Add more strategy types here as they're implemented
}
window.toggleStrategyParams = toggleStrategyParams;


// Add portfolio strategy from saved strategies (grouped by folder)
async function addPortfolioStrategy() {
  try {
    // Check if API is available
    if (!window.electronAPI || !window.electronAPI.getFavorites) {
      alert('Saved strategies are not available yet. Please wait for the database to load.');
      console.log('[BACKTEST] Favorites API not available yet');
      return;
    }
    
    const favResult = await window.electronAPI.getFavorites();
    const favorites = favResult.success ? favResult.data : [];
    if (!favorites || favorites.length === 0) {
      alert('No saved strategies found. Save some strategies first from the Results page!');
      return;
    }
    
    const folderResult = await window.electronAPI.getFolders();
    const folders = folderResult.success ? folderResult.data : [];
    
    const list = document.getElementById('portfolioStrategyList');
    const item = document.createElement('div');
    item.className = 'strategy-item';
    
    // Group favorites by folder
    const folderMap = {};
    folders.forEach(f => folderMap[f.id] = f.name);
    folderMap[null] = 'Uncategorized';
    folderMap[0] = 'Uncategorized';
    
    // Create dropdown with optgroups by folder
    let optionsHTML = '<option value="">Select a saved strategy...</option>';
    const favoritesByFolder = {};
    favorites.forEach(fav => {
      const folderId = fav.folder_id || 0;
      if (!favoritesByFolder[folderId]) favoritesByFolder[folderId] = [];
      favoritesByFolder[folderId].push(fav);
    });
    
    // Add each folder as optgroup
    Object.entries(favoritesByFolder).forEach(([folderId, favs]) => {
      const folderName = folderMap[folderId] || 'Uncategorized';
      optionsHTML += `<optgroup label="${folderName}">`;
      favs.forEach(fav => {
        const displayName = fav.is_portfolio 
          ? `${fav.name} (Portfolio)` 
          : `${fav.name} (${fav.ticker || 'Unknown'})`;
        optionsHTML += `<option value="${fav.id}">${displayName}</option>`;
      });
      optionsHTML += '</optgroup>';
    });
    
    item.innerHTML = `
      <select class="strategy-select form-input" style="flex: 2;">${optionsHTML}</select>
      <input type="number" placeholder="Weight (e.g., 0.5)" class="strategy-weight" min="0" max="1" step="0.05" value="0.5" style="flex: 1;" />
      <button type="button" class="btn-sm danger" onclick="this.parentElement.remove()">Remove</button>
    `;
    list.appendChild(item);
    console.log('[BACKTEST] Added strategy selector with', favorites.length, 'strategies');
  } catch (e) {
    console.error('[BACKTEST] Failed to load saved strategies:', e);
    alert('Failed to load saved strategies: ' + e.message);
  }
}
window.addPortfolioStrategy = addPortfolioStrategy;

// Add param grid entry
function addPortfolioParamGrid() {
  const list = document.getElementById('portfolioParamGridList');
  const item = document.createElement('div');
  item.className = 'param-grid-item';
  item.innerHTML = `
    <input type="text" placeholder="Ticker" class="param-grid-ticker" />
    <input type="text" placeholder='[{"rsi_period": 14}, {"rsi_period": 20}]' class="param-grid-params" style="flex: 2;" />
    <button type="button" class="btn-sm danger" onclick="this.parentElement.remove()">Remove</button>
  `;
  list.appendChild(item);
}
window.addPortfolioParamGrid = addPortfolioParamGrid;

// Collect configuration from form (delegated to BacktestConfig module)
function collectBacktestConfig() {
  return BacktestConfig.collectBacktestConfig();
}
window.collectBacktestConfig = collectBacktestConfig;

// Populate form from config object (delegated to BacktestConfig module)
function populateBacktestConfig(config) {
  return BacktestConfig.populateBacktestConfig(config);
}
window.populateBacktestConfig = populateBacktestConfig;

// OLD implementations moved to modules/backtest/config.js - DELETE THESE AFTER TESTING
function collectBacktestConfig_OLD_DELETE_ME() {
  const config = {};
  
  // MAIN section
  config.RUN_ID = document.getElementById('runId')?.value || 'auto';
  config.NOTES = document.getElementById('notes')?.value || '';
  
  // Parse tickers - from manual input or watchlist
  const tickerSource = document.querySelector('input[name="tickerSource"]:checked')?.value;
  if (tickerSource === 'watchlist') {
    const selectEl = document.getElementById('tickerWatchlistSelect');
    const selectedOption = selectEl?.options[selectEl.selectedIndex];
    if (selectedOption && selectedOption.dataset.tickers) {
      const tickers = JSON.parse(selectedOption.dataset.tickers);
      config.TICKERS = tickers.map(t => t.toUpperCase());
      config.TICKER_SOURCE = 'watchlist';
      config.TICKER_WATCHLIST_NAME = selectedOption.textContent;
    } else {
      alert('Please select a watchlist');
      config.TICKERS = [];
    }
  } else {
    const tickersInput = document.getElementById('tickers')?.value || '';
    config.TICKER_SOURCE = 'manual';
    config.TICKERS = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
  }
  
  config.INITIAL_CAPITAL = parseFloat(document.getElementById('initialCapital')?.value || 100000);
  config.TIMESCALE = document.getElementById('timescale')?.value || '1Day';
  config.START = document.getElementById('startDate')?.value || '2000-01-01';
  
  // END date: null if "Use Today" is checked, otherwise use the date value
  const endDateToday = document.getElementById('endDateToday')?.checked;
  const endDateValue = document.getElementById('endDate')?.value;
  config.END = endDateToday ? null : (endDateValue || null);
  
  config.BUY_HOLD_ENABLED = document.getElementById('buyHoldEnabled')?.checked || false;
  config.BENCHMARK_ENABLED = document.getElementById('benchmarkEnabled')?.checked || false;
  config.BENCHMARK_SYMBOL = document.getElementById('benchmarkSymbol')?.value || 'SPY';
  config.RF_ANNUAL = parseFloat(document.getElementById('rfAnnual')?.value || 5.0);
  config.PERIODS_PER_YEAR = parseInt(document.getElementById('periodsPerYear')?.value || 252);
  
  // PORTFOLIO section
  config.PORTFOLIO_MODE = document.getElementById('portfolioMode')?.checked || false;
  
  if (config.PORTFOLIO_MODE) {
    const portfolioSource = document.querySelector('input[name="portfolioSource"]:checked')?.value;
    config.PORTFOLIO_SOURCE = portfolioSource;
    
    if (portfolioSource === 'strategies') {
      // Load saved strategies with weights
      config.PORTFOLIO_SAVED_STRATEGIES = [];
      const strategyItems = document.querySelectorAll('#portfolioStrategyList .strategy-item');
      strategyItems.forEach(item => {
        const strategyId = item.querySelector('.strategy-select')?.value;
        const weight = parseFloat(item.querySelector('.strategy-weight')?.value);
        if (strategyId && !isNaN(weight)) {
          config.PORTFOLIO_SAVED_STRATEGIES.push({
            strategy_id: parseInt(strategyId),
            weight: weight
          });
        }
      });
    } else {
      // Ticker-based weights - collect from portfolio tickers list
      config.PORTFOLIO_WEIGHTS = {};
      const tickerCards = document.querySelectorAll('#portfolioTickersList .ticker-card');
      tickerCards.forEach(card => {
        const ticker = card.querySelector('strong')?.textContent;
        const weightInput = card.querySelector('input[data-field="weight"]');
        const weight = parseFloat(weightInput?.value);
        if (ticker && !isNaN(weight) && weight > 0) {
          config.PORTFOLIO_WEIGHTS[ticker] = weight;
        }
      });
      
      // Normalize weights to sum to 1.0
      const weightSum = Object.values(config.PORTFOLIO_WEIGHTS).reduce((sum, w) => sum + w, 0);
      if (weightSum > 0) {
        // Normalize existing weights
        for (const ticker in config.PORTFOLIO_WEIGHTS) {
          config.PORTFOLIO_WEIGHTS[ticker] = config.PORTFOLIO_WEIGHTS[ticker] / weightSum;
        }
        console.log(`[BACKTEST] Normalized portfolio weights (original sum: ${weightSum.toFixed(4)})`);
      } else if (config.TICKERS && config.TICKERS.length > 0) {
        // No weights specified - use equal weighting for all tickers
        const equalWeight = 1.0 / config.TICKERS.length;
        config.TICKERS.forEach(ticker => {
          config.PORTFOLIO_WEIGHTS[ticker] = equalWeight;
        });
        console.log(`[BACKTEST] No weights specified - applied equal weighting to ${config.TICKERS.length} tickers`);
      }
      
      config.PORTFOLIO_USE_PARAM_GRID = document.getElementById('useParamGrid')?.checked || false;
      
      if (config.PORTFOLIO_USE_PARAM_GRID) {
        // Collect param grid
        config.PORTFOLIO_PARAM_GRID = {};
        const gridItems = document.querySelectorAll('#portfolioParamGridList .param-grid-item');
        gridItems.forEach(item => {
          const ticker = item.querySelector('.param-grid-ticker')?.value;
          const paramsStr = item.querySelector('.param-grid-params')?.value;
          if (ticker && paramsStr) {
            try {
              config.PORTFOLIO_PARAM_GRID[ticker] = JSON.parse(paramsStr);
            } catch (e) {
              console.error(`Failed to parse param grid for ${ticker}:`, e);
            }
          }
        });
      } else {
        // Collect strategies from portfolio tickers list
        config.PORTFOLIO_STRATEGIES = {};
        const tickerCards = document.querySelectorAll('#portfolioTickersList .ticker-card');
        
        tickerCards.forEach(card => {
          // Get ticker from the card heading
          const tickerText = card.querySelector('strong')?.textContent;
          if (!tickerText) return;
          
          // Get strategy type
          const strategySelect = card.querySelector('select[data-field="strategy_type"]');
          const strategyType = strategySelect?.value;
          
          if (!strategyType) return; // Skip if no strategy selected
          
          if (strategyType === 'rsi') {
            const paramsDiv = card.querySelector(`#strategyParams_${tickerText}`);
            const rsiPeriod = parseInt(paramsDiv?.querySelector('[data-param="rsi_period"]')?.value);
            const rsiBuy = parseInt(paramsDiv?.querySelector('[data-param="rsi_buy_below"]')?.value);
            const rsiSell = parseInt(paramsDiv?.querySelector('[data-param="rsi_sell_above"]')?.value);
            
            if (!isNaN(rsiPeriod) && !isNaN(rsiBuy) && !isNaN(rsiSell)) {
              config.PORTFOLIO_STRATEGIES[tickerText] = {
                rsi_period: rsiPeriod,
                rsi_buy_below: rsiBuy,
                rsi_sell_above: rsiSell
              };
            }
          } else if (strategyType === 'ma') {
            // Future: MA strategy collection
            const paramsDiv = card.querySelector(`#strategyParams_${tickerText}`);
            const maType = paramsDiv?.querySelector('[data-param="ma_type"]')?.value;
            const shortPeriod = parseInt(paramsDiv?.querySelector('[data-param="ma_short_period"]')?.value);
            const longPeriod = parseInt(paramsDiv?.querySelector('[data-param="ma_long_period"]')?.value);
            
            if (maType && !isNaN(shortPeriod) && !isNaN(longPeriod)) {
              config.PORTFOLIO_STRATEGIES[tickerText] = {
                ma_type: maType,
                ma_short_period: shortPeriod,
                ma_long_period: longPeriod
              };
            }
          }
          // Add more strategy types here
        });
        
        // If no strategies specified, use default RSI params for all tickers
        if (Object.keys(config.PORTFOLIO_STRATEGIES).length === 0 && config.TICKERS) {
          const defaultRsiPeriod = config.RSI_PERIOD && config.RSI_PERIOD.length > 0 ? config.RSI_PERIOD[0] : 14;
          const defaultRsiBuy = config.RSI_BUY_BELOW && config.RSI_BUY_BELOW.length > 0 ? config.RSI_BUY_BELOW[0] : 30;
          const defaultRsiSell = config.RSI_SELL_ABOVE && config.RSI_SELL_ABOVE.length > 0 ? config.RSI_SELL_ABOVE[0] : 70;
          
          config.TICKERS.forEach(ticker => {
            config.PORTFOLIO_STRATEGIES[ticker] = {
              rsi_period: defaultRsiPeriod,
              rsi_buy_below: defaultRsiBuy,
              rsi_sell_above: defaultRsiSell
            };
          });
          console.log(`[BACKTEST] Auto-populated portfolio strategies for ${config.TICKERS.length} tickers with default RSI params`);
        }
      }
    }
    
    config.PORTFOLIO_TARGET_UTILIZATION = parseFloat(document.getElementById('portfolioUtilization')?.value || 1.0);
  }
  
  // ENTRY section (only implemented features)
  config.TARGET_WEIGHT = parseFloat(document.getElementById('targetWeight')?.value || 0.95);
  config.ENTRY_FEES_BPS = parseInt(document.getElementById('entryFees')?.value || 10);
  config.SLIP_OPEN_BPS = parseInt(document.getElementById('slipOpen')?.value || 2);
  
  // EXIT section (only implemented features)
  config.EXIT_FEES_BPS = parseInt(document.getElementById('exitFees')?.value || 10);
  
  // STRATEGY CONDITIONS section
  // Position type is now per-condition, not global
  config.ENTRY_CONDITIONS = collectConditions('entry');
  config.ENTRY_MODE = document.querySelector('input[name="entryMode"]:checked')?.value || 'all';
  
  config.EXIT_CONDITIONS = collectConditions('exit');
  config.EXIT_MODE = document.querySelector('input[name="exitMode"]:checked')?.value || 'all';
  
  // Take Profit
  config.TAKE_PROFIT_ENABLED = document.getElementById('takeProfitEnabled')?.checked || false;
  if (config.TAKE_PROFIT_ENABLED) {
    config.TAKE_PROFIT_TYPE = document.getElementById('takeProfitType')?.value;
    if (config.TAKE_PROFIT_TYPE === 'percent') {
      config.TAKE_PROFIT_PERCENT = parseFloat(document.getElementById('takeProfitPercentValue')?.value || 10.0);
    } else if (config.TAKE_PROFIT_TYPE === 'dollar') {
      config.TAKE_PROFIT_DOLLAR = parseFloat(document.getElementById('takeProfitDollarValue')?.value || 100.0);
    }
  }
  
  // Stop Loss
  config.STOP_LOSS_ENABLED = document.getElementById('stopLossEnabled')?.checked || false;
  if (config.STOP_LOSS_ENABLED) {
    config.STOP_LOSS_TYPE = document.getElementById('stopLossType')?.value;
    if (config.STOP_LOSS_TYPE === 'percent') {
      config.STOP_LOSS_PERCENT = parseFloat(document.getElementById('stopLossPercentValue')?.value || 5.0);
    } else if (config.STOP_LOSS_TYPE === 'dollar') {
      config.STOP_LOSS_DOLLAR = parseFloat(document.getElementById('stopLossDollarValue')?.value || 100.0);
    }
  }
  
  // Vice Versa
  config.VICE_VERSA_ENABLED = document.getElementById('viceVersaEnabled')?.checked || false;
  if (config.VICE_VERSA_ENABLED) {
    config.VICE_VERSA_DELAY = parseInt(document.getElementById('viceVersaDelay')?.value || 1);
  }
  
  // OUTPUTS section (only implemented features)
  config.SAVE_METRICS = document.getElementById('saveMetrics')?.checked || false;
  config.SAVE_DB = document.getElementById('saveDb')?.checked || false;
  config.SAVE_TRADES = document.getElementById('saveTrades')?.checked || false;
  config.MAKE_TEARSHEETS = document.getElementById('makeTearsheets')?.checked || false;
  
  return config;
}
// END OLD collectBacktestConfig - DELETE AFTER TESTING

// Populate form from config object
function populateBacktestConfig_OLD_DELETE_ME(config) {
  // MAIN section
  if (config.RUN_ID !== undefined) document.getElementById('runId').value = config.RUN_ID;
  if (config.NOTES !== undefined) document.getElementById('notes').value = config.NOTES;
  if (config.TICKERS !== undefined) document.getElementById('tickers').value = config.TICKERS.join(', ');
  if (config.INITIAL_CAPITAL !== undefined) document.getElementById('initialCapital').value = config.INITIAL_CAPITAL;
  if (config.START !== undefined) document.getElementById('startDate').value = config.START;
  
  // Handle END date and checkbox
  const endDateInput = document.getElementById('endDate');
  const endDateTodayCheckbox = document.getElementById('endDateToday');
  if (config.END !== undefined) {
    if (config.END === null) {
      endDateTodayCheckbox.checked = true;
      endDateInput.value = '';
      endDateInput.disabled = true;
    } else {
      endDateTodayCheckbox.checked = false;
      endDateInput.value = config.END;
      endDateInput.disabled = false;
    }
  }
  if (config.BUY_HOLD_ENABLED !== undefined) document.getElementById('buyHoldEnabled').checked = config.BUY_HOLD_ENABLED;
  if (config.BENCHMARK_ENABLED !== undefined) document.getElementById('benchmarkEnabled').checked = config.BENCHMARK_ENABLED;
  if (config.BENCHMARK_SYMBOL !== undefined) document.getElementById('benchmarkSymbol').value = config.BENCHMARK_SYMBOL;
  if (config.RF_ANNUAL !== undefined) document.getElementById('rfAnnual').value = config.RF_ANNUAL;
  if (config.PERIODS_PER_YEAR !== undefined) document.getElementById('periodsPerYear').value = config.PERIODS_PER_YEAR;
  
  // PORTFOLIO section
  if (config.PORTFOLIO_MODE !== undefined) {
    document.getElementById('portfolioMode').checked = config.PORTFOLIO_MODE;
    document.getElementById('portfolioSettings').style.display = config.PORTFOLIO_MODE ? 'block' : 'none';
  }
  
  // Load portfolio tickers with weights and strategies
  if (config.PORTFOLIO_WEIGHTS !== undefined || config.PORTFOLIO_STRATEGIES !== undefined) {
    const tickersList = document.getElementById('portfolioTickersList');
    tickersList.innerHTML = '';
    
    // Get all tickers from either weights or strategies
    const allTickers = new Set();
    if (config.PORTFOLIO_WEIGHTS) {
      Object.keys(config.PORTFOLIO_WEIGHTS).forEach(t => allTickers.add(t));
    }
    if (config.PORTFOLIO_STRATEGIES) {
      Object.keys(config.PORTFOLIO_STRATEGIES).forEach(t => allTickers.add(t));
    }
    
    // Create a card for each ticker
    allTickers.forEach(ticker => {
      const weight = config.PORTFOLIO_WEIGHTS ? config.PORTFOLIO_WEIGHTS[ticker] || 0 : 0;
      const strategy = config.PORTFOLIO_STRATEGIES ? config.PORTFOLIO_STRATEGIES[ticker] : null;
      
      const tickerCard = document.createElement('div');
      tickerCard.className = 'ticker-card';
      tickerCard.style.cssText = 'margin-bottom: 15px; padding: 15px; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;';
      
      // Determine strategy type and create params HTML
      let strategyType = '';
      let paramsHtml = '';
      let paramsDisplay = 'none';
      
      if (strategy) {
        if (strategy.rsi_period !== undefined) {
          strategyType = 'rsi';
          paramsDisplay = 'block';
          paramsHtml = `
            <div style="padding: 10px; background: #1a1a1a; border-radius: 4px; border: 1px solid #444;">
              <strong style="font-size: 0.9em; color: #03A9F4;">RSI Parameters:</strong>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px;">
                <div>
                  <label style="font-size: 0.85em; color: #888;">Period:</label>
                  <input type="number" class="form-control" value="${strategy.rsi_period}" 
                         data-ticker="${ticker}" data-param="rsi_period"
                         style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
                </div>
                <div>
                  <label style="font-size: 0.85em; color: #888;">Buy Below:</label>
                  <input type="number" class="form-control" value="${strategy.rsi_buy_below}" 
                         data-ticker="${ticker}" data-param="rsi_buy_below"
                         style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
                </div>
                <div>
                  <label style="font-size: 0.85em; color: #888;">Sell Above:</label>
                  <input type="number" class="form-control" value="${strategy.rsi_sell_above}" 
                         data-ticker="${ticker}" data-param="rsi_sell_above"
                         style="background: #0a0a0a; color: #fff; border: 1px solid #333;">
                </div>
              </div>
            </div>
          `;
        } else if (strategy.ma_type !== undefined) {
          strategyType = 'ma';
          paramsDisplay = 'block';
          // Add MA params loading here when MA is implemented
        }
      }
      
      tickerCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="font-size: 1.1em; color: #fff;">${ticker}</strong>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="margin: 0; color: #888; font-size: 0.9em;">Weight:</label>
            <input type="number" step="0.01" class="form-control" value="${weight.toFixed(4)}" 
                   data-ticker="${ticker}" data-field="weight" style="width: 80px; background: #1a1a1a; color: #fff; border: 1px solid #444;">
          </div>
        </div>
        
        <div style="margin-top: 10px;">
          <label style="font-size: 0.9em; margin-bottom: 5px; display: block; color: #888;">Strategy Type:</label>
          <select class="form-control" data-ticker="${ticker}" data-field="strategy_type" 
                  onchange="toggleStrategyParams('${ticker}', this.value)" 
                  style="margin-bottom: 10px; background: #1a1a1a; color: #fff; border: 1px solid #444;">
            <option value="">-- Select Strategy --</option>
            <option value="rsi" ${strategyType === 'rsi' ? 'selected' : ''}>RSI</option>
            <option value="macd">MACD (Coming Soon)</option>
            <option value="ma" ${strategyType === 'ma' ? 'selected' : ''}>Moving Average (Coming Soon)</option>
            <option value="bollinger">Bollinger Bands (Coming Soon)</option>
          </select>
          
          <div id="strategyParams_${ticker}" style="display: ${paramsDisplay};">
            ${paramsHtml}
          </div>
        </div>
      `;
      
      tickersList.appendChild(tickerCard);
    });
  }
  
  if (config.PORTFOLIO_TARGET_UTILIZATION !== undefined) document.getElementById('portfolioUtilization').value = config.PORTFOLIO_TARGET_UTILIZATION;
  if (config.PORTFOLIO_USE_PARAM_GRID !== undefined) {
    const useParamGridEl = document.getElementById('useParamGrid');
    if (useParamGridEl) {
      useParamGridEl.checked = config.PORTFOLIO_USE_PARAM_GRID;
      const portfolioStrategiesEl = document.getElementById('portfolioStrategies');
      const portfolioParamGridEl = document.getElementById('portfolioParamGrid');
      if (portfolioStrategiesEl) portfolioStrategiesEl.style.display = config.PORTFOLIO_USE_PARAM_GRID ? 'none' : 'block';
      if (portfolioParamGridEl) portfolioParamGridEl.style.display = config.PORTFOLIO_USE_PARAM_GRID ? 'block' : 'none';
    }
  }
  
  // ENTRY section
  if (config.TARGET_WEIGHT !== undefined) document.getElementById('targetWeight').value = config.TARGET_WEIGHT;
  if (config.ENTRY_FEES_BPS !== undefined) document.getElementById('entryFees').value = config.ENTRY_FEES_BPS;
  if (config.SLIP_OPEN_BPS !== undefined) document.getElementById('slipOpen').value = config.SLIP_OPEN_BPS;
  
  // EXIT section
  if (config.EXIT_FEES_BPS !== undefined) document.getElementById('exitFees').value = config.EXIT_FEES_BPS;
  
  // STRATEGY CONDITIONS section
  // Position type is now per-condition, not global
  
  // Load entry conditions
  if (config.ENTRY_CONDITIONS && Array.isArray(config.ENTRY_CONDITIONS)) {
    // Clear existing conditions
    document.getElementById('entryConditionsList').innerHTML = '';
    // Add each condition
    config.ENTRY_CONDITIONS.forEach(condition => {
      addConditionFromData('entry', condition);
    });
  }
  
  if (config.ENTRY_MODE !== undefined) {
    const entryModeRadio = document.querySelector(`input[name="entryMode"][value="${config.ENTRY_MODE}"]`);
    if (entryModeRadio) entryModeRadio.checked = true;
  }
  
  // Vice Versa
  if (config.VICE_VERSA_ENABLED !== undefined) {
    const viceVersaCheckbox = document.getElementById('viceVersaEnabled');
    if (viceVersaCheckbox) {
      viceVersaCheckbox.checked = config.VICE_VERSA_ENABLED;
      toggleViceVersa();
    }
  }
  if (config.VICE_VERSA_DELAY !== undefined) {
    document.getElementById('viceVersaDelay').value = config.VICE_VERSA_DELAY;
  }
  
  // Load exit conditions
  if (config.EXIT_CONDITIONS && Array.isArray(config.EXIT_CONDITIONS)) {
    // Clear existing conditions
    document.getElementById('exitConditionsList').innerHTML = '';
    // Add each condition
    config.EXIT_CONDITIONS.forEach(condition => {
      addConditionFromData('exit', condition);
    });
  }
  
  if (config.EXIT_MODE !== undefined) {
    const exitModeRadio = document.querySelector(`input[name="exitMode"][value="${config.EXIT_MODE}"]`);
    if (exitModeRadio) exitModeRadio.checked = true;
  }
  
  // Take Profit
  if (config.TAKE_PROFIT_ENABLED !== undefined) {
    const tpCheckbox = document.getElementById('takeProfitEnabled');
    if (tpCheckbox) {
      tpCheckbox.checked = config.TAKE_PROFIT_ENABLED;
      toggleTakeProfit(); // Show/hide settings
    }
  }
  if (config.TAKE_PROFIT_TYPE !== undefined) {
    const tpTypeSelect = document.getElementById('takeProfitType');
    if (tpTypeSelect) {
      tpTypeSelect.value = config.TAKE_PROFIT_TYPE;
      toggleTakeProfitType(); // Show/hide percent vs dollar
    }
  }
  if (config.TAKE_PROFIT_PERCENT !== undefined) {
    document.getElementById('takeProfitPercentValue').value = config.TAKE_PROFIT_PERCENT;
  }
  if (config.TAKE_PROFIT_DOLLAR !== undefined) {
    document.getElementById('takeProfitDollarValue').value = config.TAKE_PROFIT_DOLLAR;
  }
  
  // Stop Loss
  if (config.STOP_LOSS_ENABLED !== undefined) {
    const slCheckbox = document.getElementById('stopLossEnabled');
    if (slCheckbox) {
      slCheckbox.checked = config.STOP_LOSS_ENABLED;
      toggleStopLoss(); // Show/hide settings
    }
  }
  if (config.STOP_LOSS_TYPE !== undefined) {
    const slTypeSelect = document.getElementById('stopLossType');
    if (slTypeSelect) {
      slTypeSelect.value = config.STOP_LOSS_TYPE;
      toggleStopLossType(); // Show/hide percent vs dollar
    }
  }
  if (config.STOP_LOSS_PERCENT !== undefined) {
    document.getElementById('stopLossPercentValue').value = config.STOP_LOSS_PERCENT;
  }
  if (config.STOP_LOSS_DOLLAR !== undefined) {
    document.getElementById('stopLossDollarValue').value = config.STOP_LOSS_DOLLAR;
  }
  
  // INDICATORS section
  if (config.RSI_ENABLED !== undefined) document.getElementById('rsiEnabled').checked = config.RSI_ENABLED;
  if (config.RSI_PERIOD !== undefined) document.getElementById('rsiPeriods').value = Array.isArray(config.RSI_PERIOD) ? config.RSI_PERIOD.join(',') : config.RSI_PERIOD;
  if (config.RSI_BUY_BELOW !== undefined) document.getElementById('rsiBuyBelow').value = Array.isArray(config.RSI_BUY_BELOW) ? config.RSI_BUY_BELOW.join(',') : config.RSI_BUY_BELOW;
  if (config.RSI_SELL_ABOVE !== undefined) document.getElementById('rsiSellAbove').value = Array.isArray(config.RSI_SELL_ABOVE) ? config.RSI_SELL_ABOVE.join(',') : config.RSI_SELL_ABOVE;
  
  // OUTPUTS section
  if (config.SAVE_METRICS !== undefined) document.getElementById('saveMetrics').checked = config.SAVE_METRICS;
  if (config.SAVE_DB !== undefined) document.getElementById('saveDb').checked = config.SAVE_DB;
  if (config.SAVE_TRADES !== undefined) document.getElementById('saveTrades').checked = config.SAVE_TRADES;
  if (config.MAKE_TEARSHEETS !== undefined) document.getElementById('makeTearsheets').checked = config.MAKE_TEARSHEETS;
}
// END OLD populateBacktestConfig - DELETE AFTER TESTING

// Run backtest button handler
const runBacktestBtn = document.getElementById('runBacktestBtn');
if (runBacktestBtn) {
  // Listen for progress updates
  window.electronAPI.onBacktestProgress((progress) => {
    console.log('[BACKTEST] Progress:', progress);
    if (progress.progress !== undefined) {
      runBacktestBtn.textContent = `Running... ${progress.progress}%`;
    }
    if (progress.message) {
      console.log('[BACKTEST]', progress.message);
    }
  });

  // Listen for completion
  window.electronAPI.onBacktestComplete((result) => {
    console.log('[BACKTEST] Complete:', result);
    runBacktestBtn.disabled = false;
    runBacktestBtn.textContent = 'Run Backtest';
    runBacktestBtn.classList.remove('loading');
    
    if (result.success) {
      alert(`Backtest completed successfully!\n\nRun ID: ${result.run_id}\n\nYou can view the results in the Results page.`);
      
      // Switch to results page
      const resultsTab = document.querySelector('[data-main-tab="results"]');
      if (resultsTab) {
        resultsTab.click();
      }
    } else {
      alert(`Backtest failed!\n\nError: ${result.error}`);
    }
  });

  // Click handler
  runBacktestBtn.addEventListener('click', async () => {
    console.log('[BACKTEST] Collecting configuration...');
    const config = collectBacktestConfig();
    
    console.log('[BACKTEST] Configuration collected:', config);
    
    // Validate configuration
    if (!config.TICKERS || config.TICKERS.length === 0) {
      alert('Please enter at least one ticker symbol.');
      return;
    }
    
    // Validate entry conditions exist
    if (!config.ENTRY_CONDITIONS || config.ENTRY_CONDITIONS.length === 0) {
      alert('Please add at least one entry condition.');
      return;
    }
    
    // Portfolio mode not yet supported in dynamic backtest
    if (config.PORTFOLIO_MODE) {
      alert('Portfolio mode is not yet implemented in the new dynamic backtest system.\n\nPlease disable portfolio mode and test with individual tickers first.');
      return;
    }
    
    // Convert frontend config (UPPERCASE) to backend format (camelCase)
    const backendConfig = {
      runId: config.RUN_ID || 'auto',
      tickers: config.TICKERS,
      startDate: config.START,
      endDate: config.END || new Date().toISOString().split('T')[0], // Use today if null
      initialCapital: config.INITIAL_CAPITAL,
      entryConditions: config.ENTRY_CONDITIONS || [],
      exitConditions: config.EXIT_CONDITIONS || [],
      entryMode: config.ENTRY_MODE || 'all',
      exitMode: config.EXIT_MODE || 'all',
      takeProfitEnabled: config.TAKE_PROFIT_ENABLED || false,
      takeProfitType: config.TAKE_PROFIT_TYPE,
      takeProfitPercent: config.TAKE_PROFIT_PERCENT,
      takeProfitValue: config.TAKE_PROFIT_VALUE,
      stopLossEnabled: config.STOP_LOSS_ENABLED || false,
      stopLossType: config.STOP_LOSS_TYPE,
      stopLossPercent: config.STOP_LOSS_PERCENT,
      stopLossValue: config.STOP_LOSS_VALUE,
      targetWeight: config.TARGET_WEIGHT || 0.95,
      entryFees: config.ENTRY_FEES_BPS || 10,
      exitFees: config.EXIT_FEES_BPS || 10,
      buyHoldEnabled: config.BUY_HOLD_ENABLED || false,
      benchmarkEnabled: config.BENCHMARK_ENABLED || false,
      benchmarkSymbol: config.BENCHMARK_SYMBOL || 'QQQ',
      saveToDatabase: true, // Always save results
      databasePath: backtestDbPath || null, // Use selected path or default
      notes: config.NOTES || ''
    };
    
    // Disable button and show loading state
    runBacktestBtn.disabled = true;
    runBacktestBtn.textContent = 'Running Backtest...';
    runBacktestBtn.classList.add('loading');
    
    try {
      // Run backtest with new dynamic system
      console.log('[BACKTEST] Starting dynamic backtest...');
      console.log('[BACKTEST] Backend config:', backendConfig);
      const result = await window.electronAPI.runDynamicBacktest(backendConfig);
      
      // Re-enable button
      runBacktestBtn.disabled = false;
      runBacktestBtn.textContent = 'Run Backtest';
      runBacktestBtn.classList.remove('loading');
      
      if (result.success) {
        console.log('[BACKTEST] Grid search completed:', result);
        console.log('[BACKTEST] Best result trades:', result.best_result?.trades);
        
        const best = result.best_result;
        
        // Format entry condition for display
        const formatCondition = (cond) => {
          if (cond.type === 'rsi') {
            const value = cond.target_value || cond.value || '?';
            const interaction = cond.interaction ? cond.interaction.replace(/_/g, ' ') : 'unknown';
            const target = cond.target_type === 'Value' ? `Value(${value})` : cond.target_type;
            return `RSI(${cond.rsi_period}) ${interaction} ${target}`;
          }
          return JSON.stringify(cond);
        };
        
        // Display results in a modal or alert for now
        const tickersList = result.tickers.join(', ');
        
        const summary = `
âœ… Grid Search Complete!

ðŸ“Š Tested:
  â€¢ ${result.num_entry_conditions} entry condition(s)
  â€¢ ${result.num_tickers} ticker(s): ${tickersList}
  â€¢ ${result.total_strategies} total strategy combinations

âœ¨ Database:
  â€¢ ${result.total_runs} run(s) created (1 per entry condition)
  ${result.run_ids && result.run_ids.length > 0 ? `â€¢ ðŸ’¾ Saved ${result.run_ids.length} runs to database` : 'â€¢ âš ï¸ Not saved to database'}
  â€¢ Each run = all grid variations Ã— all tickers

ðŸ† Best Result (Across All):
  â€¢ Ticker: ${best.ticker}
  â€¢ Entry: ${formatCondition(best.entry_condition)}
  â€¢ Total Return: ${best.metrics.total_return.toFixed(2)}%
  â€¢ Sharpe: ${best.metrics.sharpe ? best.metrics.sharpe.toFixed(2) : 'N/A'}
  â€¢ Trades: ${best.metrics.num_trades}
  â€¢ Win Rate: ${best.metrics.win_rate ? (best.metrics.win_rate * 100).toFixed(1) + '%' : 'N/A'}

${best.metrics.num_trades === 0 ? `\nâš ï¸ Note: Best result had NO TRADES
Check if entry conditions are too strict or data range is insufficient.` : ''}

ðŸ‘‰ View detailed results in the Results tab!
Each run shows all tickers as separate strategies.
        `.trim();
        
        alert(summary);
        
        // TODO: Display full results in a proper UI (sortable table, charts, etc.)
        
      } else {
        console.error('[BACKTEST] Backtest failed:', result);
        const errorMsg = result.stderr ? 
          `${result.error}\n\nPython Error:\n${result.stderr}` : 
          result.error;
        alert(`Backtest failed:\n\n${errorMsg}`);
      }
      
    } catch (error) {
      console.error('[BACKTEST] Error running backtest:', error);
      runBacktestBtn.disabled = false;
      runBacktestBtn.textContent = 'Run Backtest';
      runBacktestBtn.classList.remove('loading');
      alert(`Error running backtest:\n\n${error.message || error}`);
    }
  });
}


// Export functions and state
const BacktestConfigModule = {
  loadWatchlistsForBacktest,
  toggleSection,
  initializeBacktestConfig,
  getBacktestConfigs: () => backtestConfigs,
  getConfigFolders: () => configFolders
};

export default BacktestConfigModule;

// Expose to window for backward compatibility
window.loadWatchlistsForBacktest = loadWatchlistsForBacktest;
window.toggleSection = toggleSection;
window.backtestConfigs = backtestConfigs;
window.configFolders = configFolders;

// Initialize function to set up all event listeners
export function initializeBacktestConfig() {
  loadWatchlistsForBacktest();
}
