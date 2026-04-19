# AWS Lambda Deployment Guide

## Overview
This guide walks you through deploying the video processing Lambda function that will handle video cutting for MotionREP.

---

## Prerequisites
1. AWS account with access to Lambda, API Gateway, CloudWatch
2. AWS CLI installed locally: `brew install awscli`
3. Python 3.11+ installed locally
4. ~2GB disk space for building FFmpeg + MediaPipe layer

---

## Step 1: Create Lambda Execution Role

### 1a. Create IAM Role via AWS Console
1. Go to **IAM Dashboard** → **Roles** → **Create Role**
2. **Trusted entity type:** AWS Service
3. **Service:** Lambda
4. **Role name:** `motionrep-video-processor-role`
5. **Permissions:** Attach these inline policies:
   - `AWSLambdaFullAccess` (or create custom for specific resources)
   - Custom policy for Supabase Storage (see below)

### 1b. Create Custom Supabase Storage Policy
Create inline policy with:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::exercise-reference-videos/*"
        }
    ]
}
```

**Note:** This is a template - Supabase uses REST API, so the actual requests from Lambda will be via HTTP to Supabase endpoints (not S3).

---

## Step 2: Build Lambda Layer (FFmpeg + Python Deps)

### 2a. Create Build Directory
```bash
mkdir -p layer-build/python/lib/python3.11/site-packages
mkdir -p layer-build/bin
cd layer-build
```

### 2b. Install Python Dependencies
```bash
pip install -r ../requirements.txt -t python/lib/python3.11/site-packages/
```

### 2c. Download FFmpeg Binary
Option A: Use pre-built binary for Lambda (easiest)
```bash
# Download ffmpeg for Amazon Linux (compatible with Lambda)
cd bin
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-static/ffmpeg .
cp ffmpeg-*-static/ffprobe .
chmod +x ffmpeg ffprobe
cd ..
```

**Note:** FFmpeg must be compiled for Amazon Linux 2 (x86_64) to work on Lambda.

Option B: Use Docker to build (if Option A doesn't work)
```bash
# Build FFmpeg in Docker (simulates Lambda environment)
docker run --rm -v $(pwd):/build amazonlinux:2 bash -c '
  yum install -y gcc make pkg-config libx264-dev libx265-dev
  cd /build && wget https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2
  tar -xf ffmpeg-snapshot.tar.bz2 && cd ffmpeg
  ./configure --enable-gpl --enable-libx264 --enable-libx265 --prefix=/build/bin
  make && make install
'
```

### 2d. Package Layer as ZIP
```bash
cd layer-build
# Create /opt structure (required by Lambda layers)
mkdir -p opt/bin opt/python
cp bin/ffmpeg opt/bin/
cp bin/ffprobe opt/bin/ (optional)
cp -r python/lib/python3.11/site-packages/* opt/python/lib/python3.11/site-packages/

# Zip entire structure
zip -r ../lambda-layer.zip opt/
```

**Final structure:**
```
lambda-layer.zip
├── opt/
│   ├── bin/
│   │   ├── ffmpeg
│   │   └── ffprobe
│   └── python/
│       └── lib/
│           └── python3.11/
│               └── site-packages/
│                   ├── mediapipe/
│                   ├── cv2/
│                   ├── requests/
│                   └── ...
```

### 2e. Upload Layer to AWS Lambda
```bash
aws lambda publish-layer-version \
  --layer-name motionrep-video-processor-layer \
  --zip-file fileb://../lambda-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

**Save the Layer Version ARN** - you'll need it for the Lambda function.

Example ARN: `arn:aws:lambda:us-east-1:123456789012:layer:motionrep-video-processor-layer:1`

---

## Step 3: Create Lambda Function

### 3a. Package Function Code
```bash
# From project root
cd lambda

# Copy files to deployment package
mkdir -p package
cp index.py package/
cp detect_exercise_lambda.py package/

# Install any additional runtime deps
pip install -r requirements.txt -t package/

# Zip package
zip -r ../lambda-function.zip -C package .
```

### 3b. Create Function via CLI
```bash
aws lambda create-function \
  --function-name motionrep-video-processor \
  --runtime python3.11 \
  --role arn:aws:iam::123456789012:role/motionrep-video-processor-role \
  --handler index.lambda_handler \
  --zip-file fileb://../lambda-function.zip \
  --timeout 900 \
  --memory-size 2048 \
  --ephemeral-storage Size=10240 \
  --layers arn:aws:lambda:us-east-1:123456789012:layer:motionrep-video-processor-layer:1 \
  --environment Variables="{SUPABASE_URL=https://your-project.supabase.co,LAMBDA_WEBHOOK_SECRET=your-secret}" \
  --region us-east-1
```

**Parameters:**
- `--timeout 900`: 15 minutes (max for Lambda)
- `--memory-size 2048`: 2GB RAM (helps with video processing)
- `--ephemeral-storage 10240`: 10GB /tmp storage (enough for videos)

---

## Step 4: Create API Gateway Endpoint

### 4a. Create REST API
```bash
aws apigateway create-rest-api \
  --name motionrep-video-processor \
  --description "Video processing API for MotionREP" \
  --region us-east-1
```

**Save the API ID** from output.

### 4b. Create Resource & Method
```bash
API_ID="your-api-id"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region us-east-1 \
  --query 'items[0].id' --output text)

# Create /process-video resource
RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part "process-video" \
  --region us-east-1 \
  --query 'id' --output text)

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type API_KEY \
  --api-key-required \
  --region us-east-1

# Create Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789012:function:motionrep-video-processor/invocations \
  --region us-east-1

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name motionrep-video-processor \
  --statement-id allowApiGateway \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --region us-east-1
```

### 4c. Create API Key
```bash
aws apigateway create-api-key \
  --name motionrep-video-processor-key \
  --enabled \
  --region us-east-1
```

**Save the API Key** - you'll use this in Vercel .env.

### 4d. Deploy API
```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-east-1
```

**Your API endpoint:**
```
https://{API_ID}.execute-api.us-east-1.amazonaws.com/prod/process-video
```

---

## Step 5: Test Lambda Function

### 5a. Manual Invocation
```bash
cat > test-payload.json << 'EOF'
{
  "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
  "exerciseId": "test-exercise-001",
  "angleId": "front",
  "supabaseKey": "your-service-role-key",
  "supabaseUrl": "https://your-project.supabase.co",
  "callbackUrl": "https://your-vercel-domain.com/api/webhook/video-processed"
}
EOF

aws lambda invoke \
  --function-name motionrep-video-processor \
  --payload file://test-payload.json \
  --region us-east-1 \
  response.json

cat response.json
```

### 5b. Check CloudWatch Logs
```bash
aws logs tail /aws/lambda/motionrep-video-processor --follow --region us-east-1
```

---

## Step 6: Configure Vercel Environment Variables

Add these to Vercel Dashboard → Project Settings → Environment Variables:

```
LAMBDA_ENDPOINT=https://{API_ID}.execute-api.us-east-1.amazonaws.com/prod/process-video
LAMBDA_API_KEY=your-api-key-from-step-5c
LAMBDA_WEBHOOK_SECRET=your-webhook-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Step 7: Troubleshooting

### Lambda Function Errors

**Error: "Unable to import module 'index'"**
- Ensure `index.py` is in root of ZIP, not in subdirectory
- Verify Python 3.11 compatibility

**Error: "ffmpeg: command not found"**
- Layer not attached to function
- FFmpeg binary not in `/opt/bin/`
- Check layer structure: `aws lambda get-layer-version --layer-name motionrep-video-processor-layer --version-number 1`

**Error: "Unable to locate credentials"**
- AWS credentials not configured in Lambda execution environment
- Check IAM role has required permissions

**Error: "Timeout exceeded"**
- Video too large (>500MB)
- MediaPipe detection hanging (try lower confidence threshold)
- FFmpeg encoding taking too long (verify `-c copy` is used)
- Increase `--timeout` to 900 (max 15 min)

### Webhook Issues

**Error: "Webhook failed: 403"**
- Verify `LAMBDA_WEBHOOK_SECRET` header in request
- Webhook endpoint not deployed to Vercel yet

**Error: "Webhook failed: 500"**
- Webhook handler crashes (check Vercel logs)
- Supabase service key permissions

### Testing with Local Video

```bash
# Download a test video
curl -o test-video.mp4 https://example.com/sample.mp4

# Invoke Lambda with local video URL (requires internet access)
# Or modify Lambda to accept base64-encoded video in request body
```

---

## Monitoring & Optimization

### View Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=motionrep-video-processor \
  --statistics Average,Maximum \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --region us-east-1
```

### Cost Estimation
- Lambda: ~$0.0000000167 per GB-second
- 2GB RAM × 60 seconds × 100 videos/month = $0.20/month
- API Gateway: $3.50 per 1M requests
- **Total estimate: <$10/month**

### Scaling Strategy
- Lambda scales automatically (up to 1000 concurrent executions)
- Add Reserved Concurrency if you expect spikes
- Monitor CloudWatch for throttling events

---

## Next Steps

1. Deploy this Lambda function
2. Create webhook handler in Vercel (see Phase 2 in main plan)
3. Modify Vercel backend to call Lambda (see Phase 3)
4. Test end-to-end video processing

---

## Support

If you encounter issues:
1. Check CloudWatch logs: `aws logs tail /aws/lambda/motionrep-video-processor --follow`
2. Verify layer is attached: `aws lambda get-function-configuration --function-name motionrep-video-processor`
3. Test function directly: `aws lambda invoke --function-name motionrep-video-processor --payload file://test-payload.json response.json`
