"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type AppSettings,
  type ProviderConfig,
  DEFAULT_PROVIDERS,
} from "@/lib/types/provider";

const SETTINGS_KEY = "good-english-settings";

function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return {
      activeProviderId: "qwen",
      voiceProviderId: "openai",
      providers: DEFAULT_PROVIDERS,
    };
  }
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed: AppSettings = JSON.parse(stored);
      // Merge any new providers from DEFAULT_PROVIDERS that don't exist yet
      const existingIds = new Set(parsed.providers.map((p) => p.id));
      const newProviders = DEFAULT_PROVIDERS.filter(
        (p) => !existingIds.has(p.id),
      );
      return {
        activeProviderId: parsed.activeProviderId ?? "qwen",
        voiceProviderId: parsed.voiceProviderId ?? "openai",
        providers: [...parsed.providers, ...newProviders],
      };
    }
  } catch {
    // ignore
  }
  return {
    activeProviderId: "qwen",
    voiceProviderId: "openai",
    providers: DEFAULT_PROVIDERS,
  };
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const SSR_DEFAULTS: AppSettings = {
  activeProviderId: "qwen",
  voiceProviderId: "openai",
  providers: DEFAULT_PROVIDERS,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(SSR_DEFAULTS);

  useEffect(() => {
    setSettings(loadSettings());
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
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const setActiveProvider = useCallback((providerId: string) => {
    setSettings((prev) => {
      const next = { ...prev, activeProviderId: providerId };
      saveSettings(next);
      return next;
    });
  }, []);

  const setVoiceProvider = useCallback(
    (voiceProviderId: "openai" | "minimax") => {
      setSettings((prev) => {
        const next = { ...prev, voiceProviderId };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const getActiveProvider = useCallback((): ProviderConfig | undefined => {
    return settings.providers.find((p) => p.id === settings.activeProviderId);
  }, [settings]);

  const getVoiceProvider = useCallback((): ProviderConfig | undefined => {
    return settings.providers.find((p) => p.id === settings.voiceProviderId);
  }, [settings]);

  return {
    settings,
    updateProvider,
    setActiveProvider,
    setVoiceProvider,
    getActiveProvider,
    getVoiceProvider,
  };
}
