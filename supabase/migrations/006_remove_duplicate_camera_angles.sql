-- ============================================================
-- Migration 006: Remove duplicate camera angles
-- Issue: Camera angles were duplicated when schema.sql was run
-- Solution: Keep only the first occurrence of each angle by name
-- ============================================================

-- Delete duplicate camera angles, keeping only the first one (lowest id) for each name
DELETE FROM public.camera_angles
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.camera_angles
  GROUP BY name
);

-- Verify the result (should show 6 unique angles)
-- SELECT name, COUNT(*) as count FROM public.camera_angles GROUP BY name;
