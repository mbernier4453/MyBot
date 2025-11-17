/**
 * Ticker Groups Module
 * Manages ticker groups that sync across charts, financials, and ratios tabs
 */

import { saveTickerGroups, getUserSettings } from '../../supabase-client.js';

class TickerGroupManager {
  constructor() {
    this.groups = new Map(); // groupId -> { ticker, subscribers }
    this.activeGroup = 'None'; // Default to None group
  }

  /**
   * Create or update a group with a ticker
   */
  setGroupTicker(groupId, ticker) {
    // Skip if using None group
    if (groupId === 'None') {
      console.log(`[TICKER-GROUPS] Skipping group sync for None group`);
      return;
    }
    
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
    if (groupId === 'None') return null;
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
    return this.activeGroup || 'None';
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
   * Save to Supabase (with localStorage fallback)
   */
  async saveToStorage() {
    const data = {
      activeGroup: this.activeGroup,
      groups: {}
    };
    
    this.groups.forEach((value, key) => {
      data.groups[key] = {
        ticker: value.ticker
      };
    });
    
    try {
      // Save to Supabase
      await saveTickerGroups(data);
      console.log('[TICKER-GROUPS] ✅ Saved to Supabase:', Object.keys(data.groups).length, 'groups');
    } catch (error) {
      console.error('[TICKER-GROUPS] ❌ Failed to save to Supabase:', error);
      // Fallback to localStorage if Supabase fails
      localStorage.setItem('tickerGroups', JSON.stringify(data));
      console.warn('[TICKER-GROUPS] Saved to localStorage as fallback');
    }
  }

  /**
   * Load from Supabase (with localStorage fallback)
   */
  async loadFromStorage() {
    try {
      // Try loading from Supabase first
      const settings = await getUserSettings();
      
      if (settings && settings.ticker_groups) {
        const data = settings.ticker_groups;
        this.activeGroup = data.activeGroup || 'None';
        
        if (data.groups) {
          Object.entries(data.groups).forEach(([groupId, groupData]) => {
            this.groups.set(groupId, {
              ticker: groupData.ticker,
              subscribers: new Set()
            });
          });
        }
        
        console.log('[TICKER-GROUPS] ✅ Loaded from Supabase:', this.groups.size, 'groups');
        return;
      } else {
        console.log('[TICKER-GROUPS] ⚠️ No groups in Supabase, using defaults');
      }
    } catch (error) {
      // If Supabase fails, try localStorage fallback (for migration)
      if (error.message === 'Not authenticated') {
        console.log('[TICKER-GROUPS] User not authenticated yet, will load after auth');
      } else {
        console.error('[TICKER-GROUPS] ❌ Error loading from Supabase:', error);
        
        // Try localStorage fallback
        try {
          const stored = localStorage.getItem('tickerGroups');
          if (stored) {
            const data = JSON.parse(stored);
            this.activeGroup = data.activeGroup || 'None';
            
            if (data.groups) {
              Object.entries(data.groups).forEach(([groupId, groupData]) => {
                this.groups.set(groupId, {
                  ticker: groupData.ticker,
                  subscribers: new Set()
                });
              });
            }
            
            console.log('[TICKER-GROUPS] Loaded from localStorage fallback:', this.groups.size, 'groups');
            
            // Migrate to Supabase
            await this.saveToStorage();
          }
        } catch (fallbackError) {
          console.error('[TICKER-GROUPS] Error loading from localStorage fallback:', fallbackError);
        }
      }
    }
  }
}

// Create singleton instance
const tickerGroups = new TickerGroupManager();

// Load will be called after authentication in renderer.js
// Don't auto-load here since user might not be authenticated yet

export default tickerGroups;
window.tickerGroups = tickerGroups;
