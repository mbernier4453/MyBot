#!/usr/bin/env python3
"""
Load historical data for strategy preview visualization
"""
import sys
import json
import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load .env from workspace root
root_dir = Path(__file__).parent
load_dotenv(root_dir / '.env')

from backtester.data_loader import load_bars

def load_preview_data(params):
    """
    Load historical price data for visualization
    
    Args:
        params: dict with keys:
            - ticker: str (e.g., 'SPY')
            - period: str (e.g., '1y', '6mo', '3mo') OR
            - startDate: str (e.g., '2023-01-01')
            - endDate: str (e.g., '2024-01-01')
            - interval: str (e.g., '1d', '1h', '15m')
    
    Returns:
        dict with success, data (dates, open, high, low, close, volume)
    """
    try:
        ticker = params.get('ticker', 'SPY')
        interval = params.get('interval', '1d')
        period = params.get('period', '1y')  # Set default even if using date range
        
        # Check if using date range or period
        start_date = params.get('startDate')
        end_date = params.get('endDate')
        
        if start_date and end_date:
            # Use date range
            data = load_bars(ticker, start_date, end_date)
        else:
            # Convert period to date range
            # Map period string to days
            period_map = {
                '1d': 1, '5d': 5,
                '1mo': 30, '3mo': 90, '6mo': 180,
                '1y': 365, '2y': 730, '5y': 1825, '10y': 3650,
                'ytd': (datetime.now() - datetime(datetime.now().year, 1, 1)).days,
                'max': 7300  # ~20 years
            }
            days = period_map.get(period, 365)
            end_date_dt = datetime.now()
            start_date_dt = end_date_dt - timedelta(days=days)
            data = load_bars(ticker, start_date_dt.strftime('%Y-%m-%d'), end_date_dt.strftime('%Y-%m-%d'))
        
        if data.empty:
            return {
                'success': False,
                'error': f'No data retrieved for {ticker}'
            }
        
        # Ensure index is DatetimeIndex before reset
        if not isinstance(data.index, pd.DatetimeIndex):
            return {
                'success': False,
                'error': f'Invalid data format: expected DatetimeIndex, got {type(data.index)}'
            }
        
        # Reset index to make date a column
        data = data.reset_index()
        
        # Normalize column names (handle both S3 lowercase and yfinance capitalized)
        # After reset_index(), the date column might be 'index' or already named
        if 'index' in data.columns:
            data.rename(columns={'index': 'date'}, inplace=True)
        data.columns = [col.lower() for col in data.columns]
        
        # Convert to JSON-serializable format
        result = {
            'success': True,
            'data': {
                'ticker': ticker,
                'period': period,
                'interval': interval,
                'dates': data['date'].dt.strftime('%Y-%m-%d').tolist(),
                'open': [float(x) for x in data['open'].values],
                'high': [float(x) for x in data['high'].values],
                'low': [float(x) for x in data['low'].values],
                'close': [float(x) for x in data['close'].values],
                'volume': [int(x) for x in data['volume'].values]
            }
        }
        
        return result
        
    except PermissionError as e:
        return {
            'success': False,
            'error': f'File locking error (retry may succeed): {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No parameters provided'
        }))
        sys.exit(1)
    
    try:
        # Debug: log what we received
        import sys
        received_arg = sys.argv[1] if len(sys.argv) > 1 else 'NO ARG'
        print(f'[DEBUG] Received arg: {received_arg}', file=sys.stderr)
        
        params = json.loads(sys.argv[1])
        print(f'[DEBUG] Parsed params: {params}', file=sys.stderr)
        
        result = load_preview_data(params)
        print(f'[DEBUG] Result success: {result.get("success")}', file=sys.stderr)
        if not result.get('success'):
            print(f'[DEBUG] Error: {result.get("error")}', file=sys.stderr)
        
        json_output = json.dumps(result)
        print(f'[DEBUG] JSON length: {len(json_output)}', file=sys.stderr)
        
        # Write directly to stdout and flush
        sys.stdout.write(json_output)
        sys.stdout.write('\n')
        sys.stdout.flush()
        sys.exit(0)
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'JSON decode error: {str(e)}'
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Script error: {str(e)}'
        }))
        sys.exit(1)
