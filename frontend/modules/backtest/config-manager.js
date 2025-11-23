/**
 * Config Manager Module
 * Handles saving, loading, and managing backtest configurations with folders
 */

// Import Supabase helpers for user settings
import { saveUserColors, getUserSettings } from '../../supabase-client.js';

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
async function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  
  // Load saved colors from Supabase
  await loadUserColorsFromSupabase();
  
  // Show modal
  modal.style.display = 'flex';
}
window.openSettings = openSettings;

// Handle sign out
function handleSignOut() {
  // Clear any stored session data
  localStorage.clear();
  sessionStorage.clear();
  
  // Redirect to auth page
  window.location.href = '/';
}
window.handleSignOut = handleSignOut;

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
  document.documentElement.style.setProperty(cssVarName, picker.value, 'important');
  console.log('[COLOR] Updated', cssVarName, 'to', picker.value);
  
  // Force repaint by toggling a class
  document.body.classList.add('color-updating');
  setTimeout(() => document.body.classList.remove('color-updating'), 0);
  
  // Save to Supabase (fire and forget - don't await to keep UI responsive)
  console.log('[COLOR] About to call saveUserColorsWrapper, exists?', typeof saveUserColorsToSupabase);
  if (saveUserColorsToSupabase) {
    saveUserColorsToSupabase().catch(err => console.error('[COLOR] Save failed:', err));
  } else {
    console.error('[COLOR] saveUserColorsToSupabase not defined!');
  }
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
    
    // Save to Supabase
    saveUserColorsToSupabase();
  } else {
    // Invalid hex, revert to current picker value
    textInput.value = picker.value;
    console.warn('[COLOR] Invalid hex color:', textInput.value);
  }
}
window.updateColorFromHex = updateColorFromHex;

// Reset single color to default
async function resetColor(colorName) {
  const defaultValue = DEFAULT_COLORS[colorName];
  if (!defaultValue) return;
  
  console.log('[CONFIG] Resetting', colorName, 'to default:', defaultValue);
  
  // Update picker and text input
  const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
  const picker = document.getElementById(pickerName);
  const textInput = picker.nextElementSibling;
  
  picker.value = defaultValue;
  textInput.value = defaultValue;
  
  // Update CSS variable (use actual CSS variable names without 'color-' prefix)
  const cssVarName = `--${colorName}`;
  document.documentElement.style.setProperty(cssVarName, defaultValue, 'important');
  console.log('[CONFIG] Reset CSS variable', cssVarName, 'to', defaultValue);
  
  // Force repaint
  document.body.classList.add('color-updating');
  setTimeout(() => document.body.classList.remove('color-updating'), 0);
  
  // Save to Supabase (await the async call)
  await saveUserColorsToSupabase();
  console.log('[CONFIG] ✅ Reset color saved to Supabase');
}
window.resetColor = resetColor;

// Reset all colors to defaults
async function resetAllColors() {
  for (const colorName of Object.keys(DEFAULT_COLORS)) {
    await resetColor(colorName);
  }
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
    saveUserColorsToSupabase();
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
      saveUserColorsToSupabase();
      alert('Color preset imported!');
    } catch (e) {
      alert('Invalid preset format: ' + e.message);
    }
  }).catch(err => {
    alert('Failed to read clipboard: ' + err.message);
  });
}
window.importColorPreset = importColorPreset;

// Save user colors to Supabase
async function saveUserColorsToSupabase() {
  console.log('[CONFIG] 🔵 saveUserColors called');
  
  const colors = {};
  Object.keys(DEFAULT_COLORS).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    if (picker) {
      colors[colorName] = picker.value;
    }
  });
  
  console.log('[CONFIG] 🔵 Collected colors:', Object.keys(colors).length, 'items');
  console.log('[CONFIG] 🔵 Color values:', colors);
  
  try {
    // Use the imported saveUserColors from supabase-client.js
    const result = await saveUserColors(colors);
    console.log('[CONFIG] ✅ Colors saved to Supabase successfully');
    // Don't save to localStorage anymore - Supabase is source of truth
  } catch (err) {
    console.error('[CONFIG] ❌ Failed to save colors to Supabase:', err);
    // Only fallback to localStorage if Supabase fails
    localStorage.setItem('userColors', JSON.stringify(colors));
    console.warn('[CONFIG] Saved to localStorage as fallback');
  }
}
// Export as different name to avoid confusion
window.saveUserColorsWrapper = saveUserColorsToSupabase;

// Load user colors from Supabase (with localStorage fallback)
async function loadUserColorsFromSupabase() {
  let colors = DEFAULT_COLORS;
  
  try {
    // Check if user is authenticated first
    const settings = await getUserSettings();
    
    if (settings && settings.colors && Object.keys(settings.colors).length > 0) {
      colors = { ...DEFAULT_COLORS, ...settings.colors };
      console.log('[CONFIG] ✅ Colors loaded from Supabase for user:', settings.user_id);
    } else {
      console.log('[CONFIG] ⚠️ No colors in Supabase, using defaults');
    }
  } catch (err) {
    // If not authenticated or other error, use defaults (don't fallback to localStorage for cross-account issue)
    if (err.message === 'Not authenticated') {
      console.log('[CONFIG] User not authenticated yet, using defaults');
    } else {
      console.error('[CONFIG] ❌ Failed to load colors from Supabase:', err);
    }
  }
  
  // Apply to pickers, text inputs, and CSS variables
  Object.keys(colors).forEach(colorName => {
    const pickerName = `color${colorName.charAt(0).toUpperCase() + colorName.slice(1).replace(/-([a-z])/g, (m, p1) => p1.toUpperCase())}`;
    const picker = document.getElementById(pickerName);
    
    if (picker) {
      const textInput = picker.nextElementSibling;
      const value = colors[colorName];
      
      picker.value = value;
      textInput.value = value;
      
      // Apply to CSS (use actual CSS variable names without 'color-' prefix)
      const cssVarName = `--${colorName}`;
      document.documentElement.style.setProperty(cssVarName, value, 'important');
      // Removed excessive logging: console.log('[COLOR] Loaded', cssVarName, '=', value);
    }
  });
}
window.loadUserColors = loadUserColorsFromSupabase;

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
const MAIN_TABS = ['home', 'watchlists', 'charting', 'financials', 'rsi', 'backtesting', 'results'];

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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[SETTINGS] Initializing...');
  
  try {
    await loadUserColorsFromSupabase();
  } catch (err) {
    console.error('[SETTINGS] Critical error loading colors:', err);
  }
  
  // Global keyboard shortcut handler (use capture phase to run before other handlers)
  document.addEventListener('keydown', (e) => {
    // Shift+PageUp/PageDown: Always handle these first
    if (e.shiftKey && !e.ctrlKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
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
    
    // Shift+, opens settings
    if (e.shiftKey && !e.ctrlKey && e.key === '<') {  // Shift+, produces '<'
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
    
    // Shift+1 through Shift+9: Direct tab access
    if (e.shiftKey && !e.ctrlKey && e.key >= '!' && e.key <= '(') {  // Shift+1-9 produces !, @, #, etc.
      e.preventDefault();
      // Map shifted numbers to indices: ! = 1, @ = 2, # = 3, $ = 4, % = 5, ^ = 6, & = 7, * = 8, ( = 9
      const keyMap = { '!': 0, '@': 1, '#': 2, '$': 3, '%': 4, '^': 5, '&': 6, '*': 7, '(': 8 };
      const index = keyMap[e.key];
      console.log('[SHORTCUT] Shift+' + (index + 1) + ', switching to:', MAIN_TABS[index]);
      if (index !== undefined && index < MAIN_TABS.length) {
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
