// No imports from claude.ts needed — prompts are received as plain assembled strings.

const KIE_API_BASE = 'https://api.kie.ai/api/v1';

function kieHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.KIE_KEY ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function createTask(body: object): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { code: number; msg: string; data: { taskId: string } };
  if (json.code !== 200) {
    throw new Error(`KIE createTask error ${json.code}: ${json.msg}`);
  }
  return json.data.taskId;
}

async function pollTask(taskId: string): Promise<string[]> {
  const maxAttempts = 180; // up to ~15 minutes at 5-second intervals
  const intervalMs = 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const res = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${process.env.KIE_KEY ?? ''}` } },
    );
    const json = (await res.json()) as {
      code: number;
      msg: string;
      data: { state: string; resultJson?: string; failMsg?: string };
    };

    if (json.code !== 200) {
      throw new Error(`KIE poll error ${json.code}: ${json.msg}`);
    }

    const { state, resultJson, failMsg } = json.data;

    if (state === 'success') {
      const result = JSON.parse(resultJson!) as { resultUrls: string[] };
      return result.resultUrls;
    }

    if (state === 'fail') {
      throw new Error(`KIE task failed: ${failMsg}`);
    }

    // states 'waiting' | 'queuing' | 'generating' -> keep polling
  }

  throw new Error(`KIE task ${taskId} timed out after ${maxAttempts} attempts`);
}

/**
 * Poll a Flux Kontext task using its dedicated endpoint.
 * successFlag: 0=generating, 1=success, 2=create failed, 3=generate failed
 */
async function pollFluxTask(taskId: string): Promise<string> {
  const maxAttempts = 60; // up to ~5 minutes at 5-second intervals
  const intervalMs = 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const res = await fetch(
      `${KIE_API_BASE}/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${process.env.KIE_KEY ?? ''}` } },
    );
    const json = (await res.json()) as {
      code: number;
      msg: string;
      data: {
        successFlag: number;
        failMsg?: string;
        response?: { resultImageUrl: string };
      };
    };

    if (json.code !== 200) {
      throw new Error(`KIE Flux Kontext poll error ${json.code}: ${json.msg}`);
    }

    const { successFlag, failMsg, response } = json.data;

    if (successFlag === 1) {
      const url = response?.resultImageUrl;
      if (!url) throw new Error('KIE Flux Kontext returned success but no resultImageUrl');
      return url;
    }

    if (successFlag === 2 || successFlag === 3) {
      throw new Error(`KIE Flux Kontext task failed: ${failMsg ?? 'unknown error'}`);
    }

    // successFlag === 0 → still generating, keep polling
  }

  throw new Error(`KIE Flux Kontext task ${taskId} timed out after ${maxAttempts} attempts`);
}

/**
 * Second-pass Flux Kontext refinement: enforce pure white studio background
 * and composite the Symmetry brand logo onto the outer left thigh of the shorts.
 * The input is the first-pass generated image (may have non-white background).
 * The output is the same image with white background + logo added.
 * Everything else (face, body, pose, equipment) is preserved exactly.
 */
export async function refineImageWithLogoAndBackground(
  imageUrl: string,
  logoDescription: string,
): Promise<string> {
  const prompt =
    `INSTRUCTION: You are performing SURGICAL IMAGE REFINEMENT, not free regeneration.

YOU MUST PRESERVE PIXEL-PERFECT:
- The athlete's exact body position, pose, limb angles, head orientation, torso angle
- Every joint angle at the exact same degree
- The exercise equipment's exact position, size, orientation, and geometry
- The athlete's face, facial features, skin tone, hair texture
- The camera angle and framing — do NOT change perspective, angle, or crop
- The athlete's muscle definition, body proportions, and overall physique
- The background behind the athlete/equipment can be modified ONLY

IF THE ATHLETE'S POSITION, EQUIPMENT GEOMETRY, OR CAMERA ANGLE WOULD CHANGE EVEN SLIGHTLY TO ACCOMPLISH THE EDITS BELOW: DO NOT MAKE ANY CHANGES. RETURN THE INPUT IMAGE UNCHANGED.

THE ONLY TWO CHANGES YOU WILL MAKE:

1. BACKGROUND REPLACEMENT (surgical):
   - All pixels that are NOT the athlete's skin, hair or the exercise equipment must become:
     * Bright white smooth walls (#FFFFFF)
     * Bright white polished concrete floor
     * Industrial black pendant lights (large domes) hanging from white ceiling
     * A single soft natural shadow cast by the athlete directly on the floor (depth only, minimal)
   - REMOVE: any gym equipment/machines in background, mirrors, colored walls, signage, people, any non-white surface
   - KEEP: only the athlete and the ONE piece of equipment they are using — nothing else visible

2. SHORTS LOGO PLACEMENT (surgical):
   - Locate the outer left thigh of the black athletic shorts (the left leg as seen from the camera viewpoint)
   - On that left outer thigh surface, composite this logo:
     ${logoDescription}
   - Size: precisely 3cm × 3cm
   - Position: 100% on the outer lateral face of the left thigh — NOT on the right leg, NOT on the front torso, NOT on the back
   - Do NOT move the shorts, do NOT alter the leg position or shape, do NOT change the athlete's stance
   - If you cannot place the logo without altering the leg structure: place it as close as possible to the left outer thigh

FINAL SAFETY CHECK: Before outputting, verify that the athlete's pose is IDENTICAL to the input. If even one limb angle has changed, start over or return the input unchanged.

Output: A refined image with only background and logo edited. Input pose, angle, and equipment geometry: UNCHANGED.`;

  const safePrompt = prompt.length > 2950 ? prompt.slice(0, 2950) : prompt;

  const res = await fetch(`${KIE_API_BASE}/flux/kontext/generate`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify({
      model: 'flux-kontext-max',
      prompt: safePrompt,
      inputImage: imageUrl,
      aspectRatio: '9:16',
      outputFormat: 'jpeg',
      safetyTolerance: 6,
    }),
  });
  const json = (await res.json()) as { code: number; msg: string; data: { taskId: string } };
  if (json.code !== 200) {
    throw new Error(`KIE Flux Kontext refinement error ${json.code}: ${json.msg}`);
  }

  return await pollFluxTask(json.data.taskId);
}

/**
 * Generate a fitness scene image using Flux Kontext Max (image-to-image mode).
 * The referenceImageUrl is passed as inputImage so Flux Kontext uses the athlete
 * reference photo as the identity anchor, then applies the full Claude prompt.
 * This ensures physique, skin, clothing and general appearance stay consistent.
 * Uses flux-kontext-max for highest quality output.
 * Returns the URL of the generated image.
 */
export async function generateImageFromReference(
  promptText: string,
  referenceImageUrl: string,
): Promise<string> {
  // Prefix tells Flux that inputImage is ONLY an identity anchor — pose must come from the text prompt.
  // Without this, Flux preserves the standing reference pose instead of generating the exercise.
  const identityPrefix =
    'IMPORTANT: The input image is provided SOLELY as a facial identity and skin tone reference. ' +
    'You MUST COMPLETELY IGNORE the pose, body position, clothing, background, and composition of the input image. ' +
    'Generate the subject performing the exercise described below — the pose, camera angle, ' +
    'equipment, and scene must come entirely from the text prompt. ' +
    'The ONLY elements to carry over from the input image are: the face, facial features, skin tone, and hair. ' +
    'DO NOT replicate the standing, arms-crossed, or any other pose from the reference image. ';

  const combinedPrompt = identityPrefix + promptText;
  // KIE Flux Kontext API hard limit is 3000 chars. Truncate as last-resort safety net.
  const safePrompt = combinedPrompt.length > 2950 ? combinedPrompt.slice(0, 2950) : combinedPrompt;

  // Flux Kontext uses its own dedicated endpoint — NOT /jobs/createTask
  const res = await fetch(`${KIE_API_BASE}/flux/kontext/generate`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify({
      model: 'flux-kontext-max',
      prompt: safePrompt,
      inputImage: referenceImageUrl,
      aspectRatio: '9:16',
      outputFormat: 'jpeg',
      safetyTolerance: 6,
    }),
  });
  const json = (await res.json()) as { code: number; msg: string; data: { taskId: string } };
  if (json.code !== 200) {
    throw new Error(`KIE Flux Kontext error ${json.code}: ${json.msg}`);
  }

  return await pollFluxTask(json.data.taskId);
}

/**
 * Animate an image using Kling 3.0 standard (image-to-video), pro 1080p 10s.
 * Primary video generation path — no reference video required.
 * Returns the URL of the generated video.
 */
export async function generateVideoKling3(
  imageUrl: string,
  promptText: string,
): Promise<string> {
  const safePrompt = promptText.length > 2500 ? promptText.slice(0, 2500) : promptText;

  const taskId = await createTask({
    model: 'kling-3.0/video',
    input: {
      image_urls: [imageUrl],
      prompt: safePrompt,
      sound: false,
      duration: '10',
      aspect_ratio: '9:16',
      mode: 'pro',
      multi_shots: false,
    },
  });

  const urls = await pollTask(taskId);
  if (!urls[0]) {
    throw new Error('KIE Kling 3.0 did not return a video URL');
  }
  return urls[0];
}

/**
 * Animate an image using Kling 2.6 (image-to-video).
 * Legacy fallback — kept for reference. Use generateVideoKling3 instead.
 * Returns the URL of the generated video.
 */
export async function generateVideo(
  imageUrl: string,
  promptText: string,
): Promise<string> {
  if (promptText.length > 2500) {
    throw new Error(
      `Video prompt exceeds Kling 2.6 limit (${promptText.length} chars). Claude must stay within 2500 chars.`,
    );
  }

  const taskId = await createTask({
    model: 'kling-2.6/image-to-video',
    input: {
      image_urls: [imageUrl],
      prompt: promptText,
      sound: false,
      duration: '5',
    },
  });

  const urls = await pollTask(taskId);
  const videoUrl = urls[0];
  if (!videoUrl) {
    throw new Error('KIE Kling did not return a video URL');
  }
  return videoUrl;
}

/**
 * Animate an image using Kling 3.0 motion-control (image + reference video).
 * The reference video drives the biomechanical movement frame-by-frame.
 * The generated image provides the subject appearance and background.
 * Returns the URL of the generated video.
 */
export async function generateVideoMotionControl(
  imageUrl: string,
  referenceVideoUrl: string,
  promptText: string,
): Promise<string> {
  // Kling 3.0 motion-control allows up to 2500 chars for the prompt
  const safePrompt = promptText.length > 2500 ? promptText.slice(0, 2500) : promptText;

  const taskId = await createTask({
    model: 'kling-3.0/motion-control',
    input: {
      prompt: safePrompt,
      input_urls: [imageUrl],
      video_urls: [referenceVideoUrl],
      sound: false,
      mode: '1080p',
      character_orientation: 'video',
      // Use the generated image as background source (white studio backdrop),
      // not the reference video background (real gym environment).
      background_source: 'input_image',
    },
  });

  const urls = await pollTask(taskId);
  const videoUrl = urls[0];
  if (!videoUrl) {
    throw new Error('KIE Kling 3.0 motion-control did not return a video URL');
  }
  return videoUrl;
}

/**
 * Start a Kling 3.0 video task WITHOUT polling.
 * Returns the KIE task ID immediately so the caller can store it and return.
 * Used by the pipeline to avoid blocking the Vercel function beyond its time limit.
 */
export async function startVideoKling3Task(
  imageUrl: string,
  promptText: string,
): Promise<string> {
  const safePrompt = promptText.length > 2500 ? promptText.slice(0, 2500) : promptText;
  return await createTask({
    model: 'kling-3.0/video',
    input: {
      image_urls: [imageUrl],
      prompt: safePrompt,
      sound: false,
      duration: '10',
      aspect_ratio: '9:16',
      mode: 'pro',
      multi_shots: false,
    },
  });
}

/**
 * Start a Seedance 1.5 Pro video task WITHOUT polling.
 * Seedance 1.5 Pro (bytedance/seedance-1.5-pro) — cost-effective tier with
 * solid movement quality for all exercise types.
 * Uses the same KIE /jobs/createTask and /jobs/recordInfo endpoints as Kling.
 * Returns the KIE task ID immediately — check with checkKlingTask().
 */
export async function startSeedanceTask(
  imageUrl: string,
  promptText: string,
): Promise<string> {
  const safePrompt = promptText.length > 2500 ? promptText.slice(0, 2500) : promptText;
  return await createTask({
    model: 'bytedance/seedance-1.5-pro',
    input: {
      prompt: safePrompt,
      input_urls: [imageUrl],
      aspect_ratio: '9:16',
      duration: '12',
      fixed_lens: true,
      generate_audio: false,
    },
  });
}

/**
 * Check a Kling video task once (no loop).
 * Returns the current state so the status endpoint can promote the DB record inline.
 * Also works for Seedance tasks — both use the same /jobs/recordInfo endpoint.
 */
export async function checkKlingTask(taskId: string): Promise<
  | { state: 'pending' }
  | { state: 'success'; url: string }
  | { state: 'fail'; error: string }
> {
  const res = await fetch(
    `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${process.env.KIE_KEY ?? ''}` } },
  );
  const json = (await res.json()) as {
    code: number;
    msg: string;
    data: { state: string; resultJson?: string; failMsg?: string };
  };

  if (json.code !== 200) {
    return { state: 'fail', error: `KIE error ${json.code}: ${json.msg}` };
  }

  const { state, resultJson, failMsg } = json.data;

  if (state === 'success') {
    const result = JSON.parse(resultJson!) as { resultUrls: string[] };
    const url = result.resultUrls?.[0];
    if (!url) return { state: 'fail', error: 'KIE returned success but no resultUrls' };
    return { state: 'success', url };
  }

  if (state === 'fail') {
    return { state: 'fail', error: failMsg ?? 'unknown KIE error' };
  }

  // 'waiting' | 'queuing' | 'generating'
  return { state: 'pending' };
}
