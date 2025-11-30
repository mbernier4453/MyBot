# Quick deployment script for alpharhythm
# Commits changes, pushes to GitHub, pulls on server, and restarts Node

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Update changes"
)

Write-Host "Starting deployment..." -ForegroundColor Cyan

# Step 1: Commit and push
Write-Host "`nCommitting changes..." -ForegroundColor Yellow
git add -A
git commit -m $Message
git push origin server-version

# Step 2: Pull on server
Write-Host "`nPulling changes on server..." -ForegroundColor Yellow
ssh root@138.197.6.220 "cd /var/www/alpharhythm && git pull origin server-version"

# Step 3: Restart Node server
Write-Host "`nRestarting Node server..." -ForegroundColor Yellow
ssh root@138.197.6.220 "cd /var/www/alpharhythm/frontend && pkill -f 'node server.js' && nohup node server.js > /var/log/alpharhythm-frontend.log 2>&1 &"

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Test at: https://alpharhythm.io/?bypass=alpha2025dev" -ForegroundColor Cyan
