"""
Simple Flask server runner without auto-reloader for testing
"""
import os
import sys

# Set environment to avoid reloader issues
os.environ['FLASK_RUN_WITHOUT_THREADS'] = '1'

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import FLASK_HOST, FLASK_PORT, FLASK_DEBUG
from backend.app import app

if __name__ == '__main__':
    print(f"\n{'='*50}")
    print(f"  Backend API Server Starting")
    print(f"{'='*50}")
    print(f"  URL: http://localhost:{FLASK_PORT}")
    print(f"  Health: http://localhost:{FLASK_PORT}/api/health")
    print(f"  Docs: http://localhost:{FLASK_PORT}/")
    print(f"{'='*50}\n")
    
    # Run without reloader to avoid terminal issues
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=False,  # Disable debug mode auto-reloader
        use_reloader=False  # Explicitly disable reloader
    )
