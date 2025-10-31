"""
Flask REST API Server for Backtesting Application
Provides endpoints for strategy configuration, backtesting, results retrieval
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
from datetime import datetime, timedelta
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import (
    FLASK_SECRET_KEY, 
    FLASK_PORT, 
    FLASK_HOST, 
    FLASK_DEBUG,
    CORS_ORIGINS,
    JWT_EXPIRATION_HOURS,
    RESULTS_DIR
)
from backend.backtest.engine import run_backtest, preview_strategy
from backend.backtest.data_source import DataSource

app = Flask(__name__)
app.config['SECRET_KEY'] = FLASK_SECRET_KEY

# Configure CORS for frontend communication
CORS(app, resources={
    r"/api/*": {
        "origins": CORS_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize data source
data_source = DataSource()


# ============================================
# Authentication Middleware (JWT-based)
# ============================================

def token_required(f):
    """Decorator to require valid JWT token for protected routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Decode token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


# ============================================
# Authentication Endpoints (Placeholder)
# ============================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """
    Register new user
    TODO: Implement user database and validation
    """
    data = request.get_json()
    
    # Placeholder - will implement with database
    return jsonify({
        'success': False,
        'message': 'User registration not yet implemented. Coming soon!'
    }), 501


@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Login user and return JWT token
    TODO: Implement user authentication
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    # Placeholder - for now, accept any login for development
    # TODO: Validate against user database
    if os.getenv('FLASK_ENV') == 'development':
        # Development mode - allow any login
        token = jwt.encode({
            'user_id': username,
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            'success': True,
            'token': token,
            'user': {'username': username}
        })
    
    return jsonify({
        'success': False,
        'message': 'Authentication not yet implemented'
    }), 501


@app.route('/api/auth/verify', methods=['GET'])
@token_required
def verify_token(current_user):
    """Verify if token is valid"""
    return jsonify({
        'success': True,
        'user': {'username': current_user}
    })


# ============================================
# Backtest Endpoints
# ============================================

@app.route('/api/backtest/preview', methods=['POST'])
def backtest_preview():
    """
    Preview strategy with indicators and signals
    Returns OHLC data with indicators and entry/exit signals for charting
    """
    try:
        config = request.get_json()
        
        if not config:
            return jsonify({'error': 'Configuration required'}), 400
        
        # Validate required fields
        symbol = config.get('symbol')
        start_date = config.get('start_date')
        end_date = config.get('end_date')
        
        if not all([symbol, start_date, end_date]):
            return jsonify({'error': 'symbol, start_date, and end_date are required'}), 400
        
        # Run preview
        result = preview_strategy(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            indicators_config=config.get('indicators', {}),
            entry_conditions=config.get('entry_conditions', []),
            exit_conditions=config.get('exit_conditions', [])
        )
        
        # Convert DataFrames/Series to JSON-serializable format
        df = result['df']
        indicators = result['indicators']
        entry_signal = result['entry_signal']
        exit_signal = result['exit_signal']
        
        # Build response with OHLCV + indicators + signals
        response_data = {
            'dates': df.index.strftime('%Y-%m-%d').tolist(),
            'ohlcv': {
                'open': df['Open'].tolist(),
                'high': df['High'].tolist(),
                'low': df['Low'].tolist(),
                'close': df['Close'].tolist(),
                'volume': df['Volume'].tolist()
            },
            'indicators': {
                name: series.tolist() for name, series in indicators.items()
            },
            'signals': {
                'entry': entry_signal.tolist(),
                'exit': exit_signal.tolist()
            },
            'summary': {
                'total_bars': len(df),
                'entry_signals': int(result['entry_count']),
                'exit_signals': int(result['exit_count'])
            }
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/backtest/run', methods=['POST'])
def run_backtest_endpoint():
    """
    Execute full backtest with trade simulation
    Returns metrics, trades, and generates tearsheet
    """
    try:
        config = request.get_json()
        
        if not config:
            return jsonify({'error': 'Configuration required'}), 400
        
        # Validate required fields
        symbol = config.get('symbol')
        if not symbol:
            return jsonify({'error': 'symbol is required'}), 400
        
        # Run backtest
        result = run_backtest(config, symbol=symbol)
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'run_id': result.get('run_id'),
                'metrics': result.get('metrics'),
                'trades_count': len(result.get('trades', [])),
                'tearsheet_path': result.get('tearsheet_path')
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Backtest failed')
            }), 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/backtest/results/<run_id>', methods=['GET'])
def get_backtest_results(run_id):
    """
    Retrieve saved backtest results by run_id
    TODO: Implement database storage/retrieval
    """
    try:
        # TODO: Query database for run results
        return jsonify({
            'success': False,
            'message': 'Results retrieval from database not yet implemented'
        }), 501
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/backtest/history', methods=['GET'])
def get_backtest_history():
    """
    Get list of all backtest runs
    TODO: Implement database query
    """
    try:
        # TODO: Query database for all runs
        return jsonify({
            'success': False,
            'message': 'History retrieval not yet implemented'
        }), 501
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# Data Endpoints
# ============================================

@app.route('/api/data/tickers', methods=['GET'])
def get_tickers():
    """
    Get list of available tickers
    TODO: Implement ticker list from data source or database
    """
    # Placeholder - return common symbols for now
    tickers = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 
        'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD', 'DIS', 'BAC', 'XOM',
        'SPY', 'QQQ', 'IWM', 'DIA'
    ]
    
    return jsonify({
        'success': True,
        'tickers': sorted(tickers)
    })


@app.route('/api/data/bars/<symbol>', methods=['GET'])
def get_bars(symbol):
    """
    Get OHLCV bars for a symbol
    Query params: start_date, end_date
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            return jsonify({'error': 'start_date and end_date required'}), 400
        
        # Load bars
        bars = data_source.load_bars([symbol], start_date, end_date)
        
        if symbol not in bars or bars[symbol].empty:
            return jsonify({'error': f'No data found for {symbol}'}), 404
        
        # Convert DataFrame to JSON-serializable format
        df = bars[symbol]
        data = {
            'dates': df.index.strftime('%Y-%m-%d').tolist(),
            'open': df['Open'].tolist(),
            'high': df['High'].tolist(),
            'low': df['Low'].tolist(),
            'close': df['Close'].tolist(),
            'volume': df['Volume'].tolist()
        }
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'data': data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# Results/Tearsheet File Serving
# ============================================

@app.route('/api/files/tearsheet/<path:filename>', methods=['GET'])
def serve_tearsheet(filename):
    """Serve generated tearsheet HTML files"""
    tearsheet_dir = os.path.join(RESULTS_DIR, 'tearsheets')
    return send_from_directory(tearsheet_dir, filename)


@app.route('/api/files/csv/<path:filename>', methods=['GET'])
def serve_csv(filename):
    """Serve metrics CSV files"""
    csv_dir = os.path.join(RESULTS_DIR, 'csv')
    return send_from_directory(csv_dir, filename)


# ============================================
# Health Check
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })


@app.route('/', methods=['GET'])
def index():
    """API root"""
    return jsonify({
        'name': 'Backtesting API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health',
            'auth': {
                'login': 'POST /api/auth/login',
                'register': 'POST /api/auth/register',
                'verify': 'GET /api/auth/verify'
            },
            'backtest': {
                'preview': 'POST /api/backtest/preview',
                'run': 'POST /api/backtest/run',
                'results': 'GET /api/backtest/results/<run_id>',
                'history': 'GET /api/backtest/history'
            },
            'data': {
                'tickers': 'GET /api/data/tickers',
                'bars': 'GET /api/data/bars/<symbol>'
            }
        }
    })


# ============================================
# Error Handlers
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================
# Main
# ============================================

if __name__ == '__main__':
    print(f"Starting Flask API server on {FLASK_HOST}:{FLASK_PORT}")
    print(f"Debug mode: {FLASK_DEBUG}")
    print(f"CORS origins: {CORS_ORIGINS}")
    
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=FLASK_DEBUG
    )
