#!/usr/bin/env python3
"""
Test backend setup and Polygon S3 connection
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_setup():
    print("=" * 60)
    print("BACKEND SETUP TEST")
    print("=" * 60)
    
    # Test 1: Configuration
    print("\n1. Testing configuration...")
    try:
        from config import validate_config, POLYGON_API_KEY, AWS_ACCESS_KEY_ID, DATA_CACHE_DIR
        is_valid, message = validate_config()
        
        if is_valid:
            print(f"   ✓ {message}")
            print(f"   ✓ API Key: {POLYGON_API_KEY[:10]}...")
            print(f"   ✓ AWS Key: {AWS_ACCESS_KEY_ID[:10]}...")
            print(f"   ✓ Cache: {DATA_CACHE_DIR}")
        else:
            print(f"   ✗ {message}")
            print("\n   Please fill in your credentials in .env file:")
            print("   - POLYGON_API_KEY")
            print("   - AWS_ACCESS_KEY_ID")
            print("   - AWS_SECRET_ACCESS_KEY")
            return False
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return False
    
    # Test 2: Polygon flat files
    print("\n2. Testing Polygon S3 flat files...")
    try:
        from data.polygon_flatfiles import PolygonFlatFiles
        from datetime import datetime, timedelta
        
        pf = PolygonFlatFiles()
        
        # Test with a recent weekday
        test_date = datetime.now() - timedelta(days=7)
        while test_date.weekday() >= 5:  # Skip weekends
            test_date -= timedelta(days=1)
        
        date_str = test_date.strftime('%Y-%m-%d')
        print(f"   Testing with date: {date_str}")
        
        data = pf.get_daily_bars('AAPL', date_str, date_str)
        
        if not data.empty:
            print(f"   ✓ Downloaded AAPL data ({len(data)} bars)")
            print(f"   ✓ Sample: {data.iloc[0].to_dict()}")
        else:
            print(f"   ✗ No data returned (might be a holiday)")
            return False
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 3: Preview data loader
    print("\n3. Testing preview data loader...")
    try:
        from preview.load_preview_data import load_preview_data
        
        result = load_preview_data({
            'ticker': 'AAPL',
            'period': '1mo',
            'interval': '1d'
        })
        
        if result.get('success'):
            data_len = len(result['data']['dates'])
            print(f"   ✓ Loaded {data_len} days of AAPL data")
            print(f"   ✓ Date range: {result['data']['dates'][0]} to {result['data']['dates'][-1]}")
        else:
            print(f"   ✗ Error: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✓ ALL TESTS PASSED!")
    print("=" * 60)
    print("\nBackend is ready to use!")
    print("Next steps:")
    print("  1. Restart your Electron app")
    print("  2. Go to Backtest tab")
    print("  3. Create a run and try 'Generate Preview'")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_setup()
    sys.exit(0 if success else 1)
