import { generateText, generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/providers";
import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { ProviderConfig } from "@/lib/types/provider";

const MAX_CONTENT_CHARS = 12_000;

const ExtractionSchema = z.object({
  words: z.array(
    z.object({
      english: z.string(),
      chinese: z.string(),
      partOfSpeech: z.string(),
      exampleSentence: z.string(),
      exampleTranslation: z.string(),
      context: z.string(),
      category: z.enum(["daily", "business", "ai-tech"]),
    }),
  ),
  patterns: z.array(
    z.object({
      pattern: z.string(),
      patternChinese: z.string(),
      scenario: z.enum([
        "self-intro",
        "ai-discussion",
        "business",
        "social",
        "interview",
      ]),
      examples: z.array(z.string()),
    }),
  ),
  keyPhrases: z.array(z.string()),
});

/**
 * Reasoning models output thinking tokens and often return empty JSON in
 * the final answer when used with generateText. Override to a non-reasoning
 * variant from the same provider as a fallback.
 */
const REASONING_FALLBACK: Record<string, string> = {
  "kimi-k2.5": "moonshot-v1-32k",
};

/**
 * Providers whose compatible-mode endpoints do not support the OpenAI
 * JSON-schema structured-output parameter used by generateObject.
 * These providers skip Strategy 1 and go straight to generateText.
 */
const TEXT_ONLY_PROVIDERS = new Set(["qwen"]);

/** Strip reasoning/thinking token blocks from model text output */
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

/** Extract a JSON object from raw model text */
function extractJson(raw: string): unknown {
  // Strip thinking blocks then markdown fences
  const text = stripThinking(raw)
    .replace(/^```(?:json|JSON)?\s*/m, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {}

  // Greedy: first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  return null;
}

function reasoningToText(reasoning: unknown): string {
  if (typeof reasoning === "string") return reasoning;
  if (!Array.isArray(reasoning)) return "";

  return reasoning
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const { content, provider } = (await req.json()) as {
    content: string;
    provider: ProviderConfig;
  };

  if (!provider?.apiKey) {
    return new Response("API key is required", { status: 400 });
  }

  const truncated =
    content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + "\n\n[... content truncated ...]"
      : content;

  const model = getModel(provider);
  const prompt = `Analyze the following content and extract vocabulary, sentence patterns, and key phrases:\n\n${truncated}`;

  // ── Strategy 1: generateObject — structured JSON mode (MiniMax M2.7, GPT, Claude) ──
  // Skipped for providers that don't support OpenAI JSON-schema mode (e.g. Qwen).
  if (!TEXT_ONLY_PROVIDERS.has(provider.id)) {
    try {
      const { object } = await generateObject({
        model,
        schema: ExtractionSchema,
        system: EXTRACTION_SYSTEM_PROMPT,
        prompt,
      });
      return Response.json(object);
    } catch (err) {
      console.log(
        "[extract] generateObject failed, falling back to generateText:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── Strategy 2: generateText — override reasoning models first ──
  const fallbackModelId = REASONING_FALLBACK[provider.defaultModel];
  const textModel = fallbackModelId
    ? getModel(provider, fallbackModelId)
    : model;

  if (fallbackModelId) {
    console.log(
      `[extract] Reasoning model ${provider.defaultModel} → using ${fallbackModelId} for generateText`,
    );
  }

  try {
    const { text, reasoning } = await generateText({
      model: textModel,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt,
    });

    // Try main text first, then reasoning content as fallback
    const result =
      extractJson(text) ??
      (reasoning ? extractJson(reasoningToText(reasoning)) : null);

    if (!result) {
      console.error(
        "[extract] JSON parse failed. text[:500]:",
        text.slice(0, 500),
      );
      return Response.json(
        {
          error: `提取失败：模型未返回有效 JSON。使用模型：${fallbackModelId ?? provider.defaultModel}。原始输出：${text.slice(0, 200)}`,
        },
        { status: 500 },
      );
    }

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract] generateText error:", msg);
    return Response.json(
      { error: `Extraction failed: ${msg}` },
      { status: 500 },
    );
  }
}
