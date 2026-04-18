import { Request, Response } from 'express';
import { waitUntil } from '@vercel/functions';
import { supabase } from '../lib/supabase.js';
import { buildDualPrompts } from '../services/claude.js';
import { generateImageFromReference, refineImageWithLogoAndBackground, startSeedance2MotionTask, checkKlingTask } from '../services/kie.js';
import { getDirectMp4Url } from '../services/videoExtractor.js';

export async function startGeneration(req: Request, res: Response): Promise<void> {
  const { exercise_id, angle_id, user_observations } = req.body as {
    exercise_id: string;
    angle_id: string;
    user_observations?: string;
  };

  if (!exercise_id || !angle_id) {
    res.status(400).json({ error: 'exercise_id and angle_id are required' });
    return;
  }

  // Reference model image — Cloudinary URL of the athlete reference photo
  const REFERENCE_MODEL_IMAGE_URL =
    'https://res.cloudinary.com/dq9mlk8x3/image/upload/v1776327685/20206424-handsome-young-muscular-sports-man-on-gray-background_ahrecm.jpg';

  // Fetch exercise, angle, master prompt and shorts logo
  const [exerciseResult, angleResult, masterPromptResult, shortsLogoResult, shortsLogoDescResult] = await Promise.all([
    supabase.from('exercises').select('name, base_technique, equipment, muscle_groups, movement_pattern, technique_cues, reference_video_url').eq('id', exercise_id).single(),
    supabase.from('camera_angles').select('name, prompt_modifier').eq('id', angle_id).single(),
    supabase.from('config').select('value').eq('key', 'master_prompt').single(),
    supabase.from('config').select('value').eq('key', 'shorts_logo_url').single(),
    supabase.from('config').select('value').eq('key', 'shorts_logo_description').single(),
  ]);

  if (exerciseResult.error || !exerciseResult.data) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  if (angleResult.error || !angleResult.data) {
    res.status(404).json({ error: 'Camera angle not found' });
    return;
  }

  const exercise = exerciseResult.data;
  const angle = angleResult.data;
  const masterPrompt = masterPromptResult.data?.value ?? '';
  // Derive a public URL for the logo from APP_URL if not set in config.
  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
  const shortsLogoUrl = shortsLogoResult.data?.value || (appUrl ? `${appUrl}/logoempresa.png` : '');
  const shortsLogoDescription =
    shortsLogoDescResult.data?.value ||
    "a white three-dimensional isometric letter 'S' with bold geometric angular facets, constructed from stepped cubic planes in an isometric perspective — the official Symmetry brand logo printed on the fabric";
  const referenceImageUrl = REFERENCE_MODEL_IMAGE_URL;

  // Create the generation record with status 'pending'
  const { data: generation, error: insertError } = await supabase
    .from('generations')
    .insert({
      exercise_id,
      angle_id,
      user_observations: user_observations ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !generation) {
    res.status(500).json({ error: 'Failed to create generation record' });
    return;
  }

  const generationId = generation.id;

  // Respond immediately so the frontend can start polling
  res.status(202).json({ generation_id: generationId, status: 'pending' });

  // waitUntil keeps the serverless function alive until the pipeline finishes,
  // even after the HTTP response has been sent (required for Vercel serverless).
  waitUntil(
    runPipeline({
      generationId,
      exercise,
      angle,
      userObservations: user_observations ?? '',
      masterPrompt,
      shortsLogoUrl,
      shortsLogoDescription,
      referenceImageUrl,
    }).catch((err) => {
      console.error(`[Pipeline] Unhandled error for generation ${generationId}:`, err);
    }),
  );
}

async function runPipeline(params: {
  generationId: string;
  exercise: { name: string; base_technique: string; equipment: string | null; muscle_groups: string[] | null; movement_pattern: string | null; technique_cues: string[] | null; reference_video_url: string | null };
  angle: { name: string; prompt_modifier: string };
  userObservations: string;
  masterPrompt: string;
  shortsLogoUrl: string;
  shortsLogoDescription: string;
  referenceImageUrl: string;
}): Promise<void> {
  const { generationId, exercise, angle, userObservations, masterPrompt, shortsLogoUrl, shortsLogoDescription, referenceImageUrl } = params;

  try {
    // Guard: exercise must have an approved reference video before the pipeline can run.
    if (!exercise.reference_video_url?.trim()) {
      throw new Error(
        `Exercise "${exercise.name}" has no approved reference video. ` +
        `Use POST /api/exercises/:id/search-candidates to find CC-BY candidates, ` +
        `then PUT /api/exercises/:id/approve-video to approve one before generating.`,
      );
    }
    // STEP A: Build dual JSON prompts with Claude
    console.log(`[Pipeline ${generationId}] Step A: Building dual prompts with Claude...`);
    await supabase.from('generations').update({ status: 'prompting' }).eq('id', generationId);

    const { imagePrompt, videoPrompt } = await buildDualPrompts({
      exerciseName: exercise.name,
      baseTechnique: exercise.base_technique,
      equipment: exercise.equipment ?? 'Barra',
      muscleGroups: exercise.muscle_groups ?? [],
      movementPattern: exercise.movement_pattern ?? '',
      techniqueCues: exercise.technique_cues ?? [],
      cameraAngle: angle.name,
      cameraModifier: angle.prompt_modifier,
      userObservations,
      shortsLogoUrl,
      shortsLogoDescription,
      masterPromptTemplate: masterPrompt,
    });

    // Store the full dual-prompt JSON for auditability
    await supabase
      .from('generations')
      .update({ final_prompt_used: JSON.stringify({ image: imagePrompt, video: videoPrompt }) })
      .eq('id', generationId);

    // STEP B: Generate image with Flux Kontext Max (image-to-image with reference athlete)
    console.log(`[Pipeline ${generationId}] Step B: Generating image with Flux Kontext...`);
    await supabase.from('generations').update({ status: 'generating_image' }).eq('id', generationId);
    const imageUrl = await generateImageFromReference(imagePrompt, referenceImageUrl);

    await supabase
      .from('generations')
      .update({ image_url: imageUrl, status: 'image_done' })
      .eq('id', generationId);

    // STEP B2: Refinement pass — enforce pure white background + composite Symmetry S logo.
    // Uses the first-pass image as input and returns a cleaned, logo-stamped image.
    console.log(`[Pipeline ${generationId}] Step B2: Refining image (white bg + logo)...`);
    const logoDescription = shortsLogoDescription || 'a white 3D geometric isometric letter S with bold angular faceted planes on the outer left thigh';
    const refinedImageUrl = await refineImageWithLogoAndBackground(imageUrl, logoDescription);
    await supabase
      .from('generations')
      .update({ image_url: refinedImageUrl })
      .eq('id', generationId);

    // STEP C: Resolve direct MP4 URL from the approved CC-BY YouTube reference video.
    console.log(`[Pipeline ${generationId}] Step C: Resolving direct MP4 from reference video...`);
    const directMp4Url = await getDirectMp4Url(exercise.reference_video_url);

    // STEP D: Start Kling 3.0 motion-control task (non-blocking).
    // Passes the refined Flux image (subject + white studio background) and the direct MP4
    // (biomechanical reference). background_source: 'input_image' preserves the white backdrop.
    console.log(`[Pipeline ${generationId}] Step D: Launching Kling 3.0 motion-control task (non-blocking)...`);
    const seedanceTaskId = await startSeedance2MotionTask(refinedImageUrl, directMp4Url, videoPrompt);
    await supabase
      .from('generations')
      .update({ status: 'animating', kie_video_task_id: seedanceTaskId })
      .eq('id', generationId);
    console.log(`[Pipeline ${generationId}] Kling 3.0 motion-control task launched: ${seedanceTaskId}. Polling deferred to status endpoint.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Pipeline ${generationId}] Failed:`, message);
    await supabase
      .from('generations')
      .update({ status: 'failed', error_message: message })
      .eq('id', generationId);
  }
}

export async function getGenerationStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('generations')
    .select('id, status, image_url, video_url, error_message, final_prompt_used, created_at, kie_video_task_id')
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Generation not found' });
    return;
  }

  // Inline status promotion: if animating and we have a KIE task ID, check it now.
  // This makes the status endpoint self-healing — no background worker needed.
  if (data.status === 'animating' && data.kie_video_task_id) {
    const check = await checkKlingTask(data.kie_video_task_id).catch(() => ({ state: 'pending' as const }));

    if (check.state === 'success') {
      await supabase
        .from('generations')
        .update({ video_url: check.url, status: 'completed', kie_video_task_id: null })
        .eq('id', id);
      res.json({ ...data, video_url: check.url, status: 'completed', kie_video_task_id: null });
      return;
    }

    if (check.state === 'fail') {
      await supabase
        .from('generations')
        .update({ status: 'failed', error_message: check.error, kie_video_task_id: null })
        .eq('id', id);
      res.json({ ...data, status: 'failed', error_message: check.error, kie_video_task_id: null });
      return;
    }
    // state === 'pending' → return current data, client will poll again in 4 seconds
  }

  // Strip internal field from client response
  const { kie_video_task_id: _internal, ...clientData } = data;
  res.json(clientData);
}
