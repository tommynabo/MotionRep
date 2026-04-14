-- Migration: Jeff Nippard Clinical Standard — camera angle prompt_modifier updates
-- Run this in the Supabase SQL editor or via `supabase db push`.

UPDATE public.camera_angles
SET prompt_modifier = 'ABSOLUTELY PERFECT DIRECT FRONT-FACING SHOT. 0 degree deviation. Perfect bilateral symmetry. Camera placed at subject eye-level, dead centre, no tilt, no rotation.'
WHERE name = 'Frontal';

UPDATE public.camera_angles
SET prompt_modifier = 'PRECISE 45-DEGREE DIAGONAL FRONT ANGLE. Camera at exact 45-degree rotation from the frontal axis. Subject visible from a diagonal perspective showing both depth and frontal muscle definition simultaneously.'
WHERE name = 'Perfil 45°';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT 90-DEGREE SIDE PROFILE SHOT. Exact perpendicular angle. Camera aligned to the absolute lateral plane of the subject. Full side silhouette visible with zero frontal or rear deviation.'
WHERE name = 'Lateral 90°';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT TOP-DOWN OVERHEAD SHOT. Camera directly above the subject, perpendicular to the floor. Exact bird''s-eye view, zero lateral tilt, capturing the full symmetrical layout of the exercise from above.'
WHERE name = 'Cenital';

UPDATE public.camera_angles
SET prompt_modifier = 'PRECISE LOW GROUND-LEVEL ANGLE SHOT. Camera positioned near floor level, angled upward toward the subject. Dramatic upward perspective emphasising height, drive, and full muscle extension from below.'
WHERE name = 'Low Angle';

UPDATE public.camera_angles
SET prompt_modifier = 'PERFECT REAR 180-DEGREE SHOT. Camera directly behind the subject, 0 degree deviation from the posterior axis. Full posterior chain visible — back muscles, glutes, hamstrings — with perfect bilateral symmetry.'
WHERE name = 'Posterior';
