"""
Test script for new backtesting engine
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backtest.engine import run_backtest, preview_strategy
from backtest.indicators import Indicators

def test_simple_rsi_strategy():
    """Test a simple RSI strategy"""
    print("=" * 60)
    print("Testing Simple RSI Strategy")
    print("=" * 60)
    
    # Date range - last 6 months
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
    
    # Config
    config = {
        'symbols': ['AAPL'],
        'start_date': start_date,
        'end_date': end_date,
        'initial_capital': 100000,
        'order_type': 'MOC',
        'slippage_bps': 5,
        'commission_bps': 1,
        
        # Indicators to calculate
        'indicators': {
            'rsi': {'period': 14}
        },
        
        # Entry: RSI < 30
        'entry_conditions': [
            {
                'type': 'rsi',
                'source': 'rsi',
                'comparison': 'below',
                'target': 30
            }
        ],
        
        # Exit: RSI > 70
        'exit_conditions': [
            {
                'type': 'rsi',
                'source': 'rsi',
                'comparison': 'above',
                'target': 70
            }
        ],
        
        'entry_logic': 'all',
        'exit_logic': 'all'
    }
    
    try:
        result = run_backtest(config, 'AAPL')
        
        print("\n📊 Backtest Results:")
        print(f"  Initial Capital: ${result['metrics']['init_cap']:,.2f}")
        print(f"  Final Capital:   ${result['metrics']['end_cap']:,.2f}")
        print(f"  Total Return:    {result['metrics']['total_return']*100:.2f}%")
        print(f"  CAGR:            {result['metrics']['cagr']*100:.2f}%")
        print(f"  Sharpe Ratio:    {result['metrics'].get('sharpe', 0):.2f}")
        print(f"  Max Drawdown:    {result['metrics'].get('maxdd', 0)*100:.2f}%")
        print(f"  Total Trades:    {result['metrics']['trades_total']}")
        print(f"    Entries:       {result['metrics']['trades_entry']}")
        print(f"    Exits:         {result['metrics']['trades_exit']}")
        
        print("\n✅ Simple RSI strategy test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_preview():
    """Test preview function"""
    print("\n" + "=" * 60)
    print("Testing Preview Function")
    print("=" * 60)
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    
    try:
        result = preview_strategy(
            symbol='MSFT',
            start_date=start_date,
            end_date=end_date,
            indicators_config={
                'rsi': {'period': 14},
                'macd': {'fast': 12, 'slow': 26, 'signal': 9}
            },
            entry_conditions=[
                {
                    'source': 'rsi',
                    'comparison': 'below',
                    'target': 35
                }
            ],
            exit_conditions=[
                {
                    'source': 'rsi',
                    'comparison': 'above',
                    'target': 65
                }
            ]
        )
        
        print(f"\n📈 Preview Results:")
        print(f"  Data points:     {len(result['df'])}")
        print(f"  Indicators:      {list(result['indicators'].keys())}")
        print(f"  Entry signals:   {result['entry_count']}")
        print(f"  Exit signals:    {result['exit_count']}")
        
        print("\n✅ Preview test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_indicators():
    """Test indicator calculations"""
    print("\n" + "=" * 60)
    print("Testing Indicator Calculations")
    print("=" * 60)
    
    import pandas as pd
    import numpy as np
    
    # Create sample data
    dates = pd.date_range('2024-01-01', periods=100, freq='D')
    prices = 100 + np.cumsum(np.random.randn(100) * 2)
    
    df = pd.DataFrame({
        'Open': prices * 0.99,
        'High': prices * 1.02,
        'Low': prices * 0.98,
        'Close': prices,
        'Volume': np.random.randint(1000000, 10000000, 100)
    }, index=dates)
    
    try:
        # Test all indicators
        indicators = Indicators.calculate_all(df, {
            'rsi': {'period': 14},
            'macd': {'fast': 12, 'slow': 26, 'signal': 9},
            'bb': {'period': 20, 'std_dev': 2.0},
            'sma': {'period': 20},
            'ema': {'period': 20}
        })
        
        print(f"\n✅ Calculated {len(indicators)} indicators:")
        for name in indicators.keys():
            non_null = indicators[name].notna().sum()
            print(f"  - {name}: {non_null}/{len(df)} valid values")
        
        print("\n✅ Indicator test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    print("\n🚀 Starting Backtest Engine Tests\n")
    
    results = []
    
    # Run tests
    results.append(("Indicators", test_indicators()))
    results.append(("Preview", test_preview()))
    results.append(("Simple RSI Strategy", test_simple_rsi_strategy()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed")
