// State
let currentDb = null;
let currentRun = null;
let allRuns = [];
let selectedRuns = new Set();
let currentStrategies = [];
let currentTrades = [];
let buyHoldMetrics = {};
let currentSortField = 'total_return';
let currentSortDesc = true;

// DOM Elements
const selectDbBtn = document.getElementById('selectDbBtn');
const dbPathEl = document.getElementById('dbPath');
const runsList = document.getElementById('runsList');
const statusText = document.getElementById('statusText');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Filters
const runSearch = document.getElementById('runSearch');
const modeFilter = document.getElementById('modeFilter');
const tickerFilter = document.getElementById('tickerFilter');
const tradeSearch = document.getElementById('tradeSearch');
const sideFilter = document.getElementById('sideFilter');
const compareBtn = document.getElementById('compareBtn');

// Initialize
selectDbBtn.addEventListener('click', selectDatabase);
runSearch?.addEventListener('input', filterRuns);
modeFilter?.addEventListener('change', filterRuns);
tickerFilter?.addEventListener('change', filterStrategies);
tradeSearch?.addEventListener('input', filterTrades);
sideFilter?.addEventListener('change', filterTrades);
compareBtn?.addEventListener('click', compareRuns);

// Function to switch to a specific tab
function switchToTab(tabName) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  const targetTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  const targetContent = document.getElementById(`${tabName}Tab`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

// CRITICAL: Expose switchToTab to window IMMEDIATELY
window.switchToTab = switchToTab;
console.log('[INIT] Exposed switchToTab:', typeof window.switchToTab);

// Main navigation tab switching
const mainTabs = document.querySelectorAll('.main-tab');
const mainPages = document.querySelectorAll('.main-page');

mainTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetPage = tab.dataset.mainTab;
    
    // Update active states
    mainTabs.forEach(t => t.classList.remove('active'));
    mainPages.forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    const targetPageEl = document.getElementById(`${targetPage}Page`);
    if (targetPageEl) {
      targetPageEl.classList.add('active');
    }
  });
});

// Results sub-tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    console.log('Tab clicked:', targetTab, 'Current run:', currentRun);
    
    switchToTab(targetTab);
    
    // Load data for specific tabs
    if (currentRun) {
      if (targetTab === 'strategies') {
        console.log('Loading strategies for tab switch');
        loadStrategies(currentRun.run_id);
      } else if (targetTab === 'portfolio') {
        loadPortfolio(currentRun.run_id);
      } else if (targetTab === 'trades') {
        // For single mode: trades are loaded when strategy is clicked
        // For portfolio mode: load all trades for the portfolio
        if (currentRun.mode === 'portfolio') {
          console.log('Loading all portfolio trades');
          loadTrades(currentRun.run_id);
        } else {
          console.log('Trades tab clicked - trades already loaded from strategy selection');
          // Trades are already loaded from clicking a strategy
          // Just display current trades or show empty state
          if (currentTrades && currentTrades.length > 0) {
            console.log('Displaying', currentTrades.length, 'cached trades');
          } else {
            console.log('No trades loaded yet - select a strategy first');
          }
        }
      }
    } else {
      console.warn('No current run selected');
    }
  });
});

// Database Selection
async function selectDatabase() {
  setStatus('Selecting database...');
  const result = await window.electronAPI.selectDb();
  
  if (result.success) {
    currentDb = result.path;
    dbPathEl.textContent = result.path;
    setStatus('Database connected');
    loadRuns();
    loadFavorites(); // Load favorites when database is connected
    loadWatchlistsForBacktest(); // Load watchlists for backtest config
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

// Load Runs
async function loadRuns() {
  setStatus('Loading runs...');
  const result = await window.electronAPI.getRuns();
  
  if (result.success) {
    allRuns = result.data;
    displayRuns(allRuns);
    setStatus(`Loaded ${allRuns.length} runs`);
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayRuns(runs) {
  if (!runs || runs.length === 0) {
    runsList.innerHTML = '<div class="empty-state"><p>No runs found</p></div>';
    return;
  }
  
  runsList.innerHTML = runs.map(run => {
    const startDate = new Date(run.started_at * 1000).toLocaleString();
    
    // Calculate duration properly
    let duration = 'Running...';
    if (run.completed_at && run.started_at) {
      const durationSeconds = run.completed_at - run.started_at;
      if (durationSeconds >= 60) {
        duration = (durationSeconds / 60).toFixed(1) + ' min';
      } else if (durationSeconds > 0) {
        duration = durationSeconds.toFixed(1) + ' sec';
      } else {
        duration = '< 1 sec';
      }
    }
    
    return `
      <div class="run-item" data-run-id="${run.run_id}">
        <div class="run-item-header">
          <span class="run-id">${run.run_id}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="run-mode ${run.mode}">${run.mode || 'single'}</span>
            <button class="btn-delete-run" onclick="deleteRun('${run.run_id}', event)" title="Delete run">✕</button>
          </div>
        </div>
        <div class="run-info">${startDate}</div>
        <div class="run-info">${duration} • ${run.result_count || 0} results</div>
        ${run.notes ? `<div class="run-notes">${run.notes}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click handlers
  document.querySelectorAll('.run-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const runId = item.dataset.runId;
      
      if (e.ctrlKey || e.metaKey) {
        // Multi-select for comparison
        if (selectedRuns.has(runId)) {
          selectedRuns.delete(runId);
          item.classList.remove('selected');
        } else {
          selectedRuns.add(runId);
          item.classList.add('selected');
        }
        compareBtn.disabled = selectedRuns.size < 2;
      } else {
        // Single select
        document.querySelectorAll('.run-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedRuns.clear();
        selectedRuns.add(runId);
        compareBtn.disabled = true;
        
        const run = allRuns.find(r => r.run_id === runId);
        if (run) {
          currentRun = run;
          
          console.log('Selected run:', run.run_id, 'Mode:', run.mode);
          
          // Reset Trades tab button
          const tradesBtn = document.querySelector('[data-tab="trades"]');
          if (tradesBtn) {
            tradesBtn.innerHTML = 'Trades';
            tradesBtn.style.color = '';
          }
          
          // Switch to overview tab FIRST
          switchToTab('overview');
          
          // Then update tab visibility based on run mode
          updateTabVisibility();
          
          // Load all run data
          loadRunDetails(run);
          
          // Load data based on mode
          if (currentRun.mode === 'portfolio') {
            // For portfolio mode: load portfolio and trades
            console.log('Loading portfolio data...');
            loadPortfolio(runId);
            loadTrades(runId);
          } else {
            // For single mode: load strategies, don't load trades initially
            console.log('Loading strategies data...');
            loadStrategies(runId);
            document.getElementById('tradesContent').innerHTML = `
              <div class="empty-state">
                <p>Select a strategy to view its trades</p>
              </div>
            `;
          }
        }
      }
    });
  });
}

// Filter Runs
function filterRuns() {
  const searchTerm = runSearch.value.toLowerCase();
  const mode = modeFilter.value;
  
  const filtered = allRuns.filter(run => {
    const matchesSearch = run.run_id.toLowerCase().includes(searchTerm) ||
                         (run.notes && run.notes.toLowerCase().includes(searchTerm));
    const matchesMode = !mode || run.mode === mode;
    return matchesSearch && matchesMode;
  });
  
  displayRuns(filtered);
}

// Load and Display Favorites with Folders
async function loadFavorites() {
  console.log('[DEBUG] loadFavorites() START');
  try {
    console.log('[DEBUG] loadFavorites() inside try block');
    console.log('[DEBUG] window.electronAPI exists?', !!window.electronAPI);
    console.log('[DEBUG] window.electronAPI.getFavorites exists?', !!window.electronAPI?.getFavorites);
    console.log('[DEBUG] window.electronAPI.getFolders exists?', !!window.electronAPI?.getFolders);
    
    const [favoritesResult, foldersResult] = await Promise.all([
      window.electronAPI.getFavorites(),
      window.electronAPI.getFolders()
    ]);
    
    console.log('[DEBUG] loadFavorites results:', { 
      favoritesSuccess: favoritesResult.success, 
      favoritesCount: favoritesResult.data?.length,
      foldersSuccess: foldersResult.success, 
      foldersCount: foldersResult.data?.length,
      foldersData: foldersResult.data
    });
    
    if (favoritesResult.success && foldersResult.success) {
      console.log('[DEBUG] Calling displayFavorites...');
      displayFavorites(favoritesResult.data, foldersResult.data);
    } else {
      console.error('[DEBUG] Failed to load:', { favoritesResult, foldersResult });
    }
  } catch (error) {
    console.error('[DEBUG] Error loading favorites:', error);
    console.error('[DEBUG] Error stack:', error.stack);
  }
  console.log('[DEBUG] loadFavorites() END');
}

function displayFavorites(favorites, folders) {
  const favoritesList = document.getElementById('favoritesList');
  
  console.log('displayFavorites called with:', { 
    favoritesCount: favorites?.length || 0, 
    foldersCount: folders?.length || 0,
    folders: folders 
  });
  
  // Group favorites by folder
  const uncategorized = (favorites || []).filter(f => !f.folder_id);
  const byFolder = {};
  (favorites || []).filter(f => f.folder_id).forEach(fav => {
    if (!byFolder[fav.folder_id]) byFolder[fav.folder_id] = [];
    byFolder[fav.folder_id].push(fav);
  });
  
  let html = '';
  
  // Display folders (even if empty)
  if (folders && folders.length > 0) {
    folders.forEach(folder => {
      const folderFavs = byFolder[folder.id] || [];
      html += `
        <div class="folder-group">
          <div class="folder-header" onclick="toggleFolder(${folder.id})">
            <span class="folder-icon" style="color: ${folder.color || '#888'};">📁</span>
            <span class="folder-name">${folder.name}</span>
            <span class="folder-count">(${folderFavs.length})</span>
            <button class="btn-delete-folder" onclick="event.stopPropagation(); deleteFolderPrompt(${folder.id}, '${folder.name}')" title="Delete folder">
              ✕
            </button>
          </div>
          <div class="folder-content" id="folder-${folder.id}" style="display: none;">
            ${folderFavs.length > 0 
              ? folderFavs.map(fav => renderFavoriteItem(fav)).join('') 
              : '<div style="padding: 8px; color: #666; font-size: 11px; text-align: center;">Empty folder</div>'}
          </div>
        </div>
      `;
    });
  }
  
  // Display uncategorized favorites
  if (uncategorized.length > 0) {
    html += `
      <div class="folder-group">
        <div class="folder-header" onclick="toggleFolder('uncategorized')">
          <span class="folder-icon">📋</span>
          <span class="folder-name">Uncategorized</span>
          <span class="folder-count">(${uncategorized.length})</span>
        </div>
        <div class="folder-content" id="folder-uncategorized" style="display: none;">
          ${uncategorized.map(fav => renderFavoriteItem(fav)).join('')}
        </div>
      </div>
    `;
  }
  
  // Show message if no folders and no favorites
  if ((!folders || folders.length === 0) && (!favorites || favorites.length === 0)) {
    html += `
      <div class="empty-state-small" style="padding: 16px;">
        <p style="font-size: 12px; color: #666;">No saved strategies yet</p>
      </div>
    `;
  }
  
  favoritesList.innerHTML = html;
}

function renderFavoriteItem(fav) {
  const typeBadge = fav.type === 'strategy' ? '📊' : '📁';
  const typeLabel = fav.type === 'strategy' ? 'Single' : 'Portfolio';
  const typeClass = fav.type === 'strategy' ? 'strategy' : 'portfolio';
  
  return `
    <div class="favorite-item" onclick="loadFavorite('${fav.id}', '${fav.type}', '${fav.run_id}', '${fav.ticker || ''}')">
      <div class="favorite-info">
        <span class="favorite-type-badge ${typeClass}">${typeBadge} ${typeLabel}</span>
        <span class="favorite-name">${fav.name}</span>
      </div>
      <div class="favorite-actions">
        <button class="btn-move-folder" onclick="event.stopPropagation(); showMoveToFolderDialog(${fav.id})" title="Move to folder">
          →
        </button>
        <button class="unfavorite-btn" onclick="event.stopPropagation(); removeFavorite(${fav.id})" title="Remove">
          ★
        </button>
      </div>
    </div>
  `;
}

function toggleFolder(folderId) {
  const content = document.getElementById(`folder-${folderId}`);
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

function promptCreateFolder() {
  const modal = document.getElementById('createFolderModal');
  const nameInput = document.getElementById('folderNameInput');
  const confirmBtn = document.getElementById('confirmCreateFolderBtn');
  
  nameInput.value = '';
  modal.style.display = 'flex';
  nameInput.focus();
  
  const handleCreate = async () => {
    const name = nameInput.value.trim();
    if (name) {
      modal.style.display = 'none';
      console.log('Creating folder:', name);
      const result = await window.electronAPI.createFolder(name);
      console.log('Create folder result:', result);
      if (result.success) {
        setStatus(`Folder "${name}" created`);
        console.log('Reloading favorites after folder creation...');
        await loadFavorites();
      } else {
        setStatus('Failed to create folder: ' + result.error, true);
      }
    }
  };
  
  confirmBtn.onclick = handleCreate;
  nameInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };
}

function closeCreateFolderModal() {
  document.getElementById('createFolderModal').style.display = 'none';
}

async function createNewFolder() {
  promptCreateFolder();
}

function deleteFolderPrompt(folderId, folderName) {
  const modal = document.getElementById('deleteFolderModal');
  const messageEl = document.getElementById('deleteFolderMessage');
  const confirmBtn = document.getElementById('confirmDeleteFolderBtn');
  
  messageEl.textContent = `Delete folder "${folderName}"?`;
  modal.style.display = 'flex';
  
  const handleDelete = async () => {
    modal.style.display = 'none';
    const result = await window.electronAPI.deleteFolder(folderId);
    if (result.success) {
      setStatus(`Folder "${folderName}" deleted`);
      await loadFavorites();
    } else {
      setStatus('Failed to delete folder', true);
    }
  };
  
  confirmBtn.onclick = handleDelete;
}

function closeDeleteFolderModal() {
  document.getElementById('deleteFolderModal').style.display = 'none';
}

async function showMoveToFolderDialog(favoriteId) {
  const foldersResult = await window.electronAPI.getFolders();
  if (!foldersResult.success || foldersResult.data.length === 0) {
    alert('No folders available. Create a folder first.');
    return;
  }
  
  const folderOptions = foldersResult.data.map(f => `${f.id}: ${f.name}`).join('\n');
  const folderId = prompt(`Move to folder:\n${folderOptions}\n\nEnter folder ID (or 0 for Uncategorized):`);
  
  if (folderId !== null) {
    const id = parseInt(folderId) || null;
    const result = await window.electronAPI.moveToFolder(favoriteId, id);
    if (result.success) {
      setStatus('Moved to folder');
      await loadFavorites();
    } else {
      setStatus('Failed to move to folder', true);
    }
  }
}

// CRITICAL: Expose folder/favorite management functions to window IMMEDIATELY
window.toggleFolder = toggleFolder;
window.createNewFolder = createNewFolder;
window.promptCreateFolder = promptCreateFolder;
window.closeCreateFolderModal = closeCreateFolderModal;
window.deleteFolderPrompt = deleteFolderPrompt;
window.closeDeleteFolderModal = closeDeleteFolderModal;
window.showMoveToFolderDialog = showMoveToFolderDialog;
console.log('[INIT] Exposed folder management functions:', {
  toggleFolder: typeof window.toggleFolder,
  createNewFolder: typeof window.createNewFolder,
  promptCreateFolder: typeof window.promptCreateFolder,
  closeCreateFolderModal: typeof window.closeCreateFolderModal,
  deleteFolderPrompt: typeof window.deleteFolderPrompt,
  closeDeleteFolderModal: typeof window.closeDeleteFolderModal,
  showMoveToFolderDialog: typeof window.showMoveToFolderDialog
});

async function loadFavorite(id, type, runId, ticker) {
  // Find the run in allRuns
  const run = allRuns.find(r => r.run_id === runId);
  if (!run) {
    setStatus('Run not found in database', true);
    return;
  }
  
  // Load the run
  await selectRun(run);
  
  // If it's a strategy, also select the ticker in the strategies tab
  if (type === 'strategy' && ticker) {
    // Switch to strategies tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById('strategiesBtn').classList.add('active');
    document.getElementById('strategiesTab').classList.add('active');
    
    // Wait a bit for strategies to load, then select the ticker
    setTimeout(() => {
      const strategyRow = document.querySelector(`.strategy-row[data-ticker="${ticker}"]`);
      if (strategyRow) {
        strategyRow.click();
      }
    }, 500);
  }
}

async function addToFavorites(type, name, runId, ticker = null, additionalData = {}) {
  console.log('addToFavorites called with:', { type, name, runId, ticker, additionalData });
  
  // Show the modal
  const modal = document.getElementById('saveStrategyModal');
  const nameInput = document.getElementById('strategyNameInput');
  const folderSelect = document.getElementById('strategyFolderSelect');
  const confirmBtn = document.getElementById('confirmSaveStrategyBtn');
  
  // Load folders into dropdown
  const foldersResult = await window.electronAPI.getFolders();
  folderSelect.innerHTML = '<option value="">Uncategorized</option>';
  if (foldersResult.success && foldersResult.data.length > 0) {
    foldersResult.data.forEach(folder => {
      folderSelect.innerHTML += `<option value="${folder.id}">${folder.name}</option>`;
    });
  }
  
  // Pre-fill the name
  nameInput.value = name;
  modal.style.display = 'flex';
  nameInput.focus();
  nameInput.select();
  
  // Handle save button
  const handleSave = async () => {
    try {
      const finalName = nameInput.value.trim();
      if (!finalName) return;
      
      const folderId = folderSelect.value ? parseInt(folderSelect.value) : null;
      modal.style.display = 'none';
      
      const item = {
        type,
        name: finalName,
        run_id: runId,
        ticker,
        folder_id: folderId,
        data_json: JSON.stringify(additionalData)
      };
      
      console.log('Sending to backend:', item);
      const result = await window.electronAPI.addFavorite(item);
      console.log('Backend response:', result);
      
      if (result.success) {
        setStatus(`Added "${finalName}" to saved strategies`);
        await loadFavorites();
      } else {
        console.error('Backend error:', result.error);
        setStatus(`Failed to add to favorites: ${result.error}`, true);
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      setStatus('Error adding to favorites: ' + error.message, true);
    }
  };
  
  // Replace old click handler
  confirmBtn.onclick = handleSave;
  
  // Allow Enter key to save
  nameInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };
}

// CRITICAL: Expose addToFavorites to window IMMEDIATELY
window.addToFavorites = addToFavorites;
console.log('[INIT] Exposed addToFavorites:', typeof window.addToFavorites);

async function removeFavorite(id) {
  try {
    console.time('removeFavorite');
    console.log('Removing favorite:', id);
    const result = await window.electronAPI.removeFavorite(id);
    console.timeEnd('removeFavorite');
    console.log('Remove result:', result);
    
    if (result.success) {
      setStatus('Removed from favorites');
      console.time('loadFavorites after remove');
      await loadFavorites();
      console.timeEnd('loadFavorites after remove');
    } else {
      setStatus('Failed to remove from favorites', true);
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    setStatus('Error removing favorite', true);
  }
}

// CRITICAL: Expose loadFavorite and removeFavorite to window IMMEDIATELY
window.loadFavorite = loadFavorite;
window.removeFavorite = removeFavorite;
console.log('[INIT] Exposed favorite functions:', {
  loadFavorite: typeof window.loadFavorite,
  removeFavorite: typeof window.removeFavorite
});

async function savePortfolioAsStrategy(runId, name, folderId = null) {
  try {
    console.log('Saving portfolio as strategy:', runId, name, 'folder:', folderId);
    
    // Get portfolio data
    const portfolioResult = await window.electronAPI.getPortfolio(runId);
    if (!portfolioResult.success) {
      throw new Error('Failed to get portfolio data');
    }
    const portfolio = portfolioResult.data;
    
    // Build weights object first (primary source of tickers for portfolios)
    const weights = {};
    let tickers = [];
    if (portfolio.weights && portfolio.weights.length > 0) {
      portfolio.weights.forEach(w => {
        weights[w.ticker] = w.target_weight;
      });
      tickers = portfolio.weights.map(w => w.ticker);
    }
    
    // Get strategies (for params) - might not exist for all portfolios
    const strategiesResult = await window.electronAPI.getStrategies(runId);
    const strategyParams = {};
    if (strategiesResult.success && strategiesResult.data) {
      const strategies = strategiesResult.data;
      strategies.forEach(s => {
        if (!strategyParams[s.ticker]) {
          strategyParams[s.ticker] = s.params || {};
        }
      });
      
      // Merge any additional tickers found in strategies
      const strategyTickers = [...new Set(strategies.map(s => s.ticker))];
      tickers = [...new Set([...tickers, ...strategyTickers])];
    }
    
    console.log('Extracted data:', { tickers, weights, strategyParams });
    
    // Save complete portfolio configuration
    const favoriteData = {
      type: 'portfolio',
      name: name,
      run_id: runId,
      ticker: tickers.join(','), // Store all tickers as comma-separated
      folder_id: folderId,
      data_json: JSON.stringify({
        // Performance metrics
        total_return: portfolio.total_return,
        sharpe: portfolio.sharpe,
        sortino: portfolio.sortino,
        maxdd: portfolio.maxdd,
        cagr: portfolio.cagr,
        vol: portfolio.vol,
        win_rate: portfolio.win_rate,
        
        // Configuration
        tickers: tickers,
        weights: weights,
        strategy_params: strategyParams,
        
        // Metadata
        saved_at: new Date().toISOString(),
        source_run_id: runId
      })
    };
    
    const result = await window.electronAPI.addFavorite(favoriteData);
    console.log('Save portfolio result:', result);
    
    if (result.success) {
      setStatus(`Saved portfolio "${name}" with ${tickers.length} tickers`);
      await loadFavorites();
    } else {
      console.error('Backend error:', result.error);
      setStatus(`Failed: ${result.error}`, true);
    }
  } catch (error) {
    console.error('Error saving portfolio as strategy:', error);
    setStatus('Error: ' + error.message, true);
  }
}

async function promptSavePortfolioAsStrategy(runId) {
  console.log('=== PORTFOLIO SAVE CLICKED ===');
  console.log('promptSavePortfolioAsStrategy called with runId:', runId);
  
  // Show the modal
  const modal = document.getElementById('saveStrategyModal');
  const nameInput = document.getElementById('strategyNameInput');
  const folderSelect = document.getElementById('strategyFolderSelect');
  const confirmBtn = document.getElementById('confirmSaveStrategyBtn');
  
  // Load folders into dropdown
  const foldersResult = await window.electronAPI.getFolders();
  folderSelect.innerHTML = '<option value="">Uncategorized</option>';
  if (foldersResult.success && foldersResult.data.length > 0) {
    foldersResult.data.forEach(folder => {
      folderSelect.innerHTML += `<option value="${folder.id}">${folder.name}</option>`;
    });
  }
  
  // Pre-fill with suggested name (user can edit)
  nameInput.value = `Strategy ${runId}`;
  modal.style.display = 'flex';
  nameInput.focus();
  nameInput.select(); // Select the text so user can easily replace it
  
  // Handle save button
  const handleSave = async () => {
    const name = nameInput.value.trim();
    if (name) {
      const folderId = folderSelect.value ? parseInt(folderSelect.value) : null;
      modal.style.display = 'none';
      await savePortfolioAsStrategy(runId, name, folderId);
    }
  };
  
  // Replace old click handler
  confirmBtn.onclick = handleSave;
  
  // Allow Enter key to save
  nameInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };
}

function closeSaveStrategyModal() {
  document.getElementById('saveStrategyModal').style.display = 'none';
}

// Open create folder modal from strategy save modal
async function openCreateFolderModalFromStrategy() {
  const folderModal = document.getElementById('createFolderModal');
  const nameInput = document.getElementById('folderNameInput');
  const confirmBtn = document.getElementById('confirmCreateFolderBtn');
  
  nameInput.value = '';
  folderModal.style.display = 'flex';
  nameInput.focus();
  
  const handleCreate = async () => {
    const name = nameInput.value.trim();
    if (name) {
      folderModal.style.display = 'none';
      const result = await window.electronAPI.createFolder(name);
      if (result.success) {
        // Refresh the folder dropdown in strategy modal
        const foldersResult = await window.electronAPI.getFolders();
        const folderSelect = document.getElementById('strategyFolderSelect');
        folderSelect.innerHTML = '<option value="">Uncategorized</option>';
        if (foldersResult.success && foldersResult.data.length > 0) {
          foldersResult.data.forEach(folder => {
            folderSelect.innerHTML += `<option value="${folder.id}">${folder.name}</option>`;
          });
          // Select the newly created folder
          const newFolder = foldersResult.data.find(f => f.name === name);
          if (newFolder) {
            folderSelect.value = newFolder.id;
          }
        }
        alert('Folder created successfully!');
      } else {
        alert('Failed to create folder: ' + result.error);
      }
    }
  };
  
  confirmBtn.onclick = handleCreate;
  nameInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };
}

// CRITICAL: Expose to window IMMEDIATELY so onclick handlers can find it
window.promptSavePortfolioAsStrategy = promptSavePortfolioAsStrategy;
window.closeSaveStrategyModal = closeSaveStrategyModal;
window.openCreateFolderModalFromStrategy = openCreateFolderModalFromStrategy;
console.log('[INIT] Exposed promptSavePortfolioAsStrategy:', typeof window.promptSavePortfolioAsStrategy);
console.log('[INIT] Exposed closeSaveStrategyModal:', typeof window.closeSaveStrategyModal);

// Update tab visibility based on run mode
function updateTabVisibility() {
  console.log('updateTabVisibility called, currentRun:', currentRun);
  const strategiesBtn = document.getElementById('strategiesBtn');
  const portfolioBtn = document.getElementById('portfolioBtn');
  const tradesBtn = document.getElementById('tradesBtn');
  
  console.log('Found buttons:', { strategiesBtn, portfolioBtn, tradesBtn });
  
  if (!currentRun) {
    console.log('No current run, skipping visibility update');
    return;
  }
  
  if (currentRun.mode === 'portfolio') {
    // Portfolio mode: hide Strategies tab, show Portfolio tab
    console.log('Portfolio mode: hiding Strategies, showing Portfolio');
    if (strategiesBtn) strategiesBtn.style.display = 'none';
    if (portfolioBtn) portfolioBtn.style.display = '';
    if (tradesBtn) tradesBtn.style.display = '';
  } else {
    // Single mode: show Strategies tab, hide Portfolio tab
    console.log('Single mode: showing Strategies, hiding Portfolio');
    if (strategiesBtn) strategiesBtn.style.display = '';
    if (portfolioBtn) portfolioBtn.style.display = 'none';
    if (tradesBtn) tradesBtn.style.display = '';
  }
}

// Load Run Details
async function loadRunDetails(run) {
  const overviewTab = document.getElementById('overviewTab');
  
  setStatus('Loading run details...');
  
  // Build overview
  const startDate = new Date(run.started_at * 1000).toLocaleString();
  const endDate = run.completed_at 
    ? new Date(run.completed_at * 1000).toLocaleString()
    : 'In Progress';
  const duration = run.completed_at 
    ? ((run.completed_at - run.started_at) / 60).toFixed(1) + ' minutes'
    : 'N/A';
  
  let overviewHtml = `
    <div class="overview-content">
      <div class="info-section">
        <h3>Run Information</h3>
        <div class="info-row">
          <span class="info-label">Run ID:</span>
          <span class="info-value">${run.run_id}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mode:</span>
          <span class="info-value">${run.mode || 'single'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Started:</span>
          <span class="info-value">${startDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Completed:</span>
          <span class="info-value">${endDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Duration:</span>
          <span class="info-value">${duration}</span>
        </div>
        ${run.notes ? `
        <div class="info-row">
          <span class="info-label">Notes:</span>
          <span class="info-value">${run.notes}</span>
        </div>
        ` : ''}
      </div>
  `;
  
  // Load metrics based on mode
  if (run.mode === 'portfolio') {
    console.log('Loading portfolio metrics for overview...');
    const result = await window.electronAPI.getPortfolio(run.run_id);
    console.log('Portfolio result:', result);
    if (result.success) {
      const p = result.data;
      console.log('Portfolio data:', p);
      overviewHtml += `
        <div class="metrics-grid">
          ${createMetricCard('Total Return', formatPercent(p.total_return), p.total_return >= 0)}
          ${createMetricCard('CAGR', formatPercent(p.cagr), p.cagr >= 0)}
          ${createMetricCard('Sharpe Ratio', formatNumber(p.sharpe, 2), p.sharpe >= 0)}
          ${createMetricCard('Sortino Ratio', formatNumber(p.sortino, 2), p.sortino >= 0)}
          ${createMetricCard('Volatility', formatPercent(p.vol))}
          ${createMetricCard('Max Drawdown', formatPercent(p.maxdd), false)}
          ${createMetricCard('Win Rate', formatPercent(p.win_rate), p.win_rate >= 0.5)}
          ${createMetricCard('Total Trades', p.trades_total || 0)}
        </div>
      `;
      console.log('Added metrics grid to overview');
      
      // Add portfolio weights if available
      if (p.weights && p.weights.length > 0) {
        overviewHtml += `
          <div class="info-section">
            <h3>Portfolio Weights</h3>
            <div class="weights-grid">
              ${p.weights.map(w => `
                <div class="weight-item">
                  <span class="weight-ticker">${w.ticker}</span>
                  <span class="weight-value">${formatPercent(w.target_weight)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      // Add action buttons
      overviewHtml += `
        <div class="portfolio-actions">
          <button class="btn btn-primary" onclick="viewPortfolioTearsheet('${run.run_id}')">
            📊 View Portfolio Tearsheet
          </button>
          <button class="btn btn-secondary" onclick="promptSavePortfolioAsStrategy('${run.run_id}')">
            ⭐ Save Portfolio as Strategy
          </button>
        </div>
      `;
    }
  } else {
    console.log('Loading strategies for single mode run:', run.run_id);
    const result = await window.electronAPI.getStrategies(run.run_id);
    console.log('Strategies result in overview:', result);
    
    if (result.success && result.data.length > 0) {
      const strategies = result.data;
      // Store for later use in strategies tab
      currentStrategies = strategies;
      console.log(`Loaded ${strategies.length} strategies into currentStrategies`);
      
      // Filter out null/NaN values for calculations
      const validReturns = strategies.filter(s => s.total_return !== null && !isNaN(s.total_return));
      const validSharpes = strategies.filter(s => s.sharpe !== null && !isNaN(s.sharpe) && isFinite(s.sharpe));
      const validDrawdowns = strategies.filter(s => s.maxdd !== null && !isNaN(s.maxdd));
      
      const avgReturn = validReturns.length > 0 
        ? validReturns.reduce((sum, s) => sum + s.total_return, 0) / validReturns.length 
        : 0;
      
      // Calculate MEDIAN Sharpe (sort and take middle value)
      const medianSharpe = validSharpes.length > 0
        ? (() => {
            const sorted = validSharpes.map(s => s.sharpe).sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          })()
        : 0;
      
      const maxReturn = validReturns.length > 0
        ? Math.max(...validReturns.map(s => s.total_return))
        : 0;
      
      // Worst drawdown = MAX (most negative, closest to -100%)
      const worstDrawdown = validDrawdowns.length > 0
        ? Math.max(...validDrawdowns.map(s => Math.abs(s.maxdd))) * -1
        : 0;
      
      overviewHtml += `
        <div class="metrics-grid">
          ${createMetricCard('Strategies', strategies.length)}
          ${createMetricCard('Avg Return', formatPercent(avgReturn), avgReturn >= 0)}
          ${createMetricCard('Best Return', formatPercent(maxReturn), maxReturn >= 0)}
          ${createMetricCard('Median Sharpe', formatNumber(medianSharpe, 2), medianSharpe >= 0)}
          ${createMetricCard('Worst Drawdown', formatPercent(worstDrawdown), false)}
          ${createMetricCard('Unique Tickers', new Set(strategies.map(s => s.ticker)).size)}
        </div>
      `;
    } else {
      console.warn('No strategies found or error:', result);
    }
  }
  
  overviewHtml += '</div>';
  console.log('Setting overview HTML, length:', overviewHtml.length);
  overviewTab.innerHTML = overviewHtml;
  console.log('Overview tab updated');
  
  setStatus('Ready');
}

// Load Strategies
async function loadStrategies(runId) {
  console.log('loadStrategies called for runId:', runId);
  setStatus('Loading strategies...');
  const result = await window.electronAPI.getStrategies(runId);
  const bhResult = await window.electronAPI.getBuyHoldMetrics(runId);
  
  console.log('getStrategies result:', result);
  console.log('getBuyHoldMetrics result:', bhResult);
  
  if (result.success) {
    currentStrategies = result.data;
    if (bhResult.success) {
      buyHoldMetrics = bhResult.data;
    }
    
    // Populate ticker dropdown
    const uniqueTickers = [...new Set(currentStrategies.map(s => s.ticker))].sort();
    tickerFilter.innerHTML = '<option value="">All Tickers</option>' + 
      uniqueTickers.map(ticker => `<option value="${ticker}">${ticker}</option>`).join('');
    
    console.log(`Loaded ${currentStrategies.length} strategies`);
    displayStrategies(currentStrategies);
    setStatus(`Loaded ${currentStrategies.length} strategies`);
  } else {
    console.error('Error loading strategies:', result.error);
    document.getElementById('strategiesContent').innerHTML = 
      '<div class="empty-state"><p>No strategies found</p></div>';
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayStrategies(strategies) {
  if (!strategies || strategies.length === 0) {
    document.getElementById('strategiesContent').innerHTML = 
      '<div class="empty-state"><p>No strategies to display</p></div>';
    return;
  }
  
  const hasBuyHoldData = Object.keys(buyHoldMetrics).length > 0;
  
  // Helper function to get comparison class for a metric
  function getComparisonClass(stratValue, bhValue, higherIsBetter = true) {
    if (!hasBuyHoldData || stratValue === null || stratValue === undefined || bhValue === null || bhValue === undefined) {
      return ''; // No comparison possible
    }
    
    const isBetter = higherIsBetter ? stratValue > bhValue : stratValue < bhValue;
    return isBetter ? 'positive-value' : 'negative-value';
  }
  
  const noticeHtml = !hasBuyHoldData ? 
    `<div style="background: var(--bg-secondary); padding: 12px; margin-bottom: 12px; border-radius: 4px; border-left: 3px solid var(--warning-color, #FFA500);">
      <strong>Note:</strong> Buy & hold comparison data not available. Re-run your backtest with the updated code to enable color-coded performance comparison.
    </div>` : '';
  
  const getSortIndicator = (field) => {
    if (currentSortField !== field) return '';
    return currentSortDesc ? ' ▼' : ' ▲';
  };
  
  const html = `
    ${noticeHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th class="sortable-header" onclick="sortByColumn('total_return')" style="cursor: pointer;">
            Total Return${getSortIndicator('total_return')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('cagr')" style="cursor: pointer;">
            CAGR${getSortIndicator('cagr')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('sharpe')" style="cursor: pointer;">
            Sharpe${getSortIndicator('sharpe')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('sortino')" style="cursor: pointer;">
            Sortino${getSortIndicator('sortino')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('vol')" style="cursor: pointer;">
            Volatility${getSortIndicator('vol')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('maxdd')" style="cursor: pointer;">
            Max DD${getSortIndicator('maxdd')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('win_rate')" style="cursor: pointer;">
            Win Rate${getSortIndicator('win_rate')}
          </th>
          <th class="sortable-header" onclick="sortByColumn('trades_total')" style="cursor: pointer;">
            Trades${getSortIndicator('trades_total')}
          </th>
          <th>Parameters</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${strategies.map(s => {
          const bh = buyHoldMetrics[s.ticker] || {};
          return `
          <tr class="strategy-row" data-strategy-id="${s.id}" style="cursor: pointer;">
            <td class="ticker-cell">${s.ticker}</td>
            <td class="${getComparisonClass(s.total_return, bh.total_return, true)}">
              ${formatPercent(s.total_return)}
            </td>
            <td class="${getComparisonClass(s.cagr, bh.cagr, true)}">
              ${formatPercent(s.cagr)}
            </td>
            <td class="${getComparisonClass(s.sharpe, bh.sharpe, true)}">
              ${formatNumber(s.sharpe, 2)}
            </td>
            <td class="${getComparisonClass(s.sortino, bh.sortino, true)}">
              ${formatNumber(s.sortino, 2)}
            </td>
            <td class="${getComparisonClass(s.vol, bh.vol, false)}">
              ${formatPercent(s.vol)}
            </td>
            <td class="${getComparisonClass(s.maxdd, bh.maxdd, false)}">
              ${formatPercent(s.maxdd)}
            </td>
            <td>${formatPercent(s.win_rate)}</td>
            <td>${s.trades_total || 0}</td>
            <td style="font-size: 11px; color: var(--text-secondary);">
              ${Object.entries(s.params || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
            </td>
            <td>
              <button class="btn-view-tearsheet" onclick="event.stopPropagation(); viewTearsheet(${s.id})">
                View Tearsheet
              </button>
              <button class="btn-favorite" data-strategy-id="${s.id}" data-ticker="${s.ticker}" title="Add to favorites">
                ⭐
              </button>
            </td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('strategiesContent').innerHTML = html;
  
  // Add click handlers to strategy rows
  document.querySelectorAll('.strategy-row').forEach(row => {
    row.addEventListener('click', () => {
      const strategyId = parseInt(row.dataset.strategyId);
      displayStrategyOverview(strategyId);
    });
  });
  
  // Add click handlers to favorite buttons
  document.querySelectorAll('.btn-favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const strategyId = parseInt(btn.dataset.strategyId);
      const ticker = btn.dataset.ticker;
      const strategy = currentStrategies.find(s => s.id === strategyId);
      if (strategy) {
        // Save complete strategy configuration
        const strategyData = {
          strategy_id: strategy.id,
          ticker: ticker,
          
          // Entry/Exit Parameters
          params: strategy.params || {},
          
          // Performance Metrics
          metrics: {
            total_return: strategy.total_return,
            cagr: strategy.cagr,
            sharpe: strategy.sharpe,
            sortino: strategy.sortino,
            vol: strategy.vol,
            maxdd: strategy.maxdd,
            win_rate: strategy.win_rate,
            net_win_rate: strategy.net_win_rate,
            trades_total: strategy.trades_total,
            avg_trade_pnl: strategy.avg_trade_pnl
          },
          
          // Metadata
          saved_at: new Date().toISOString(),
          source_run_id: currentRun.run_id
        };
        
        // Create descriptive name
        const paramsStr = Object.entries(strategy.params || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        const name = `${ticker} (${paramsStr})`;
        
        addToFavorites('strategy', name, currentRun.run_id, ticker, strategyData);
      }
    });
  });
}

async function displayStrategyOverview(strategyId) {
  console.log('displayStrategyOverview called with ID:', strategyId);
  console.log('Current strategies:', currentStrategies.length);
  
  // Find the strategy in current strategies
  const strategy = currentStrategies.find(s => s.id === strategyId);
  if (!strategy) {
    console.error('Strategy not found:', strategyId);
    console.error('Available strategy IDs:', currentStrategies.map(s => s.id));
    return;
  }
  
  console.log('Found strategy:', strategy.ticker, strategy.id);
  
  // Switch to overview tab
  switchToTab('overview');
  
  // Display strategy details in overview
  const bh = buyHoldMetrics[strategy.ticker] || {};
  const hasBuyHold = Object.keys(bh).length > 0;
  
  const overviewHtml = `
    <div style="padding: 20px;">
      <h2 style="margin-bottom: 20px; color: var(--accent-green);">${strategy.ticker} - Strategy #${strategy.id}</h2>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="metric-card">
          <div class="metric-label">Total Return</div>
          <div class="metric-value" style="color: ${strategy.total_return >= 0 ? 'var(--positive)' : 'var(--negative)'};">
            ${formatPercent(strategy.total_return)}
          </div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.total_return)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">CAGR</div>
          <div class="metric-value">${formatPercent(strategy.cagr)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.cagr)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Sharpe Ratio</div>
          <div class="metric-value">${formatNumber(strategy.sharpe, 2)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatNumber(bh.sharpe, 2)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Sortino Ratio</div>
          <div class="metric-value">${formatNumber(strategy.sortino, 2)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatNumber(bh.sortino, 2)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Volatility</div>
          <div class="metric-value">${formatPercent(strategy.vol)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.vol)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Max Drawdown</div>
          <div class="metric-value" style="color: var(--negative);">${formatPercent(strategy.maxdd)}</div>
          ${hasBuyHold ? `<div class="metric-sub">B&H: ${formatPercent(bh.maxdd)}</div>` : ''}
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Win Rate</div>
          <div class="metric-value">${formatPercent(strategy.win_rate)}</div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Total Trades</div>
          <div class="metric-value">${strategy.trades_total || 0}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="margin-bottom: 10px;">Parameters</h3>
        <div style="background: var(--bg-secondary); padding: 15px; border-radius: 6px; font-family: 'SF Mono', 'Monaco', monospace; font-size: 12px;">
          ${Object.entries(strategy.params || {}).map(([k, v]) => 
            `<div style="margin-bottom: 5px;"><span style="color: var(--text-secondary);">${k}:</span> <span style="color: var(--accent-green);">${v}</span></div>`
          ).join('')}
        </div>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button class="btn-view-tearsheet" onclick="viewTearsheet(${strategy.id})" style="padding: 12px 24px; font-size: 14px;">
          View Full Tearsheet
        </button>
        <button class="btn btn-primary" onclick="switchToTab('trades')" style="padding: 12px 24px; font-size: 14px;">
          📊 View Trades for ${strategy.ticker}
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('overviewTab').innerHTML = overviewHtml;
  
  // Load trades for this strategy
  console.log('Loading trades for strategy:', strategy.ticker);
  loadTradesForStrategy(strategy.id);
}

function sortByColumn(field) {
  // Toggle sort direction if clicking the same column
  if (currentSortField === field) {
    currentSortDesc = !currentSortDesc;
  } else {
    currentSortField = field;
    currentSortDesc = true; // Default to descending for new column
  }
  
  filterStrategies();
}

// CRITICAL: Expose sortByColumn to window IMMEDIATELY
window.sortByColumn = sortByColumn;
console.log('[INIT] Exposed sortByColumn:', typeof window.sortByColumn);

function filterStrategies() {
  const selectedTicker = tickerFilter.value;
  
  let filtered = currentStrategies;
  
  // Filter by ticker if one is selected
  if (selectedTicker) {
    filtered = filtered.filter(s => s.ticker === selectedTicker);
  }
  
  // Sort
  filtered.sort((a, b) => {
    const valA = a[currentSortField] || 0;
    const valB = b[currentSortField] || 0;
    return currentSortDesc ? valB - valA : valA - valB;
  });
  
  displayStrategies(filtered);
}

// Load Portfolio
async function loadPortfolio(runId) {
  setStatus('Loading portfolio...');
  const result = await window.electronAPI.getPortfolio(runId);
  
  if (result.success) {
    displayPortfolio(result.data);
    setStatus('Portfolio loaded');
  } else {
    document.getElementById('portfolioContent').innerHTML = 
      '<div class="empty-state"><p>No portfolio data available</p></div>';
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayPortfolio(portfolio) {
  const html = `
    <div style="margin-bottom: 20px;">
      <button class="btn-view-tearsheet" onclick="viewPortfolioTearsheet('${portfolio.run_id}')" style="padding: 12px 24px; font-size: 14px;">
        📊 View Portfolio Tearsheet
      </button>
    </div>
    
    <div class="metrics-grid">
      ${createMetricCard('Total Return', formatPercent(portfolio.total_return), portfolio.total_return >= 0)}
      ${createMetricCard('CAGR', formatPercent(portfolio.cagr), portfolio.cagr >= 0)}
      ${createMetricCard('Sharpe Ratio', formatNumber(portfolio.sharpe, 2), portfolio.sharpe >= 0)}
      ${createMetricCard('Sortino Ratio', formatNumber(portfolio.sortino, 2), portfolio.sortino >= 0)}
      ${createMetricCard('Volatility', formatPercent(portfolio.vol))}
      ${createMetricCard('Max Drawdown', formatPercent(portfolio.maxdd), false)}
      ${createMetricCard('Win Rate', formatPercent(portfolio.win_rate), portfolio.win_rate >= 0.5)}
      ${createMetricCard('Net Win Rate', formatPercent(portfolio.net_win_rate))}
      ${createMetricCard('Avg Trade P&L', formatNumber(portfolio.avg_trade_pnl, 2))}
      ${createMetricCard('Total Trades', portfolio.trades_total || 0)}
    </div>
    
    ${portfolio.weights && portfolio.weights.length > 0 ? `
      <div class="info-section">
        <h3>Portfolio Weights</h3>
        <div class="weights-grid">
          ${portfolio.weights.map(w => `
            <div class="weight-card">
              <div class="weight-ticker">${w.ticker}</div>
              <div class="weight-value">${formatPercent(w.target_weight)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  
  document.getElementById('portfolioContent').innerHTML = html;
}

// Load Trades
async function loadTrades(runId, ticker = null) {
  console.log('loadTrades called with runId:', runId, 'ticker:', ticker);
  setStatus('Loading trades...');
  
  try {
    const result = await window.electronAPI.getTrades(runId, ticker);
    console.log('getTrades result:', result);
    
    if (result.success) {
      currentTrades = result.data;
      console.log('Displaying', currentTrades.length, 'trades for ticker:', ticker);
      displayTrades(currentTrades);
      setStatus(`Loaded ${currentTrades.length} trades`);
    } else {
      console.error('Failed to load trades:', result.error);
      document.getElementById('tradesContent').innerHTML = 
        '<div class="empty-state"><p>No trades found</p></div>';
      setStatus(`Error: ${result.error}`, true);
    }
  } catch (error) {
    console.error('Exception in loadTrades:', error);
    document.getElementById('tradesContent').innerHTML = 
      '<div class="empty-state"><p>Error loading trades</p></div>';
    setStatus('Error loading trades: ' + error.message, true);
  }
}

async function loadTradesForStrategy(strategyId) {
  console.log('Loading trades for strategy ID:', strategyId);
  // Find the strategy to get the ticker
  const strategy = currentStrategies.find(s => s.id === strategyId);
  if (!strategy) {
    console.error('Strategy not found:', strategyId);
    return;
  }
  
  console.log('Loading trades for ticker:', strategy.ticker);
  // Load trades for this ticker
  await loadTrades(currentRun.run_id, strategy.ticker);
  
  // Add visual indicator to Trades tab button
  const tradesBtn = document.querySelector('[data-tab="trades"]');
  if (tradesBtn && currentTrades.length > 0) {
    tradesBtn.innerHTML = `Trades (${currentTrades.length})`;
    tradesBtn.style.color = 'var(--accent-green)';
  }
  
  console.log('Trades loaded, click Trades tab to view');
}

function displayTrades(trades) {
  if (!trades || trades.length === 0) {
    document.getElementById('tradesContent').innerHTML = 
      '<div class="empty-state"><p>No trades to display</p></div>';
    return;
  }
  
  const html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Ticker</th>
          <th>Side</th>
          <th>Shares</th>
          <th>Price</th>
          <th>Fees</th>
          <th>P&L</th>
        </tr>
      </thead>
      <tbody>
        ${trades.map(t => `
          <tr>
            <td>${new Date(t.dt).toLocaleString()}</td>
            <td class="ticker-cell">${t.ticker}</td>
            <td>
              <span style="color: ${t.side === 'buy' ? 'var(--positive)' : 'var(--negative)'}">
                ${t.side.toUpperCase()}
              </span>
            </td>
            <td>${t.shares}</td>
            <td>$${formatNumber(t.price, 2)}</td>
            <td>$${formatNumber(t.fees, 2)}</td>
            <td class="${t.pnl >= 0 ? 'positive-value' : 'negative-value'}">
              ${t.pnl ? '$' + formatNumber(t.pnl, 2) : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('tradesContent').innerHTML = html;
}

function filterTrades() {
  const searchTerm = tradeSearch.value.toLowerCase();
  const side = sideFilter.value;
  
  let filtered = currentTrades.filter(t => {
    const matchesSearch = t.ticker.toLowerCase().includes(searchTerm);
    const matchesSide = !side || t.side === side;
    return matchesSearch && matchesSide;
  });
  
  displayTrades(filtered);
}

// Compare Runs
async function compareRuns() {
  if (selectedRuns.size < 2) return;
  
  setStatus('Loading comparison data...');
  const runIds = Array.from(selectedRuns);
  const result = await window.electronAPI.getComparisonData(runIds);
  
  if (result.success) {
    displayComparison(result.data);
    setStatus('Comparison ready');
  } else {
    setStatus(`Error: ${result.error}`, true);
  }
}

function displayComparison(data) {
  const { portfolios, strategies } = data;
  
  let html = '<div class="comparison-grid">';
  
  // Portfolio comparisons
  portfolios.forEach(p => {
    html += `
      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-run-id">${p.run_id}</span>
          <span class="run-mode portfolio">Portfolio</span>
        </div>
        <div class="comparison-metrics">
          ${createInfoRow('Return', formatPercent(p.total_return))}
          ${createInfoRow('Sharpe', formatNumber(p.sharpe, 2))}
          ${createInfoRow('Sortino', formatNumber(p.sortino, 2))}
          ${createInfoRow('Max DD', formatPercent(p.maxdd))}
          ${createInfoRow('Win Rate', formatPercent(p.win_rate))}
        </div>
      </div>
    `;
  });
  
  // Strategy comparisons
  strategies.forEach(s => {
    html += `
      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-run-id">${s.run_id}</span>
          <span class="run-mode single">Single</span>
        </div>
        <div class="comparison-metrics">
          ${createInfoRow('Strategies', s.strategy_count)}
          ${createInfoRow('Avg Return', formatPercent(s.avg_return))}
          ${createInfoRow('Best Return', formatPercent(s.max_return))}
          ${createInfoRow('Avg Sharpe', formatNumber(s.avg_sharpe, 2))}
          ${createInfoRow('Worst DD', formatPercent(s.worst_drawdown))}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  document.getElementById('compareContent').innerHTML = html;
}

// Helper Functions
function createMetricCard(label, value, isPositive = null) {
  let valueClass = '';
  if (isPositive !== null) {
    valueClass = isPositive ? 'positive' : 'negative';
  }
  
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value ${valueClass}">${value}</div>
    </div>
  `;
}

function createInfoRow(label, value) {
  return `
    <div class="info-row">
      <span class="info-label">${label}:</span>
      <span class="info-value">${value}</span>
    </div>
  `;
}

function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(decimals) + '%';
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? 'var(--negative)' : 'var(--text-secondary)';
}

// ========== Favorites Functions are defined earlier in the file (around line 266) ==========
// The duplicate old versions here have been removed to prevent conflicts

// Toggle favorites section (keep this event listener)
document.getElementById('toggleFavorites')?.addEventListener('click', () => {
  const btn = document.getElementById('toggleFavorites');
  const list = document.getElementById('favoritesList');
  
  btn.classList.toggle('collapsed');
  list.classList.toggle('collapsed');
});

// Tearsheet Functions
async function viewPortfolioTearsheet(runId) {
  const modal = document.getElementById('tearsheetModal');
  const loading = document.getElementById('tearsheetLoading');
  const content = document.getElementById('tearsheetContent');
  
  // Show modal with loading state
  modal.classList.add('show');
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    // Load portfolio details
    const result = await window.electronAPI.getPortfolio(runId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load portfolio details');
    }
    
    const portfolio = result.data;
    
    // Get benchmark data from the run
    const run = allRuns.find(r => r.run_id === runId);
    let benchmarkEquity = null;
    if (run && run.benchmark_equity) {
      benchmarkEquity = run.benchmark_equity;
    }
    
    // Update title
    document.getElementById('tearsheetTitle').textContent = 
      `Portfolio - ${portfolio.run_id}`;
    
    // Show content early so DOM elements are accessible
    loading.style.display = 'none';
    content.style.display = 'block';
    
    // Display metrics
    console.log('Portfolio object:', portfolio);
    console.log('Portfolio.metrics:', portfolio.metrics);
    console.log('Portfolio.metrics keys:', Object.keys(portfolio.metrics || {}));
    console.log('Looking for buyhold_total_return:', portfolio.metrics?.buyhold_total_return);
    console.log('Looking for bench_total_return:', portfolio.metrics?.bench_total_return);
    displayPortfolioTearsheetMetrics(portfolio, benchmarkEquity);
    
    // Calculate and display CAPM if both portfolio and benchmark available
    if (portfolio.equity && benchmarkEquity) {
      await displayPortfolioCapmMetrics(portfolio, benchmarkEquity);
    } else {
      document.getElementById('tearsheetCapm').innerHTML = 
        '<p style="color: var(--text-secondary); font-size: 11px; text-align: center; padding: 20px;">CAPM analysis not available (benchmark data missing)</p>';
    }
    
    // Display equity chart with all three curves
    if (portfolio.equity) {
      displayEquityChart(portfolio.equity, portfolio.buyhold_equity, benchmarkEquity, []);
    } else {
      document.getElementById('equityChart').innerHTML = 
        '<p style="color: var(--text-secondary);">Equity data not available</p>';
    }
    
    // Display vol-matched charts
    if (portfolio.equity && benchmarkEquity) {
      displayVolMatchedChart(portfolio.equity, benchmarkEquity, 'volMatchedBenchChart', 'Benchmark');
    } else {
      document.getElementById('volMatchedBenchChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Benchmark not available</div>';
    }
    
    if (portfolio.equity && portfolio.buyhold_equity) {
      displayVolMatchedChart(portfolio.equity, portfolio.buyhold_equity, 'volMatchedBuyHoldChart', 'Buy & Hold');
    } else {
      document.getElementById('volMatchedBuyHoldChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Buy & Hold not available</div>';
    }
    
    // Display drawdown chart with all three curves
    if (portfolio.equity) {
      displayDrawdownChart(portfolio.equity, portfolio.buyhold_equity, benchmarkEquity);
    } else {
      document.getElementById('drawdownChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Data not available</div>';
    }
    
  } catch (error) {
    console.error('Error loading portfolio tearsheet:', error);
    loading.innerHTML = `
      <div class="error-state" style="color: var(--negative); text-align: center;">
        <p>Failed to load portfolio tearsheet</p>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 10px;">
          ${error.message}
        </p>
      </div>
    `;
  }
}

// CRITICAL: Expose to window IMMEDIATELY so onclick handlers can find it
window.viewPortfolioTearsheet = viewPortfolioTearsheet;
console.log('[INIT] Exposed viewPortfolioTearsheet:', typeof window.viewPortfolioTearsheet);

// Download the current tearsheet modal as a standalone HTML file
function downloadTearsheetHtml() {
  const modal = document.getElementById('tearsheetModal');
  const content = document.getElementById('tearsheetContent');
  const title = document.getElementById('tearsheetTitle').textContent || 'Tearsheet';
  if (!content || content.style.display === 'none') {
    alert('Tearsheet is not loaded yet.');
    return;
  }

  // Clone the content to avoid modifying the live DOM
  const tearsheetHtml = content.cloneNode(true);
  // Inline styles for modal look
  const style = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML).join('\n');
  // Also grab computed styles for .tearsheet-modal if needed

  // Compose minimal HTML doc
  const docHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>${title}</title>\n${style}\n<style>body{background:#181a20;color:#e0e0e0;font-family:sans-serif;margin:0;padding:0;} .tearsheet-modal{max-width:1200px;margin:40px auto;background:#23262e;border-radius:12px;box-shadow:0 4px 32px #0008;padding:32px;} .tearsheet-section{margin-bottom:24px;} .metric-row{display:flex;gap:12px;padding:4px 0;} .metric-label{flex:1;} .metric-value{text-align:right;min-width:80px;display:inline-block;} .metrics-comparison,.metrics-capm{font-size:15px;} .chart-main,.chart-small{background:#181a20;border-radius:8px;min-height:220px;} .tearsheet-top-section{display:flex;gap:32px;} .tearsheet-sidebar{width:320px;} .tearsheet-main-chart-container{flex:1;} .tearsheet-charts-row{display:flex;gap:24px;} .chart-third{flex:1;} </style>\n</head>\n<body>\n<div class="tearsheet-modal">\n<h2 style="margin-top:0;">${title}</h2>\n${tearsheetHtml.innerHTML}\n</div>\n</body>\n</html>`;

  // Download as file
  const blob = new Blob([docHtml], {type: 'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}_tearsheet.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 100);
}
window.downloadTearsheetHtml = downloadTearsheetHtml;

function displayPortfolioTearsheetMetrics(portfolio, benchmarkEquity) {
  const metricsDiv = document.getElementById('tearsheetMetrics');
  
  function formatMetricValue(value, isPercent = false) {
    if (value === null || value === undefined || isNaN(value)) return '<span style="color: var(--text-secondary);">N/A</span>';
    
    const formatted = isPercent ? formatPercent(value) : formatNumber(value, 3);
    return `<span class="metric-value">${formatted}</span>`;
  }
  
  // Portfolio metrics are at top level, buy & hold and benchmark are in metrics object
  const m = portfolio.metrics || {};
  
  const metricsHtml = `
    <div class="metric-row header">
      <div>Metric</div>
      <div style="text-align: right;">Portfolio</div>
      <div style="text-align: right;">Buy & Hold</div>
      <div style="text-align: right;">Benchmark</div>
    </div>
    <div class="metric-row">
      <div class="metric-label">Total Return</div>
      ${formatMetricValue(portfolio.total_return, true)}
      ${formatMetricValue(m.buyhold_total_return, true)}
      ${formatMetricValue(m.bench_total_return, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">CAGR</div>
      ${formatMetricValue(portfolio.cagr, true)}
      ${formatMetricValue(m.buyhold_cagr, true)}
      ${formatMetricValue(m.bench_cagr, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sharpe</div>
      ${formatMetricValue(portfolio.sharpe, false)}
      ${formatMetricValue(m.buyhold_sharpe, false)}
      ${formatMetricValue(m.bench_sharpe, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sortino</div>
      ${formatMetricValue(portfolio.sortino, false)}
      ${formatMetricValue(m.buyhold_sortino, false)}
      ${formatMetricValue(m.bench_sortino, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Volatility</div>
      ${formatMetricValue(portfolio.vol, true)}
      ${formatMetricValue(m.buyhold_vol, true)}
      ${formatMetricValue(m.bench_vol, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Max Drawdown</div>
      ${formatMetricValue(portfolio.maxdd, true)}
      ${formatMetricValue(m.buyhold_maxdd, true)}
      ${formatMetricValue(m.bench_maxdd, true)}
    </div>
  `;
  
  metricsDiv.innerHTML = metricsHtml;
  
  // Trade summary
  const tradeSummaryDiv = document.getElementById('tradeSummary');
  const tradeSummaryHtml = `
    <div class="simple-metric">
      <span class="simple-metric-label">Total Trades</span>
      <span class="simple-metric-value">${portfolio.trades_total || 0}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Win Rate</span>
      <span class="simple-metric-value">${formatPercent(portfolio.win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Net Win Rate</span>
      <span class="simple-metric-value">${formatPercent(portfolio.net_win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Avg Trade P&L</span>
      <span class="simple-metric-value">${formatNumber(portfolio.avg_trade_pnl, 2)}</span>
    </div>
  `;
  
  tradeSummaryDiv.innerHTML = tradeSummaryHtml;
}

async function displayPortfolioCapmMetrics(portfolio, benchmarkEquity) {
  try {
    console.log('displayPortfolioCapmMetrics called');
    console.log('portfolio.equity:', portfolio.equity);
    console.log('portfolio.buyhold_equity:', portfolio.buyhold_equity);
    console.log('benchmarkEquity:', benchmarkEquity);
    
    // Calculate CAPM for Portfolio vs Benchmark
    const portfolioResult = await window.electronAPI.calculateCapm(
      portfolio.equity,
      benchmarkEquity
    );
    
    // Calculate CAPM for Buy & Hold vs Benchmark
    const buyholdResult = await window.electronAPI.calculateCapm(
      portfolio.buyhold_equity,
      benchmarkEquity
    );
    
    console.log('Portfolio CAPM result:', portfolioResult);
    console.log('Buy & Hold CAPM result:', buyholdResult);
    
    if (!portfolioResult.success && !buyholdResult.success) {
      document.getElementById('tearsheetCapm').innerHTML = 
        `<p style="color: var(--negative); font-size: 11px; text-align: center; padding: 20px;">CAPM calculation failed</p>`;
      return;
    }
    
    const portfolioCapm = portfolioResult.success ? portfolioResult.data : {};
    const buyholdCapm = buyholdResult.success ? buyholdResult.data : {};
    
    const capmHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div class="metric-row header" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 5px;">
          <div>Metric</div>
          <div style="text-align: right;">Portfolio</div>
          <div style="text-align: right;">Buy & Hold</div>
        </div>
        <div class="metric-row" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="metric-label">Alpha</div>
          <div style="text-align: right;">${formatPercent(portfolioCapm.alpha)}</div>
          <div style="text-align: right;">${formatPercent(buyholdCapm.alpha)}</div>
        </div>
        <div class="metric-row" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="metric-label">Beta</div>
          <div style="text-align: right;">${formatNumber(portfolioCapm.beta, 3)}</div>
          <div style="text-align: right;">${formatNumber(buyholdCapm.beta, 3)}</div>
        </div>
        <div class="metric-row" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="metric-label">R²</div>
          <div style="text-align: right;">${formatNumber(portfolioCapm.r_squared, 3)}</div>
          <div style="text-align: right;">${formatNumber(buyholdCapm.r_squared, 3)}</div>
        </div>
        <div class="metric-row" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="metric-label">Tracking Error</div>
          <div style="text-align: right;">${formatPercent(portfolioCapm.tracking_error)}</div>
          <div style="text-align: right;">${formatPercent(buyholdCapm.tracking_error)}</div>
        </div>
        <div class="metric-row" style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="metric-label">Info Ratio</div>
          <div style="text-align: right;">${formatNumber(portfolioCapm.information_ratio, 3)}</div>
          <div style="text-align: right;">${formatNumber(buyholdCapm.information_ratio, 3)}</div>
        </div>
      </div>
    `;
    
    document.getElementById('tearsheetCapm').innerHTML = capmHtml;
  } catch (error) {
    console.error('Error calculating CAPM:', error);
    document.getElementById('tearsheetCapm').innerHTML = 
      `<p style="color: var(--negative); font-size: 11px; text-align: center; padding: 20px;">CAPM calculation error: ${error.message}</p>`;
  }
}

async function viewTearsheet(strategyId) {
  const modal = document.getElementById('tearsheetModal');
  const loading = document.getElementById('tearsheetLoading');
  const content = document.getElementById('tearsheetContent');
  
  // Show modal with loading state
  modal.classList.add('show');
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    // Load strategy details
    const result = await window.electronAPI.getStrategyDetails(strategyId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load strategy details');
    }
    
    const strategy = result.data;
    
    // Update title
    document.getElementById('tearsheetTitle').textContent = 
      `${strategy.ticker} - Strategy #${strategy.id}`;
    
    // Show content early so DOM elements are accessible
    loading.style.display = 'none';
    content.style.display = 'block';
    
    // Display metrics
    displayTearsheetMetrics(strategy);
    
    // Calculate and display CAPM (only if benchmark is available)
    if (strategy.equity && strategy.benchmark_equity) {
      await displayCapmMetrics(strategy, strategy.benchmark_equity);
    } else {
      document.getElementById('tearsheetCapm').innerHTML = 
        '<p style="color: var(--text-secondary); font-size: 11px; text-align: center; padding: 20px;">CAPM analysis not available (benchmark disabled or missing)</p>';
    }
    
    // Display equity chart
    if (strategy.equity) {
      displayEquityChart(strategy.equity, strategy.buyhold_equity, strategy.benchmark_equity, strategy.events);
    } else {
      document.getElementById('equityChart').innerHTML = 
        '<p style="color: var(--text-secondary);">Equity data not available</p>';
    }
    
    // Display vol-matched charts
    if (strategy.equity && strategy.benchmark_equity) {
      displayVolMatchedChart(strategy.equity, strategy.benchmark_equity, 'volMatchedBenchChart', 'Benchmark');
    } else {
      document.getElementById('volMatchedBenchChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Benchmark not available</div>';
    }
    
    if (strategy.equity && strategy.buyhold_equity) {
      displayVolMatchedChart(strategy.equity, strategy.buyhold_equity, 'volMatchedBuyHoldChart', 'Buy & Hold');
    } else {
      document.getElementById('volMatchedBuyHoldChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Buy & Hold not available</div>';
    }
    
    // Display drawdown chart
    if (strategy.equity) {
      displayDrawdownChart(strategy.equity, strategy.buyhold_equity, strategy.benchmark_equity);
    } else {
      document.getElementById('drawdownChart').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Data not available</div>';
    }
    
    // Display trade events
    displayTradeEvents(strategy.events);
    
  } catch (error) {
    console.error('Error loading tearsheet:', error);
    loading.innerHTML = `
      <div class="error-state" style="color: var(--negative); text-align: center;">
        <p>Failed to load tearsheet</p>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 10px;">
          ${error.message}
        </p>
      </div>
    `;
  }
}

function closeTearsheet() {
  document.getElementById('tearsheetModal').classList.remove('show');
}

// CRITICAL: Expose to window IMMEDIATELY so onclick handlers can find it
window.viewTearsheet = viewTearsheet;
window.closeTearsheet = closeTearsheet;
console.log('[INIT] Exposed tearsheet functions:', {
  viewTearsheet: typeof window.viewTearsheet,
  closeTearsheet: typeof window.closeTearsheet
});

function displayTearsheetMetrics(strategy) {
  const m = strategy.metrics || {};
  
  // Get buy & hold and benchmark metrics from the metrics object
  const stratMetrics = {
    total_return: strategy.total_return,
    cagr: strategy.cagr,
    sharpe: strategy.sharpe,
    sortino: strategy.sortino,
    vol: strategy.vol,
    maxdd: strategy.maxdd
  };
  
  const bhMetrics = {
    total_return: m.buyhold_total_return,
    cagr: m.buyhold_cagr,
    sharpe: m.buyhold_sharpe,
    sortino: m.buyhold_sortino,
    vol: m.buyhold_vol || m.vol, // Fallback
    maxdd: m.buyhold_maxdd
  };
  
  const benchMetrics = {
    total_return: m.bench_total_return,
    cagr: m.bench_cagr,
    sharpe: m.bench_sharpe,
    sortino: m.bench_sortino,
    vol: m.bench_vol || m.vol, // Fallback
    maxdd: m.bench_maxdd
  };
  
  function formatMetricValue(value, isPercent = false, higherIsBetter = true) {
    if (value === null || value === undefined || isNaN(value)) return '<span style="color: var(--text-secondary);">N/A</span>';
    
    const formatted = isPercent ? formatPercent(value) : formatNumber(value, 3);
    return `<span class="metric-value">${formatted}</span>`;
  }
  
  const metricsHtml = `
    <div class="metric-row metric-row-header">
      <div>Metric</div>
      <div style="text-align: right;">Strategy</div>
      <div style="text-align: right;">Buy & Hold</div>
      <div style="text-align: right;">Benchmark</div>
    </div>
    <div class="metric-row">
      <div class="metric-label">Total Return</div>
      ${formatMetricValue(stratMetrics.total_return, true)}
      ${formatMetricValue(bhMetrics.total_return, true)}
      ${formatMetricValue(benchMetrics.total_return, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">CAGR</div>
      ${formatMetricValue(stratMetrics.cagr, true)}
      ${formatMetricValue(bhMetrics.cagr, true)}
      ${formatMetricValue(benchMetrics.cagr, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sharpe</div>
      ${formatMetricValue(stratMetrics.sharpe, false)}
      ${formatMetricValue(bhMetrics.sharpe, false)}
      ${formatMetricValue(benchMetrics.sharpe, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Sortino</div>
      ${formatMetricValue(stratMetrics.sortino, false)}
      ${formatMetricValue(bhMetrics.sortino, false)}
      ${formatMetricValue(benchMetrics.sortino, false)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Volatility</div>
      ${formatMetricValue(stratMetrics.vol, true)}
      ${formatMetricValue(bhMetrics.vol, true)}
      ${formatMetricValue(benchMetrics.vol, true)}
    </div>
    <div class="metric-row">
      <div class="metric-label">Max Drawdown</div>
      ${formatMetricValue(stratMetrics.maxdd, true)}
      ${formatMetricValue(bhMetrics.maxdd, true)}
      ${formatMetricValue(benchMetrics.maxdd, true)}
    </div>
  `;
  
  document.getElementById('tearsheetMetrics').innerHTML = metricsHtml;
  
  // Display trade summary
  const tradeSummaryHtml = `
    <div class="simple-metric">
      <span class="simple-metric-label">Total Trades</span>
      <span class="simple-metric-value">${strategy.trades_total || 0}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Win Rate</span>
      <span class="simple-metric-value">${formatPercent(strategy.win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Net Win Rate</span>
      <span class="simple-metric-value">${formatPercent(strategy.net_win_rate)}</span>
    </div>
    <div class="simple-metric">
      <span class="simple-metric-label">Avg Trade P&L</span>
      <span class="simple-metric-value">$${formatNumber(strategy.avg_trade_pnl, 2)}</span>
    </div>
  `;
  
  document.getElementById('tradeSummary').innerHTML = tradeSummaryHtml;
}

async function displayCapmMetrics(strategy, benchmarkEquity) {
  const capmDiv = document.getElementById('tearsheetCapm');
  capmDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 11px;">Calculating...</div>';
  
  try {
    // Calculate CAPM for strategy vs benchmark
    const stratResult = await window.electronAPI.calculateCapm(strategy.equity, benchmarkEquity);
    
    if (!stratResult.success) {
      throw new Error(stratResult.error || 'CAPM calculation failed');
    }
    
    const stratCapm = stratResult.data;
    
    // Calculate CAPM for buy & hold vs benchmark if available
    let bhCapm = null;
    if (strategy.buyhold_equity) {
      const bhResult = await window.electronAPI.calculateCapm(strategy.buyhold_equity, benchmarkEquity);
      if (bhResult.success) {
        bhCapm = bhResult.data;
      }
    }
    
    const capmHtml = `
      <div class="metric-row header">
        <div></div>
        <div>Strategy</div>
        <div>Buy & Hold</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Alpha</div>
        <div>${formatPercent(stratCapm.alpha)}</div>
        <div>${bhCapm ? formatPercent(bhCapm.alpha) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Beta</div>
        <div>${formatNumber(stratCapm.beta, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.beta, 3) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">R²</div>
        <div>${formatNumber(stratCapm.r_squared, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.r_squared, 3) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Tracking Error</div>
        <div>${formatPercent(stratCapm.tracking_error)}</div>
        <div>${bhCapm ? formatPercent(bhCapm.tracking_error) : 'N/A'}</div>
      </div>
      <div class="metric-row">
        <div style="color: var(--text-secondary);">Info Ratio</div>
        <div>${formatNumber(stratCapm.information_ratio, 3)}</div>
        <div>${bhCapm ? formatNumber(bhCapm.information_ratio, 3) : 'N/A'}</div>
      </div>
    `;
    
    capmDiv.innerHTML = capmHtml;
    
  } catch (error) {
    console.error('CAPM calculation error:', error);
    capmDiv.innerHTML = `
      <div style="color: var(--negative); text-align: center; padding: 10px; font-size: 11px;">
        CAPM calculation failed
      </div>
    `;
  }
}

function displayEquityChart(strategyEquity, buyholdEquity, benchmarkEquity, events = []) {
  const traces = [];
  
  console.log('displayEquityChart called with:', {
    hasStrategy: !!strategyEquity,
    hasBuyHold: !!buyholdEquity,
    hasBenchmark: !!benchmarkEquity,
    eventsCount: events ? events.length : 0
  });
  
  // Strategy equity trace
  traces.push({
    x: strategyEquity.index,
    y: strategyEquity.data,
    type: 'scatter',
    mode: 'lines',
    name: strategyEquity.name || 'Strategy',
    line: { color: '#00aa55', width: 2.5 }
  });
  
  // Buy & Hold equity trace (same ticker)
  if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
    traces.push({
      x: buyholdEquity.index,
      y: buyholdEquity.data,
      type: 'scatter',
      mode: 'lines',
      name: buyholdEquity.name || 'Buy & Hold',
      line: { color: '#c8f0c8', width: 2.5 }
    });
  }
  
  // Benchmark equity trace (SPY)
  if (benchmarkEquity && benchmarkEquity.data && benchmarkEquity.data.length > 0) {
    traces.push({
      x: benchmarkEquity.index,
      y: benchmarkEquity.data,
      type: 'scatter',
      mode: 'lines',
      name: benchmarkEquity.name || 'Benchmark (SPY)',
      line: { color: '#808080', width: 2.5 }
    });
  }
  
  // Add trade markers
  if (events && events.length > 0) {
    // Create a map for faster lookup - need to normalize dates
    const equityMap = new Map();
    strategyEquity.index.forEach((dateStr, i) => {
      // Normalize to just date part (YYYY-MM-DD)
      const normalizedDate = new Date(dateStr).toISOString().split('T')[0];
      equityMap.set(normalizedDate, strategyEquity.data[i]);
    });
    
    // Separate buy and sell events
    const buyEvents = events.filter(e => e.type === 'buy');
    const sellEvents = events.filter(e => e.type === 'sell');
    
    console.log('Trade events:', { buyCount: buyEvents.length, sellCount: sellEvents.length });
    
    // Buy markers (green triangles pointing up)
    if (buyEvents.length > 0) {
      const buyX = [];
      const buyY = [];
      const buyText = [];
      const buyCustomdata = [];
      
      buyEvents.forEach(e => {
        const eventDate = new Date(e.ts).toISOString().split('T')[0];
        const equity = equityMap.get(eventDate);
        if (equity !== undefined) {
          buyX.push(e.ts);
          buyY.push(equity);
          buyText.push(e.qty || 0);
          buyCustomdata.push((e.price || 0).toFixed(2));
        }
      });
      
      if (buyX.length > 0) {
        traces.push({
          x: buyX,
          y: buyY,
          type: 'scatter',
          mode: 'markers',
          name: 'Buy',
          marker: {
            color: '#00cc55',
            size: 10,
            symbol: 'triangle-up',
            line: { color: '#ffffff', width: 1.5 }
          },
          hovertemplate: '<b>BUY</b><br>Date: %{x}<br>Qty: %{text}<br>Price: $%{customdata}<extra></extra>',
          text: buyText,
          customdata: buyCustomdata
        });
      }
    }
    
    // Sell markers (red triangles pointing down)
    if (sellEvents.length > 0) {
      const sellX = [];
      const sellY = [];
      const sellText = [];
      const sellCustomdata = [];
      
      sellEvents.forEach(e => {
        const eventDate = new Date(e.ts).toISOString().split('T')[0];
        const equity = equityMap.get(eventDate);
        if (equity !== undefined) {
          sellX.push(e.ts);
          sellY.push(equity);
          sellText.push(e.qty || 0);
          sellCustomdata.push((e.price || 0).toFixed(2));
        }
      });
      
      if (sellX.length > 0) {
        traces.push({
          x: sellX,
          y: sellY,
          type: 'scatter',
          mode: 'markers',
          name: 'Sell',
          marker: {
            color: '#ff4444',
            size: 10,
            symbol: 'triangle-down',
            line: { color: '#ffffff', width: 1.5 }
          },
          hovertemplate: '<b>SELL</b><br>Date: %{x}<br>Qty: %{text}<br>Price: $%{customdata}<extra></extra>',
          text: sellText,
          customdata: sellCustomdata
        });
      }
    }
  }
  
  const layout = {
    title: {
      text: 'Equity Curve Comparison',
      font: { color: '#e0e0e0', size: 18 }
    },
    xaxis: {
      title: 'Date',
      gridcolor: '#2a2a2a',
      griddash: 'dash',
      color: '#a0a0a0',
      showgrid: true
    },
    yaxis: {
      title: 'Portfolio Value ($)',
      gridcolor: '#2a2a2a',
      griddash: 'dash',
      color: '#a0a0a0',
      showgrid: true
    },
    plot_bgcolor: '#0a0a0a',
    paper_bgcolor: '#0a0a0a',
    font: { color: '#e0e0e0' },
    hovermode: 'closest',
    legend: {
      x: 0.01,
      y: 0.99,
      bgcolor: 'rgba(10, 10, 10, 0.9)',
      bordercolor: '#3e3e42',
      borderwidth: 1,
      font: { size: 12 }
    },
    margin: { l: 70, r: 40, t: 60, b: 60 },
    height: 550
  };
  
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };
  
  Plotly.newPlot('equityChart', traces, layout, config);
}

function displayTradeEvents(events) {
  const eventsDiv = document.getElementById('tradeEvents');
  
  if (!events || events.length === 0) {
    eventsDiv.innerHTML = '<p style="color: var(--text-secondary);">No trade events recorded</p>';
    return;
  }
  
  const eventsHtml = events.map(event => {
    // Parse timestamp - events use 'ts' field
    const date = new Date(event.ts).toLocaleDateString();
    // Events use 'type' field, not 'side'
    const type = event.type || 'unknown';
    const typeClass = type.toLowerCase();
    
    return `
      <div class="event-item">
        <span class="event-date">${date}</span>
        <span class="event-side ${typeClass}">${type.toUpperCase()}</span>
        <span class="event-details">
          ${event.qty || 0} shares @ $${formatNumber(event.price || 0, 2)}
          ${event.fee ? ` | Fee: $${formatNumber(event.fee, 2)}` : ''}
        </span>
      </div>
    `;
  }).join('');
  
  eventsDiv.innerHTML = eventsHtml;
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('tearsheetModal');
  if (e.target === modal) {
    closeTearsheet();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTearsheet();
  }
});

// Delete Run Function
async function deleteRun(runId, event) {
  // Stop propagation to prevent selecting the run
  event.stopPropagation();
  
  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete run "${runId}"?\n\nThis will permanently delete all associated strategies, trades, and results.`);
  
  if (!confirmed) {
    return;
  }
  
  setStatus('Deleting run...');
  
  try {
    const result = await window.electronAPI.deleteRun(runId);
    
    if (result.success) {
      setStatus(`Run "${runId}" deleted successfully`);
      
      // If this was the current run, clear the details panel
      if (currentRun === runId) {
        currentRun = null;
        document.getElementById('overviewTab').innerHTML = 
          '<div class="empty-state"><p>👈 Select a run to view details</p></div>';
        document.getElementById('strategiesContent').innerHTML = 
          '<div class="empty-state"><p>No strategies to display</p></div>';
        document.getElementById('portfolioContent').innerHTML = 
          '<div class="empty-state"><p>No portfolio data available</p></div>';
        document.getElementById('tradesContent').innerHTML = 
          '<div class="empty-state"><p>No trades to display</p></div>';
      }
      
      // Refresh the runs list
      await loadRuns();
    } else {
      setStatus(`Error deleting run: ${result.error}`, true);
      alert(`Failed to delete run: ${result.error}`);
    }
  } catch (error) {
    console.error('Error deleting run:', error);
    setStatus('Error deleting run', true);
    alert(`Failed to delete run: ${error.message}`);
  }
}

// CRITICAL: Expose to window IMMEDIATELY so onclick handlers can find it
window.deleteRun = deleteRun;
console.log('[INIT] Exposed deleteRun:', typeof window.deleteRun);

function displayVolMatchedChart(strategyEquity, comparisonEquity, chartElementId, comparisonName) {
  if (!comparisonEquity || !comparisonEquity.data || comparisonEquity.data.length === 0) {
    document.getElementById(chartElementId).innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-size: 11px;">Data not available</div>';
    return;
  }
  
  // Calculate returns
  const stratReturns = [];
  const compReturns = [];
  const dates = [];
  
  for (let i = 1; i < strategyEquity.data.length; i++) {
    const stratRet = (strategyEquity.data[i] - strategyEquity.data[i-1]) / strategyEquity.data[i-1];
    const compRet = (comparisonEquity.data[i] - comparisonEquity.data[i-1]) / comparisonEquity.data[i-1];
    
    if (!isNaN(stratRet) && !isNaN(compRet) && isFinite(stratRet) && isFinite(compRet)) {
      stratReturns.push(stratRet);
      compReturns.push(compRet);
      dates.push(strategyEquity.index[i]);
    }
  }
  
  // Calculate vol-matched returns (scale comparison to match strategy vol)
  const stratVol = Math.sqrt(stratReturns.reduce((sum, r) => sum + r * r, 0) / stratReturns.length);
  const compVol = Math.sqrt(compReturns.reduce((sum, r) => sum + r * r, 0) / compReturns.length);
  const scaleFactor = compVol > 0 ? stratVol / compVol : 1;
  
  const volMatchedReturns = compReturns.map(r => r * scaleFactor);
  
  // Cumulative returns
  let stratCum = [100000];
  let compCum = [100000];
  
  for (let i = 0; i < stratReturns.length; i++) {
    stratCum.push(stratCum[stratCum.length - 1] * (1 + stratReturns[i]));
    compCum.push(compCum[compCum.length - 1] * (1 + volMatchedReturns[i]));
  }
  
  const traces = [
    {
      x: [strategyEquity.index[0], ...dates],
      y: stratCum,
      type: 'scatter',
      mode: 'lines',
      name: 'Strategy',
      line: { color: '#00aa55', width: 2 }
    },
    {
      x: [strategyEquity.index[0], ...dates],
      y: compCum,
      type: 'scatter',
      mode: 'lines',
      name: `${comparisonName} (Vol-Matched)`,
      line: { color: comparisonName.includes('Benchmark') ? '#808080' : '#c8f0c8', width: 2 }
    }
  ];
  
  const layout = {
    xaxis: { showticklabels: false, gridcolor: '#2a2a2a', griddash: 'dash', color: '#a0a0a0' },
    yaxis: { gridcolor: '#2a2a2a', griddash: 'dash', color: '#a0a0a0', showticklabels: true },
    plot_bgcolor: '#0a0a0a',
    paper_bgcolor: '#0a0a0a',
    font: { color: '#e0e0e0', size: 10 },
    margin: { l: 45, r: 10, t: 10, b: 25 },
    showlegend: true,
    legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(10, 10, 10, 0.8)' },
    hovermode: 'x unified'
  };
  
  Plotly.newPlot(chartElementId, traces, layout, { displayModeBar: false, responsive: true });
}

function displayDrawdownChart(strategyEquity, buyholdEquity, benchmarkEquity) {
  const calculateDrawdown = (equity) => {
    const drawdown = [];
    let peak = equity.data[0];
    
    for (let i = 0; i < equity.data.length; i++) {
      if (equity.data[i] > peak) peak = equity.data[i];
      const dd = (equity.data[i] - peak) / peak;
      drawdown.push(dd);
    }
    
    return drawdown;
  };
  
  const traces = [];
  
  // Strategy drawdown
  traces.push({
    x: strategyEquity.index,
    y: calculateDrawdown(strategyEquity),
    type: 'scatter',
    mode: 'lines',
    name: 'Strategy',
    line: { color: '#00aa55', width: 2 },
    fill: 'tozeroy',
    fillcolor: 'rgba(0, 170, 85, 0.15)'
  });
  
  // Buy & Hold drawdown
  if (buyholdEquity && buyholdEquity.data && buyholdEquity.data.length > 0) {
    traces.push({
      x: buyholdEquity.index,
      y: calculateDrawdown(buyholdEquity),
      type: 'scatter',
      mode: 'lines',
      name: 'Buy & Hold',
      line: { color: '#c8f0c8', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(200, 240, 200, 0.1)'
    });
  }
  
  // Benchmark drawdown
  if (benchmarkEquity && benchmarkEquity.data && benchmarkEquity.data.length > 0) {
    traces.push({
      x: benchmarkEquity.index,
      y: calculateDrawdown(benchmarkEquity),
      type: 'scatter',
      mode: 'lines',
      name: 'Benchmark',
      line: { color: '#808080', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(128, 128, 128, 0.08)'
    });
  }
  
  const layout = {
    xaxis: { showticklabels: false, gridcolor: '#2a2a2a', griddash: 'dash', color: '#999999' },
    yaxis: { 
      gridcolor: '#2a2a2a',
      griddash: 'dash',
      color: '#999999',
      tickformat: '.0%',
      showticklabels: true
    },
    plot_bgcolor: '#0a0a0a',
    paper_bgcolor: '#0a0a0a',
    font: { color: '#e0e0e0', size: 10 },
    margin: { l: 45, r: 10, t: 10, b: 25 },
    showlegend: true,
    legend: { x: 0.02, y: 0.02, font: { size: 9 }, bgcolor: 'rgba(10, 10, 10, 0.8)' },
    hovermode: 'x unified'
  };
  
  Plotly.newPlot('drawdownChart', traces, layout, { displayModeBar: false, responsive: true });
}

// =====================================================
// POLYGON TREEMAP - S&P 500 Live Market Map
// =====================================================

let treemapData = new Map();
let lastUpdateTime = null;

// Connect to Polygon on page load
window.electronAPI.polygonConnect().then(result => {
  console.log('Polygon connection initiated:', result);
});

// Listen for updates
window.electronAPI.onPolygonUpdate((data) => {
  treemapData.set(data.ticker, data);
  lastUpdateTime = new Date();
  updateLastUpdateDisplay();
  
  // Redraw treemap periodically (every 5 seconds to avoid too frequent redraws)
  if (!window.treemapUpdateScheduled) {
    window.treemapUpdateScheduled = true;
    setTimeout(() => {
      drawTreemap();
      window.treemapUpdateScheduled = false;
    }, 5000);
  }
});

// Listen for initial data load complete
window.electronAPI.onPolygonInitialLoad((data) => {
  console.log(`Initial data loaded: ${data.count} stocks`);
  drawTreemap(); // Draw immediately when initial data arrives
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
  drawTreemap();
});

// Group-by selector
document.getElementById('treemapGroupBy')?.addEventListener('change', () => {
  drawTreemap();
});

function updateLastUpdateDisplay() {
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
}

// Update the "last updated" text every second
setInterval(updateLastUpdateDisplay, 1000);

function getColorForPercent(percent) {
  if (percent === null || percent === undefined) return '#404040';
  
  // Use theme colors for positive (green) and negative (red)
  if (percent > 0) {
    const intensity = Math.min(Math.abs(percent) / 3, 1); // Cap at 3% for full intensity
    const baseColor = getPositiveColor();
    
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
    const baseColor = getNegativeColor();
    
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
}

// Sector data (must match backend)
const SP500_BY_SECTOR = {
  'Technology': ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'CSCO', 'ACN', 'AMD', 'INTC', 'IBM', 'QCOM', 'INTU', 'TXN', 'NOW', 'AMAT', 'ADI', 'LRCX', 'MU', 'SNOW', 'PANW', 'PLTR', 'CRWD', 'ADSK', 'CDNS', 'SNPS', 'MCHP', 'KLAC', 'FTNT', 'NXPI', 'ANSS', 'HPQ', 'APH', 'MPWR', 'NTAP', 'IT', 'GLW', 'ZBRA', 'KEYS', 'GDDY', 'TYL', 'WDC', 'STX', 'GEN', 'SWKS', 'JNPR', 'FFIV', 'AKAM', 'ENPH'],
  'Healthcare': ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN', 'ISRG', 'SYK', 'VRTX', 'REGN', 'CVS', 'CI', 'ELV', 'ZTS', 'BSX', 'BDX', 'HUM', 'GILD', 'MDT', 'BMY', 'IQV', 'EW', 'DXCM', 'IDXX', 'HCA', 'RMD', 'A', 'GEHC', 'CNC', 'MRNA', 'ALGN', 'WAT', 'MTD', 'BIIB', 'ZBH', 'ILMN', 'STE', 'LH', 'RVTY', 'HOLX', 'PODD', 'DGX', 'MOH', 'BAX', 'CRL', 'TFX', 'VTRS'],
  'Financial': ['JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'BX', 'AXP', 'BLK', 'SPGI', 'C', 'SCHW', 'CB', 'PGR', 'MMC', 'PLD', 'ICE', 'CME', 'AON', 'USB', 'TFC', 'PNC', 'AJG', 'BK', 'COF', 'FI', 'AFL', 'AIG', 'MET', 'ALL', 'TRV', 'PRU', 'DFS', 'AMP', 'HIG', 'MSCI', 'WTW', 'MTB', 'TROW', 'STT', 'BRO', 'SYF', 'FITB', 'HBAN', 'RF', 'CFG', 'KEY', 'NTRS', 'EG'],
  'Consumer Discretionary': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'TJX', 'BKNG', 'AZO', 'CMG', 'ORLY', 'GM', 'MAR', 'HLT', 'F', 'ROST', 'YUM', 'DHI', 'LEN', 'ABNB', 'LULU', 'GRMN', 'DECK', 'EBAY', 'TSCO', 'POOL', 'CCL', 'RCL', 'LVS', 'WYNN', 'MGM', 'NCLH', 'EXPE', 'ULTA', 'DRI', 'GPC', 'BBY', 'KMX', 'TPR', 'RL', 'APTV', 'WHR', 'NVR', 'PHM', 'BWA', 'MHK', 'HAS', 'LKQ', 'VFC'],
  'Communication Services': ['GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'T', 'TMUS', 'VZ', 'CHTR', 'EA', 'TTWO', 'OMC', 'IPG', 'NWSA', 'FOX', 'FOXA', 'MTCH', 'PARA', 'LYV', 'WBD'],
  'Industrials': ['CAT', 'BA', 'RTX', 'UPS', 'HON', 'GE', 'ETN', 'LMT', 'DE', 'UNP', 'ADP', 'MMM', 'NOC', 'SLB', 'EMR', 'ITW', 'GD', 'TDG', 'PH', 'WM', 'CSX', 'NSC', 'CARR', 'PCAR', 'FDX', 'JCI', 'TT', 'CTAS', 'CMI', 'EOG', 'RSG', 'ODFL', 'PAYX', 'VRSK', 'IR', 'AXON', 'DAL', 'UAL', 'LUV', 'ALK', 'JBHT', 'EXPD', 'CHRW', 'URI', 'FAST', 'HUBB', 'AME', 'ROK', 'DOV', 'XYL'],
  'Consumer Staples': ['WMT', 'PG', 'COST', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'GIS', 'KMB', 'STZ', 'SYY', 'KHC', 'TSN', 'ADM', 'HSY', 'K', 'CHD', 'CAG', 'MKC', 'CPB', 'HRL', 'SJM', 'LW', 'TAP', 'KDP', 'MNST', 'DG', 'DLTR', 'EL', 'CLX'],
  'Energy': ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'WMB', 'KMI', 'HES', 'BKR', 'HAL', 'DVN', 'FANG', 'TRGP', 'EQT', 'MRO', 'OKE', 'CTRA', 'APA'],
  'Utilities': ['NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'VST', 'PCG', 'PEG', 'EXC', 'XEL', 'ED', 'EIX', 'WEC', 'AWK', 'DTE', 'PPL', 'ES', 'FE', 'AEE', 'ATO', 'CMS', 'CNP', 'NI', 'LNT', 'EVRG', 'PNW', 'AES', 'ETR'],
  'Real Estate': ['PLD', 'AMT', 'EQIX', 'PSA', 'WELL', 'SPG', 'DLR', 'O', 'CCI', 'VICI', 'SBAC', 'EXR', 'AVB', 'EQR', 'INVH', 'VTR', 'MAA', 'ARE', 'DOC', 'UDR', 'ESS', 'BXP', 'CPT', 'CBRE', 'HST', 'REG', 'KIM', 'FRT', 'VNO'],
  'Materials': ['LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM', 'CTVA', 'DD', 'NUE', 'DOW', 'VMC', 'MLM', 'BALL', 'STLD', 'AVY', 'ALB', 'AMCR', 'PKG', 'IP', 'CE', 'CF', 'MOS', 'EMN', 'FMC', 'IFF']
};

function getSectorForTicker(ticker) {
  try {
    for (const [sector, tickers] of Object.entries(SP500_BY_SECTOR)) {
      if (tickers && Array.isArray(tickers) && tickers.includes(ticker)) {
        return sector;
      }
    }
  } catch (error) {
    console.error('Error getting sector for ticker:', ticker, error);
  }
  return 'Other';
}

// Navigate to charting page with a specific ticker
function navigateToChart(ticker) {
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
    selectChartTicker(ticker);
  }, 100);
}

function drawTreemap() {
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
  
  // Get container dimensions (account for padding)
  const width = container.clientWidth - 20;
  const height = container.clientHeight - 20;
  
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
      const sector = getSectorForTicker(d.ticker);
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
      .attr('fill', d => getColorForPercent(d.data.percent))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        // Navigate to charting page with this ticker
        event.stopPropagation();
        navigateToChart(d.data.name);
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
      .attr('fill', d => getColorForPercent(d.data.percent))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        // Navigate to charting page with this ticker
        event.stopPropagation();
        navigateToChart(d.data.name);
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
}

// Redraw on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('homePage').classList.contains('active')) {
      drawTreemap();
    }
  }, 250);
});

// Initial draw when home page becomes active
const homePageObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.classList.contains('active') && mutation.target.id === 'homePage') {
      setTimeout(drawTreemap, 100); // Small delay to ensure container is rendered
    }
  });
});

const homePage = document.getElementById('homePage');
if (homePage) {
  homePageObserver.observe(homePage, { attributes: true, attributeFilter: ['class'] });
}

// =====================================================
// WATCHLISTS FUNCTIONALITY
// =====================================================

let watchlists = [];
let currentWatchlist = null;
let watchlistStockData = new Map();
let editingWatchlistId = null;

// Load watchlists from localStorage
function loadWatchlists() {
  const stored = localStorage.getItem('watchlists');
  if (stored) {
    try {
      watchlists = JSON.parse(stored);
    } catch (error) {
      console.error('Error loading watchlists:', error);
      watchlists = [];
    }
  }
  displayWatchlists();
}

// Save watchlists to localStorage
function saveWatchlistsToStorage() {
  localStorage.setItem('watchlists', JSON.stringify(watchlists));
}

// Display watchlists in sidebar
function displayWatchlists() {
  const listEl = document.getElementById('watchlistsList');
  const searchQuery = document.getElementById('watchlistSearch')?.value.toLowerCase() || '';
  
  const filtered = watchlists.filter(w => 
    w.name.toLowerCase().includes(searchQuery) || 
    (w.description && w.description.toLowerCase().includes(searchQuery))
  );
  
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No watchlists ${searchQuery ? 'found' : 'yet'}</p>
        <p style="font-size: 12px; color: #666;">${searchQuery ? 'Try a different search' : 'Create your first watchlist'}</p>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = filtered.map(w => `
    <div class="watchlist-item ${currentWatchlist?.id === w.id ? 'active' : ''}" data-id="${w.id}">
      <div class="watchlist-item-name">${escapeHtml(w.name)}</div>
      <div class="watchlist-item-info">${w.tickers.length} stocks</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.watchlist-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectWatchlist(id);
    });
  });
}

// Select a watchlist
function selectWatchlist(id) {
  currentWatchlist = watchlists.find(w => w.id === id);
  if (!currentWatchlist) return;
  
  // Update UI
  displayWatchlists(); // Refresh active state
  document.getElementById('watchlistEmpty').style.display = 'none';
  document.getElementById('watchlistContent').style.display = 'flex';
  document.getElementById('watchlistTreemapView').style.display = 'none';
  
  document.getElementById('watchlistName').textContent = currentWatchlist.name;
  document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
  
  // Load stock data for this watchlist
  loadWatchlistStockData();
  displayWatchlistStocks();
}

// Load stock data for current watchlist
function loadWatchlistStockData() {
  if (!currentWatchlist) return;
  
  // Get data from main treemap data or fetch fresh
  currentWatchlist.tickers.forEach(ticker => {
    if (treemapData.has(ticker)) {
      watchlistStockData.set(ticker, treemapData.get(ticker));
    }
  });
}

// Display stocks in table
function displayWatchlistStocks() {
  const tbody = document.getElementById('watchlistTableBody');
  
  if (!currentWatchlist || currentWatchlist.tickers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
          No stocks in this watchlist. Click "Add Stock" to get started.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = currentWatchlist.tickers.map(ticker => {
    const data = watchlistStockData.get(ticker);
    
    if (!data) {
      return `
        <tr>
          <td class="stock-ticker">${ticker}</td>
          <td colspan="5" style="color: #666;">Loading...</td>
          <td><button class="remove-stock-btn" onclick="removeStockFromWatchlist('${ticker}')">Remove</button></td>
        </tr>
      `;
    }
    
    const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
    const changeSign = data.changePercent >= 0 ? '+' : '';
    
    return `
      <tr>
        <td class="stock-ticker">${ticker}</td>
        <td class="${changeClass}">$${data.close ? data.close.toFixed(2) : 'N/A'}</td>
        <td class="${changeClass}">${changeSign}${data.change ? data.change.toFixed(2) : '0.00'}</td>
        <td class="${changeClass}">${changeSign}${data.changePercent ? data.changePercent.toFixed(2) : '0.00'}%</td>
        <td>${data.volume ? (data.volume / 1000000).toFixed(1) + 'M' : 'N/A'}</td>
        <td class="${changeClass}">${data.marketCap ? '$' + (data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}</td>
        <td><button class="remove-stock-btn" onclick="removeStockFromWatchlist('${ticker}')">Remove</button></td>
      </tr>
    `;
  }).join('');
}

// Create watchlist modal
document.getElementById('createWatchlistBtn')?.addEventListener('click', () => {
  editingWatchlistId = null;
  document.getElementById('watchlistModalTitle').textContent = 'Create Watchlist';
  document.getElementById('watchlistNameInput').value = '';
  document.getElementById('watchlistDescInput').value = '';
  document.getElementById('watchlistModal').style.display = 'flex';
  document.getElementById('watchlistNameInput').focus();
});

// Edit watchlist
document.getElementById('editWatchlistBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  editingWatchlistId = currentWatchlist.id;
  document.getElementById('watchlistModalTitle').textContent = 'Edit Watchlist';
  document.getElementById('watchlistNameInput').value = currentWatchlist.name;
  document.getElementById('watchlistDescInput').value = currentWatchlist.description || '';
  document.getElementById('watchlistModal').style.display = 'flex';
  document.getElementById('watchlistNameInput').focus();
});

// Save watchlist
document.getElementById('saveWatchlistBtn')?.addEventListener('click', () => {
  const name = document.getElementById('watchlistNameInput').value.trim();
  const description = document.getElementById('watchlistDescInput').value.trim();
  
  if (!name) {
    alert('Please enter a watchlist name');
    return;
  }
  
  if (editingWatchlistId) {
    // Edit existing
    const watchlist = watchlists.find(w => w.id === editingWatchlistId);
    if (watchlist) {
      watchlist.name = name;
      watchlist.description = description;
    }
  } else {
    // Create new
    const newWatchlist = {
      id: Date.now().toString(),
      name: name,
      description: description,
      tickers: [],
      createdAt: Date.now()
    };
    watchlists.push(newWatchlist);
    currentWatchlist = newWatchlist;
    selectWatchlist(newWatchlist.id);
  }
  
  saveWatchlistsToStorage();
  displayWatchlists();
  document.getElementById('watchlistModal').style.display = 'none';
});

// Delete watchlist
document.getElementById('deleteWatchlistBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  if (confirm(`Are you sure you want to delete "${currentWatchlist.name}"?`)) {
    watchlists = watchlists.filter(w => w.id !== currentWatchlist.id);
    saveWatchlistsToStorage();
    currentWatchlist = null;
    
    document.getElementById('watchlistEmpty').style.display = 'flex';
    document.getElementById('watchlistContent').style.display = 'none';
    displayWatchlists();
  }
});

// Add stock modal
document.getElementById('addStockBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  document.getElementById('stockTickersInput').value = '';
  document.getElementById('addStockModal').style.display = 'flex';
  document.getElementById('stockTickersInput').focus();
});

// Add stocks to watchlist
document.getElementById('addStocksBtn')?.addEventListener('click', () => {
  if (!currentWatchlist) return;
  
  const input = document.getElementById('stockTickersInput').value.trim();
  if (!input) {
    alert('Please enter at least one ticker symbol');
    return;
  }
  
  const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
  const newTickers = tickers.filter(t => !currentWatchlist.tickers.includes(t));
  
  if (newTickers.length === 0) {
    alert('All tickers are already in this watchlist');
    return;
  }
  
  currentWatchlist.tickers.push(...newTickers);
  saveWatchlistsToStorage();
  
  document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
  loadWatchlistStockData();
  displayWatchlistStocks();
  displayWatchlists();
  
  document.getElementById('addStockModal').style.display = 'none';
});

// Remove stock from watchlist
window.removeStockFromWatchlist = function(ticker) {
  if (!currentWatchlist) return;
  
  if (confirm(`Remove ${ticker} from this watchlist?`)) {
    currentWatchlist.tickers = currentWatchlist.tickers.filter(t => t !== ticker);
    saveWatchlistsToStorage();
    
    document.getElementById('watchlistCount').textContent = `${currentWatchlist.tickers.length} stocks`;
    watchlistStockData.delete(ticker);
    displayWatchlistStocks();
    displayWatchlists();
  }
};

// View watchlist as treemap
document.getElementById('viewTreemapBtn')?.addEventListener('click', () => {
  if (!currentWatchlist || currentWatchlist.tickers.length === 0) {
    alert('Add stocks to this watchlist first');
    return;
  }
  
  document.getElementById('watchlistContent').style.display = 'none';
  document.getElementById('watchlistTreemapView').style.display = 'flex';
  document.getElementById('treemapWatchlistName').textContent = currentWatchlist.name;
  
  setTimeout(() => drawWatchlistTreemap(), 100);
});

// Back to list
document.getElementById('backToListBtn')?.addEventListener('click', () => {
  document.getElementById('watchlistTreemapView').style.display = 'none';
  document.getElementById('watchlistContent').style.display = 'flex';
});

// Draw watchlist treemap
function drawWatchlistTreemap() {
  try {
    const container = document.getElementById('watchlistTreemapContainer');
    if (!container) return;
    
    const dataArray = Array.from(watchlistStockData.values()).filter(d => d.changePercent !== null);
    
    if (dataArray.length === 0) {
      const svg = d3.select('#watchlistTreemap');
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', '50%')
        .attr('y', '50%')
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '18px')
        .text('Loading watchlist data...');
      return;
    }
    
    d3.select('#watchlistTreemap').selectAll('*').remove();
    
    const width = container.clientWidth - 20;
    const height = container.clientHeight - 20;
    
    const svg = d3.select('#watchlistTreemap')
      .attr('width', width)
      .attr('height', height);
    
    const sizeBy = document.getElementById('watchlistTreemapSizeBy')?.value || 'marketcap';
    
    const root = d3.hierarchy({
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
    
    const treemap = d3.treemap()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .round(true);
    
    treemap(root);
    
    const cells = svg.selectAll('.stock-cell')
      .data(root.leaves())
      .join('g')
      .attr('class', 'stock-cell')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);
    
    cells.append('rect')
      .attr('class', 'treemap-cell')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => getColorForPercent(d.data.percent))
      .attr('rx', 2)
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
      
      if (cellWidth > 50 && cellHeight > 35) {
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
      } else if (cellWidth > 30 && cellHeight > 25) {
        g.append('text')
          .attr('class', 'treemap-text ticker')
          .attr('x', cellWidth / 2)
          .attr('y', cellHeight / 2)
          .style('font-size', '11px')
          .text(d.data.name);
      }
    });
    
    document.getElementById('watchlistLastUpdate').textContent = `${dataArray.length} stocks loaded`;
    document.getElementById('watchlistLastUpdate').style.color = '#00aa55';
    
  } catch (error) {
    console.error('Error drawing watchlist treemap:', error);
  }
}

// Watchlist treemap size selector
document.getElementById('watchlistTreemapSizeBy')?.addEventListener('change', () => {
  drawWatchlistTreemap();
});

// Search watchlists
document.getElementById('watchlistSearch')?.addEventListener('input', () => {
  displayWatchlists();
});

// Update watchlist stock data when main treemap updates
const originalOnPolygonUpdate = window.electronAPI.onPolygonUpdate;
window.electronAPI.onPolygonUpdate((data) => {
  // Call original handler
  treemapData.set(data.ticker, data);
  lastUpdateTime = new Date();
  updateLastUpdateDisplay();
  
  if (!window.treemapUpdateScheduled) {
    window.treemapUpdateScheduled = true;
    setTimeout(() => {
      drawTreemap();
      window.treemapUpdateScheduled = false;
    }, 5000);
  }
  
  // Update watchlist data if ticker is in current watchlist
  if (currentWatchlist && currentWatchlist.tickers.includes(data.ticker)) {
    watchlistStockData.set(data.ticker, data);
    
    // Update table if in list view
    if (document.getElementById('watchlistContent').style.display === 'flex') {
      displayWatchlistStocks();
    }
    
    // Update treemap if in treemap view
    if (document.getElementById('watchlistTreemapView').style.display === 'flex') {
      if (!window.watchlistTreemapUpdateScheduled) {
        window.watchlistTreemapUpdateScheduled = true;
        setTimeout(() => {
          drawWatchlistTreemap();
          window.watchlistTreemapUpdateScheduled = false;
        }, 5000);
      }
    }
  }
  
  // Update chart if this is the currently selected ticker
  if (currentChartTicker === data.ticker) {
    // Update live info panel
    updateChartLiveInfo(data.ticker);
    
    // Update chart ticker list if visible
    const tickerItem = document.querySelector(`.ticker-list-item[data-ticker="${data.ticker}"]`);
    if (tickerItem) {
      const priceEl = tickerItem.querySelector('.ticker-list-price');
      if (priceEl) {
        priceEl.textContent = `$${data.close.toFixed(2)}`;
        const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
        priceEl.className = `ticker-list-price ${changeClass}`;
      }
    }
    
    // Update live candle if enabled and chart is visible
    if (liveUpdateEnabled && currentChartData && document.getElementById('chartingPage').classList.contains('active')) {
      const now = Date.now();
      // Update chart every 30 seconds max to avoid too frequent redraws
      if (now - lastChartUpdate > 30000) {
        lastChartUpdate = now;
        
        // For intraday charts, we could append the latest data
        // For now, we'll just update the last bar with live data
        const interval = document.getElementById('chartInterval')?.value;
        if (interval !== 'day') {
          updateLiveCandle(data);
        }
      }
    }
  }
});

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Modal close handlers
document.getElementById('cancelWatchlistBtn')?.addEventListener('click', () => {
  document.getElementById('watchlistModal').style.display = 'none';
});

document.getElementById('cancelAddStockBtn')?.addEventListener('click', () => {
  document.getElementById('addStockModal').style.display = 'none';
});

// Click outside modal to close
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// Initialize watchlists on page load
loadWatchlists();

// =====================================================
// CHART TAB SYSTEM
// =====================================================

let chartTabs = [];
let activeChartTabId = null;
let nextChartTabId = 1;

class ChartTab {
  constructor(id) {
    this.id = id;
    this.ticker = null;
    this.timeframe = '1Y';
    this.interval = 'day';
    this.chartType = 'candlestick';
    this.liveUpdateEnabled = true;
    this.extendedHoursEnabled = true;
    this.crosshairLocked = false;
    this.chartData = null;
    this.liveData = new Map();
    this.overlays = []; // Array to store overlay tickers
    
    // Create tab element
    this.tabElement = this.createTabElement();
    
    // Create content element from template
    this.contentElement = this.createContentElement();
    
    // Initialize event listeners for this tab's controls
    this.initializeControls();
    
    // Validate initial interval for the default 1Y timeframe
    this.validateIntervalForTimeframe();
  }
  
  createTabElement() {
    const tab = document.createElement('div');
    tab.className = 'chart-tab';
    tab.dataset.tabId = this.id;
    tab.innerHTML = `
      <span class="chart-tab-label">New Chart</span>
      <button class="chart-tab-close">×</button>
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
    
    // Live updates
    const liveUpdateToggle = content.querySelector('.chart-live-update-toggle');
    liveUpdateToggle.addEventListener('change', (e) => {
      this.liveUpdateEnabled = e.target.checked;
    });
    
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
  
  setTicker(ticker) {
    this.ticker = ticker;
    this.tabElement.querySelector('.chart-tab-label').textContent = ticker;
    this.updateLiveInfo();
    this.loadChart();
  }
  
  updateLiveInfo() {
    if (!this.ticker) return;
    
    const content = this.contentElement;
    const liveInfoBar = content.querySelector('.chart-live-info-top');
    const data = treemapData.get(this.ticker);
    
    if (data) {
      liveInfoBar.style.display = 'flex';
      content.querySelector('.chart-live-ticker').textContent = this.ticker;
      content.querySelector('.chart-live-price').textContent = `$${data.close.toFixed(2)}`;
      
      const changeEl = content.querySelector('.chart-live-change');
      const changePercent = data.changePercent;
      changeEl.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
      changeEl.style.backgroundColor = changePercent >= 0 ? '#00aa55' : '#ff4444';
      changeEl.style.color = 'white';
      
      content.querySelector('.chart-live-volume').textContent = (data.volume / 1e6).toFixed(2) + 'M';
      content.querySelector('.chart-live-marketcap').textContent = (data.marketCap / 1e9).toFixed(2) + 'B';
    } else {
      liveInfoBar.style.display = 'none';
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
    
    // Update loading message if retrying
    if (retryCount > 0) {
      loadingEl.innerHTML = `<p>Loading chart data... (Retry ${retryCount}/3)</p>`;
    } else {
      loadingEl.innerHTML = `<p>Loading chart data...</p>`;
    }
    
    try {
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
      
      // Show error message
      const errorMsg = isTimeoutError 
        ? 'Connection timeout. Please check your internet connection and try again.'
        : error.message;
      
      chartCanvas.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ff4444;">
          <h3>Failed to load chart</h3>
          <p style="color: #999; margin-top: 10px;">${errorMsg}</p>
          <button onclick="getActiveChartTab()?.loadChart()" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: var(--accent-blue);
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
          ">Retry</button>
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
    
    // Get theme colors for base candlestick
    const positiveColor = getPositiveColor();
    const negativeColor = getNegativeColor();
    
    const candlestickTrace = {
      type: 'candlestick',
      x: dates,
      open: open,
      high: high,
      low: low,
      close: close,
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
      text: dates.map((date, i) => 
        `${date}<br>O: $${open[i].toFixed(2)}<br>H: $${high[i].toFixed(2)}<br>L: $${low[i].toFixed(2)}<br>C: $${close[i].toFixed(2)}`
      )
    };
    
    const volumeTrace = {
      type: 'bar',
      x: dates,
      y: volume,
      name: 'Volume',
      marker: {
        color: volume.map((v, i) => close[i] >= open[i] ? '#00aa5533' : '#e74c3c33')
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
        tickprefix: '$',
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
      hovermode: 'closest',
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
    
    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      displaylogo: false,
      modeBarButtonsToAdd: [{
        name: 'Pan',
        icon: Plotly.Icons.pan,
        click: function(gd) {
          Plotly.relayout(gd, 'dragmode', 'pan');
        }
      }]
    };
    
    let mainTrace;
    if (this.chartType === 'line') {
      mainTrace = {
        type: 'scatter',
        mode: 'lines',
        x: dates,
        y: close,
        name: this.ticker,
        line: { color: '#4a9eff', width: 2 },
        xaxis: 'x',
        yaxis: 'y',
        hovertemplate: '%{x}<br>Close: $%{y:.2f}<extra></extra>'
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
        
        let overlayTrace;
        
        if (this.chartType === 'line') {
          overlayTrace = {
            type: 'scatter',
            mode: 'lines',
            x: overlayDates,
            y: overlayClose,
            name: overlay.ticker,
            line: { color: overlay.color, width: 2 },
            xaxis: 'x',
            yaxis: 'y',
            hovertemplate: '%{x}<br>' + overlay.ticker + ': $%{y:.2f}<extra></extra>',
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
            open: overlayOpen,
            high: overlayHigh,
            low: overlayLow,
            close: overlayClose,
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
            text: overlayDates.map((date, i) => 
              `${overlay.ticker}<br>${date}<br>O: $${overlayOpen[i].toFixed(2)}<br>H: $${overlayHigh[i].toFixed(2)}<br>L: $${overlayLow[i].toFixed(2)}<br>C: $${overlayClose[i].toFixed(2)}`
            ),
            showlegend: true
          };
        }
        
        traces.push(overlayTrace);
      });
    }
    
    Plotly.newPlot(chartCanvas, traces, layout, config);
    
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
        <button class="overlay-remove-btn" data-ticker="${ticker}">×</button>
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
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#feca57', '#ff9ff3',
      '#54a0ff', '#48dbfb', '#00d2d3', '#1dd1a1', '#10ac84',
      '#ee5a6f', '#c44569', '#f368e0', '#ff9ff3', '#a29bfe'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
}

function createChartTab() {
  const tab = new ChartTab(nextChartTabId++);
  chartTabs.push(tab);
  
  // Add to DOM
  document.getElementById('chartTabsContainer').appendChild(tab.tabElement);
  document.getElementById('chartTabContents').appendChild(tab.contentElement);
  
  // Activate the new tab
  activateChartTab(tab.id);
  
  return tab;
}

function activateChartTab(tabId) {
  activeChartTabId = tabId;
  
  chartTabs.forEach(tab => {
    const isActive = tab.id === tabId;
    tab.tabElement.classList.toggle('active', isActive);
    tab.contentElement.classList.toggle('active', isActive);
  });
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

// New tab button
document.getElementById('chartNewTabBtn')?.addEventListener('click', () => {
  createChartTab();
});

// Create initial tab
setTimeout(() => {
  if (chartTabs.length === 0) {
    createChartTab();
  }
  // Show sidebar toggle button initially
  sidebarToggleBtn?.classList.add('visible');
}, 100);

// =====================================================
// CANDLESTICK CHART FUNCTIONALITY (Legacy - for reference)
// =====================================================

// Chart normalization state
let chartNormalized = false;
const normalizeCheckbox = document.querySelector('.chart-normalize-checkbox');
if (normalizeCheckbox) {
  normalizeCheckbox.checked = false;
  normalizeCheckbox.addEventListener('change', () => {
    chartNormalized = normalizeCheckbox.checked;
    rerenderMainChart();
  });
}

let currentChartData = null;
let currentChartTicker = null;
let liveChartData = new Map(); // Store live candle data
let liveUpdateEnabled = true;
let lastChartUpdate = Date.now();

// Sidebar toggle functionality
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const closeSidebarBtn = document.getElementById('closeSidebar');
const chartSidebar = document.getElementById('chartSidebar');

sidebarToggleBtn?.addEventListener('click', () => {
  chartSidebar?.classList.remove('collapsed');
  sidebarToggleBtn?.classList.remove('visible');
});

closeSidebarBtn?.addEventListener('click', () => {
  chartSidebar?.classList.add('collapsed');
  sidebarToggleBtn?.classList.add('visible');
});

// Initialize chart watchlist dropdown
function initializeChartWatchlists() {
  const select = document.getElementById('chartWatchlistSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Choose a watchlist...</option>';
  
  watchlists.forEach(w => {
    const option = document.createElement('option');
    option.value = w.id;
    option.textContent = `${w.name} (${w.tickers.length})`;
    select.appendChild(option);
  });
}

// Handle watchlist selection
document.getElementById('chartWatchlistSelect')?.addEventListener('change', (e) => {
  const watchlistId = e.target.value;
  if (!watchlistId) {
    document.getElementById('chartTickerList').innerHTML = `
      <div class="empty-state" style="padding: 20px; font-size: 12px;">
        Select a watchlist to see tickers
      </div>
    `;
    return;
  }
  
  const watchlist = watchlists.find(w => w.id === watchlistId);
  if (!watchlist || watchlist.tickers.length === 0) {
    document.getElementById('chartTickerList').innerHTML = `
      <div class="empty-state" style="padding: 20px; font-size: 12px;">
        No tickers in this watchlist
      </div>
    `;
    return;
  }
  
  // Display tickers
  const tickerListHtml = watchlist.tickers.map(ticker => {
    const data = treemapData.get(ticker);
    const priceText = data ? `$${data.close.toFixed(2)}` : 'Loading...';
    const changeClass = data && data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
    
    return `
      <div class="ticker-list-item ${currentChartTicker === ticker ? 'active' : ''}" data-ticker="${ticker}">
        <span class="ticker-list-symbol">${ticker}</span>
        <span class="ticker-list-price ${changeClass}">${priceText}</span>
      </div>
    `;
  }).join('');
  
  document.getElementById('chartTickerList').innerHTML = tickerListHtml;
  
  // Add click handlers
  document.querySelectorAll('.ticker-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticker = item.dataset.ticker;
      selectChartTicker(ticker);
    });
  });
});

// Ticker input button
document.getElementById('chartTickerBtn')?.addEventListener('click', () => {
  const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
  if (ticker) {
    selectChartTicker(ticker);
  }
});

// Allow Enter key in ticker input
document.getElementById('chartTickerInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('chartTickerBtn')?.click();
  }
});

// Select a ticker for charting (updated for tabs)
async function selectChartTicker(ticker) {
  const activeTab = getActiveChartTab();
  if (activeTab) {
    activeTab.setTicker(ticker);
    // Close sidebar after selection
    chartSidebar?.classList.add('collapsed');
    sidebarToggleBtn?.classList.add('visible');
  }
}

// Legacy function (keeping for now)
async function selectChartTickerLegacy(ticker) {
  currentChartTicker = ticker;
  document.getElementById('chartTickerInput').value = ticker;
  
  // Update active state in ticker list
  document.querySelectorAll('.ticker-list-item').forEach(item => {
    if (item.dataset.ticker === ticker) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Show top info bar
  document.getElementById('chartLiveInfoTop').style.display = 'flex';
  document.getElementById('chartLiveTickerTop').textContent = ticker;
  
  // Update live info immediately
  updateChartLiveInfo(ticker);
  
  // Validate and adjust interval based on timeframe
  validateIntervalForTimeframe();
  
  // Load historical chart
  const timeframe = document.getElementById('chartTimeframe')?.value || '1Y';
  const interval = document.getElementById('chartInterval')?.value || 'day';
  await loadCandlestickChart(ticker, timeframe, interval);
}

// Update live info panel
function updateChartLiveInfo(ticker) {
  const data = treemapData.get(ticker);
  if (!data) return;
  
  // Log the calculation details
  console.log(`[LIVE INFO] ${ticker}:`);
  console.log(`  Current Price: $${data.close?.toFixed(2)}`);
  console.log(`  Previous Close: $${data.prevClose?.toFixed(2)}`);
  console.log(`  Change: $${data.change?.toFixed(2)}`);
  console.log(`  Change %: ${data.changePercent?.toFixed(2)}%`);
  
  const changeClass = data.changePercent >= 0 ? 'stock-change-positive' : 'stock-change-negative';
  const changeSign = data.changePercent >= 0 ? '+' : '';
  const priceText = `$${data.close ? data.close.toFixed(2) : 'N/A'}`;
  const changeText = `${changeSign}${data.changePercent ? data.changePercent.toFixed(2) : '0.00'}%`;
  const volumeText = data.volume ? (data.volume / 1000000).toFixed(1) + 'M' : 'N/A';
  const marketCapText = data.marketCap ? '$' + (data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A';
  
  // Update top bar
  const priceTopEl = document.getElementById('chartLivePriceTop');
  const changeTopEl = document.getElementById('chartLiveChangeTop');
  const volumeTopEl = document.getElementById('chartLiveVolumeTop');
  const marketCapTopEl = document.getElementById('chartLiveMarketCapTop');
  
  if (priceTopEl) priceTopEl.textContent = priceText;
  if (changeTopEl) {
    changeTopEl.textContent = changeText;
    changeTopEl.className = `live-change-large ${changeClass}`;
  }
  if (volumeTopEl) volumeTopEl.textContent = volumeText;
  if (marketCapTopEl) marketCapTopEl.textContent = marketCapText;
}

// Live update toggle
document.getElementById('liveUpdateToggle')?.addEventListener('change', (e) => {
  liveUpdateEnabled = e.target.checked;
});

// Show/hide extended hours toggle based on whether timeframe has intraday intervals
function updateExtendedHoursVisibility() {
  const timeframe = document.getElementById('chartTimeframe')?.value;
  const extendedHoursToggle = document.querySelector('.live-update-toggle:has(#extendedHoursToggle)');
  
  if (extendedHoursToggle) {
    // Show if timeframe has ANY intraday intervals available
    const intradayTimeframes = ['1D', '5D', '1M', '3M'];
    
    if (intradayTimeframes.includes(timeframe)) {
      extendedHoursToggle.style.display = '';
    } else {
      extendedHoursToggle.style.display = 'none';
    }
  }
}

// Validate interval for timeframe
function validateIntervalForTimeframe() {
  const timeframe = document.getElementById('chartTimeframe')?.value;
  const intervalSelect = document.getElementById('chartInterval');
  if (!timeframe || !intervalSelect) return;
  
  const currentInterval = intervalSelect.value;
  
  // Define valid intervals for each timeframe
  // Note: Polygon only keeps ~3 months of intraday data, so longer timeframes use daily+ intervals
  const validIntervals = {
    '1D': ['1', '5', '15', '30', '60'],
    '5D': ['5', '15', '30', '60', '240'],  // All intraday intervals
    '1M': ['15', '30', '60', '240', 'day'],  // 15min to daily
    '3M': ['15', '30', '60', '240', 'day'],  // 15min, 30min, 1hr, 4hr, daily
    '1Y': ['day', 'week'],
    '2Y': ['day', 'week'],
    '5Y': ['day', 'week', 'month'],
    '10Y': ['week', 'month'],
    'ALL': ['week', 'month']
  };
  
  const allowed = validIntervals[timeframe] || ['day'];
  
  // Disable all options first
  Array.from(intervalSelect.options).forEach(option => {
    option.disabled = !allowed.includes(option.value);
  });
  
  // If current interval is not valid, select the first valid one
  if (!allowed.includes(currentInterval)) {
    intervalSelect.value = allowed[allowed.length - 1]; // Default to largest valid interval
  }
  
  // Update extended hours visibility (use setTimeout to ensure DOM has updated)
  setTimeout(() => updateExtendedHoursVisibility(), 0);
}

// Timeframe/interval change handlers
document.getElementById('chartTimeframe')?.addEventListener('change', () => {
  validateIntervalForTimeframe();
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

document.getElementById('chartInterval')?.addEventListener('change', () => {
  updateExtendedHoursVisibility();
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Extended hours toggle
document.getElementById('extendedHoursToggle')?.addEventListener('change', () => {
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Chart type toggle
document.getElementById('chartType')?.addEventListener('change', () => {
  if (currentChartTicker) {
    const timeframe = document.getElementById('chartTimeframe')?.value;
    const interval = document.getElementById('chartInterval')?.value;
    loadCandlestickChart(currentChartTicker, timeframe, interval);
  }
});

// Calculate date range based on timeframe
// For intraday intervals on longer timeframes, we need to limit the range
// to avoid hitting API limits and to ensure we get recent data
function getDateRange(timeframe, interval = 'day') {
  const now = new Date();
  const to = new Date(now.getTime());  // Create explicit copy
  const from = new Date(now.getTime());  // Create explicit copy
  
  // Check if this is an intraday interval (minute or hour based)
  const isIntraday = interval !== 'day' && interval !== 'week' && interval !== 'month';
  
  switch(timeframe) {
    case '1D':
      // For 1D, show only today's data (start at midnight today)
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
      // Go back 20 years for "all available"
      from.setFullYear(from.getFullYear() - 20);
      break;
    default:
      from.setFullYear(from.getFullYear() - 1);
  }
  
  // Format as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const result = {
    from: formatDate(from),
    to: formatDate(to)
  };
  
  console.log(`[DATE RANGE] Timeframe: ${timeframe}, From: ${result.from}, To: ${result.to}`);
  console.log(`[DATE DEBUG] From Date Object: ${from.toString()}`);
  console.log(`[DATE DEBUG] To Date Object: ${to.toString()}`);
  console.log(`[DATE DEBUG] Current Time: ${now.toString()}`);
  
  return result;
}

// Determine timespan and multiplier from interval
function getTimespanParams(interval) {
  if (interval === 'day') {
    return { timespan: 'day', multiplier: 1 };
  } else if (interval === 'week') {
    return { timespan: 'week', multiplier: 1 };
  } else if (interval === 'month') {
    return { timespan: 'month', multiplier: 1 };
  } else if (interval === '240') {
    // 4 hour = 240 minutes
    return { timespan: 'hour', multiplier: 4 };
  } else if (parseInt(interval) >= 60) {
    // Hour intervals
    return { timespan: 'hour', multiplier: parseInt(interval) / 60 };
  } else {
    // Minute intervals
    return { timespan: 'minute', multiplier: parseInt(interval) };
  }
}

// Load candlestick chart
async function loadCandlestickChart(ticker, timeframe, interval) {
  const chartDiv = document.getElementById('candlestickChart');
  const loadingDiv = document.getElementById('chartLoading');
  const emptyState = document.getElementById('chartEmptyState');
  
  // Hide empty state, show loading
  if (emptyState) emptyState.style.display = 'none';
  loadingDiv.style.display = 'block';
  chartDiv.innerHTML = '';
  
  try {
    const dateRange = getDateRange(timeframe, interval);
    const { timespan, multiplier } = getTimespanParams(interval);
    const extendedHoursCheckbox = document.getElementById('extendedHoursToggle');
    const extendedHours = extendedHoursCheckbox?.checked === true;
    
    console.log(`[CHART LOAD] ${ticker}:`);
    console.log(`  Timeframe: ${timeframe}, Interval: ${interval}`);
    console.log(`  Date Range: ${dateRange.from} to ${dateRange.to}`);
    console.log(`  Timespan: ${multiplier} ${timespan}`);
    console.log(`  Extended Hours Checkbox Checked: ${extendedHoursCheckbox?.checked}`);
    console.log(`  Extended Hours Parameter: ${extendedHours}`);
    
    const result = await window.electronAPI.polygonGetHistoricalBars({
      ticker: ticker,
      from: dateRange.from,
      to: dateRange.to,
      timespan: timespan,
      multiplier: multiplier,
      includeExtendedHours: extendedHours
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load chart data');
    }
    
    if (!result.bars || result.bars.length === 0) {
      throw new Error('No data available for this ticker and timeframe');
    }
    
    // Debug: Log first and last bar timestamps
    const firstBar = result.bars[0];
    const lastBar = result.bars[result.bars.length - 1];
    console.log(`[DATA CHECK] Received ${result.bars.length} bars`);
    console.log(`  First bar: ${new Date(firstBar.t).toISOString()}`);
    console.log(`  Last bar: ${new Date(lastBar.t).toISOString()}`);
    
    currentChartData = result.bars;
    drawCandlestickChart(ticker, result.bars, timespan, timeframe);
    
    loadingDiv.style.display = 'none';
    
  } catch (error) {
    console.error('Error loading chart:', error);
    loadingDiv.style.display = 'none';
    chartDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #e74c3c;">
        <div style="text-align: center;">
          <h3>Error Loading Chart</h3>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }
}

// Draw candlestick chart with no gaps (excludes non-trading days)
function drawCandlestickChart(ticker, bars, timespan, timeframe) {
  // Prepare data for Plotly
  // The key: use a categorical x-axis with only actual trading days/times
  
  const dates = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];
  
  // Determine tick angle and font size based on timeframe and data length
  const totalBars = bars.length;
  let tickAngle = -45;
  let tickFontSize = 10;
  let showEveryNth = 1;
  
  // Adjust display based on number of bars
  if (totalBars > 500) {
    tickAngle = -90;
    tickFontSize = 8;
    showEveryNth = Math.ceil(totalBars / 50); // Show ~50 labels max
  } else if (totalBars > 200) {
    showEveryNth = Math.ceil(totalBars / 100);
  }
  
  bars.forEach((bar, index) => {
    // Format timestamp based on timespan
    let dateLabel;
    const date = new Date(bar.t);
    
    if (timespan === 'month') {
      // Monthly: show month and year
      dateLabel = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short'
      });
    } else if (timespan === 'week') {
      // Weekly: show month, day, year
      dateLabel = date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (timespan === 'day') {
      // Daily: show date
      dateLabel = date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (timespan === 'hour') {
      // Hourly: Always show date and time for multi-day ranges
      dateLabel = date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        hour12: true
      });
    } else {
      // Minutes: Check if we span multiple days
      const firstBar = bars[0];
      const lastBar = bars[bars.length - 1];
      const firstDate = new Date(firstBar.t);
      const lastDate = new Date(lastBar.t);
      const spanMultipleDays = firstDate.toDateString() !== lastDate.toDateString();
      
      if (spanMultipleDays) {
        // Multi-day range: always show date + time
        dateLabel = date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } else {
        // Single day: show time only
        dateLabel = date.toLocaleTimeString('en-US', { 
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    }
    
    dates.push(dateLabel);
    open.push(bar.o);
    high.push(bar.h);
    low.push(bar.l);
    close.push(bar.c);
    volume.push(bar.v);
  });
  
  // Note: For daily bars, Polygon's API may include extended hours data in the OHLC by default
  // The includeOtc parameter primarily affects intraday (minute/hour) data
  // To get "regular hours only" daily data, we may need to use a different endpoint
  
  // Get chart type
  const chartType = document.getElementById('chartType')?.value || 'candlestick';
  
  // Create candlestick trace with solid filled candles
  // Get theme colors for candles
  const positiveColor = getPositiveColor();
  const negativeColor = getNegativeColor();
  
  const candlestickTrace = {
    type: 'candlestick',
    x: dates,
    open: open,
    high: high,
    low: low,
    close: close,
    name: ticker,
    increasing: { 
      line: { color: positiveColor, width: 1 },
      fillcolor: positiveColor  // Solid fill
    },
    decreasing: { 
      line: { color: negativeColor, width: 1 },
      fillcolor: negativeColor  // Solid fill
    },
    xaxis: 'x',
    yaxis: 'y',
    hoverinfo: 'text',  // Use custom hover text
    text: dates.map((date, i) => 
      `${date}<br>O: $${open[i].toFixed(2)}<br>H: $${high[i].toFixed(2)}<br>L: $${low[i].toFixed(2)}<br>C: $${close[i].toFixed(2)}`
    )
  };
  
  // Create volume trace with theme colors (33 = 20% opacity in hex)
  const volumeTrace = {
    type: 'bar',
    x: dates,
    y: volume,
    name: 'Volume',
    marker: {
      color: volume.map((v, i) => close[i] >= open[i] ? positiveColor + '33' : negativeColor + '33')
    },
    xaxis: 'x',
    yaxis: 'y2'
  };
  
  // Get chart title based on timespan
  let chartTitle = ticker;
  if (timespan === 'month') chartTitle += ' - Monthly';
  else if (timespan === 'week') chartTitle += ' - Weekly';
  else if (timespan === 'day') chartTitle += ' - Daily';
  else if (timespan === 'hour') chartTitle += ' - Hourly';
  else chartTitle += ' - Intraday';
  
  const extendedHours = document.getElementById('extendedHoursToggle')?.checked;
  if (extendedHours) chartTitle += ' (w/ Extended Hours)';
  
  const layout = {
    plot_bgcolor: '#000000',
    paper_bgcolor: '#000000',
    font: { color: '#e0e0e0' },
    xaxis: {
      type: 'category', // KEY: Categorical x-axis = no gaps!
      rangeslider: { visible: false },
      gridcolor: '#1a1a1a',
      griddash: 'dot',
      showgrid: false,  // Hide vertical gridlines from dates
      tickangle: tickAngle,
      tickfont: { size: tickFontSize },
      nticks: Math.min(15, Math.ceil(totalBars / 20)), // Much fewer ticks for cleaner look
      automargin: true,
      showspikes: true,  // Enable spike line
      spikemode: 'across',  // Draw line across entire plot
      spikesnap: 'cursor',  // Snap to cursor position
      spikecolor: '#666',  // Color of the crosshair line
      spikethickness: 0.5,  // Thinner line
      spikedash: 'dot'  // Dashed line
    },
    yaxis: {
      domain: [0.23, 1],  // More room above volume
      gridcolor: '#1a1a1a',
      griddash: 'dot',
      showgrid: true,  // Keep horizontal gridlines
      tickprefix: '$',
      showspikes: true,  // Enable horizontal spike line (will disable when locked)
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: '#666',
      spikethickness: 0.5,
      spikedash: 'dot'
    },
    yaxis2: {
      title: '',  // No title for volume axis
      domain: [0, 0.18],  // Increased height for volume chart
      gridcolor: '#1a1a1a',
      showgrid: false,
      showticklabels: false  // Hide volume numbers
    },
    margin: { l: 60, r: 40, t: 20, b: 140 },
    hovermode: 'closest',  // Changed from 'x unified' for better control
    hoverlabel: {
      bgcolor: 'rgba(26, 26, 26, 0.95)',  // Semi-transparent background
      bordercolor: '#444',
      font: { color: '#e0e0e0', size: 12 },
      align: 'left',
      namelength: -1  // Show full text
    },
    showlegend: false  // Hide legend completely
  };
  
  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
    modeBarButtonsToAdd: [{
      name: 'Pan',
      icon: Plotly.Icons.pan,
      click: function(gd) {
        Plotly.relayout(gd, 'dragmode', 'pan');
      }
    }]
  };
  
  // Set default drag mode to pan
  layout.dragmode = 'pan';
  
  // Choose trace based on chart type
  let mainTrace;
  if (chartType === 'line') {
    // Create line chart trace
    mainTrace = {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: close,
      name: ticker,
      line: {
        color: '#4a9eff',
        width: 2
      },
      xaxis: 'x',
      yaxis: 'y',
      hovertemplate: '%{x}<br>Close: $%{y:.2f}<extra></extra>'
    };
  } else {
    mainTrace = candlestickTrace;
  }
  
  // Update volume trace hover
  volumeTrace.hovertemplate = 'Volume: %{y:,.0f}<extra></extra>';
  
  Plotly.newPlot('candlestickChart', [mainTrace, volumeTrace], layout, config);
  
  // Custom hover positioning to top-left
  // Use requestAnimationFrame to continuously reposition while hovering
  const chartDiv = document.getElementById('candlestickChart');
  let isHovering = false;
  let isCrosshairLocked = false;
  let animationFrameId = null;
  
  function repositionHoverLabels() {
    const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
    hoverGroups.forEach(group => {
      group.setAttribute('transform', 'translate(80, 80)');
      if (!group.classList.contains('positioned')) {
        group.classList.add('positioned');
      }
    });
    
    if (isHovering || isCrosshairLocked) {
      animationFrameId = requestAnimationFrame(repositionHoverLabels);
    }
  }
  
  chartDiv.on('plotly_hover', function(data) {
    isHovering = true;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    repositionHoverLabels();
  });
  
  chartDiv.on('plotly_unhover', function() {
    if (!isCrosshairLocked) {
      isHovering = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    }
  });
  
  // Crosshair lock functionality
  const crosshairLockToggle = document.getElementById('crosshairLockToggle');
  
  function applyCrosshairLock(isLocked) {
    isCrosshairLocked = isLocked;
    
    if (isCrosshairLocked) {
      // Enable crosshair lock - change hovermode to always show closest point
      // Remove horizontal crosshair line (only keep vertical)
      Plotly.relayout('candlestickChart', {
        'hovermode': 'x',
        'dragmode': false,  // Disable panning while locked
        'yaxis.showspikes': false  // Hide horizontal crosshair when locked
      });
      
      // Force hover on current mouse position
      isHovering = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      repositionHoverLabels();
    } else {
      // Disable crosshair lock - return to normal behavior
      // Restore horizontal crosshair line
      Plotly.relayout('candlestickChart', {
        'hovermode': 'closest',
        'dragmode': 'pan',
        'yaxis.showspikes': true  // Show horizontal crosshair when unlocked
      });
      
      isHovering = false;
      isCrosshairLocked = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      Plotly.Fx.unhover('candlestickChart');
      const hoverGroups = document.querySelectorAll('#candlestickChart .hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    }
  }
  
  crosshairLockToggle.addEventListener('change', function() {
    applyCrosshairLock(this.checked);
  });
  
  // Apply crosshair lock state on chart load if checkbox is checked
  if (crosshairLockToggle.checked) {
    setTimeout(() => applyCrosshairLock(true), 100);
  }
}

// Update live candle with websocket data
function updateLiveCandle(data) {
  if (!currentChartData || currentChartData.length === 0) return;
  
  try {
    // Get the last bar
    const lastBar = currentChartData[currentChartData.length - 1];
    const barTime = new Date(lastBar.t);
    const now = new Date();
    
    // Check if we're still in the same time period as the last bar
    const interval = document.getElementById('chartInterval')?.value;
    const { timespan, multiplier } = getTimespanParams(interval);
    
    let sameBar = false;
    if (timespan === 'minute') {
      // For minute bars, check if we're in the same minute interval
      const barMinute = Math.floor(barTime.getTime() / (multiplier * 60000));
      const nowMinute = Math.floor(now.getTime() / (multiplier * 60000));
      sameBar = barMinute === nowMinute;
    }
    
    if (sameBar) {
      // Update the last bar with live data
      lastBar.c = data.close;
      lastBar.h = Math.max(lastBar.h, data.close);
      lastBar.l = Math.min(lastBar.l, data.close);
      lastBar.v += data.volume || 0;
      
      // Redraw chart
      const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
      if (ticker) {
        drawCandlestickChart(ticker, currentChartData, timespan);
      }
    }
  } catch (error) {
    console.error('Error updating live candle:', error);
  }
}

// Update chart when window resizes
window.addEventListener('resize', () => {
  if (currentChartData && document.getElementById('candlestickChart').innerHTML) {
    const ticker = document.getElementById('chartTickerInput')?.value.trim().toUpperCase();
    const interval = document.getElementById('chartInterval')?.value;
    const { timespan } = getTimespanParams(interval);
    if (ticker) {
      drawCandlestickChart(ticker, currentChartData, timespan);
    }
  }
});

// Initialize chart watchlists when watchlists are loaded/updated
function refreshChartWatchlists() {
  initializeChartWatchlists();
}

// Call refresh when watchlist changes
const originalSaveWatchlists = saveWatchlistsToStorage;
window.saveWatchlistsToStorage = function() {
  originalSaveWatchlists();
  refreshChartWatchlists();
};

// Initialize on load
setTimeout(() => {
  initializeChartWatchlists();
}, 1000);

// ========================================
// RSI Dashboard Functions
// ========================================

let rsiCurrentWatchlist = null;
let rsiSelectedSymbol = null;
let rsiBasketData = [];

// Helper function to fetch market data for RSI calculations
async function fetchRSIMarketData(ticker, timeframe, interval) {
  try {
    const dateRange = getDateRange(timeframe, interval);
    const { timespan, multiplier } = getTimespanParams(interval);
    
    const result = await window.electronAPI.polygonGetHistoricalBars({
      ticker: ticker,
      from: dateRange.from,
      to: dateRange.to,
      timespan: timespan,
      multiplier: multiplier,
      includeExtendedHours: false
    });
    
    if (result.success && result.bars && result.bars.length > 0) {
      return result.bars;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

// Calculate RSI using Wilder's smoothing method
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    return null;
  }

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;

  // Calculate RSI values
  const rsiValues = [];
  
  for (let i = period; i < changes.length; i++) {
    const currentChange = changes[i];
    const gain = currentChange > 0 ? currentChange : 0;
    const loss = currentChange < 0 ? Math.abs(currentChange) : 0;
    
    // Wilder's smoothing
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    rsiValues.push({ rsi, index: i + 1 });
  }

  return rsiValues;
}

// Calculate Bollinger Bands for RSI
function calculateRSIBollinger(rsiValues, period = 20, stdDevMultiplier = 2) {
  if (!rsiValues || rsiValues.length < period) {
    return null;
  }

  const result = [];
  
  for (let i = period - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val.rsi, 0);
    const mean = sum / period;
    
    const squaredDiffs = slice.map(val => Math.pow(val.rsi - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const stdDev = Math.sqrt(variance);
    
    result.push({
      rsi: rsiValues[i].rsi,
      sma: mean,
      upper: mean + (stdDevMultiplier * stdDev),
      lower: mean - (stdDevMultiplier * stdDev),
      index: rsiValues[i].index
    });
  }
  
  return result;
}

// Initialize RSI Dashboard
function initializeRSIDashboard() {
  const sourceSelect = document.getElementById('rsiSourceSelect');
  const watchlistGroup = document.getElementById('rsiWatchlistGroup');
  const tickerGroup = document.getElementById('rsiTickerGroup');
  const watchlistSelect = document.getElementById('rsiWatchlistSelect');
  const refreshBtn = document.getElementById('rsiRefreshBtn');
  const tickerBtn = document.getElementById('rsiTickerBtn');

  // Populate watchlist dropdown
  const watchlists = JSON.parse(localStorage.getItem('watchlists')) || [];
  watchlistSelect.innerHTML = '<option value="">Choose a watchlist...</option>';
  watchlists.forEach(wl => {
    const option = document.createElement('option');
    option.value = wl.name;
    option.textContent = wl.name;
    watchlistSelect.appendChild(option);
  });

  // Toggle between watchlist and single ticker mode
  sourceSelect.addEventListener('change', () => {
    if (sourceSelect.value === 'watchlist') {
      watchlistGroup.style.display = 'flex';
      tickerGroup.style.display = 'none';
    } else {
      watchlistGroup.style.display = 'none';
      tickerGroup.style.display = 'flex';
    }
  });

  // Load watchlist data
  watchlistSelect.addEventListener('change', () => {
    if (watchlistSelect.value) {
      loadRSIWatchlistData(watchlistSelect.value);
    }
  });

  // Refresh button
  refreshBtn.addEventListener('click', () => {
    if (sourceSelect.value === 'watchlist' && watchlistSelect.value) {
      loadRSIWatchlistData(watchlistSelect.value);
    } else if (sourceSelect.value === 'single') {
      const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
      if (ticker) {
        loadRSISingleTicker(ticker);
      }
    }
  });

  // Single ticker load button
  tickerBtn.addEventListener('click', () => {
    const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
    if (ticker) {
      loadRSISingleTicker(ticker);
    }
  });

  // Enter key for ticker input
  document.getElementById('rsiTickerInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      tickerBtn.click();
    }
  });

  // RSI period change - reload all data
  document.getElementById('rsiPeriod').addEventListener('change', async () => {
    // Update all headers first
    updateRSIHeaders();
    
    const sourceSelect = document.getElementById('rsiSourceSelect');
    const watchlistSelect = document.getElementById('rsiWatchlistSelect');
    
    if (sourceSelect.value === 'watchlist' && watchlistSelect.value) {
      await loadRSIWatchlistData(watchlistSelect.value);
    } else if (sourceSelect.value === 'single') {
      const ticker = document.getElementById('rsiTickerInput').value.trim().toUpperCase();
      if (ticker) {
        await loadRSISingleTicker(ticker);
      }
    }
    
    // After reloading data, refresh the chart if a symbol is selected
    if (rsiSelectedSymbol) {
      await selectRSISymbol(rsiSelectedSymbol);
    }
  });
  
  // Bollinger period change - refresh chart if symbol selected
  document.getElementById('rsiBollingerPeriod').addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });

  // Standard deviation slider
  const stdDevSlider = document.getElementById('rsiBollingerStdDev');
  const stdDevValue = document.getElementById('rsiStdDevValue');
  
  stdDevSlider.addEventListener('input', () => {
    stdDevValue.textContent = parseFloat(stdDevSlider.value).toFixed(1);
  });
  
  stdDevSlider.addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });
  
  // Chart time range change
  document.getElementById('rsiChartTimeRange').addEventListener('change', () => {
    if (rsiSelectedSymbol) {
      const tickerData = rsiBasketData.find(item => item.ticker === rsiSelectedSymbol);
      if (tickerData) {
        renderRSIBollingerChart(rsiSelectedSymbol, tickerData);
      }
    }
  });
}

// Load RSI data for a watchlist
async function loadRSIWatchlistData(watchlistName) {
  console.log('Loading RSI data for watchlist:', watchlistName);
  
  const watchlists = JSON.parse(localStorage.getItem('watchlists')) || [];
  const watchlist = watchlists.find(wl => wl.name === watchlistName);
  
  if (!watchlist || !watchlist.tickers || watchlist.tickers.length === 0) {
    console.log('No tickers in watchlist');
    return;
  }

  rsiCurrentWatchlist = watchlistName;
  rsiBasketData = [];

  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  // Fetch daily RSI for each ticker
  const promises = watchlist.tickers.map(async (ticker) => {
    try {
      // Get 1 year of daily data for RSI calculation
      const data = await fetchRSIMarketData(ticker, '1Y', 'day');
      
      if (data && data.length > rsiPeriod) {
        const closes = data.map(bar => bar.c);
        const rsiValues = calculateRSI(closes, rsiPeriod);
        
        if (rsiValues && rsiValues.length > 0) {
          const currentRSI = rsiValues[rsiValues.length - 1].rsi;
          
          // Calculate Bollinger Bands for coloring
          let bollingerStatus = 'neutral';
          if (rsiValues.length >= 20) {
            const bollingerData = calculateRSIBollinger(rsiValues, 20);
            if (bollingerData && bollingerData.length > 0) {
              const lastBB = bollingerData[bollingerData.length - 1];
              if (currentRSI > lastBB.upper) {
                bollingerStatus = 'overbought'; // Above upper band
              } else if (currentRSI < lastBB.lower) {
                bollingerStatus = 'oversold'; // Below lower band
              }
            }
          }
          
          return {
            ticker,
            rsi: currentRSI,
            data: data,
            rsiValues: rsiValues,
            bollingerStatus: bollingerStatus
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching RSI for ${ticker}:`, error);
    }
    return null;
  });

  const results = await Promise.all(promises);
  rsiBasketData = results.filter(r => r !== null);

  // Sort by RSI descending
  rsiBasketData.sort((a, b) => b.rsi - a.rsi);

  updateRSIHeaders();
  renderRSIBasketTable();
  
  document.getElementById('rsiBasketCount').textContent = `${rsiBasketData.length} symbols`;
}

// Load RSI data for a single ticker
async function loadRSISingleTicker(ticker) {
  console.log('Loading RSI data for single ticker:', ticker);
  
  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  try {
    const data = await fetchRSIMarketData(ticker, '1Y', 'day');
    
    if (data && data.length > rsiPeriod) {
      const closes = data.map(bar => bar.c);
      const rsiValues = calculateRSI(closes, rsiPeriod);
      
      if (rsiValues && rsiValues.length > 0) {
        const currentRSI = rsiValues[rsiValues.length - 1].rsi;
        
        // Calculate Bollinger Bands for coloring
        let bollingerStatus = 'neutral';
        if (rsiValues.length >= 20) {
          const bollingerData = calculateRSIBollinger(rsiValues, 20);
          if (bollingerData && bollingerData.length > 0) {
            const lastBB = bollingerData[bollingerData.length - 1];
            if (currentRSI > lastBB.upper) {
              bollingerStatus = 'overbought';
            } else if (currentRSI < lastBB.lower) {
              bollingerStatus = 'oversold';
            }
          }
        }
        
        rsiBasketData = [{
          ticker,
          rsi: currentRSI,
          data: data,
          rsiValues: rsiValues,
          bollingerStatus: bollingerStatus
        }];
        
        updateRSIHeaders();
        renderRSIBasketTable();
        document.getElementById('rsiBasketCount').textContent = '1 symbol';
      }
    }
  } catch (error) {
    console.error(`Error fetching RSI for ${ticker}:`, error);
  }
}

// Update all headers with current RSI period
function updateRSIHeaders() {
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  // Update basket table column header
  const basketTableHeader = document.getElementById('rsiBasketTableHeader');
  if (basketTableHeader) {
    basketTableHeader.textContent = `RSI (${rsiPeriod}D)`;
  }
  
  // Update history panel header
  const historyHeader = document.getElementById('rsiHistoryHeader');
  if (historyHeader) {
    historyHeader.textContent = `RSI (${rsiPeriod}D)`;
  }
  
  // Update synergy table header
  const synergyTableHeader = document.getElementById('rsiSynergyTableHeader');
  if (synergyTableHeader) {
    synergyTableHeader.textContent = `Period (${rsiPeriod})`;
  }
  
  // Update chart panel header
  const chartHeader = document.getElementById('rsiChartHeader');
  if (chartHeader) {
    chartHeader.textContent = `Bollinger Bands of RSI (${rsiPeriod}D)`;
  }
}

// Render the basket table
// RSI Color Based on Bollinger Bands (20-period for basket):
// - Green (Oversold): RSI below lower Bollinger Band - Potential buying opportunity
// - Red (Overbought): RSI above upper Bollinger Band - Potential selling opportunity  
// - Gray/White (Neutral): RSI within Bollinger Bands - Normal trading range
function renderRSIBasketTable() {
  const tbody = document.getElementById('rsiBasketTable').querySelector('tbody');
  tbody.innerHTML = '';

  if (rsiBasketData.length === 0) {
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="2">No data available</td></tr>';
    return;
  }

  rsiBasketData.forEach(item => {
    const row = document.createElement('tr');
    if (item.ticker === rsiSelectedSymbol) {
      row.classList.add('selected');
    }

    const tickerCell = document.createElement('td');
    tickerCell.textContent = item.ticker;

    const rsiCell = document.createElement('td');
    const rsiValue = item.rsi.toFixed(2);
    const status = item.bollingerStatus || 'neutral';
    
    rsiCell.innerHTML = `
      <div class="rsi-value-cell">
        <div class="rsi-value-bar" style="width: ${item.rsi}%; background: ${
          status === 'oversold' ? 'rgba(34, 197, 94, 0.4)' :
          status === 'overbought' ? 'rgba(239, 68, 68, 0.4)' :
          'rgba(150, 150, 150, 0.4)'
        }"></div>
        <span class="${
          status === 'oversold' ? 'rsi-oversold' :
          status === 'overbought' ? 'rsi-overbought' :
          'rsi-neutral'
        }">${rsiValue}</span>
      </div>
    `;

    row.appendChild(tickerCell);
    row.appendChild(rsiCell);

    row.addEventListener('click', () => {
      selectRSISymbol(item.ticker);
    });

    tbody.appendChild(row);
  });
}

// Select a symbol and load its details
async function selectRSISymbol(ticker) {
  console.log('Selected RSI symbol:', ticker);
  rsiSelectedSymbol = ticker;

  // Update all headers
  updateRSIHeaders();
  
  // Update selection in basket table
  renderRSIBasketTable();

  // Update panel headers with symbol names
  document.getElementById('rsiHistorySymbol').textContent = ticker;
  document.getElementById('rsiSynergySymbol').textContent = ticker;
  document.getElementById('rsiChartSymbol').textContent = ticker;

  // Find the ticker data
  const tickerData = rsiBasketData.find(item => item.ticker === ticker);
  
  if (tickerData) {
    await renderRSIHistory(ticker, tickerData);
    await renderRSISynergy(ticker);
    await renderRSIBollingerChart(ticker, tickerData);
  }
}

// Render RSI History table
async function renderRSIHistory(ticker, tickerData) {
  const tbody = document.getElementById('rsiHistoryTable').querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  const windows = [
    { name: '3M', days: 90 },
    { name: '6M', days: 180 },
    { name: '1Y', days: 365 },
    { name: '2Y', days: 730 },
    { name: '5Y', days: 1825 }
  ];

  tbody.innerHTML = '';

  for (const window of windows) {
    try {
      // Calculate the date range
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - window.days);

      // Filter data for this window
      const windowData = tickerData.data.filter(bar => {
        const barDate = new Date(bar.t);
        return barDate >= fromDate && barDate <= toDate;
      });

      // Get selected RSI period
      const rsiPeriodSelect = document.getElementById('rsiPeriod');
      const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
      
      if (windowData.length > rsiPeriod) {
        const closes = windowData.map(bar => bar.c);
        const rsiValues = calculateRSI(closes, rsiPeriod);

        if (rsiValues && rsiValues.length > 0) {
          // Find min and max RSI
          let minRSI = Infinity;
          let maxRSI = -Infinity;
          let minDate = null;
          let maxDate = null;

          rsiValues.forEach((rsiItem, idx) => {
            const dataIdx = idx + 14; // RSI starts after 14 periods
            if (dataIdx < windowData.length) {
              if (rsiItem.rsi < minRSI) {
                minRSI = rsiItem.rsi;
                minDate = new Date(windowData[dataIdx].t);
              }
              if (rsiItem.rsi > maxRSI) {
                maxRSI = rsiItem.rsi;
                maxDate = new Date(windowData[dataIdx].t);
              }
            }
          });

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${window.name}</td>
            <td class="synergy-rsi-low">${minRSI.toFixed(2)}</td>
            <td class="history-date">${minDate ? minDate.toLocaleDateString() : '-'}</td>
            <td class="synergy-rsi-high">${maxRSI.toFixed(2)}</td>
            <td class="history-date">${maxDate ? maxDate.toLocaleDateString() : '-'}</td>
          `;
          tbody.appendChild(row);
        }
      }
    } catch (error) {
      console.error(`Error calculating RSI for ${window.name}:`, error);
    }
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="5">No data available</td></tr>';
  }
}

// Render RSI Synergy table
async function renderRSISynergy(ticker) {
  const tbody = document.getElementById('rsiSynergyTable').querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';

  const timeframes = [
    { name: 'Weekly', timeframe: '1Y', interval: 'week' },
    { name: 'Daily', timeframe: '1Y', interval: 'day' },
    { name: '60 Min', timeframe: '1M', interval: '60' },
    { name: '15 Min', timeframe: '5D', interval: '15' },
    { name: '5 Min', timeframe: '5D', interval: '5' }
  ];

  tbody.innerHTML = '';

  // Get selected RSI period
  const rsiPeriodSelect = document.getElementById('rsiPeriod');
  const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
  
  for (const tf of timeframes) {
    try {
      const data = await fetchRSIMarketData(ticker, tf.timeframe, tf.interval);
      
      if (data && data.length > rsiPeriod) {
        const closes = data.map(bar => bar.c);
        const rsiValues = calculateRSI(closes, rsiPeriod);
        
        if (rsiValues && rsiValues.length > 0) {
          const currentRSI = rsiValues[rsiValues.length - 1].rsi;
          
          // Check Bollinger status for this timeframe
          let bollingerStatus = '';
          if (rsiValues.length >= 20) {
            const bollingerData = calculateRSIBollinger(rsiValues, 20);
            if (bollingerData && bollingerData.length > 0) {
              const lastBB = bollingerData[bollingerData.length - 1];
              if (currentRSI > lastBB.upper) {
                bollingerStatus = 'synergy-rsi-high';
              } else if (currentRSI < lastBB.lower) {
                bollingerStatus = 'synergy-rsi-low';
              }
            }
          }
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${tf.name}</td>
            <td class="${bollingerStatus}">${currentRSI.toFixed(2)}</td>
          `;
          tbody.appendChild(row);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${tf.name} RSI:`, error);
    }
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr class="empty-state-row"><td colspan="2">No data available</td></tr>';
  }
}

// Render RSI Bollinger Bands chart
async function renderRSIBollingerChart(ticker, tickerData) {
  const chartDiv = document.getElementById('rsiBollingerChart');
  const loadingDiv = document.getElementById('rsiChartLoading');
  const emptyDiv = document.getElementById('rsiChartEmpty');

  emptyDiv.style.display = 'none';
  loadingDiv.style.display = 'flex';

  try {
    // Get selected RSI period, Bollinger period and std dev
    const rsiPeriodSelect = document.getElementById('rsiPeriod');
    const rsiPeriod = parseInt(rsiPeriodSelect?.value || '14');
    const bollingerPeriodSelect = document.getElementById('rsiBollingerPeriod');
    const bollingerPeriod = parseInt(bollingerPeriodSelect?.value || '20');
    const stdDevSlider = document.getElementById('rsiBollingerStdDev');
    const stdDevMultiplier = parseFloat(stdDevSlider?.value || '2');
    
    // Get selected chart time range
    const timeRangeSelect = document.getElementById('rsiChartTimeRange');
    const timeRange = timeRangeSelect?.value || '1Y';
    
    // Fetch data based on selected time range
    // For 1Y, fetch 2Y so user can pan back to see more history
    const fetchRange = timeRange === '1Y' ? '2Y' : timeRange;
    const data = await fetchRSIMarketData(ticker, fetchRange, 'day');
    
    const minBars = rsiPeriod + bollingerPeriod; // Need RSI period + Bollinger period
    if (!data || data.length < minBars) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    const closes = data.map(bar => bar.c);
    const dates = data.map(bar => new Date(bar.t));
    const rsiValues = calculateRSI(closes, rsiPeriod);
    
    if (!rsiValues || rsiValues.length < bollingerPeriod) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    const bollingerData = calculateRSIBollinger(rsiValues, bollingerPeriod, stdDevMultiplier);
    
    if (!bollingerData) {
      emptyDiv.style.display = 'flex';
      loadingDiv.style.display = 'none';
      return;
    }

    // Prepare data for plotting
    const chartDates = bollingerData.map(item => dates[item.index]);
    const rsiLine = bollingerData.map(item => item.rsi);
    const upperBand = bollingerData.map(item => item.upper);
    const lowerBand = bollingerData.map(item => item.lower);

    // Create traces
    const smaLine = bollingerData.map(item => item.sma);
    
    const upperTrace = {
      x: chartDates,
      y: upperBand,
      type: 'scatter',
      mode: 'lines',
      name: 'Upper Band',
      line: { color: '#d946ef', width: 1.5, dash: 'dot' },
      hovertemplate: 'Upper: %{y:.2f}<extra></extra>'
    };

    const middleTrace = {
      x: chartDates,
      y: smaLine,
      type: 'scatter',
      mode: 'lines',
      name: `Middle (${bollingerPeriod}-SMA)`,
      line: { color: '#666', width: 1, dash: 'dash' },
      hovertemplate: `${bollingerPeriod}-SMA: %{y:.2f}<extra></extra>`
    };

    const rsiTrace = {
      x: chartDates,
      y: rsiLine,
      type: 'scatter',
      mode: 'lines',
      name: `RSI (${rsiPeriod}D)`,
      line: { color: '#4a9eff', width: 2 },
      hovertemplate: `%{x}<br>RSI(${rsiPeriod}): %{y:.2f}<extra></extra>`
    };

    const lowerTrace = {
      x: chartDates,
      y: lowerBand,
      type: 'scatter',
      mode: 'lines',
      name: 'Lower Band',
      line: { color: '#d946ef', width: 1.5, dash: 'dot' },
      hovertemplate: 'Lower: %{y:.2f}<extra></extra>'
    };

    // Reference lines at 30 and 70
    const oversoldLine = {
      x: chartDates,
      y: Array(chartDates.length).fill(30),
      type: 'scatter',
      mode: 'lines',
      name: 'Oversold (30)',
      line: { color: '#666', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false
    };

    const overboughtLine = {
      x: chartDates,
      y: Array(chartDates.length).fill(70),
      type: 'scatter',
      mode: 'lines',
      name: 'Overbought (70)',
      line: { color: '#666', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false
    };

    // Calculate x-axis range for 1Y option (show last year but allow panning back)
    let xAxisRange = undefined;
    if (timeRange === '1Y' && chartDates.length > 0) {
      const lastDate = new Date(chartDates[chartDates.length - 1]);
      const oneYearAgo = new Date(lastDate);
      oneYearAgo.setFullYear(lastDate.getFullYear() - 1);
      xAxisRange = [oneYearAgo.toISOString(), lastDate.toISOString()];
    }

    const layout = {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#e4e4e7' },
      margin: { l: 60, r: 40, t: 10, b: 60 },
      xaxis: {
        gridcolor: '#1a1a1a',
        showgrid: false,
        rangeslider: { visible: false },
        showspikes: true,
        spikemode: 'across',
        spikesnap: 'cursor',
        spikecolor: '#666',
        spikethickness: 0.5,
        spikedash: 'dot',
        range: xAxisRange
      },
      yaxis: {
        title: 'RSI',
        gridcolor: '#333',
        griddash: 'dot',
        gridwidth: 0.5,
        showgrid: true,
        range: [0, 100],
        showspikes: false
      },
      hovermode: 'x',
      dragmode: 'pan',
      showlegend: false
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
    };

    Plotly.newPlot(chartDiv, [oversoldLine, overboughtLine, lowerTrace, middleTrace, rsiTrace, upperTrace], layout, config);
    
    // Force resize to prevent squished chart
    setTimeout(() => {
      Plotly.Plots.resize(chartDiv);
    }, 100);
    
    // Apply crosshair lock behavior - reposition hover labels to top-left, stacked
    let isHovering = false;
    let animationFrameId = null;
    
    function repositionHoverLabels() {
      const hoverGroups = document.querySelectorAll('#rsiBollingerChart .hoverlayer g.hovertext');
      let yOffset = 80;
      hoverGroups.forEach((group, index) => {
        // Stack vertically with spacing
        group.setAttribute('transform', `translate(80, ${yOffset})`);
        if (!group.classList.contains('positioned')) {
          group.classList.add('positioned');
        }
        // Approximate height per label + spacing (increased for better separation)
        yOffset += 40;
      });
      
      if (isHovering) {
        animationFrameId = requestAnimationFrame(repositionHoverLabels);
      }
    }
    
    chartDiv.on('plotly_hover', function(data) {
      isHovering = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      repositionHoverLabels();
    });
    
    chartDiv.on('plotly_unhover', function() {
      isHovering = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      const hoverGroups = document.querySelectorAll('#rsiBollingerChart .hoverlayer g.hovertext');
      hoverGroups.forEach(group => {
        group.classList.remove('positioned');
      });
    });
    
    loadingDiv.style.display = 'none';
  } catch (error) {
    console.error('Error rendering RSI Bollinger chart:', error);
    emptyDiv.style.display = 'flex';
    loadingDiv.style.display = 'none';
  }
}

// Initialize RSI dashboard when the page loads
setTimeout(() => {
  initializeRSIDashboard();
}, 1500);

// Check if database is already connected and load favorites
setTimeout(async () => {
  console.log('[INIT] Checking for existing database connection...');
  try {
    // Try to get favorites - if it works, database is connected
    const result = await window.electronAPI.getFavorites();
    if (result.success) {
      console.log('[INIT] Database already connected, loading favorites and watchlists...');
      await loadFavorites();
      await loadWatchlistsForBacktest();
    } else {
      console.log('[INIT] No database connected yet');
    }
  } catch (error) {
    console.log('[INIT] No database connected:', error.message);
  }
}, 500);

// ========================================
// Backtesting Configuration Functions
// ========================================

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
          ? h3.textContent.replace('▼', '▶') 
          : h3.textContent.replace('▶', '▼');
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
      optionsHTML += `<optgroup label="📁 ${folderName}">`;
      favs.forEach(fav => {
        const displayName = fav.is_portfolio 
          ? `📊 ${fav.name} (Portfolio)` 
          : `⭐ ${fav.name} (${fav.ticker || 'Unknown'})`;
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

// Collect configuration from form
function collectBacktestConfig() {
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
  
  // INDICATORS section
  config.RSI_ENABLED = document.getElementById('rsiEnabled')?.checked || false;
  
  if (config.RSI_ENABLED) {
    // Parse RSI periods (can be single value or comma-separated)
    const rsiPeriodsStr = document.getElementById('rsiPeriods')?.value || '14';
    config.RSI_PERIOD = rsiPeriodsStr.includes(',') 
      ? rsiPeriodsStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v))
      : [parseInt(rsiPeriodsStr)];
    
    // Parse RSI buy below
    const rsiBuyBelowStr = document.getElementById('rsiBuyBelow')?.value || '30';
    config.RSI_BUY_BELOW = rsiBuyBelowStr.includes(',')
      ? rsiBuyBelowStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v))
      : [parseInt(rsiBuyBelowStr)];
    
    // Parse RSI sell above
    const rsiSellAboveStr = document.getElementById('rsiSellAbove')?.value || '70';
    config.RSI_SELL_ABOVE = rsiSellAboveStr.includes(',')
      ? rsiSellAboveStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v))
      : [parseInt(rsiSellAboveStr)];
  }
  
  // OUTPUTS section (only implemented features)
  config.SAVE_METRICS = document.getElementById('saveMetrics')?.checked || false;
  config.SAVE_DB = document.getElementById('saveDb')?.checked || false;
  config.SAVE_TRADES = document.getElementById('saveTrades')?.checked || false;
  config.MAKE_TEARSHEETS = document.getElementById('makeTearsheets')?.checked || false;
  
  return config;
}

// Populate form from config object
function populateBacktestConfig(config) {
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
    
    // Additional validation for portfolio mode
    if (config.PORTFOLIO_MODE) {
      // Check for duplicate tickers
      const uniqueTickers = [...new Set(config.TICKERS)];
      if (uniqueTickers.length !== config.TICKERS.length) {
        alert('Error: Duplicate tickers detected. Each ticker should only appear once.');
        return;
      }
      
      // Check if strategies are defined
      if (!config.PORTFOLIO_STRATEGIES || Object.keys(config.PORTFOLIO_STRATEGIES).length === 0) {
        alert('Error: Portfolio mode requires strategy parameters for each ticker.\n\nNote: The system will auto-populate default RSI parameters if none are specified.');
        // Don't return - let the auto-population handle it
      }
      
      // Check if weights sum correctly (should be 1.0 after normalization)
      if (config.PORTFOLIO_WEIGHTS) {
        const weightSum = Object.values(config.PORTFOLIO_WEIGHTS).reduce((sum, w) => sum + w, 0);
        if (Math.abs(weightSum - 1.0) > 0.01) {
          console.warn(`[BACKTEST] Portfolio weights sum to ${weightSum.toFixed(4)}, expected ~1.0`);
        }
      }
    }
    
    // Disable button and show loading state
    runBacktestBtn.disabled = true;
    runBacktestBtn.textContent = 'Starting Backtest...';
    runBacktestBtn.classList.add('loading');
    
    try {
      // Run backtest (this will trigger progress events)
      console.log('[BACKTEST] Starting backtest...');
      const response = await window.electronAPI.backtestRun(config);
      
      if (!response.success) {
        // Immediate failure (before process could start)
        runBacktestBtn.disabled = false;
        runBacktestBtn.textContent = 'Run Backtest';
        runBacktestBtn.classList.remove('loading');
        alert(`Error starting backtest:\n\n${response.error}`);
      }
      // Otherwise, wait for progress/complete events
      
    } catch (error) {
      console.error('[BACKTEST] Error running backtest:', error);
      runBacktestBtn.disabled = false;
      runBacktestBtn.textContent = 'Run Backtest';
      runBacktestBtn.classList.remove('loading');
      alert(`Error starting backtest:\n\n${error.message}`);
    }
  });
}

// ========================================
// Config Management (Folders & Save/Load)
// ========================================

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

// Load Config Modal
function openLoadConfigModal() {
  const modal = document.getElementById('loadConfigModal');
  const container = document.getElementById('configListContainer');
  
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
          <span class="folder-icon">📁</span>
          <span class="folder-name">${folder.name}</span>
          <span class="folder-count">${configs.length}</span>
        </div>
        <div class="config-folder-items"></div>
      `;
      
      const itemsContainer = folderDiv.querySelector('.config-folder-items');
      configs.forEach(cfg => {
        const item = document.createElement('div');
        item.className = 'config-item';
        const savedDate = new Date(cfg.saved_at).toLocaleDateString();
        item.innerHTML = `
          <div class="config-item-info">
            <div class="config-item-name">${cfg.name}</div>
            <div class="config-item-date">Saved: ${savedDate}</div>
          </div>
          <div class="config-item-actions">
            <button class="btn-sm" onclick="loadConfigById(${cfg.id})">Load</button>
            <button class="btn-sm danger" onclick="deleteConfigById(${cfg.id})">Delete</button>
          </div>
        `;
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

function closeLoadConfigModal() {
  document.getElementById('loadConfigModal').style.display = 'none';
}
window.closeLoadConfigModal = closeLoadConfigModal;

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
      console.log('[COLOR] Loaded', cssVarName, '=', value);
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
const MAIN_TABS = ['home', 'screener', 'watchlists', 'charting', 'rsi', 'backtesting', 'results'];

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
  
  // Global keyboard shortcut handler
  document.addEventListener('keydown', (e) => {
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
    
    // Don't handle shortcuts when typing in inputs (except specific modals)
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT') {
      return;
    }
    
    // Ctrl+PageUp: Previous tab
    if (e.ctrlKey && e.key === 'PageUp') {
      e.preventDefault();
      const currentIndex = MAIN_TABS.findIndex(tab => 
        document.getElementById(`${tab}Page`)?.classList.contains('active')
      );
      console.log('[SHORTCUT] PageUp, current index:', currentIndex);
      if (currentIndex > 0) {
        switchMainTab(MAIN_TABS[currentIndex - 1]);
      }
      return;
    }
    
    // Ctrl+PageDown: Next tab
    if (e.ctrlKey && e.key === 'PageDown') {
      e.preventDefault();
      const currentIndex = MAIN_TABS.findIndex(tab => 
        document.getElementById(`${tab}Page`)?.classList.contains('active')
      );
      console.log('[SHORTCUT] PageDown, current index:', currentIndex);
      if (currentIndex < MAIN_TABS.length - 1) {
        switchMainTab(MAIN_TABS[currentIndex + 1]);
      }
      return;
    }
    
    // Ctrl+1 through Ctrl+7: Direct tab access
    if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      console.log('[SHORTCUT] Ctrl+' + e.key + ', switching to:', MAIN_TABS[index]);
      if (index < MAIN_TABS.length) {
        switchMainTab(MAIN_TABS[index]);
      }
      return;
    }
  });
  
  console.log('[SETTINGS] Keyboard shortcuts registered');
});

// MUST be at end of file after all functions are defined
console.log('[INIT] Exposing functions to window scope...');
window.sortByColumn = sortByColumn;
window.promptSavePortfolioAsStrategy = promptSavePortfolioAsStrategy;
window.createNewFolder = createNewFolder;
// Note: All onclick handler functions are now exposed to window immediately after their definitions
// This ensures they're available when HTML with onclick handlers is dynamically generated
// No need for duplicate assignments here - all functions are already exposed above
