import { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { buildDualPrompts } from '../services/claude.js';

/**
 * POST /api/test-prompts
 *
 * Runs only the Claude prompt-building step of the pipeline and returns the
 * generated prompts as JSON — no images or videos are generated, so zero
 * KIE credits are spent.
 *
 * Request body: { exercise_id, angle_id, user_observations? }
 *
 * Response:
 * {
 *   imagePrompt: string,       // prompt sent to GPT Image 1.5
 *   videoPrompt: string,       // prompt sent to Seedance 2.0
 *   meta: {
 *     imagePromptLength: number,
 *     videoPromptLength: number,
 *     imagePromptBudget: number,   // max allowed
 *     videoPromptBudget: number,
 *     imagePromptOk: boolean,      // true if within budget
 *     videoPromptOk: boolean,
 *     exerciseName: string,
 *     cameraAngle: string,
 *     checks: {                    // keyword spot-checks
 *       shirtless: boolean,
 *       logo: boolean,
 *       whiteBackground: boolean,
 *       seamlessContinuity: boolean,
 *       tenSeconds: boolean,
 *       fourReps: boolean,
 *     }
 *   }
 * }
 */
export async function testPrompts(req: Request, res: Response): Promise<void> {
  const { exercise_id, angle_id, user_observations } = req.body as {
    exercise_id: string;
    angle_id: string;
    user_observations?: string;
  };

  if (!exercise_id || !angle_id) {
    res.status(400).json({ error: 'exercise_id and angle_id are required' });
    return;
  }

  // Fetch same data as the real pipeline
  const [exerciseResult, angleResult, masterPromptResult, shortsLogoResult, shortsLogoDescResult] = await Promise.all([
    supabase.from('exercises').select('name, base_technique, equipment, muscle_groups, movement_pattern, technique_cues').eq('id', exercise_id).single(),
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
  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
  const shortsLogoUrl = shortsLogoResult.data?.value || (appUrl ? `${appUrl}/logoempresa.png` : '');
  const shortsLogoDescription =
    shortsLogoDescResult.data?.value ||
    "a white three-dimensional isometric letter 'S' with bold geometric angular facets, constructed from stepped cubic planes in an isometric perspective — the official Symmetry brand logo printed on the fabric";

  try {
    const { imagePrompt, videoPrompt } = await buildDualPrompts({
      exerciseName: exercise.name,
      baseTechnique: exercise.base_technique,
      equipment: exercise.equipment ?? 'Barra',
      muscleGroups: exercise.muscle_groups ?? [],
      movementPattern: exercise.movement_pattern ?? '',
      techniqueCues: exercise.technique_cues ?? [],
      cameraAngle: angle.name,
      cameraModifier: angle.prompt_modifier,
      userObservations: user_observations ?? '',
      shortsLogoUrl,
      shortsLogoDescription,
      masterPromptTemplate: masterPrompt,
    });

    const IMAGE_BUDGET = 2950;
    const VIDEO_BUDGET = 2500;

    // Keyword checks — quick sanity pass on the generated prompts
    const checks = {
      shirtless: videoPrompt.toLowerCase().includes('shirtless'),
      logo: imagePrompt.toLowerCase().includes('logo') || imagePrompt.toLowerCase().includes('left thigh'),
      whiteBackground: imagePrompt.toLowerCase().includes('white') && imagePrompt.toLowerCase().includes('studio'),
      seamlessContinuity: videoPrompt.toLowerCase().includes('seamless') || videoPrompt.toLowerCase().includes('zero cuts'),
      tenSeconds: videoPrompt.includes('10s') || videoPrompt.includes('10 second') || videoPrompt.includes('2.5s'),
      fourReps: videoPrompt.includes('4 rep') || videoPrompt.includes('four rep') || videoPrompt.includes('Rep 4'),
    };

    // TIER breakdown analysis
    const imageTier1End = imagePrompt.indexOf('[END_TIER_1]');
    const imageTier2End = imagePrompt.indexOf('[END_TIER_2]');
    const videoTier1End = videoPrompt.indexOf('[END_TIER_1]');
    const videoTier2End = videoPrompt.indexOf('[END_TIER_2]');

    const imagePromptClean = imagePrompt.replace(/\[END_TIER_[1-3]\]/g, '').trim();
    const videoPromptClean = videoPrompt.replace(/\[END_TIER_[1-3]\]/g, '').trim();

    const tier1ImageChars = imageTier1End > 0 ? imageTier1End : imagePromptClean.length;
    const tier1VideoChars = videoTier1End > 0 ? videoTier1End : videoPromptClean.length;

    res.json({
      imagePrompt: imagePromptClean,
      videoPrompt: videoPromptClean,
      meta: {
        imagePromptLength: imagePromptClean.length,
        videoPromptLength: videoPromptClean.length,
        imagePromptBudget: IMAGE_BUDGET,
        videoPromptBudget: VIDEO_BUDGET,
        imagePromptOk: imagePromptClean.length <= IMAGE_BUDGET,
        videoPromptOk: videoPromptClean.length <= VIDEO_BUDGET,
        exerciseName: exercise.name,
        cameraAngle: angle.name,
        checks,
        tierBreakdown: {
          image: {
            tier1Chars: tier1ImageChars,
            tier1Percentage: Math.round((tier1ImageChars / IMAGE_BUDGET) * 100),
            budgetRemaining: IMAGE_BUDGET - imagePromptClean.length,
          },
          video: {
            tier1Chars: tier1VideoChars,
            tier1Percentage: Math.round((tier1VideoChars / VIDEO_BUDGET) * 100),
            budgetRemaining: VIDEO_BUDGET - videoPromptClean.length,
          },
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Claude prompt generation failed: ${message}` });
  }
}
