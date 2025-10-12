#!/usr/bin/env python3
"""
Load historical data for strategy preview visualization
"""
import sys
import json
import yfinance as yf
from datetime import datetime, timedelta

def load_preview_data(params):
    """
    Load historical price data for visualization
    
    Args:
        params: dict with keys:
            - ticker: str (e.g., 'SPY')
            - period: str (e.g., '1y', '6mo', '3mo')
            - interval: str (e.g., '1d', '1h', '15m')
    
    Returns:
        dict with success, data (dates, open, high, low, close, volume)
    """
    try:
        ticker = params.get('ticker', 'SPY')
        period = params.get('period', '1y')
        interval = params.get('interval', '1d')
        
        # Download data from yfinance (auto_adjust=True to suppress warning)
        data = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        
        if data.empty:
            return {
                'success': False,
                'error': f'No data retrieved for {ticker}'
            }
        
        # Reset index to make date a column
        data = data.reset_index()
        
        # Convert to JSON-serializable format
        # Flatten the data - yfinance returns multi-level columns for single ticker
        def flatten_value(x):
            """Extract scalar from potentially nested array"""
            while hasattr(x, '__iter__') and not isinstance(x, (str, bytes)):
                if len(x) == 0:
                    return None
                x = x[0]
            return float(x) if x is not None else None
        
        result = {
            'success': True,
            'data': {
                'ticker': ticker,
                'period': period,
                'interval': interval,
                'dates': data['Date'].dt.strftime('%Y-%m-%d').tolist() if 'Date' in data.columns else data.index.strftime('%Y-%m-%d').tolist(),
                'open': [flatten_value(x) for x in data['Open'].values],
                'high': [flatten_value(x) for x in data['High'].values],
                'low': [flatten_value(x) for x in data['Low'].values],
                'close': [flatten_value(x) for x in data['Close'].values],
                'volume': [int(flatten_value(x)) if flatten_value(x) is not None else 0 for x in data['Volume'].values]
            }
        }
        
        return result
        
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
        params = json.loads(sys.argv[1])
        result = load_preview_data(params)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Script error: {str(e)}'
        }))
        sys.exit(1)
