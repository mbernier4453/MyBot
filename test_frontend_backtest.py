#!/usr/bin/env python3
"""
Test the run_backtest.py script to ensure it works correctly.
This tests the script directly without needing the Electron frontend.
"""

import json
import subprocess
import sys

# Minimal test configuration
test_config = {
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
    
    "PORTFOLIO_MODE": False,
    
    "TARGET_WEIGHT": 0.95,
    "ORDER_TYPE": "MOO",
    "ENTRY_FEES_BPS": 10,
    "SLIP_OPEN_BPS": 2,
    "EXIT_FEES_BPS": 10,
    "SLIP_CLOSE_BPS": 2,
    
    "SOURCE": "yfinance",
    "ADJUST": "split_and_div",
    
    "RSI_ENABLED": True,
    "RSI_PERIOD": [14],
    "RSI_BUY_BELOW": [30],
    "RSI_SELL_ABOVE": [70],
    
    "CSV_DIR": "./results/csv",
    "SAVE_METRICS": True,
    "SAVE_DB": True,
    "DB_PATH": "./results/db",
    "SAVE_TRADES": True
}

def test_backtest():
    """Run the backtest script and monitor output."""
    print("=" * 80)
    print("Testing run_backtest.py")
    print("=" * 80)
    print(f"\nConfiguration:")
    print(json.dumps(test_config, indent=2))
    print("\n" + "=" * 80)
    print("Starting backtest subprocess...")
    print("=" * 80 + "\n")
    
    # Convert config to JSON string
    config_json = json.dumps(test_config)
    
    # Run the script
    try:
        process = subprocess.Popen(
            [sys.executable, 'run_backtest.py', config_json],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Monitor output
        progress_messages = []
        result_message = None
        
        # Read stdout line by line
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
                
            try:
                msg = json.loads(line)
                
                if msg.get('type') == 'progress':
                    progress_messages.append(msg)
                    status = msg.get('status', '?')
                    progress = msg.get('progress', 0)
                    message = msg.get('message', '')
                    print(f"[{status.upper()}] {progress}% - {message}")
                    
                elif msg.get('type') == 'result':
                    result_message = msg
                    print("\n" + "=" * 80)
                    print("RESULT:")
                    print("=" * 80)
                    print(json.dumps(msg, indent=2))
                    
            except json.JSONDecodeError:
                # Not JSON, just print it
                print(f"[OUTPUT] {line}")
        
        # Wait for process to complete
        return_code = process.wait()
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Return Code: {return_code}")
        print(f"Progress Updates: {len(progress_messages)}")
        
        if result_message:
            if result_message.get('success'):
                print(f"✅ SUCCESS - Run ID: {result_message.get('run_id')}")
            else:
                print(f"❌ FAILED - Error: {result_message.get('error')}")
        else:
            print("❌ NO RESULT MESSAGE RECEIVED")
        
        # Print any stderr
        stderr = process.stderr.read()
        if stderr:
            print("\n" + "=" * 80)
            print("STDERR:")
            print("=" * 80)
            print(stderr)
        
        return return_code == 0 and result_message and result_message.get('success')
        
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION:")
        print(f"   {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    print("\n🧪 Frontend Backtest Integration Test\n")
    
    success = test_backtest()
    
    print("\n" + "=" * 80)
    if success:
        print("✅ ALL TESTS PASSED!")
        print("=" * 80)
        print("\nThe backtest script is working correctly.")
        print("You can now use it from the Electron frontend.")
        sys.exit(0)
    else:
        print("❌ TEST FAILED!")
        print("=" * 80)
        print("\nPlease check the errors above.")
        sys.exit(1)
