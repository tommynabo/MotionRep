#!/usr/bin/env python3
"""
AWS Lambda Deployment Automation Script for MotionREP
Uses S3 for large Lambda Layer uploads
"""

import json
import subprocess
import sys
import os
from pathlib import Path

# Configuration
AWS_REGION = "eu-north-1"
AWS_ACCOUNT_ID = "770014286285"
S3_BUCKET = "motionrep-lambda-artifacts-1776609509"
LAYER_S3_KEY = "lambda-layer.zip"
LAMBDA_ROLE_ARN = f"arn:aws:iam::{AWS_ACCOUNT_ID}:role/motionrep-video-processor-role"
LAMBDA_FUNCTION_NAME = "motionrep-video-processor"
LAMBDA_LAYER_NAME = "motionrep-video-processor-layer"
API_GATEWAY_NAME = "motionrep-video-processor"
API_KEY_NAME = "motionrep-video-processor-key"

PROJECT_ROOT = Path(__file__).parent
LAMBDA_DIR = PROJECT_ROOT / "lambda"

def run_command(cmd, description, capture=False):
    """Execute shell command and handle errors"""
    print(f"\n▶ {description}")
    print(f"   Command: {' '.join(cmd.split()[:5])}..." if len(cmd) > 50 else f"   Command: {cmd}")
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
            print(f"   ✓ {description}")
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=True, check=True)
            print(f"   ✓ {description}")
            return None
    except subprocess.CalledProcessError as e:
        print(f"   ✗ ERROR: {e}")
        if e.stderr:
            print(f"   stderr: {e.stderr[:200]}")
        raise

def publish_lambda_layer_from_s3():
    """Upload Lambda Layer from S3"""
    print("\n" + "=" * 70)
    print("STEP 1: PUBLISH LAMBDA LAYER (FROM S3)")
    print("=" * 70)
    
    print(f"Using S3 bucket: s3://{S3_BUCKET}/{LAYER_S3_KEY}")
    
    # Create S3 URL
    s3_url = f"s3://{S3_BUCKET}/{LAYER_S3_KEY}"
    
    cmd = f"""
    aws lambda publish-layer-version \
      --layer-name {LAMBDA_LAYER_NAME} \
      --content S3Bucket={S3_BUCKET},S3Key={LAYER_S3_KEY} \
      --compatible-runtimes python3.11 \
      --region {AWS_REGION}
    """
    
    output = run_command(cmd, "Publishing Lambda Layer from S3", capture=True)
    layer_data = json.loads(output)
    layer_arn = layer_data["LayerVersionArn"]
    print(f"   Layer ARN: {layer_arn}")
    return layer_arn

def create_lambda_function(layer_arn):
    """Create Lambda function with layer attached"""
    print("\n" + "=" * 70)
    print("STEP 2: CREATE LAMBDA FUNCTION")
    print("=" * 70)
    
    # First, check if function exists and delete it
    check_cmd = f"aws lambda get-function --function-name {LAMBDA_FUNCTION_NAME} --region {AWS_REGION} 2>/dev/null"
    result = subprocess.run(check_cmd, shell=True, capture_output=True)
    
    if result.returncode == 0:
        print(f"Function {LAMBDA_FUNCTION_NAME} already exists. Deleting...")
        run_command(
            f"aws lambda delete-function --function-name {LAMBDA_FUNCTION_NAME} --region {AWS_REGION}",
            "Deleting existing Lambda function"
        )
        import time
        time.sleep(3)  # Wait for deletion to complete
    
    # Package lambda code
    print("\nPackaging Lambda function code...")
    package_dir = PROJECT_ROOT / "lambda-package"
    if package_dir.exists():
        subprocess.run(f"rm -rf {package_dir}", shell=True)
    package_dir.mkdir()
    
    # Copy files
    subprocess.run(f"cp {LAMBDA_DIR}/index.py {package_dir}/", shell=True)
    subprocess.run(f"cp {LAMBDA_DIR}/detect_exercise_lambda.py {package_dir}/", shell=True)
    
    # Create ZIP
    zip_path = PROJECT_ROOT / "lambda-function.zip"
    run_command(
        f"cd {package_dir} && zip -r -q {zip_path} . && cd - > /dev/null",
        "Creating Lambda function ZIP"
    )
    
    # Create function
    create_cmd = f"""
    aws lambda create-function \
      --function-name {LAMBDA_FUNCTION_NAME} \
      --runtime python3.11 \
      --role {LAMBDA_ROLE_ARN} \
      --handler index.lambda_handler \
      --zip-file fileb://{zip_path} \
      --timeout 900 \
      --memory-size 2048 \
      --ephemeral-storage Size=10240 \
      --layers {layer_arn} \
      --environment Variables="{{SUPABASE_URL=https://mxxbvbrrtdurbqaioilc.supabase.co}}" \
      --region {AWS_REGION}
    """
    
    output = run_command(create_cmd, "Creating Lambda function", capture=True)
    func_data = json.loads(output)
    func_arn = func_data["FunctionArn"]
    print(f"   Function ARN: {func_arn}")
    
    # Cleanup
    subprocess.run(f"rm -rf {package_dir} {zip_path}", shell=True)
    
    return func_arn

def create_api_gateway():
    """Create API Gateway REST API"""
    print("\n" + "=" * 70)
    print("STEP 3: CREATE API GATEWAY")
    print("=" * 70)
    
    # Check if API exists
    check_cmd = f"aws apigateway get-rest-apis --region {AWS_REGION} --query 'items[?name==`{API_GATEWAY_NAME}`].id' --output text"
    existing_api = run_command(check_cmd, "Checking for existing API", capture=True)
    
    if existing_api:
        print(f"API {API_GATEWAY_NAME} already exists. Using existing API ID: {existing_api}")
        api_id = existing_api
    else:
        # Create new API
        cmd = f"""
        aws apigateway create-rest-api \
          --name {API_GATEWAY_NAME} \
          --description "Video processing API for MotionREP" \
          --region {AWS_REGION}
        """
        output = run_command(cmd, "Creating REST API", capture=True)
        api_data = json.loads(output)
        api_id = api_data["id"]
    
    print(f"   API ID: {api_id}")
    return api_id

def setup_api_gateway_resources(api_id):
    """Create API Gateway resources and methods"""
    print("\n" + "=" * 70)
    print("STEP 4: SETUP API GATEWAY RESOURCES")
    print("=" * 70)
    
    # Get root resource
    cmd = f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[0].id' --output text"
    root_id = run_command(cmd, "Getting root resource ID", capture=True)
    print(f"   Root ID: {root_id}")
    
    # Check if resource exists
    check_cmd = f"aws apigateway get-resources --rest-api-id {api_id} --region {AWS_REGION} --query 'items[?pathPart==`process-video`].id' --output text"
    resource_id = run_command(check_cmd, "Checking for existing resource", capture=True)
    
    if not resource_id:
        # Create resource
        cmd = f"""
        aws apigateway create-resource \
          --rest-api-id {api_id} \
          --parent-id {root_id} \
          --path-part "process-video" \
          --region {AWS_REGION} \
          --query 'id' --output text
        """
        resource_id = run_command(cmd, "Creating /process-video resource", capture=True)
    
    print(f"   Resource ID: {resource_id}")
    
    # Create API Key
    print("\nCreating API Key...")
    check_key_cmd = f"aws apigateway get-api-keys --region {AWS_REGION} --query 'items[?name==`{API_KEY_NAME}`].id' --output text"
    existing_key = run_command(check_key_cmd, "Checking for existing API Key", capture=True)
    
    if not existing_key:
        cmd = f"""
        aws apigateway create-api-key \
          --name {API_KEY_NAME} \
          --enabled \
          --region {AWS_REGION} \
          --query 'id' --output text
        """
        api_key_id = run_command(cmd, "Creating API Key", capture=True)
    else:
        api_key_id = existing_key
    
    print(f"   API Key ID: {api_key_id}")
    
    # Get the actual API Key value
    cmd = f"aws apigateway get-api-key --api-key {api_key_id} --include-value --region {AWS_REGION} --query 'value' --output text"
    api_key_value = run_command(cmd, "Retrieving API Key value", capture=True)
    print(f"   ✓ API Key: {api_key_value[:20]}...")
    
    # Create POST method
    check_method_cmd = f"aws apigateway get-method --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --region {AWS_REGION} 2>/dev/null"
    method_exists = subprocess.run(check_method_cmd, shell=True, capture_output=True).returncode == 0
    
    if not method_exists:
        cmd = f"""
        aws apigateway put-method \
          --rest-api-id {api_id} \
          --resource-id {resource_id} \
          --http-method POST \
          --authorization-type API_KEY \
          --api-key-required \
          --region {AWS_REGION}
        """
        run_command(cmd, "Creating POST method")
    
    # Create Lambda integration
    lambda_uri = f"arn:aws:apigateway:{AWS_REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:{AWS_REGION}:{AWS_ACCOUNT_ID}:function:{LAMBDA_FUNCTION_NAME}/invocations"
    
    check_integration_cmd = f"aws apigateway get-integration --rest-api-id {api_id} --resource-id {resource_id} --http-method POST --region {AWS_REGION} 2>/dev/null"
    integration_exists = subprocess.run(check_integration_cmd, shell=True, capture_output=True).returncode == 0
    
    if not integration_exists:
        cmd = f"""
        aws apigateway put-integration \
          --rest-api-id {api_id} \
          --resource-id {resource_id} \
          --http-method POST \
          --type AWS_PROXY \
          --integration-http-method POST \
          --uri {lambda_uri} \
          --region {AWS_REGION}
        """
        run_command(cmd, "Creating Lambda integration")
    
    # Grant permission to API Gateway
    cmd = f"""
    aws lambda add-permission \
      --function-name {LAMBDA_FUNCTION_NAME} \
      --statement-id allowApiGateway \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --region {AWS_REGION} 2>/dev/null || true
    """
    run_command(cmd, "Granting API Gateway permission")
    
    return resource_id, api_key_id, api_key_value

def deploy_api(api_id):
    """Deploy API Gateway"""
    print("\n" + "=" * 70)
    print("STEP 5: DEPLOY API GATEWAY")
    print("=" * 70)
    
    # Check if deployment exists
    check_deployments_cmd = f"aws apigateway get-deployments --rest-api-id {api_id} --region {AWS_REGION} --query 'items[?stageName==`prod`].id' --output text"
    existing_deployment = run_command(check_deployments_cmd, "Checking for existing deployment", capture=True)
    
    if existing_deployment:
        print(f"   Deployment already exists: {existing_deployment}")
        deployment_id = existing_deployment
    else:
        cmd = f"""
        aws apigateway create-deployment \
          --rest-api-id {api_id} \
          --stage-name prod \
          --region {AWS_REGION} \
          --query 'id' --output text
        """
        deployment_id = run_command(cmd, "Deploying API Gateway", capture=True)
    
    print(f"   Deployment ID: {deployment_id}")
    
    # Get endpoint
    endpoint = f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/prod/process-video"
    print(f"   Endpoint: {endpoint}")
    return endpoint

def save_configuration(endpoint, api_key):
    """Save configuration to file"""
    print("\n" + "=" * 70)
    print("STEP 6: SAVE CONFIGURATION")
    print("=" * 70)
    
    config = {
        "LAMBDA_ENDPOINT": endpoint,
        "LAMBDA_API_KEY": api_key,
        "AWS_REGION": AWS_REGION,
        "LAMBDA_FUNCTION": LAMBDA_FUNCTION_NAME,
        "CREATED": subprocess.run("date", shell=True, capture_output=True, text=True).stdout.strip()
    }
    
    config_path = PROJECT_ROOT / "lambda-deployment-config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    print(f"   Config saved to: {config_path}")
    print(f"   ✓ LAMBDA_ENDPOINT={endpoint}")
    print(f"   ✓ LAMBDA_API_KEY={api_key[:30]}...")
    
    return config

def main():
    try:
        print("\n")
        print("╔" + "=" * 68 + "╗")
        print("║" + " " * 15 + "AWS LAMBDA DEPLOYMENT AUTOMATION" + " " * 21 + "║")
        print("║" + " " * 20 + "MotionREP Video Processing" + " " * 22 + "║")
        print("╚" + "=" * 68 + "╝")
        
        print("\n" + "=" * 70)
        print("STARTING DEPLOYMENT PROCESS")
        print("=" * 70)
        print(f"Region: {AWS_REGION}")
        print(f"Account: {AWS_ACCOUNT_ID}")
        print(f"Role: {LAMBDA_ROLE_ARN}")
        print(f"S3 Bucket: {S3_BUCKET}")
        
        # Step 1: Publish Layer from S3
        layer_arn = publish_lambda_layer_from_s3()
        
        # Step 2: Create Function
        func_arn = create_lambda_function(layer_arn)
        
        # Step 3: Create API Gateway
        api_id = create_api_gateway()
        
        # Step 4: Setup Resources
        resource_id, api_key_id, api_key_value = setup_api_gateway_resources(api_id)
        
        # Step 5: Deploy
        endpoint = deploy_api(api_id)
        
        # Step 6: Save config
        config = save_configuration(endpoint, api_key_value)
        
        # Success summary
        print("\n" + "=" * 70)
        print("✓ DEPLOYMENT COMPLETE!")
        print("=" * 70)
        print("\n📋 YOUR CONFIGURATION:")
        print(f"  LAMBDA_ENDPOINT={config['LAMBDA_ENDPOINT']}")
        print(f"  LAMBDA_API_KEY={config['LAMBDA_API_KEY'][:30]}...")
        print("\n📝 ADD THESE TO YOUR .env AND VERCEL:")
        print(f"  LAMBDA_ENDPOINT={config['LAMBDA_ENDPOINT']}")
        print(f"  LAMBDA_API_KEY={config['LAMBDA_API_KEY']}")
        print(f"  LAMBDA_WEBHOOK_SECRET=motionrep-webhook-secret-2026")
        print("\n✓ Configuration saved to: lambda-deployment-config.json")
        print("\n🚀 NEXT STEPS:")
        print("  1. Copy LAMBDA_ENDPOINT and LAMBDA_API_KEY")
        print("  2. Add to Vercel environment variables")
        print("  3. Execute Supabase migrations")
        print("  4. Test with video approval")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ DEPLOYMENT FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
