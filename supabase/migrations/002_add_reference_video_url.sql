-- Migration 002: Add reference_video_url to config
-- This URL points to the motion-control reference video used by Kling 3.0 motion-control.
-- When set, the pipeline uses kling-3.0/motion-control instead of kling-2.6/image-to-video.
-- When empty, the pipeline falls back to kling-2.6/image-to-video.
-- Update this value in the Supabase Dashboard or via the Configuration UI
-- after uploading your reference video to KIE File Upload API or Supabase Storage.

INSERT INTO public.config (key, value, description)
VALUES (
  'reference_video_url',
  '',
  'URL of the motion-control reference video (MP4, 3-30s, max 100MB). When set, the video pipeline uses kling-3.0/motion-control to apply the reference movement to the generated athlete image. Leave empty to fall back to kling-2.6/image-to-video.'
)
ON CONFLICT (key) DO NOTHING;
