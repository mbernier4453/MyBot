#!/usr/bin/env python3
"""
Load historical data for strategy preview visualization using Polygon flat files
"""
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from data.polygon_flatfiles import PolygonFlatFiles

def load_preview_data(params):
    """
    Load historical price data for visualization using Polygon flat files
    
    Args:
        params: dict with keys:
            - ticker: str (e.g., 'SPY')
            - period: str (e.g., '1y', '6mo', '3mo') OR
            - startDate: str (e.g., '2023-01-01')
            - endDate: str (e.g., '2024-01-01')
            - interval: str (e.g., '1d')
    
    Returns:
        dict with success, data (dates, open, high, low, close, volume)
    """
    try:
        ticker = params.get('ticker', 'SPY')
        interval = params.get('interval', '1d')
        
        # Only support daily data for now (Polygon flat files are daily)
        if interval != '1d':
            return {
                'success': False,
                'error': f'Only daily (1d) interval supported with flat files, got {interval}'
            }
        
        # Check if using date range or period
        start_date = params.get('startDate')
        end_date = params.get('endDate')
        
        if not start_date or not end_date:
            # Convert period to date range
            period = params.get('period', '1y')
            end_date = datetime.now().strftime('%Y-%m-%d')
            
            if period == '1y':
                start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            elif period == '6mo':
                start_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
            elif period == '3mo':
                start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
            elif period == '1mo':
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            else:
                start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        
        # Load data from Polygon flat files
        polygon = PolygonFlatFiles()
        data = polygon.get_daily_bars(ticker, start_date, end_date)
        
        if data.empty:
            return {
                'success': False,
                'error': f'No data retrieved for {ticker} from {start_date} to {end_date}'
            }
        
        # Convert to JSON-serializable format
        result = {
            'success': True,
            'data': {
                'ticker': ticker,
                'interval': interval,
                'startDate': start_date,
                'endDate': end_date,
                'dates': data.index.strftime('%Y-%m-%d').tolist(),
                'open': data['open'].round(4).tolist(),
                'high': data['high'].round(4).tolist(),
                'low': data['low'].round(4).tolist(),
                'close': data['close'].round(4).tolist(),
                'volume': data['volume'].astype(int).tolist()
            }
        }
        
        return result
        
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
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
