-- ============================================================
-- Migration 007: Keep only essential camera angles
-- Issue: schema.sql had 6 angles but only 3 are needed
-- Solution: Delete Cenital, Low Angle, and Perfil 45°
--           Keep only: Frontal, Posterior, Lateral 90°
-- ============================================================

DELETE FROM public.camera_angles
WHERE name IN ('Cenital', 'Low Angle', 'Perfil 45°');

-- Verify result (should show exactly 3 angles)
-- SELECT name, name_en FROM public.camera_angles ORDER BY sort_order;
