#!/usr/bin/env python3
"""
Quick setup script for backend
"""
import subprocess
import sys
from pathlib import Path

def setup():
    print("=" * 60)
    print("BACKEND SETUP")
    print("=" * 60)
    
    backend_dir = Path(__file__).parent
    requirements = backend_dir / 'requirements.txt'
    
    print("\nInstalling dependencies...")
    print(f"From: {requirements}")
    
    try:
        subprocess.check_call([
            sys.executable, '-m', 'pip', 'install', '-r', str(requirements)
        ])
        print("\n✓ Dependencies installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Error installing dependencies: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Fill in your .env file with:")
    print("   - POLYGON_API_KEY")
    print("   - AWS_ACCESS_KEY_ID")
    print("   - AWS_SECRET_ACCESS_KEY")
    print("\n2. Run: python backend/tests/test_setup.py")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = setup()
    sys.exit(0 if success else 1)
