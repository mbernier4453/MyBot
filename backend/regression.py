#!/usr/bin/env python3
"""
Calculate OLS regression for overlayed tickers.
Reads JSON from stdin, outputs JSON results to stdout.
"""
import sys
import json
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from typing import Dict, List, Any


def align_data_by_timestamp(main_data: Dict, overlay_data: List[Dict]) -> pd.DataFrame:
    """Align main ticker and overlay tickers by timestamp."""
    # Create main series
    main_series = pd.Series(
        data=main_data['closes'],
        index=pd.to_datetime(main_data['timestamps'], unit='ms')
    )
    main_series.name = 'main'
    
    # Create overlay series
    overlay_series = {}
    for i, overlay in enumerate(overlay_data):
        series = pd.Series(
            data=overlay['closes'],
            index=pd.to_datetime(overlay['timestamps'], unit='ms')
        )
        series.name = f"overlay_{i}"
        overlay_series[overlay['ticker']] = series
    
    # Combine all series
    df = pd.DataFrame({
        'main': main_series,
        **overlay_series
    })
    
    # Drop rows with any NaN values
    df = df.dropna()
    
    return df


def calculate_ols_regression(y_data: np.ndarray, x_data: np.ndarray) -> Dict[str, float]:
    """Calculate OLS regression statistics."""
    n = len(y_data)
    
    if n < 2:
        return {
            'beta': np.nan,
            'alpha': np.nan,
            'r_squared': np.nan,
            'correlation': np.nan
        }
    
    # Reshape for sklearn
    X = x_data.reshape(-1, 1)
    y = y_data
    
    # Fit linear regression
    reg = LinearRegression().fit(X, y)
    
    beta = float(reg.coef_[0])
    alpha = float(reg.intercept_)
    r_squared = float(reg.score(X, y))
    
    # Calculate correlation
    correlation = float(np.corrcoef(x_data, y_data)[0, 1])
    
    return {
        'beta': beta,
        'alpha': alpha,
        'r_squared': r_squared,
        'correlation': correlation
    }


def calculate_residuals(main_data: np.ndarray, overlay_data: np.ndarray, alpha: float, beta: float) -> np.ndarray:
    """
    Calculate regression residuals (spread from OLS line).
    
    Residual = Actual - Predicted
             = main - (alpha + beta × overlay)
    
    The OLS line minimizes these residuals, so they oscillate around zero.
    This is the true "spread" - how much the actual values deviate from
    the expected relationship.
    
    Positive residual: Main ticker is trading ABOVE the regression line
    Negative residual: Main ticker is trading BELOW the regression line
    Zero: Main ticker is exactly on the regression line
    """
    predicted_main = alpha + (beta * overlay_data)
    residuals = main_data - predicted_main
    return residuals


def main():
    try:
        # Read input from stdin
        sys.stderr.write("Starting regression calculation...\n")
        sys.stderr.flush()
        
        input_data = json.load(sys.stdin)
        sys.stderr.write(f"Loaded input data: {list(input_data.keys())}\n")
        sys.stderr.flush()
        
        main_ticker = input_data['mainTicker']
        main_data = input_data['mainData']
        overlay_data = input_data['overlayData']
        
        sys.stderr.write(f"Main ticker: {main_ticker}\n")
        sys.stderr.write(f"Main data timestamps: {len(main_data.get('timestamps', []))}\n")
        sys.stderr.write(f"Overlay count: {len(overlay_data)}\n")
        sys.stderr.flush()
        
        # Align data
        sys.stderr.write("Aligning data...\n")
        sys.stderr.flush()
        df = align_data_by_timestamp(main_data, overlay_data)
        sys.stderr.write(f"Aligned data shape: {df.shape}\n")
        sys.stderr.flush()
        
        if len(df) < 2:
            sys.stderr.write("Not enough data points\n")
            sys.stderr.flush()
            print(json.dumps({
                'success': False,
                'error': 'Not enough overlapping data points for regression'
            }))
            return
        
        # Calculate regression for each overlay
        sys.stderr.write("Calculating regressions...\n")
        sys.stderr.flush()
        results = []
        for ticker_data in overlay_data:
            ticker = ticker_data['ticker']
            sys.stderr.write(f"Processing {ticker}...\n")
            sys.stderr.flush()
            
            if ticker not in df.columns:
                sys.stderr.write(f"  {ticker} not in aligned data columns\n")
                sys.stderr.flush()
                continue
            
            # Get aligned data
            y_data = df['main'].values
            x_data = df[ticker].values
            
            # Calculate OLS
            ols_result = calculate_ols_regression(y_data, x_data)
            
            # Calculate residuals (spread from OLS line)
            residuals = calculate_residuals(y_data, x_data, ols_result['alpha'], ols_result['beta'])
            
            sys.stderr.write(f"  Residuals calculated: length={len(residuals)}, min={residuals.min():.2f}, max={residuals.max():.2f}, mean={residuals.mean():.2f}\n")
            sys.stderr.flush()
            
            results.append({
                'ticker': ticker,
                'color': ticker_data['color'],
                'beta': ols_result['beta'],
                'alpha': ols_result['alpha'],
                'r_squared': ols_result['r_squared'],
                'correlation': ols_result['correlation'],
                'x_data': x_data.tolist(),
                'y_data': y_data.tolist(),
                'spread': residuals.tolist(),
                'timestamps': (df.index.astype(np.int64) // 1_000_000).tolist()  # Convert nanoseconds to milliseconds
            })
            sys.stderr.write(f"  {ticker} done: beta={ols_result['beta']:.4f}, residual range=[{residuals.min():.2f}, {residuals.max():.2f}]\n")
            sys.stderr.flush()
        
        sys.stderr.write(f"Completed {len(results)} regressions\n")
        sys.stderr.flush()
        
        # Output results
        output = {
            'success': True,
            'mainTicker': main_ticker,
            'results': results,
            'dataPoints': len(df)
        }
        
        sys.stderr.write("Outputting results...\n")
        sys.stderr.flush()
        print(json.dumps(output))
        sys.stderr.write("Done!\n")
        sys.stderr.flush()
        
    except Exception as e:
        sys.stderr.write(f"ERROR: {str(e)}\n")
        sys.stderr.write(f"ERROR TYPE: {type(e).__name__}\n")
        import traceback
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
