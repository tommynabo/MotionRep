-- Migration 005: Add reference_video_url to exercises
-- Each cable/pulley exercise can have its own motion-control reference video.
-- When set on an exercise, the pipeline automatically uses Kling 3.0 motion-control
-- for that exercise to drive biomechanically accurate cable movement.
-- When empty, cable exercises fall back to Seedance 1.0 Pro (better cable physics
-- than vanilla Kling 3.0 image-to-video).
-- Set this value per-exercise in the Supabase Dashboard or the Database UI.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS reference_video_url TEXT DEFAULT '';
