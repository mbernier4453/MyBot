/**
 * Socket.io Client Module
 * Connects to our server's WebSocket manager instead of Polygon directly
 */

class SocketIOClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscribers = new Map(); // callback functions for ticker updates
    this.statusCallbacks = [];
  }

  /**
   * Connect to our server's Socket.io
   */
  connect() {
    if (this.socket && this.isConnected) {
      console.log('[SOCKET.IO] Already connected');
      return;
    }

    console.log('[SOCKET.IO] Connecting to server WebSocket...');
    
    // Connect to the same host (works for both local and production)
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('[SOCKET.IO] Connected to server');
      this.isConnected = true;
      this.notifyStatus({ connected: true });
    });

    this.socket.on('disconnect', () => {
      console.log('[SOCKET.IO] Disconnected from server');
      this.isConnected = false;
      this.notifyStatus({ connected: false });
    });

    // Handle batched polygon updates
    this.socket.on('polygon-batch', (updates) => {
      if (!Array.isArray(updates)) return;
      
      updates.forEach(data => {
        // Call all registered callbacks for this ticker
        const callbacks = this.subscribers.get(data.ticker);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error(`[SOCKET.IO] Error in subscriber callback for ${data.ticker}:`, error);
            }
          });
        }
        
        // Also call wildcard subscribers
        const wildcardCallbacks = this.subscribers.get('*');
        if (wildcardCallbacks) {
          wildcardCallbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('[SOCKET.IO] Error in wildcard subscriber callback:', error);
            }
          });
        }
      });
    });

    // Handle connection status updates
    this.socket.on('polygon-status', (status) => {
      console.log('[SOCKET.IO] Polygon status:', status);
      this.notifyStatus(status);
    });

    this.socket.on('error', (error) => {
      console.error('[SOCKET.IO] Socket error:', error);
      this.notifyStatus({ connected: false, error });
    });
  }

  /**
   * Subscribe to ticker updates
   * @param {string|string[]} tickers - Ticker symbol(s) to subscribe to
   * @param {Function} callback - Called when ticker data is received
   * @returns {Function} Unsubscribe function
   */
  subscribe(tickers, callback) {
    if (!callback || typeof callback !== 'function') {
      console.error('[SOCKET.IO] Invalid callback function');
      return () => {};
    }

    const tickerArray = Array.isArray(tickers) ? tickers : [tickers];
    
    // Register callbacks
    tickerArray.forEach(ticker => {
      if (!this.subscribers.has(ticker)) {
        this.subscribers.set(ticker, new Set());
      }
      this.subscribers.get(ticker).add(callback);
    });

    // Tell server to subscribe to these tickers
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-tickers', tickerArray);
      console.log(`[SOCKET.IO] Subscribed to ${tickerArray.length} tickers`);
    }

    // Return unsubscribe function
    return () => {
      tickerArray.forEach(ticker => {
        const callbacks = this.subscribers.get(ticker);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscribers.delete(ticker);
          }
        }
      });
      
      if (this.socket && this.isConnected) {
        this.socket.emit('unsubscribe-tickers', tickerArray);
      }
    };
  }

  /**
   * Subscribe to all ticker updates
   */
  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  /**
   * Add status change listener
   */
  onStatus(callback) {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all status listeners
   */
  notifyStatus(status) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[SOCKET.IO] Error in status callback:', error);
      }
    });
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      subscribedTickers: Array.from(this.subscribers.keys()).filter(t => t !== '*')
    };
  }
}

// Create singleton instance
const socketIOClient = new SocketIOClient();

// Auto-connect when loaded
socketIOClient.connect();

// Export for use in other modules
window.socketIOClient = socketIOClient;
