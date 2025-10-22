/**
 * Condition Modals Module
 * 
 * Manages condition type selection and configuration modals for backtest runs.
 * Handles entry/exit condition creation and editing for various condition types:
 * - Price conditions
 * - RSI conditions
 * - MA (Moving Average) conditions
 * - MACD conditions
 * - Volume conditions
 * - Bollinger Bands conditions
 */

import * as BacktestRuns from '../backtest/runs.js';
import * as BacktestRunsUI from '../backtest/runs-ui.js';

// Condition Types - Simplified to 3 main types
const CONDITION_TYPES_FOR_RUNS = {
  price: { label: 'Price', description: 'Price interaction with a target value or moving average' },
  rsi: { label: 'RSI', description: 'RSI interaction with a target value or moving average' },
  ma: { label: 'Moving Average', description: 'Moving average crossover or interaction' }
};

const MA_TYPES_FOR_RUNS = ['Value', 'SMA', 'EMA', 'HMA', 'KAMA', 'BB_TOP', 'BB_MID', 'BB_BOTTOM', 'KC_TOP', 'KC_MID', 'KC_BOTTOM'];

const ConditionModals = {
  /**
   * Show modal to select condition type
   * @param {number} runId - Run ID
   * @param {string} conditionGroup - 'entry' or 'exit'
   * @param {Object|null} existingCondition - Existing condition if editing
   * @param {number|null} conditionIndex - Index in conditions array if editing
   */
  showTypeModal(runId, conditionGroup, existingCondition = null, conditionIndex = null) {
    const isEdit = !!existingCondition;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;';
    
    modalContent.innerHTML = `
      <h3 style="margin-top: 0; color: var(--text-primary);">${isEdit ? 'Change' : 'Select'} Condition Type</h3>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
        ${Object.entries(CONDITION_TYPES_FOR_RUNS).map(([key, info]) => `
          <button class="condition-type-btn" data-type="${key}" style="
            padding: 12px; 
            text-align: left; 
            background: ${existingCondition?.type === key ? 'var(--accent-blue)' : 'var(--bg-tertiary)'}; 
            border: 1px solid var(--border-color); 
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-primary);
            transition: all 0.2s;
          ">
            <div style="font-weight: 600;">${info.label}</div>
            <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 4px;">${info.description}</div>
          </button>
        `).join('')}
      </div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="width: 100%;">
        Cancel
      </button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add hover effect and click handlers
    modalContent.querySelectorAll('.condition-type-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        if (btn.dataset.type !== existingCondition?.type) {
          btn.style.background = 'var(--bg-hover)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = existingCondition?.type === btn.dataset.type ? 'var(--accent-blue)' : 'var(--bg-tertiary)';
      });
      btn.addEventListener('click', () => {
        const conditionType = btn.dataset.type;
        ConditionModals.showConfigModal(runId, conditionGroup, conditionType, existingCondition, conditionIndex);
        modal.remove();
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  /**
   * Show modal to configure condition details
   * @param {number} runId - Run ID
   * @param {string} conditionGroup - 'entry' or 'exit'
   * @param {string} conditionType - Type of condition (price, rsi, ma, etc.)
   * @param {Object|null} existingCondition - Existing condition if editing
   * @param {number|null} conditionIndex - Index in conditions array if editing
   */
  showConfigModal(runId, conditionGroup, conditionType, existingCondition, conditionIndex) {
    const isEdit = !!existingCondition;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); padding: 30px; border-radius: 8px; max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto;';
    
    // Generate fields based on condition type
    const fieldsHTML = this._generateFieldsHTML(conditionType, existingCondition);
    
    modalContent.innerHTML = `
      <h3 style="margin-top: 0; color: var(--text-primary);">
        ${isEdit ? 'Edit' : 'Add'} ${CONDITION_TYPES_FOR_RUNS[conditionType].label} Condition
      </h3>
      <form id="conditionForm">
        ${fieldsHTML}
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn-primary" style="flex: 1;">
            ${isEdit ? 'Update' : 'Add'} Condition
          </button>
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
            Cancel
          </button>
        </div>
      </form>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Initialize field visibility for types that use target fields
    if (['price', 'rsi', 'ma'].includes(conditionType)) {
      setTimeout(() => {
        this.toggleTargetFields();
        this.toggleDirectionField();
      }, 0);
    }
    
    // Handle form submission
    const form = modalContent.querySelector('#conditionForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const conditionData = this._collectFormData(conditionType);
      this._saveCondition(runId, conditionGroup, conditionData, isEdit, conditionIndex);
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  /**
   * Generate HTML fields for the condition type
   * @private
   */
  _generateFieldsHTML(conditionType, existingCondition) {
    switch (conditionType) {
      case 'price':
        return this._generatePriceFields(existingCondition);
      case 'rsi':
        return this._generateRSIFields(existingCondition);
      case 'ma':
        return this._generateMAFields(existingCondition);
      case 'macd':
        return this._generateMACDFields(existingCondition);
      case 'sma':
      case 'ema':
        return this._generateMALegacyFields(conditionType, existingCondition);
      case 'volume':
        return this._generateVolumeFields(existingCondition);
      case 'bb':
        return this._generateBBFields(existingCondition);
      default:
        return '<p style="color: var(--text-secondary);">Unknown condition type</p>';
    }
  },

  /**
   * Generate price condition fields
   * @private
   */
  _generatePriceFields(existingCondition) {
    return `
      <div class="modal-field">
        <label for="modal_position_type">Position Type:</label>
        <select id="modal_position_type" class="form-select">
          <option value="long" ${existingCondition?.position_type === 'long' ? 'selected' : ''}>Long</option>
          <option value="short" ${existingCondition?.position_type === 'short' ? 'selected' : ''}>Short</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_target_type">Target Type:</label>
        <select id="modal_target_type" class="form-select" onchange="window.toggleModalTargetFields()">
          ${MA_TYPES_FOR_RUNS.map(type => 
            `<option value="${type}" ${existingCondition?.target_type === type ? 'selected' : ''}>${type}</option>`
          ).join('')}
        </select>
      </div>
      <div class="modal-field" id="modal_target_value_field">
        <label for="modal_target_value">Target Value ($):</label>
        <input type="number" id="modal_target_value" value="${existingCondition?.target_value || 100}" min="0" step="0.01" class="form-input">
      </div>
      <div class="modal-field" id="modal_target_period_field" style="display: none;">
        <label for="modal_target_period">Target Period:</label>
        <input type="number" id="modal_target_period" value="${existingCondition?.target_period || 20}" min="2" max="200" class="form-input">
      </div>
      <div class="modal-field" id="modal_bb_std_field" style="display: none;">
        <label for="modal_bb_std">BB Std Dev: <span id="modal_bb_std_value">${existingCondition?.bb_std || 2.0}</span></label>
        <input type="range" id="modal_bb_std" min="1" max="3" step="0.1" value="${existingCondition?.bb_std || 2.0}" class="slider"
               oninput="document.getElementById('modal_bb_std_value').textContent = this.value">
      </div>
      <div class="modal-field" id="modal_kc_mult_field" style="display: none;">
        <label for="modal_kc_mult">KC ATR Multiplier:</label>
        <input type="number" id="modal_kc_mult" value="${existingCondition?.kc_mult || 2.0}" min="0.5" max="5" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_interaction">Interaction:</label>
        <select id="modal_interaction" class="form-select" onchange="window.toggleModalDirectionField()">
          <option value="cross" ${existingCondition?.interaction === 'cross' ? 'selected' : ''}>Cross</option>
          <option value="above" ${existingCondition?.interaction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.interaction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field" id="modal_direction_field">
        <label for="modal_direction">Direction:</label>
        <select id="modal_direction" class="form-select">
          <option value="above" ${existingCondition?.direction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.direction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_threshold_pct">Cross Threshold %
          <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
            How far past target price must cross (e.g., 2% means price must go 2% beyond the target)
          </small>
        </label>
        <input type="number" id="modal_threshold_pct" value="${existingCondition?.threshold_pct !== undefined ? existingCondition.threshold_pct : 0.5}" 
               min="0" max="10" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_delay_bars">Delay Bars:</label>
        <input type="number" id="modal_delay_bars" value="${existingCondition?.delay_bars || 0}" min="0" max="10" class="form-input">
      </div>
    `;
  },

  /**
   * Generate RSI condition fields
   * @private
   */
  _generateRSIFields(existingCondition) {
    return `
      <div class="modal-field">
        <label for="modal_position_type">Position Type:</label>
        <select id="modal_position_type" class="form-select">
          <option value="long" ${existingCondition?.position_type === 'long' ? 'selected' : ''}>Long</option>
          <option value="short" ${existingCondition?.position_type === 'short' ? 'selected' : ''}>Short</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_rsi_period">RSI Period:</label>
        <input type="number" id="modal_rsi_period" value="${existingCondition?.rsi_period || 14}" min="2" max="50" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_target_type">Target Type:</label>
        <select id="modal_target_type" class="form-select" onchange="window.toggleModalTargetFields()">
          ${MA_TYPES_FOR_RUNS.map(type => 
            `<option value="${type}" ${existingCondition?.target_type === type ? 'selected' : ''}>${type}</option>`
          ).join('')}
        </select>
      </div>
      <div class="modal-field" id="modal_target_value_field">
        <label for="modal_target_value">Target Value:</label>
        <input type="number" id="modal_target_value" value="${existingCondition?.target_value || 30}" min="0" max="100" step="0.1" class="form-input">
      </div>
      <div class="modal-field" id="modal_target_period_field" style="display: none;">
        <label for="modal_target_period">Target Period:</label>
        <input type="number" id="modal_target_period" value="${existingCondition?.target_period || 20}" min="2" max="200" class="form-input">
      </div>
      <div class="modal-field" id="modal_bb_std_field" style="display: none;">
        <label for="modal_bb_std">BB Std Dev: <span id="modal_bb_std_value">${existingCondition?.bb_std || 2.0}</span></label>
        <input type="range" id="modal_bb_std" min="1" max="3" step="0.1" value="${existingCondition?.bb_std || 2.0}" class="slider"
               oninput="document.getElementById('modal_bb_std_value').textContent = this.value">
      </div>
      <div class="modal-field" id="modal_kc_mult_field" style="display: none;">
        <label for="modal_kc_mult">KC ATR Multiplier:</label>
        <input type="number" id="modal_kc_mult" value="${existingCondition?.kc_mult || 2.0}" min="0.5" max="5" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_interaction">Interaction:</label>
        <select id="modal_interaction" class="form-select" onchange="window.toggleModalDirectionField()">
          <option value="cross" ${existingCondition?.interaction === 'cross' ? 'selected' : ''}>Cross</option>
          <option value="above" ${existingCondition?.interaction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.interaction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field" id="modal_direction_field">
        <label for="modal_direction">Direction:</label>
        <select id="modal_direction" class="form-select">
          <option value="above" ${existingCondition?.direction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.direction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_threshold_pct">Cross Threshold %
          <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
            How far past target RSI must cross (e.g., 2% means RSI must go 2% beyond the target value)
          </small>
        </label>
        <input type="number" id="modal_threshold_pct" value="${existingCondition?.threshold_pct !== undefined ? existingCondition.threshold_pct : 0.5}" 
               min="0" max="10" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_delay_bars">Delay Bars:</label>
        <input type="number" id="modal_delay_bars" value="${existingCondition?.delay_bars || 0}" min="0" max="10" class="form-input">
      </div>
    `;
  },

  /**
   * Generate MA condition fields
   * @private
   */
  _generateMAFields(existingCondition) {
    return `
      <div class="modal-field">
        <label for="modal_position_type">Position Type:</label>
        <select id="modal_position_type" class="form-select">
          <option value="long" ${existingCondition?.position_type === 'long' ? 'selected' : ''}>Long</option>
          <option value="short" ${existingCondition?.position_type === 'short' ? 'selected' : ''}>Short</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_ma_type">MA Type:</label>
        <select id="modal_ma_type" class="form-select">
          <option value="SMA" ${existingCondition?.ma_type === 'SMA' ? 'selected' : ''}>SMA</option>
          <option value="EMA" ${existingCondition?.ma_type === 'EMA' ? 'selected' : ''}>EMA</option>
          <option value="HMA" ${existingCondition?.ma_type === 'HMA' ? 'selected' : ''}>HMA</option>
          <option value="KAMA" ${existingCondition?.ma_type === 'KAMA' ? 'selected' : ''}>KAMA</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_ma_period">MA Period:</label>
        <input type="number" id="modal_ma_period" value="${existingCondition?.ma_period || 20}" min="2" max="200" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_target_type">Target Type:</label>
        <select id="modal_target_type" class="form-select" onchange="window.toggleModalTargetFields()">
          ${MA_TYPES_FOR_RUNS.map(type => 
            `<option value="${type}" ${existingCondition?.target_type === type ? 'selected' : ''}>${type}</option>`
          ).join('')}
        </select>
      </div>
      <div class="modal-field" id="modal_target_value_field">
        <label for="modal_target_value">Target Value:</label>
        <input type="number" id="modal_target_value" value="${existingCondition?.target_value || 100}" min="0" step="0.01" class="form-input">
      </div>
      <div class="modal-field" id="modal_target_period_field" style="display: none;">
        <label for="modal_target_period">Target Period:</label>
        <input type="number" id="modal_target_period" value="${existingCondition?.target_period || 50}" min="2" max="200" class="form-input">
      </div>
      <div class="modal-field" id="modal_bb_std_field" style="display: none;">
        <label for="modal_bb_std">BB Std Dev: <span id="modal_bb_std_value">${existingCondition?.bb_std || 2.0}</span></label>
        <input type="range" id="modal_bb_std" min="1" max="3" step="0.1" value="${existingCondition?.bb_std || 2.0}" class="slider"
               oninput="document.getElementById('modal_bb_std_value').textContent = this.value">
      </div>
      <div class="modal-field" id="modal_kc_mult_field" style="display: none;">
        <label for="modal_kc_mult">KC ATR Multiplier:</label>
        <input type="number" id="modal_kc_mult" value="${existingCondition?.kc_mult || 2.0}" min="0.5" max="5" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_interaction">Interaction:</label>
        <select id="modal_interaction" class="form-select" onchange="window.toggleModalDirectionField()">
          <option value="cross" ${existingCondition?.interaction === 'cross' ? 'selected' : ''}>Cross</option>
          <option value="above" ${existingCondition?.interaction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.interaction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field" id="modal_direction_field">
        <label for="modal_direction">Direction:</label>
        <select id="modal_direction" class="form-select">
          <option value="above" ${existingCondition?.direction === 'above' ? 'selected' : ''}>Above</option>
          <option value="below" ${existingCondition?.direction === 'below' ? 'selected' : ''}>Below</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="modal_threshold_pct">Cross Threshold %
          <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
            How far MA must cross target
          </small>
        </label>
        <input type="number" id="modal_threshold_pct" value="${existingCondition?.threshold_pct !== undefined ? existingCondition.threshold_pct : 0.5}" 
               min="0" max="10" step="0.1" class="form-input">
      </div>
      <div class="modal-field">
        <label for="modal_delay_bars">Delay Bars:</label>
        <input type="number" id="modal_delay_bars" value="${existingCondition?.delay_bars || 0}" min="0" max="10" class="form-input">
      </div>
    `;
  },

  /**
   * Generate MACD condition fields
   * @private
   */
  _generateMACDFields(existingCondition) {
    return `
      <div class="form-group">
        <label>Fast Period</label>
        <input type="number" id="condition_fast_period" value="${existingCondition?.fast_period || 12}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>Slow Period</label>
        <input type="number" id="condition_slow_period" value="${existingCondition?.slow_period || 26}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>Signal Period</label>
        <input type="number" id="condition_signal_period" value="${existingCondition?.signal_period || 9}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>Signal Type</label>
        <select id="condition_signal_type" class="form-control">
          <option value="histogram_positive" ${existingCondition?.signal_type === 'histogram_positive' ? 'selected' : ''}>Histogram Positive</option>
          <option value="histogram_negative" ${existingCondition?.signal_type === 'histogram_negative' ? 'selected' : ''}>Histogram Negative</option>
          <option value="line_cross_up" ${existingCondition?.signal_type === 'line_cross_up' ? 'selected' : ''}>Line Crosses Up</option>
          <option value="line_cross_down" ${existingCondition?.signal_type === 'line_cross_down' ? 'selected' : ''}>Line Crosses Down</option>
        </select>
      </div>
    `;
  },

  /**
   * Generate legacy SMA/EMA condition fields
   * @private
   */
  _generateMALegacyFields(conditionType, existingCondition) {
    const maType = conditionType.toUpperCase();
    return `
      <div class="form-group">
        <label>${maType} Fast Period</label>
        <input type="number" id="condition_fast_period" value="${existingCondition?.fast_period || 20}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>${maType} Slow Period</label>
        <input type="number" id="condition_slow_period" value="${existingCondition?.slow_period || 50}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>Signal</label>
        <select id="condition_signal" class="form-control">
          <option value="cross_above" ${existingCondition?.signal === 'cross_above' ? 'selected' : ''}>Fast crosses above Slow</option>
          <option value="cross_below" ${existingCondition?.signal === 'cross_below' ? 'selected' : ''}>Fast crosses below Slow</option>
        </select>
      </div>
    `;
  },

  /**
   * Generate volume condition fields
   * @private
   */
  _generateVolumeFields(existingCondition) {
    return `
      <div class="form-group">
        <label>Comparison</label>
        <select id="condition_comparison" class="form-control">
          <option value="greater_than" ${existingCondition?.comparison === 'greater_than' ? 'selected' : ''}>Greater Than Average</option>
          <option value="less_than" ${existingCondition?.comparison === 'less_than' ? 'selected' : ''}>Less Than Average</option>
        </select>
      </div>
      <div class="form-group">
        <label>Volume MA Period</label>
        <input type="number" id="condition_ma_period" value="${existingCondition?.ma_period || 20}" min="1" class="form-control">
        <small style="color: var(--text-secondary);">Period for volume moving average comparison</small>
      </div>
      <div class="form-group">
        <label>Multiplier</label>
        <input type="number" id="condition_multiplier" value="${existingCondition?.multiplier || 1.5}" step="0.1" min="0.1" class="form-control">
        <small style="color: var(--text-secondary);">Volume must be X times the average</small>
      </div>
    `;
  },

  /**
   * Generate Bollinger Bands condition fields
   * @private
   */
  _generateBBFields(existingCondition) {
    return `
      <div class="form-group">
        <label>BB Period</label>
        <input type="number" id="condition_bb_period" value="${existingCondition?.bb_period || 20}" min="1" class="form-control">
      </div>
      <div class="form-group">
        <label>Standard Deviations</label>
        <input type="number" id="condition_bb_std" value="${existingCondition?.bb_std || 2}" step="0.1" min="0.1" class="form-control">
      </div>
      <div class="form-group">
        <label>Signal</label>
        <select id="condition_signal" class="form-control">
          <option value="price_below_lower" ${existingCondition?.signal === 'price_below_lower' ? 'selected' : ''}>Price Below Lower Band</option>
          <option value="price_above_upper" ${existingCondition?.signal === 'price_above_upper' ? 'selected' : ''}>Price Above Upper Band</option>
          <option value="price_crosses_lower_up" ${existingCondition?.signal === 'price_crosses_lower_up' ? 'selected' : ''}>Price Crosses Lower Band Up</option>
          <option value="price_crosses_upper_down" ${existingCondition?.signal === 'price_crosses_upper_down' ? 'selected' : ''}>Price Crosses Upper Band Down</option>
        </select>
      </div>
    `;
  },

  /**
   * Collect form data based on condition type
   * @private
   */
  _collectFormData(conditionType) {
    const conditionData = { type: conditionType };
    
    // Common fields
    if (document.getElementById('modal_position_type')) {
      conditionData.position_type = document.getElementById('modal_position_type').value;
    }
    if (document.getElementById('modal_delay_bars')) {
      conditionData.delay_bars = parseInt(document.getElementById('modal_delay_bars').value) || 0;
    }
    if (document.getElementById('modal_threshold_pct')) {
      conditionData.threshold_pct = parseFloat(document.getElementById('modal_threshold_pct').value) || 0;
    }
    
    switch (conditionType) {
      case 'price':
        this._collectPriceData(conditionData);
        break;
      case 'rsi':
        this._collectRSIData(conditionData);
        break;
      case 'ma':
        this._collectMAData(conditionData);
        break;
      case 'macd':
        conditionData.fast_period = parseInt(document.getElementById('condition_fast_period').value);
        conditionData.slow_period = parseInt(document.getElementById('condition_slow_period').value);
        conditionData.signal_period = parseInt(document.getElementById('condition_signal_period').value);
        conditionData.signal_type = document.getElementById('condition_signal_type').value;
        break;
      case 'sma':
      case 'ema':
        conditionData.fast_period = parseInt(document.getElementById('condition_fast_period').value);
        conditionData.slow_period = parseInt(document.getElementById('condition_slow_period').value);
        conditionData.signal = document.getElementById('condition_signal').value;
        break;
      case 'volume':
        conditionData.comparison = document.getElementById('condition_comparison').value;
        conditionData.ma_period = parseInt(document.getElementById('condition_ma_period').value);
        conditionData.multiplier = parseFloat(document.getElementById('condition_multiplier').value);
        break;
      case 'bb':
        conditionData.bb_period = parseInt(document.getElementById('condition_bb_period').value);
        conditionData.bb_std = parseFloat(document.getElementById('condition_bb_std').value);
        conditionData.signal = document.getElementById('condition_signal').value;
        break;
    }
    
    return conditionData;
  },

  /**
   * Collect price condition data
   * @private
   */
  _collectPriceData(conditionData) {
    conditionData.target_type = document.getElementById('modal_target_type').value;
    
    if (conditionData.target_type === 'Value') {
      conditionData.target_value = parseFloat(document.getElementById('modal_target_value').value);
    } else {
      conditionData.target_period = parseInt(document.getElementById('modal_target_period').value);
      
      if (conditionData.target_type.includes('BB_')) {
        conditionData.bb_std = parseFloat(document.getElementById('modal_bb_std').value);
      } else if (conditionData.target_type.includes('KC_')) {
        conditionData.kc_mult = parseFloat(document.getElementById('modal_kc_mult').value);
      }
    }
    
    conditionData.interaction = document.getElementById('modal_interaction').value;
    if (conditionData.interaction === 'cross') {
      conditionData.direction = document.getElementById('modal_direction').value;
    }
  },

  /**
   * Collect RSI condition data
   * @private
   */
  _collectRSIData(conditionData) {
    conditionData.rsi_period = parseInt(document.getElementById('modal_rsi_period').value);
    conditionData.target_type = document.getElementById('modal_target_type').value;
    
    if (conditionData.target_type === 'Value') {
      conditionData.target_value = parseFloat(document.getElementById('modal_target_value').value);
    } else {
      conditionData.target_period = parseInt(document.getElementById('modal_target_period').value);
      
      if (conditionData.target_type.includes('BB_')) {
        conditionData.bb_std = parseFloat(document.getElementById('modal_bb_std').value);
      } else if (conditionData.target_type.includes('KC_')) {
        conditionData.kc_mult = parseFloat(document.getElementById('modal_kc_mult').value);
      }
    }
    
    conditionData.interaction = document.getElementById('modal_interaction').value;
    if (conditionData.interaction === 'cross') {
      conditionData.direction = document.getElementById('modal_direction').value;
    }
  },

  /**
   * Collect MA condition data
   * @private
   */
  _collectMAData(conditionData) {
    conditionData.ma_type = document.getElementById('modal_ma_type').value;
    conditionData.ma_period = parseInt(document.getElementById('modal_ma_period').value);
    conditionData.target_type = document.getElementById('modal_target_type').value;
    
    if (conditionData.target_type === 'Value') {
      conditionData.target_value = parseFloat(document.getElementById('modal_target_value').value);
    } else {
      conditionData.target_period = parseInt(document.getElementById('modal_target_period').value);
      
      if (conditionData.target_type.includes('BB_')) {
        conditionData.bb_std = parseFloat(document.getElementById('modal_bb_std').value);
      } else if (conditionData.target_type.includes('KC_')) {
        conditionData.kc_mult = parseFloat(document.getElementById('modal_kc_mult').value);
      }
    }
    
    conditionData.interaction = document.getElementById('modal_interaction').value;
    if (conditionData.interaction === 'cross') {
      conditionData.direction = document.getElementById('modal_direction').value;
    }
  },

  /**
   * Save condition to run
   * @private
   */
  _saveCondition(runId, conditionGroup, conditionData, isEdit, conditionIndex) {
    if (isEdit && conditionIndex !== undefined) {
      // Find and update existing condition
      const run = BacktestRuns.getRun(runId);
      if (run) {
        const conditions = conditionGroup === 'entry' ? run.entryConditions : run.exitConditions;
        if (conditions[conditionIndex]) {
          conditions[conditionIndex] = conditionData;
          BacktestRuns.saveRuns();
        }
      }
    } else {
      // Add new condition
      if (conditionGroup === 'entry') {
        BacktestRuns.addEntryCondition(runId, conditionData);
      } else {
        BacktestRuns.addExitCondition(runId, conditionData);
      }
    }
    
    BacktestRunsUI.renderRunDetails();
  },

  /**
   * Toggle target fields visibility based on selected target type
   */
  toggleTargetFields() {
    const targetType = document.getElementById('modal_target_type')?.value;
    if (!targetType) return;
    
    const valueField = document.getElementById('modal_target_value_field');
    const periodField = document.getElementById('modal_target_period_field');
    const bbStdField = document.getElementById('modal_bb_std_field');
    const kcMultField = document.getElementById('modal_kc_mult_field');
    
    if (targetType === 'Value') {
      valueField.style.display = 'block';
      periodField.style.display = 'none';
      bbStdField.style.display = 'none';
      kcMultField.style.display = 'none';
    } else if (targetType.includes('BB_')) {
      valueField.style.display = 'none';
      periodField.style.display = 'block';
      bbStdField.style.display = 'block';
      kcMultField.style.display = 'none';
    } else if (targetType.includes('KC_')) {
      valueField.style.display = 'none';
      periodField.style.display = 'block';
      bbStdField.style.display = 'none';
      kcMultField.style.display = 'block';
    } else {
      valueField.style.display = 'none';
      periodField.style.display = 'block';
      bbStdField.style.display = 'none';
      kcMultField.style.display = 'none';
    }
  },

  /**
   * Toggle direction field visibility based on interaction type
   */
  toggleDirectionField() {
    const interaction = document.getElementById('modal_interaction')?.value;
    const directionField = document.getElementById('modal_direction_field');
    const thresholdLabel = document.querySelector('label[for="modal_threshold_pct"]');
    
    if (directionField) {
      directionField.style.display = interaction === 'cross' ? 'block' : 'none';
    }
    
    // Update threshold label based on interaction
    if (thresholdLabel) {
      const labelText = interaction === 'cross' ? 'Cross Threshold %' : 'Threshold %';
      const helpText = interaction === 'cross' 
        ? 'How far past target it must cross (e.g., 2% means must go 2% beyond target)'
        : 'How far above/below target it must be (e.g., 2% means must be 2% away from target)';
      
      thresholdLabel.innerHTML = `${labelText}
        <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
          ${helpText}
        </small>`;
    }
  }
};

// Export module
export { ConditionModals };

// Also expose to window for backward compatibility
window.ConditionModals = ConditionModals;

console.log('[INIT] Condition modals module loaded');
