import json
import os
from pathlib import Path
from typing import Dict, List, Optional

# Cache file location
CACHE_DIR = Path(os.getenv('DATA_CACHE_DIR', './data_cache'))
SPLITS_FILE = CACHE_DIR / 'splits.json'

def _ensure_cache_dir():
    """Ensure the cache directory exists"""
    if not CACHE_DIR.exists():
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

def load_split_cache() -> Dict[str, List[Dict]]:
    """
    Load the split cache from disk.
    Returns a dict: {'TICKER': [{'date': 'YYYY-MM-DD', 'ratio': 0.5}, ...]}
    """
    if not SPLITS_FILE.exists():
        return {}
    
    try:
        with open(SPLITS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_split_cache(cache: Dict[str, List[Dict]]):
    """Save the split cache to disk"""
    _ensure_cache_dir()
    with open(SPLITS_FILE, 'w') as f:
        json.dump(cache, f, indent=2, sort_keys=True)

def get_splits(ticker: str) -> Optional[List[Dict]]:
    """
    Get known splits for a ticker.
    Returns None if the ticker is not in the cache (implies 'not yet scanned').
    Returns [] if the ticker is in the cache but has no splits.
    """
    cache = load_split_cache()
    return cache.get(ticker)

def update_split_cache(ticker: str, splits: List[Dict]):
    """
    Update the cache with splits for a ticker.
    splits: List of dicts, e.g. [{'date': '2022-07-15', 'ratio': 0.05}]
    """
    cache = load_split_cache()
    cache[ticker] = splits
    save_split_cache(cache)
