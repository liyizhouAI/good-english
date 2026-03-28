"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSettings } from "@/lib/hooks/use-settings";
import {
  PERSONAS,
  SCENARIOS,
  buildConversationSystemPrompt,
} from "@/lib/ai/prompts";
import type {
  Persona,
  Scenario,
  Correction,
  MessageFeedback,
} from "@/lib/types/conversation";
import {
  Send,
  Loader2,
  User,
  Bot,
  AlertCircle,
  RefreshCw,
  Mic,
  MicOff,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  corrections?: Correction[];
  feedback?: MessageFeedback;
}

export default function ChatPage() {
  const { getActiveProvider, settings } = useSettings();
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    setIsRecording(false);

    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;

        if (blob.size < 1000) {
          resolve();
          return;
        }

        // 语音识别固定使用 OpenAI Whisper
        const openaiProvider = settings.providers.find(
          (p) => p.id === "openai",
        );
        if (!openaiProvider?.apiKey) {
          setError("请在设置页面配置 OpenAI API Key 以使用语音输入");
          resolve();
          return;
        }

        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob);
          form.append("apiKey", openaiProvider.apiKey);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();

          if (data.text) {
            setInput(data.text.trim());
          } else {
            const detail = data.error
              ? `：${typeof data.error === "string" ? data.error.slice(0, 120) : JSON.stringify(data.error)}`
              : "";
            setError(`语音识别失败${detail}，请重试`);
          }
        } catch (err) {
          setError(
            `语音识别出错：${err instanceof Error ? err.message : "网络异常"}，请重试`,
          );
        } finally {
          setIsTranscribing(false);
          resolve();
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [settings.providers]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setError("");
    } catch {
      setError("无法访问麦克风，请检查系统权限");
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const provider = getActiveProvider();
    if (!provider?.apiKey) {
      setError("请先在设置页面配置 AI Provider");
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError("");
    setStarted(true);

    try {
      const systemPrompt = buildConversationSystemPrompt(persona, scenario);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider,
          systemPrompt,
        }),
      });

      if (!res.ok) throw new Error("AI 响应失败");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      let fullText = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      let parsedMsg: ChatMsg = { role: "assistant", content: fullText };
      try {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.reply) {
            parsedMsg = {
              role: "assistant",
              content: parsed.reply,
              corrections: parsed.corrections,
              feedback: parsed.feedback,
            };
          }
        }
      } catch {
        // use raw text
      }

      setMessages([...newMessages, parsedMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 响应失败");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    if (isRecording) stopRecording();
    setMessages([]);
    setStarted(false);
    setError("");
  }

  const hasVoiceKey = !!settings.providers.find((p) => p.id === "openai")
    ?.apiKey;
  const micButton = (
    <button
      onClick={toggleRecording}
      disabled={isLoading || isTranscribing || !hasVoiceKey}
      title={
        !hasVoiceKey
          ? "需要配置 OpenAI API Key"
          : isRecording
            ? "再次点击停止录音"
            : "点击开始说话"
      }
      className={cn(
        "rounded-lg px-3 py-2.5 transition-all disabled:opacity-40",
        isRecording
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
          : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]",
      )}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">AI 对话模拟</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          选择角色和场景，开始练习英语对话
        </p>

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">对话角色</h3>
          <div className="grid grid-cols-2 gap-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  persona.id === p.id
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted)]",
                )}
              >
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {p.title}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">对话场景</h3>
          <div className="space-y-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  scenario.id === s.id
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted)]",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">{s.nameChinese}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {s.name}
                  </span>
                </div>
                <p className="text-xs text-[var(--secondary-foreground)] mt-1">
                  {s.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--secondary)] p-4 mb-4">
          <p className="text-sm">
            <span className="font-medium">场景设定：</span>{" "}
            <span className="text-[var(--secondary-foreground)]">
              {scenario.context}
            </span>
          </p>
          <p className="text-sm mt-1">
            <span className="font-medium">你的对话对象：</span>{" "}
            <span className="text-[var(--secondary-foreground)]">
              {persona.name} — {persona.title}
            </span>
          </p>
        </div>

        {mounted &&
          (hasVoiceKey ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 mb-4">
              <Mic className="h-4 w-4 shrink-0" />
              语音输入已就绪（OpenAI Whisper）— 点麦克风说话，停止后自动识别
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 mb-4">
              <Mic className="h-4 w-4 shrink-0" />
              语音输入需要 OpenAI API Key — 去设置页配置
            </div>
          ))}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your first message in English..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          {micButton}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Chat screen
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] md:h-[calc(100vh-3rem)] max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold">与 {persona.name} 对话</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {scenario.nameChinese} · {persona.title}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
        >
          <RefreshCw className="h-3 w-3" /> 新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "",
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <Bot className="h-4 w-4 text-[var(--primary)]" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-4 py-3",
                msg.role === "user"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--card)] border border-[var(--border)]",
              )}
            >
              <p
                className={cn(
                  "text-sm whitespace-pre-wrap",
                  msg.role === "assistant" && "font-mono leading-relaxed",
                )}
              >
                {msg.content}
              </p>

              {msg.corrections && msg.corrections.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]/50 space-y-2">
                  <p className="text-xs font-medium text-amber-400">
                    纠正建议：
                  </p>
                  {msg.corrections.map((c, j) => (
                    <div key={j} className="text-xs space-y-0.5">
                      <p>
                        <span className="text-red-400 line-through">
                          {c.original}
                        </span>{" "}
                        →{" "}
                        <span className="text-emerald-400">{c.corrected}</span>
                      </p>
                      <p className="text-[var(--muted-foreground)]">
                        {c.explanationChinese || c.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {msg.feedback && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]/50">
                  <div className="flex gap-3 text-xs">
                    <span>
                      流利度:{" "}
                      <span className="text-[var(--primary)] font-medium">
                        {msg.feedback.fluency}/10
                      </span>
                    </span>
                    <span>
                      词汇:{" "}
                      <span className="text-[var(--primary)] font-medium">
                        {msg.feedback.vocabulary}/10
                      </span>
                    </span>
                    <span>
                      语法:{" "}
                      <span className="text-[var(--primary)] font-medium">
                        {msg.feedback.grammar}/10
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {msg.feedback.overallChinese || msg.feedback.overall}
                  </p>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
                <User className="h-4 w-4 text-[var(--accent)]" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10">
              <Bot className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 mb-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {isTranscribing && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-4 py-2 text-sm text-[var(--muted-foreground)] mb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在识别语音…
        </div>
      )}

      <div className="flex gap-2 shrink-0 pt-2 border-t border-[var(--border)]">
        {micButton}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={
            isRecording
              ? "录音中，再次点击停止…"
              : "Type in English or tap mic…"
          }
          className={cn(
            "flex-1 rounded-lg border bg-[var(--card)] px-4 py-2.5 text-sm outline-none",
            isRecording
              ? "border-red-500/50"
              : "border-[var(--border)] focus:border-[var(--primary)]",
          )}
          disabled={isLoading || isRecording || isTranscribing}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || isRecording || isTranscribing}
          className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
