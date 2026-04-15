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
 * Generate a static image using Flux Kontext Pro (image-to-image).
 * Uses the reference model photo to preserve facial identity.
 * Produces a pure white background instructional fitness image.
 * Returns the URL of the generated image.
 */
export async function generateImageFromReference(
  promptText: string,
  referenceImageUrl: string,
): Promise<string> {

  // Flux Kontext uses its own dedicated endpoint — NOT /jobs/createTask
  const res = await fetch(`${KIE_API_BASE}/flux/kontext/generate`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify({
      model: 'flux-kontext-pro',
      prompt: promptText,
      inputImage: referenceImageUrl,
      aspectRatio: '9:16',
      outputFormat: 'jpeg',
    }),
  });
  const json = (await res.json()) as { code: number; msg: string; data: { taskId: string } };
  if (json.code !== 200) {
    throw new Error(`KIE Flux Kontext error ${json.code}: ${json.msg}`);
  }

  return await pollFluxTask(json.data.taskId);
}

/**
 * Animate an image using Kling 2.6 (image-to-video).
 * Accepts a structured VideoPromptJson to drive movement fidelity.
 * Returns the URL of the generated video.
 */
export async function generateVideo(
  imageUrl: string,
  promptText: string,
): Promise<string> {
  // Kling 2.6 rejects prompts beyond ~2500 chars with a 400 error.
  // Use 2200 as a hard ceiling to stay safely within the limit.
  const KLING_MAX_PROMPT_LENGTH = 2200;
  const safePrompt = promptText.length > KLING_MAX_PROMPT_LENGTH
    ? promptText.slice(0, KLING_MAX_PROMPT_LENGTH)
    : promptText;

  const taskId = await createTask({
    model: 'kling-2.6/image-to-video',
    input: {
      image_urls: [imageUrl],
      prompt: safePrompt,
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
