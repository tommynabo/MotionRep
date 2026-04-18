-- Migration 009: Add reference video timing columns for pose detection
-- Stores the detected start/end times of the actual exercise motion.
-- Used for debugging and reference when reviewing cut videos.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS reference_video_start_time FLOAT,
  ADD COLUMN IF NOT EXISTS reference_video_end_time FLOAT,
  ADD COLUMN IF NOT EXISTS reference_video_duration FLOAT;

COMMENT ON COLUMN public.exercises.reference_video_start_time IS 'Start time (seconds) of detected exercise motion in reference video';
COMMENT ON COLUMN public.exercises.reference_video_end_time IS 'End time (seconds) of detected exercise motion in reference video';
COMMENT ON COLUMN public.exercises.reference_video_duration IS 'Duration (seconds) of the cut reference video';
