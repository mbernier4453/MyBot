"""
Market Breadth CLI - Simplified for Electron Integration
Provides S&P 500 breadth data via command-line interface
"""

import sys
import json
import argparse
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import requests
import os
from pathlib import Path

# Get API key from environment or config
try:
    from backend.config import POLYGON_API_KEY
except ImportError:
    try:
        from config import POLYGON_API_KEY
    except ImportError:
        POLYGON_API_KEY = os.getenv('POLYGON_API_KEY', '')

BASE_URL = "https://api.polygon.io"
CACHE_DIR = Path(__file__).parent / 'data' / 'breadth_cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_sp500_tickers():
    """Get S&P 500 tickers from treemap data or cache"""
    cache_file = CACHE_DIR / 'sp500_tickers.json'
    
    if cache_file.exists():
        age = datetime.now() - datetime.fromtimestamp(cache_file.stat().st_mtime)
        if age < timedelta(days=1):
            with open(cache_file, 'r') as f:
                return json.load(f)
    
    # For demo, use top 100 S&P tickers
    demo_tickers = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'JNJ',
        'V', 'PG', 'JPM', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP',
        'KO', 'AVGO', 'COST', 'PFE', 'TMO', 'MCD', 'WMT', 'CSCO', 'ACN', 'DHR',
        'ABT', 'ADBE', 'NKE', 'DIS', 'CRM', 'NFLX', 'VZ', 'CMCSA', 'TXN', 'ORCL',
        'INTC', 'WFC', 'PM', 'BMY', 'UNP', 'AMD', 'NEE', 'RTX', 'UPS', 'HON',
        'T', 'LMT', 'QCOM', 'INTU', 'LOW', 'ELV', 'SPGI', 'BA', 'AMAT', 'DE',
        'SBUX', 'CAT', 'AXP', 'GE', 'BKNG', 'MS', 'AMT', 'BLK', 'GS', 'NOW',
        'MDT', 'MDLZ', 'SYK', 'ADP', 'CVS', 'GILD', 'TJX', 'VRTX', 'ADI', 'CI',
        'MMC', 'ZTS', 'ISRG', 'C', 'PLD', 'SO', 'REGN', 'MO', 'SCHW', 'PGR',
        'CB', 'DUK', 'ETN', 'EOG', 'ITW', 'BSX', 'USB', 'BDX', 'COP', 'SLB'
    ]
    
    with open(cache_file, 'w') as f:
        json.dump(demo_tickers, f)
    
    return demo_tickers


def fetch_daily_bars(ticker, start_date, end_date):
    """Fetch daily OHLCV data with caching"""
    cache_file = CACHE_DIR / f'{ticker}_daily_{start_date}_{end_date}.json'
    
    if cache_file.exists():
        with open(cache_file, 'r') as f:
            return json.load(f)
    
    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day/{start_date}/{end_date}"
    params = {'adjusted': 'true', 'sort': 'asc', 'apiKey': POLYGON_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'results' in data:
            results = data['results']
            with open(cache_file, 'w') as f:
                json.dump(results, f)
            return results
    except Exception as e:
        print(f"Error fetching {ticker}: {e}", file=sys.stderr)
    
    return []


def calculate_advance_decline_line(days=252):
    """Calculate A/D Line"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days + 260)
    
    tickers = get_sp500_tickers()[:50]  # Limit for performance
    
    # Fetch all data
    all_data = {}
    for ticker in tickers:
        bars = fetch_daily_bars(
            ticker,
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        if bars:
            all_data[ticker] = {
                datetime.fromtimestamp(b['t'] / 1000).strftime('%Y-%m-%d'): b['c']
                for b in bars
            }
    
    # Calculate daily advances/declines
    all_dates = sorted(set(date for data in all_data.values() for date in data.keys()))
    
    ad_data = []
    for i, date in enumerate(all_dates):
        if i == 0:
            continue
        
        prev_date = all_dates[i - 1]
        advancers = decliners = unchanged = 0
        
        for ticker, prices in all_data.items():
            if date in prices and prev_date in prices:
                today = prices[date]
                yesterday = prices[prev_date]
                if today > yesterday:
                    advancers += 1
                elif today < yesterday:
                    decliners += 1
                else:
                    unchanged += 1
        
        net = advancers - decliners
        ad_data.append({
            'date': date,
            'advancers': advancers,
            'decliners': decliners,
            'unchanged': unchanged,
            'net': net
        })
    
    # Calculate cumulative A/D line and MA
    df = pd.DataFrame(ad_data)
    df['AD_Line'] = df['net'].cumsum()
    df['MA_10'] = df['AD_Line'].rolling(window=10).mean()
    
    stats = {
        'current_ad_line': float(df['AD_Line'].iloc[-1]),
        'ma_10': float(df['MA_10'].iloc[-1]) if pd.notna(df['MA_10'].iloc[-1]) else None,
        'total_stocks': len(all_data)
    }
    
    # Convert to dict and replace NaN with None
    data = df.to_dict(orient='records')
    data = [{k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()} for row in data]
    
    return data, stats


def calculate_highs_lows(days=252):
    """Calculate 52-week highs and lows"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days + 520)
    
    tickers = get_sp500_tickers()[:50]
    
    # Fetch all data
    all_data = {}
    for ticker in tickers:
        bars = fetch_daily_bars(
            ticker,
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        if bars and len(bars) >= 252:
            all_data[ticker] = {
                datetime.fromtimestamp(b['t'] / 1000).strftime('%Y-%m-%d'): {
                    'close': b['c'],
                    'high': b['h'],
                    'low': b['l']
                }
                for b in bars
            }
    
    # Calculate highs/lows
    analysis_start = (end_date - timedelta(days=days)).strftime('%Y-%m-%d')
    all_dates = sorted(set(date for data in all_data.values() for date in data.keys()))
    analysis_dates = [d for d in all_dates if d >= analysis_start]
    
    hl_data = []
    for date in analysis_dates:
        new_highs = new_lows = 0
        
        for ticker, prices in all_data.items():
            if date not in prices:
                continue
            
            # Get 252-day lookback
            prior_dates = [d for d in all_dates if d < date]
            if len(prior_dates) < 252:
                continue
            
            lookback_start = prior_dates[-252]
            lookback_dates = [d for d in all_dates if lookback_start <= d <= date]
            
            today_close = prices[date]['close']
            period_high = max(prices[d]['high'] for d in lookback_dates if d in prices)
            period_low = min(prices[d]['low'] for d in lookback_dates if d in prices)
            
            if today_close >= period_high:
                new_highs += 1
            if today_close <= period_low:
                new_lows += 1
        
        hl_data.append({
            'date': date,
            'new_highs': new_highs,
            'new_lows': new_lows,
            'net': new_highs - new_lows
        })
    
    df = pd.DataFrame(hl_data)
    df['net_ma_10'] = df['net'].rolling(window=10).mean()
    
    stats = {
        'current_highs': int(df['new_highs'].iloc[-1]),
        'current_lows': int(df['new_lows'].iloc[-1]),
        'net': int(df['net'].iloc[-1])
    }
    
    # Convert to dict and replace NaN with None
    data = df.to_dict(orient='records')
    data = [{k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()} for row in data]
    
    return data, stats


def calculate_percent_above_ma(days=252):
    """Calculate percent above 50-day and 200-day MAs"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days + 460)
    
    tickers = get_sp500_tickers()[:50]
    
    # Fetch all data and calculate MAs
    all_data = {}
    for ticker in tickers:
        bars = fetch_daily_bars(
            ticker,
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        if bars:
            df = pd.DataFrame([
                {
                    'date': datetime.fromtimestamp(b['t'] / 1000).strftime('%Y-%m-%d'),
                    'close': b['c']
                }
                for b in bars
            ])
            df['MA_50'] = df['close'].rolling(window=50).mean()
            df['MA_200'] = df['close'].rolling(window=200).mean()
            all_data[ticker] = df.set_index('date').to_dict(orient='index')
    
    # Calculate percent above MAs
    analysis_start = (end_date - timedelta(days=days)).strftime('%Y-%m-%d')
    all_dates = sorted(set(date for data in all_data.values() for date in data.keys()))
    analysis_dates = [d for d in all_dates if d >= analysis_start]
    
    ma_data = []
    for date in analysis_dates:
        above_50 = above_200 = valid_50 = valid_200 = 0
        
        for ticker, prices in all_data.items():
            if date not in prices:
                continue
            
            data = prices[date]
            close = data['close']
            
            if pd.notna(data.get('MA_50')):
                valid_50 += 1
                if close > data['MA_50']:
                    above_50 += 1
            
            if pd.notna(data.get('MA_200')):
                valid_200 += 1
                if close > data['MA_200']:
                    above_200 += 1
        
        pct_50 = (above_50 / valid_50 * 100) if valid_50 > 0 else 0
        pct_200 = (above_200 / valid_200 * 100) if valid_200 > 0 else 0
        
        ma_data.append({
            'date': date,
            'pct_above_50': pct_50,
            'pct_above_200': pct_200,
            'count_50': valid_50,
            'count_200': valid_200
        })
    
    df = pd.DataFrame(ma_data)
    
    # Detect breadth thrust
    df['breadth_thrust'] = False
    for i in range(10, len(df)):
        window = df.iloc[i-10:i+1]
        if window['pct_above_50'].min() < 40 and window['pct_above_50'].max() > 61.5:
            df.loc[df.index[i], 'breadth_thrust'] = True
    
    stats = {
        'current_above_50': float(df['pct_above_50'].iloc[-1]),
        'current_above_200': float(df['pct_above_200'].iloc[-1]),
        'breadth_thrust_detected': bool(df['breadth_thrust'].any())
    }
    
    # Convert to dict and replace NaN with None
    data = df.to_dict(orient='records')
    data = [{k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()} for row in data]
    
    return data, stats


def main():
    parser = argparse.ArgumentParser(description='Market Breadth Calculator')
    parser.add_argument('indicator', choices=['ad-line', 'highs-lows', 'percent-ma', 'tick'],
                       help='Indicator to calculate')
    parser.add_argument('--days', type=int, default=252,
                       help='Number of days for analysis')
    parser.add_argument('--date', type=str, default=None,
                       help='Date for TICK proxy (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    try:
        if args.indicator == 'ad-line':
            data, stats = calculate_advance_decline_line(args.days)
        elif args.indicator == 'highs-lows':
            data, stats = calculate_highs_lows(args.days)
        elif args.indicator == 'percent-ma':
            data, stats = calculate_percent_above_ma(args.days)
        elif args.indicator == 'tick':
            # TICK proxy requires intraday data - simplified mock for demo
            data = []
            stats = {'max_tick': 0, 'min_tick': 0, 'mean_tick': 0}
        
        result = {
            'success': True,
            'data': data,
            'stats': stats
        }
        print(json.dumps(result))
        
    except Exception as e:
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
