import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import type { ProviderConfig } from '@/lib/types/provider';

export async function POST(req: Request) {
  const { content, provider } = await req.json() as {
    content: string;
    provider: ProviderConfig;
  };

  if (!provider?.apiKey) {
    return new Response('API key is required', { status: 400 });
  }

  const model = getModel(provider);

  const { text } = await generateText({
    model,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Analyze the following content and extract vocabulary, sentence patterns, and key phrases:\n\n${content}`,
  });

  // Parse JSON from the response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Failed to parse extraction result' }, { status: 500 });
    }
    const result = JSON.parse(jsonMatch[0]);
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Failed to parse extraction result', raw: text }, { status: 500 });
  }
}
