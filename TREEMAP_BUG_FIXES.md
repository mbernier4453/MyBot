# Treemap % Change Bug Fixes - November 12, 2025

## Root Causes Identified

### 1. **Duplicate Socket.IO Event Listeners**
**Problem**: The console was flooding with duplicate messages because multiple event listeners were registered for the same events without cleanup.

**Location**: `frontend/modules/charts/chart-tabs.js`

**Issue**: 
- `registerSocketIOListeners()` was called multiple times
- Each call added a NEW `socket.on('polygon-batch')` listener
- Old listeners were NEVER removed
- Result: Every socket message was processed 2-3+ times, causing console spam and stale data usage

**Fix**:
```javascript
// Now stores unsubscribe function and removes old listeners before adding new ones
let chartTabsSocketUnsubscribe = null;

function registerSocketIOListeners() {
  // Remove old listener if it exists
  if (chartTabsSocketUnsubscribe) {
    chartTabsSocketUnsubscribe();
  }
  
  // Use proper subscribe API instead of direct socket.on()
  chartTabsSocketUnsubscribe = socketClient.subscribe('*', (data) => {
    // Process updates...
  });
}
```

### 2. **Treemap Duplicate Subscriptions**
**Problem**: Similar to above - treemap was re-subscribing without unsubscribing first.

**Location**: `frontend/modules/features/polygon-treemap.js`

**Fix**:
```javascript
// Unsubscribe from previous subscription if exists
if (this.socketUnsubscribe) {
  this.socketUnsubscribe();
  this.socketUnsubscribe = null;
}

// Then create new subscription
this.socketUnsubscribe = socketClient.subscribe(tickers, (data) => {
  // ...
});
```

### 3. **Wrong Fallback for prevClose (THE MAIN BUG)**
**Problem**: When `prevClose` was not in cache, code fell back to TODAY'S OPEN PRICE (`msg.o`), causing incorrect % change calculations.

**Location**: `frontend/backend/websocket_manager.js` (line 117)

**Bad Code**:
```javascript
const prevClose = this.prevCloseCache?.get(msg.sym) || msg.o;
```

**Why This is Wrong**:
- If `prevClose` is not cached yet, using `msg.o` (today's open) makes the formula:
  - `changePercent = (currentPrice - todayOpen) / todayOpen * 100`
- This calculates **intraday change** (since market open today), NOT day-over-day change
- Result: Wrong percentages showing 0% or incorrect values

**Fix**:
```javascript
// Get previous close from cache - DO NOT use fallback
const prevClose = this.prevCloseCache?.get(msg.sym);

// Skip this update if we don't have prevClose yet
if (!prevClose) {
  return; // Don't broadcast bad data
}
```

**Now the formula is correct**:
- `changePercent = (currentPrice - yesterdayClose) / yesterdayClose * 100`
- This shows actual day-over-day % change

### 4. **Initial Data Fetch Using Wrong Baseline**
**Problem**: The initial data fetch was calculating change from `open to close` of the SAME day (previous trading day), not day-over-day.

**Location**: `frontend/modules/features/polygon-treemap.js` - `fetchInitialData()`

**Fix**: Now explicitly stores both `prevClose` and `close`, and clarifies that initial data shows intraday change until WebSocket updates arrive with proper day-over-day data.

## Testing

After these fixes:
1. ✅ Console spam should stop - no more duplicate log messages
2. ✅ Treemap % changes should be correct (comparing to previous day's close)
3. ✅ No more 0% or incorrect values on treemap tiles
4. ✅ Real-time updates work correctly without stale cached data

## How It Works Now

1. **Server starts** → `websocket_manager.js` connects to Polygon WebSocket
2. **Tickers subscribed** → Server fetches previous close via REST API `/prev` endpoint
3. **Cache populated** → `prevCloseCache` stores yesterday's close for each ticker
4. **WebSocket updates arrive** → Server calculates `changePercent = (current - prevClose) / prevClose * 100`
5. **Data broadcasted** → Only sends data if `prevClose` is available (no bad fallbacks)
6. **Frontend receives** → Uses `socketClient.subscribe()` API with proper cleanup
7. **Treemap updates** → Shows correct day-over-day % changes

## Files Changed

1. `frontend/modules/charts/chart-tabs.js` - Fixed duplicate listeners, use subscribe API
2. `frontend/modules/features/polygon-treemap.js` - Fixed duplicate subscriptions, clarified initial data
3. `frontend/backend/websocket_manager.js` - **CRITICAL**: Removed fallback to `msg.o`, skip updates without prevClose

## Next Steps

If you still see issues:
1. Check browser console for any remaining duplicate logs
2. Verify `prevCloseCache` is populated: `console.log(websocketManager.prevCloseCache)` on server
3. Check that `/prev` API calls are succeeding (not hitting rate limits)
4. Verify treemap tiles show non-zero % changes during market hours
