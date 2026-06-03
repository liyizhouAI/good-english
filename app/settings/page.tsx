"use client";

import { useState } from "react";
import { useSettings } from "@/lib/hooks/use-settings";
import { LoginCard } from "@/components/auth/login-card";
import {
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Mic,
  CloudUpload,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ProviderTestState = {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
};

function formatApiError(error: unknown) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);

  const payload = error as { code?: unknown; message?: unknown };
  const code = typeof payload.code === "string" ? payload.code : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  if (code && message) return `${code}: ${message}`;
  if (message) return message;
  if (code) return code;
  return JSON.stringify(error);
}

function getVoiceErrorHint(status: number, errorMessage: string) {
  const text = errorMessage.toLowerCase();

  if (
    text.includes("invalid_api_key") ||
    text.includes("incorrect api key") ||
    text.includes("apikey") ||
    text.includes("api key")
  ) {
    return "请重新在阿里云控制台创建或复制 DashScope API Key。";
  }

  if (
    text.includes("quota") ||
    text.includes("balance") ||
    text.includes("billing") ||
    text.includes("insufficient") ||
    text.includes("arrears")
  ) {
    return "请到费用中心充值，或确认 DashScope 账户还有可用额度。";
  }

  if (
    text.includes("model") ||
    text.includes("qwen3-asr") ||
    status === 404
  ) {
    return "请确认 DashScope 语音识别服务已开通，并保持当前 ASR 模型。";
  }

  return "请复制这条错误提示给 Codex 继续排查，不要发送 API Key。";
}

function isBrowserSpeechSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(
    "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
  );
}

function getVoiceBadge(provider?: { id: string; defaultModel: string }) {
  if (!provider) return "未选择";
  if (provider.id === "browser") return "无需 API Key";
  if (provider.id === "dashscope") return "DashScope ASR";
  return provider.defaultModel;
}

export default function SettingsPage() {
  const {
    settings,
    syncing,
    synced,
    updateProvider,
    updateVoiceProvider,
    setActiveProvider,
    setVoiceProvider,
    forceSave,
  } = useSettings();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<
    Record<string, "idle" | "testing" | "success" | "error">
  >({});
  const [voiceTestStatus, setVoiceTestStatus] = useState<
    Record<string, ProviderTestState>
  >({});
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "ok" | "not_logged_in" | "error"
  >("idle");

  async function handleForceSave() {
    setSaveStatus("saving");
    const result = await forceSave();
    setSaveStatus(result);
    setTimeout(() => setSaveStatus("idle"), 3000);
  }

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

  async function testVoiceProvider(providerId: string) {
    const provider = settings.voiceProviders.find((p) => p.id === providerId);
    if (provider?.id === "browser") {
      setVoiceTestStatus((prev) => ({
        ...prev,
        [providerId]: isBrowserSpeechSupported()
          ? {
              status: "success",
              message: "当前浏览器支持内置语音识别，无需 API Key。",
            }
          : {
              status: "error",
              message:
                "当前浏览器不支持内置语音识别。请用 Chrome，或切换到阿里云 DashScope ASR。",
            },
      }));
      return;
    }

    if (!provider?.apiKey) {
      setVoiceTestStatus((prev) => ({
        ...prev,
        [providerId]: { status: "error", message: "先填入 API Key" },
      }));
      return;
    }

    setVoiceTestStatus((prev) => ({
      ...prev,
      [providerId]: { status: "testing", message: "正在用官方样例音频测试..." },
    }));

    try {
      const form = new FormData();
      form.append("providerId", provider.id);
      form.append("apiKey", provider.apiKey);
      form.append("model", provider.defaultModel);
      form.append("baseUrl", provider.baseUrl);
      form.append("testAudio", "dashscope-welcome");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as {
        text?: string;
        error?: unknown;
      } | null;

      if (!res.ok) {
        const errorMessage = formatApiError(payload?.error);
        const message = `HTTP ${res.status}：${errorMessage} ${getVoiceErrorHint(
          res.status,
          errorMessage,
        )}`;
        setVoiceTestStatus((prev) => ({
          ...prev,
          [providerId]: { status: "error", message },
        }));
        return;
      }

      setVoiceTestStatus((prev) => ({
        ...prev,
        [providerId]: {
          status: "success",
          message: payload?.text
            ? `识别成功：${payload.text}`
            : "识别接口已打通",
        },
      }));
    } catch (error) {
      setVoiceTestStatus((prev) => ({
        ...prev,
        [providerId]: {
          status: "error",
          message: error instanceof Error ? error.message : "网络异常",
        },
      }));
    }
  }

  const activeVoiceProvider = settings.voiceProviders.find(
    (p) => p.id === settings.voiceProviderId,
  );
  const activeVoiceBadge = getVoiceBadge(activeVoiceProvider);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">AI 设置</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        配置 AI 服务商，登录后 API Key 自动加密同步到云端
      </p>

      <LoginCard syncing={syncing} synced={synced} />

      {/* Voice */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="font-semibold">语音识别</h3>
          <span className="ml-auto text-xs rounded-full bg-[var(--primary)] text-white px-2 py-0.5">
            {activeVoiceBadge}
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          默认使用浏览器内置语音识别；OpenAI API 欠费时不要选 OpenAI。浏览器不支持或识别不稳时，再切换到阿里云 DashScope ASR。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://bailian.console.aliyun.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            阿里控制台
          </a>
          <a
            href="https://billing-cost.console.aliyun.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
          >
            <CreditCard className="h-3.5 w-3.5" />
            费用中心
          </a>
        </div>
        <div className="mt-4 space-y-3">
          {settings.voiceProviders.map((provider) => {
            const isActive = settings.voiceProviderId === provider.id;
            const keyId = `voice:${provider.id}`;
            const needsApiKey = provider.id !== "browser";
            const showModelSelect = needsApiKey && provider.models.length > 1;
            const voiceStatus =
              voiceTestStatus[provider.id] ?? ({ status: "idle" } as const);
            return (
              <div
                key={provider.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  isActive
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                    : "border-[var(--border)] bg-[var(--background)]",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{provider.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {provider.id === "browser"
                        ? "使用当前浏览器的 Web Speech API，不走外部模型 API"
                        : provider.baseUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => setVoiceProvider(provider.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]",
                    )}
                  >
                    {isActive ? "当前语音" : "切换"}
                  </button>
                </div>
                <div className="flex gap-2">
                  {needsApiKey ? (
                    <div className="relative flex-1">
                      <input
                        data-testid={`voice-api-key-${provider.id}`}
                        type={showKeys[keyId] ? "text" : "password"}
                        value={provider.apiKey}
                        onChange={(e) =>
                          updateVoiceProvider(provider.id, {
                            apiKey: e.target.value,
                          })
                        }
                        placeholder="sk-... (填入后自动保存到本地)"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base outline-none transition-colors focus:border-[var(--primary)]"
                      />
                      <button
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            [keyId]: !prev[keyId],
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showKeys[keyId] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                      不需要 API Key。支持情况取决于浏览器，推荐 Chrome。
                    </div>
                  )}
                  <button
                    data-testid={`voice-test-${provider.id}`}
                    onClick={() => testVoiceProvider(provider.id)}
                    disabled={
                      (needsApiKey && !provider.apiKey) ||
                      voiceStatus.status === "testing"
                    }
                    className={cn(
                      "flex min-w-24 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--muted)] disabled:opacity-50",
                      voiceStatus.status === "success" &&
                        "bg-emerald-500/15 text-emerald-500",
                      voiceStatus.status === "error" &&
                        "bg-red-500/15 text-red-500",
                    )}
                  >
                    {voiceStatus.status === "testing" ? (
                      "测试中..."
                    ) : voiceStatus.status === "success" ? (
                      <>
                        <Check className="h-4 w-4" />
                        已通
                      </>
                    ) : voiceStatus.status === "error" ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        失败
                      </>
                    ) : (
                      "测试识别"
                    )}
                  </button>
                </div>
                {showModelSelect ? (
                  <select
                    data-testid={`voice-model-${provider.id}`}
                    value={provider.defaultModel}
                    onChange={(e) =>
                      updateVoiceProvider(provider.id, {
                        defaultModel: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  >
                    {provider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : null}
                {voiceStatus.message && (
                  <p
                    data-testid={`voice-test-result-${provider.id}`}
                    className={cn(
                      "mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed",
                      voiceStatus.status === "success"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : voiceStatus.status === "error"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                    )}
                  >
                    {voiceStatus.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Providers */}
      <div className="space-y-4 mb-8">
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
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base outline-none focus:border-[var(--primary)] transition-colors"
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

      {/* Save Button */}
      <div className="border-t border-[var(--border)] pt-6 flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">
          {saveStatus === "ok" && "✓ 已同步到云端，多端登录后自动恢复"}
          {saveStatus === "not_logged_in" && "⚠ 请先登录 Google 才能云端同步"}
          {saveStatus === "error" && "✗ 同步失败，请检查网络或重试"}
          {saveStatus === "idle" && synced && "上次同步成功"}
          {saveStatus === "idle" &&
            !synced &&
            "登录后点击保存，API Key 加密同步到云端"}
        </p>
        <button
          onClick={handleForceSave}
          disabled={saveStatus === "saving"}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
            saveStatus === "ok"
              ? "bg-emerald-500/20 text-emerald-400"
              : saveStatus === "error" || saveStatus === "not_logged_in"
                ? "bg-red-500/20 text-red-400"
                : "bg-[var(--primary)] text-white hover:opacity-90",
          )}
        >
          <CloudUpload className="h-4 w-4" />
          {saveStatus === "saving"
            ? "保存中..."
            : saveStatus === "ok"
              ? "已保存"
              : "保存设置"}
        </button>
      </div>
    </div>
  );
}
