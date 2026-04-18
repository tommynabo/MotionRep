# 🎬 Automatic Video Cutting with Pose Detection

## Overview

**Option A: Fully Automatic System**

When you approve a video in the curation page (`/curator`), the system automatically:

1. **Downloads** the YouTube video (MP4)
2. **Detects** exercise motion using MediaPipe Pose Detection
3. **Cuts** the video to only the perfect technique range
4. **Uploads** the trimmed video to Supabase Storage
5. **Saves** the clean URL for the Generator to use

**Result**: Instead of using a 2-minute YouTube video with setup, the generator receives only the 5-10 seconds of actual exercise motion.

---

## Setup Requirements

### 1. Python Dependencies

Install MediaPipe, OpenCV, and NumPy:

```bash
pip install -r requirements.txt
```

Or manually:

```bash
pip install mediapipe==0.10.11 opencv-python==4.10.0.84 numpy==1.24.3
```

### 2. FFmpeg

FFmpeg is required for video cutting.

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
```bash
choco install ffmpeg
```

### 3. Environment Variables

Ensure these are set in your `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
YOUTUBE_API_KEY=your-youtube-api-key
```

---

## How It Works

### The Pipeline

```
User approves video in /curator
          ↓
Backend receives: { youtubeUrl, exerciseId }
          ↓
1. Download MP4 from YouTube (using youtubei.js)
          ↓
2. Pose Detection (Python script: detect_exercise.py)
   - Analyzes every frame with MediaPipe Pose model
   - Detects 33 body keypoints per frame
   - Calculates movement magnitude
   - Identifies "active exercise" frames
   - Ignores: setup, adjustment, cool-down phases
          ↓
3. Returns: { start_time, end_time, duration }
          ↓
4. FFmpeg Cuts video
   - Input: Full YouTube video (e.g., 2 minutes)
   - Output: Trimmed video (e.g., 5-10 seconds of perfect technique)
   - Uses copy codec (no re-encoding, fast!)
          ↓
5. Upload to Supabase Storage
   - Bucket: exercise-reference-videos
   - File: {exerciseId}_{timestamp}.mp4
          ↓
6. Update Database
   - reference_video_url = Supabase storage URL
   - reference_video_start_time = detected start (for debugging)
   - reference_video_end_time = detected end (for debugging)
          ↓
✅ Generator now uses ONLY the perfect motion
```

### MediaPipe Pose Detection

**What it detects:**
- 33 body keypoints (shoulders, elbows, wrists, hips, knees, ankles, etc.)
- Confidence level for each keypoint (0-1)
- X, Y, Z coordinates (3D positioning)

**How it identifies exercise motion:**
- Calculates movement magnitude from arm/leg keypoints
- Applies smoothing window (5 frames) to avoid false positives
- Finds first & last frames above movement threshold (0.08)
- Trims 5 frames before/after for margin of safety

**What it ignores:**
- Person standing still (setup, positioning)
- Very slow, minimal movement
- Cool-down at end

---

## Testing Locally

### 1. Test Pose Detection Script Directly

```bash
python3 server/scripts/detect_exercise.py /path/to/video.mp4
```

Output:
```json
{
  "start_frame": 150,
  "end_frame": 320,
  "start_time": 5.0,
  "end_time": 10.67,
  "duration": 5.67,
  "total_frames": 1200,
  "fps": 30
}
```

### 2. Test Full Endpoint

1. Go to `/curator`
2. Select an exercise
3. Click "BUSCAR 5 VÍDEOS"
4. Click on a thumbnail to preview
5. Click "Aprobar" (Approve)
6. **Wait**: Processing takes 30-60 seconds (depends on video duration)
   - Download: ~10s
   - Pose detection: ~20-40s (depends on frame count)
   - Cutting: ~5s
   - Upload: ~5-10s
7. See success toast with timing info

---

## Database Schema

### New Columns (Migration 009)

```sql
-- reference_video_start_time FLOAT
-- Seconds where exercise motion starts (e.g., 5.0)

-- reference_video_end_time FLOAT
-- Seconds where exercise motion ends (e.g., 10.67)

-- reference_video_duration FLOAT
-- Duration of cut video (e.g., 5.67)
```

### Example

| id | exercise_name | reference_video_url | reference_video_duration | reference_video_start_time |
|----|---|---|---|---|
| abc-123 | Squat | s3://supabase/.../abc-123_1726.mp4 | 7.2 | 2.5 |
| def-456 | Bicep Curl | s3://supabase/.../def-456_1735.mp4 | 5.1 | 1.3 |

---

## Logs & Debugging

### Check Console Output

When approving a video, the server logs every step:

```
[VideoProcessor] Downloading MP4 from https://www.youtube.com/watch?v=...
[VideoProcessor] Downloaded to /tmp/exercise_1726894324/input.mp4 - Size: 15243201
[DetectExercise] Executing Python script...
[DetectExercise] Python output: ... frames analyzed ...
[VideoProcessor] Detected range: { startTime: 2.5, endTime: 10.5, duration: 8.0 }
[FFmpeg] Command: ffmpeg -i ... -ss 2.5 -t 8.0 ...
[FFmpeg] Success - Last output: ...
[VideoProcessor] Uploading to Supabase Storage...
[Supabase] File uploaded: { name: 'abc-123_1726.mp4', ... }
[VideoProcessor] Successfully uploaded: https://supabase.../abc-123_1726.mp4
```

### Troubleshooting

**"Cannot find module './videoExtractor'"**
- Ensure TypeScript compilation passed
- Run: `npx tsc --noEmit`

**"Python script not found"**
- Check: `server/scripts/detect_exercise.py` exists
- Verify path in `videoProcessor.ts`

**"ffmpeg: command not found"**
- Install FFmpeg (see Setup section)
- Verify: `which ffmpeg`

**"SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"**
- Add to `.env` file
- Restart server

**"Failed to detect exercise range"**
- Video may be too short (<10 frames detected)
- Or no clear exercise motion detected
- Try a different video with more movement

---

## Performance Notes

### Processing Time

- **Download**: 5-15s (depends on file size)
- **Pose Detection**: 20-60s (depends on video duration, CPU)
  - ~3 frames/second on modern CPU
  - 120-frame video = ~40 seconds
- **Cutting**: 3-10s (depends on video length)
- **Upload**: 5-20s (depends on internet speed)

**Total**: 30-120 seconds per video

### Optimization Opportunities

If too slow in future:

1. **GPU Acceleration**: Use CUDA/TensorRT for MediaPipe
2. **Parallel Processing**: Process every 5th frame, then refine
3. **Caching**: Reuse poses for similar videos
4. **Alternative Models**: Use lighter pose detection model

---

## Next Steps

### When Approving a Video

1. ✅ Admin goes to `/curator`
2. ✅ Searches for exercise videos
3. ✅ Previews video to check technique
4. ✅ Clicks "Aprobar"
5. ✅ Backend automatically cuts to perfect range
6. ✅ User can now generate with clean reference motion

### In the Generator

The generator now uses the cut video:

```
Generator receives: reference_video_url (points to trimmed MP4)
  ↓
Downloads trimmed video (only 5-10s, not 2 minutes!)
  ↓
Passes to Kling motion-control
  ↓
Result: Cleaner, more accurate motion transfer
```

---

## Files Modified

- `server/scripts/detect_exercise.py` - Pose detection logic
- `server/lib/videoProcessor.ts` - Video processor orchestrator
- `server/controllers/exercisesController.ts` - Updated approveCandidate endpoint
- `supabase/migrations/009_add_reference_video_timing.sql` - DB schema
- `requirements.txt` - Python dependencies
- `package.json` - Already has @supabase/supabase-js

---

## Support

If videos aren't being cut correctly:

1. Check console logs (see Debugging section)
2. Test pose detection directly: `python3 server/scripts/detect_exercise.py /path/to/video.mp4`
3. Verify ffmpeg: `ffmpeg -version`
4. Ensure Python packages: `pip list | grep mediapipe`

Good to go! 🚀
