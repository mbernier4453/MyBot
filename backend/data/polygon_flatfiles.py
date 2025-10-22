"""
Polygon Flat Files Integration
Downloads and caches historical data from Polygon's S3 flat files using AWS credentials
Much faster than API calls for backtesting
"""

import pandas as pd
import boto3
from pathlib import Path
from datetime import datetime, timedelta
import io
import gzip
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, POLYGON_S3_BUCKET, DATA_CACHE_DIR

class PolygonFlatFiles:
    def __init__(self, cache_dir=None):
        self.cache_dir = Path(cache_dir) if cache_dir else DATA_CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize AWS S3 client with credentials from config
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        
        self.bucket = POLYGON_S3_BUCKET
        
    def get_daily_bars(self, ticker, start_date, end_date):
        """
        Get daily bars for a ticker from flat files
        Much faster than API for historical data
        
        Args:
            ticker: Stock symbol (e.g., 'AAPL')
            start_date: Start date (str 'YYYY-MM-DD' or datetime)
            end_date: End date (str 'YYYY-MM-DD' or datetime)
            
        Returns:
            DataFrame with columns: date, open, high, low, close, volume
        """
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
        # Collect all data
        all_data = []
        current_date = start_date
        
        while current_date <= end_date:
            # Download or load from cache
            df = self._get_day_file(current_date)
            if df is not None and ticker in df['ticker'].values:
                ticker_data = df[df['ticker'] == ticker].copy()
                all_data.append(ticker_data)
            
            current_date += timedelta(days=1)
        
        if not all_data:
            return pd.DataFrame()
        
        # Combine and clean
        result = pd.concat(all_data, ignore_index=True)
        result = result.sort_values('date').reset_index(drop=True)
        
        # Set date as index
        result['date'] = pd.to_datetime(result['date'])
        result.set_index('date', inplace=True)
        
        # Return only needed columns
        return result[['open', 'high', 'low', 'close', 'volume']]
    
    def _get_day_file(self, date):
        """Download or load a single day's flat file from S3 using AWS credentials"""
        # Check cache first
        cache_file = self.cache_dir / f"{date.strftime('%Y-%m-%d')}.parquet"
        
        if cache_file.exists():
            try:
                return pd.read_parquet(cache_file)
            except:
                pass  # Re-download if corrupted
        
        # S3 key path for Polygon flat files
        s3_key = f"us_stocks_sip/day_aggs_v1/{date.year}/{date.month:02d}/{date.strftime('%Y-%m-%d')}.csv.gz"
        
        try:
            print(f"[POLYGON] Downloading {date.strftime('%Y-%m-%d')} from S3...")
            
            # Download from S3
            response = self.s3_client.get_object(Bucket=self.bucket, Key=s3_key)
            
            # Read gzipped CSV data
            compressed_data = response['Body'].read()
            decompressed_data = gzip.decompress(compressed_data)
            
            # Parse CSV
            df = pd.read_csv(io.BytesIO(decompressed_data))
            
            # Cache as parquet for faster loading
            df.to_parquet(cache_file, compression='snappy')
            
            print(f"[POLYGON] ✓ Downloaded {len(df):,} rows")
            return df
            
        except self.s3_client.exceptions.NoSuchKey:
            print(f"[POLYGON] No data available for {date.strftime('%Y-%m-%d')} (weekend/holiday)")
            return None
        except Exception as e:
            print(f"[POLYGON] Error downloading {date}: {e}")
            return None
    
    def preload_range(self, start_date, end_date):
        """
        Pre-download a date range for faster subsequent access
        Useful before running backtests
        """
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
        current_date = start_date
        downloaded = 0
        cached = 0
        
        while current_date <= end_date:
            cache_file = self.cache_dir / f"{current_date.strftime('%Y-%m-%d')}.parquet"
            
            if cache_file.exists():
                cached += 1
            else:
                self._get_day_file(current_date)
                downloaded += 1
            
            current_date += timedelta(days=1)
        
        print(f"[POLYGON] Preload complete: {downloaded} downloaded, {cached} from cache")


# Example usage
if __name__ == "__main__":
    pf = PolygonFlatFiles()
    
    # Test with a recent date
    test_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Get AAPL data
    aapl = pf.get_daily_bars('AAPL', test_date, test_date)
    print(f"\nAAPL data: {len(aapl)} bars")
    print(aapl)
