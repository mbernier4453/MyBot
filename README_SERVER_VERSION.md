# Alpharhythm - Server Version 1.0

A real-time stock market analysis platform featuring live S&P 500 data, interactive charting, financial analysis, and RSI-based screening.

## Features

### 🏠 Home Dashboard
- Real-time S&P 500 treemap with live price updates
- Color-coded by daily performance (green = up, red = down)
- Sector grouping and market cap sizing
- WebSocket integration for instant updates
- Click any stock for detailed fundamentals

### 📈 Charting
- Interactive price charts with multiple timeframes
- Technical indicators:
  - Moving Averages (SMA, EMA, HMA, KAMA)
  - Bollinger Bands
  - RSI, MACD, Volume
- Customizable chart settings
- Save/load configurations

### 💰 Financials
- Balance Sheet
- Income Statement  
- Cash Flow Statement
- Financial Ratios
- Multi-period comparisons

### 📉 RSI Dashboard
- Real-time RSI screener for all S&P 500 stocks
- Overbought/Oversold identification
- Customizable RSI thresholds
- Sort and filter capabilities

## Quick Start

### Desktop (Development)
```bash
cd frontend
npm install
npm start
```

### Web Server (Production)
```bash
cd frontend
npm install
npm run serve
```

Visit `http://localhost:3000`

## Deployment

See detailed guides:
- **Quick Setup**: [QUICK_SERVER_SETUP.md](QUICK_SERVER_SETUP.md)
- **Full Deployment**: [SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md)

## Configuration

Edit `frontend/config.js`:
```javascript
window.APP_CONFIG = {
  POLYGON_API_KEY: 'your_api_key_here',
  API_BASE_URL: 'https://yourdomain.com'
};
```

## Requirements

- Node.js 16+
- Polygon.io API key (get free at [polygon.io](https://polygon.io))
- Modern web browser (Chrome, Firefox, Edge, Safari)

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Charts**: Plotly.js
- **Visualization**: D3.js
- **Real-time Data**: WebSocket (Polygon.io)
- **Server**: Express.js (production), Electron (desktop)

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## License

MIT

## Support

For deployment help, see:
- Troubleshooting section in [SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md)
- Check logs: `sudo journalctl -u alpharhythm -f`
- Verify config: `sudo nginx -t`

---

**Note**: This is a simplified server-ready version. The full backtesting engine will be available in a future release.
