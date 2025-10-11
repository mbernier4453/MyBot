# Running Backtests from the Frontend

## Overview

You can now run backtests directly from the frontend UI! The backtesting functionality has been integrated using a simple Python subprocess approach - no API server required!

## How It Works

1. **Python Backtest Script** (`run_backtest.py`): 
   - Standalone script that receives configuration via command line
   - Executes backtests using the existing backtester engine
   - Streams real-time progress updates via stdout
   - No server setup or ports needed

2. **Frontend Integration**:
   - Electron spawns the Python script as a subprocess when you click "Run Backtest"
   - The "Backtesting" page provides a full configuration UI
   - Real-time progress updates streamed directly to the UI
   - Results are automatically saved to the database
   - Simple, fast, and reliable

## Usage

### Step 1: Ensure Python Dependencies

Make sure you have the required Python packages:

```bash
pip install -r requirements.txt
```

No additional packages needed - it uses the same dependencies as the existing backtester.

### Step 2: Launch the App

Start the Electron frontend as usual:

```bash
cd frontend
npm start
```

The Python API server will start automatically in the background.

### Step 3: Configure and Run a Backtest

1. Click on the **"Backtesting"** tab in the main navigation
2. Configure your backtest parameters:
   - **Run ID**: Leave as "auto" or specify a custom name
   - **Tickers**: Enter comma-separated symbols (e.g., "AAPL, MSFT, GOOGL")
   - **Date Range**: Set start and end dates
   - **Capital**: Set initial capital amount
   - **Strategy Parameters**: Configure RSI thresholds and periods
   - **Portfolio Mode** (optional): Enable for multi-ticker portfolio backtests
   
3. Click **"Run Backtest"**
4. Monitor the progress (button shows percentage complete)
5. When complete, you'll see a success message
6. View results in the **"Results"** page

## Configuration Options

### Main Settings
- **Run ID**: Identifier for this backtest run
- **Notes**: Description for documentation
- **Tickers**: Stock symbols to test
- **Initial Capital**: Starting portfolio value
- **Date Range**: Backtest period
- **Benchmarks**: Enable comparison with buy-and-hold and market benchmarks

### Portfolio Mode
- Run multiple tickers with specified weights
- Support for both fixed strategies and parameter grids
- Automatic weight normalization

### Strategy Parameters
- **RSI Period**: Lookback period for RSI calculation
- **Buy Threshold**: Enter when RSI drops below this level
- **Sell Threshold**: Exit when RSI rises above this level
- **Parameter Grid**: Specify multiple values to test all combinations

### Execution Settings
- **Order Type**: Market-on-Open (MOO) or Market-on-Close (MOC)
- **Fees**: Entry and exit transaction costs in basis points
- **Slippage**: Simulated price impact
- **Target Weight**: Position sizing as fraction of capital

### Outputs
- **Save to Database**: Store results for later viewing
- **Save Metrics CSV**: Export performance metrics
- **Save Trades**: Log individual trade details

## API Endpoints

The backend API provides these endpoints:

- `POST /api/backtest/run` - Start a new backtest
- `GET /api/backtest/status/<id>` - Check backtest progress
- `GET /api/backtest/list` - List all backtests
- `GET /api/health` - Server health check

## Troubleshooting

### Backtest Won't Start
- Check that Python is installed and in your PATH
- Verify Python packages are installed: `pip install -r requirements.txt`
- Check Electron console logs for error messages

### Backtest Fails
- Verify ticker symbols are valid
- Check date ranges are reasonable
- Ensure you have internet connection (for downloading data)
- Review Electron console output for detailed Python errors

### Results Not Showing
- Make sure "Save to Database" is enabled
- Refresh the database in the Results page
- Check that the backtest completed successfully

## Development Notes

### Architecture
- **Electron Main Process** (`frontend/main.js`): Spawns Python subprocess
- **Python Backtest Script** (`run_backtest.py`): Executes backtest and streams progress
- **Electron Renderer** (`frontend/renderer.js`): UI and user interaction
- **IPC Bridge** (`frontend/preload.js`): Secure communication between renderer and main

### Running Standalone Script

You can also run the backtest script standalone for testing:

```bash
# Pass config as JSON string
python run_backtest.py '{"TICKERS": ["AAPL"], "START": "2020-01-01", "END": "2024-01-01", "RSI_PERIOD": [14], "RSI_BUY_BELOW": [30], "RSI_SELL_ABOVE": [70]}'

# Or pipe config via stdin
echo '{"TICKERS": ["AAPL"], ...}' | python run_backtest.py
```

The script outputs JSON progress messages to stdout that can be easily parsed.

### Example Configuration JSON

```json
{
  "RUN_ID": "TestRun1",
  "NOTES": "Testing RSI strategy on tech stocks",
  "TICKERS": ["AAPL", "MSFT", "GOOGL"],
  "INITIAL_CAPITAL": 100000,
  "START": "2020-01-01",
  "END": "2024-01-01",
  "RSI_PERIOD": [14],
  "RSI_BUY_BELOW": [30],
  "RSI_SELL_ABOVE": [70],
  "SAVE_DB": true,
  "SAVE_METRICS": true
}
```

## Next Steps

- Add more strategy types beyond RSI
- Support for custom indicators
- Batch backtest execution
- Advanced optimization features
- Real-time chart updates during execution
