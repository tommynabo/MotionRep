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
 * Stage 1 — Generate a scene image from text using Flux Pro 1.1 (txt2img).
 * Generates the correct exercise, white background and full-body framing
 * purely from the Claude-assembled prompt, with no reference image bias.
 * Returns the URL of the generated image.
 */
export async function generateImageFromText(promptText: string): Promise<string> {
  const taskId = await createTask({
    model: 'flux/generate',
    input: {
      prompt: promptText,
      negative_prompt:
        'wrong exercise, incorrect movement, squats, lunges, deadlift, standing when should be lying, gray background, colored background, barbell through head, barbell overlapping face, cropped feet, cropped hands, partial body, close-up, portrait crop, blurry, watermark, text',
      aspect_ratio: '9:16',
      num_inference_steps: 30,
      guidance_scale: 4.5,
      model_version: 'flux-pro-1.1',
    },
  });

  const urls = await pollTask(taskId);
  const imageUrl = urls[0];
  if (!imageUrl) {
    throw new Error('KIE Flux Pro 1.1 did not return an image URL');
  }
  return imageUrl;
}

/**
 * Stage 2 — Face transfer using Flux Kontext Pro (image-to-image).
 * Takes the scene image generated in Stage 1 and transfers the athlete's
 * facial identity from the reference photo, WITHOUT changing the exercise,
 * background, equipment, framing, or any other element.
 * Returns the URL of the face-transferred image.
 */
export async function generateImageFromReference(
  sceneImageUrl: string,
  referenceImageUrl: string,
): Promise<string> {
  const faceTransferPrompt =
    'Transfer only the face and head identity from the reference photo to the person in this fitness scene image. ' +
    'Preserve the exact same face shape, facial features, skin tone, eye colour, nose, lips, jaw and hair style from the reference. ' +
    'DO NOT change anything else: the exercise movement, body pose, barbell or equipment position, background, clothing, framing, or body proportions must remain identical to the input scene image. ' +
    'Only the face identity is being updated. Nothing else changes.';

  // Flux Kontext uses its own dedicated endpoint — NOT /jobs/createTask
  const res = await fetch(`${KIE_API_BASE}/flux/kontext/generate`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify({
      model: 'flux-kontext-pro',
      prompt: faceTransferPrompt,
      inputImage: sceneImageUrl,
      referenceImage: referenceImageUrl,
      aspectRatio: '9:16',
      outputFormat: 'jpeg',
    }),
  });
  const json = (await res.json()) as { code: number; msg: string; data: { taskId: string } };
  if (json.code !== 200) {
    throw new Error(`KIE Flux Kontext face-transfer error ${json.code}: ${json.msg}`);
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
