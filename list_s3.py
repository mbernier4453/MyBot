
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

def list_s3_prefixes():
    access_key = os.getenv('MASSIVE_ACCESS_KEY') or os.getenv('AWS_ACCESS_KEY_ID')
    secret_key = os.getenv('MASSIVE_SECRET_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
    
    s3 = boto3.client(
        's3',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url="https://files.massive.com"
    )
    
    bucket = "flatfiles"
    prefix = "us_stocks_sip/"
    
    print(f"--- PREFIXES IN {prefix} ---")
    try:
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter='/')
        if 'CommonPrefixes' in response:
            for p in response['CommonPrefixes']:
                print(f"DIR: {p['Prefix']}")
        else:
            print("No subdirectories found.")
    except Exception as e:
        print(f"Error listing prefixes: {e}")

    print("\n--- CHECKING FOR 'splits' ---")
    try:
        # Try to guess 'splits' folder
        response = s3.list_objects_v2(Bucket=bucket, Prefix="us_stocks_sip/splits", MaxKeys=5)
        if 'Contents' in response:
            for obj in response['Contents']:
                print(f"FILE: {obj['Key']}")
        else:
            print("No files found starting with 'us_stocks_sip/splits'")
    except Exception as e:
        print(f"Error checking splits: {e}")

if __name__ == "__main__":
    list_s3_prefixes()
