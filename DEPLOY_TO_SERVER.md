# Deploy Treemap Bug Fixes to Server

## Quick Deployment Steps

SSH into your server and run these commands:

```bash
# SSH into server
ssh root@138.197.6.220

# Navigate to project directory
cd /var/www/alpharhythm

# Pull latest changes
git fetch origin
git checkout working-server-backup-nov-10
git pull origin working-server-backup-nov-10

# Restart the server to apply changes
killall node
cd frontend
node server.js > /var/log/alpharhythm-server.log 2>&1 &

# Check that it's running
ps aux | grep node

# Tail the log to verify no errors
tail -f /var/log/alpharhythm-server.log
```

Press `Ctrl+C` to exit the log tail once you see it's running.

## What Changed

These 3 files were updated:
1. `frontend/backend/websocket_manager.js` - Fixed prevClose fallback bug
2. `frontend/modules/charts/chart-tabs.js` - Fixed duplicate socket listeners
3. `frontend/modules/features/polygon-treemap.js` - Fixed duplicate subscriptions

## Testing

After deployment:
1. Open your site in browser (https://alpharhythm.io or your domain)
2. Open browser console (F12)
3. Watch for these signs of success:
   - ✅ **Much less console spam** (no duplicate Socket.IO messages every second)
   - ✅ **Correct % changes on treemap** (not showing 0% or wrong values)
   - ✅ Look for log: `[SOCKET.IO] Already connected` (not repeated subscriptions)

## If Issues Occur

Check the server log:
```bash
tail -100 /var/log/alpharhythm-server.log
```

Check if prevClose cache is populated (run on server in Node console):
```bash
# This will show if prevClose values are being cached
grep "Fetched prev close" /var/log/alpharhythm-server.log | tail -20
```

## Rollback (if needed)

If something breaks:
```bash
cd /var/www/alpharhythm
git checkout server-version
killall node
cd frontend
node server.js > /var/log/alpharhythm-server.log 2>&1 &
```
