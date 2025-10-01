# Backtester Results Frontend

A modern Electron.js desktop application for viewing and analyzing backtester results from your SQLite database.

## Features

### 📊 Run Management
- View all backtesting runs with timestamps and metadata
- Filter runs by search term or mode (single/portfolio)
- Multi-select runs for comparison

### 📈 Detailed Analysis
- **Overview Tab**: High-level metrics and run information
- **Strategies Tab**: Detailed strategy-level results with sorting and filtering
- **Portfolio Tab**: Portfolio-level metrics and weight allocation
- **Trades Tab**: Individual trade history with filtering
- **Compare Tab**: Side-by-side comparison of multiple runs

### 🎨 Modern UI
- Dark theme optimized for extended viewing
- Responsive layout
- Color-coded metrics (positive/negative)
- Sticky table headers for easy navigation

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the application:
```bash
npm start
```

2. Click "Select Database" and choose your backtester database file (typically `results/db/backtests.db`)

3. Browse runs in the sidebar and click to view details

4. Use tabs to explore different aspects of each run

5. Ctrl+Click multiple runs to compare them

## Development

Run in development mode with DevTools:
```bash
npm run dev
```

## Database Structure

The app expects a SQLite database with the following tables:
- `runs`: Run metadata (run_id, mode, timestamps, notes)
- `strategies`: Strategy-level results (metrics, parameters)
- `portfolio`: Portfolio-level results (aggregated metrics)
- `portfolio_weights`: Ticker weights for portfolio runs
- `trades`: Individual trade records

## Keyboard Shortcuts

- **Ctrl+Click** on runs: Multi-select for comparison
- **Click** on run: View detailed results

## Filtering & Sorting

### Strategies
- Search by ticker symbol
- Sort by any metric (return, sharpe, sortino, etc.)
- Toggle ascending/descending order

### Trades
- Search by ticker
- Filter by side (buy/sell)

## Tips

- Use the comparison feature to evaluate different parameter sets
- Sort strategies by different metrics to find optimal configurations
- Export capabilities coming soon!

## Future Enhancements

- [ ] Export results to CSV/JSON
- [ ] Interactive charts and visualizations
- [ ] Advanced filtering with multiple criteria
- [ ] Custom metric calculations
- [ ] Dark/Light theme toggle
- [ ] Database refresh without restart
