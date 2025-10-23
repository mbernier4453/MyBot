/**
 * Ticker Groups Module
 * Manages ticker groups that sync across charts, financials, and ratios tabs
 */

class TickerGroupManager {
  constructor() {
    this.groups = new Map(); // groupId -> { ticker, subscribers }
    this.activeGroup = null;
  }

  /**
   * Create or update a group with a ticker
   */
  setGroupTicker(groupId, ticker) {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        ticker: ticker,
        subscribers: new Set()
      });
    } else {
      this.groups.get(groupId).ticker = ticker;
    }

    // Notify all subscribers
    this.notifySubscribers(groupId, ticker);
    
    // Save to localStorage
    this.saveToStorage();
    
    console.log(`[TICKER-GROUPS] Set group ${groupId} ticker to ${ticker}`);
  }

  /**
   * Get ticker for a group
   */
  getGroupTicker(groupId) {
    return this.groups.get(groupId)?.ticker || null;
  }

  /**
   * Subscribe to ticker changes for a group
   */
  subscribe(groupId, callback) {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        ticker: null,
        subscribers: new Set()
      });
    }
    
    this.groups.get(groupId).subscribers.add(callback);
    
    // Immediately call with current ticker if exists
    const currentTicker = this.groups.get(groupId).ticker;
    if (currentTicker) {
      callback(currentTicker);
    }
  }

  /**
   * Unsubscribe from ticker changes
   */
  unsubscribe(groupId, callback) {
    if (this.groups.has(groupId)) {
      this.groups.get(groupId).subscribers.delete(callback);
    }
  }

  /**
   * Notify all subscribers of a ticker change
   */
  notifySubscribers(groupId, ticker) {
    if (!this.groups.has(groupId)) return;
    
    const subscribers = this.groups.get(groupId).subscribers;
    subscribers.forEach(callback => {
      try {
        callback(ticker);
      } catch (error) {
        console.error('[TICKER-GROUPS] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Set active group
   */
  setActiveGroup(groupId) {
    this.activeGroup = groupId;
    this.saveToStorage();
    console.log(`[TICKER-GROUPS] Active group set to ${groupId}`);
  }

  /**
   * Get active group
   */
  getActiveGroup() {
    return this.activeGroup || 'A';
  }

  /**
   * Get all groups
   */
  getAllGroups() {
    return Array.from(this.groups.keys());
  }

  /**
   * Delete a group
   */
  deleteGroup(groupId) {
    this.groups.delete(groupId);
    this.saveToStorage();
    console.log(`[TICKER-GROUPS] Deleted group ${groupId}`);
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    const data = {
      activeGroup: this.activeGroup,
      groups: {}
    };
    
    this.groups.forEach((value, key) => {
      data.groups[key] = {
        ticker: value.ticker
      };
    });
    
    localStorage.setItem('tickerGroups', JSON.stringify(data));
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('tickerGroups');
      if (stored) {
        const data = JSON.parse(stored);
        this.activeGroup = data.activeGroup || 'A';
        
        if (data.groups) {
          Object.entries(data.groups).forEach(([groupId, groupData]) => {
            this.groups.set(groupId, {
              ticker: groupData.ticker,
              subscribers: new Set()
            });
          });
        }
        
        console.log('[TICKER-GROUPS] Loaded from storage:', this.groups.size, 'groups');
      }
    } catch (error) {
      console.error('[TICKER-GROUPS] Error loading from storage:', error);
    }
  }
}

// Create singleton instance
const tickerGroups = new TickerGroupManager();

// Load on initialization
tickerGroups.loadFromStorage();

export default tickerGroups;
window.tickerGroups = tickerGroups;
