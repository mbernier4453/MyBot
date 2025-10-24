/**
 * Config Manager Module
 * Handles saving, loading, and managing backtest configurations with folders
 */
/**
 * Config Manager Module
 * Handles saving, loading, and managing backtest configurations with folders
 */

// Note: backtestConfigs and configFolders are referenced from window (set by configuration module)

// Save Config Modal
function openSaveConfigModal() {
  const modal = document.getElementById('saveConfigModal');
  const folderSelect = document.getElementById('configFolderSelect');
  
  // Populate folder dropdown
  folderSelect.innerHTML = '<option value="">Uncategorized</option>';
  configFolders.forEach(folder => {
    if (folder.id !== 0) { // Skip Uncategorized as it's already added
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.name;
      folderSelect.appendChild(option);
    }
  });
  
  modal.style.display = 'flex';
  document.getElementById('configNameInput').focus();
}

function closeSaveConfigModal() {
  document.getElementById('saveConfigModal').style.display = 'none';
  document.getElementById('configNameInput').value = '';
}
window.closeSaveConfigModal = closeSaveConfigModal;

// Save config
const saveConfigBtn = document.getElementById('saveConfigBtn');
if (saveConfigBtn) {
  saveConfigBtn.addEventListener('click', openSaveConfigModal);
}

const confirmSaveConfigBtn = document.getElementById('confirmSaveConfigBtn');
if (confirmSaveConfigBtn) {
  confirmSaveConfigBtn.addEventListener('click', () => {
    let name = document.getElementById('configNameInput').value.trim();
    
    // Auto-generate name if empty
    if (!name) {
      const timestamp = new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      name = `Config ${timestamp}`;
    }
    
    const folderId = parseInt(document.getElementById('configFolderSelect').value || '0');
    const config = collectBacktestConfig();
    
    const newConfig = {
      id: Date.now(),
      name: name,
      folder_id: folderId,
      config: config,
      saved_at: new Date().toISOString()
    };
    
    backtestConfigs.push(newConfig);
    localStorage.setItem('backtestConfigs', JSON.stringify(backtestConfigs));
    
    console.log('[CONFIG] Configuration saved:', name);
    closeSaveConfigModal();
    alert('Configuration saved successfully!');
  });
}

// Track selected config for loading
let selectedConfigId = null;

// Load Config Modal
function openLoadConfigModal() {
  const modal = document.getElementById('loadConfigModal');
  const container = document.getElementById('configListContainer');
  
  // Reset selection
  selectedConfigId = null;
  updateLoadConfigOkButton();
  
  // Build config list with folders
  container.innerHTML = '';
  
  // Group configs by folder
  const configsByFolder = {};
  configFolders.forEach(folder => {
    configsByFolder[folder.id] = {
      folder: folder,
      configs: backtestConfigs.filter(c => c.folder_id === folder.id)
    };
  });
  
  // Render folders and configs
  Object.values(configsByFolder).forEach(({folder, configs}) => {
    if (configs.length > 0) {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'config-folder-group';
      folderDiv.innerHTML = `
        <div class="config-folder-header">
          <span class="folder-icon">ðŸ“</span>
          <span class="folder-name">${folder.name}</span>
          <span class="folder-count">${configs.length}</span>
        </div>
        <div class="config-folder-items"></div>
      `;
      
      const itemsContainer = folderDiv.querySelector('.config-folder-items');
      configs.forEach(cfg => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.dataset.configId = cfg.id;
        const savedDate = new Date(cfg.saved_at).toLocaleDateString();
        item.innerHTML = `
          <div class="config-item-info">
            <div class="config-item-name">${cfg.name}</div>
            <div class="config-item-date">Saved: ${savedDate}</div>
          </div>
          <div class="config-item-actions">
            <button class="btn-sm danger" onclick="deleteConfigById(${cfg.id})">Delete</button>
          </div>
        `;
        
        // Click to select (not load immediately)
        item.addEventListener('click', (e) => {
          // Don't select if clicking delete button
          if (e.target.tagName === 'BUTTON') return;
          
          selectConfigForLoad(cfg.id);
        });
        
        itemsContainer.appendChild(item);
      });
      
      container.appendChild(folderDiv);
    }
  });
  
  if (backtestConfigs.length === 0) {
    container.innerHTML = '<div class="empty-state-small">No saved configurations yet</div>';
  }
  
  modal.style.display = 'flex';
}

function selectConfigForLoad(id) {
  selectedConfigId = id;
  
  // Update visual selection
  document.querySelectorAll('.config-item').forEach(item => {
    if (parseInt(item.dataset.configId) === id) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  updateLoadConfigOkButton();
}

function updateLoadConfigOkButton() {
  const okBtn = document.getElementById('loadConfigOkBtn');
  if (okBtn) {
    okBtn.disabled = selectedConfigId === null;
  }
}

function closeLoadConfigModal() {
  document.getElementById('loadConfigModal').style.display = 'none';
  selectedConfigId = null;
}
window.closeLoadConfigModal = closeLoadConfigModal;

function confirmLoadConfig() {
  if (selectedConfigId === null) return;
  
  const config = backtestConfigs.find(c => c.id === selectedConfigId);
  if (config) {
    populateBacktestConfig(config.config);
    closeLoadConfigModal();
    console.log('[CONFIG] Configuration loaded:', config.name);
  }
}
window.confirmLoadConfig = confirmLoadConfig;

// Load config
const loadConfigBtn = document.getElementById('loadConfigBtn');
if (loadConfigBtn) {
  loadConfigBtn.addEventListener('click', openLoadConfigModal);
}

window.loadConfigById = function(id) {
  const config = backtestConfigs.find(c => c.id === id);
  if (config) {
    populateBacktestConfig(config.config);
    closeLoadConfigModal();
    console.log('[CONFIG] Configuration loaded:', config.name);
  }
};

window.deleteConfigById = function(id) {
  if (confirm('Delete this configuration?')) {
    backtestConfigs = backtestConfigs.filter(c => c.id !== id);
    localStorage.setItem('backtestConfigs', JSON.stringify(backtestConfigs));
    openLoadConfigModal(); // Refresh list
  }
};

// Create Config Folder Modal
function openCreateConfigFolderModal() {
  document.getElementById('createConfigFolderModal').style.display = 'flex';
  document.getElementById('configFolderNameInput').focus();
}
window.openCreateConfigFolderModal = openCreateConfigFolderModal;

function closeCreateConfigFolderModal() {
  document.getElementById('createConfigFolderModal').style.display = 'none';
  document.getElementById('configFolderNameInput').value = '';
}
window.closeCreateConfigFolderModal = closeCreateConfigFolderModal;

const confirmCreateConfigFolderBtn = document.getElementById('confirmCreateConfigFolderBtn');
if (confirmCreateConfigFolderBtn) {
  confirmCreateConfigFolderBtn.addEventListener('click', () => {
    const name = document.getElementById('configFolderNameInput').value.trim();
    if (!name) {
      alert('Please enter a folder name');
      return;
    }
    
    const newFolder = {
      id: Date.now(),
      name: name
    };
    
    configFolders.push(newFolder);
    localStorage.setItem('configFolders', JSON.stringify(configFolders));
    
    console.log('[CONFIG] Folder created:', name);
    closeCreateConfigFolderModal();
    
    // Refresh the folder dropdown in save modal if it's open
    const saveModal = document.getElementById('saveConfigModal');
    if (saveModal && saveModal.style.display === 'flex') {
      const folderSelect = document.getElementById('configFolderSelect');
      folderSelect.innerHTML = '<option value="">Uncategorized</option>';
      configFolders.forEach(folder => {
        if (folder.id !== 0) {
          const option = document.createElement('option');
          option.value = folder.id;
          option.textContent = folder.name;
          folderSelect.appendChild(option);
        }
      });
      // Select the newly created folder
      folderSelect.value = newFolder.id;
    }
    
    alert('Folder created successfully!');
  });
}

// Make ALL functions globally accessible for onclick handlers
// ==================== SETTINGS SYSTEM ====================

// Default theme colors (matching actual CSS variables in styles.css)
const DEFAULT_COLORS = {
  'bg-primary': '#0a0a0a',
  'bg-secondary': '#111111',
  'bg-tertiary': '#1a1a1a',
  'bg-hover': '#1f2f1f',
  'border-color': '#1a3d1a',
  'text-primary': '#e0e0e0',
  'text-secondary': '#a0a0a0',
  'accent-blue': '#00aa55',
  'accent-green': '#006633',
  'accent-yellow': '#228B22',
  'positive': '#00cc55',
  'negative': '#ff4444'
};

// Open settings modal
function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  
  // Load saved colors from localStorage
  loadUserColors();
  
  // Show modal
  modal.style.display = 'flex';
}
window.openSettings = openSettings;

// Close settings modal
function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
window.closeSettings = closeSettings;

// Switch settings tabs
function switchSettingsTab(tabName) {
  // Update tab buttons
  const tabs = document.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  const contents = document.querySelectorAll('.settings-tab-content');
  contents.forEach(content => {
    if (content.id === `${tabName}Tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}
window.switchSettingsTab = switchSettingsTab;

// Update color (called when color picker changes)
function updateColor(colorName) {
  const picker = document.getElementById(`color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`);
  const textInput = picker.nextElementSibling;
  
  // Update text input
  textInput.value = picker.value;
  
  // Update CSS variable (use actual CSS variable names without 'color-' prefix)
  const cssVarName = `--${colorName}`;
  document.documentElement.style.setProperty(cssVarName, picker.value);
  console.log('[COLOR] Updated', cssVarName, 'to', picker.value);
  
  // Save to localStorage
  saveUserColors();
}
window.updateColor = updateColor;

// Update color from hex text input
function updateColorFromHex(colorName) {
  const picker = document.getElementById(`color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`);
  const textInput = picker.nextElementSibling;
  
  let hexValue = textInput.value.trim();
  
  // Add # if missing
  if (!hexValue.startsWith('#')) {
    hexValue = '#' + hexValue;
  }
  
  // Validate hex color (3 or 6 digits)
  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(hexValue)) {
    // Normalize 3-digit hex to 6-digit
    if (hexValue.length === 4) {
      hexValue = '#' + hexValue[1] + hexValue[1] + hexValue[2] + hexValue[2] + hexValue[3] + hexValue[3];
    }
    
    // Update picker
    picker.value = hexValue;
    textInput.value = hexValue;
    
    // Update CSS variable
    const cssVarName = `--${colorName}`;
    document.documentElement.style.setProperty(cssVarName, hexValue);
    console.log('[COLOR] Updated from hex', cssVarName, 'to', hexValue);
    
    // Save to localStorage
    saveUserColors();
  } else {
    // Invalid hex, revert to current picker value
    textInput.value = picker.value;
    console.warn('[COLOR] Invalid hex color:', textInput.value);
  }
}
window.updateColorFromHex = updateColorFromHex;

// Reset single color to default
function resetColor(colorName) {
  const defaultValue = DEFAULT_COLORS[colorName];
  if (!defaultValue) return;
  
  // Update picker and text input
  const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
  const picker = document.getElementById(pickerName);
  const textInput = picker.nextElementSibling;
  
  picker.value = defaultValue;
  textInput.value = defaultValue;
  
  // Update CSS variable (use actual CSS variable names without 'color-' prefix)
  const cssVarName = `--${colorName}`;
  document.documentElement.style.setProperty(cssVarName, defaultValue);
  console.log('[COLOR] Reset', cssVarName, 'to', defaultValue);
  
  // Save to localStorage
  saveUserColors();
}
window.resetColor = resetColor;

// Reset all colors to defaults
function resetAllColors() {
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    resetColor(colorName);
  });
}
window.resetAllColors = resetAllColors;

// Save color preset
function saveColorPreset() {
  const colors = {};
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    if (picker) {
      colors[colorName] = picker.value;
    }
  });
  localStorage.setItem('colorPreset', JSON.stringify(colors));
  alert('Color preset saved!');
}
window.saveColorPreset = saveColorPreset;

// Load color preset
function loadColorPreset() {
  const saved = localStorage.getItem('colorPreset');
  if (!saved) {
    alert('No saved preset found!');
    return;
  }
  
  try {
    const colors = JSON.parse(saved);
    Object.keys(colors).forEach(colorName => {
      const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
      const picker = document.getElementById(pickerName);
      if (picker) {
        const textInput = picker.nextElementSibling;
        const value = colors[colorName];
        
        picker.value = value;
        textInput.value = value;
        
        const cssVarName = `--${colorName}`;
        document.documentElement.style.setProperty(cssVarName, value);
      }
    });
    saveUserColors();
    alert('Color preset loaded!');
  } catch (e) {
    alert('Error loading preset: ' + e.message);
  }
}
window.loadColorPreset = loadColorPreset;

// Export color preset to clipboard
function exportColorPreset() {
  const colors = {};
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    if (picker) {
      colors[colorName] = picker.value;
    }
  });
  const json = JSON.stringify(colors, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    alert('Color preset copied to clipboard!');
  }).catch(err => {
    alert('Failed to copy: ' + err.message);
  });
}
window.exportColorPreset = exportColorPreset;

// Import color preset from clipboard
function importColorPreset() {
  navigator.clipboard.readText().then(text => {
    try {
      const colors = JSON.parse(text);
      Object.keys(colors).forEach(colorName => {
        const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
        const picker = document.getElementById(pickerName);
        if (picker) {
          const textInput = picker.nextElementSibling;
          const value = colors[colorName];
          
          picker.value = value;
          textInput.value = value;
          
          const cssVarName = `--${colorName}`;
          document.documentElement.style.setProperty(cssVarName, value);
        }
      });
      saveUserColors();
      alert('Color preset imported!');
    } catch (e) {
      alert('Invalid preset format: ' + e.message);
    }
  }).catch(err => {
    alert('Failed to read clipboard: ' + err.message);
  });
}
window.importColorPreset = importColorPreset;

// Save user colors to localStorage
function saveUserColors() {
  const colors = {};
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    if (picker) {
      colors[colorName] = picker.value;
    }
  });
  localStorage.setItem('userColors', JSON.stringify(colors));
}

// Load user colors from localStorage
function loadUserColors() {
  const saved = localStorage.getItem('userColors');
  let colors = DEFAULT_COLORS;
  
  if (saved) {
    try {
      colors = { ...DEFAULT_COLORS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse saved colors:', e);
    }
  }
  
  // Apply to pickers, text inputs, and CSS variables
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    
    if (picker) {
      const textInput = picker.nextElementSibling;
      const value = colors[colorName];
      
      picker.value = value;
      textInput.value = value;
      
      // Apply to CSS (use actual CSS variable names without 'color-' prefix)
      const cssVarName = `--${colorName}`;
      document.documentElement.style.setProperty(cssVarName, value);
      // Removed excessive logging: console.log('[COLOR] Loaded', cssVarName, '=', value);
    }
  });
}

// ==================== CHART COLOR HELPERS ====================

// Get theme colors from CSS variables for use in charts
function getThemeColor(colorName) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${colorName}`).trim();
}

// Get positive color (for gains/green candles)
function getPositiveColor() {
  return getThemeColor('positive') || '#00cc55';
}

// Get negative color (for losses/red candles)
function getNegativeColor() {
  return getThemeColor('negative') || '#ff4444';
}

// Lighten a color by a factor (0-1) by moving towards white
function lightenColor(color, factor) {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten by moving towards white (255, 255, 255)
  r = Math.min(255, Math.round(r + (255 - r) * factor));
  g = Math.min(255, Math.round(g + (255 - g) * factor));
  b = Math.min(255, Math.round(b + (255 - b) * factor));
  
  // Convert back to hex
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// ==================== KEYBOARD SHORTCUTS ====================

// Main tabs for navigation
const MAIN_TABS = ['home', 'screener', 'watchlists', 'charting', 'financials', 'ratios', 'rsi', 'backtesting', 'results'];

// Function to switch main navigation tabs
function switchMainTab(tabName) {
  const mainTabs = document.querySelectorAll('.main-tab');
  const mainPages = document.querySelectorAll('.main-page');
  
  mainTabs.forEach(t => t.classList.remove('active'));
  mainPages.forEach(p => p.classList.remove('active'));
  
  const targetTab = document.querySelector(`.main-tab[data-main-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  const targetPage = document.getElementById(`${tabName}Page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
}
window.switchMainTab = switchMainTab;

// ==================== INITIALIZATION ====================

// Load colors and setup keyboard shortcuts on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[SETTINGS] Initializing...');
  loadUserColors();
  
  // Global keyboard shortcut handler (use capture phase to run before other handlers)
  document.addEventListener('keydown', (e) => {
    // Ctrl+PageUp/PageDown: Always handle these first
    if (e.ctrlKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
      // Don't prevent default if user is typing in an input
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'SELECT') {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      const currentIndex = MAIN_TABS.findIndex(tab => 
        document.getElementById(`${tab}Page`)?.classList.contains('active')
      );
      
      console.log(`[SHORTCUT] ${e.key}, current index:`, currentIndex);
      
      if (e.key === 'PageUp' && currentIndex > 0) {
        switchMainTab(MAIN_TABS[currentIndex - 1]);
      } else if (e.key === 'PageDown' && currentIndex < MAIN_TABS.length - 1) {
        switchMainTab(MAIN_TABS[currentIndex + 1]);
      }
      return;
    }
    
    // Ctrl+, opens settings
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      console.log('[SHORTCUT] Opening settings');
      openSettings();
      return;
    }
    
    // Esc closes any open modal
    if (e.key === 'Escape') {
      // Close settings modal
      const settingsModal = document.getElementById('settingsModal');
      if (settingsModal && settingsModal.style.display === 'flex') {
        console.log('[SHORTCUT] Closing settings');
        closeSettings();
        return;
      }
      
      // Close tearsheet modal
      const tearsheetModal = document.getElementById('tearsheetModal');
      if (tearsheetModal && tearsheetModal.style.display === 'flex') {
        console.log('[SHORTCUT] Closing tearsheet');
        tearsheetModal.style.display = 'none';
        return;
      }
      
      // Close save config modal
      const saveConfigModal = document.getElementById('saveConfigModal');
      if (saveConfigModal && saveConfigModal.style.display === 'flex') {
        console.log('[SHORTCUT] Closing save config');
        saveConfigModal.style.display = 'none';
        return;
      }
      
      // Close load config modal
      const loadConfigModal = document.getElementById('loadConfigModal');
      if (loadConfigModal && loadConfigModal.style.display === 'flex') {
        console.log('[SHORTCUT] Closing load config');
        loadConfigModal.style.display = 'none';
        return;
      }
      
      return;
    }
    
    // Don't handle remaining shortcuts when typing in inputs
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT') {
      return;
    }
    
    // Ctrl+1 through Ctrl+9: Direct tab access
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      console.log('[SHORTCUT] Ctrl+' + e.key + ', switching to:', MAIN_TABS[index]);
      if (index < MAIN_TABS.length) {
        switchMainTab(MAIN_TABS[index]);
      }
      return;
    }
  }, { capture: true });  // Use capture phase to intercept before other handlers
  
  console.log('[SETTINGS] Keyboard shortcuts registered');
});


// Export module
const ConfigManagerModule = {
  openSaveConfigModal,
  closeSaveConfigModal,
  initializeConfigManager
};

export default ConfigManagerModule;

// Expose to window for backward compatibility
window.openSaveConfigModal = openSaveConfigModal;
window.closeSaveConfigModal = closeSaveConfigModal;
window.getPositiveColor = getPositiveColor;
window.getNegativeColor = getNegativeColor;
window.lightenColor = lightenColor;

// Initialize function
export function initializeConfigManager() {
  console.log('[CONFIG MANAGER] Module initialized');
}
