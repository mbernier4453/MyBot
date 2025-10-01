# Test the formatting function
import sys
sys.path.insert(0, '.')

from backtester.tearsheet import _format_metric

# Test cases
test_cases = [
    (0.0642, "total_return", "6.42%"),
    (0.0642, "cagr", "6.42%"),
    (1.523, "sharpe", "1.52"),
    (-0.1523, "maxdd", "-15.23%"),
    (0.6234, "win_rate", "62.34%"),
    (125.50, "avg_trade_pnl", "125.50"),
    (0.8523, "alpha", "0.8523"),  # CAPM - 4 decimals
    (1.2345, "beta", "1.2345"),   # CAPM - 4 decimals
    (None, "sharpe", "N/A"),
    (float('nan'), "cagr", "N/A"),
]

print("Testing _format_metric function:\n")
all_passed = True
for value, key, expected in test_cases:
    result = _format_metric(value, key)
    status = "✓" if result == expected else "✗"
    if result != expected:
        all_passed = False
    print(f"{status} {key:20s} {str(value):15s} -> {result:15s} (expected: {expected})")

print("\n" + ("="*60))
if all_passed:
    print("✓ All tests passed!")
else:
    print("✗ Some tests failed")
