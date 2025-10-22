# Automated Debugging Workflow

This document outlines how I (the AI agent) will help you identify and fix bugs.

## The Process

### Step 1: Start the App and Capture Errors

```powershell
# I will run this:
cd c:\Users\mabso\MyBot\frontend
npm start

# App starts, opens dev tools, begins logging
# I wait 10 seconds for full initialization
```

### Step 2: Check All Logs

```bash
# I will run this to extract errors:
cd c:\Users\mabso\MyBot\frontend
node debug-check.js all
```

### Step 3: Analyze Errors

The script outputs something like:
```
✗ Main Process: Found 3 error(s):
  1. TypeError: Cannot read property 'polygonWs' of undefined
  2. ReferenceError: SQL is not defined
  3. Error: ENOENT: no such file or directory

✗ Renderer Process: Found 2 error(s):
  1. Uncaught TypeError: State is not defined
  2. Cannot read properties of null (reading 'addEventListener')
```

### Step 4: Fix Errors Iteratively

For each error:
1. I read the relevant source file
2. Identify the root cause
3. Make the fix
4. Kill the running app
5. Restart and check logs again
6. Repeat until no errors remain

### Step 5: Verification

When `node debug-check.js all` returns:
```
✓ All systems operational! No errors detected.
```

The app is ready!

## What You Need to Do

Just tell me: **"Run the debugging workflow"** or **"Debug the app"**

I will:
1. ✓ Start the app
2. ✓ Capture errors
3. ✓ Analyze logs
4. ✓ Fix bugs
5. ✓ Restart and recheck
6. ✓ Continue until no errors
7. ✓ Report final status

## Commands I'll Use

```powershell
# Start app (PowerShell)
cd c:\Users\mabso\MyBot\frontend
npm start

# Check logs
node debug-check.js all

# Kill running process (if needed)
Get-Process electron | Stop-Process

# Read specific log files
Get-Content "c:\Users\mabso\MyBot\frontend\logs\main-process.log"
Get-Content "c:\Users\mabso\MyBot\frontend\logs\renderer-process.log"
```

## Important Notes

1. **Dev Tools Auto-opens**: You'll see the dev tools window - this is normal and helps with visual debugging
2. **Console Shows Errors**: The dev tools console will display errors in real-time
3. **Log Files Are Persistent**: Errors are recorded in files, so I can analyze them even after app closes
4. **Each Restart Clears Logs**: Fresh debugging session each time

## Log File Format

Logs are stored as plain text:
```
2024-01-15T10:30:45.123Z [LOG] [STARTUP] Debug logger initialized
2024-01-15T10:30:45.234Z [LOG] [POLYGON] Connecting to websocket...
2024-01-15T10:30:46.456Z [ERROR] [POLYGON] Connection failed: ENOTFOUND
2024-01-15T10:30:47.789Z [WARN] [APP] Retrying connection...
```

Each line has:
- **Timestamp**: ISO 8601 format (UTC)
- **Level**: [LOG], [ERROR], [WARN], [INFO]
- **Tag**: [STARTUP], [POLYGON], [APP], etc.
- **Message**: The actual error or info

## Expected Workflow Duration

- **Analysis**: 2-3 seconds per error type
- **Fix**: 5-30 seconds depending on complexity
- **Verification**: 10 seconds (wait + check)
- **Total**: ~1-2 minutes for fixing 3-5 bugs

## When Debugging Is Complete

I will show you:
1. ✓ Summary of all bugs fixed
2. ✓ Files modified
3. ✓ Current app status: "Ready to use"

Then we can move on to:
- Testing new features
- Adding functionality
- Performance optimization

---

**Ready to debug? Just ask: "Debug the app" or "Run the debugging workflow"**