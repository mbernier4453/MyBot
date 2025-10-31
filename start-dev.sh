#!/bin/bash
# Development startup script for Backtesting Application
# Starts both backend and frontend for local development

echo "==================================="
echo "Backtesting App - Development Mode"
echo "==================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Error: Virtual environment not found!"
    echo "Please run: python -m venv venv && venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Start backend
echo "Starting Flask backend on http://localhost:5000..."
cd backend
../venv/bin/python app.py &
BACKEND_PID=$!
cd ..

echo "Backend PID: $BACKEND_PID"
echo ""
sleep 2

# Check if backend started
if ! curl -s http://localhost:5000/api/health > /dev/null; then
    echo "Error: Backend failed to start!"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✓ Backend running at http://localhost:5000"
echo "  API Docs: http://localhost:5000/"
echo "  Health: http://localhost:5000/api/health"
echo ""

# Frontend instructions
echo "Frontend:"
echo "  Open frontend/index.html in your browser, or"
echo "  Use a simple HTTP server:"
echo "  - Python: cd frontend && python -m http.server 3000"
echo "  - Node: cd frontend && npx http-server -p 3000"
echo ""

echo "Press Ctrl+C to stop the backend..."
echo ""

# Wait for Ctrl+C
trap "echo 'Stopping backend...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT
wait $BACKEND_PID
