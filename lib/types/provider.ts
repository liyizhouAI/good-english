export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models: string[];
}

export type VoiceProviderId = "browser" | "dashscope" | "openai";

export interface VoiceProviderConfig {
  id: VoiceProviderId;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models: string[];
}

export interface AppSettings {
  activeProviderId: string;
  voiceProviderId: VoiceProviderId;
  providers: ProviderConfig[];
  voiceProviders: VoiceProviderConfig[];
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-5.2",
    models: [
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    defaultModel: "deepseek-v4-pro",
    models: [
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-chat",
      "deepseek-reasoner",
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    defaultModel: "anthropic/claude-sonnet-4-6",
    models: [
      "openai/gpt-5.2",
      "openai/gpt-5-mini",
      "deepseek/deepseek-v4-pro",
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
      "moonshotai/kimi-k2.5",
    ],
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
];

export const DEFAULT_VOICE_PROVIDERS: VoiceProviderConfig[] = [
  {
    id: "browser",
    name: "浏览器内置语音识别",
    baseUrl: "browser://web-speech",
    apiKey: "",
    defaultModel: "browser-web-speech",
    models: ["browser-web-speech"],
  },
  {
    id: "dashscope",
    name: "阿里云 DashScope ASR",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    defaultModel: "qwen3-asr-flash",
    models: ["qwen3-asr-flash"],
  },
  {
    id: "openai",
    name: "OpenAI Transcribe",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4o-mini-transcribe",
    models: ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"],
  },
];

export const RETIRED_PROVIDER_IDS = ["qwen", "minimax"];
