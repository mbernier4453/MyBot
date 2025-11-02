/**
 * WebSocket Manager - Server-side Polygon WebSocket handler
 * 
 * This module:
 * 1. Opens ONE WebSocket connection to Polygon
 * 2. Receives all ticker updates from Polygon
 * 3. Broadcasts updates to all connected users via Socket.io
 * 4. Implements throttling and batching for performance
 */

const WebSocket = require('ws');

class WebSocketManager {
  constructor(io) {
    this.io = io;
    this.polygonWs = null;
    this.subscribedTickers = new Set();
    this.updateBuffer = new Map(); // ticker -> latest data
    this.broadcastInterval = null;
    this.isConnected = false;
    
    // Configuration
    this.TICK_RATE = 250; // ms - send updates 4x per second
    this.POLYGON_API_KEY = process.env.POLYGON_API_KEY;
    
    if (!this.POLYGON_API_KEY) {
      console.error('[WS_MANAGER] No POLYGON_API_KEY found in environment');
    }
  }

  /**
   * Initialize the WebSocket manager
   */
  init() {
    console.log('[WS_MANAGER] Initializing WebSocket manager...');
    
    // Start broadcast ticker
    this.startBroadcastTicker();
    
    // Handle Socket.io connections from users
    this.io.on('connection', (socket) => {
      console.log(`[WS_MANAGER] User connected: ${socket.id}`);
      
      // Send current buffered data to new user
      if (this.updateBuffer.size > 0) {
        const bufferedData = Array.from(this.updateBuffer.values());
        socket.emit('polygon-batch', bufferedData);
      }
      
      // Handle subscription requests from user
      socket.on('subscribe-tickers', (tickers) => {
        this.subscribeToTickers(tickers);
      });
      
      socket.on('unsubscribe-tickers', (tickers) => {
        this.unsubscribeFromTickers(tickers);
      });
      
      socket.on('disconnect', () => {
        console.log(`[WS_MANAGER] User disconnected: ${socket.id}`);
      });
    });
    
    // Connect to Polygon
    this.connectToPolygon();
  }

  /**
   * Connect to Polygon WebSocket
   */
  connectToPolygon() {
    if (this.polygonWs && this.polygonWs.readyState === WebSocket.OPEN) {
      console.log('[WS_MANAGER] Already connected to Polygon');
      return;
    }

    console.log('[WS_MANAGER] Connecting to Polygon WebSocket...');
    
    this.polygonWs = new WebSocket('wss://socket.polygon.io/stocks');

    this.polygonWs.on('open', () => {
      console.log('[WS_MANAGER] Connected to Polygon WebSocket');
      this.isConnected = true;
      
      // Authenticate
      this.polygonWs.send(JSON.stringify({
        action: 'auth',
        params: this.POLYGON_API_KEY
      }));
      
      // Resubscribe to tickers if we had any
      if (this.subscribedTickers.size > 0) {
        const tickers = Array.from(this.subscribedTickers);
        this.sendSubscription(tickers);
      }
      
      // Notify all connected users
      this.io.emit('polygon-status', { connected: true });
    });

    this.polygonWs.on('message', (data) => {
      try {
        const messages = JSON.parse(data);
        
        if (!Array.isArray(messages)) return;
        
        messages.forEach((msg) => {
          if (msg.ev === 'A' || msg.ev === 'AM') {
            // Aggregate bar or Minute bar
            const tickerData = {
              ticker: msg.sym,
              price: msg.c,
              open: msg.o,
              high: msg.h,
              low: msg.l,
              volume: msg.v,
              vwap: msg.vw,
              change: msg.c - msg.o,
              changePercent: ((msg.c - msg.o) / msg.o) * 100,
              timestamp: msg.s || msg.e,
              eventType: msg.ev
            };
            
            // Buffer the update (will be sent in batches)
            this.updateBuffer.set(msg.sym, tickerData);
            
          } else if (msg.ev === 'status') {
            console.log(`[WS_MANAGER] Polygon status: ${msg.message}`);
            if (msg.status === 'auth_success') {
              console.log('[WS_MANAGER] Authenticated with Polygon');
            }
          }
        });
      } catch (error) {
        console.error('[WS_MANAGER] Error parsing Polygon message:', error);
      }
    });

    this.polygonWs.on('error', (error) => {
      console.error('[WS_MANAGER] Polygon WebSocket error:', error);
      this.isConnected = false;
      this.io.emit('polygon-status', { connected: false, error: error.message });
    });

    this.polygonWs.on('close', () => {
      console.log('[WS_MANAGER] Polygon WebSocket closed. Reconnecting in 5s...');
      this.isConnected = false;
      this.io.emit('polygon-status', { connected: false });
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        this.connectToPolygon();
      }, 5000);
    });
  }

  /**
   * Subscribe to tickers on Polygon
   */
  subscribeToTickers(tickers) {
    if (!Array.isArray(tickers) || tickers.length === 0) return;
    
    // Add to our set
    tickers.forEach(ticker => this.subscribedTickers.add(ticker));
    
    // Send to Polygon if connected
    if (this.isConnected) {
      this.sendSubscription(tickers);
    }
    
    console.log(`[WS_MANAGER] Subscribed to ${tickers.length} tickers. Total: ${this.subscribedTickers.size}`);
  }

  /**
   * Unsubscribe from tickers
   */
  unsubscribeFromTickers(tickers) {
    if (!Array.isArray(tickers) || tickers.length === 0) return;
    
    tickers.forEach(ticker => this.subscribedTickers.delete(ticker));
    
    if (this.isConnected) {
      this.polygonWs.send(JSON.stringify({
        action: 'unsubscribe',
        params: tickers.map(t => `AM.${t}`) // Minute bars
      }));
    }
    
    console.log(`[WS_MANAGER] Unsubscribed from ${tickers.length} tickers. Remaining: ${this.subscribedTickers.size}`);
  }

  /**
   * Send subscription to Polygon
   */
  sendSubscription(tickers) {
    if (!this.polygonWs || this.polygonWs.readyState !== WebSocket.OPEN) {
      console.warn('[WS_MANAGER] Cannot subscribe - not connected to Polygon');
      return;
    }
    
    // Subscribe to minute aggregates (AM) for each ticker
    this.polygonWs.send(JSON.stringify({
      action: 'subscribe',
      params: tickers.map(t => `AM.${t}`)
    }));
  }

  /**
   * Broadcast buffered updates to all connected users
   * Runs every TICK_RATE milliseconds
   */
  startBroadcastTicker() {
    this.broadcastInterval = setInterval(() => {
      if (this.updateBuffer.size > 0) {
        // Convert buffer to array
        const updates = Array.from(this.updateBuffer.values());
        
        // Broadcast to all connected Socket.io clients
        this.io.emit('polygon-batch', updates);
        
        // Clear buffer (we keep the last value for new users)
        // Don't clear - keep last known values for late joiners
        
        // Log stats
        if (updates.length > 0) {
          const userCount = this.io.engine.clientsCount || 0;
          console.log(`[WS_MANAGER] Broadcasted ${updates.length} updates to ${userCount} users`);
        }
      }
    }, this.TICK_RATE);
  }

  /**
   * Stop the WebSocket manager
   */
  stop() {
    console.log('[WS_MANAGER] Stopping WebSocket manager...');
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    
    if (this.polygonWs) {
      this.polygonWs.close();
    }
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      subscribedTickers: this.subscribedTickers.size,
      bufferedUpdates: this.updateBuffer.size,
      connectedUsers: this.io.engine.clientsCount || 0
    };
  }
}

module.exports = WebSocketManager;
