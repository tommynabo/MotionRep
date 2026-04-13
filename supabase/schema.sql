-- ============================================================
-- MotionREP — Full Schema Migration
-- Run this in: Supabase Dashboard > SQL Editor
-- Project: mxxbvbrrtdurbqaioilc
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. EXERCISES  (capacity for 1000+ entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercises (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  base_technique  TEXT        NOT NULL DEFAULT '',
  category        TEXT        NOT NULL DEFAULT 'General',
  muscle_groups   TEXT[]      DEFAULT '{}',   -- e.g. ['biceps', 'forearms']
  equipment       TEXT        DEFAULT 'Barra', -- Mancuernas, Máquina, Peso corporal...
  difficulty      TEXT        DEFAULT 'Intermedio' CHECK (difficulty IN ('Principiante', 'Intermedio', 'Avanzado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_name     ON public.exercises USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_exercises_category ON public.exercises (category);

-- ============================================================
-- 3. CAMERA ANGLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.camera_angles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  prompt_modifier  TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. GENERATIONS  (pipeline tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  exercise_id         UUID        REFERENCES public.exercises(id) ON DELETE SET NULL,
  angle_id            UUID        REFERENCES public.camera_angles(id) ON DELETE SET NULL,
  user_observations   TEXT,
  final_prompt_used   TEXT,
  image_url           TEXT,
  video_url           TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'image_done', 'completed', 'failed')),
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_status     ON public.generations (status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations (created_at DESC);

-- ============================================================
-- 5. CONFIG  (master prompt & global settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  value       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_angles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config       ENABLE ROW LEVEL SECURITY;

-- Public read for reference data (exercises & angles)
DO $$ BEGIN
  CREATE POLICY "Public read exercises"  ON public.exercises    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read angles"     ON public.camera_angles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Full access for service_role (backend bypasses RLS with service key)
DO $$ BEGIN
  CREATE POLICY "Service access generations" ON public.generations USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service access config"      ON public.config      USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service access users"       ON public.users       USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service write exercises"    ON public.exercises   FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service write angles"       ON public.camera_angles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Camera angles
INSERT INTO public.camera_angles (name, prompt_modifier) VALUES
  ('Frontal',     'shot from a straight frontal angle, camera facing the subject directly'),
  ('Perfil 45°',  'shot from a 45-degree diagonal side angle, showing depth and form'),
  ('Lateral 90°', 'shot from a strict 90-degree side profile, full lateral view'),
  ('Cenital',     'overhead top-down shot from directly above the subject')
ON CONFLICT DO NOTHING;

-- Master prompt
INSERT INTO public.config (key, value) VALUES
  ('master_prompt',
   'You are an expert fitness photographer and biomechanics specialist. Generate a hyper-realistic, 8k resolution, cinematic shot of a fitness model performing {{ejercicio}}. Camera angle: {{angulo}}. Lighting: Dramatic studio lighting, rim light on muscles. Subject: Athletic build, wearing minimal dark athletic wear to clearly show muscle engagement. Background: Dark, minimalist gym environment, slightly blurred (bokeh). Technical details: Perfect form, maximum muscle tension visible. Additional notes: {{observaciones}}')
ON CONFLICT (key) DO NOTHING;

-- Sample exercises
INSERT INTO public.exercises (name, base_technique, category, muscle_groups, equipment, difficulty) VALUES
  ('Curl de Bíceps con Barra',
   'Stand upright with feet shoulder-width apart, grip the barbell with an underhand grip (supinated) at shoulder-width. Keep elbows pinned to the sides of the torso throughout the movement. Inhale and curl the bar upward in a controlled arc, contracting the biceps at the top. Hold for 1 second at peak contraction, then slowly lower the bar back to full extension. Do not swing the torso or use momentum. Maintain neutral wrist position throughout.',
   'Brazos', ARRAY['biceps','antebrazos'], 'Barra', 'Principiante'),

  ('Sentadilla con Barra Libre',
   'Position the barbell on the upper traps (high bar) or rear delts (low bar). Stand with feet slightly wider than shoulder-width, toes pointing out 15-30 degrees. Create full-body tension: take a deep breath, brace the core, and initiate the descent by breaking at the hips and knees simultaneously. Descend until thighs are parallel or below parallel to the floor. Drive through the full foot to rise, keeping the chest tall and knees tracking over the toes. Never let the lower back round.',
   'Piernas', ARRAY['cuadriceps','gluteos','isquiotibiales'], 'Barra', 'Avanzado'),

  ('Press de Banca Plano',
   'Lie flat on the bench with eyes under the bar. Grip the bar slightly wider than shoulder-width. Retract and depress the shoulder blades into the bench, creating an arch in the lower back. Unrack the bar and lower it in a controlled path to the lower chest (nipple line). Touch the chest lightly without bouncing, then press the bar back up in a slight arc toward the lower rack hooks. Maintain leg drive throughout with feet flat on the floor.',
   'Pecho', ARRAY['pectoral','triceps','hombros'], 'Barra', 'Intermedio'),

  ('Peso Muerto Convencional',
   'Stand with feet hip-width apart, bar over mid-foot. Grip the bar just outside the legs (double overhand or mixed grip). Hinge at the hips and bend the knees to lower into position: back flat, chest up, lats engaged (imagine bending the bar around your legs). Drive the floor away with your legs while simultaneously extending the hips. Keep the bar in contact with the legs throughout the pull. Lock out hips and knees simultaneously at the top. Do not hyperextend the lower back at lockout.',
   'Espalda', ARRAY['isquiotibiales','gluteos','espalda_baja','trapecio'], 'Barra', 'Avanzado'),

  ('Dominadas Pronadas',
   'Hang from the pull-up bar with a pronated (overhand) grip, hands slightly wider than shoulder-width. Start from a full dead hang with shoulders packed (depress and retract scapulae). Initiate the pull by driving the elbows down and back, engaging the lats. Pull until the chin clears the bar or the chest touches the bar for a full range of motion. Lower under complete control back to the dead hang.',
   'Espalda', ARRAY['dorsales','biceps','romboides'], 'Peso corporal', 'Intermedio'),

  ('Press Militar con Mancuernas',
   'Sit on a bench with back support or stand with feet shoulder-width apart. Hold dumbbells at shoulder height with a neutral or pronated grip, elbows at 90 degrees. Brace the core and press the dumbbells overhead in a controlled arc until arms are fully extended. Lower the dumbbells back to shoulder height in a controlled manner. Do not arch the lower back excessively; maintain a neutral spine throughout.',
   'Hombros', ARRAY['deltoides','triceps','trapecio'], 'Mancuernas', 'Intermedio'),

  ('Remo con Barra Inclinado',
   'Stand with feet shoulder-width apart, hinge at the hips to a 45-degree torso angle. Grip the barbell with an overhand grip slightly wider than shoulder-width. Retract the shoulder blades and pull the bar toward the lower sternum/upper abdomen. Lead with the elbows and drive them past the torso. Squeeze the rhomboids and lats at the top. Lower the bar under control without letting the lower back round or the torso rise significantly.',
   'Espalda', ARRAY['dorsales','romboides','biceps','trapecio'], 'Barra', 'Intermedio'),

  ('Hip Thrust con Barra',
   'Sit on the floor with your upper back against a bench, barbell across your hips (use a pad). Plant feet flat, hip-width apart, toes slightly out. Drive through your heels, extending your hips upward until your torso is parallel to the floor. Squeeze your glutes hard at the top, keeping your chin tucked. Do not hyperextend the lower back. Lower the hips under control and repeat.',
   'Piernas', ARRAY['gluteos','isquiotibiales'], 'Barra', 'Intermedio'),

  ('Fondos en Paralelas',
   'Grip the parallel bars and push yourself up to full arm extension, arms locked. Lean slightly forward (chest dip) to emphasize chest, or stay upright for triceps. Lower your body by bending the elbows to 90 degrees or below. Keep elbows close to the body for triceps, slightly flared for chest. Drive back up to full extension. Avoid swinging; full control throughout.',
   'Pecho', ARRAY['pectoral','triceps','deltoides_anterior'], 'Peso corporal', 'Intermedio'),

  ('Face Pull con Polea',
   'Set a cable pulley at upper-chest to face height with a rope attachment. Stand facing the machine, arms extended. Pull the rope toward your face, separating your hands at the end range so the rope ends go past your ears. Drive your elbows back and high, externally rotating your shoulders. Squeeze the rear delts and rhomboids at peak contraction. Return under control.',
   'Hombros', ARRAY['deltoides_posterior','romboides','manguito_rotador'], 'Máquina', 'Principiante')
ON CONFLICT DO NOTHING;
