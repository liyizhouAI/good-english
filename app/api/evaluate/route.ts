import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import type { ProviderConfig } from '@/lib/types/provider';

export async function POST(req: Request) {
  const { type, pattern, userAnswer, chineseSentence, provider } = await req.json() as {
    type: 'fill-blank' | 'translation';
    pattern?: string;
    userAnswer: string;
    chineseSentence?: string;
    provider: ProviderConfig;
  };

  if (!provider?.apiKey) {
    return new Response('API key is required', { status: 400 });
  }

  const model = getModel(provider);

  let prompt: string;
  if (type === 'fill-blank') {
    prompt = `Evaluate this fill-in-the-blank answer.
Pattern: "${pattern}"
User's answer: "${userAnswer}"

Return JSON:
{
  "correct": true/false,
  "score": 1-10,
  "feedback": "English feedback",
  "feedbackChinese": "中文反馈",
  "suggestedAnswer": "the best answer"
}`;
  } else {
    prompt = `Evaluate this Chinese-to-English translation.
Chinese: "${chineseSentence}"
Target pattern: "${pattern}"
User's translation: "${userAnswer}"

Return JSON:
{
  "score": 1-10,
  "accuracy": 1-10,
  "naturalness": 1-10,
  "feedback": "English feedback",
  "feedbackChinese": "中文反馈",
  "suggestedTranslation": "best English translation"
}`;
  }

  const { text } = await generateText({
    model,
    system: 'You are an English language evaluator. Return only valid JSON.',
    prompt,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Failed to parse' }, { status: 500 });
    }
    return Response.json(JSON.parse(jsonMatch[0]));
  } catch {
    return Response.json({ error: 'Failed to parse', raw: text }, { status: 500 });
  }
}
