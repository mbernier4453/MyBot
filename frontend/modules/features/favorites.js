/**
 * Favorites Management Module
 * Handles saved strategies, portfolios, folders, and favorites UI
 */

import * as State from '../core/state.js';

const FavoritesUI = {
  async loadFavorites() {
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
        this.displayFavorites(favoritesResult.data, foldersResult.data);
      } else {
        console.error('[DEBUG] Failed to load:', { favoritesResult, foldersResult });
      }
    } catch (error) {
      console.error('[DEBUG] Error loading favorites:', error);
      console.error('[DEBUG] Error stack:', error.stack);
    }
    console.log('[DEBUG] loadFavorites() END');
  },

  displayFavorites(favorites, folders) {
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
            <div class="folder-header" onclick="window.FavoritesUI.toggleFolder(${folder.id})">
              <span class="folder-icon" style="color: ${folder.color || '#888'};">📁</span>
              <span class="folder-name">${folder.name}</span>
              <span class="folder-count">(${folderFavs.length})</span>
              <button class="btn-delete-folder" onclick="event.stopPropagation(); window.FavoritesUI.deleteFolderPrompt(${folder.id}, '${folder.name}')" title="Delete folder">
                ★
              </button>
            </div>
            <div class="folder-content" id="folder-${folder.id}" style="display: none;">
              ${folderFavs.length > 0 
                ? folderFavs.map(fav => this.renderFavoriteItem(fav)).join('') 
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
          <div class="folder-header" onclick="window.FavoritesUI.toggleFolder('uncategorized')">
            <span class="folder-icon">📋</span>
            <span class="folder-name">Uncategorized</span>
            <span class="folder-count">(${uncategorized.length})</span>
          </div>
          <div class="folder-content" id="folder-uncategorized" style="display: none;">
            ${uncategorized.map(fav => this.renderFavoriteItem(fav)).join('')}
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
  },

  renderFavoriteItem(fav) {
    const typeLabel = fav.type === 'strategy' ? 'Single' : 'Portfolio';
    const typeClass = fav.type === 'strategy' ? 'strategy' : 'portfolio';
    
    return `
      <div class="favorite-item" onclick="window.FavoritesUI.loadFavorite('${fav.id}', '${fav.type}', '${fav.run_id}', '${fav.ticker || ''}')">
        <div class="favorite-info">
          <span class="favorite-type-badge ${typeClass}">${typeLabel}</span>
          <span class="favorite-name">${fav.name}</span>
        </div>
        <div class="favorite-actions">
          <button class="btn-move-folder" onclick="event.stopPropagation(); window.FavoritesUI.showMoveToFolderDialog(${fav.id})" title="Move to folder">
            📁
          </button>
          <button class="unfavorite-btn" onclick="event.stopPropagation(); window.FavoritesUI.removeFavorite(${fav.id})" title="Remove">
            ★
          </button>
        </div>
      </div>
    `;
  },

  toggleFolder(folderId) {
    const content = document.getElementById(`folder-${folderId}`);
    if (content) {
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    }
  },

  // Folder management
  promptCreateFolder() {
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
          window.setStatus(`Folder "${name}" created`);
          console.log('Reloading favorites after folder creation...');
          await this.loadFavorites();
        } else {
          window.setStatus('Failed to create folder: ' + result.error, true);
        }
      }
    };
    
    confirmBtn.onclick = handleCreate;
    nameInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        handleCreate();
      }
    };
  },

  closeCreateFolderModal() {
    document.getElementById('createFolderModal').style.display = 'none';
  },

  createNewFolder() {
    this.promptCreateFolder();
  },

  deleteFolderPrompt(folderId, folderName) {
    const modal = document.getElementById('deleteFolderModal');
    const messageEl = document.getElementById('deleteFolderMessage');
    const confirmBtn = document.getElementById('confirmDeleteFolderBtn');
    
    messageEl.textContent = `Delete folder "${folderName}"?`;
    modal.style.display = 'flex';
    
    const handleDelete = async () => {
      modal.style.display = 'none';
      const result = await window.electronAPI.deleteFolder(folderId);
      if (result.success) {
        window.setStatus(`Folder "${folderName}" deleted`);
        await this.loadFavorites();
      } else {
        window.setStatus('Failed to delete folder', true);
      }
    };
    
    confirmBtn.onclick = handleDelete;
  },

  closeDeleteFolderModal() {
    document.getElementById('deleteFolderModal').style.display = 'none';
  },

  async showMoveToFolderDialog(favoriteId) {
    const foldersResult = await window.electronAPI.getFolders();
    if (!foldersResult.success || foldersResult.data.length === 0) {
      alert('No folders available. Create a folder first.');
      return;
    }
    
    // Create a custom modal instead of using prompt()
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.4);';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background-color: var(--bg-secondary); margin: auto; padding: 20px; border: 1px solid var(--border-color); width: 400px; border-radius: 8px;';
    
    const folderOptions = foldersResult.data
      .map(f => `<option value="${f.id}">${f.name}</option>`)
      .join('');
    
    modalContent.innerHTML = `
      <h3 style="color: var(--text-primary); margin-top: 0;">Move to Folder</h3>
      <select id="moveFolderSelect" style="width: 100%; padding: 8px; margin: 10px 0; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color);">
        <option value="0">Uncategorized</option>
        ${folderOptions}
      </select>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button id="moveFolderCancel" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); cursor: pointer; border-radius: 4px;">Cancel</button>
        <button id="moveFolderConfirm" style="padding: 8px 16px; background: var(--accent-blue); color: var(--text-primary); border: none; cursor: pointer; border-radius: 4px;">Move</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Handle button clicks
    document.getElementById('moveFolderCancel').onclick = () => {
      document.body.removeChild(modal);
    };
    
    document.getElementById('moveFolderConfirm').onclick = async () => {
      const folderId = parseInt(document.getElementById('moveFolderSelect').value);
      document.body.removeChild(modal);
      
      const result = await window.electronAPI.moveToFolder(favoriteId, folderId);
      if (result.success) {
        window.setStatus('Moved to folder');
        await this.loadFavorites();
      } else {
        window.setStatus('Failed to move to folder', true);
      }
    };
  },

  // Load a favorite
  async loadFavorite(id, type, runId, ticker) {
    console.log('[FAVORITE] Loading favorite:', { id, type, runId, ticker });
    
    // Find the run in State.getAllRuns()
    const run = State.getAllRuns().find(r => r.run_id === runId);
    if (!run) {
      console.error('[FAVORITE] Run not found:', runId, 'Available runs:', State.getAllRuns().map(r => r.run_id));
      window.setStatus('Run not found in database - please select the database containing this run first', true);
      return;
    }
    
    console.log('[FAVORITE] Found run:', run);
    
    // Set the current run using State
    State.setCurrentRun(run);
    
    // Switch to results page
    const resultsTab = document.querySelector('[data-main-tab="results"]');
    if (resultsTab) {
      resultsTab.click();
    }
    
    // Load the run data
    if (window.updateTabVisibility) {
      window.updateTabVisibility();
    }
    if (window.loadRunDetails) {
      window.loadRunDetails(run);
    }
    
    // Load appropriate data based on mode
    if (run.mode === 'portfolio') {
      if (window.loadPortfolio) {
        await window.loadPortfolio(runId);
      }
      if (window.loadTrades) {
        await window.loadTrades(runId);
      }
      // Switch to portfolio tab
      window.switchToTab('portfolio');
    } else {
      // Single mode - load strategies
      if (window.loadStrategies) {
        await window.loadStrategies(runId);
      }
      
      // Switch to strategies tab
      window.switchToTab('strategies');
      
      // If it's a strategy favorite, try to select the specific ticker
      if (type === 'strategy' && ticker) {
        setTimeout(() => {
          const strategyRow = document.querySelector(`tr[data-ticker="${ticker}"]`);
          if (strategyRow) {
            console.log('[FAVORITE] Selecting strategy row for ticker:', ticker);
            strategyRow.click();
          } else {
            console.warn('[FAVORITE] Strategy row not found for ticker:', ticker);
          }
        }, 500);
      }
    }
    
    window.setStatus(`Loaded favorite: ${run.run_id}`);
  },

  // Add to favorites
  async addToFavorites(type, name, runId, ticker = null, additionalData = {}) {
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
          window.setStatus(`Added "${finalName}" to saved strategies`);
          await this.loadFavorites();
        } else {
          console.error('Backend error:', result.error);
          window.setStatus(`Failed to add to favorites: ${result.error}`, true);
        }
      } catch (error) {
        console.error('Error adding to favorites:', error);
        window.setStatus('Error adding to favorites: ' + error.message, true);
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
  },

  // Remove from favorites
  async removeFavorite(id) {
    try {
      console.time('removeFavorite');
      console.log('Removing favorite:', id);
      const result = await window.electronAPI.removeFavorite(id);
      console.timeEnd('removeFavorite');
      console.log('Remove result:', result);
      
      if (result.success) {
        window.setStatus('Removed from favorites');
        console.time('loadFavorites after remove');
        await this.loadFavorites();
        console.timeEnd('loadFavorites after remove');
      } else {
        window.setStatus('Failed to remove from favorites', true);
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      window.setStatus('Error removing favorite', true);
    }
  },

  // Save portfolio as strategy
  async savePortfolioAsStrategy(runId, name, folderId = null) {
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
        window.setStatus(`Saved portfolio "${name}" with ${tickers.length} tickers`);
        await this.loadFavorites();
      } else {
        console.error('Backend error:', result.error);
        window.setStatus(`Failed: ${result.error}`, true);
      }
    } catch (error) {
      console.error('Error saving portfolio as strategy:', error);
      window.setStatus('Error: ' + error.message, true);
    }
  },

  async promptSavePortfolioAsStrategy(runId) {
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
        await this.savePortfolioAsStrategy(runId, name, folderId);
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
  },

  closeSaveStrategyModal() {
    document.getElementById('saveStrategyModal').style.display = 'none';
  },

  // Open create folder modal from strategy save modal
  async openCreateFolderModalFromStrategy() {
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
};

// Export for use in other modules
export { FavoritesUI };

// Also expose globally for onclick handlers in HTML
window.FavoritesUI = FavoritesUI;
console.log('[INIT] FavoritesUI module loaded');
