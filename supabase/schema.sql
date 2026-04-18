-- ============================================================
-- MotionREP — COMPLETE Schema (v2)
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Project: mxxbvbrrtdurbqaioilc
-- Safe to re-run (all statements use IF NOT EXISTS)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id         UUID        UNIQUE,
  email           TEXT        NOT NULL UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT        NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'editor', 'viewer', 'user')),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. EXERCISES  (1000+ exercises)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercises (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  name_en             TEXT,
  base_technique      TEXT        NOT NULL DEFAULT '',
  technique_cues      TEXT[]      DEFAULT '{}',
  category            TEXT        NOT NULL DEFAULT 'General',
  muscle_groups       TEXT[]      DEFAULT '{}',
  secondary_muscles   TEXT[]      DEFAULT '{}',
  equipment           TEXT        DEFAULT 'Barra',
  difficulty          TEXT        DEFAULT 'Intermedio'
                        CHECK (difficulty IN ('Principiante', 'Intermedio', 'Avanzado')),
  body_part           TEXT,
  movement_pattern    TEXT,
  is_compound         BOOLEAN     DEFAULT TRUE,
  is_active           BOOLEAN     DEFAULT TRUE,
  notes               TEXT,
  reference_video_url TEXT        DEFAULT '',
  created_by          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_name_fts  ON public.exercises USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_exercises_category  ON public.exercises (category);
CREATE INDEX IF NOT EXISTS idx_exercises_active    ON public.exercises (is_active);

-- ============================================================
-- 3. TAGS  (many-to-many with exercises)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL UNIQUE,
  color TEXT  DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS public.exercise_tags (
  exercise_id  UUID  NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  tag_id       UUID  NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, tag_id)
);

-- ============================================================
-- 4. REFERENCE_MEDIA
--    Images and reference videos per exercise
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reference_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID        REFERENCES public.exercises(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('image', 'video')),
  url           TEXT        NOT NULL,
  storage_path  TEXT,
  source        TEXT        DEFAULT 'upload',
  source_url    TEXT,
  angle         TEXT,
  description   TEXT,
  is_primary    BOOLEAN     DEFAULT FALSE,
  is_approved   BOOLEAN     DEFAULT TRUE,
  width         INT,
  height        INT,
  duration_sec  NUMERIC(6,2),
  uploaded_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_media_exercise ON public.reference_media (exercise_id);
CREATE INDEX IF NOT EXISTS idx_ref_media_type     ON public.reference_media (type);

-- ============================================================
-- 5. CAMERA_ANGLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.camera_angles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  name_en          TEXT,
  prompt_modifier  TEXT        NOT NULL DEFAULT '',
  description      TEXT,
  is_active        BOOLEAN     DEFAULT TRUE,
  sort_order       INT         DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. PROMPT_TEMPLATES  (versioned prompt library)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('master', 'image', 'video', 'claude_system', 'claude_user')),
  content      TEXT        NOT NULL,
  variables    TEXT[]      DEFAULT '{}',
  version      INT         NOT NULL DEFAULT 1,
  is_active    BOOLEAN     DEFAULT FALSE,
  is_default   BOOLEAN     DEFAULT FALSE,
  notes        TEXT,
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompts_type_active ON public.prompt_templates (type, is_active);

-- ============================================================
-- 7. OBSERVATION_PRESETS  (reusable coaching cues)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.observation_presets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  category     TEXT        DEFAULT 'General',
  is_global    BOOLEAN     DEFAULT TRUE,
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. GENERATIONS  (full pipeline: Claude -> Flux -> Kling)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  exercise_id           UUID        REFERENCES public.exercises(id) ON DELETE SET NULL,
  angle_id              UUID        REFERENCES public.camera_angles(id) ON DELETE SET NULL,
  prompt_template_id    UUID        REFERENCES public.prompt_templates(id) ON DELETE SET NULL,

  -- Inputs
  user_observations     TEXT,
  observation_preset_ids UUID[]     DEFAULT '{}',

  -- Claude output
  final_prompt_used     TEXT,
  claude_model          TEXT        DEFAULT 'claude-3-5-sonnet-20241022',
  claude_tokens_used    INT,

  -- Flux output
  image_url             TEXT,
  image_width           INT,
  image_height          INT,
  flux_model            TEXT        DEFAULT 'flux-kontext-max',
  flux_seed             BIGINT,

  -- Kling output
  video_url             TEXT,
  video_duration_sec    NUMERIC(5,1),
  video_aspect_ratio    TEXT        DEFAULT '16:9',
  kling_model           TEXT        DEFAULT 'seedance-1.5-pro',

  -- Pipeline state
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'prompting', 'image_done', 'animating', 'completed', 'failed')),
  error_message         TEXT,
  error_step            TEXT        CHECK (error_step IN ('claude', 'flux', 'kling', NULL)),

  -- Post-generation
  generation_time_sec   NUMERIC(8,2),
  is_favorite           BOOLEAN     DEFAULT FALSE,
  rating                SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  notes                 TEXT,
  is_deleted            BOOLEAN     DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generations_status   ON public.generations (status);
CREATE INDEX IF NOT EXISTS idx_generations_user     ON public.generations (user_id);
CREATE INDEX IF NOT EXISTS idx_generations_exercise ON public.generations (exercise_id);
CREATE INDEX IF NOT EXISTS idx_generations_created  ON public.generations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_favorite ON public.generations (is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_generations_active   ON public.generations (is_deleted) WHERE is_deleted = FALSE;

-- ============================================================
-- 9. GENERATION_FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generation_feedback (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id  UUID        NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  rating         SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  issues         TEXT[],
  timestamp_sec  NUMERIC(5,1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. API_USAGE_LOG  (cost & usage tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id   UUID        REFERENCES public.generations(id) ON DELETE SET NULL,
  user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  provider        TEXT        NOT NULL CHECK (provider IN ('anthropic', 'kei_image', 'kei_video')),
  model           TEXT        NOT NULL,
  input_tokens    INT,
  output_tokens   INT,
  cost_usd        NUMERIC(10,6),
  duration_ms     INT,
  success         BOOLEAN     DEFAULT TRUE,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON public.api_usage_log (provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_created  ON public.api_usage_log (created_at DESC);

-- ============================================================
-- 11. CONFIG  (global key-value settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  value       TEXT        NOT NULL,
  description TEXT,
  is_secret   BOOLEAN     DEFAULT FALSE,
  updated_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','exercises','exercise_tags','tags','reference_media',
    'camera_angles','prompt_templates','observation_presets',
    'generations','generation_feedback','api_usage_log','config'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Public read (exercises, angles, tags, presets)
DO $$ BEGIN CREATE POLICY "anon_read_exercises"    ON public.exercises         FOR SELECT USING (is_active = TRUE);  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_read_angles"       ON public.camera_angles     FOR SELECT USING (is_active = TRUE);  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_read_tags"         ON public.tags              FOR SELECT USING (TRUE);              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_read_ref_media"    ON public.reference_media   FOR SELECT USING (is_approved = TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_read_obs_presets"  ON public.observation_presets FOR SELECT USING (is_global = TRUE); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role full access (backend uses service_role key which bypasses RLS)
DO $$ BEGIN CREATE POLICY "service_all_generations"    ON public.generations         USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_config"         ON public.config              USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_users"          ON public.users               USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_exercises"    ON public.exercises           FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_angles"       ON public.camera_angles       FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_prompts"        ON public.prompt_templates    USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_feedback"       ON public.generation_feedback USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_api_log"        ON public.api_usage_log       USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_ref_media"      ON public.reference_media     FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_obs_presets"    ON public.observation_presets FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_tags"           ON public.tags                FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_all_exercise_tags"  ON public.exercise_tags       FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO public.camera_angles (name, name_en, prompt_modifier, sort_order) VALUES
  ('Frontal',     'Front view',    'shot from a straight frontal angle, camera facing the subject directly',           1),
  ('Lateral 90°', 'Side profile', 'shot from a strict 90-degree side profile, full lateral view',                  2),
  ('Posterior',   'Rear view',    'shot from directly behind the athlete, showing back muscles and posterior chain',  3)
ON CONFLICT DO NOTHING;

INSERT INTO public.prompt_templates (name, type, content, variables, is_active, is_default, version) VALUES
  ('Prompt Maestro v1', 'master',
   'You are an expert fitness photographer and biomechanics specialist. Generate a hyper-realistic, 8k resolution, cinematic shot of a fitness model performing {{ejercicio}}. Camera angle: {{angulo}}. Lighting: Dramatic studio lighting, rim light on muscles. Subject: Athletic build, wearing minimal dark athletic wear to clearly show muscle engagement. Background: Dark, minimalist gym environment, slightly blurred (bokeh). Technical details: Perfect form, maximum muscle tension visible. Additional notes: {{observaciones}}',
   ARRAY['{{ejercicio}}','{{angulo}}','{{observaciones}}'], TRUE, TRUE, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.config (key, value, description) VALUES
  ('master_prompt', 'You are an expert fitness photographer and biomechanics specialist. Generate a hyper-realistic, 8k resolution, cinematic shot of a fitness model performing {{ejercicio}}. Camera angle: {{angulo}}. Lighting: Dramatic studio lighting, rim light on muscles. Subject: Athletic build, wearing minimal dark athletic wear to clearly show muscle engagement. Background: Dark, minimalist gym environment, slightly blurred (bokeh). Technical details: Perfect form, maximum muscle tension visible. Additional notes: {{observaciones}}', 'Prompt base usado por Claude para ensamblar el prompt final de Flux'),
  ('default_video_duration', '5',    'Duración en segundos del vídeo generado con Kling'),
  ('default_aspect_ratio',   '16:9', 'Relación de aspecto por defecto'),
  ('max_daily_generations',  '50',   'Límite de generaciones por usuario por día'),
  ('flux_model',   'flux-kontext-max',                       'Modelo Flux activo'),
  ('kling_model',  'seedance-1.5-pro', 'Modelo Kling activo'),
  ('claude_model', 'claude-3-5-sonnet-20241022',                  'Modelo Claude activo'),
  ('reference_model_image_url', 'https://kmdqecykrvwloggbjjli.supabase.co/storage/v1/object/public/reference-images/bodybuilder-posing-gym-young-athlete-man-beautiful-body-69792530.webp', 'URL pública de la foto del modelo de referencia en Supabase Storage. Usada por Flux Kontext (flux1-kontext) para mantener consistencia facial en todas las generaciones.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.tags (name, color) VALUES
  ('Olímpico',      '#f59e0b'),
  ('Cardio',         '#ef4444'),
  ('Funcional',      '#8b5cf6'),
  ('Rehabilitación', '#06b6d4'),
  ('Fuerza máxima',  '#dc2626'),
  ('Hipertrofia',    '#16a34a'),
  ('Movilidad',      '#0284c7'),
  ('Core',           '#d97706')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.observation_presets (title, content, category) VALUES
  ('Espalda neutra',          'Keep the spine in a strict neutral position. No rounding of the lower back, no hyperextension.',               'Técnica'),
  ('Codos fijos',             'Pin the elbows tightly to the sides of the torso. Do not let them flare forward or drift backward.',          'Técnica'),
  ('Descenso controlado',     'Lower the weight with a slow, controlled 3-second eccentric phase. No dropping.',                            'Ritmo'),
  ('Rodillas sobre puntas',   'Knees must track directly over the toes throughout the movement. No valgus collapse.',                       'Técnica'),
  ('Contracción en pico',  'Hold the peak contraction for 1 full second before lowering. Maximum muscle squeeze.',                       'Técnica'),
  ('Sin rebote',              'Touch and go only no bouncing at the bottom. Controlled reversal of motion.',                                'Técnica'),
  ('Respiración correcta', 'Exhale on the concentric phase, inhale on the eccentric. Do not hold the breath.',                          'Técnica'),
  ('Estética muscular',    'Emphasize visible muscle belly separation and striations. High definition lighting on active muscle groups.',  'Estética'),
  ('Adaptación lesión', 'Reduced range of motion due to joint protection. Avoid full extension/flexion at the painful joint.',        'Lesión'),
  ('Full ROM',                'Complete full range of motion on every repetition. No partial reps.',                                         'Técnica')
ON CONFLICT DO NOTHING;

INSERT INTO public.exercises (name, name_en, base_technique, category, muscle_groups, secondary_muscles, equipment, difficulty, body_part, movement_pattern, is_compound) VALUES
  ('Curl de Bíceps con Barra', 'Barbell Bicep Curl', 'Stand upright with feet shoulder-width apart, grip the barbell with an underhand supinated grip at shoulder-width. Keep elbows pinned to the sides of the torso throughout the movement. Curl the bar upward in a controlled arc, contracting the biceps at the top. Hold for 1 second at peak contraction, then slowly lower back to full extension. Do not swing the torso or use momentum.', 'Brazos', ARRAY['biceps_brachii','brachialis'], ARRAY['brachioradialis','forearm_flexors'], 'Barra', 'Principiante', 'Upper', 'Pull', FALSE),
  ('Sentadilla con Barra Libre', 'Barbell Back Squat', 'Position the barbell on the upper traps (high bar) or rear delts (low bar). Feet slightly wider than shoulder-width, toes out 15-30 degrees. Brace the core and initiate the descent by breaking at hips and knees simultaneously. Descend until thighs are parallel or below. Drive through the full foot to rise, keeping chest tall and knees tracking over toes.', 'Piernas', ARRAY['quadriceps','gluteus_maximus'], ARRAY['hamstrings','adductors','spinal_erectors'], 'Barra', 'Avanzado', 'Lower', 'Squat', TRUE),
  ('Press de Banca Plano', 'Flat Barbell Bench Press', 'Lie flat on the bench with eyes under the bar. Grip slightly wider than shoulder-width. Retract and depress shoulder blades into bench. Lower the bar in a controlled path to the lower chest. Touch lightly without bouncing, then press back up in a slight arc.', 'Pecho', ARRAY['pectoralis_major','triceps_brachii'], ARRAY['anterior_deltoid','serratus_anterior'], 'Barra', 'Intermedio', 'Upper', 'Push', TRUE),
  ('Peso Muerto Convencional', 'Conventional Deadlift', 'Stand with feet hip-width apart, bar over mid-foot. Grip just outside the legs. Back flat, chest up, lats engaged. Drive the floor away with legs while extending hips. Keep the bar in contact with legs throughout the pull. Lock out hips and knees simultaneously at the top.', 'Espalda', ARRAY['erector_spinae','gluteus_maximus','hamstrings'], ARRAY['trapezius','latissimus_dorsi','quadriceps','forearms'], 'Barra', 'Avanzado', 'Full Body', 'Hinge', TRUE),
  ('Dominadas Pronadas', 'Pronated Pull-ups', 'Hang from the bar with a pronated grip, hands slightly wider than shoulder-width. Start from a full dead hang. Initiate by driving elbows down and back. Pull until chin clears the bar. Lower under complete control back to dead hang.', 'Espalda', ARRAY['latissimus_dorsi','biceps_brachii'], ARRAY['rhomboids','rear_deltoids','teres_major'], 'Peso corporal', 'Intermedio', 'Upper', 'Pull', TRUE),
  ('Press Militar con Barra', 'Barbell Overhead Press', 'Unrack the barbell at shoulder height, narrow grip just outside shoulders. Brace the core. Press the bar overhead in a vertical path. Lock out fully at the top with ears between biceps. Lower under control.', 'Hombros', ARRAY['anterior_deltoid','medial_deltoid','triceps_brachii'], ARRAY['upper_trapezius','serratus_anterior','core'], 'Barra', 'Intermedio', 'Upper', 'Push', TRUE),
  ('Remo con Barra Inclinado', 'Bent-Over Barbell Row', 'Hinge at the hips to a 45-degree torso angle. Overhand grip slightly wider than shoulder-width. Retract shoulder blades and pull bar toward lower sternum. Lead with elbows, drive them past the torso. Squeeze rhomboids and lats at the top.', 'Espalda', ARRAY['latissimus_dorsi','rhomboids','middle_trapezius'], ARRAY['biceps_brachii','rear_deltoids','spinal_erectors'], 'Barra', 'Intermedio', 'Upper', 'Pull', TRUE),
  ('Hip Thrust con Barra', 'Barbell Hip Thrust', 'Upper back against a bench, barbell across hips with a pad. Feet flat hip-width apart. Drive through heels, extending hips until torso is parallel to the floor. Squeeze glutes hard at top. Chin tucked. Lower under control.', 'Piernas', ARRAY['gluteus_maximus','gluteus_medius'], ARRAY['hamstrings','quadriceps','core'], 'Barra', 'Principiante', 'Lower', 'Hinge', FALSE),
  ('Fondos en Paralelas', 'Parallel Bar Dips', 'Grip parallel bars, arms locked at top. Lean slightly forward for chest focus. Lower body by bending elbows to 90-degrees or below. Drive back up to full extension. Full control throughout.', 'Pecho', ARRAY['pectoralis_major','triceps_brachii'], ARRAY['anterior_deltoid','coracobrachialis'], 'Peso corporal', 'Intermedio', 'Upper', 'Push', TRUE),
  ('Zancada con Mancuernas', 'Dumbbell Lunges', 'Stand holding dumbbells at sides. Step forward with one leg and lower the body until both knees are at 90 degrees. Front knee tracks over toes, rear knee hovers above the floor. Drive through the front foot to return.', 'Piernas', ARRAY['quadriceps','gluteus_maximus'], ARRAY['hamstrings','adductors','calves','core'], 'Mancuernas', 'Principiante', 'Lower', 'Squat', TRUE)
ON CONFLICT DO NOTHING;
