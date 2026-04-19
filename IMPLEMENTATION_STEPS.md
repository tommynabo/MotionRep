# Implementation Steps - Database Schema & Video Processing Fix

## Summary
You have 3 missing columns in your Supabase exercises table: `reference_video_duration`, `reference_video_start_time`, `reference_video_end_time`, and `candidate_videos`. This is why the frontend is showing "column exercises.reference_video_duration does not exist".

**Solution**: Run the pending migrations (001-009) in Supabase, then deploy the updated frontend code.

---

## What Was Changed

### ✅ Files Created
- `APPLY_MIGRATIONS_001-009.sql` — Consolidated migration script (ready to paste)

### ✅ Files Updated
- `src/components/CurationPage.tsx` — Now captures DB response and handles NULL gracefully
  - New interface: `ApprovedVideoResponse` to type the DB response
  - New state: `approvedVideoResponse` to store timing data
  - Updated display to show processing status and video duration (if available)
  - Handles fallback mode (displays ⚠️ when using full YouTube URL)

---

## Step 1: Run Migrations in Supabase (5 minutes)

### 1a. Open Supabase Dashboard
1. Go to https://supabase.com → Log in
2. Select your project: **Motion Rep** (mxxbvbrrtdurbqaioilc)
3. Navigate to **SQL Editor** → Click **New Query**

### 1b. Paste and Execute Migration Script
1. Open the file: `APPLY_MIGRATIONS_001-009.sql` (in your workspace root)
2. Copy the **entire** SQL script
3. Paste it into the Supabase SQL Editor
4. Click **Run** button
5. Wait ~30 seconds for execution
6. You should see: **Command completed successfully** (or similar green confirmation)

### 1c. Verify Success
Run this verification query in the SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'exercises' 
  AND (column_name LIKE 'reference%' OR column_name LIKE 'candidate%')
ORDER BY column_name;
```

You should see these columns:
- `candidate_videos` (jsonb)
- `reference_video_duration` (double precision / float)
- `reference_video_end_time` (double precision / float)
- `reference_video_start_time` (double precision / float)
- `reference_video_url` (text)

---

## Step 2: Deploy Updated Frontend Code

Push the updated `src/components/CurationPage.tsx` to your repository and redeploy:

```bash
git add src/components/CurationPage.tsx
git commit -m "feat: handle reference_video_duration gracefully in CurationPage"
git push
# Vercel will auto-deploy
```

---

## Step 3: Test the Fix

### 3a. Test in Frontend
1. Go to your app → **Video Curation** page
2. Select an exercise
3. Search for CC-BY videos
4. Click **Approve** on any video

**Expected behavior:**
- ✅ No "column does not exist" error
- ✅ Success message shows (either "Processed and cut" or "Fallback mode")
- ✅ If video was processed: shows duration (e.g., "📹 Duración: 12.34s")
- ✅ If fallback mode: shows "⚠️ Fallback Mode (URL no procesada)"

### 3b. Check Supabase Logs
In Vercel or local logs, you should see:
```
[approveCandidate] Processing video for exercise: Cable Lateral Raise
[approveCandidate] Video fallback (full URL used). Updating exercise record...
[approveCandidate] Success! Approved video for Cable Lateral Raise
```

No errors about "column does not exist".

---

## What Happens Next?

### Current Behavior (After This Fix)
- ✅ **DB doesn't crash** — columns exist
- ✅ **Fallback mode works** — when in serverless, uses full YouTube URL, timing fields are NULL
- ✅ **Frontend handles NULL** — displays "⚠️ Fallback Mode" and "⏳ Timing no disponible"

### Still TODO (For Full Video Processing)
- ❌ Vercel can't cut videos (no FFmpeg/MediaPipe)
- ❌ Videos stay at full YouTube length instead of being trimmed to exercise range
- 🔄 **Next phase**: Set up external video worker (AWS Lambda, Cloudflare, etc.) to handle video processing

---

## Troubleshooting

### "Connection failed" in SQL Editor
- Check your internet connection
- Check Supabase status page: https://status.supabase.com

### "Syntax error in SQL"
- Make sure you copied the **entire** APPLY_MIGRATIONS_001-009.sql file
- Don't edit the SQL — paste as-is
- Try copying line-by-line if one large paste fails

### Still seeing "column does not exist" error
- Verify the columns were created (run verification query above)
- Clear browser cache: Cmd+Shift+Delete, then reload
- Check Vercel deployed version is up-to-date (check git log in Vercel dashboard)

### "Timestamp mismatch" or "Migration already applied"
- Some columns might already exist. This is fine — the SQL uses `IF NOT EXISTS` so it's safe to re-run
- Just continue with Step 2 (deploy frontend)

---

## Files Modified Summary

### Frontend Changes (src/components/CurationPage.tsx)
- Added `ApprovedVideoResponse` interface to type DB response
- Added `approvedVideoResponse` state to store timing data
- Updated `handleApproveCandidates()` to capture DB response
- Updated UI to display:
  - Processing status (Processed ✅ vs Fallback ⚠️)
  - Video duration (if available)
  - Start/end times (if available)
  - Graceful NULL handling

### Database Changes (Migrations 001-009)
- 001: Camera angle prompt updates
- 002: Config reference_video_url
- 003: generations.kie_video_task_id
- 004: Config shorts_logo_description
- 005: exercises.reference_video_url
- 006: Remove duplicate camera angles
- 007: Keep only 3 essential camera angles
- **008: exercises.candidate_videos** (new column)
- **009: exercises.reference_video_start_time/end_time/duration** (new columns)

---

## Questions?
Let me know if:
- Migrations won't run in Supabase
- Frontend still crashes after deployment
- You want to implement external video worker next
