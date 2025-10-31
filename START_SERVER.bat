@echo off
title BACKEND API SERVER - DO NOT CLOSE THIS WINDOW!
color 0A

echo.
echo ========================================================
echo   BACKEND API SERVER - KEEP THIS WINDOW OPEN!
echo ========================================================
echo.
echo   Starting Flask server...
echo   This window MUST stay open for the API to work!
echo.
echo   API will be available at: http://localhost:5000
echo.
echo   To stop the server: Close this window or press Ctrl+C
echo ========================================================
echo.

cd /d "%~dp0"
.venv\Scripts\python.exe run_server.py

echo.
echo ========================================================
echo   SERVER STOPPED
echo ========================================================
echo.
pause
