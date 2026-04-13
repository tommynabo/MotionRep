import { createFalClient } from '@fal-ai/client';

const fal = createFalClient({ credentials: () => process.env.FAL_KEY ?? '' });

/**
 * Generate a static image using Flux Pro 1.1
 * Returns the URL of the generated image.
 */
export async function generateImage(prompt: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (fal.subscribe as any)('fal-ai/flux-pro/v1.1', {
    input: {
      prompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      safety_tolerance: '5',
    },
  }) as { data: { images: Array<{ url: string }> } };

  const imageUrl = result?.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('Flux did not return an image URL');
  }
  return imageUrl;
}

/**
 * Animate an image using Kling AI (image-to-video)
 * Returns the URL of the generated video.
 */
export async function generateVideo(imageUrl: string, prompt: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (fal.subscribe as any)('fal-ai/kling-video/v1.6/pro/image-to-video', {
    input: {
      image_url: imageUrl,
      prompt: `${prompt} Smooth, professional fitness demonstration. Perfect biomechanical form. Slow, controlled movement showcasing proper muscle engagement and joint alignment. Cinematic quality.`,
      duration: '5',
      aspect_ratio: '16:9',
    },
  }) as { data: { video: { url: string } } };

  const videoUrl = result?.data?.video?.url;
  if (!videoUrl) {
    throw new Error('Kling did not return a video URL');
  }
  return videoUrl;
}
