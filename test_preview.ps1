$params = '{"ticker":"AAPL","period":"1mo","interval":"1d"}'
$output = & .\.venv\Scripts\python.exe .\load_preview_data.py $params 2>&1
Write-Host "===== FULL OUTPUT ====="
Write-Host $output
Write-Host "===== END OUTPUT ====="
