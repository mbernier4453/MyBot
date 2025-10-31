# PowerShell deployment script for alpharhythm
# Deploys to: root@138.197.6.220

$SERVER = "root@138.197.6.220"

Write-Host "🚀 Deploying alpharhythm to $SERVER" -ForegroundColor Cyan

# Upload deployment script
Write-Host "`n📤 Uploading deployment script..." -ForegroundColor Yellow
scp deploy.sh ${SERVER}:/tmp/deploy.sh

# Make it executable and run it
Write-Host "`n▶️ Running deployment script..." -ForegroundColor Yellow
ssh $SERVER "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Access your app at: http://138.197.6.220" -ForegroundColor Green

# Ask if user wants to view logs
$viewLogs = Read-Host "`nView live logs? (y/n)"
if ($viewLogs -eq 'y') {
    Write-Host "`n📝 Showing live logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    ssh $SERVER "sudo journalctl -u alpharhythm -f"
}
