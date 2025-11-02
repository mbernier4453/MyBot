const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve static files from the current directory with proper MIME types
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
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

app.listen(PORT, () => {
  console.log(`🚀 αlpharhythm server running on http://localhost:${PORT}`);
  console.log(`📊 Home: http://localhost:${PORT}`);
  console.log(`📈 Charting: http://localhost:${PORT}#charting`);
  console.log(`💰 Financials: http://localhost:${PORT}#financials`);
  console.log(`📉 RSI Dashboard: http://localhost:${PORT}#rsi`);
});
