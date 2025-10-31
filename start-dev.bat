@echo off
REM Development startup script for Backtesting Application (Windows)
REM Starts backend Flask server for local development

echo ===================================
echo Backtesting App - Development Mode
echo ===================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo Error: Virtual environment not found!
    echo Please run: python -m venv .venv
    echo Then: .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo Error: .env file not found!
    echo Please copy .env.example to .env and configure it
    pause
    exit /b 1
)

REM Start backend
echo Starting Flask backend on http://localhost:5000...
echo.
cd backend
start "Backtester Backend" cmd /k "..\\.venv\\Scripts\\python.exe app.py"
cd ..

timeout /t 3 /nobreak > nul

echo Backend should be running at http://localhost:5000
echo   API Docs: http://localhost:5000/
echo   Health: http://localhost:5000/api/health
echo.

echo Frontend:
echo   Open frontend\index.html in your browser
echo.

echo Press any key to exit...
pause > nul
