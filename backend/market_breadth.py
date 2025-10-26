"""
S&P 500 Market Breadth Module
Provides four breadth indicators with Polygon.io data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import asyncio
import aiohttp
from typing import Dict, List, Tuple, Optional
import json
import os
from pathlib import Path

from backend.config import POLYGON_API_KEY

# Cache directory
CACHE_DIR = Path(__file__).parent.parent / 'data' / 'breadth_cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class MarketBreadthCalculator:
    """Calculate S&P 500 market breadth indicators"""
    
    def __init__(self, api_key: str = POLYGON_API_KEY):
        self.api_key = api_key
        self.base_url = "https://api.polygon.io"
        
    async def fetch_sp500_tickers(self) -> List[str]:
        """Get S&P 500 constituent tickers from cache or treemap data"""
        cache_file = CACHE_DIR / 'sp500_tickers.json'
        
        # Try to load from cache (valid for 1 day)
        if cache_file.exists():
            cache_age = datetime.now() - datetime.fromtimestamp(cache_file.stat().st_mtime)
            if cache_age < timedelta(days=1):
                with open(cache_file, 'r') as f:
                    return json.load(f)
        
        # Fetch from Polygon
        url = f"{self.base_url}/v3/reference/tickers"
        params = {
            'market': 'stocks',
            'active': 'true',
            'limit': 1000,
            'apiKey': self.api_key
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
                
        # Filter for likely S&P 500 members (market cap > 10B, active)
        # In production, use official S&P 500 list
        tickers = [r['ticker'] for r in data.get('results', [])[:500]]
        
        # Save to cache
        with open(cache_file, 'w') as f:
            json.dump(tickers, f)
            
        return tickers
    
    async def fetch_daily_bars(self, ticker: str, start_date: str, end_date: str, 
                               force_refresh: bool = False) -> pd.DataFrame:
        """Fetch daily OHLCV data for a ticker with caching"""
        cache_file = CACHE_DIR / f'{ticker}_daily_{start_date}_{end_date}.parquet'
        
        if not force_refresh and cache_file.exists():
            return pd.read_parquet(cache_file)
        
        url = f"{self.base_url}/v2/aggs/ticker/{ticker}/range/1/day/{start_date}/{end_date}"
        params = {
            'adjusted': 'true',
            'sort': 'asc',
            'apiKey': self.api_key
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
        
        if 'results' not in data:
            return pd.DataFrame()
        
        df = pd.DataFrame(data['results'])
        df['date'] = pd.to_datetime(df['t'], unit='ms')
        df = df.rename(columns={'o': 'open', 'h': 'high', 'l': 'low', 'c': 'close', 'v': 'volume'})
        df = df[['date', 'open', 'high', 'low', 'close', 'volume']]
        df.set_index('date', inplace=True)
        
        # Save to cache
        df.to_parquet(cache_file)
        
        return df
    
    async def fetch_minute_bars(self, ticker: str, date: str, 
                                force_refresh: bool = False) -> pd.DataFrame:
        """Fetch 1-minute bars for a ticker on a specific date"""
        cache_file = CACHE_DIR / f'{ticker}_minute_{date}.parquet'
        
        if not force_refresh and cache_file.exists():
            return pd.read_parquet(cache_file)
        
        url = f"{self.base_url}/v2/aggs/ticker/{ticker}/range/1/minute/{date}/{date}"
        params = {
            'adjusted': 'true',
            'sort': 'asc',
            'apiKey': self.api_key
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
        
        if 'results' not in data:
            return pd.DataFrame()
        
        df = pd.DataFrame(data['results'])
        df['timestamp'] = pd.to_datetime(df['t'], unit='ms')
        df = df.rename(columns={'c': 'close'})
        df = df[['timestamp', 'close']]
        df.set_index('timestamp', inplace=True)
        
        # Filter to market hours (9:30 AM - 4:00 PM ET)
        df = df.between_time('09:30', '16:00')
        
        # Save to cache
        df.to_parquet(cache_file)
        
        return df
    
    async def calculate_advance_decline_line(self, days: int = 252, 
                                            force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict]:
        """
        Chart 1: Advance-Decline Line
        Returns: (DataFrame with AD_Line and MA_10, stats dict)
        """
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=days + 260)).strftime('%Y-%m-%d')  # Extra for lookback
        
        tickers = await self.fetch_sp500_tickers()
        
        # Fetch all daily data
        all_data = {}
        print(f"Fetching daily data for {len(tickers)} tickers...")
        for ticker in tickers[:100]:  # Limit for testing
            try:
                df = await self.fetch_daily_bars(ticker, start_date, end_date, force_refresh)
                if not df.empty:
                    all_data[ticker] = df
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                continue
        
        # Calculate daily advances/declines
        dates = sorted(set([date for df in all_data.values() for date in df.index]))
        ad_data = []
        
        for date in dates:
            advancers = 0
            decliners = 0
            unchanged = 0
            
            for ticker, df in all_data.items():
                if date not in df.index:
                    continue
                
                # Get previous trading day close
                prev_dates = df.index[df.index < date]
                if len(prev_dates) == 0:
                    continue
                
                prev_date = prev_dates[-1]
                today_close = df.loc[date, 'close']
                prev_close = df.loc[prev_date, 'close']
                
                if today_close > prev_close:
                    advancers += 1
                elif today_close < prev_close:
                    decliners += 1
                else:
                    unchanged += 1
            
            ad_data.append({
                'date': date,
                'advancers': advancers,
                'decliners': decliners,
                'unchanged': unchanged,
                'net': advancers - decliners
            })
        
        df_ad = pd.DataFrame(ad_data)
        df_ad['AD_Line'] = df_ad['net'].cumsum()
        df_ad['MA_10'] = df_ad['AD_Line'].rolling(window=10).mean()
        
        # Calculate correlation with SPX if available
        stats = {
            'current_ad_line': float(df_ad['AD_Line'].iloc[-1]),
            'ma_10': float(df_ad['MA_10'].iloc[-1]),
            'total_stocks': len(all_data)
        }
        
        return df_ad, stats
    
    async def calculate_tick_proxy(self, date: str = None, 
                                   force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict]:
        """
        Chart 2: TICK Proxy (intraday)
        Returns: (DataFrame with TICK values per minute, stats dict)
        """
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        tickers = await self.fetch_sp500_tickers()
        
        # Fetch minute data for all tickers
        all_minute_data = {}
        print(f"Fetching minute data for {len(tickers)} tickers on {date}...")
        
        # Limit to subset for testing
        for ticker in tickers[:50]:
            try:
                df = await self.fetch_minute_bars(ticker, date, force_refresh)
                if not df.empty:
                    all_minute_data[ticker] = df
            except Exception as e:
                print(f"Error fetching minute data for {ticker}: {e}")
                continue
        
        # Calculate TICK for each minute
        all_timestamps = sorted(set([ts for df in all_minute_data.values() for ts in df.index]))
        tick_data = []
        
        for i, timestamp in enumerate(all_timestamps):
            if i == 0:
                continue  # Need prior bar for comparison
            
            prior_timestamp = all_timestamps[i - 1]
            upticks = 0
            downticks = 0
            
            for ticker, df in all_minute_data.items():
                if timestamp not in df.index or prior_timestamp not in df.index:
                    continue
                
                current_close = df.loc[timestamp, 'close']
                prior_close = df.loc[prior_timestamp, 'close']
                
                if current_close > prior_close:
                    upticks += 1
                elif current_close < prior_close:
                    downticks += 1
            
            tick_value = upticks - downticks
            tick_data.append({
                'timestamp': timestamp,
                'tick': tick_value,
                'upticks': upticks,
                'downticks': downticks
            })
        
        df_tick = pd.DataFrame(tick_data)
        
        stats = {
            'max_tick': int(df_tick['tick'].max()),
            'min_tick': int(df_tick['tick'].min()),
            'mean_tick': float(df_tick['tick'].mean()),
            'std_tick': float(df_tick['tick'].std())
        }
        
        return df_tick, stats
    
    async def calculate_highs_lows(self, days: int = 252, 
                                  force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict]:
        """
        Chart 3: 52-Week Highs vs Lows
        Returns: (DataFrame with new highs/lows, stats dict)
        """
        end_date = datetime.now().strftime('%Y-%m-%d')
        # Need 252 days + 252 days lookback
        start_date = (datetime.now() - timedelta(days=days + 260 + 260)).strftime('%Y-%m-%d')
        
        tickers = await self.fetch_sp500_tickers()
        
        # Fetch all daily data
        all_data = {}
        print(f"Fetching daily data for highs/lows for {len(tickers)} tickers...")
        for ticker in tickers[:100]:
            try:
                df = await self.fetch_daily_bars(ticker, start_date, end_date, force_refresh)
                if not df.empty and len(df) >= 252:  # Need 252 days for 52-week lookback
                    all_data[ticker] = df
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                continue
        
        # Calculate 52-week highs and lows for each date
        analysis_start = datetime.now() - timedelta(days=days)
        dates = sorted([d for d in set([date for df in all_data.values() for date in df.index]) 
                       if d >= analysis_start])
        
        hl_data = []
        
        for date in dates:
            new_highs = 0
            new_lows = 0
            
            for ticker, df in all_data.items():
                if date not in df.index:
                    continue
                
                # Get 252 trading days prior
                prior_dates = df.index[df.index < date]
                if len(prior_dates) < 252:
                    continue
                
                lookback_start = prior_dates[-252]
                lookback_data = df.loc[lookback_start:date]
                
                today_close = df.loc[date, 'close']
                period_high = lookback_data['high'].max()
                period_low = lookback_data['low'].min()
                
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
        
        df_hl = pd.DataFrame(hl_data)
        df_hl['net_ma_10'] = df_hl['net'].rolling(window=10).mean()
        
        stats = {
            'current_highs': int(df_hl['new_highs'].iloc[-1]),
            'current_lows': int(df_hl['new_lows'].iloc[-1]),
            'net': int(df_hl['net'].iloc[-1])
        }
        
        return df_hl, stats
    
    async def calculate_percent_above_ma(self, days: int = 252, 
                                        force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict]:
        """
        Chart 4: Percent Above Moving Averages (50 & 200 day)
        Returns: (DataFrame with %Above50 and %Above200, stats dict)
        """
        end_date = datetime.now().strftime('%Y-%m-%d')
        # Need days + 200 days for MA calculation
        start_date = (datetime.now() - timedelta(days=days + 260 + 200)).strftime('%Y-%m-%d')
        
        tickers = await self.fetch_sp500_tickers()
        
        # Fetch all daily data
        all_data = {}
        print(f"Fetching daily data for MA calculation for {len(tickers)} tickers...")
        for ticker in tickers[:100]:
            try:
                df = await self.fetch_daily_bars(ticker, start_date, end_date, force_refresh)
                if not df.empty:
                    # Calculate MAs
                    df['MA_50'] = df['close'].rolling(window=50).mean()
                    df['MA_200'] = df['close'].rolling(window=200).mean()
                    all_data[ticker] = df
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                continue
        
        # Calculate percent above MAs for each date
        analysis_start = datetime.now() - timedelta(days=days)
        dates = sorted([d for d in set([date for df in all_data.values() for date in df.index]) 
                       if d >= analysis_start])
        
        ma_data = []
        
        for date in dates:
            above_50 = 0
            above_200 = 0
            valid_count_50 = 0
            valid_count_200 = 0
            
            for ticker, df in all_data.items():
                if date not in df.index:
                    continue
                
                row = df.loc[date]
                
                if pd.notna(row['MA_50']):
                    valid_count_50 += 1
                    if row['close'] > row['MA_50']:
                        above_50 += 1
                
                if pd.notna(row['MA_200']):
                    valid_count_200 += 1
                    if row['close'] > row['MA_200']:
                        above_200 += 1
            
            pct_above_50 = (above_50 / valid_count_50 * 100) if valid_count_50 > 0 else 0
            pct_above_200 = (above_200 / valid_count_200 * 100) if valid_count_200 > 0 else 0
            
            ma_data.append({
                'date': date,
                'pct_above_50': pct_above_50,
                'pct_above_200': pct_above_200,
                'count_50': valid_count_50,
                'count_200': valid_count_200
            })
        
        df_ma = pd.DataFrame(ma_data)
        
        # Detect breadth thrust: %>50 rises from <40% to >61.5% within 10 days
        df_ma['breadth_thrust'] = False
        for i in range(10, len(df_ma)):
            window = df_ma.iloc[i-10:i+1]
            if window['pct_above_50'].min() < 40 and window['pct_above_50'].max() > 61.5:
                df_ma.loc[df_ma.index[i], 'breadth_thrust'] = True
        
        stats = {
            'current_above_50': float(df_ma['pct_above_50'].iloc[-1]),
            'current_above_200': float(df_ma['pct_above_200'].iloc[-1]),
            'breadth_thrust_detected': bool(df_ma['breadth_thrust'].any())
        }
        
        return df_ma, stats


# Async wrapper functions for easier API calls
async def get_advance_decline_data(days: int = 252, force_refresh: bool = False):
    """Get A/D Line data"""
    calculator = MarketBreadthCalculator()
    return await calculator.calculate_advance_decline_line(days, force_refresh)


async def get_tick_proxy_data(date: str = None, force_refresh: bool = False):
    """Get TICK proxy data"""
    calculator = MarketBreadthCalculator()
    return await calculator.calculate_tick_proxy(date, force_refresh)


async def get_highs_lows_data(days: int = 252, force_refresh: bool = False):
    """Get 52-week highs/lows data"""
    calculator = MarketBreadthCalculator()
    return await calculator.calculate_highs_lows(days, force_refresh)


async def get_percent_above_ma_data(days: int = 252, force_refresh: bool = False):
    """Get percent above MA data"""
    calculator = MarketBreadthCalculator()
    return await calculator.calculate_percent_above_ma(days, force_refresh)
