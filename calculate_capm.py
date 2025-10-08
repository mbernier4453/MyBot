"""
Calculate CAPM metrics from equity curves passed via stdin.
Used by Electron frontend to compute alpha, beta, and r-squared on-demand.
"""
import sys
import json
import pandas as pd
import numpy as np
from backtester.capm import calculate_capm_metrics

def main():
    try:
        # Read JSON from stdin
        input_data = json.load(sys.stdin)

        # Parse strategy equity
        strat_data = input_data['strategy']
        strat_series = pd.Series(
            data=strat_data['data'],
            index=pd.to_datetime(strat_data['index'])
        )
        strat_series.name = strat_data.get('name', 'Strategy')

        # Parse benchmark equity
        bench_data = input_data['benchmark']
        bench_series = pd.Series(
            data=bench_data['data'],
            index=pd.to_datetime(bench_data['index'])
        )
        bench_series.name = bench_data.get('name', 'Benchmark')

        # Calculate CAPM metrics using the full function
        capm_metrics = calculate_capm_metrics(strat_series, bench_series)

        # Output JSON result
        result = {
            'alpha': float(capm_metrics['alpha']) if not np.isnan(capm_metrics['alpha']) else None,
            'beta': float(capm_metrics['beta']) if not np.isnan(capm_metrics['beta']) else None,
            'r_squared': float(capm_metrics['r_squared']) if not np.isnan(capm_metrics['r_squared']) else None,
            'tracking_error': float(capm_metrics['tracking_error']) if not np.isnan(capm_metrics['tracking_error']) else None,
            'information_ratio': float(capm_metrics['information_ratio']) if not np.isnan(capm_metrics['information_ratio']) else None  
        }

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
