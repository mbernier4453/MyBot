const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config(); // Loads from frontend/.env

// Debug: Check if API key loaded
console.log('[SERVER] POLYGON_API_KEY loaded:', process.env.POLYGON_API_KEY ? 'YES' : 'NO');
console.log('[SERVER] API Key value:', process.env.POLYGON_API_KEY?.substring(0, 15) + '...');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io with compression enabled
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  perMessageDeflate: {
    threshold: 1024 // Compress messages larger than 1KB
  }
});

// Initialize WebSocket Manager
const WebSocketManager = require('./modules/websocket/websocket_manager');
const wsManager = new WebSocketManager(io);
wsManager.init();

// Maintenance mode middleware - PLACE THIS FIRST
const MAINTENANCE_MODE = false; // Set to false to disable
const BYPASS_KEY = 'alpha2025dev'; // Secret key to bypass maintenance

app.use((req, res, next) => {
  console.log(`[MAINTENANCE CHECK] ${req.method} ${req.path} - Mode: ${MAINTENANCE_MODE}`);
  
  // Skip for static assets, API, WebSocket
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|csv|json)$/) ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/socket.io/')) {
    return next();
  }
  
  if (MAINTENANCE_MODE) {
    // Check for bypass key in query parameter
    if (req.query.bypass === BYPASS_KEY) {
      console.log(`[MAINTENANCE] Valid bypass key - allowing access`);
      return next();
    }
    
    console.log(`[MAINTENANCE] Serving maintenance page for ${req.path}`);
    return res.status(503).sendFile(__dirname + '/maintenance.html');
  }
  
  next();
});

// Enable CORS for API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve the S&P 500 CSV from parent directory
app.get('/spy503.csv', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'spy503.csv'));
});

// Proxy for backend API (regression endpoint)
app.post('/api/regression/calculate', express.json(), async (req, res) => {
  try {
    // Use built-in fetch (Node 18+) or require http module
    const http = require('http');
    
    const postData = JSON.stringify(req.body);
    
    const options = {
      hostname: '127.0.0.1',  // Use IPv4 explicitly to avoid IPv6 connection issues
      port: 5000,
      path: '/api/regression/calculate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      let data = '';
      
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });
      
      proxyRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.status(proxyRes.statusCode).json(jsonData);
        } catch (e) {
          res.status(500).json({ success: false, error: 'Invalid JSON response from backend' });
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('Regression proxy error:', error);
      res.status(500).json({ success: false, error: error.message });
    });
    
    proxyReq.write(postData);
    proxyReq.end();
    
  } catch (error) {
    console.error('Regression proxy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route for root - serve auth page (BEFORE static middleware)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/auth.html');
});

// Route for main app (after login)
app.get('/app', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Route for password reset
app.get('/reset-password', (req, res) => {
  res.sendFile(__dirname + '/reset-password.html');
});

// Serve static files from the current directory with proper MIME types
// This comes AFTER routes so index.html isn't auto-served on /
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Disable caching for JS, CSS, and HTML files during development
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
    
    // Set proper MIME types for modules
    if (filePath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.mjs')) {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.set('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.set('Content-Type', 'application/json; charset=utf-8');
    } else if (filePath.endsWith('.csv')) {
      res.set('Content-Type', 'text/csv; charset=utf-8');
    }
  }
}));

// API endpoint for WebSocket stats
app.get('/api/ws-stats', (req, res) => {
  res.json(wsManager.getStats());
});

server.listen(PORT, () => {
  console.log(`🚀 αlpharhythm server running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket Manager: ACTIVE`);
  console.log(`🔗 Welcome: http://localhost:${PORT}`);
  console.log(`📈 App: http://localhost:${PORT}/app`);
});
