"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  type AppSettings,
  type ProviderConfig,
  type VoiceProviderConfig,
  type VoiceProviderId,
  DEFAULT_PROVIDERS,
  DEFAULT_VOICE_PROVIDERS,
  RETIRED_PROVIDER_IDS,
} from "@/lib/types/provider";
import { createClient } from "@/lib/supabase/client";
import {
  loadRemoteSettings,
  saveRemoteSettings,
} from "@/lib/supabase/settings-sync";

const SETTINGS_KEY = "good-english-settings";
const RETIRED_PROVIDER_ID_SET = new Set(RETIRED_PROVIDER_IDS);
const PROVIDER_PRIORITY = ["deepseek", "openrouter", "kimi", "openai"];
const VOICE_PROVIDER_IDS = new Set<VoiceProviderId>([
  "browser",
  "dashscope",
  "openai",
]);
const LEGACY_DEFAULT_MODELS: Record<string, Set<string>> = {
  openai: new Set(["gpt-5.5", "gpt-5.5-mini", "gpt-4.5"]),
  deepseek: new Set(["deepseek-chat", "deepseek-reasoner"]),
};

const DEFAULT_SETTINGS: AppSettings = {
  activeProviderId: "deepseek",
  voiceProviderId: "browser",
  providers: DEFAULT_PROVIDERS,
  voiceProviders: DEFAULT_VOICE_PROVIDERS,
};
const SYNC_TIMEOUT_MS = 8000;

function loadLocalSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const normalized = normalizeSettings(JSON.parse(stored) as AppSettings);
      saveLocalSettings(normalized);
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("sync timeout")), ms),
    ),
  ]);
}

// Merge remote settings (remote keys win, but keep local keys for providers not in remote)
function mergeSettings(local: AppSettings, remote: AppSettings): AppSettings {
  const normalizedRemote = normalizeSettings(remote);
  const normalizedLocal = normalizeSettings(local);
  const remoteIds = new Set(normalizedRemote.providers.map((p) => p.id));
  const localOnly = normalizedLocal.providers.filter((p) => !remoteIds.has(p.id));
  const remoteVoiceIds = new Set(
    normalizedRemote.voiceProviders.map((p) => p.id),
  );
  const localOnlyVoice = normalizedLocal.voiceProviders.filter(
    (p) => !remoteVoiceIds.has(p.id),
  );
  return normalizeSettings({
    activeProviderId: normalizedRemote.activeProviderId,
    voiceProviderId: normalizedRemote.voiceProviderId,
    providers: [...normalizedRemote.providers, ...localOnly],
    voiceProviders: [...normalizedRemote.voiceProviders, ...localOnlyVoice],
  });
}

function chooseActiveProvider(providers: ProviderConfig[], preferred?: string) {
  const providerIds = new Set(providers.map((provider) => provider.id));
  if (preferred && providerIds.has(preferred)) {
    const provider = providers.find((item) => item.id === preferred);
    if (provider?.apiKey || preferred !== "openai") return preferred;
  }

  for (const providerId of PROVIDER_PRIORITY) {
    const provider = providers.find(
      (item) => item.id === providerId && item.apiKey,
    );
    if (provider) return provider.id;
  }

  return providerIds.has("deepseek")
    ? "deepseek"
    : providers[0]?.id ?? "deepseek";
}

function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  const defaultProvider = DEFAULT_PROVIDERS.find((item) => item.id === provider.id);
  if (!defaultProvider) return provider;

  const legacyDefaults = LEGACY_DEFAULT_MODELS[provider.id];
  const shouldUseNewDefault =
    !defaultProvider.models.includes(provider.defaultModel) ||
    !!legacyDefaults?.has(provider.defaultModel);

  return {
    ...defaultProvider,
    baseUrl: provider.baseUrl || defaultProvider.baseUrl,
    apiKey: provider.apiKey ?? "",
    defaultModel: shouldUseNewDefault
      ? defaultProvider.defaultModel
      : provider.defaultModel,
  };
}

function normalizeVoiceProvider(
  provider: VoiceProviderConfig,
  fallbackApiKey = "",
): VoiceProviderConfig {
  const defaultProvider = DEFAULT_VOICE_PROVIDERS.find(
    (item) => item.id === provider.id,
  );
  if (!defaultProvider) return provider;

  return {
    ...defaultProvider,
    baseUrl: provider.baseUrl || defaultProvider.baseUrl,
    apiKey: provider.apiKey || fallbackApiKey,
    defaultModel: defaultProvider.models.includes(provider.defaultModel)
      ? provider.defaultModel
      : defaultProvider.defaultModel,
  };
}

function chooseVoiceProvider(
  providers: VoiceProviderConfig[],
  preferred?: string,
): VoiceProviderId {
  const providerIds = new Set(providers.map((provider) => provider.id));
  if (
    preferred === "browser" ||
    preferred === "dashscope" ||
    preferred === "openai"
  ) {
    if (providerIds.has(preferred)) return preferred;
  }

  return "browser";
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const activeProviderId = RETIRED_PROVIDER_ID_SET.has(settings.activeProviderId)
    ? undefined
    : settings.activeProviderId;
  const rawProviders = settings.providers ?? [];
  const legacyDashScopeApiKey =
    rawProviders.find((provider) => provider.id === "qwen")?.apiKey ?? "";
  const legacyOpenAIApiKey =
    rawProviders.find((provider) => provider.id === "openai")?.apiKey ?? "";
  const providers = rawProviders.filter(
    (provider) => !RETIRED_PROVIDER_ID_SET.has(provider.id),
  ).map(normalizeProvider);
  const existingIds = new Set(providers.map((provider) => provider.id));
  const newProviders = DEFAULT_PROVIDERS.filter(
    (provider) => !existingIds.has(provider.id),
  );
  const mergedProviders = [...providers, ...newProviders];
  const hasSavedVoiceProviders = Array.isArray(settings.voiceProviders);
  const rawVoiceProviders = (settings.voiceProviders ?? []).filter(
    (provider): provider is VoiceProviderConfig =>
      VOICE_PROVIDER_IDS.has(provider.id as VoiceProviderId),
  );
  const voiceProviderIds = new Set(rawVoiceProviders.map((provider) => provider.id));
  const newVoiceProviders = DEFAULT_VOICE_PROVIDERS.filter(
    (provider) => !voiceProviderIds.has(provider.id),
  );
  const mergedVoiceProviders = [...rawVoiceProviders, ...newVoiceProviders].map(
    (provider) =>
      normalizeVoiceProvider(
        provider,
        provider.id === "dashscope" ? legacyDashScopeApiKey : legacyOpenAIApiKey,
      ),
  );
  const savedVoiceProvider = mergedVoiceProviders.find(
    (provider) => provider.id === settings.voiceProviderId,
  );
  const preferredVoiceProviderId =
    settings.voiceProviderId === "browser" || savedVoiceProvider?.apiKey
      ? settings.voiceProviderId
      : undefined;

  return {
    activeProviderId: chooseActiveProvider(mergedProviders, activeProviderId),
    voiceProviderId: chooseVoiceProvider(
      mergedVoiceProviders,
      hasSavedVoiceProviders ? preferredVoiceProviderId : undefined,
    ),
    providers: mergedProviders,
    voiceProviders: mergedVoiceProviders,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load local on mount, then try remote
  useEffect(() => {
    const local = loadLocalSettings();
    setSettings(local);

    const supabase = createClient();
    let cancelled = false;

    async function syncSettings(baseSettings: AppSettings) {
      setSyncing(true);
      try {
        const remote = await withTimeout(
          loadRemoteSettings(supabase),
          SYNC_TIMEOUT_MS,
        );
        if (cancelled) return;

        if (remote) {
          const merged = mergeSettings(baseSettings, remote);
          setSettings(merged);
          saveLocalSettings(merged);
        } else {
          await withTimeout(
            saveRemoteSettings(supabase, baseSettings),
            SYNC_TIMEOUT_MS,
          );
        }

        if (!cancelled) {
          setSynced(true);
        }
      } catch (error) {
        console.error(
          "[settings] sync failed:",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    }

    supabase.auth.getUser().then(async (
      { data }: Awaited<ReturnType<typeof supabase.auth.getUser>>,
    ) => {
      if (!data.user || cancelled) return;
      await syncSettings(local);
    });

    // Re-sync when auth state changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (session?.user) {
        const local2 = loadLocalSettings();
        await syncSettings(local2);
      } else {
        if (!cancelled) {
          setSyncing(false);
          setSynced(false);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Debounced save: local immediately, remote after 1s
  const persistSettings = useCallback((next: AppSettings) => {
    saveLocalSettings(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        try {
          await withTimeout(
            saveRemoteSettings(supabase, next),
            SYNC_TIMEOUT_MS,
          );
          setSynced(true);
        } catch (error) {
          console.error(
            "[settings] save failed:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }, 1000);
  }, []);

  const updateProvider = useCallback(
    (providerId: string, updates: Partial<ProviderConfig>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          providers: prev.providers.map((p) =>
            p.id === providerId ? { ...p, ...updates } : p,
          ),
        };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  const setActiveProvider = useCallback(
    (providerId: string) => {
      setSettings((prev) => {
        const next = { ...prev, activeProviderId: providerId };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  const setVoiceProvider = useCallback(
    (voiceProviderId: VoiceProviderId) => {
      setSettings((prev) => {
        const next = { ...prev, voiceProviderId };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  const getActiveProvider = useCallback((): ProviderConfig | undefined => {
    return settings.providers.find((p) => p.id === settings.activeProviderId);
  }, [settings]);

  const getVoiceProvider = useCallback((): VoiceProviderConfig | undefined => {
    return settings.voiceProviders.find((p) => p.id === settings.voiceProviderId);
  }, [settings]);

  const updateVoiceProvider = useCallback(
    (providerId: VoiceProviderId, updates: Partial<VoiceProviderConfig>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          voiceProviders: prev.voiceProviders.map((p) =>
            p.id === providerId ? { ...p, ...updates } : p,
          ),
        };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  // Immediate save (no debounce) — used by the manual "保存设置" button
  const forceSave = useCallback(async (): Promise<
    "ok" | "not_logged_in" | "error"
  > => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return "not_logged_in";
    try {
      saveLocalSettings(settings);
      await withTimeout(
        saveRemoteSettings(supabase, settings),
        SYNC_TIMEOUT_MS,
      );
      setSynced(true);
      return "ok";
    } catch {
      return "error";
    }
  }, [settings]);

  return {
    settings,
    syncing,
    synced,
    updateProvider,
    updateVoiceProvider,
    setActiveProvider,
    setVoiceProvider,
    getActiveProvider,
    getVoiceProvider,
    forceSave,
  };
}
