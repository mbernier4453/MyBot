# αlpharhythm - AI Agent Instructions

## Project Overview
**αlpharhythm** is a full-stack algorithmic trading dashboard with **dual deployment modes**: Electron desktop app and web-based (server version). Built with Python/Flask backend + JavaScript frontend for backtesting strategies with technical indicators.

### Current Branch: `server-version`
This branch uses **Supabase authentication** and serves via Node/Express instead of Electron. See `main.js` (Electron) vs `server.js` (web server).

## Architecture

### Dual Frontend Modes
```
Desktop (Electron):      Web (Server Version):
main.js + preload.js  →  server.js + Express
electronAPI          →  Supabase auth
SQLite (sql.js)      →  Backend API only
```

**Key Files:**
- `frontend/main.js` - Electron IPC handlers, Polygon WebSocket, SQLite operations
- `frontend/server.js` - Express server, Socket.io for real-time data, proxies to Flask backend
- `frontend/auth.js` + `supabase-client.js` - Authentication for server version
- `frontend/renderer.js` - Main UI logic, shared between both modes

### Backend Structure
```
backend/
├── app.py                 # Flask REST API (port 5000)
├── config.py              # Env vars (.env required)
├── backtest/              # Core backtesting engine
│   ├── engine.py          # BacktestEngine class
│   ├── indicators.py      # Technical indicators (RSI, MACD, BB, etc.)
│   ├── signals.py         # Condition evaluation (crossovers, comparisons)
│   ├── data_source.py     # Polygon flat files wrapper
│   ├── metrics.py         # Sharpe, Sortino, drawdown calculations
│   └── results.py         # CSV/tearsheet generation
├── data/
│   ├── polygon_flatfiles.py  # AWS S3 flat file downloader
│   └── cache/             # Parquet cache (local)
└── preview/
    └── load_preview_data.py  # Strategy preview endpoint
```

**Data Flow:**
1. Frontend sends config → Flask `/api/backtest/run`
2. Backend loads bars from Polygon S3 → calculates indicators → evaluates signals
3. Simulates trades → calculates metrics → returns results/tearsheet

## Critical Development Patterns

### 1. Indicator Matching (Python ↔ JavaScript)
**Must maintain parity** between `backend/backtest/indicators.py` and `frontend/modules/indicators/calculations.js`. Same parameters, same output.

Example RSI:
```python
# backend/backtest/indicators.py
@staticmethod
def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    # Wilder's smoothing method
```
```javascript
// frontend/modules/indicators/calculations.js
static calculateRSI(prices, period = 14) {
    // Must match Python output exactly
}
```

### 2. Condition System Format
Frontend condition builder → backend signal evaluator uses consistent JSON:
```json
{
  "type": "price|rsi|ma|macd",
  "source": "close|rsi|indicator_name", 
  "comparison": "above|below|crosses_above|crosses_below",
  "target": 50,  // or indicator name
  "params": {"period": 14}
}
```

See `backend/backtest/signals.py::SignalEvaluator.evaluate_condition()` for full logic.

### 3. Module System (Frontend)
Uses ES6 modules with **manual state management**:
- `modules/core/state.js` - Centralized state (current run, all runs, etc.)
- `modules/core/api.js` - Wrapper for all `electronAPI`/fetch calls
- Each feature (backtest, charts, watchlists) in separate module

**Import pattern:**
```javascript
import * as State from './modules/core/state.js';
import * as API from './modules/core/api.js';

// Use State getters/setters, never direct access
const run = State.getCurrentRun();
State.setCurrentRun(newRun);
```

### 4. Authentication (Server Version Only)
- Supabase handles user creation, email verification, sessions
- No backend user table needed (auth.users only)
- Frontend checks `getSession()` before loading `renderer.js`
- **Common issue:** Database trigger for profiles table may fail but auth succeeds (see `SUPABASE_FIX.md`)

## Running the Project

### Backend (Flask API)
```powershell
# Install dependencies
pip install -r backend/requirements.txt

# Configure .env (required)
POLYGON_API_KEY=your_key
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Run server
python run_server.py  # http://localhost:5000
```

### Frontend - Server Version
```powershell
cd frontend
npm install
node server.js  # http://localhost:3000
```

### Frontend - Electron (Desktop)
```powershell
cd frontend
npm install
npm start  # or: electron .
```

### Test Backend Setup
```powershell
python backend/tests/test_setup.py
# Validates env vars, S3 connection, downloads sample data
```

## Key Conventions

### File Naming
- Python: `snake_case.py` (e.g., `load_preview_data.py`)
- JavaScript: `kebab-case.js` (e.g., `config-manager.js`)
- Classes: PascalCase (e.g., `BacktestEngine`, `SignalEvaluator`)

### Data Caching
- Polygon flat files → S3 daily downloads → local parquet cache (`backend/data/cache/`)
- Cache persists across runs, checks for updates daily
- **Never commit cache files** (.gitignore includes `cache/`)

### Error Handling Pattern
```python
# Backend
def api_endpoint():
    try:
        result = do_work()
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

```javascript
// Frontend
async function callAPI() {
    try {
        const response = await fetch('/api/endpoint');
        const data = await response.json();
        if (data.success) {
            // Handle success
        } else {
            console.error('API error:', data.error);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}
```

### Configuration Objects
Backend config follows this structure:
```python
config = {
    'symbols': ['AAPL', 'MSFT'],  # Tickers to backtest
    'start_date': '2024-01-01',
    'end_date': '2024-12-31',
    'initial_capital': 100000,
    'order_type': 'MOC',  # Market-On-Close
    'slippage_bps': 5,  # Basis points
    'commission_bps': 1,
    'indicators': {
        'rsi': {'period': 14},
        'macd': {'fast': 12, 'slow': 26, 'signal': 9}
    },
    'entry_conditions': [...],  # List of condition dicts
    'exit_conditions': [...],
    'entry_logic': 'all',  # 'all' (AND) or 'any' (OR)
    'exit_logic': 'all'
}
```

## External Dependencies

### Polygon.io
- API Key: Real-time WebSocket + REST API
- AWS Credentials: S3 flat files (historical bulk data)
- Config: `backend/config.py` reads from `.env`

### Supabase (Server Version)
- Project URL in `frontend/supabase-client.js`
- Handles: User registration, email verification, session management
- **No backend auth endpoints needed** - all handled by Supabase

### Socket.io (Server Version)
- `frontend/backend/websocket_manager.js` - Manages Polygon WebSocket → Socket.io bridge
- Real-time market data streaming to connected browsers
- Compression enabled for messages >1KB

## Common Tasks

### Adding a New Indicator
1. Implement in `backend/backtest/indicators.py` with exact formula
2. Add matching implementation in `frontend/modules/indicators/calculations.js`
3. Update `Indicators.calculate_all()` to include new indicator
4. Test both implementations return identical results

### Adding a New Condition Type
1. Update `backend/backtest/signals.py::SignalEvaluator.evaluate_condition()`
2. Add UI builder in `frontend/modules/backtest/conditions.js`
3. Document in condition format docstring

### Debugging Backend Issues
```powershell
# Check environment
python -c "from backend.config import validate_config; validate_config()"

# Test data source
python -c "from backend.backtest.data_source import DataSource; ds = DataSource(); print(ds.load_bars(['AAPL'], '2024-01-01', '2024-01-31'))"

# Run isolated backtest
python run_backtest.py  # Uses config from file
```

### Debugging Frontend (Server Version)
- Check browser console for Supabase auth errors
- Verify Flask backend running: `curl http://localhost:5000/api/health`
- Check Socket.io connection: Browser DevTools → Network → WS tab

## Known Issues & Gotchas

1. **Supabase Auth Error**: Users see "database error saving new user" but account created successfully. Fix: Run SQL from `SUPABASE_FIX.md` to fix profiles table trigger.

2. **Electron vs Server Mode**: Check which mode you're debugging. Different auth systems, different data persistence patterns.

3. **Indicator Drift**: Python/JavaScript implementations can diverge over time. Always validate outputs match.

4. **Date Handling**: Backend uses `pd.Timestamp`, frontend uses JavaScript `Date`. Convert carefully at API boundaries.

5. **Module State**: Frontend state lives in `modules/core/state.js`. Don't create parallel state in other files.

## Deployment

### Production (Server Version)
- See `deployment/DEPLOYMENT_GUIDE.md` for full Nginx + Gunicorn + systemd setup
- Domain: `https://alpharhythm.io` (frontend), `https://api.alpharhythm.io` (backend)
- Service: `backtester-api.service` (systemd)

### Desktop Distribution (Electron)
- Build: `npm run build` (when configured)
- Package includes SQLite embedded database
- No server required, fully offline after data download

## Questions for Developers

**Q: Which frontend mode am I in?**  
A: Check for `main.js` imports (Electron) vs `supabase-client.js` imports (server). Branch `server-version` = web mode.

**Q: Why two backtester directories?**  
A: `backend/backtest/` is new engine (active). `backtester/` is legacy code (reference only, not used).

**Q: Where are backtest results stored?**  
A: Electron mode: SQLite database via `main.js`. Server mode: Flask API returns JSON, frontend displays directly (no persistence yet).

**Q: How do I add a new API endpoint?**  
A: Add route in `backend/app.py`, update `frontend/config.js` ENDPOINTS, add wrapper in `frontend/modules/core/api.js`.
