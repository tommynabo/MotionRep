import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { buildGenerationPrompt } from '../services/claude.js';
import { generateImage, generateVideo } from '../services/fal.js';

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

  // Fetch exercise and angle data from Supabase
  const [exerciseResult, angleResult, configResult] = await Promise.all([
    supabase.from('exercises').select('name, base_technique').eq('id', exercise_id).single(),
    supabase.from('camera_angles').select('name, prompt_modifier').eq('id', angle_id).single(),
    supabase.from('config').select('value').eq('key', 'master_prompt').single(),
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
  const masterPrompt = configResult.data?.value ?? '';

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

  // Run the pipeline asynchronously (fire-and-forget with error handling)
  runPipeline({
    generationId,
    exercise,
    angle,
    userObservations: user_observations ?? '',
    masterPrompt,
  }).catch((err) => {
    console.error(`[Pipeline] Unhandled error for generation ${generationId}:`, err);
  });
}

async function runPipeline(params: {
  generationId: string;
  exercise: { name: string; base_technique: string };
  angle: { name: string; prompt_modifier: string };
  userObservations: string;
  masterPrompt: string;
}): Promise<void> {
  const { generationId, exercise, angle, userObservations, masterPrompt } = params;

  try {
    // STEP A: Build the prompt with Claude
    console.log(`[Pipeline ${generationId}] Step A: Building prompt with Claude...`);
    const finalPrompt = await buildGenerationPrompt({
      exerciseName: exercise.name,
      baseTechnique: exercise.base_technique,
      cameraAngle: angle.name,
      cameraModifier: angle.prompt_modifier,
      userObservations,
      masterPromptTemplate: masterPrompt,
    });

    await supabase
      .from('generations')
      .update({ final_prompt_used: finalPrompt })
      .eq('id', generationId);

    // STEP B: Generate image with Flux 2.0 Pro
    console.log(`[Pipeline ${generationId}] Step B: Generating image with Flux...`);
    const imageUrl = await generateImage(finalPrompt);

    await supabase
      .from('generations')
      .update({ image_url: imageUrl, status: 'image_done' })
      .eq('id', generationId);

    // STEP C: Generate video with Kling AI
    console.log(`[Pipeline ${generationId}] Step C: Generating video with Kling...`);
    const videoUrl = await generateVideo(imageUrl, finalPrompt);

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
