import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ImagePromptJson {
  subject: string;
  exercise_action: string;
  grip_detail: string;
  camera_angle: string;
  lighting: string;
  background: string;
  style: string;
  observations: string;
}

export interface VideoPromptJson {
  motion_description: string;
  tempo: string;
  camera_movement: string;
  loop_behavior: string;
  physics_notes: string;
  consistency_note: string;
}

export interface DualPrompts {
  imagePrompt: ImagePromptJson;
  videoPrompt: VideoPromptJson;
}

/**
 * Ask Claude to build two JSON prompts:
 *   1. imagePrompt — for Flux Kontext Pro (img2img, white background, face consistency)
 *   2. videoPrompt — for Kling 2.6 (movement, tempo, physics)
 * Returns parsed DualPrompts object.
 */
export async function buildDualPrompts(params: {
  exerciseName: string;
  baseTechnique: string;
  cameraAngle: string;
  cameraModifier: string;
  userObservations: string;
  masterPromptTemplate: string;
}): Promise<DualPrompts> {
  const { exerciseName, baseTechnique, cameraAngle, cameraModifier, userObservations, masterPromptTemplate } = params;

  const systemMessage = `You are an expert at writing hyper-realistic AI generation prompts for fitness biomechanics instructional content.

Your task: produce a single JSON object with exactly two keys — "image" and "video" — following the schemas below.

OUTPUT RULES:
- Output ONLY valid JSON. No markdown fences, no preamble, no trailing text.
- All field values must be in English.
- Be precise, clinical, and biomechanically accurate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE PROMPT SCHEMA (for Flux Kontext Pro img2img)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "subject": "Hyper-realistic athletic male model. Preserve exact facial identity, facial structure, skin tone and hair from the provided reference image. Do NOT alter or regenerate the face.",
  "exercise_action": "<Full biomechanical description of the exercise at its most visually impactful moment — peak contraction or mid-movement. Include joint angles, muscle belly visibility, body segment alignment.>",
  "grip_detail": "<CRITICAL — describe the grip with absolute anatomical precision: each hand has exactly 5 fingers, correct thumb opposition, natural knuckle definition, realistic skin compression against the implement (barbell/dumbbell/cable handle/bodyweight), correct wrist angle. No extra fingers, no fused fingers, no floating hands, no missing thumbs.>",
  "camera_angle": "<Camera angle description derived from the cameraAngle and cameraModifier inputs>",
  "lighting": "Soft professional studio key light, subtle rim light on muscle contours, shadowless fill — suitable for instructional biomechanics photography",
  "background": "Pure white seamless studio backdrop. No gym equipment, no floor texture, no gradients. Clinical white background only.",
  "style": "Hyper-realistic instructional fitness photograph, 8K resolution, sharp focus on full body, no artistic filters",
  "observations": "<Specific coaching cues and technical notes from userObservations, or 'Perfect standard form' if none provided>"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIDEO PROMPT SCHEMA (for Kling 2.6 image-to-video)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "motion_description": "<Full description of the movement cycle from start position through full ROM and back. Reference all joints involved.>",
  "tempo": "<Concentric phase duration, peak hold, eccentric phase duration — e.g., '2s concentric, 1s peak hold, 3s eccentric'>",
  "camera_movement": "Locked-off static camera. No pan, no zoom, no handheld shake.",
  "loop_behavior": "Single clean repetition from start to finish. Natural deceleration at endpoints.",
  "physics_notes": "<Visible physical effects: weight inertia, muscle belly deformation at contraction, tendon stretch at full extension, realistic implement movement arc.>",
  "consistency_note": "Preserve exact facial features, skin tone, hair and overall identity from the input reference frame throughout every frame of the video. No face morphing or identity drift."
}`;

  const userMessage = `Exercise: ${exerciseName}
Correct technique (biomechanics reference): ${baseTechnique}
Camera angle: ${cameraAngle} — ${cameraModifier}
Coach observations: ${userObservations || 'None — use standard perfect form'}
Style/environment reference: ${masterPromptTemplate}

Generate the dual JSON prompt now.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userMessage }],
    system: systemMessage,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API');
  }

  let parsed: { image: ImagePromptJson; video: VideoPromptJson };
  try {
    // Strip markdown code fences if Claude wrapped the output despite instructions
    const raw = content.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${content.text.slice(0, 200)}`);
  }

  if (!parsed.image || !parsed.video) {
    throw new Error('Claude JSON missing required "image" or "video" keys');
  }

  return {
    imagePrompt: parsed.image,
    videoPrompt: parsed.video,
  };
}

/**
 * Assemble the Flux Kontext image prompt string from the structured JSON.
 * This text is sent alongside the reference image URL.
 */
export function assembleImagePromptText(p: ImagePromptJson): string {
  return [
    p.subject,
    p.exercise_action,
    `Grip: ${p.grip_detail}`,
    `Camera: ${p.camera_angle}`,
    `Lighting: ${p.lighting}`,
    `Background: ${p.background}`,
    p.style,
    p.observations !== 'Perfect standard form' ? `Coaching notes: ${p.observations}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Assemble the Kling video prompt string from the structured JSON.
 */
export function assembleVideoPromptText(p: VideoPromptJson): string {
  return [
    p.motion_description,
    `Tempo: ${p.tempo}`,
    p.camera_movement,
    p.loop_behavior,
    p.physics_notes,
    p.consistency_note,
    'Smooth, professional fitness demonstration. Cinematic quality.',
  ].join(' ');
}
