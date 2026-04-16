-- Migration 003: Add kie_video_task_id to generations
-- Enables decoupled Kling polling: the pipeline stores the KIE task ID and returns immediately.
-- The GET /api/generate/:id endpoint checks KIE in-band on every poll and promotes the status.

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS kie_video_task_id TEXT;
