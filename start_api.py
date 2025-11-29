"""
Start API Server - Wrapper to keep server running
"""
import os
import sys

# Ensure we're using the right Python environment
if not sys.executable.endswith('.venv\\Scripts\\python.exe'):
    print(f"[WARNING] Not using venv Python: {sys.executable}")

from api_server import app

if __name__ == '__main__':
    HOST = os.getenv('API_HOST', '0.0.0.0')
    PORT = int(os.getenv('API_PORT', 5000))
    
    print(f"\n{'='*60}")
    print(f"  BACKTESTING API SERVER")
    print(f"{'='*60}")
    print(f"  URL: http://localhost:{PORT}")
    print(f"  Health: http://localhost:{PORT}/health")
    print(f"  Endpoints: http://localhost:{PORT}/")
    print(f"{'='*60}\n")
    print("[SERVER] Starting... Press CTRL+C to stop\n")
    
    try:
        # Run without reloader, single-threaded for stability
        app.run(
            host=HOST,
            port=PORT,
            debug=False,
            use_reloader=False,
            threaded=False
        )
    except KeyboardInterrupt:
        print("\n[SERVER] Shutting down...")
    except Exception as e:
        print(f"\n[ERROR] Server crashed: {e}")
        import traceback
        traceback.print_exc()
