"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type AppSettings,
  type ProviderConfig,
  DEFAULT_PROVIDERS,
} from "@/lib/types/provider";
import { createClient } from "@/lib/supabase/client";
import { loadRemoteSettings, saveRemoteSettings } from "@/lib/supabase/settings-sync";

const SETTINGS_KEY = "good-english-settings";

const DEFAULT_SETTINGS: AppSettings = {
  activeProviderId: "qwen",
  voiceProviderId: "openai",
  providers: DEFAULT_PROVIDERS,
};

function loadLocalSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed: AppSettings = JSON.parse(stored);
      const existingIds = new Set(parsed.providers.map((p) => p.id));
      const newProviders = DEFAULT_PROVIDERS.filter((p) => !existingIds.has(p.id));
      return {
        activeProviderId: parsed.activeProviderId ?? "qwen",
        voiceProviderId: parsed.voiceProviderId ?? "openai",
        providers: [...parsed.providers, ...newProviders],
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Merge remote settings (remote keys win, but keep local keys for providers not in remote)
function mergeSettings(local: AppSettings, remote: AppSettings): AppSettings {
  const remoteIds = new Set(remote.providers.map((p) => p.id));
  const localOnly = local.providers.filter((p) => !remoteIds.has(p.id));
  return {
    activeProviderId: remote.activeProviderId,
    voiceProviderId: remote.voiceProviderId,
    providers: [...remote.providers, ...localOnly],
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setSyncing(true);
      const remote = await loadRemoteSettings(supabase);
      if (remote) {
        const merged = mergeSettings(local, remote);
        setSettings(merged);
        saveLocalSettings(merged);
      }
      setSyncing(false);
      setSynced(true);
    });

    // Re-sync when auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setSyncing(true);
        const local2 = loadLocalSettings();
        const remote = await loadRemoteSettings(supabase);
        if (remote) {
          const merged = mergeSettings(local2, remote);
          setSettings(merged);
          saveLocalSettings(merged);
        } else {
          // First login: push local settings to cloud
          await saveRemoteSettings(supabase, local2);
        }
        setSyncing(false);
        setSynced(true);
      } else {
        setSynced(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Debounced save: local immediately, remote after 1s
  const persistSettings = useCallback((next: AppSettings) => {
    saveLocalSettings(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await saveRemoteSettings(supabase, next);
      }
    }, 1000);
  }, []);

  const updateProvider = useCallback((providerId: string, updates: Partial<ProviderConfig>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providers: prev.providers.map((p) =>
          p.id === providerId ? { ...p, ...updates } : p
        ),
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const setActiveProvider = useCallback((providerId: string) => {
    setSettings((prev) => {
      const next = { ...prev, activeProviderId: providerId };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const setVoiceProvider = useCallback((voiceProviderId: "openai" | "minimax") => {
    setSettings((prev) => {
      const next = { ...prev, voiceProviderId };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const getActiveProvider = useCallback((): ProviderConfig | undefined => {
    return settings.providers.find((p) => p.id === settings.activeProviderId);
  }, [settings]);

  const getVoiceProvider = useCallback((): ProviderConfig | undefined => {
    return settings.providers.find((p) => p.id === settings.voiceProviderId);
  }, [settings]);

  return {
    settings,
    syncing,
    synced,
    updateProvider,
    setActiveProvider,
    setVoiceProvider,
    getActiveProvider,
    getVoiceProvider,
  };
}
