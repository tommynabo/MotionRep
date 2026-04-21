import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DualPrompts {
  imagePrompt: string;
  videoPrompt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED SKELETON BUILDERS
// These elements are GUARANTEED to appear in every prompt — Claude never
// generates them. Only the biomechanical exercise content is AI-generated.
// ─────────────────────────────────────────────────────────────────────────────

function buildImageFixedHeader(cameraModifier: string, logoDescription: string): string {
  return `High quality commercial fitness photography, vertical 9:16 aspect ratio. ${cameraModifier} STRICT ANGLE ENFORCEMENT: A shot that deviates from the specified camera angle is ABSOLUTELY FORBIDDEN and voids the entire prompt. If the angle is lateral/side profile, the camera must be at exactly 90° from the frontal plane — the viewer sees the pure side silhouette, NOT the chest, NOT the face. If the angle is posterior/rear, the camera is directly behind. The specified angle is non-negotiable and must be maintained for every single frame. A fit, athletic 30-year-old man with a lean, naturally toned physique — visible muscle definition, flat stomach, broad shoulders, but NOT a bodybuilder. He looks like a dedicated gym-goer: healthy, functional fitness level, moderate muscle size. Men's fitness magazine cover aesthetic. He is shirtless to clearly display muscle activation and wearing solid black athletic shorts. On the outer left thigh of the black shorts, place the logo: ${logoDescription}. Size: 3cm × 3cm on the lateral outer face of the left thigh ONLY — not right leg, not both. Logo must be clearly visible and precisely placed. Premium rented fitness studio: bright white walls, smooth polished white concrete floor, large industrial-style pendant lights hanging from a white ceiling casting soft even illumination across the whole space. The athlete casts a faint soft natural shadow on the floor directly beneath them. The ONLY objects visible in the frame are the athlete and the specific exercise equipment. No other gym machines, no extra equipment, no other people, no decorative elements visible. Exclusive high-end studio look — minimal, architectural, premium. `;
}

function buildImageFixedFooter(): string {
  return ` FULL BODY SHOT: The subject's entire body must be visible from head to feet with generous margin at top and bottom. Wide shot equivalent to a 24mm wide-angle lens at 10-12 metres distance. The subject occupies approximately 40-50% of the frame height, centred in frame. ABSOLUTE PROHIBITION: no cropping of feet, knees, hands, arms or head under any circumstance. The complete body silhouette including fully extended arms must be visible within the frame at all times. All equipment must be fully visible without cropping or cutoff.`;
}

function buildVideoFixedHeader(cameraModifier: string): string {
  return `ULTRA STATIC LOCKED CAMERA. ABSOLUTELY NO ZOOM, NO PANNING, NO SCENE CHANGES. The exact initial framing must be maintained throughout the entire video. FULL BODY FRAMING LOCKED: The camera is positioned at 10-12 metres from the subject, equivalent to a 24mm wide-angle shot. The athlete's full body including fully extended arms is visible with generous margin at all sides throughout the entire video. The subject occupies approximately 40-50% of the frame height, centred. All equipment and machine structures are fully visible. ABSOLUTE PROHIBITION: no zoom in, no crop, no reframing during movement. Feet, knees, hands and head must remain fully in frame during every phase of the repetition. Equipment must remain fully visible. ${cameraModifier} STRICT ANGLE ENFORCEMENT: A shot that deviates from the specified camera angle is ABSOLUTELY FORBIDDEN and voids the entire prompt. The specified angle is non-negotiable and must be maintained for every single frame. The athlete is animated directly from the input image. Preserve exact facial identity, skin tone, hair, and physique from the input image throughout every frame. NO face morphing, NO identity drift, NO physique change. The athlete is SHIRTLESS — bare torso, no shirt, no sleeveless top, no garment of any kind on the upper body. BACKGROUND ABSOLUTE LOCK: Every single frame must show the same white studio environment as the input image: bright white walls, white polished concrete floor, large pendant lights on a white ceiling. The background MUST NOT change, darken, or gain any new elements at any point during the video. No gym equipment in background, no coloured walls, no mirrors, no other people visible. `;
}

function buildVideoFixedFooter(): string {
  return ` ZERO cuts between repetitions — each rep ends at lockout and the next begins immediately without pause. The video is ONE single uninterrupted 10-second clip. Movement is steady, biomechanically perfect, absolutely no swinging or momentum. Exactly 4 continuous repetitions with identical form in each rep.`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds image and video prompts by combining hardcoded skeleton (guaranteed elements)
 * with Claude-generated biomechanical exercise content.
 * Claude only generates: exercise position description (image) + 4-rep motion (video).
 * Logo, background, full body framing, camera header = hardcoded in TypeScript, never AI-generated.
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
  shortsLogoUrl: string;
  shortsLogoDescription: string;
  masterPromptTemplate: string;
}): Promise<DualPrompts> {
  const { exerciseName, baseTechnique, equipment, muscleGroups, movementPattern, techniqueCues, cameraAngle, cameraModifier, userObservations, shortsLogoUrl, shortsLogoDescription, masterPromptTemplate } = params;

  // Simplified system message — Claude only needs to know biomechanics, not prompt structure
  const systemMessage = `You are a biomechanics expert and clinical fitness coach. Your role is to provide precise, anatomically accurate descriptions of exercise movements using exact joint angles, muscle engagement cues, and equipment positioning.

Rules:
- Use precise biomechanical language: joint angles in degrees, directional terms (anterior/posterior/flexion/extension), muscle names
- Be clinically accurate and specific — no vague descriptions
- Tempo: 1.25s eccentric | 0.25s pause | 0.75s concentric | 0.25s lockout = 2.5s per rep × 4 reps = 10s total
- NEVER mention external videos, YouTube, cloning, motion transfer, or any external reference
- Output ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON`;

  // IMAGE: ask Claude only for the exercise-specific static position (~800 chars)
  const imageUserMessage = `Describe the exact static ${exerciseName} position for a fitness image prompt.

Exercise: ${exerciseName}
Equipment: ${equipment}
Muscles: ${muscleGroups.join(', ')}
Technique: ${baseTechnique}
Technique cues: ${techniqueCues.join(' | ')}
Camera angle: ${cameraAngle} — ${cameraModifier}
Coach notes: ${userObservations || 'Standard perfect form'}

Return ONLY this JSON (no markdown, no other text):
{
  "exercise_position": "A biomechanically precise description of the exact static position the athlete holds in the image. Include: joint angles at every major joint, implement position relative to body, spine alignment, scapular position, foot stance width, grip details specific to ${equipment}. For deadlift variants use lockout position. For press variants use lockout. For curl/row variants use peak contraction. Max 850 characters."
}`;

  // VIDEO: ask Claude only for the 4-rep motion description (~1200 chars)
  const videoUserMessage = `Describe the complete 4-repetition motion of ${exerciseName} for a video generation prompt.

Exercise: ${exerciseName}
Equipment: ${equipment}
Muscles: ${muscleGroups.join(', ')}
Technique: ${baseTechnique}
Technique cues: ${techniqueCues.join(' | ')}
Camera angle: ${cameraAngle}
Coach notes: ${userObservations || 'Standard perfect form'}

Tempo per rep: 1.25s eccentric | 0.25s pause | 0.75s concentric | 0.25s lockout = 2.5s per rep
Timestamps:
- Rep 1: 0s–2.5s (ECCENTRIC 0s–1.25s | PAUSE 1.25s–1.5s | CONCENTRIC 1.5s–2.25s | LOCKOUT 2.25s–2.5s)
- Rep 2: 2.5s–5.0s (ECCENTRIC 2.5s–3.75s | PAUSE 3.75s–4.0s | CONCENTRIC 4.0s–4.75s | LOCKOUT 4.75s–5.0s)
- Rep 3: 5.0s–7.5s (ECCENTRIC 5.0s–6.25s | PAUSE 6.25s–6.5s | CONCENTRIC 6.5s–7.25s | LOCKOUT 7.25s–7.5s)
- Rep 4: 7.5s–10.0s (ECCENTRIC 7.5s–8.75s | PAUSE 8.75s–9.0s | CONCENTRIC 9.0s–9.75s | LOCKOUT 9.75s–10.0s)

CRITICAL: Describe ALL FOUR reps. For Rep 1 describe every phase in full detail with joint angles. For Reps 2-4 you may use condensed format: "REP X (Xs–Xs): [Identical biomechanical pattern — ECCENTRIC (times): ..brief joint angle summary.. | PAUSE (times): ...| CONCENTRIC (times): ... | LOCKOUT (times): static hold]" but include timestamps and key joint angles for each phase.

Return ONLY this JSON (no markdown, no other text):
{
  "motion_description": "Complete 4-rep motion breakdown starting with 'EXERCISE NAME MOTION — EXACTLY 4 REPETITIONS with timestamps: Rep 1: 0s–2.5s, Rep 2: 2.5s–5.0s, Rep 3: 5.0s–7.5s, Rep 4: 7.5s–10.0s.' followed by the detailed phase descriptions. Max 1300 characters."
}`;

  // Run both API calls in parallel — each has its own full token budget
  const [imageMessage, videoMessage] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: imageUserMessage }],
      system: systemMessage,
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: videoUserMessage }],
      system: systemMessage,
    }),
  ]);

  const imageContent = imageMessage.content[0];
  if (imageContent.type !== 'text') throw new Error('Unexpected response type from Anthropic API (image)');

  const videoContent = videoMessage.content[0];
  if (videoContent.type !== 'text') throw new Error('Unexpected response type from Anthropic API (video)');

  let parsedImage: { exercise_position: string };
  let parsedVideo: { motion_description: string };

  try {
    const rawImage = imageContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsedImage = JSON.parse(rawImage);
  } catch {
    throw new Error(`Claude returned invalid JSON for exercise_position: ${imageContent.text.slice(0, 200)}`);
  }

  try {
    const rawVideo = videoContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsedVideo = JSON.parse(rawVideo);
  } catch {
    throw new Error(`Claude returned invalid JSON for motion_description: ${videoContent.text.slice(0, 200)}`);
  }

  if (!parsedImage.exercise_position) throw new Error('Claude JSON missing "exercise_position" key');
  if (!parsedVideo.motion_description) throw new Error('Claude JSON missing "motion_description" key');

  // ── Assemble final prompts from hardcoded skeleton + Claude-generated content ──
  const MAX_IMAGE_PROMPT_LENGTH = 2950;
  const MAX_VIDEO_PROMPT_LENGTH = 2500;

  const rawImagePrompt =
    buildImageFixedHeader(cameraModifier, shortsLogoDescription) +
    parsedImage.exercise_position +
    buildImageFixedFooter();

  const rawVideoPrompt =
    buildVideoFixedHeader(cameraModifier) +
    parsedVideo.motion_description +
    buildVideoFixedFooter();

  // Safety truncation — should rarely trigger since we control the budget
  const imagePrompt = rawImagePrompt.length <= MAX_IMAGE_PROMPT_LENGTH
    ? rawImagePrompt
    : rawImagePrompt.substring(0, rawImagePrompt.lastIndexOf('.', MAX_IMAGE_PROMPT_LENGTH) + 1);

  const videoPrompt = rawVideoPrompt.length <= MAX_VIDEO_PROMPT_LENGTH
    ? rawVideoPrompt
    : rawVideoPrompt.substring(0, rawVideoPrompt.lastIndexOf('.', MAX_VIDEO_PROMPT_LENGTH) + 1);

  // Assertions — guaranteed by hardcoded skeleton, but log if something is wrong
  const checks = {
    image_logo: imagePrompt.includes('left thigh'),
    image_fullbody: imagePrompt.includes('FULL BODY SHOT'),
    image_background: imagePrompt.includes('white walls'),
    video_static: videoPrompt.includes('ULTRA STATIC LOCKED CAMERA'),
    video_background: videoPrompt.includes('BACKGROUND ABSOLUTE LOCK'),
    video_zerocurts: videoPrompt.includes('ZERO cuts'),
    video_rep4: videoPrompt.toLowerCase().includes('rep 4'),
  };

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (failed.length > 0) {
    console.warn(`⚠️ PROMPT VALIDATION FAILED for "${exerciseName}": ${failed.join(', ')}`);
  }

  return { imagePrompt, videoPrompt };
}
