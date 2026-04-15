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
  equipment: string;
  muscleGroups: string[];
  movementPattern: string;
  techniqueCues: string[];
  cameraAngle: string;
  cameraModifier: string;
  userObservations: string;
  masterPromptTemplate: string;
}): Promise<DualPrompts> {
  const { exerciseName, baseTechnique, equipment, muscleGroups, movementPattern, techniqueCues, cameraAngle, cameraModifier, userObservations, masterPromptTemplate } = params;

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

RULE 3 — ANATOMY AND GRIP PRECAUTIONS (Equipment-aware, Critical):
The equipment type for this exercise is provided in the user message. You MUST adapt the grip and implement description based on that equipment type:

- If equipment is "Barra" (barbell): "Hands and fingers are perfectly formed. Realistic five fingers securely gripping the bar. Thumbs are visibly wrapped around the bar. The metal bar does NOT blend or fuse with the skin. No extra fingers, no fused fingers, no floating hands, no missing thumbs. Natural knuckle definition and realistic skin compression against the bar."

- If equipment is "Mancuernas" (dumbbells): "Both hands grip their respective dumbbell handles firmly. Realistic five fingers wrapped around each dumbbell handle. Knuckles facing outward, thumbs locked under the fingers. The dumbbell handle does NOT blend or fuse with the palm. No extra fingers, no fused fingers. The hexagonal dumbbell head is clearly distinct from the hand."

- If equipment is "Cable" or "Polea" (cable machine): "The athlete's hands grip the cable attachment (D-ring / straight bar / rope) firmly. Realistic five fingers curled around the handle, thumbs secured. The cable runs visibly and continuously taut from the pulley overhead or behind to the attachment in the hands — the cable is NOT floating, NOT disconnected, NOT disappearing into the wrist. The cable machine stack and pulley housing are clearly visible in the background, establishing the physical connection."

- If equipment is "Peso corporal" (bodyweight): Describe the contact points (hands on floor, feet, etc.) with precise anatomical detail. Skip implement grip unless the exercise involves apparatus (pull-up bar, dip bars, etc.).

- For any other equipment: describe the implement-to-hand connection with the same level of anatomical precision.

RULE 4 — GEOMETRIC CAMERA ANGLE (absolute enforcement):
Use the exact camera angle instruction provided by the user. Insert it verbatim at the start of the image_prompt, immediately after the format declaration.
After inserting the camera angle instruction, you MUST add this violation warning verbatim:
"STRICT ANGLE ENFORCEMENT: A shot that deviates from the specified camera angle is ABSOLUTELY FORBIDDEN and voids the entire prompt. The specified angle is non-negotiable."
You MUST then describe all anatomy, muscles, limbs and the implement from the perspective of that specific angle. For example:
- For a 45° diagonal angle: describe how the near shoulder partially occludes the far shoulder, how the torso reads as three-dimensional with visible depth, how the barbell protrudes diagonally in space.
- For a lateral 90° angle: describe the pure side silhouette, limb layering, sagittal plane movement.
- For a frontal angle: describe bilateral symmetry, equal limb visibility.
Never describe anatomy in generic frontal terms when a non-frontal angle is specified.

RULE 5 — VIDEO ANIMATION STRICTNESS:
The video_prompt MUST start with this exact header:
"ULTRA STATIC LOCKED CAMERA. ABSOLUTELY NO ZOOM, NO PANNING, NO SCENE CHANGES. The exact initial framing must be maintained throughout the entire video."
The movement must be described as: "steady, biomechanically perfect, absolutely no swinging or momentum. Exactly 2 continuous repetitions."

RULE 6 — IMPLEMENT SPATIAL POSITIONING (critical for compound lifts):
For any exercise where the barbell is loaded on the upper back (back squat, high-bar squat, low-bar squat, good morning, barbell lunge, etc.), you MUST include this language in the image_prompt:
"The barbell is positioned across the upper trapezius, BEHIND the neck and shoulders, resting on the rear deltoids. The bar is NOT visible in front of the body under any circumstance. From this camera angle, describe explicitly how the bar appears spatially — e.g., for 45°: a horizontal rod protruding slightly beyond the far shoulder into the background space; for lateral 90°: a horizontal rod extending perpendicularly away from the camera behind the neck; for frontal: a horizontal bar crossing behind the neck with both ends extending outward to each side."
For any exercise where the barbell is held in front (deadlift, Romanian deadlift, front squat, bent-over row, etc.), describe the bar's exact spatial relationship to the body from the specified camera angle.
For cable/pulley exercises: describe the cable attachment's 3D position relative to the body — where the hands are in space, the angle of pull, and the visible path of the cable back to the pulley anchor point on the machine.

RULE 7 — FULL BODY FRAMING (mandatory, always):
Every image_prompt MUST end with this exact framing instruction:
"FULL BODY SHOT: The subject's entire body must be visible from head to feet with comfortable margin at top and bottom. Wide shot equivalent to a 35mm lens at 4-5 metres distance. The subject occupies 70-80% of the frame height. ABSOLUTE PROHIBITION: no cropping of feet, knees, hands or head. The complete body silhouette must be visible within the frame at all times."

RULE 8 — CABLE & PULLEY MACHINE VISUAL ANCHORING (mandatory when equipment is Cable or Polea):
If the exercise uses a cable machine, you MUST:
1. Describe the cable machine visible in the background (weight stack, shroud, upright column, pulley wheel at top or bottom).
2. Show the cable as a continuous taut line from the pulley down to the attachment in the athlete's hands. Use language like: "A steel cable runs in a straight taut line from the overhead pulley down to the D-ring handle gripped in both hands — the cable is under constant tension and clearly connected at both ends."
3. In the video_prompt, reinforce that the cable remains taut and physically connected throughout the full range of motion: during the concentric phase the cable angle changes as the hands move, during the eccentric the cable elongates back toward the pulley — it is NEVER slack, NEVER floating, NEVER disconnected.
4. ABSOLUTE PROHIBITION: generating the athlete performing the movement with hands empty, floating handles, or no visible cable connection is FORBIDDEN.

RULE 9 — FULL BODY FRAMING IN VIDEO (mandatory, always):
In the video_prompt, after the static camera header, explicitly reinforce:
"FULL BODY FRAMING LOCKED: The camera captures the athlete from head to feet throughout the entire video. ABSOLUTE PROHIBITION: no zoom in, no crop, no reframing during movement. Feet, knees, and head must remain fully in frame during every phase of the repetition."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE PROMPT CONSTRUCTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build the "image_prompt" string in this order:
1. Format: "High quality commercial fitness photography, vertical 9:16 aspect ratio."
2. Camera angle instruction (from RULE 4 — insert verbatim from user input, then add violation warning)
3. Subject description (RULE 2)
4. Exercise action: full biomechanical description at the most visually impactful moment — peak contraction or mid-ROM. Include joint angles, muscle belly visibility, body segment alignment, and spine neutrality. All anatomy described from the perspective of the specified camera angle (RULE 4).
5. Implement spatial positioning (RULE 6) — describe exactly where the barbell/dumbbell/cable is in 3D space relative to the body AND relative to the camera angle.
6. Grip/hand anatomy (RULE 3) — adapted precisely to this exercise's implement (barbell/dumbbell/cable/bodyweight)
7. Lighting: "Soft professional studio key light, subtle rim light highlighting muscle contours, shadowless fill — ideal for instructional biomechanics photography."
8. Background (RULE 1)
9. Style: "Hyper-realistic instructional fitness photograph, 8K resolution, sharp focus on full body, no artistic filters, no motion blur."
10. Coaching notes: include userObservations if provided, otherwise "Perfect standard form."
11. Full body framing (RULE 7 — insert verbatim)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIDEO PROMPT CONSTRUCTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build the "video_prompt" string in this order:
1. Static camera header (RULE 5 — insert verbatim)
2. Full body framing lock (RULE 9 — insert verbatim, immediately after the static camera header)
3. Motion description: full ROM cycle from the start position through peak contraction and back to start. Name every joint involved in the movement.
4. Tempo: specify concentric phase duration, peak hold, eccentric phase duration (e.g., "2s concentric, 1s peak hold, 3s eccentric").
5. Movement quality (RULE 5): "steady, biomechanically perfect, absolutely no swinging or momentum. Exactly 2 continuous repetitions."
6. Cable physics (RULE 8, only if cable/pulley exercise): describe that the cable remains taut and connected throughout the full ROM, changing angle in sync with the athlete's movement.
7. Physics: describe visible physical effects — weight inertia, muscle belly deformation at contraction, tendon stretch at full extension, realistic implement arc.
8. Identity consistency: "Preserve exact facial features, skin tone, hair and overall body identity from the input reference frame throughout every frame of the video. No face morphing, no identity drift."`;

  const userMessage = `Exercise: ${exerciseName}
Equipment type: ${equipment}
Primary muscles: ${muscleGroups.length > 0 ? muscleGroups.join(', ') : 'Not specified'}
Movement pattern: ${movementPattern || 'Not specified'}
Technique cues: ${techniqueCues.length > 0 ? techniqueCues.join(' | ') : 'None'}
Correct technique (biomechanics reference): ${baseTechnique}
Camera angle name: ${cameraAngle}
Camera angle instruction (insert verbatim into image_prompt): ${cameraModifier}
Coach observations: ${userObservations || 'None — use standard perfect form'}
Style/environment supplementary reference: ${masterPromptTemplate}

Generate the dual prompts now following the Jeff Nippard Clinical Standard. Pay special attention to RULE 3 (grip/implement) and apply the correct variant for the equipment type "${equipment}". If equipment involves cables or pulleys, enforce RULE 8 fully.`;

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

  // Flux Kontext Pro: 2750-char safety margin (API limit ~3000)
  const MAX_IMAGE_PROMPT_LENGTH = 2750;
  // Kling 2.6: 2200-char safety margin (API rejects beyond ~2500 with 400)
  const MAX_VIDEO_PROMPT_LENGTH = 2200;

  const imagePrompt = parsed.image_prompt.length > MAX_IMAGE_PROMPT_LENGTH
    ? parsed.image_prompt.slice(0, MAX_IMAGE_PROMPT_LENGTH)
    : parsed.image_prompt;
  const videoPrompt = parsed.video_prompt.length > MAX_VIDEO_PROMPT_LENGTH
    ? parsed.video_prompt.slice(0, MAX_VIDEO_PROMPT_LENGTH)
    : parsed.video_prompt;

  return {
    imagePrompt,
    videoPrompt,
  };
}
