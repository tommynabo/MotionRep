-- Migration 008: Add candidate_videos JSONB column to exercises
-- Stores the list of YouTube CC-BY video candidates for admin curation.
-- reference_video_url already exists — no change needed for that column.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS candidate_videos JSONB NOT NULL DEFAULT '[]'::jsonb;
