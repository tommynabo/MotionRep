# AWS Lambda Video Processing Implementation - Next Steps

## ✅ What Was Just Committed

Your codebase now has a complete AWS Lambda video processing system with these components:

### 1. **AWS Lambda Function** (`lambda/`)
- `index.py` — Main handler (downloads YouTube → detects → cuts → uploads → webhook)
- `detect_exercise_lambda.py` — MediaPipe pose detection for exercise range
- `requirements.txt` — Python dependencies (mediapipe, opencv, requests, pytube, boto3)
- `DEPLOYMENT_GUIDE.md` — Complete step-by-step AWS deployment instructions

### 2. **Backend Changes** (`server/`)
- **videoProcessor.ts** — Now calls external Lambda worker instead of fallback
  - `callExternalLambdaWorker()` → Sends job to Lambda, returns immediately
  - Updated serverless detection to prefer Lambda over fallback
  
- **exercisesController.ts** — Updated to handle 3 states:
  - `duration > 0` = Fully processed ✅
  - `duration = 0` = Processing queued ⏳
  - `duration = -1` = Fallback mode (no Lambda) ⚠️
  - New webhook handler: `handleVideoProcessedWebhook()`
  
- **routes/api.ts** — Added POST `/webhook/video-processed` endpoint

### 3. **Frontend Changes** (`src/`)
- **CurationPage.tsx** — Better status display:
  - Shows "⏳ Procesando en Lambda (1-2 min)" when queued
  - Shows "✅ Procesado y cortado" when complete
  - Shows "⚠️ Fallback Mode" when no Lambda available
  - Displays timing data (duration, start, end) when available

### 4. **Database** (`supabase/`)
- **migration 010** — `processing_jobs` table (optional tracking, not required for MVP)

---

## 🚀 Deployment Steps (5-7 hours)

### **Phase 1: Deploy AWS Lambda (2-3 hours)**
Read: `lambda/DEPLOYMENT_GUIDE.md` carefully

**Summary:**
1. Create IAM role: `motionrep-video-processor-role`
2. Build Lambda Layer with FFmpeg + MediaPipe (biggest step)
3. Create Lambda function from `lambda/index.py`
4. Create API Gateway endpoint: `POST /process-video`
5. Create API Key
6. Test with manual invocation

**Outcome:** You'll have:
- Lambda endpoint: `https://API_ID.execute-api.REGION.amazonaws.com/prod/process-video`
- API Key: `akia-xxxx-xxxx`

### **Phase 2: Configure Vercel Environment (10 min)**
Add to Vercel Dashboard → Project Settings → Environment Variables:

```
LAMBDA_ENDPOINT=https://API_ID.execute-api.REGION.amazonaws.com/prod/process-video
LAMBDA_API_KEY=your-api-key-here
LAMBDA_WEBHOOK_SECRET=your-secret-for-webhook-verification
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then redeploy Vercel.

### **Phase 3: Run Pending Migrations (5 min)**
1. Execute `APPLY_MIGRATIONS_001-009.sql` in Supabase (if not done yet)
2. Execute `supabase/migrations/010_add_processing_jobs_table.sql` in Supabase

### **Phase 4: End-to-End Test (10 min)**
1. Go to your app → **Video Curation**
2. Select an exercise
3. Search for CC-BY videos
4. Click **Approve** on one video
5. **Expected flow:**
   - ✅ "Processing queued" message appears
   - ✅ Lambda receives request (check CloudWatch logs)
   - ⏳ 30-60 seconds: FFmpeg cuts video
   - ✅ Lambda uploads to Supabase Storage
   - ✅ Lambda calls webhook → Vercel updates DB
   - ✅ Frontend shows "✅ Procesado y cortado (38.6s)"

### **Phase 5: Verify Full Pipeline (optional)**
Try generating a video with the newly cut reference video:
1. Video Curation page → exercise with now-complete video
2. Generator page → select same exercise → generate
3. Verify motion control uses the cut reference video (not full YouTube URL)

---

## 📊 Current Architecture

```
User approves YouTube video
        ↓
Vercel approveCandidate() 
        ↓
callExternalLambdaWorker(youtubeUrl, exerciseId)
        ↓
Lambda Handler (AWS)
  1. Extract YouTube MP4 URL (Innertube)
  2. Download to /tmp
  3. Run MediaPipe: detect_exercise.py → timing data
  4. Run FFmpeg: cut video to detected range
  5. Upload to Supabase Storage
  6. POST webhook to Vercel
        ↓
Vercel webhook endpoint (handleVideoProcessedWebhook)
  1. Verify webhook
  2. Update exercises table with:
     - reference_video_url (cut video URL from Storage)
     - reference_video_start_time (1.5s)
     - reference_video_end_time (40.1s)
     - reference_video_duration (38.6s)
        ↓
Frontend updates automatically → shows timing data
        ↓
Generator can now use correct timing for motion control
```

---

## 🔐 Security Notes

1. **Lambda API Key** — Keep in Vercel env vars only (not in repo)
2. **Webhook verification** — Optional but recommended:
   - Lambda sends `X-Lambda-Authorization` header with `LAMBDA_WEBHOOK_SECRET`
   - Vercel webhook should verify header before processing
   - Currently disabled (commented in exercisesController.ts line 241)
3. **Supabase Service Key** — For Lambda to upload to Storage:
   - Use **Service Role Key** (has admin privileges)
   - Keep in env vars, never commit to repo
   - Never share publicly

---

## 📁 File Reference

### Lambda Files (New)
- `lambda/index.py` → Main handler
- `lambda/detect_exercise_lambda.py` → Pose detection
- `lambda/requirements.txt` → Python deps
- `lambda/DEPLOYMENT_GUIDE.md` → AWS setup instructions

### Vercel Backend (Modified)
- `server/lib/videoProcessor.ts` → Calls Lambda worker
- `server/controllers/exercisesController.ts` → Webhook handler
- `server/routes/api.ts` → Webhook route

### Frontend (Modified)
- `src/components/CurationPage.tsx` → Shows Lambda processing status

### Database (New)
- `supabase/migrations/010_add_processing_jobs_table.sql` → Job tracking

---

## 🐛 Troubleshooting

### Lambda deployment fails: "ffmpeg: command not found"
- Layer not attached to function
- FFmpeg binary not in `/opt/bin/`
- Re-read steps 2e-2e in DEPLOYMENT_GUIDE.md

### Webhook not reaching Vercel
- Lambda endpoint might be wrong
- Check CloudWatch Lambda logs: `aws logs tail /aws/lambda/motionrep-video-processor --follow`
- Verify Vercel webhook endpoint is live: `curl https://your-domain.com/api/webhook/video-processed`

### Database not updating after webhook
- Check Vercel function logs for webhook errors
- Verify SUPABASE_SERVICE_ROLE_KEY is correct
- Ensure `processing_jobs` migration (010) was executed

### Video duration stays NULL
- Lambda job might still be processing (check CloudWatch)
- Webhook might have failed (check Vercel logs)
- Manual verification: `SELECT id, reference_video_duration FROM exercises WHERE reference_video_duration IS NOT NULL;`

---

## 💰 Cost Estimate

**Monthly (for ~100 videos processed):**
- AWS Lambda: ~$0.20 (free tier: 1M invocations/month)
- API Gateway: <$0.01 (free tier: 1M requests/month)
- Supabase Storage: $5 for 100GB
- **Total: ~$5/month** (first 1M invocations/requests free)

---

## 🎯 Next Phase (After Lambda Works)

Once videos are being cut and timing is populated:
1. **Test motion control generation** — Does Kling/Seedance use the cut reference video correctly?
2. **Monitor performance** — How long does a typical video take to process?
3. **Add error handling** — Webhook retry logic, failed job notifications
4. **Implement Realtime Updates** — Supabase Realtime subscription in frontend for live status

---

## ✨ Summary

You now have:
- ✅ Complete video processing pipeline in AWS Lambda
- ✅ Webhook integration for async updates
- ✅ Frontend ready to show processing status
- ✅ Fallback mode still works if Lambda is down
- ✅ All code committed and ready for deployment

**Next action:** Follow `lambda/DEPLOYMENT_GUIDE.md` to set up AWS Lambda.

Good luck! 🚀
