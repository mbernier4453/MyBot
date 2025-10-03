# S&P 500 Live Treemap Setup

## Configuration

1. **Add your Polygon API key** to the `.env` file:
   ```
   POLYGON_API_KEY=your_actual_api_key_here
   ```

2. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

## Features

- **Live Updates**: Real-time S&P 500 stock data via Polygon websocket
- **1-Minute Aggregates**: Uses minute-level bars for smooth updates
- **Color Coding**: 
  - Green = Positive change
  - Red = Negative change
  - Intensity based on percentage change (capped at 3% for full color)
- **Interactive**: Hover over cells to see ticker, percentage, and price
- **Auto-reconnect**: Automatically reconnects if connection drops

## Current Implementation

- **Top 100 S&P 500 stocks** are tracked (can expand to full 500)
- Cell size based on **volume** (market cap sizing coming later)
- Updates every **5 seconds** to avoid excessive redraws
- Displays **ticker symbol** and **percentage change** on each cell

## Future Enhancements

- [ ] Full 500 stock coverage
- [ ] Market cap-based cell sizing
- [ ] Sector filtering/grouping
- [ ] Click-through to detailed stock view
- [ ] Historical playback
- [ ] Custom watchlist treemaps
