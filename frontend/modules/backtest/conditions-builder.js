/**
 * Strategy Conditions Builder Module
 * UI for building and managing strategy entry/exit conditions
 */

let conditionCounter = 0;

// Condition type definitions
const CONDITION_TYPES = {
  timing: { label: 'Timing Window', description: 'Entry/Exit at specific times' },
  price: { label: 'Price', description: 'Price interaction with MA/indicator or value' },
  rsi: { label: 'RSI', description: 'RSI interaction with MA/indicator or value' },
  ma_crossover: { label: 'MA Crossover', description: 'Fast MA crosses slow MA' }
};

// MA type options (including band indicators and value)
const MA_TYPES = ['Value', 'SMA', 'EMA', 'HMA', 'KAMA', 'BB_TOP', 'BB_MID', 'BB_BOTTOM', 'KC_TOP', 'KC_MID', 'KC_BOTTOM'];

// Add condition (unified for entry/exit)
function addCondition(conditionGroup) {
  showConditionTypeModal(conditionGroup);
}

// Show modal to select condition type
function showConditionTypeModal(conditionGroup) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: var(--bg-secondary); padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;';
  
  modalContent.innerHTML = `
    <h3 style="margin-top: 0;">Select Condition Type</h3>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${Object.entries(CONDITION_TYPES).map(([key, info]) => `
        <button class="condition-type-btn" data-type="${key}" style="
          padding: 12px; 
          text-align: left; 
          background: var(--bg-tertiary); 
          border: 1px solid var(--border-color); 
          border-radius: 4px;
          cursor: pointer;
          color: var(--text-primary);
          transition: background 0.2s;
        ">
          <div style="font-weight: 600;">${info.label}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 4px;">${info.description}</div>
        </button>
      `).join('')}
    </div>
    <button id="cancelConditionType" style="
      margin-top: 20px; 
      padding: 8px 20px; 
      background: #666; 
      color: white; 
      border: none; 
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
    ">Cancel</button>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add hover effect
  modalContent.querySelectorAll('.condition-type-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-hover)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'var(--bg-tertiary)');
    btn.addEventListener('click', () => {
      const conditionType = btn.dataset.type;
      createConditionCard(conditionGroup, conditionType);
      modal.remove();
    });
  });
  
  modalContent.querySelector('#cancelConditionType').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Create condition card based on type
function createConditionCard(conditionGroup, conditionType) {
  conditionCounter++;
  const conditionId = `condition_${conditionCounter}`;
  
  const listId = conditionGroup === 'entry' ? 'entryConditionsList' : 'exitConditionsList';
  const list = document.getElementById(listId);
  
  const card = document.createElement('div');
  card.className = 'condition-card';
  card.dataset.conditionId = conditionId;
  card.dataset.conditionType = conditionType;
  
  // Header
  const header = document.createElement('div');
  header.className = 'condition-header';
  header.innerHTML = `
    <span class="condition-type-label">${CONDITION_TYPES[conditionType].label}</span>
    <button class="condition-remove-btn" onclick="removeCondition('${conditionId}')">Remove</button>
  `;
  card.appendChild(header);
  
  // Add exit condition targeting if this is an exit condition
  if (conditionGroup === 'exit') {
    const targetingDiv = document.createElement('div');
    targetingDiv.className = 'exit-targeting';
    targetingDiv.innerHTML = buildExitTargetingFields(conditionId);
    card.appendChild(targetingDiv);
  }
  
  // Fields container
  const fieldsDiv = document.createElement('div');
  fieldsDiv.className = 'condition-fields';
  
  // Build fields based on condition type
  switch (conditionType) {
    case 'timing':
      fieldsDiv.innerHTML = buildTimingFields(conditionId);
      break;
    case 'price':
      fieldsDiv.innerHTML = buildPriceFields(conditionId);
      break;
    case 'rsi':
      fieldsDiv.innerHTML = buildRSIFields(conditionId);
      break;
    case 'ma_crossover':
      fieldsDiv.innerHTML = buildMACrossoverFields(conditionId);
      break;
  }
  
  card.appendChild(fieldsDiv);
  list.appendChild(card);
}

// Build exit targeting fields
function buildExitTargetingFields(id) {
  // Get all entry conditions to populate checkboxes
  const entryCards = document.querySelectorAll('#entryConditionsList .condition-card');
  let checkboxesHTML = `
    <div style="margin-bottom: 8px;">
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input type="checkbox" id="${id}_target_all" checked onchange="updateExitTargetAll('${id}')" />
        <span style="font-weight: 600;">All Entry Conditions (General Exit)</span>
      </label>
    </div>
    <div id="${id}_specific_targets" style="display: none; padding-left: 20px; border-left: 2px solid var(--accent-blue);">
  `;
  
  entryCards.forEach((card, index) => {
    const entryId = card.dataset.conditionId;
    const entryType = card.dataset.conditionType;
    const entryLabel = CONDITION_TYPES[entryType]?.label || entryType;
    checkboxesHTML += `
      <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;">
        <input type="checkbox" class="${id}_target_entry" data-entry-id="${entryId}" onchange="updateExitTargeting('${id}')" />
        <span>Entry #${index + 1}: ${entryLabel}</span>
      </label>
    `;
  });
  
  checkboxesHTML += `</div>`;
  
  return `
    <div class="condition-field-row" style="background: rgba(100, 100, 255, 0.1); padding: 10px; border-radius: 4px; margin-bottom: 10px;">
      <div class="condition-field">
        <label style="font-weight: 600; margin-bottom: 8px; display: block;">Exit Targets</label>
        ${checkboxesHTML}
        <small style="margin-top: 8px; display: block;">Choose which entry condition(s) this exit applies to</small>
      </div>
    </div>
  `;
}

// Build timing fields
function buildTimingFields(id) {
  return `
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Start Time (HH:MM)</label>
        <input type="time" id="${id}_time1" value="09:30" />
      </div>
      <div class="condition-field">
        <label>End Time (HH:MM)</label>
        <input type="time" id="${id}_time2" value="16:00" />
      </div>
    </div>
  `;
}

// Build price fields
function buildPriceFields(id) {
  return `
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Position Type</label>
        <select id="${id}_position_type">
          <option value="long" selected>Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      <div class="condition-field">
        <label>Target Type</label>
        <select id="${id}_target_type" onchange="toggleTargetParams('${id}')">
          ${MA_TYPES.map((ma, idx) => {
            const selected = ma === 'SMA' ? ' selected' : '';
            return `<option value="${ma}"${selected}>${ma}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="condition-field" id="${id}_value_field" style="display: none;">
        <label>Value(s)</label>
        <input type="text" id="${id}_target_value" value="600" placeholder="100 or 100,110,120" />
        <small>Single value or comma-separated list for grid</small>
      </div>
      <div class="condition-field" id="${id}_period_field">
        <label>Period(s)</label>
        <input type="text" id="${id}_target_period" value="20" placeholder="20 or 20,50,200" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
    <div id="${id}_bb_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>BB Std Dev: <span id="${id}_bb_std_value">2.0</span></label>
          <input type="range" id="${id}_bb_std" min="1" max="3" step="0.1" value="2" class="slider" 
                 oninput="document.getElementById('${id}_bb_std_value').textContent = this.value" />
          <small>Bollinger Band standard deviation multiplier</small>
        </div>
      </div>
    </div>
    <div id="${id}_kc_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>KC ATR Mult(s)</label>
          <input type="text" id="${id}_kc_mult" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Interaction</label>
        <select id="${id}_interaction" onchange="toggleInteractionFields('${id}')">
          <option value="cross" selected>Cross</option>
          <option value="recross">Recross</option>
        </select>
      </div>
      <div class="condition-field" id="${id}_direction_field">
        <label>Cross Direction</label>
        <select id="${id}_direction">
          <option value="above" selected>Price crosses UP through target</option>
          <option value="below">Price crosses DOWN through target</option>
        </select>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Threshold %(s)</label>
        <input type="text" id="${id}_threshold_pct" value="0.5" placeholder="0.5 or 0.5,1.0,2.0" />
        <small>Single value or comma-separated list for grid</small>
      </div>
      <div class="condition-field">
        <label>Delay Bar(s)</label>
        <input type="text" id="${id}_delay" value="0" placeholder="0 or 0,1,2" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
  `;
}

// Build RSI fields
function buildRSIFields(id) {
  return `
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Position Type</label>
        <select id="${id}_position_type">
          <option value="long" selected>Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      <div class="condition-field">
        <label>RSI Period(s)</label>
        <input type="text" id="${id}_rsi_period" value="14" placeholder="14 or 7,14,21" />
        <small>Single value or comma-separated list for grid</small>
      </div>
      <div class="condition-field">
        <label>Target Type</label>
        <select id="${id}_target_type" onchange="toggleTargetParams('${id}')">
          ${MA_TYPES.map((ma, idx) => {
            const selected = ma === 'SMA' ? ' selected' : '';
            return `<option value="${ma}"${selected}>${ma}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="condition-field" id="${id}_value_field" style="display: none;">
        <label>Value(s)</label>
        <input type="text" id="${id}_target_value" value="30" placeholder="30 or 20,30,40" />
        <small>Single value or comma-separated list for grid</small>
      </div>
      <div class="condition-field" id="${id}_period_field">
        <label>Period(s)</label>
        <input type="text" id="${id}_target_period" value="14" placeholder="14 or 10,14,20" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
    <div id="${id}_bb_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>BB Std Dev: <span id="${id}_bb_std_value">2.0</span></label>
          <input type="range" id="${id}_bb_std" min="1" max="3" step="0.1" value="2" class="slider" 
                 oninput="document.getElementById('${id}_bb_std_value').textContent = this.value" />
          <small>Bollinger Band standard deviation multiplier</small>
        </div>
      </div>
    </div>
    <div id="${id}_kc_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>KC ATR Mult(s)</label>
          <input type="text" id="${id}_kc_mult" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Interaction</label>
        <select id="${id}_interaction" onchange="toggleInteractionFields('${id}')">
          <option value="cross" selected>Cross</option>
          <option value="recross">Recross</option>
        </select>
      </div>
      <div class="condition-field" id="${id}_direction_field">
        <label>Cross Direction</label>
        <select id="${id}_direction">
          <option value="above" selected>RSI crosses UP through target</option>
          <option value="below">RSI crosses DOWN through target</option>
        </select>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Threshold(s)</label>
        <input type="text" id="${id}_threshold_pct" value="2.0" placeholder="2.0 or 1.0,2.0,3.0" />
        <small>Single value or comma-separated list for grid</small>
      </div>
      <div class="condition-field">
        <label>Delay Bar(s)</label>
        <input type="text" id="${id}_delay" value="0" placeholder="0 or 0,1,2" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
  `;
}

// Build MA crossover fields
function buildMACrossoverFields(id) {
  const MA_TYPES_NO_VALUE = MA_TYPES.filter(ma => ma !== 'Value');
  return `
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Position Type</label>
        <select id="${id}_position_type">
          <option value="long" selected>Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      <div class="condition-field">
        <label>Fast MA Type</label>
        <select id="${id}_fast_ma_type" onchange="toggleMAParams('${id}', 'fast')">
          ${MA_TYPES_NO_VALUE.map(ma => `<option value="${ma}">${ma}</option>`).join('')}
        </select>
      </div>
      <div class="condition-field">
        <label>Fast Period(s)</label>
        <input type="text" id="${id}_fast_period" value="10" placeholder="10 or 10,20,30" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
    <div id="${id}_fast_bb_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>Fast BB Std Dev(s)</label>
          <input type="text" id="${id}_fast_bb_std" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div id="${id}_fast_kc_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>Fast KC ATR Mult(s)</label>
          <input type="text" id="${id}_fast_kc_mult" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Slow MA Type</label>
        <select id="${id}_slow_ma_type" onchange="toggleMAParams('${id}', 'slow')">
          ${MA_TYPES_NO_VALUE.map(ma => `<option value="${ma}">${ma}</option>`).join('')}
        </select>
      </div>
      <div class="condition-field">
        <label>Slow Period(s)</label>
        <input type="text" id="${id}_slow_period" value="30" placeholder="30 or 30,50,100" />
        <small>Single value or comma-separated list for grid</small>
      </div>
    </div>
    <div id="${id}_slow_bb_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>Slow BB Std Dev(s)</label>
          <input type="text" id="${id}_slow_bb_std" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div id="${id}_slow_kc_params" style="display: none;">
      <div class="condition-field-row">
        <div class="condition-field">
          <label>Slow KC ATR Mult(s)</label>
          <input type="text" id="${id}_slow_kc_mult" value="2.0" placeholder="2.0 or 1.5,2.0,2.5" />
          <small>Single value or comma-separated list for grid</small>
        </div>
      </div>
    </div>
    <div class="condition-field-row">
      <div class="condition-field">
        <label>Direction</label>
        <select id="${id}_direction">
          <option value="bullish">Bullish (Fast crosses above Slow)</option>
          <option value="bearish">Bearish (Fast crosses below Slow)</option>
        </select>
      </div>
    </div>
  `;
}

// Toggle interaction-specific fields
function toggleInteractionFields(conditionId) {
  const interaction = document.getElementById(`${conditionId}_interaction`)?.value;
  const touchesField = document.getElementById(`${conditionId}_touches_field`);
  const directionField = document.getElementById(`${conditionId}_direction_field`);
  
  if (touchesField) {
    // Only show touches field for "touch" and "recross" interactions
    touchesField.style.display = (interaction === 'touch' || interaction === 'recross') ? 'flex' : 'none';
  }
  
  if (directionField) {
    // Only show direction field for "cross" and "recross" interactions
    directionField.style.display = (interaction === 'cross' || interaction === 'recross') ? 'flex' : 'none';
  }
}

// Toggle target-specific parameters (for Price/RSI conditions)
function toggleTargetParams(conditionId) {
  const targetType = document.getElementById(`${conditionId}_target_type`)?.value;
  
  const valueField = document.getElementById(`${conditionId}_value_field`);
  const periodField = document.getElementById(`${conditionId}_period_field`);
  const bbParams = document.getElementById(`${conditionId}_bb_params`);
  const kcParams = document.getElementById(`${conditionId}_kc_params`);
  
  if (targetType === 'Value') {
    // Show value input, hide period and band params
    if (valueField) valueField.style.display = 'flex';
    if (periodField) periodField.style.display = 'none';
    if (bbParams) bbParams.style.display = 'none';
    if (kcParams) kcParams.style.display = 'none';
  } else {
    // Show period, hide value
    if (valueField) valueField.style.display = 'none';
    if (periodField) periodField.style.display = 'flex';
    
    // Show BB/KC params if applicable
    if (bbParams) bbParams.style.display = (targetType && targetType.startsWith('BB_')) ? 'block' : 'none';
    if (kcParams) kcParams.style.display = (targetType && targetType.startsWith('KC_')) ? 'block' : 'none';
  }
}

// Toggle MA-specific parameters (BB/KC) for MA Crossover
function toggleMAParams(conditionId, prefix = '') {
  const maTypeId = prefix ? `${conditionId}_${prefix}_ma_type` : `${conditionId}_ma_type`;
  const maType = document.getElementById(maTypeId)?.value;
  
  const bbParamsId = prefix ? `${conditionId}_${prefix}_bb_params` : `${conditionId}_bb_params`;
  const kcParamsId = prefix ? `${conditionId}_${prefix}_kc_params` : `${conditionId}_kc_params`;
  
  const bbParams = document.getElementById(bbParamsId);
  const kcParams = document.getElementById(kcParamsId);
  
  if (bbParams && kcParams) {
    // Show BB params if BB type selected
    bbParams.style.display = (maType && maType.startsWith('BB_')) ? 'block' : 'none';
    // Show KC params if KC type selected
    kcParams.style.display = (maType && maType.startsWith('KC_')) ? 'block' : 'none';
  }
}

// Remove condition
function removeCondition(conditionId) {
  const card = document.querySelector(`[data-condition-id="${conditionId}"]`);
  if (card) {
    card.remove();
  }
}

// Toggle mirror entry checkbox
// Add condition from saved data (for loading configs)
function addConditionFromData(conditionGroup, conditionData) {
  // Create the condition card first
  createConditionCard(conditionGroup, conditionData.type);
  
  // Get the newly created condition's ID (it's the last one added)
  const listId = conditionGroup === 'entry' ? 'entryConditionsList' : 'exitConditionsList';
  const cards = document.querySelectorAll(`#${listId} .condition-card`);
  const card = cards[cards.length - 1];
  const conditionId = card.dataset.conditionId;
  
  // Populate fields based on condition type
  setTimeout(() => {
    // Restore exit targeting if this is an exit condition
    if (conditionData.target_entries !== undefined) {
      const allCheckbox = document.getElementById(`${conditionId}_target_all`);
      if (conditionData.target_entries === 'all') {
        if (allCheckbox) allCheckbox.checked = true;
      } else {
        // Uncheck "all" and check specific entries
        if (allCheckbox) {
          allCheckbox.checked = false;
          document.getElementById(`${conditionId}_specific_targets`).style.display = 'block';
        }
        const targetArray = Array.isArray(conditionData.target_entries) ? conditionData.target_entries : [conditionData.target_entries];
        targetArray.forEach(entryId => {
          const checkbox = document.querySelector(`.${conditionId}_target_entry[data-entry-id="${entryId}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
    }
    
    switch (conditionData.type) {
      case 'timing':
        if (conditionData.time1) document.getElementById(`${conditionId}_time1`).value = conditionData.time1;
        if (conditionData.time2) document.getElementById(`${conditionId}_time2`).value = conditionData.time2;
        break;
        
      case 'price':
        if (conditionData.position_type) document.getElementById(`${conditionId}_position_type`).value = conditionData.position_type;
        if (conditionData.target_type) {
          document.getElementById(`${conditionId}_target_type`).value = conditionData.target_type;
          toggleTargetParams(conditionId);
        }
        if (conditionData.target_value) document.getElementById(`${conditionId}_target_value`).value = conditionData.target_value;
        if (conditionData.target_period) document.getElementById(`${conditionId}_target_period`).value = conditionData.target_period;
        // Restore BB parameters
        if (conditionData.bb_std !== undefined) {
          const bbStdField = document.getElementById(`${conditionId}_bb_std`);
          const bbStdValueSpan = document.getElementById(`${conditionId}_bb_std_value`);
          if (bbStdField) {
            bbStdField.value = conditionData.bb_std;
            if (bbStdValueSpan) bbStdValueSpan.textContent = conditionData.bb_std;
          }
        }
        // Restore KC parameters
        if (conditionData.kc_mult !== undefined) {
          const kcMultField = document.getElementById(`${conditionId}_kc_mult`);
          const kcMultValueSpan = document.getElementById(`${conditionId}_kc_mult_value`);
          if (kcMultField) {
            kcMultField.value = conditionData.kc_mult;
            if (kcMultValueSpan) kcMultValueSpan.textContent = conditionData.kc_mult;
          }
        }
        if (conditionData.interaction) {
          document.getElementById(`${conditionId}_interaction`).value = conditionData.interaction;
          toggleInteractionFields(conditionId);
        }
        if (conditionData.direction) document.getElementById(`${conditionId}_direction`).value = conditionData.direction;
        if (conditionData.threshold_pct !== undefined) document.getElementById(`${conditionId}_threshold_pct`).value = conditionData.threshold_pct;
        if (conditionData.delay !== undefined) document.getElementById(`${conditionId}_delay`).value = conditionData.delay;
        if (conditionData.touches !== undefined) document.getElementById(`${conditionId}_touches`).value = conditionData.touches;
        break;
        
      case 'rsi':
        if (conditionData.position_type) document.getElementById(`${conditionId}_position_type`).value = conditionData.position_type;
        if (conditionData.rsi_period) document.getElementById(`${conditionId}_rsi_period`).value = conditionData.rsi_period;
        if (conditionData.target_type) {
          document.getElementById(`${conditionId}_target_type`).value = conditionData.target_type;
          toggleTargetParams(conditionId);
        }
        if (conditionData.target_value) document.getElementById(`${conditionId}_target_value`).value = conditionData.target_value;
        if (conditionData.target_period) document.getElementById(`${conditionId}_target_period`).value = conditionData.target_period;
        // Restore BB parameters
        if (conditionData.bb_std !== undefined) {
          const bbStdField = document.getElementById(`${conditionId}_bb_std`);
          const bbStdValueSpan = document.getElementById(`${conditionId}_bb_std_value`);
          if (bbStdField) {
            bbStdField.value = conditionData.bb_std;
            if (bbStdValueSpan) bbStdValueSpan.textContent = conditionData.bb_std;
          }
        }
        // Restore KC parameters
        if (conditionData.kc_mult !== undefined) {
          const kcMultField = document.getElementById(`${conditionId}_kc_mult`);
          const kcMultValueSpan = document.getElementById(`${conditionId}_kc_mult_value`);
          if (kcMultField) {
            kcMultField.value = conditionData.kc_mult;
            if (kcMultValueSpan) kcMultValueSpan.textContent = conditionData.kc_mult;
          }
        }
        if (conditionData.interaction) {
          document.getElementById(`${conditionId}_interaction`).value = conditionData.interaction;
          toggleInteractionFields(conditionId);
        }
        if (conditionData.direction) document.getElementById(`${conditionId}_direction`).value = conditionData.direction;
        if (conditionData.threshold_pct !== undefined) document.getElementById(`${conditionId}_threshold_pct`).value = conditionData.threshold_pct;
        if (conditionData.delay !== undefined) document.getElementById(`${conditionId}_delay`).value = conditionData.delay;
        if (conditionData.touches !== undefined) document.getElementById(`${conditionId}_touches`).value = conditionData.touches;
        break;
        
      case 'ma_crossover':
        if (conditionData.position_type) document.getElementById(`${conditionId}_position_type`).value = conditionData.position_type;
        if (conditionData.fast_ma_type) document.getElementById(`${conditionId}_fast_ma_type`).value = conditionData.fast_ma_type;
        if (conditionData.fast_period) document.getElementById(`${conditionId}_fast_period`).value = conditionData.fast_period;
        // Restore BB parameters for fast MA
        if (conditionData.fast_bb_std !== undefined) {
          const fastBbStdField = document.getElementById(`${conditionId}_fast_bb_std`);
          if (fastBbStdField) fastBbStdField.value = conditionData.fast_bb_std;
        }
        // Restore KC parameters for fast MA
        if (conditionData.fast_kc_mult !== undefined) {
          const fastKcMultField = document.getElementById(`${conditionId}_fast_kc_mult`);
          if (fastKcMultField) fastKcMultField.value = conditionData.fast_kc_mult;
        }
        if (conditionData.slow_ma_type) document.getElementById(`${conditionId}_slow_ma_type`).value = conditionData.slow_ma_type;
        if (conditionData.slow_period) document.getElementById(`${conditionId}_slow_period`).value = conditionData.slow_period;
        // Restore BB parameters for slow MA
        if (conditionData.slow_bb_std !== undefined) {
          const slowBbStdField = document.getElementById(`${conditionId}_slow_bb_std`);
          if (slowBbStdField) slowBbStdField.value = conditionData.slow_bb_std;
        }
        // Restore KC parameters for slow MA
        if (conditionData.slow_kc_mult !== undefined) {
          const slowKcMultField = document.getElementById(`${conditionId}_slow_kc_mult`);
          if (slowKcMultField) slowKcMultField.value = conditionData.slow_kc_mult;
        }
        if (conditionData.direction) document.getElementById(`${conditionId}_direction`).value = conditionData.direction;
        if (conditionData.threshold_pct !== undefined) document.getElementById(`${conditionId}_threshold_pct`).value = conditionData.threshold_pct;
        if (conditionData.delay !== undefined) document.getElementById(`${conditionId}_delay`).value = conditionData.delay;
        break;
    }
  }, 100); // Small delay to ensure DOM is ready
}

// Toggle vice versa settings
function toggleViceVersa() {
  const enabled = document.getElementById('viceVersaEnabled')?.checked;
  const settings = document.getElementById('viceVersaSettings');
  if (settings) {
    settings.style.display = enabled ? 'block' : 'none';
  }
}

// Toggle take profit settings
function toggleTakeProfit() {
  const enabled = document.getElementById('takeProfitEnabled')?.checked;
  const settings = document.getElementById('takeProfitSettings');
  if (settings) {
    settings.style.display = enabled ? 'block' : 'none';
  }
}

// Toggle stop loss settings
function toggleStopLoss() {
  const enabled = document.getElementById('stopLossEnabled')?.checked;
  const settings = document.getElementById('stopLossSettings');
  if (settings) {
    settings.style.display = enabled ? 'block' : 'none';
  }
}

// Toggle take profit type
function toggleTakeProfitType() {
  const type = document.getElementById('takeProfitType')?.value;
  const percentEl = document.getElementById('takeProfitPercent');
  const dollarEl = document.getElementById('takeProfitDollar');
  const conditionEl = document.getElementById('takeProfitCondition');
  
  if (percentEl) percentEl.style.display = type === 'percent' ? 'block' : 'none';
  if (dollarEl) dollarEl.style.display = type === 'dollar' ? 'block' : 'none';
  if (conditionEl) conditionEl.style.display = type === 'condition' ? 'block' : 'none';
}

// Toggle stop loss type
function toggleStopLossType() {
  const type = document.getElementById('stopLossType')?.value;
  const percentEl = document.getElementById('stopLossPercent');
  const dollarEl = document.getElementById('stopLossDollar');
  const conditionEl = document.getElementById('stopLossCondition');
  
  if (percentEl) percentEl.style.display = type === 'percent' ? 'block' : 'none';
  if (dollarEl) dollarEl.style.display = type === 'dollar' ? 'block' : 'none';
  if (conditionEl) conditionEl.style.display = type === 'condition' ? 'block' : 'none';
}

// Validate timeframe selection
function validateTimeframe() {
  const timeframe = document.getElementById('timeframe')?.value;
  const startDate = document.getElementById('startDate')?.value;
  const endDate = document.getElementById('endDate')?.value;
  const endToday = document.getElementById('endDateToday')?.checked;
  const warning = document.getElementById('timeframeWarning');
  
  if (!warning) return;
  
  // Only validate for intraday timeframes
  const intradayFrames = ['1min', '5min', '15min', '1hour', '4hour'];
  if (!intradayFrames.includes(timeframe)) {
    warning.style.display = 'none';
    return;
  }
  
  // Calculate date range
  const start = new Date(startDate);
  const end = endToday ? new Date() : new Date(endDate);
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  
  if (diffDays > 90) {
    warning.style.display = 'block';
    warning.style.color = '#FF1744';
    warning.textContent = `âš ï¸ Warning: ${timeframe} timeframe is limited to 3 months. Current range: ${Math.round(diffDays)} days.`;
  } else {
    warning.style.display = 'block';
    warning.style.color = 'var(--accent-blue)';
    warning.textContent = `âœ“ Date range OK for ${timeframe} (${Math.round(diffDays)} days)`;
  }
}

// Collect conditions from UI
function collectConditions(conditionGroup) {
  const listId = conditionGroup === 'entry' ? 'entryConditionsList' : 'exitConditionsList';
  const cards = document.querySelectorAll(`#${listId} .condition-card`);
  
  const conditions = [];
  cards.forEach(card => {
    const conditionId = card.dataset.conditionId;
    const conditionType = card.dataset.conditionType;
    
    const condition = {
      type: conditionType
    };
    
    // For exit conditions, collect the targeting info
    if (conditionGroup === 'exit') {
      const allCheckbox = document.getElementById(`${conditionId}_target_all`);
      if (allCheckbox?.checked) {
        condition.target_entries = 'all';
      } else {
        // Collect checked specific entries
        const specificCheckboxes = document.querySelectorAll(`.${conditionId}_target_entry:checked`);
        const targetIds = Array.from(specificCheckboxes).map(cb => cb.dataset.entryId);
        condition.target_entries = targetIds.length > 0 ? targetIds : 'all';
      }
    }
    
    // Collect fields based on type
    switch (conditionType) {
      case 'timing':
        condition.time1 = document.getElementById(`${conditionId}_time1`)?.value;
        condition.time2 = document.getElementById(`${conditionId}_time2`)?.value;
        break;
        
      case 'price':
        condition.position_type = document.getElementById(`${conditionId}_position_type`)?.value || 'long';
        condition.target_type = document.getElementById(`${conditionId}_target_type`)?.value;
        if (condition.target_type === 'Value') {
          condition.target_value = document.getElementById(`${conditionId}_target_value`)?.value;
        } else {
          condition.target_period = document.getElementById(`${conditionId}_target_period`)?.value;
          // Add BB/KC parameters if applicable
          if (condition.target_type && condition.target_type.startsWith('BB_')) {
            condition.bb_std = document.getElementById(`${conditionId}_bb_std`)?.value || '2.0';
          }
          if (condition.target_type && condition.target_type.startsWith('KC_')) {
            condition.kc_mult = document.getElementById(`${conditionId}_kc_mult`)?.value || '2.0';
          }
        }
        condition.interaction = document.getElementById(`${conditionId}_interaction`)?.value;
        // Add direction for cross/recross
        if (condition.interaction === 'cross' || condition.interaction === 'recross') {
          condition.direction = document.getElementById(`${conditionId}_direction`)?.value;
        }
        condition.threshold_pct = parseFloat(document.getElementById(`${conditionId}_threshold_pct`)?.value);
        condition.delay_bars = parseInt(document.getElementById(`${conditionId}_delay`)?.value);
        if (condition.interaction === 'touch' || condition.interaction === 'recross') {
          condition.touches = parseInt(document.getElementById(`${conditionId}_touches`)?.value);
        }
        break;
        
      case 'rsi':
        condition.position_type = document.getElementById(`${conditionId}_position_type`)?.value || 'long';
        condition.rsi_period = document.getElementById(`${conditionId}_rsi_period`)?.value;
        condition.target_type = document.getElementById(`${conditionId}_target_type`)?.value;
        if (condition.target_type === 'Value') {
          condition.target_value = document.getElementById(`${conditionId}_target_value`)?.value;
        } else {
          condition.target_period = document.getElementById(`${conditionId}_target_period`)?.value;
          // Add BB/KC parameters if applicable
          if (condition.target_type && condition.target_type.startsWith('BB_')) {
            condition.bb_std = document.getElementById(`${conditionId}_bb_std`)?.value || '2.0';
          }
          if (condition.target_type && condition.target_type.startsWith('KC_')) {
            condition.kc_mult = document.getElementById(`${conditionId}_kc_mult`)?.value || '2.0';
          }
        }
        condition.interaction = document.getElementById(`${conditionId}_interaction`)?.value;
        // Add direction for cross/recross
        if (condition.interaction === 'cross' || condition.interaction === 'recross') {
          condition.direction = document.getElementById(`${conditionId}_direction`)?.value;
        }
        condition.threshold_pct = parseFloat(document.getElementById(`${conditionId}_threshold_pct`)?.value);
        condition.delay_bars = parseInt(document.getElementById(`${conditionId}_delay`)?.value);
        if (condition.interaction === 'touch' || condition.interaction === 'recross') {
          condition.touches = parseInt(document.getElementById(`${conditionId}_touches`)?.value);
        }
        break;
        
      case 'ma_crossover':
        condition.position_type = document.getElementById(`${conditionId}_position_type`)?.value || 'long';
        condition.fast_ma_type = document.getElementById(`${conditionId}_fast_ma_type`)?.value;
        condition.fast_period = document.getElementById(`${conditionId}_fast_period`)?.value;
        // Add BB/KC parameters for fast MA if applicable
        if (condition.fast_ma_type && condition.fast_ma_type.startsWith('BB_')) {
          condition.fast_bb_std = document.getElementById(`${conditionId}_fast_bb_std`)?.value || '2.0';
        }
        if (condition.fast_ma_type && condition.fast_ma_type.startsWith('KC_')) {
          condition.fast_kc_mult = document.getElementById(`${conditionId}_fast_kc_mult`)?.value || '2.0';
        }
        condition.slow_ma_type = document.getElementById(`${conditionId}_slow_ma_type`)?.value;
        condition.slow_period = document.getElementById(`${conditionId}_slow_period`)?.value;
        // Add BB/KC parameters for slow MA if applicable
        if (condition.slow_ma_type && condition.slow_ma_type.startsWith('BB_')) {
          condition.slow_bb_std = document.getElementById(`${conditionId}_slow_bb_std`)?.value || '2.0';
        }
        if (condition.slow_ma_type && condition.slow_ma_type.startsWith('KC_')) {
          condition.slow_kc_mult = document.getElementById(`${conditionId}_slow_kc_mult`)?.value || '2.0';
        }
        condition.direction = document.getElementById(`${conditionId}_direction`)?.value;
        break;
    }
    
    conditions.push(condition);
  });
  
  return conditions;
}

// Expose functions to window
window.addCondition = addCondition;
window.removeCondition = removeCondition;
window.toggleViceVersa = toggleViceVersa;
window.toggleTakeProfit = toggleTakeProfit;
window.toggleStopLoss = toggleStopLoss;
window.toggleTakeProfitType = toggleTakeProfitType;
window.toggleStopLossType = toggleStopLossType;
window.validateTimeframe = validateTimeframe;
window.toggleInteractionFields = toggleInteractionFields;
window.toggleMAParams = toggleMAParams;
window.toggleTargetParams = toggleTargetParams;
window.updateExitTargeting = updateExitTargeting;
window.updateExitTargetAll = updateExitTargetAll;

// Update exit target "All" checkbox
function updateExitTargetAll(exitConditionId) {
  const allCheckbox = document.getElementById(`${exitConditionId}_target_all`);
  const specificTargets = document.getElementById(`${exitConditionId}_specific_targets`);
  const specificCheckboxes = document.querySelectorAll(`.${exitConditionId}_target_entry`);
  
  if (allCheckbox.checked) {
    // Hide specific targets, uncheck all
    specificTargets.style.display = 'none';
    specificCheckboxes.forEach(cb => cb.checked = false);
  } else {
    // Show specific targets
    specificTargets.style.display = 'block';
  }
  
  updateExitTargeting(exitConditionId);
}

// Update exit targeting (for preview refresh)
function updateExitTargeting(exitConditionId) {
  // If specific target is checked, uncheck "All"
  const allCheckbox = document.getElementById(`${exitConditionId}_target_all`);
  const specificCheckboxes = document.querySelectorAll(`.${exitConditionId}_target_entry`);
  const anySpecificChecked = Array.from(specificCheckboxes).some(cb => cb.checked);
  
  if (anySpecificChecked && allCheckbox) {
    allCheckbox.checked = false;
    document.getElementById(`${exitConditionId}_specific_targets`).style.display = 'block';
  }
}


// Export module
const StrategyConditionsModule = {
  CONDITION_TYPES,
  MA_TYPES,
  toggleViceVersa,
  toggleTakeProfit,
  toggleStopLoss,
  updateExitTargeting
};

export default StrategyConditionsModule;

// Expose to window for backward compatibility
window.toggleViceVersa = toggleViceVersa;
window.toggleTakeProfit = toggleTakeProfit;
window.toggleStopLoss = toggleStopLoss;
window.updateExitTargeting = updateExitTargeting;
window.CONDITION_TYPES = CONDITION_TYPES;
window.MA_TYPES = MA_TYPES;
