#!/usr/bin/env python3
"""
Flask API Server for Backtesting
Exposes all backend functionality via REST API endpoints
Designed to run on a server and be called remotely
"""
import os
import sys
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment from workspace root
root_dir = Path(__file__).parent
load_dotenv(root_dir / '.env')

# Add backtester to path
sys.path.insert(0, str(root_dir))

from backtester import db as db_module
from backtester.data_loader import load_bars

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes (frontend can call from anywhere)

# Configuration
DB_PATH = os.getenv('DB_PATH', str(root_dir / 'results' / 'db' / 'backtests.db'))
HOST = os.getenv('API_HOST', '0.0.0.0')  # 0.0.0.0 allows remote connections
PORT = int(os.getenv('API_PORT', '5000'))

# Initialize database
db_module.init_db(DB_PATH)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Backtesting API is running'})


@app.route('/api/load-preview-data', methods=['POST'])
def load_preview_data():
    """
    Load historical price data for preview visualization
    Body: {ticker, startDate, endDate, interval}
    """
    try:
        params = request.json
        ticker = params.get('ticker')
        start_date = params.get('startDate')
        end_date = params.get('endDate')
        interval = params.get('interval', '1d')
        
        if not ticker or not start_date or not end_date:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: ticker, startDate, endDate'
            }), 400
        
        # Load data using data_loader
        data = load_bars(ticker, start_date, end_date)
        
        if data.empty:
            return jsonify({
                'success': False,
                'error': f'No data found for {ticker} between {start_date} and {end_date}'
            })
        
        # Format response
        result = {
            'success': True,
            'data': {
                'ticker': ticker,
                'period': '1y',  # Legacy field
                'interval': interval,
                'dates': data.index.strftime('%Y-%m-%d').tolist(),
                'open': [float(x) for x in data['Open'].values],
                'high': [float(x) for x in data['High'].values],
                'low': [float(x) for x in data['Low'].values],
                'close': [float(x) for x in data['Close'].values],
                'volume': [int(x) for x in data['Volume'].values]
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/run-backtest', methods=['POST'])
def run_backtest():
    """
    Run a backtest with the provided configuration
    Body: Full backtest config JSON
    """
    try:
        config = request.json
        
        if not config:
            return jsonify({
                'success': False,
                'error': 'No configuration provided'
            }), 400
        
        # Import here to avoid circular dependencies
        from dynamic_backtest import main as run_dynamic_backtest
        
        # Write config to temp file (dynamic_backtest expects JSON file)
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            temp_config_path = f.name
        
        try:
            # Run backtest
            result = run_dynamic_backtest(temp_config_path)
            
            # Clean up temp file
            os.unlink(temp_config_path)
            
            if result.get('success'):
                return jsonify({
                    'success': True,
                    'runIds': result.get('run_ids', []),
                    'message': f"Backtest completed: {len(result.get('run_ids', []))} runs saved"
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result.get('error', 'Backtest failed')
                }), 500
                
        finally:
            # Ensure temp file is deleted even if error occurs
            if os.path.exists(temp_config_path):
                os.unlink(temp_config_path)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/get-strategies', methods=['GET'])
def get_strategies():
    """
    Get all strategies for a specific run
    Query params: runId
    """
    try:
        run_id = request.args.get('runId')
        
        if not run_id:
            return jsonify({
                'success': False,
                'error': 'Missing runId parameter'
            }), 400
        
        # Query database
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, run_id, ticker, total_return, cagr, sharpe, sortino,
                vol, maxdd, win_rate, net_win_rate, avg_trade_pnl, trades_total,
                params_json, metrics_json, created_at
            FROM strategies
            WHERE run_id = ?
            ORDER BY cagr DESC
        """, (run_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        strategies = []
        for row in rows:
            strategy = dict(row)
            # Parse JSON fields
            strategy['params'] = json.loads(strategy.get('params_json') or '{}')
            strategy['metrics'] = json.loads(strategy.get('metrics_json') or '{}')
            strategies.append(strategy)
        
        return jsonify({
            'success': True,
            'data': strategies
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/get-strategy-details', methods=['GET'])
def get_strategy_details():
    """
    Get detailed information for a specific strategy
    Query params: strategyId
    """
    try:
        strategy_id = request.args.get('strategyId')
        
        if not strategy_id:
            return jsonify({
                'success': False,
                'error': 'Missing strategyId parameter'
            }), 400
        
        # Query database
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, run_id, ticker, total_return, cagr, sharpe, sortino,
                vol, maxdd, win_rate, net_win_rate, avg_trade_pnl, trades_total,
                params_json, metrics_json, equity_json, events_json, buyhold_json,
                created_at
            FROM strategies
            WHERE id = ?
        """, (strategy_id,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Strategy not found'
            }), 404
        
        strategy = dict(row)
        
        # Parse JSON fields
        strategy['params'] = json.loads(strategy.get('params_json') or '{}')
        strategy['metrics'] = json.loads(strategy.get('metrics_json') or '{}')
        strategy['equity'] = json.loads(strategy.get('equity_json') or 'null')
        strategy['buyhold_equity'] = json.loads(strategy.get('buyhold_json') or 'null')
        strategy['events'] = json.loads(strategy.get('events_json') or '[]')
        
        # Get benchmark equity from runs table
        cursor.execute('SELECT benchmark_equity_json FROM runs WHERE run_id = ?', (strategy['run_id'],))
        run_row = cursor.fetchone()
        if run_row and run_row['benchmark_equity_json']:
            strategy['benchmark_equity'] = json.loads(run_row['benchmark_equity_json'])
        else:
            strategy['benchmark_equity'] = None
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': strategy
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/get-buyhold-metrics', methods=['GET'])
def get_buyhold_metrics():
    """
    Get buy & hold metrics for all tickers in a run
    Query params: runId
    """
    try:
        run_id = request.args.get('runId')
        
        if not run_id:
            return jsonify({
                'success': False,
                'error': 'Missing runId parameter'
            }), 400
        
        # Query database
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT ticker, buyhold_json
            FROM strategies
            WHERE run_id = ?
        """, (run_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        buyhold_data = {}
        for row in rows:
            ticker = row['ticker']
            if row['buyhold_json']:
                buyhold_data[ticker] = json.loads(row['buyhold_json'])
        
        return jsonify({
            'success': True,
            'data': buyhold_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/calculate-capm', methods=['POST'])
def calculate_capm():
    """
    Calculate CAPM metrics (alpha, beta, R², tracking error, info ratio)
    Body: {portfolioReturns: [], benchmarkReturns: [], riskFreeRate: 0.02}
    """
    try:
        data = request.json
        portfolio_returns = data.get('portfolioReturns', [])
        benchmark_returns = data.get('benchmarkReturns', [])
        risk_free_rate = data.get('riskFreeRate', 0.02)
        
        if not portfolio_returns or not benchmark_returns:
            return jsonify({
                'success': False,
                'error': 'Missing portfolioReturns or benchmarkReturns'
            }), 400
        
        import numpy as np
        from scipy import stats
        
        # Convert to numpy arrays
        port_ret = np.array(portfolio_returns)
        bench_ret = np.array(benchmark_returns)
        
        # Calculate excess returns
        excess_port = port_ret - risk_free_rate / 252  # Daily risk-free rate
        excess_bench = bench_ret - risk_free_rate / 252
        
        # Linear regression: portfolio excess returns vs benchmark excess returns
        slope, intercept, r_value, p_value, std_err = stats.linregress(excess_bench, excess_port)
        
        beta = slope
        alpha = intercept * 252  # Annualize alpha
        r_squared = r_value ** 2
        
        # Tracking error (annualized std dev of return differences)
        tracking_error = np.std(port_ret - bench_ret) * np.sqrt(252)
        
        # Information ratio
        mean_diff = np.mean(port_ret - bench_ret)
        information_ratio = (mean_diff * 252) / tracking_error if tracking_error != 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'alpha': float(alpha),
                'beta': float(beta),
                'r_squared': float(r_squared),
                'tracking_error': float(tracking_error),
                'information_ratio': float(information_ratio)
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/get-all-runs', methods=['GET'])
def get_all_runs():
    """
    Get all backtest runs with summary info
    """
    try:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                r.run_id,
                r.notes,
                r.mode,
                r.started_at,
                r.completed_at,
                r.data_source,
                COUNT(s.id) as strategy_count,
                AVG(s.cagr) as avg_cagr,
                MAX(s.cagr) as best_cagr
            FROM runs r
            LEFT JOIN strategies s ON r.run_id = s.run_id
            GROUP BY r.run_id
            ORDER BY r.started_at DESC
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        runs = [dict(row) for row in rows]
        
        return jsonify({
            'success': True,
            'data': runs
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print(f"[API SERVER] Starting on {HOST}:{PORT}")
    print(f"[API SERVER] Database: {DB_PATH}")
    print(f"[API SERVER] Health check: http://{HOST}:{PORT}/health")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
