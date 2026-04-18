-- ============================================================
-- Migration 006: Remove duplicate camera angles
-- Issue: Camera angles were duplicated when schema.sql was run
-- Solution: Keep only the first occurrence of each angle by name
-- ============================================================

-- Delete duplicate camera angles using DISTINCT ON (PostgreSQL feature)
-- This keeps only the first row for each unique name (by creation order)
DELETE FROM public.camera_angles ca1
WHERE ca1.id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.camera_angles
  ORDER BY name, created_at ASC
);

-- Verify the result (should show 6 unique angles, each with count=1)
-- SELECT name, COUNT(*) as count FROM public.camera_angles GROUP BY name ORDER BY name;
