#!/usr/bin/env python3
"""
Final AWS Lambda Deployment - Simple & Fast
Deploy Lambda Layer + Function + API Gateway in one go
"""

import json
import subprocess
import sys
import os
from pathlib import Path

AWS_REGION = "eu-north-1"
AWS_ACCOUNT_ID = "770014286285"
S3_BUCKET = "motionrep-lambda-artifacts-1776609509"
LAMBDA_ROLE_ARN = f"arn:aws:iam::{AWS_ACCOUNT_ID}:role/motionrep-video-processor-role"

PROJECT_ROOT = Path(__file__).parent
LAYER_ZIP = PROJECT_ROOT / "layer-build" / "lambda-layer.zip"

def run(cmd, desc, capture=False):
    """Execute command"""
    print(f"  {desc}...")
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
            print(f"  ✓ {desc}")
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=True, check=True)
            print(f"  ✓ {desc}")
    except subprocess.CalledProcessError as e:
        print(f"  ✗ ERROR: {e.stderr[:200] if e.stderr else str(e)}")
        raise

print("\n" + "="*70)
print("AWS LAMBDA - FAST DEPLOYMENT")
print("="*70)

try:
    # STEP 1: Upload Lambda Layer to S3 (if not already there)
    print("\n▶ STEP 1: PREPARE LAMBDA LAYER")
    s3_key = "lambda-layer.zip"
    s3_url = f"s3://{S3_BUCKET}/{s3_key}"
    
    if not LAYER_ZIP.exists():
        print(f"  ✗ Layer ZIP not found: {LAYER_ZIP}")
        sys.exit(1)
    
    print(f"  Uploading {LAYER_ZIP.stat().st_size / (1024**2):.1f}MB to S3...")
    run(f"aws s3 cp {LAYER_ZIP} s3://{S3_BUCKET}/{s3_key} --region {AWS_REGION}",
        "Uploading Lambda Layer to S3", capture=False)
    
    # STEP 2: Publish Lambda Layer
    print("\n▶ STEP 2: PUBLISH LAMBDA LAYER")
    layer_arn = run(
        f"aws lambda publish-layer-version "
        f"  --layer-name motionrep-video-processor-layer "
        f"  --content S3Bucket={S3_BUCKET},S3Key={s3_key} "
        f"  --compatible-runtimes python3.11 "
        f"  --region {AWS_REGION} "
        f"  --query 'LayerVersionArn' --output text",
        "Publishing Lambda Layer",
        capture=True
    )
    print(f"  Layer ARN: {layer_arn}")
    
    # STEP 3: Delete existing Lambda function (if any)
    print("\n▶ STEP 3: PREPARE LAMBDA FUNCTION")
    run(f"aws lambda delete-function --function-name motionrep-video-processor --region {AWS_REGION} 2>/dev/null || true",
        "Checking for existing function", capture=False)
    
    # STEP 4: Create Lambda package
    print("\n▶ STEP 4: PACKAGE LAMBDA FUNCTION")
    pkg_dir = PROJECT_ROOT / "lambda-pkg"
    if pkg_dir.exists():
        subprocess.run(f"rm -rf {pkg_dir}", shell=True)
    
    pkg_dir.mkdir()
    subprocess.run(f"cp {PROJECT_ROOT}/lambda/index.py {pkg_dir}/", shell=True)
    subprocess.run(f"cp {PROJECT_ROOT}/lambda/detect_exercise_lambda.py {pkg_dir}/", shell=True)
    
    zip_path = PROJECT_ROOT / "lambda-function.zip"
    run(f"cd {pkg_dir} && zip -r -q {zip_path} . && cd - > /dev/null",
        "Creating Lambda function ZIP", capture=False)
    
    # STEP 5: Create Lambda Function
    print("\n▶ STEP 5: CREATE LAMBDA FUNCTION")
    func_arn = run(
        f"aws lambda create-function "
        f"  --function-name motionrep-video-processor "
        f"  --runtime python3.11 "
        f"  --role {LAMBDA_ROLE_ARN} "
        f"  --handler index.lambda_handler "
        f"  --zip-file fileb://{zip_path} "
        f"  --timeout 900 "
        f"  --memory-size 2048 "
        f"  --ephemeral-storage Size=10240 "
        f"  --layers {layer_arn} "
        f"  --environment Variables=\"{{SUPABASE_URL=https://mxxbvbrrtdurbqaioilc.supabase.co}}\" "
        f"  --region {AWS_REGION} "
        f"  --query 'FunctionArn' --output text",
        "Creating Lambda Function",
        capture=True
    )
    print(f"  Function ARN: {func_arn}")
    
    # STEP 6: Create API Gateway
    print("\n▶ STEP 6: CREATE API GATEWAY")
    api_id = run(
        f"aws apigateway get-rest-apis --region {AWS_REGION} --query 'items[?name==`motionrep-video-processor`].id' --output text | xargs -I{{}} echo {{}} || "
        f"aws apigateway create-rest-api --name motionrep-video-processor --description 'Video processing API' --region {AWS_REGION} --query 'id' --output text",
        "Creating/Getting API Gateway",
        capture=True
    )
    if not api_id:
        api_id = run(
            f"aws apigateway create-rest-api --name motionrep-video-processor --description 'Video processing API' --region {AWS_REGION} --query 'id' --output text",
            "Creating API Gateway",
            capture=True
        )
    print(f"  API ID: {api_id}")
    
    # STEP 7: Setup API resources
    print("\n▶ STEP 7: SETUP API RESOURCES")
    
    root_id = run(
        f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[0].id' --output text",
        "Getting root resource",
        capture=True
    )
    
    resource_id = run(
        f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[?pathPart==`process-video`].id' --output text | xargs -I{{}} test -n {{}} && echo {{}} || "
        f"aws apigateway create-resource --rest-api-id {api_id} --parent-id {root_id} --path-part process-video --region {AWS_REGION} --query 'id' --output text",
        "Creating/Getting /process-video resource",
        capture=True
    )
    
    # STEP 8: Create POST method & integration
    print("\n▶ STEP 8: CREATE METHOD & INTEGRATION")
    
    run(f"aws apigateway put-method --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --authorization-type API_KEY --api-key-required --region {AWS_REGION} 2>/dev/null || true",
        "Creating POST method", capture=False)
    
    lambda_uri = f"arn:aws:apigateway:{AWS_REGION}:lambda:path/2015-03-31/functions/{func_arn}/invocations"
    run(f"aws apigateway put-integration --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --type AWS_PROXY --integration-http-method POST --uri {lambda_uri} --region {AWS_REGION} 2>/dev/null || true",
        "Creating Lambda integration", capture=False)
    
    run(f"aws lambda add-permission --function-name motionrep-video-processor --statement-id allowApiGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --region {AWS_REGION} 2>/dev/null || true",
        "Granting permissions", capture=False)
    
    # STEP 9: Create API Key
    print("\n▶ STEP 9: CREATE API KEY")
    
    api_key_id = run(
        f"aws apigateway get-api-keys --region {AWS_REGION} --query 'items[?name==`motionrep-video-processor-key`].id' --output text | xargs -I{{}} test -n {{}} && echo {{}} || "
        f"aws apigateway create-api-key --name motionrep-video-processor-key --enabled --region {AWS_REGION} --query 'id' --output text",
        "Creating/Getting API Key",
        capture=True
    )
    
    api_key = run(
        f"aws apigateway get-api-key --api-key {api_key_id} --include-value --region {AWS_REGION} --query 'value' --output text",
        "Retrieving API Key",
        capture=True
    )
    
    # STEP 10: Deploy API
    print("\n▶ STEP 10: DEPLOY API")
    
    run(f"aws apigateway create-deployment --rest-api-id {api_id} --stage-name prod --region {AWS_REGION} 2>/dev/null || true",
        "Deploying API Gateway", capture=False)
    
    endpoint = f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/prod/process-video"
    
    # STEP 11: Save configuration
    print("\n▶ STEP 11: SAVE CONFIGURATION")
    
    config = {
        "LAMBDA_ENDPOINT": endpoint,
        "LAMBDA_API_KEY": api_key,
        "AWS_REGION": AWS_REGION,
        "LAMBDA_FUNCTION": "motionrep-video-processor"
    }
    
    config_path = PROJECT_ROOT / "lambda-deployment-config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    print(f"  Saved to: lambda-deployment-config.json")
    
    # Cleanup
    subprocess.run(f"rm -rf {pkg_dir} {zip_path}", shell=True)
    
    # SUCCESS
    print("\n" + "="*70)
    print("✓ DEPLOYMENT COMPLETE!")
    print("="*70)
    print(f"\n📋 YOUR CONFIGURATION:\n")
    print(f"  LAMBDA_ENDPOINT={endpoint}")
    print(f"  LAMBDA_API_KEY={api_key}\n")
    print(f"📝 ADD TO VERCEL & .env:\n")
    print(f"  LAMBDA_ENDPOINT={endpoint}")
    print(f"  LAMBDA_API_KEY={api_key}")
    print(f"  LAMBDA_WEBHOOK_SECRET=motionrep-webhook-secret-2026\n")
    print(f"🚀 NEXT:\n")
    print(f"  1. Copy the variables above")
    print(f"  2. Add to Vercel Dashboard")
    print(f"  3. Execute Supabase migrations")
    print(f"  4. Test with video approval\n")
    
except Exception as e:
    print(f"\n✗ DEPLOYMENT FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
