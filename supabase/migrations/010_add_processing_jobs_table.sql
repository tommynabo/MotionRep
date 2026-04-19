-- Migration 010: Add processing_jobs table for async video processing tracking
-- Tracks the status of Lambda video processing jobs
-- Used for webhook updates and job status polling

CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id     UUID        NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  youtube_url     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_exercise ON public.processing_jobs (exercise_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.processing_jobs (status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created ON public.processing_jobs (created_at DESC);

COMMENT ON TABLE public.processing_jobs IS 'Tracks async video processing jobs queued to AWS Lambda';
COMMENT ON COLUMN public.processing_jobs.status IS 'Job status: pending (queued), processing (in progress), completed (done), failed (error)';
COMMENT ON COLUMN public.processing_jobs.result IS 'Lambda response with video URL and timing data';
