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

// Serve static files from the current directory
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Set proper MIME types
    if (filePath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    } else if (filePath.endsWith('.json')) {
      res.set('Content-Type', 'application/json');
    }
  }
}));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 alpharhythm server running on http://localhost:${PORT}`);
  console.log(`📊 Home: http://localhost:${PORT}`);
  console.log(`📈 Charting: http://localhost:${PORT}#charting`);
  console.log(`💰 Financials: http://localhost:${PORT}#financials`);
  console.log(`📉 RSI Dashboard: http://localhost:${PORT}#rsi`);
});
