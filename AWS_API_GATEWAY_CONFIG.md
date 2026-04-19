# AWS API Gateway Configuration

This file documents the API Gateway configuration for the Lambda video processor.

## Usage Plan

- **Usage Plan ID:** `7vrwqd`
- **Name:** `motionrep-video-processor-plan`
- **Rate Limit:** 2000 requests/second
- **Burst Limit:** 5000 requests

## API Key

- **API Key ID:** `bndpy9zkfd`
- **API Key Value:** `qoeu1tpmXZ28S0L6pQluE5VxfDKE0fsfle42xwnf`
- **Status:** Enabled
- **Name:** `motionrep-video-processor-key`

## API Gateway Stage

- **REST API ID:** `w4qcbbn7ck`
- **Stage Name:** `prod`
- **Deployment ID:** `oob0ii`

## API Associations

- ✓ API Key is associated with Usage Plan: `7vrwqd`
- ✓ Usage Plan is associated with API Stage: `w4qcbbn7ck:prod`

## API Endpoint

```
https://w4qcbbn7ck.execute-api.eu-north-1.amazonaws.com/prod/process-video
```

## Authorization

All requests to the API Gateway must include the API Key in the `x-api-key` header:

```bash
curl -X POST https://w4qcbbn7ck.execute-api.eu-north-1.amazonaws.com/prod/process-video \
  -H "x-api-key: qoeu1tpmXZ28S0L6pQluE5VxfDKE0fsfle42xwnf" \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://youtu.be/...",
    "exerciseId": "uuid",
    "supabaseKey": "...",
    "callbackUrl": "..."
  }'
```

## Configuration Date

Created: 2026-04-19 (with API Gateway Usage Plan fixes)
