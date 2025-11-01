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
    }
  }
}));

app.listen(PORT, () => {
  console.log(`🚀 alpharhythm server running on http://localhost:${PORT}`);
  console.log(`📊 Home: http://localhost:${PORT}`);
  console.log(`📈 Charting: http://localhost:${PORT}#charting`);
  console.log(`💰 Financials: http://localhost:${PORT}#financials`);
  console.log(`📉 RSI Dashboard: http://localhost:${PORT}#rsi`);
});
