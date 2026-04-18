import { Router, Request, Response } from 'express';
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

// MuscleWiki video proxy — streams authenticated MuscleWiki videos as public URLs for KIE
router.get('/video-proxy/:filename', async (req: Request, res: Response): Promise<void> => {
  const { filename } = req.params;
  // Security: only allow safe .mp4 filenames matching MuscleWiki naming pattern
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_.]*\.mp4$/.test(filename)) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const apiKey = process.env.MUSCLEWIKI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'MUSCLEWIKI_API_KEY not configured' });
    return;
  }
  const upstream = await fetch(
    `https://api.musclewiki.com/stream/videos/branded/${filename}`,
    { headers: { 'X-API-Key': apiKey } },
  );
  if (!upstream.ok) {
    res.status(502).json({ error: `MuscleWiki returned ${upstream.status}` });
    return;
  }
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'video/mp4');
  const cl = upstream.headers.get('content-length');
  if (cl) res.setHeader('Content-Length', cl);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const { Readable } = await import('node:stream');
  Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
});

export default router;
