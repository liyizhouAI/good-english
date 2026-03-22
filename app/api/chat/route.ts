import { streamText, type ModelMessage } from "ai";
import { getModel } from "@/lib/ai/providers";
import type { ProviderConfig } from "@/lib/types/provider";

export async function POST(req: Request) {
  const { messages, provider, systemPrompt } = (await req.json()) as {
    messages: ModelMessage[];
    provider: ProviderConfig;
    systemPrompt?: string;
  };

  if (!provider?.apiKey) {
    return new Response("API key is required", { status: 400 });
  }

  let model;
  try {
    model = getModel(provider);
  } catch (e) {
    return new Response(`Provider error: ${e}`, { status: 500 });
  }

  try {
    const result = streamText({
      model,
      system:
        systemPrompt || "You are a helpful English tutor. Respond concisely.",
      messages,
    });
    return result.toTextStreamResponse();
  } catch (e) {
    return new Response(`Model error: ${e}`, { status: 500 });
  }
}
