import pandas as pd
import numpy as np
from typing import List, Dict, Tuple

# Common split ratios (forward and reverse)
# Ratio = New Price / Old Price
# 2:1 split -> Price drops by 50% -> Ratio 0.5
# 20:1 split -> Price drops by 95% -> Ratio 0.05
# 1:5 reverse -> Price jumps by 500% -> Ratio 5.0

STANDARD_RATIOS = {
    # Forward splits
    0.5: 2.0,    # 2:1
    0.3333: 3.0, # 3:1
    0.25: 4.0,   # 4:1
    0.2: 5.0,    # 5:1
    0.1: 10.0,   # 10:1
    0.05: 20.0,  # 20:1
    0.0666: 15.0, # 15:1
    0.125: 8.0,  # 8:1
    # Reverse splits (less critical for buy & hold crashes, but good to have)
    2.0: 0.5,
    3.0: 0.3333,
    4.0: 0.25,
    5.0: 0.2,
    10.0: 0.1,
}

def _get_closest_ratio(ratio: float, tolerance: float = 0.05) -> Tuple[float, float]:
    """
    Check if a ratio is close to a standard split ratio.
    Returns (split_factor, error) if found, else (None, error).
    """
    best_factor = None
    min_error = float('inf')
    
    # Check integer ratios first (most common)
    # Invert ratio to get factor (e.g. 0.5 -> 2.0)
    factor = 1.0 / ratio
    
    # Check for forward splits (factor > 1)
    if factor > 1.5:
        nearest_int = round(factor)
        error = abs(factor - nearest_int) / nearest_int
        if error < tolerance:
            return nearest_int, error
            
    # Check for reverse splits (factor < 1)
    # e.g. ratio 2.0 -> factor 0.5
    if factor < 0.8:
        # Check if ratio is integer (e.g. 2.0, 3.0)
        nearest_int_ratio = round(ratio)
        error = abs(ratio - nearest_int_ratio) / nearest_int_ratio
        if error < tolerance:
            return 1.0 / nearest_int_ratio, error
            
    return None, min_error

def detect_splits(df: pd.DataFrame) -> List[Dict]:
    """
    Detect splits in a DataFrame of OHLCV data.
    Returns list of dicts: [{'date': 'YYYY-MM-DD', 'ratio': 0.05}, ...]
    """
    if df.empty or 'Close' not in df.columns:
        return []
    
    # Ensure sorted
    df = df.sort_index()
    closes = df['Close']
    
    # Calculate daily returns: Close[t] / Close[t-1]
    ratios = closes / closes.shift(1)
    
    # Filter for significant moves (> 30% drop or > 80% gain)
    # 2:1 split is 0.5 ratio (50% drop)
    # 1:2 reverse is 2.0 ratio (100% gain)
    significant_moves = ratios[(ratios < 0.7) | (ratios > 1.8)]
    
    splits = []
    
    for date, ratio in significant_moves.items():
        # Skip if NaN
        if pd.isna(ratio):
            continue
            
        # Check if it matches a standard ratio
        factor, error = _get_closest_ratio(ratio)
        
        if factor:
            # Convert factor back to ratio for storage
            # e.g. 20:1 split -> factor 20 -> ratio 0.05
            split_ratio = 1.0 / factor
            
            splits.append({
                'date': date.strftime('%Y-%m-%d'),
                'ratio': split_ratio,
                'factor': factor
            })
            
    return splits

def apply_splits(df: pd.DataFrame, splits: List[Dict]) -> pd.DataFrame:
    """
    Apply split adjustments to a DataFrame.
    Adjusts Open, High, Low, Close, Volume.
    """
    if df.empty or not splits:
        return df
    
    adj_df = df.copy()
    
    # Sort splits by date descending (latest first)
    # We process from latest to earliest because splits affect all PRIOR data
    sorted_splits = sorted(splits, key=lambda x: x['date'], reverse=True)
    
    for split in sorted_splits:
        split_date = pd.to_datetime(split['date'])
        ratio = split['ratio'] # e.g. 0.05 for 20:1
        
        # Logic:
        # A 20:1 split happens on split_date.
        # Prices BEFORE split_date were 20x higher.
        # To adjust, we multiply prices BEFORE split_date by the ratio (0.05).
        # Volume is multiplied by the inverse (20).
        
        mask = adj_df.index < split_date
        
        # Adjust prices
        for col in ['Open', 'High', 'Low', 'Close']:
            if col in adj_df.columns:
                adj_df.loc[mask, col] *= ratio
                
        # Adjust volume
        if 'Volume' in adj_df.columns:
            adj_df.loc[mask, 'Volume'] /= ratio
            
    return adj_df
