import { Router } from 'express';
import { startGeneration, getGenerationStatus } from '../controllers/generateController.js';
import { listExercises, createExercise, deleteExercise } from '../controllers/exercisesController.js';
import { listAngles, createAngle, deleteAngle } from '../controllers/anglesController.js';
import { listGenerations, deleteGeneration } from '../controllers/generationsController.js';
import { getConfig, upsertConfig } from '../controllers/configController.js';
import { supabase } from '../lib/supabase.js';

const router = Router();

// Health check — returns env var status and a live Supabase ping
router.get('/health', async (_req, res) => {
  const { error } = await supabase.from('exercises').select('id').limit(1);
  res.json({
    status: error ? 'degraded' : 'ok',
    supabase_error: error?.message ?? null,
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      KIE_KEY: !!process.env.KIE_KEY,
    },
  });
});

// Generation pipeline
router.post('/generate', startGeneration);
router.get('/generate/:id', getGenerationStatus);

// Exercises
router.get('/exercises', listExercises);
router.post('/exercises', createExercise);
router.delete('/exercises/:id', deleteExercise);

// Camera angles
router.get('/angles', listAngles);
router.post('/angles', createAngle);
router.delete('/angles/:id', deleteAngle);

// Generations history
router.get('/generations', listGenerations);
router.delete('/generations/:id', deleteGeneration);

// Config / Master prompt
router.get('/config', getConfig);
router.post('/config', upsertConfig);

export default router;
