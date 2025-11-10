# Refactoring Plan: Electron IPC → Flask API Architecture

## Current Architecture Analysis

### Communication Pattern
**Current:** Electron IPC (Inter-Process Communication)
- Frontend (renderer.js) → Preload (preload.js) → Main Process (main.js) → Python scripts
- Main.js spawns Python subprocesses for heavy computation
- Data stored in SQLite database, read via sql.js in Electron

**Target:** Flask REST API
- Frontend → HTTP requests → Flask server → Python backend modules
- Persistent Flask process (no spawning per request)
- Direct database access from Flask

---

## Key IPC Handlers to Convert (29 endpoints)

### 1. Database/Results Operations (8 endpoints)
```
✓ select-db              → GET  /api/db/select
✓ get-runs               → GET  /api/runs
✓ get-strategies         → GET  /api/runs/{runId}/strategies
✓ get-buyhold-metrics    → GET  /api/runs/{runId}/buyhold
✓ get-portfolio          → GET  /api/runs/{runId}/portfolio
✓ get-trades             → GET  /api/runs/{runId}/trades?ticker={ticker}
✓ get-run-summary        → GET  /api/runs/{runId}/summary
✓ delete-run             → DELETE /api/runs/{runId}
```

### 2. Strategy Analysis (2 endpoints)
```
✓ get-strategy-details   → GET  /api/strategies/{strategyId}
✓ get-comparison-data    → POST /api/analysis/compare (body: runIds array)
```

### 3. CAPM Calculations (1 endpoint)
```
✓ calculate-capm         → POST /api/analysis/capm
   Body: { strategyEquity, benchmarkEquity }
```

### 4. Backtesting Operations (3 endpoints)
```
✓ backtest-run           → POST /api/backtest/run
   Body: full config object
   
✓ run-dynamic-backtest   → POST /api/backtest/dynamic
   Body: { tickers, dates, conditions, exits, capital, etc. }
   
✓ load-preview-data      → POST /api/backtest/preview
   Body: { ticker, timeframe, conditions }
```

### 5. User Data/Favorites (6 endpoints)
```
✓ get-favorites          → GET  /api/favorites
✓ add-favorite           → POST /api/favorites
✓ remove-favorite        → DELETE /api/favorites/{id}
✓ get-folders            → GET  /api/folders
✓ create-folder          → POST /api/folders
✓ delete-folder          → DELETE /api/folders/{id}
✓ move-to-folder         → PATCH /api/favorites/{id}/folder
✓ save-portfolio-as-strategy → POST /api/favorites/from-portfolio
```

### 6. Watchlists (3 endpoints)
```
✓ get-watchlists         → GET  /api/watchlists
✓ create-watchlist       → POST /api/watchlists
✓ delete-watchlist       → DELETE /api/watchlists/{id}
```

### 7. Polygon Market Data (6 endpoints)
**NOTE:** These can stay in Electron or move to Flask - discuss strategy
```
? polygon-connect         → WebSocket management (keep in Electron?)
? polygon-disconnect
? polygon-get-all-data
? polygon-get-historical-bars → Could become GET /api/market/bars
```

---

## Python Backend Module Inventory

### Core Backtesting Modules (keep as-is, import into Flask)
```python
backtester/
├── engine.py              # Single symbol backtest runner
├── portfolio_engine.py    # Portfolio mode backtesting
├── grid.py               # Parameter grid generation
├── signals.py            # Entry/exit signal generation
├── indicators.py         # RSI, BB, technical indicators
├── data.py               # yfinance data loading
├── benchmarks.py         # Benchmark equity calculations
├── metrics.py            # Performance KPIs
├── capm.py               # CAPM analysis
├── config.py             # Config parsing
├── settings.py           # Settings management
└── db.py                 # SQLite database operations
```

### Standalone Scripts (refactor → Flask routes)
```python
dynamic_backtest.py       → Becomes Flask route handler
load_preview_data.py      → Becomes Flask route handler
calculate_capm.py         → Becomes Flask route handler
run_backtest.py           → CLI utility (keep for testing)
main.py                   → CLI utility (keep for testing)
```

### Results/Tearsheet Logic
```python
backtester/tearsheet.py   # Has all tearsheet generation logic
backtester/results.py     # CSV/export functions
backtester/charts.py      # Chart data preparation
```

---

## Modularization Strategy

### Phase 1: Core Extraction (Standalone Modules)
Create self-contained modules that work EVERYWHERE:

```
backtesting_core/
├── __init__.py
├── engine.py              # Backtest execution
├── indicators.py          # All technical indicators
├── signals.py             # Signal generation
├── metrics.py             # Performance calculations
├── capm.py                # CAPM analysis
└── results.py             # Result formatting

# These modules should:
# - Accept standard Python data types (dicts, DataFrames)
# - No database dependencies
# - Pure computation logic
# - Easy to drop into ANY platform
```

### Phase 2: Database Abstraction Layer
```
backtesting_storage/
├── __init__.py
├── base.py                # Abstract base class
├── sqlite_adapter.py      # Current SQLite implementation
└── schemas.py             # Data models

# Benefits:
# - Swap storage backend easily (PostgreSQL, MongoDB, etc.)
# - Core logic doesn't care about storage
```

### Phase 3: API Service Layer
```
backtesting_api/
├── __init__.py
├── app.py                 # Flask app factory
├── routes/
│   ├── __init__.py
│   ├── backtest.py        # Backtest endpoints
│   ├── results.py         # Results/tearsheet endpoints
│   ├── analysis.py        # CAPM, comparisons
│   └── user.py            # Favorites, watchlists
├── models.py              # Pydantic request/response models
└── config.py              # Flask config
```

---

## Step-by-Step Migration Plan

### Step 1: Create Flask API (parallel to Electron)
✓ Goal: Backend can serve both Electron AND web clients
- Create Flask app with all 29 endpoints
- Import existing backtester modules
- Test with Postman/curl
- Keep Electron app working (don't break anything yet)

### Step 2: Add HTTP Mode to Frontend
✓ Goal: Frontend can switch between IPC and HTTP
- Create `api.js` utility module
- Detect if running in Electron or browser
- Auto-switch between `window.api.method()` and `fetch()`
```javascript
// api.js example
const USE_HTTP = !window.api; // True if not in Electron
const API_BASE = 'http://localhost:5000';

async function getStrategies(runId) {
  if (USE_HTTP) {
    const res = await fetch(`${API_BASE}/api/runs/${runId}/strategies`);
    return await res.json();
  } else {
    return await window.api.getStrategies(runId);
  }
}
```

### Step 3: Test Both Modes
- Run Flask server: `python flask_app.py`
- Run Electron app: `npm start`
- Verify all features work in both

### Step 4: Extract Core Modules
- Create `backtesting_core/` package
- Move pure logic from `backtester/` to `backtesting_core/`
- Update imports in Flask API
- Test thoroughly

### Step 5: Port to New Platform
- Copy `backtesting_core/` to new platform
- Copy `backtesting_api/routes/` logic
- Adapt to new platform's framework (if not Flask)
- Wire up to new frontend

---

## Data Flow Comparison

### Current (Electron IPC)
```
renderer.js → preload.js → main.js → spawn python → result → main.js → preload.js → renderer.js
                                          ↓
                                     SQLite DB
```

### Target (Flask API)
```
Frontend → fetch() → Flask API → backtester modules → result → JSON response
                         ↓
                    SQLite DB (or any DB via adapter)
```

### Future (Modular)
```
New Platform Frontend → HTTP → New Platform Backend → backtesting_core → result
                                                           ↓
                                                  Platform's DB system
```

---

## Critical Design Decisions

### 1. Polygon WebSocket Management
**Options:**
- A) Keep in Electron main.js (if only desktop app needs real-time data)
- B) Move to Flask with Socket.IO (if web clients need real-time data)
- C) Separate WebSocket service (microservice architecture)

**Recommendation:** Start with A, migrate to B only if web version needs it

### 2. Database Strategy
**Options:**
- A) Keep SQLite, expose via Flask
- B) Migrate to PostgreSQL for multi-user support
- C) Use platform's existing database

**Recommendation:** Start with A, abstract behind adapter interface for easy swap

### 3. Compute-Heavy Operations
**Current:** spawn subprocess per request (calculate_capm.py, dynamic_backtest.py)
**Problem:** Slow, process overhead, doesn't scale

**Solution:** 
- Import modules directly in Flask (keep Python process alive)
- Use background task queue (Celery) for long backtests
- Return task ID immediately, poll for completion

### 4. File Structure for Portability
```
backtest_system/          # The portable package
├── core/                 # Pure computation logic
│   ├── engine.py
│   ├── indicators.py
│   ├── signals.py
│   └── metrics.py
├── storage/              # Database adapters
│   ├── base.py
│   └── sqlite.py
├── api/                  # Flask app (optional, for Flask users)
│   └── routes/
└── README.md             # Integration guide
```

Anyone can:
1. Copy `core/` → use computation logic
2. Implement `storage/base.py` → adapt to their DB
3. Use `api/` as reference → build their own routes

---

## Testing Strategy

### Unit Tests
```python
tests/
├── test_indicators.py    # Test RSI, Bollinger Bands
├── test_signals.py       # Test entry/exit logic
├── test_metrics.py       # Test performance calculations
└── test_engine.py        # Test backtest execution
```

### Integration Tests
```python
tests/integration/
├── test_api_endpoints.py # Test all Flask routes
└── test_e2e_backtest.py  # Full backtest flow
```

### Frontend Tests
```javascript
frontend/tests/
├── test_api_calls.js     # Test HTTP requests
└── test_ipc_compat.js    # Ensure IPC fallback works
```

---

## Timeline Estimate

**Phase 1: Flask API Creation** (2-3 days)
- Set up Flask project structure
- Implement all 29 endpoints
- Test with existing backtester modules

**Phase 2: Frontend HTTP Layer** (1-2 days)
- Create api.js abstraction
- Update renderer.js to use api.js
- Test both modes (Electron IPC + HTTP)

**Phase 3: Extract Core Modules** (2-3 days)
- Refactor backtester/ into core/
- Create storage adapter interface
- Update all imports and test

**Phase 4: Documentation** (1 day)
- API documentation (OpenAPI/Swagger)
- Integration guide for new platforms
- Code examples

**Total:** ~7-10 days for complete refactor

---

## Next Immediate Steps

1. **Set up Flask project structure** (START HERE)
   ```bash
   mkdir api
   cd api
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install flask flask-cors pandas numpy yfinance
   ```

2. **Create minimal Flask app** with 1-2 test endpoints
3. **Test Flask endpoints** with Postman/curl
4. **Gradually migrate endpoints** one-by-one
5. **Update frontend** to call Flask in parallel with IPC

---

## Questions to Resolve

1. **Do you want to keep Electron app working** during migration?
   → Yes = gradual migration, both systems work
   → No = faster, rip off the band-aid

2. **Will the new platform need real-time market data** (Polygon WebSocket)?
   → Yes = move to Flask with Socket.IO
   → No = keep in Electron

3. **Database preference for new platform?**
   → SQLite (simple, portable)
   → PostgreSQL (scalable, multi-user)
   → Platform's existing DB (most integrated)

4. **Deployment target for new platform?**
   → Local desktop app (Electron or similar)
   → Web app (hosted server)
   → Both (need full API abstraction)

Let me know your preferences and we'll start implementation!
