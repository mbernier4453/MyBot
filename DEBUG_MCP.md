# Electron App Debugging System

This document describes the MCP-like debugging infrastructure that allows automated error detection and fixing.

## Setup

The debugging system has been integrated into your Electron app with:

1. **debug-logger.js** - Captures all console output from main & renderer processes
2. **Modified main.js** - Initializes the logger and exposes debug APIs
3. **Modified preload.js** - Exposes debug functions to renderer process
4. **debug-check.js** - Utility script to parse logs and identify errors

## How It Works

### 1. **App Startup**
- Run `npm start` from `c:\Users\mabso\MyBot\frontend`
- The app automatically:
  - Opens dev tools (for visual inspection)
  - Captures all console.log, console.error, console.warn to log files
  - Creates `frontend/logs/` directory with:
    - `main-process.log` - Main process (Node.js) logs
    - `renderer-process.log` - Renderer process (Frontend) logs

### 2. **Capture Logs**
Logs are written with timestamps and severity levels:
```
2024-01-15T10:30:45.123Z [LOG] Message text
2024-01-15T10:30:46.456Z [ERROR] Error occurred
2024-01-15T10:30:47.789Z [WARN] Warning message
```

### 3. **Check for Errors**
From `frontend/` directory, run:
```bash
# Check all logs
node debug-check.js

# Check only main process
node debug-check.js main

# Check only renderer process
node debug-check.js renderer
```

Output shows:
- ✓ No errors found
- ✗ List of all errors/warnings with line numbers

### 4. **Automated Debugging Flow**

The debugging workflow:

```
1. START APP
   └─> npm start

2. WAIT (5-10 seconds for app to load)
   └─> App captures all console output

3. READ LOGS
   └─> node debug-check.js all
   └─> Identifies errors

4. IF ERRORS FOUND
   ├─> Read log file details
   ├─> Analyze root cause
   ├─> Fix code
   └─> Go to step 1

5. IF NO ERRORS
   └─> DONE! App is working
```

## Log File Locations

After running the app:
- `c:\Users\mabso\MyBot\frontend\logs\main-process.log`
- `c:\Users\mabso\MyBot\frontend\logs\renderer-process.log`

## API Functions (Available to Developer/Agent)

### Main Process Logging
```javascript
console.log('[TAG] Message')     // Normal logs
console.error('[TAG] Error')     // Error logs
console.warn('[TAG] Warning')    // Warning logs
```

### Renderer Process Logging
From within renderer (frontend code):
```javascript
window.electronAPI.debugSendLog('ERROR', 'Error message')
window.electronAPI.debugSendLog('WARN', 'Warning message')
```

### Retrieve Logs (IPC)
```javascript
// From main process or renderer with IPC
const logs = await window.electronAPI.debugGetLogs()
// Returns: { main: "...", renderer: "..." }

const mainLogs = await window.electronAPI.debugGetMainLogs()
const rendererLogs = await window.electronAPI.debugGetRendererLogs()
```

## Key Features

✓ **Persistent Logs** - Logs written to files, survives app crashes
✓ **Timestamped** - All entries include ISO timestamp
✓ **Non-intrusive** - Doesn't break existing console functionality
✓ **Both Processes** - Captures main and renderer process errors
✓ **Auto-clear** - Logs cleared on each startup for fresh debugging

## MCP Integration

To integrate this with an AI agent/MCP:

1. **Start**: `npm start` from frontend directory
2. **Wait**: Let app run for 5-10 seconds
3. **Check**: `node debug-check.js all`
4. **Parse**: Read the returned error list
5. **Fix**: Edit source files based on errors
6. **Iterate**: Repeat until no errors

## Example Debug Session

```powershell
# Start app (in frontend directory)
npm start

# Wait 10 seconds for app to fully load

# Check logs
node debug-check.js all

# Output:
# --- MAIN PROCESS LOG ---
# ✗ Main Process: Found 2 error(s):
#   1. 2024-01-15T10:30:46.456Z [ERROR] TypeError: Cannot read property 'x'
#   2. 2024-01-15T10:30:47.789Z [ERROR] Failed to load database

# --- RENDERER PROCESS LOG ---
# ✓ Renderer Process: No errors found

# Now fix the errors in the code...
# Restart and check again
```

## Disabling Dev Tools (When Done)

Once debugging is complete, modify `main.js`:

```javascript
// Change this:
mainWindow.webContents.openDevTools();

// To this (only open on --dev flag):
if (process.argv.includes('--dev')) {
  mainWindow.webContents.openDevTools();
}
```

Then run with: `npm start` (without dev tools)

## Troubleshooting

**Q: No log files appear after running the app**
- A: Logs directory should be created automatically. Check `frontend/logs/`

**Q: Logs are empty**
- A: App may have crashed before logging. Check Windows Process Manager or run with `npm start`

**Q: Want to see live console output?**
- A: Dev tools window shows live console. Alt+Ctrl+I to toggle.
