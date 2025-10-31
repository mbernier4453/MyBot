# Quick Start - Testing Backend API

## Prerequisites Check

✅ Virtual environment exists: `.venv/`
✅ Dependencies installed: Flask, Flask-CORS, PyJWT, etc.
✅ .env file configured with API keys
✅ Massive.com flat files working (tested earlier)

## Start Backend Server

### Windows
```powershell
cd C:\Users\mabso\MyBot
.venv\Scripts\python.exe backend\app.py
```

### Linux/Mac
```bash
cd /path/to/MyBot
venv/bin/python backend/app.py
```

Server will start on: `http://localhost:5000`

## Test Endpoints

### 1. Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T...",
  "version": "1.0.0"
}
```

### 2. API Documentation
Open in browser: `http://localhost:5000/`

### 3. Available Tickers
```bash
curl http://localhost:5000/api/data/tickers
```

### 4. Get OHLCV Data
```bash
curl "http://localhost:5000/api/data/bars/AAPL?start_date=2024-10-01&end_date=2024-10-04"
```

### 5. Preview Strategy (POST request)

PowerShell:
```powershell
$body = @{
    symbol = "AAPL"
    start_date = "2024-10-01"
    end_date = "2024-10-10"
    indicators = @{
        sma_20 = @{
            type = "sma"
            period = 20
        }
        rsi = @{
            type = "rsi"
            period = 14
        }
    }
    entry_conditions = @(
        @{
            indicator = "rsi"
            comparison = "below"
            value = 30
        }
    )
    exit_conditions = @(
        @{
            indicator = "rsi"
            comparison = "above"
            value = 70
        }
    )
    entry_logic = "all"
    exit_logic = "all"
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "http://localhost:5000/api/backtest/preview" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Bash/curl:
```bash
curl -X POST http://localhost:5000/api/backtest/preview \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "start_date": "2024-10-01",
    "end_date": "2024-10-10",
    "indicators": {
      "sma_20": {
        "type": "sma",
        "period": 20
      },
      "rsi": {
        "type": "rsi",
        "period": 14
      }
    },
    "entry_conditions": [
      {
        "indicator": "rsi",
        "comparison": "below",
        "value": 30
      }
    ],
    "exit_conditions": [
      {
        "indicator": "rsi",
        "comparison": "above",
        "value": 70
      }
    ],
    "entry_logic": "all",
    "exit_logic": "all"
  }'
```

### 6. Run Full Backtest
```bash
curl -X POST http://localhost:5000/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "start_date": "2024-01-01",
    "end_date": "2024-10-31",
    "initial_capital": 100000,
    "indicators": {
      "sma_50": {"type": "sma", "period": 50},
      "sma_200": {"type": "sma", "period": 200}
    },
    "entry_conditions": [
      {
        "indicator": "sma_50",
        "comparison": "crosses_above",
        "target": "sma_200"
      }
    ],
    "exit_conditions": [
      {
        "indicator": "sma_50",
        "comparison": "crosses_below",
        "target": "sma_200"
      }
    ],
    "entry_logic": "all",
    "exit_logic": "all"
  }'
```

## Test Authentication (Development Mode)

### Login (accepts any credentials in dev mode)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass"
  }'
```

Response includes JWT token:
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "username": "testuser"
  }
}
```

### Verify Token
```bash
curl http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Frontend Testing

### Option 1: Direct File (Simple)
1. Open `frontend/index.html` in browser
2. Backend must be running on `http://localhost:5000`
3. CORS is configured to allow localhost

### Option 2: Local Server (Recommended)
```bash
# Python
cd frontend
python -m http.server 3000

# Then open: http://localhost:3000
```

### Option 3: Node.js http-server
```bash
cd frontend
npx http-server -p 3000
```

## Common Issues

### Backend won't start

**Issue**: `ModuleNotFoundError: No module named 'flask'`
**Fix**: Install dependencies
```bash
.venv\Scripts\pip install -r backend\requirements.txt
```

**Issue**: `TypeError: DataSource.__init__() takes 1 positional argument`
**Fix**: Already fixed in app.py - pull latest changes

**Issue**: Port 5000 already in use
**Fix**: Kill existing process or use different port
```bash
# Check what's using port 5000
netstat -ano | findstr :5000

# Kill process (Windows)
taskkill /PID <PID> /F

# Or change port in .env
FLASK_PORT=5001
```

### CORS Errors

**Issue**: Browser shows CORS error
**Fix**: Ensure CORS_ORIGINS in .env includes your frontend URL
```properties
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000
```

### Can't reach API from frontend

**Issue**: `Failed to fetch` or connection refused
**Fix**: Check backend is running:
```bash
curl http://localhost:5000/api/health
```

## Environment Check

Verify your setup:
```bash
# Check Python
.venv\Scripts\python.exe --version
# Should show Python 3.9+

# Check Flask
.venv\Scripts\python.exe -c "import flask; print(flask.__version__)"
# Should show Flask 3.x

# Check .env
type .env | findstr FLASK_
# Should show Flask configuration

# Check if backend can import modules
.venv\Scripts\python.exe -c "from backend.backtest.engine import run_backtest; print('OK')"
# Should print: OK
```

## Development Workflow

1. **Start backend** (leave running):
   ```bash
   .venv\Scripts\python.exe backend\app.py
   ```

2. **Test endpoints** with curl/Postman

3. **Open frontend** in browser

4. **Make changes** to code

5. Backend auto-reloads (debug mode)

6. Frontend - just refresh browser

## Next: Integrate Frontend

The frontend currently uses Electron and local file access. To use the API:

1. Load `config.js` in HTML
2. Replace local file operations with fetch() calls to API
3. Handle async responses
4. Add error handling
5. Update UI with API data

See `SERVER_DEPLOYMENT_SUMMARY.md` for integration examples.

## Production Testing

Before deploying:

1. Set `FLASK_ENV=production` in .env
2. Set `FLASK_DEBUG=false`
3. Test with production settings locally
4. Ensure all endpoints work
5. Test with actual frontend
6. Check logs for errors
7. Verify CORS works from your domain

Then follow `deployment/DEPLOYMENT_GUIDE.md` for server setup.
