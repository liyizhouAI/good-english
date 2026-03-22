"use client";

import { useState } from "react";
import { useSettings } from "@/lib/hooks/use-settings";
import { Eye, EyeOff, Check, AlertCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const VOICE_PROVIDERS = [
  {
    id: "openai" as const,
    name: "OpenAI Whisper",
    desc: "识别率最高，支持多语言，需要 OpenAI API Key",
    supported: true,
  },
  {
    id: "minimax" as const,
    name: "MiniMax 语音识别",
    desc: "MiniMax speech-01 模型，中英文识别，需要 MiniMax API Key",
    supported: true,
  },
];

export default function SettingsPage() {
  const { settings, updateProvider, setActiveProvider, setVoiceProvider } =
    useSettings();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<
    Record<string, "idle" | "testing" | "success" | "error">
  >({});

  async function testConnection(providerId: string) {
    const provider = settings.providers.find((p) => p.id === providerId);
    if (!provider?.apiKey) return;

    setTestStatus((prev) => ({ ...prev, [providerId]: "testing" }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: 'Hello, respond with just "OK"' },
          ],
          provider,
        }),
      });
      setTestStatus((prev) => ({
        ...prev,
        [providerId]: res.ok ? "success" : "error",
      }));
    } catch {
      setTestStatus((prev) => ({ ...prev, [providerId]: "error" }));
    }
    setTimeout(() => {
      setTestStatus((prev) => ({ ...prev, [providerId]: "idle" }));
    }, 3000);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">AI 设置</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        配置 AI 服务商，API Key 仅存储在你的浏览器本地
      </p>

      {/* Voice Provider */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="font-semibold">语音识别引擎</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {VOICE_PROVIDERS.map((vp) => {
            const isSelected = settings.voiceProviderId === vp.id;
            const providerConfig = settings.providers.find(
              (p) => p.id === vp.id,
            );
            const hasKey = !!providerConfig?.apiKey;
            return (
              <button
                key={vp.id}
                onClick={() => vp.supported && setVoiceProvider(vp.id)}
                disabled={!vp.supported}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  !vp.supported
                    ? "border-[var(--border)] opacity-50 cursor-not-allowed"
                    : isSelected
                      ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--muted)]",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{vp.name}</p>
                  {!vp.supported ? (
                    <span className="text-xs rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] px-2 py-0.5">
                      暂不支持
                    </span>
                  ) : isSelected ? (
                    <span className="text-xs rounded-full bg-[var(--primary)] text-white px-2 py-0.5">
                      使用中
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {vp.desc}
                </p>
                {vp.supported && (
                  <p
                    className={cn(
                      "text-xs mt-2 font-medium",
                      hasKey ? "text-emerald-400" : "text-amber-400",
                    )}
                  >
                    {hasKey ? "✓ API Key 已配置" : "⚠ 需配置 API Key"}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Providers */}
      <div className="space-y-4">
        {settings.providers.map((provider) => {
          const isActive = settings.activeProviderId === provider.id;
          const status = testStatus[provider.id] || "idle";

          return (
            <div
              key={provider.id}
              className={cn(
                "rounded-xl border p-5 transition-colors",
                isActive
                  ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                  : "border-[var(--border)] bg-[var(--card)]",
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {provider.baseUrl}
                  </p>
                </div>
                <button
                  onClick={() => setActiveProvider(provider.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]",
                  )}
                >
                  {isActive ? "当前使用" : "切换"}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKeys[provider.id] ? "text" : "password"}
                        value={provider.apiKey}
                        onChange={(e) =>
                          updateProvider(provider.id, {
                            apiKey: e.target.value,
                          })
                        }
                        placeholder="sk-... (填入后自动保存到本地)"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] transition-colors"
                      />
                      <button
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            [provider.id]: !prev[provider.id],
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showKeys[provider.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => testConnection(provider.id)}
                      disabled={!provider.apiKey || status === "testing"}
                      className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
                    >
                      {status === "testing" ? (
                        "测试中..."
                      ) : status === "success" ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        "测试"
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                    默认模型
                  </label>
                  <select
                    value={provider.defaultModel}
                    onChange={(e) =>
                      updateProvider(provider.id, {
                        defaultModel: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  >
                    {provider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
