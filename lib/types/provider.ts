export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models: string[];
}

export interface AppSettings {
  activeProviderId: string;
  voiceProviderId: "openai" | "minimax";
  providers: ProviderConfig[];
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "qwen",
    name: "Qwen (百炼)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    defaultModel: "anthropic/claude-sonnet-4-6",
    models: [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
      "openai/gpt-4o",
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    apiKey: "",
    defaultModel: "MiniMax-M2.7-highspeed",
    models: ["MiniMax-M2.7-highspeed", "MiniMax-M2.7", "MiniMax-Text-01"],
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKey: "",
    defaultModel: "kimi-k2.5",
    models: [
      "kimi-k2.5",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4.5",
    models: ["gpt-4.5", "gpt-4o", "gpt-4o-mini"],
  },
];
