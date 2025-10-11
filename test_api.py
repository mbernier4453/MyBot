"""
Quick test script to verify the backtester API server works correctly.
Run this after installing Flask: pip install flask flask-cors
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"

def test_health():
    """Test the health check endpoint."""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"✓ Health check: {response.json()}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_run_backtest():
    """Test running a simple backtest."""
    print("\nTesting backtest run...")
    
    config = {
        "RUN_ID": "FrontendTest",
        "NOTES": "Testing frontend integration",
        "TICKERS": ["AAPL"],
        "INITIAL_CAPITAL": 100000,
        "START": "2023-01-01",
        "END": "2023-12-31",
        "TIMESCALE": "1Day",
        "BUY_HOLD_ENABLED": True,
        "BENCHMARK_ENABLED": True,
        "BENCHMARK_SYMBOL": "SPY",
        "RF_ANNUAL": 0.02,
        "PERIODS_PER_YEAR": 252,
        "TARGET_WEIGHT": 0.95,
        "ORDER_TYPE": "MOO",
        "ENTRY_FEES_BPS": 10,
        "SLIP_OPEN_BPS": 2,
        "EXIT_FEES_BPS": 10,
        "SLIP_CLOSE_BPS": 2,
        "RSI_ENABLED": True,
        "RSI_PERIOD": [14],
        "RSI_BUY_BELOW": [30],
        "RSI_SELL_ABOVE": [70],
        "SAVE_METRICS": True,
        "SAVE_DB": True,
        "SAVE_TRADES": True,
        "CSV_DIR": "./results/csv",
        "DB_PATH": "./results/db",
        "SOURCE": "yfinance",
        "ADJUST": "split_and_div",
        "PORTFOLIO_MODE": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/backtest/run", json=config)
        result = response.json()
        
        if result.get('success'):
            backtest_id = result['backtest_id']
            print(f"✓ Backtest started: {backtest_id}")
            
            # Poll for status
            print("\nMonitoring backtest progress...")
            while True:
                status_response = requests.get(f"{BASE_URL}/api/backtest/status/{backtest_id}")
                status = status_response.json()
                
                progress = status.get('progress', 0)
                message = status.get('message', 'Running...')
                print(f"  [{progress}%] {message}")
                
                if status.get('status') == 'completed':
                    print(f"\n✓ Backtest completed successfully!")
                    print(f"  Run ID: {status.get('run_id')}")
                    return True
                elif status.get('status') == 'error':
                    print(f"\n✗ Backtest failed: {status.get('message')}")
                    return False
                
                time.sleep(2)
        else:
            print(f"✗ Failed to start backtest: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"✗ Backtest test failed: {e}")
        return False

def main():
    print("=" * 60)
    print("Backtester API Server Test")
    print("=" * 60)
    print("\nMake sure the API server is running:")
    print("  python api_server.py")
    print("\nOr it will start automatically with the Electron app.")
    print("=" * 60)
    
    input("\nPress Enter to start tests...")
    
    # Test health
    if not test_health():
        print("\n❌ Server is not running or not responding.")
        print("Start the server with: python api_server.py")
        return
    
    # Test backtest
    print("\nThis will run a real backtest with AAPL data for 2023.")
    print("It may take 30-60 seconds to complete.")
    proceed = input("\nProceed with backtest test? (y/n): ")
    
    if proceed.lower() == 'y':
        test_run_backtest()
    else:
        print("Skipping backtest test.")
    
    print("\n" + "=" * 60)
    print("Tests complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
