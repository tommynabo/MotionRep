import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DualPrompts {
  imagePrompt: string;
  videoPrompt: string;
}

/**
 * Ask Claude to build two complete, ready-to-send prompt strings:
 *   1. imagePrompt — for Flux Kontext Pro (img2img, gym background, face consistency)
 *   2. videoPrompt — for Kling 2.6 (movement, static camera, 2 reps)
 * Follows the "Jeff Nippard Clinical Standard" for every generation.
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

  const systemMessage = `You are an expert Biomechanics Coach and Master AI Prompt Engineer for fitness video generation.
Your task is to generate two complete, ready-to-send prompt strings following the "Jeff Nippard Clinical Standard".

OUTPUT RULES:
- Output ONLY a valid JSON object with exactly two keys: "image_prompt" and "video_prompt".
- Both values must be fully assembled plain strings — not objects or nested structures.
- No markdown fences, no preamble, no trailing text outside the JSON.
- All content must be in English.
- Be biomechanically precise and clinically accurate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE RULES — JEFF NIPPARD CLINICAL STANDARD
(These rules are non-negotiable and must be reflected in every prompt you output)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — THE AESTHETIC (Background):
The background must ALWAYS be described as:
"A modern, ultra-clean, brightly lit premium gym environment with solid white walls, minimalistic sleek black gym machines softly out of focus in the background."

RULE 2 — THE SUBJECT:
The subject must ALWAYS be described as:
"An athletic, lean 30-year-old man with a naturally defined muscular physique. He is shirtless to clearly display muscle activation and wearing dark gym shorts."
Preserve exact facial identity, facial structure, skin tone and hair from the provided reference image throughout. Do NOT alter or regenerate the face.

RULE 3 — ANATOMY AND GRIP PRECAUTIONS (Critical):
You MUST explicitly include all of the following in the image_prompt:
"Hands and fingers are perfectly formed. Realistic five fingers securely gripping the bar/handle. Thumbs are visibly wrapped around the bar. The metal bar does NOT blend or fuse with the skin. No extra fingers, no fused fingers, no floating hands, no missing thumbs. Natural knuckle definition and realistic skin compression against the implement."

RULE 4 — GEOMETRIC CAMERA ANGLE:
Use the exact camera angle instruction provided by the user. Insert it verbatim at the start of the image_prompt, immediately after the format declaration.

RULE 5 — VIDEO ANIMATION STRICTNESS:
The video_prompt MUST start with this exact header:
"ULTRA STATIC LOCKED CAMERA. ABSOLUTELY NO ZOOM, NO PANNING, NO SCENE CHANGES. The exact initial framing must be maintained throughout the entire video."
The movement must be described as: "steady, biomechanically perfect, absolutely no swinging or momentum. Exactly 2 continuous repetitions."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE PROMPT CONSTRUCTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build the "image_prompt" string in this order:
1. Format: "High quality commercial fitness photography, vertical 9:16 aspect ratio."
2. Camera angle instruction (from RULE 4 — insert verbatim from user input)
3. Subject description (RULE 2)
4. Exercise action: full biomechanical description at the most visually impactful moment — peak contraction or mid-ROM. Include joint angles, muscle belly visibility, body segment alignment, and spine neutrality.
5. Grip/hand anatomy (RULE 3) — adapted precisely to this exercise's implement (barbell/dumbbell/cable/bodyweight)
6. Lighting: "Soft professional studio key light, subtle rim light highlighting muscle contours, shadowless fill — ideal for instructional biomechanics photography."
7. Background (RULE 1)
8. Style: "Hyper-realistic instructional fitness photograph, 8K resolution, sharp focus on full body, no artistic filters, no motion blur."
9. Coaching notes: include userObservations if provided, otherwise "Perfect standard form."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIDEO PROMPT CONSTRUCTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build the "video_prompt" string in this order:
1. Static camera header (RULE 5 — insert verbatim)
2. Motion description: full ROM cycle from the start position through peak contraction and back to start. Name every joint involved in the movement.
3. Tempo: specify concentric phase duration, peak hold, eccentric phase duration (e.g., "2s concentric, 1s peak hold, 3s eccentric").
4. Movement quality (RULE 5): "steady, biomechanically perfect, absolutely no swinging or momentum. Exactly 2 continuous repetitions."
5. Physics: describe visible physical effects — weight inertia, muscle belly deformation at contraction, tendon stretch at full extension, realistic implement arc.
6. Identity consistency: "Preserve exact facial features, skin tone, hair and overall body identity from the input reference frame throughout every frame of the video. No face morphing, no identity drift."`;

  const userMessage = `Exercise: ${exerciseName}
Correct technique (biomechanics reference): ${baseTechnique}
Camera angle name: ${cameraAngle}
Camera angle instruction (insert verbatim into image_prompt): ${cameraModifier}
Coach observations: ${userObservations || 'None — use standard perfect form'}
Style/environment supplementary reference: ${masterPromptTemplate}

Generate the dual prompts now following the Jeff Nippard Clinical Standard.`;

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

  let parsed: { image_prompt: string; video_prompt: string };
  try {
    const raw = content.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${content.text.slice(0, 200)}`);
  }

  if (!parsed.image_prompt || !parsed.video_prompt) {
    throw new Error('Claude JSON missing required "image_prompt" or "video_prompt" keys');
  }

  return {
    imagePrompt: parsed.image_prompt,
    videoPrompt: parsed.video_prompt,
  };
}
