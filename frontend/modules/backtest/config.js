/**
 * Backtest Configuration Module
 * Handles form collection, population, and config state management
 */

import * as State from '../core/state.js';
import * as Utils from '../core/utils.js';

// ========================================
// State Management
// ========================================

// Config state (localStorage backed)
let backtestConfigs = JSON.parse(localStorage.getItem('backtestConfigs') || '[]');
let configFolders = JSON.parse(localStorage.getItem('configFolders') || '[{"id": 0, "name": "Uncategorized"}]');

// Exposed for backward compat
export function getBacktestConfigs() {
  return backtestConfigs;
}

export function getConfigFolders() {
  return configFolders;
}

export function setBacktestConfigs(configs) {
  backtestConfigs = configs;
  localStorage.setItem('backtestConfigs', JSON.stringify(configs));
}

export function setConfigFolders(folders) {
  configFolders = folders;
  localStorage.setItem('configFolders', JSON.stringify(folders));
}

// ========================================
// Helper Functions
// ========================================

/**
 * Collect configuration from backtest form
 * @returns {Object} Configuration object
 */
export function collectBacktestConfig() {
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
  
  // ENTRY/EXIT
  config.TARGET_WEIGHT = parseFloat(document.getElementById('targetWeight')?.value || 0.95);
  config.ENTRY_FEES_BPS = parseInt(document.getElementById('entryFees')?.value || 10);
  config.SLIP_OPEN_BPS = parseInt(document.getElementById('slipOpen')?.value || 2);
  config.EXIT_FEES_BPS = parseInt(document.getElementById('exitFees')?.value || 10);
  
  // CONDITIONS (collected by separate module)
  config.ENTRY_CONDITIONS = window.collectConditions ? window.collectConditions('entry') : [];
  config.ENTRY_MODE = document.querySelector('input[name="entryMode"]:checked')?.value || 'all';
  config.EXIT_CONDITIONS = window.collectConditions ? window.collectConditions('exit') : [];
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
  
  // OUTPUTS
  config.SAVE_METRICS = document.getElementById('saveMetrics')?.checked || false;
  config.SAVE_DB = document.getElementById('saveDb')?.checked || false;
  config.SAVE_TRADES = document.getElementById('saveTrades')?.checked || false;
  config.MAKE_TEARSHEETS = document.getElementById('makeTearsheets')?.checked || false;
  
  return config;
}

/**
 * Populate backtest form from config object
 * @param {Object} config - Configuration object
 */
export function populateBacktestConfig(config) {
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
  
  // ENTRY/EXIT
  if (config.TARGET_WEIGHT !== undefined) document.getElementById('targetWeight').value = config.TARGET_WEIGHT;
  if (config.ENTRY_FEES_BPS !== undefined) document.getElementById('entryFees').value = config.ENTRY_FEES_BPS;
  if (config.SLIP_OPEN_BPS !== undefined) document.getElementById('slipOpen').value = config.SLIP_OPEN_BPS;
  if (config.EXIT_FEES_BPS !== undefined) document.getElementById('exitFees').value = config.EXIT_FEES_BPS;
  
  // CONDITIONS (handled by separate module)
  if (config.ENTRY_CONDITIONS && Array.isArray(config.ENTRY_CONDITIONS)) {
    document.getElementById('entryConditionsList').innerHTML = '';
    config.ENTRY_CONDITIONS.forEach(condition => {
      if (window.addConditionFromData) window.addConditionFromData('entry', condition);
    });
  }
  
  if (config.ENTRY_MODE !== undefined) {
    const entryModeRadio = document.querySelector(`input[name="entryMode"][value="${config.ENTRY_MODE}"]`);
    if (entryModeRadio) entryModeRadio.checked = true;
  }
  
  if (config.EXIT_CONDITIONS && Array.isArray(config.EXIT_CONDITIONS)) {
    document.getElementById('exitConditionsList').innerHTML = '';
    config.EXIT_CONDITIONS.forEach(condition => {
      if (window.addConditionFromData) window.addConditionFromData('exit', condition);
    });
  }
  
  if (config.EXIT_MODE !== undefined) {
    const exitModeRadio = document.querySelector(`input[name="exitMode"][value="${config.EXIT_MODE}"]`);
    if (exitModeRadio) exitModeRadio.checked = true;
  }
  
  // Vice Versa
  if (config.VICE_VERSA_ENABLED !== undefined) {
    const viceVersaCheckbox = document.getElementById('viceVersaEnabled');
    if (viceVersaCheckbox) {
      viceVersaCheckbox.checked = config.VICE_VERSA_ENABLED;
      if (window.toggleViceVersa) window.toggleViceVersa();
    }
  }
  if (config.VICE_VERSA_DELAY !== undefined) {
    document.getElementById('viceVersaDelay').value = config.VICE_VERSA_DELAY;
  }
  
  // Take Profit
  if (config.TAKE_PROFIT_ENABLED !== undefined) {
    const tpCheckbox = document.getElementById('takeProfitEnabled');
    if (tpCheckbox) {
      tpCheckbox.checked = config.TAKE_PROFIT_ENABLED;
      if (window.toggleTakeProfit) window.toggleTakeProfit();
    }
  }
  if (config.TAKE_PROFIT_TYPE !== undefined) {
    const tpTypeSelect = document.getElementById('takeProfitType');
    if (tpTypeSelect) {
      tpTypeSelect.value = config.TAKE_PROFIT_TYPE;
      if (window.toggleTakeProfitType) window.toggleTakeProfitType();
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
      if (window.toggleStopLoss) window.toggleStopLoss();
    }
  }
  if (config.STOP_LOSS_TYPE !== undefined) {
    const slTypeSelect = document.getElementById('stopLossType');
    if (slTypeSelect) {
      slTypeSelect.value = config.STOP_LOSS_TYPE;
      if (window.toggleStopLossType) window.toggleStopLossType();
    }
  }
  if (config.STOP_LOSS_PERCENT !== undefined) {
    document.getElementById('stopLossPercentValue').value = config.STOP_LOSS_PERCENT;
  }
  if (config.STOP_LOSS_DOLLAR !== undefined) {
    document.getElementById('stopLossDollarValue').value = config.STOP_LOSS_DOLLAR;
  }
  
  // OUTPUTS
  if (config.SAVE_METRICS !== undefined) document.getElementById('saveMetrics').checked = config.SAVE_METRICS;
  if (config.SAVE_DB !== undefined) document.getElementById('saveDb').checked = config.SAVE_DB;
  if (config.SAVE_TRADES !== undefined) document.getElementById('saveTrades').checked = config.SAVE_TRADES;
  if (config.MAKE_TEARSHEETS !== undefined) document.getElementById('makeTearsheets').checked = config.MAKE_TEARSHEETS;
  
  // Update preview ticker dropdown with loaded tickers
  if (window.updatePreviewTickerDropdown) window.updatePreviewTickerDropdown();
}

console.log('[INIT] Backtest Config module loaded');
