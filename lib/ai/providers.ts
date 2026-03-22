import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderConfig } from '@/lib/types/provider';

export function createProvider(config: ProviderConfig) {
  return createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
}

export function getModel(config: ProviderConfig, modelId?: string) {
  const provider = createProvider(config);
  return provider(modelId || config.defaultModel);
}
