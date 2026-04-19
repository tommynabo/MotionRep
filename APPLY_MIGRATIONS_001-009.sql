-- ============================================================
-- MotionREP Migrations 001-009 (CONSOLIDATED)
-- Paste this entire script into Supabase Dashboard > SQL Editor
-- All statements are idempotent (safe to re-run)
-- ============================================================

-- ============================================================
-- Migration 001: Update camera angles with clinical standard prompts
-- ============================================================
UPDATE public.camera_angles
SET prompt_modifier = 'ABSOLUTELY PERFECT DIRECT FRONT-FACING SHOT. 0 degree deviation. Perfect bilateral symmetry. Camera placed at subject eye-level, dead centre, no tilt, no rotation.'
WHERE name = 'Frontal';

UPDATE public.camera_angles
SET prompt_modifier = 'PRECISE 45-DEGREE DIAGONAL FRONT ANGLE. Camera at exact 45-degree rotation from the frontal axis. Subject visible from a diagonal perspective showing both depth and frontal muscle definition simultaneously.'
WHERE name = 'Perfil 45°';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT 90-DEGREE SIDE PROFILE SHOT. Exact perpendicular angle. Camera aligned to the absolute lateral plane of the subject. Full side silhouette visible with zero frontal or rear deviation.'
WHERE name = 'Lateral 90°';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT TOP-DOWN OVERHEAD SHOT. Camera directly above the subject, perpendicular to the floor. Exact bird''s-eye view, zero lateral tilt, capturing the full symmetrical layout of the exercise from above.'
WHERE name = 'Cenital';

UPDATE public.camera_angles
SET prompt_modifier = 'PRECISE LOW GROUND-LEVEL ANGLE SHOT. Camera positioned near floor level, angled upward toward the subject. Dramatic upward perspective emphasising height, drive, and full muscle extension from below.'
WHERE name = 'Low Angle';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT REAR 180-DEGREE SHOT. Camera directly behind the subject, 0 degree deviation from the posterior axis. Full posterior chain visible — back muscles, glutes, hamstrings — with perfect bilateral symmetry.'
WHERE name = 'Posterior';

-- ============================================================
-- Migration 002: Add reference_video_url to config
-- ============================================================
INSERT INTO public.config (key, value, description)
VALUES (
  'reference_video_url',
  '',
  'URL of the motion-control reference video (MP4, 3-30s, max 100MB). When set, the video pipeline uses kling-3.0/motion-control to apply the reference movement to the generated athlete image. Leave empty to fall back to kling-2.6/image-to-video.'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration 003: Add kie_video_task_id to generations
-- ============================================================
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS kie_video_task_id TEXT;

-- ============================================================
-- Migration 004: Add shorts_logo_description to config
-- ============================================================
INSERT INTO public.config (key, value, description)
VALUES (
  'shorts_logo_description',
  'a small white minimalist brand logo',
  'Plain-text visual description of the brand logo printed on the outer left thigh of the black shorts. Used verbatim in the Flux image prompt — be specific: shape, style, size (e.g. "a small white minimalist mountain peak logo" or "the word MOTIONREP in small white bold uppercase letters").'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration 005: Add reference_video_url to exercises
-- ============================================================
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS reference_video_url TEXT DEFAULT '';

-- ============================================================
-- Migration 006: Remove duplicate camera angles
-- ============================================================
DELETE FROM public.camera_angles ca1
WHERE ca1.id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.camera_angles
  ORDER BY name, created_at ASC
);

-- ============================================================
-- Migration 007: Keep only essential camera angles
-- ============================================================
DELETE FROM public.camera_angles
WHERE name IN ('Cenital', 'Low Angle', 'Perfil 45°');

-- ============================================================
-- Migration 008: Add candidate_videos JSONB column to exercises
-- ============================================================
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS candidate_videos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- Migration 009: Add reference video timing columns for pose detection
-- ============================================================
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS reference_video_start_time FLOAT,
  ADD COLUMN IF NOT EXISTS reference_video_end_time FLOAT,
  ADD COLUMN IF NOT EXISTS reference_video_duration FLOAT;

COMMENT ON COLUMN public.exercises.reference_video_start_time IS 'Start time (seconds) of detected exercise motion in reference video';
COMMENT ON COLUMN public.exercises.reference_video_end_time IS 'End time (seconds) of detected exercise motion in reference video';
COMMENT ON COLUMN public.exercises.reference_video_duration IS 'Duration (seconds) of the cut reference video';

-- ============================================================
-- Verification queries (run these after to confirm success)
-- ============================================================
-- Check that the exercises table has all required columns:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'exercises' AND column_name LIKE 'reference%' OR column_name LIKE 'candidate%'
-- ORDER BY column_name;
--
-- Expected output should include:
--   candidate_videos
--   reference_video_duration
--   reference_video_end_time
--   reference_video_start_time
--   reference_video_url
-- ============================================================
