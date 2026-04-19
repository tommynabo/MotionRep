#!/bin/bash
#AWS Lambda Docker Image Deployment - MotionREP Video Processing

set -e

# Configuration
AWS_ACCOUNT_ID="770014286285"
AWS_REGION="eu-north-1"
ECR_REPO_NAME="motionrep-video-processor"
LAMBDA_FUNCTION_NAME="motionrep-video-processor"
API_GATEWAY_NAME="motionrep-video-processor"
API_KEY_NAME="motionrep-video-processor-key"

PROJECT_ROOT="/Users/tomas/Downloads/DOCUMENTOS/MotionREP"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║      AWS Lambda Docker Deployment Automation                   ║"
echo "║      MotionREP Video Processing Worker                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Create ECR Repository
echo "▶ STEP 1: CREATE ECR REPOSITORY"
echo "  ────────────────────────────────"

ECR_REPO_EXISTS=$(aws ecr describe-repositories \
  --repository-names $ECR_REPO_NAME \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$ECR_REPO_EXISTS" ]; then
  echo "  Creating ECR repository: $ECR_REPO_NAME"
  ECR_URI=$(aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --region $AWS_REGION \
    --query 'repository.repositoryUri' \
    --output text)
else
  ECR_URI=$(aws ecr describe-repositories \
    --repository-names $ECR_REPO_NAME \
    --region $AWS_REGION \
    --query 'repositories[0].repositoryUri' \
    --output text)
fi

echo "  ✓ ECR URI: $ECR_URI"

# Step 2: Build Docker Image
echo ""
echo "▶ STEP 2: BUILD DOCKER IMAGE"
echo "  ────────────────────────────"

cd $PROJECT_ROOT

if ! command -v docker &> /dev/null; then
  echo "  ✗ Docker is not installed. Install Docker from docker.com"
  exit 1
fi

echo "  Building Docker image..."
docker build -f Dockerfile.lambda -t $ECR_REPO_NAME:latest . 2>&1 | tail -5

docker tag $ECR_REPO_NAME:latest $ECR_URI:latest

echo "  ✓ Docker image built successfully"

# Step 3: Login to ECR
echo ""
echo "▶ STEP 3: LOGIN TO ECR"
echo "  ────────────────────────"

echo "  Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI 2>&1 | tail -3

echo "  ✓ Logged in to ECR"

# Step 4: Push Image to ECR
echo ""
echo "▶ STEP 4: PUSH IMAGE TO ECR"
echo "  ──────────────────────────"

echo "  Pushing image to ECR (this may take a few minutes)..."
docker push $ECR_URI:latest 2>&1 | tail -10

echo "  ✓ Image pushed to ECR"

# Step 5: Delete existing Lambda function
echo ""
echo "▶ STEP 5: CHECK EXISTING LAMBDA FUNCTION"
echo "  ──────────────────────────────────────"

LAMBDA_EXISTS=$(aws lambda get-function \
  --function-name $LAMBDA_FUNCTION_NAME \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$LAMBDA_EXISTS" ]; then
  echo "  Deleting existing function: $LAMBDA_FUNCTION_NAME"
  aws lambda delete-function \
    --function-name $LAMBDA_FUNCTION_NAME \
    --region $AWS_REGION
  sleep 5
fi

echo "  ✓ Ready for function creation"

# Step 6: Create Lambda Function from Docker Image
echo ""
echo "▶ STEP 6: CREATE LAMBDA FUNCTION"
echo "  ──────────────────────────────"

echo "  Creating Lambda function from Docker image..."

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/motionrep-video-processor-role"

aws lambda create-function \
  --function-name $LAMBDA_FUNCTION_NAME \
  --role $ROLE_ARN \
  --code ImageUri=$ECR_URI:latest \
  --package-type Image \
  --timeout 900 \
  --memory-size 2048 \
  --ephemeral-storage Size=10240 \
  --environment Variables="{SUPABASE_URL=https://mxxbvbrrtdurbqaioilc.supabase.co}" \
  --region $AWS_REGION > /tmp/lambda_response.json

FUNCTION_ARN=$(grep -o '"FunctionArn"[^,]*' /tmp/lambda_response.json | cut -d'"' -f4)

echo "  ✓ Lambda Function ARN: $FUNCTION_ARN"

# Step 7: Create API Gateway
echo ""
echo "▶ STEP 7: CREATE API GATEWAY"
echo "  ───────────────────────────"

API_EXISTS=$(aws apigateway get-rest-apis \
  --region $AWS_REGION \
  --query "items[?name=='$API_GATEWAY_NAME'].id" \
  --output text)

if [ -z "$API_EXISTS" ]; then
  echo "  Creating API Gateway: $API_GATEWAY_NAME"
  API_ID=$(aws apigateway create-rest-api \
    --name $API_GATEWAY_NAME \
    --description "Video processing API for MotionREP" \
    --region $AWS_REGION \
    --query 'id' \
    --output text)
else
  API_ID=$API_EXISTS
fi

echo "  ✓ API ID: $API_ID"

# Step 8: Setup API Resources
echo ""
echo "▶ STEP 8: SETUP API RESOURCES"
echo "  ────────────────────────────"

ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $AWS_REGION \
  --query 'items[0].id' \
  --output text)

RESOURCE_EXISTS=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $AWS_REGION \
  --query "items[?pathPart=='process-video'].id" \
  --output text)

if [ -z "$RESOURCE_EXISTS" ]; then
  echo "  Creating /process-video resource..."
  RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part "process-video" \
    --region $AWS_REGION \
    --query 'id' \
    --output text)
else
  RESOURCE_ID=$RESOURCE_EXISTS
fi

echo "  ✓ Resource ID: $RESOURCE_ID"

# Create POST method
echo "  Creating POST method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type API_KEY \
  --api-key-required \
  --region $AWS_REGION 2>/dev/null || true

# Create Lambda integration
LAMBDA_URI="arn:aws:apigateway:${AWS_REGION}:lambda:path/2015-03-31/functions/${FUNCTION_ARN}/invocations"

echo "  Creating Lambda integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri $LAMBDA_URI \
  --region $AWS_REGION 2>/dev/null || true

# Grant API Gateway permission
aws lambda add-permission \
  --function-name $LAMBDA_FUNCTION_NAME \
  --statement-id allowApiGateway \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --region $AWS_REGION 2>/dev/null || true

echo "  ✓ API resources configured"

# Step 9: Create API Key
echo ""
echo "▶ STEP 9: CREATE API KEY"
echo "  ───────────────────────"

API_KEY_EXISTS=$(aws apigateway get-api-keys \
  --region $AWS_REGION \
  --query "items[?name=='$API_KEY_NAME'].id" \
  --output text)

if [ -z "$API_KEY_EXISTS" ]; then
  echo "  Creating API Key: $API_KEY_NAME"
  API_KEY_ID=$(aws apigateway create-api-key \
    --name $API_KEY_NAME \
    --enabled \
    --region $AWS_REGION \
    --query 'id' \
    --output text)
else
  API_KEY_ID=$API_KEY_EXISTS
fi

API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --region $AWS_REGION \
  --query 'value' \
  --output text)

echo "  ✓ API Key: ${API_KEY:0:30}..."

# Step 10: Deploy API
echo ""
echo "▶ STEP 10: DEPLOY API GATEWAY"
echo "  ────────────────────────────"

echo "  Deploying API..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $AWS_REGION \
  --query 'id' \
  --output text 2>/dev/null || echo "")

ENDPOINT="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/prod/process-video"

echo "  ✓ API Endpoint: $ENDPOINT"

# Step 11: Save Configuration
echo ""
echo "▶ STEP 11: SAVE CONFIGURATION"
echo "  ────────────────────────────"

cat > lambda-deployment-config.json << EOF
{
  "LAMBDA_ENDPOINT": "$ENDPOINT",
  "LAMBDA_API_KEY": "$API_KEY",
  "AWS_REGION": "$AWS_REGION",
  "AWS_ACCOUNT_ID": "$AWS_ACCOUNT_ID",
  "LAMBDA_FUNCTION": "$LAMBDA_FUNCTION_NAME",
  "ECR_IMAGE_URI": "$ECR_URI:latest",
  "DEPLOYMENT_DATE": "$(date)",
  "DEPLOYMENT_METHOD": "Docker/ECR"
}
EOF

echo "  ✓ Configuration saved to: lambda-deployment-config.json"

# Final Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✓ DEPLOYMENT COMPLETE!                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 YOUR CONFIGURATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LAMBDA_ENDPOINT=$ENDPOINT"
echo "  LAMBDA_API_KEY=$API_KEY"
echo ""
echo "📝 ADD THESE TO YOUR .env AND VERCEL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LAMBDA_ENDPOINT=$ENDPOINT"
echo "  LAMBDA_API_KEY=$API_KEY"
echo "  LAMBDA_WEBHOOK_SECRET=motionrep-webhook-secret-2026"
echo ""
echo "🚀 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Copy LAMBDA_ENDPOINT and LAMBDA_API_KEY"
echo "  2. Add to Vercel environment variables"
echo "  3. Execute Supabase migrations (001-010)"
echo "  4. Test with video approval in Video Curation page"
echo ""
echo "  Configuration file: $(pwd)/lambda-deployment-config.json"
echo "  Docker image: $ECR_URI:latest"
echo ""
