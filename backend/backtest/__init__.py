"""
New Backtesting Engine
Uses Polygon Flat Files for data and supports all frontend indicators
"""

from .data_source import load_bars, get_data
from .indicators import Indicators
from .engine import run_backtest
from .results import write_metrics_csv
from .tearsheet import generate_tearsheet
from .capm import calculate_capm_metrics

__all__ = [
    'load_bars',
    'get_data',
    'Indicators',
    'run_backtest',
    'write_metrics_csv',
    'generate_tearsheet',
    'calculate_capm_metrics'
]
