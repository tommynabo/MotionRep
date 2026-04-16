import { Request, Response } from 'express';
import { waitUntil } from '@vercel/functions';
import { supabase } from '../lib/supabase.js';
import { buildDualPrompts } from '../services/claude.js';
import { generateImageFromReference, generateVideo } from '../services/kie.js';

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

  // Fetch exercise, angle, master prompt, and shorts logo from Supabase
  const [exerciseResult, angleResult, masterPromptResult, shortsLogoResult] = await Promise.all([
    supabase.from('exercises').select('name, base_technique, equipment, muscle_groups, movement_pattern, technique_cues').eq('id', exercise_id).single(),
    supabase.from('camera_angles').select('name, prompt_modifier').eq('id', angle_id).single(),
    supabase.from('config').select('value').eq('key', 'master_prompt').single(),
    supabase.from('config').select('value').eq('key', 'shorts_logo_url').single(),
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
  const shortsLogoUrl = shortsLogoResult.data?.value ?? '';
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
      referenceImageUrl,
    }).catch((err) => {
      console.error(`[Pipeline] Unhandled error for generation ${generationId}:`, err);
    }),
  );
}

async function runPipeline(params: {
  generationId: string;
  exercise: { name: string; base_technique: string; equipment: string | null; muscle_groups: string[] | null; movement_pattern: string | null; technique_cues: string[] | null };
  angle: { name: string; prompt_modifier: string };
  userObservations: string;
  masterPrompt: string;
  shortsLogoUrl: string;
  referenceImageUrl: string;
}): Promise<void> {
  const { generationId, exercise, angle, userObservations, masterPrompt, shortsLogoUrl, referenceImageUrl } = params;

  try {
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
      masterPromptTemplate: masterPrompt,
    });

    // Store the full dual-prompt JSON for auditability
    await supabase
      .from('generations')
      .update({ final_prompt_used: JSON.stringify({ image: imagePrompt, video: videoPrompt }) })
      .eq('id', generationId);

    // STEP B: Generate image with Flux 1 Kontext (txt2img + identity reference)
    console.log(`[Pipeline ${generationId}] Step B: Generating image with Flux 1 Kontext...`);
    await supabase.from('generations').update({ status: 'generating_image' }).eq('id', generationId);
    const imageUrl = await generateImageFromReference(imagePrompt, referenceImageUrl);

    await supabase
      .from('generations')
      .update({ image_url: imageUrl, status: 'image_done' })
      .eq('id', generationId);

    // STEP C: Generate video with Kling 2.6
    console.log(`[Pipeline ${generationId}] Step C: Generating video with Kling 2.6...`);
    await supabase.from('generations').update({ status: 'animating' }).eq('id', generationId);
    const videoUrl = await generateVideo(imageUrl, videoPrompt);

    await supabase
      .from('generations')
      .update({ video_url: videoUrl, status: 'completed' })
      .eq('id', generationId);

    console.log(`[Pipeline ${generationId}] Completed successfully.`);
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
    .select('id, status, image_url, video_url, error_message, final_prompt_used, created_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Generation not found' });
    return;
  }

  res.json(data);
}
