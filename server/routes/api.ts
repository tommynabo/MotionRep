import { Router } from 'express';
import { startGeneration, getGenerationStatus } from '../controllers/generateController.js';
import { listExercises, createExercise, deleteExercise } from '../controllers/exercisesController.js';
import { listAngles, createAngle, deleteAngle } from '../controllers/anglesController.js';
import { listGenerations, deleteGeneration } from '../controllers/generationsController.js';
import { getConfig, upsertConfig } from '../controllers/configController.js';

const router = Router();

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
