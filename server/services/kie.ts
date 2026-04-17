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
    `Make EXACTLY two targeted edits to this fitness image — preserve everything else pixel-perfect:

EDIT 1 — BACKGROUND: Transform the background into a premium rented fitness studio. White bright walls, smooth polished white concrete floor, large industrial pendant lights hanging from a white ceiling. The floor beneath the athlete should have a faint soft natural shadow — realistic and grounded, not dramatic. REMOVE from the background: any non-white walls, dark gym atmosphere, rubber flooring, mirror walls, visible signage, multiple machines in background, any coloured surfaces. The ONLY objects that may remain visible are the athlete and the specific equipment being used in this image. The result must feel like an exclusive high-end studio hired for a professional fitness shoot: minimal, architectural, all-white — but real and three-dimensional, not a cut-out.

EDIT 2 — SHORTS LOGO: On the outer left thigh of the black athletic shorts (the left leg as seen facing the camera), print ${logoDescription}. The logo sits on the outer lateral face of the left thigh only — NOT on the right leg, NOT on the front, NOT on the back. Size: approximately 3 × 3 cm. Clearly visible against the black fabric.

STRICT PRESERVATION: The athlete's face identity, skin tone, hair, muscle definition, body proportions, pose, joint angles, and all exercise equipment must remain completely unchanged from the input image. Only the background and the shorts logo may differ.`;

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
  // KIE Flux Kontext API hard limit is 3000 chars. Truncate as last-resort safety net.
  const safePrompt = promptText.length > 2950 ? promptText.slice(0, 2950) : promptText;

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
      image_url: imageUrl,
      prompt: safePrompt,
      sound: false,
      duration: 10,
      aspect_ratio: '9:16',
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
