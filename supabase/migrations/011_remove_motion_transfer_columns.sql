-- Migration 011: Remove Motion Transfer columns and tables
-- Cleans up all DB artifacts from the experimental Motion Transfer pipeline.
-- Safe to run: all removed columns were only used by the deleted server code.

-- Drop processing_jobs table (from migration 010)
DROP TABLE IF EXISTS public.processing_jobs;

-- Drop reference video timing columns from exercises (from migration 009)
ALTER TABLE public.exercises
  DROP COLUMN IF EXISTS reference_video_start_time,
  DROP COLUMN IF EXISTS reference_video_end_time,
  DROP COLUMN IF EXISTS reference_video_duration;

-- Drop candidate_videos JSONB column from exercises (from migration 008)
ALTER TABLE public.exercises
  DROP COLUMN IF EXISTS candidate_videos;

-- Drop reference_video_url column from exercises (from migration 002)
ALTER TABLE public.exercises
  DROP COLUMN IF EXISTS reference_video_url;
