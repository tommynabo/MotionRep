import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Ask Claude 3.5 to assemble the perfect generation prompt.
 * Returns a single English string ready for Flux.
 */
export async function buildGenerationPrompt(params: {
  exerciseName: string;
  baseTechnique: string;
  cameraAngle: string;
  cameraModifier: string;
  userObservations: string;
  masterPromptTemplate: string;
}): Promise<string> {
  const { exerciseName, baseTechnique, cameraAngle, cameraModifier, userObservations, masterPromptTemplate } = params;

  const systemMessage = `You are an expert at writing hyper-realistic, cinematic AI image generation prompts for fitness biomechanics videos.
Your task: assemble ONE single paragraph in English — a precise, clinical, and hyper-detailed prompt ready for an image generation model (Flux Pro).
Rules:
- Output ONLY the final prompt text. No preamble, no explanation, no quotes.
- Incorporate all technical details about the correct exercise form.
- Include the camera angle naturally in the description.
- Make muscle engagement, body position, lighting, and environment vivid and specific.
- The result must be photorealistic and suitable for instructional fitness content.`;

  const userMessage = `Exercise: ${exerciseName}
Correct technique (biomechanics reference): ${baseTechnique}
Camera angle: ${cameraAngle} — ${cameraModifier}
Coach observations for this specific shot: ${userObservations || 'None — use standard perfect form'}
Master prompt template for style/environment reference:
${masterPromptTemplate}

Assemble the final image generation prompt now.`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
    system: systemMessage,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API');
  }

  return content.text.trim();
}
