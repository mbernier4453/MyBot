import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from typing import Dict, Tuple
from .settings import get  # added

def calculate_capm_metrics(strategy_equity: pd.Series, benchmark_equity: pd.Series, 
                          risk_free_rate: float = None) -> Dict[str, float]:
    """Calculate CAPM metrics: alpha, beta, R², tracking error, information ratio."""
    if risk_free_rate is None:
        risk_free_rate = float(get("RF_ANNUAL", 0.0)) / 252  # Daily risk-free rate
    
    # Align series and calculate returns
    aligned_strat = strategy_equity.reindex(benchmark_equity.index).ffill().dropna()
    aligned_bench = benchmark_equity.reindex(aligned_strat.index).ffill().dropna()
    
    if len(aligned_strat) < 2:
        return dict(alpha=np.nan, beta=np.nan, r_squared=np.nan, 
                   tracking_error=np.nan, information_ratio=np.nan)
    
    strat_returns = aligned_strat.pct_change().dropna()
    bench_returns = aligned_bench.pct_change().dropna()
    
    # Remove risk-free rate (excess returns)
    strat_excess = strat_returns - risk_free_rate
    bench_excess = bench_returns - risk_free_rate
    
    # Linear regression: strat_excess = alpha + beta * bench_excess
    X = bench_excess.values.reshape(-1, 1)
    y = strat_excess.values
    
    reg = LinearRegression().fit(X, y)
    beta = reg.coef_[0]
    alpha = reg.intercept_
    r_squared = reg.score(X, y)
    
    # Tracking error and information ratio
    tracking_diff = strat_returns - bench_returns
    tracking_error = tracking_diff.std() * np.sqrt(252)  # Annualized
    information_ratio = tracking_diff.mean() / tracking_diff.std() * np.sqrt(252) if tracking_diff.std() > 0 else np.nan
    
    # Annualize alpha
    alpha_annual = (1 + alpha) ** 252 - 1
    
    return dict(
        alpha=alpha_annual,
        beta=beta,
        r_squared=r_squared,
        tracking_error=tracking_error,
        information_ratio=information_ratio
    )

def rolling_beta_alpha(strategy_equity: pd.Series, benchmark_equity: pd.Series, 
                      window: int = 252) -> pd.DataFrame:
    """Calculate rolling beta and alpha over specified window."""
    # Align and get returns
    aligned_strat = strategy_equity.reindex(benchmark_equity.index).ffill().dropna()
    aligned_bench = benchmark_equity.reindex(aligned_strat.index).ffill().dropna()
    
    strat_returns = aligned_strat.pct_change().dropna()
    bench_returns = aligned_bench.pct_change().dropna()
    
    rolling_betas = []
    rolling_alphas = []
    dates = []
    
    for i in range(window, len(strat_returns)):
        window_strat = strat_returns.iloc[i-window:i]
        window_bench = bench_returns.iloc[i-window:i]
        
        # Simple linear regression
        X = window_bench.values.reshape(-1, 1)
        y = window_strat.values
        
        reg = LinearRegression().fit(X, y)
        rolling_betas.append(reg.coef_[0])
        rolling_alphas.append(reg.intercept_)
        dates.append(strat_returns.index[i])
    
    return pd.DataFrame({
        'beta': rolling_betas,
        'alpha': rolling_alphas
    }, index=dates)