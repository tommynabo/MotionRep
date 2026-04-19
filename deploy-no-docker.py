#!/usr/bin/env python3
"""
AWS Lambda Deployment - NO DOCKER REQUIRED
Simple one-command deployment for MotionREP video processing
FFmpeg auto-downloads at runtime - no layer size issues
"""

import json
import subprocess
import sys
import os
from pathlib import Path

# Config
AWS_REGION = "eu-north-1"
AWS_ACCOUNT_ID = "770014286285"
S3_BUCKET = "motionrep-lambda-artifacts-1776609509"
LAMBDA_ROLE_ARN = f"arn:aws:iam::{AWS_ACCOUNT_ID}:role/motionrep-video-processor-role"
PROJECT_ROOT = Path(__file__).parent
LAYER_ZIP = PROJECT_ROOT / "layer-build" / "lambda-layer.zip"

def run(cmd, desc, capture=False):
    """Execute shell command"""
    print(f"  ▶ {desc}...", end=" ", flush=True)
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True, timeout=300)
            print("✓")
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=True, check=True, timeout=300)
            print("✓")
    except subprocess.CalledProcessError as e:
        print(f"✗\n    ERROR: {str(e)[:150]}")
        raise
    except subprocess.TimeoutExpired:
        print(f"✗\n    TIMEOUT")
        raise

print("\n" + "="*70)
print("AWS LAMBDA DEPLOYMENT - NO DOCKER")
print("="*70)

try:
    # STEP 1: Upload Layer to S3
    print("\n  [1/8] UPLOAD LAMBDA LAYER TO S3")
    if not LAYER_ZIP.exists():
        print(f"    ✗ Layer not found: {LAYER_ZIP}")
        sys.exit(1)
    
    size_mb = LAYER_ZIP.stat().st_size / (1024**2)
    print(f"    Size: {size_mb:.1f}MB")
    
    run(f"aws s3 cp {LAYER_ZIP} s3://{S3_BUCKET}/lambda-layer.zip --region {AWS_REGION}",
        "Uploading to S3", capture=False)
    
    # STEP 2: Publish Layer
    print("\n  [2/8] PUBLISH LAMBDA LAYER")
    layer_arn = run(
        f"aws lambda publish-layer-version --layer-name motionrep-video-processor-layer "
        f"--content S3Bucket={S3_BUCKET},S3Key=lambda-layer.zip --compatible-runtimes python3.11 "
        f"--region {AWS_REGION} --query 'LayerVersionArn' --output text",
        "Publishing layer", capture=True)
    print(f"    ARN: {layer_arn}")
    
    # STEP 3: Package Lambda function
    print("\n  [3/8] PACKAGE LAMBDA FUNCTION")
    pkg_dir = PROJECT_ROOT / "lambda-pkg"
    if pkg_dir.exists():
        subprocess.run(f"rm -rf {pkg_dir}", shell=True)
    pkg_dir.mkdir()
    
    subprocess.run(f"cp {PROJECT_ROOT}/lambda/index.py {pkg_dir}/", shell=True, check=True)
    subprocess.run(f"cp {PROJECT_ROOT}/lambda/detect_exercise_lambda.py {pkg_dir}/", shell=True, check=True)
    
    zip_path = PROJECT_ROOT / "lambda-function.zip"
    run(f"cd {pkg_dir} && zip -r -q {zip_path} . && cd - > /dev/null", "Creating function ZIP", capture=False)
    
    # STEP 4: Delete existing function
    print("\n  [4/8] CHECK EXISTING FUNCTION")
    run(f"aws lambda delete-function --function-name motionrep-video-processor --region {AWS_REGION} 2>/dev/null || true",
        "Removing old function", capture=False)
    
    import time
    time.sleep(3)
    
    # STEP 5: Create Lambda function
    print("\n  [5/8] CREATE LAMBDA FUNCTION")
    func_arn = run(
        f"aws lambda create-function --function-name motionrep-video-processor --runtime python3.11 "
        f"--role {LAMBDA_ROLE_ARN} --handler index.lambda_handler --zip-file fileb://{zip_path} "
        f"--timeout 900 --memory-size 2048 --ephemeral-storage Size=10240 --layers {layer_arn} "
        f"--environment Variables='{{SUPABASE_URL=https://mxxbvbrrtdurbqaioilc.supabase.co}}' "
        f"--region {AWS_REGION} --query 'FunctionArn' --output text",
        "Creating function", capture=True)
    print(f"    ARN: {func_arn}")
    
    # STEP 6: Setup API Gateway
    print("\n  [6/8] SETUP API GATEWAY")
    api_list = run(
        f"aws apigateway get-rest-apis --region {AWS_REGION} --query 'items[?name==`motionrep-video-processor`].id' --output text",
        "Checking for existing API", capture=True)
    
    if api_list and api_list.strip():
        api_id = api_list.strip().split()[0]  # Get first one if multiple
        print(f"    Found existing API: {api_id}")
    else:
        api_id = run(
            f"aws apigateway create-rest-api --name motionrep-video-processor --description 'Video processing API' --region {AWS_REGION} --query 'id' --output text",
            "Creating new API", capture=True)
        print(f"    Created new API: {api_id}")
    
    if not api_id or api_id == "None" or not api_id.strip():
        raise ValueError("Failed to get or create API Gateway")
    
    # STEP 7: Configure API resources
    print("\n  [7/8] CONFIGURE API RESOURCES")
    
    root_id = run(
        f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[0].id' --output text",
        "Getting root resource", capture=True)
    
    if not root_id or root_id == "None":
        raise ValueError("Failed to get root resource ID")
    
    resource_check = run(
        f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[?pathPart==`process-video`]' --output json",
        "Checking for resource", capture=True)
    
    resources = json.loads(resource_check) if resource_check else []
    
    if resources and len(resources) > 0:
        resource_id = resources[0]['id']
        print(f"    Found existing resource: {resource_id}")
    else:
        resource_id = run(
            f"aws apigateway create-resource --rest-api-id {api_id} --parent-id {root_id} --path-part process-video --region {AWS_REGION} --query 'id' --output text",
            "Creating resource", capture=True)
    
    run(f"aws apigateway put-method --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --authorization-type API_KEY --api-key-required --region {AWS_REGION} 2>/dev/null || true",
        "Creating POST method", capture=False)
    
    lambda_uri = f"arn:aws:apigateway:{AWS_REGION}:lambda:path/2015-03-31/functions/{func_arn}/invocations"
    run(f"aws apigateway put-integration --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --type AWS_PROXY --integration-http-method POST --uri {lambda_uri} --region {AWS_REGION} 2>/dev/null || true",
        "Creating integration", capture=False)
    
    run(f"aws lambda add-permission --function-name motionrep-video-processor --statement-id allowApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --region {AWS_REGION} 2>/dev/null || true",
        "Granting permissions", capture=False)
    
    # STEP 8: Create API key & deploy
    print("\n  [8/8] CREATE API KEY & DEPLOY")
    
    api_key_id = run(
        f"aws apigateway get-api-keys --region {AWS_REGION} --query 'items[?name==`motionrep-video-processor-key`].id' --output text 2>/dev/null || "
        f"aws apigateway create-api-key --name motionrep-video-processor-key --enabled --region {AWS_REGION} --query 'id' --output text",
        "Getting/creating API key", capture=True)
    
    api_key = run(
        f"aws apigateway get-api-key --api-key {api_key_id} --include-value --region {AWS_REGION} --query 'value' --output text",
        "Retrieving key", capture=True)
    
    run(f"aws apigateway create-deployment --rest-api-id {api_id} --stage-name prod --region {AWS_REGION} 2>/dev/null || true",
        "Deploying API", capture=False)
    
    endpoint = f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/prod/process-video"
    
    # Save config
    config = {
        "LAMBDA_ENDPOINT": endpoint,
        "LAMBDA_API_KEY": api_key,
        "AWS_REGION": AWS_REGION,
        "LAMBDA_FUNCTION": "motionrep-video-processor",
        "CREATED_DATE": subprocess.run("date", shell=True, capture_output=True, text=True).stdout.strip()
    }
    
    config_path = PROJECT_ROOT / "lambda-deployment-config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    # Cleanup
    subprocess.run(f"rm -rf {pkg_dir} {zip_path}", shell=True)
    
    # SUCCESS!
    print("\n" + "="*70)
    print("✓ DEPLOYMENT COMPLETE!")
    print("="*70)
    
    print("\n📋 YOUR DEPLOYMENT CREDENTIALS:")
    print("─" * 70)
    print(f"\nLAMBDA_ENDPOINT={endpoint}")
    print(f"\nLAMBDA_API_KEY={api_key}")
    
    print("\n📝 SAVE THESE TO VERCEL & .env:")
    print("─" * 70)
    print(f"\nLAMBDA_ENDPOINT={endpoint}")
    print(f"LAMBDA_API_KEY={api_key}")
    print(f"LAMBDA_WEBHOOK_SECRET=motionrep-webhook-secret-2026")
    
    print("\n🚀 NEXT STEPS:")
    print("─" * 70)
    print("""
1. Copy the 3 environment variables above
2. Go to Vercel Dashboard → Project Settings → Environment Variables
3. Add all 3 variables
4. Redeploy Vercel (or it auto-deploys)
5. Execute Supabase migrations:
   - Run APPLY_MIGRATIONS_001-009.sql
   - Run supabase/migrations/010_add_processing_jobs_table.sql
6. Test: Go to Video Curation → Approve a video
7. Watch for "⏳ Procesando..." status
    """)
    
    print(f"\n💾 Config saved to: {config_path}")
    print("\n✓ Deployment successful!")
    
except Exception as e:
    print(f"\n✗ DEPLOYMENT FAILED: {e}")
    sys.exit(1)
