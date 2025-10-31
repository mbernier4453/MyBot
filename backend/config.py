"""
Backend Configuration
Loads environment variables from .env file
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Polygon Configuration
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')

# AWS S3 Configuration for Flat Files (Massive.com - formerly Polygon)
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
MASSIVE_S3_ENDPOINT = os.getenv('MASSIVE_S3_ENDPOINT', 'https://files.massive.com')
MASSIVE_S3_BUCKET = os.getenv('MASSIVE_S3_BUCKET', 'flatfiles')

# Paths
BACKEND_DIR = Path(__file__).parent
DATA_CACHE_DIR = BACKEND_DIR / 'data' / 'cache'
PROJECT_ROOT = BACKEND_DIR.parent
RESULTS_DIR = PROJECT_ROOT / 'results'

# Ensure directories exist
DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
(RESULTS_DIR / 'csv').mkdir(exist_ok=True)
(RESULTS_DIR / 'tearsheets').mkdir(exist_ok=True)
(RESULTS_DIR / 'db').mkdir(exist_ok=True)

# Flask Server Configuration
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'true').lower() in ('true', '1', 'yes')
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS Configuration
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000').split(',')

# JWT Configuration
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 24))

def validate_config():
    """Validate that all required environment variables are set"""
    missing = []
    
    if not POLYGON_API_KEY or POLYGON_API_KEY == 'your_polygon_api_key_here':
        missing.append('POLYGON_API_KEY')
    
    if not AWS_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID == 'your_aws_access_key_here':
        missing.append('AWS_ACCESS_KEY_ID')
    
    if not AWS_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY == 'your_aws_secret_key_here':
        missing.append('AWS_SECRET_ACCESS_KEY')
    
    if missing:
        return False, f"Missing environment variables: {', '.join(missing)}"
    
    return True, "All environment variables configured"

if __name__ == "__main__":
    is_valid, message = validate_config()
    print(f"Configuration: {message}")
    
    if is_valid:
        print(f"✓ Polygon API Key: {POLYGON_API_KEY[:10]}...")
        print(f"✓ AWS Access Key: {AWS_ACCESS_KEY_ID[:10]}...")
        print(f"✓ AWS Region: {AWS_REGION}")
        print(f"✓ S3 Endpoint: {MASSIVE_S3_ENDPOINT}")
        print(f"✓ S3 Bucket: {MASSIVE_S3_BUCKET}")
        print(f"✓ Cache Dir: {DATA_CACHE_DIR}")
