import type { ImagePromptJson, VideoPromptJson } from './claude.js';
import { assembleImagePromptText, assembleVideoPromptText } from './claude.js';

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
 * Generate a static image using Flux Kontext Pro (image-to-image).
 * Uses the reference model photo to preserve facial identity.
 * Produces a pure white background instructional fitness image.
 * Returns the URL of the generated image.
 */
export async function generateImageFromReference(
  imagePromptJson: ImagePromptJson,
  referenceImageUrl: string,
): Promise<string> {
  const promptText = assembleImagePromptText(imagePromptJson);

  const taskId = await createTask({
    model: 'flux1-kontext',
    input: {
      image_url: referenceImageUrl,
      prompt: promptText,
      aspect_ratio: '9:16',
      resolution: '1K',
    },
  });

  const urls = await pollTask(taskId);
  const imageUrl = urls[0];
  if (!imageUrl) {
    throw new Error('KIE Flux Kontext did not return an image URL');
  }
  return imageUrl;
}

/**
 * Animate an image using Kling 2.6 (image-to-video).
 * Accepts a structured VideoPromptJson to drive movement fidelity.
 * Returns the URL of the generated video.
 */
export async function generateVideo(
  imageUrl: string,
  videoPromptJson: VideoPromptJson,
): Promise<string> {
  const promptText = assembleVideoPromptText(videoPromptJson);

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
