"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSettings } from "@/lib/hooks/use-settings";
import { useAuth } from "@/lib/hooks/use-auth";
import { addWords } from "@/lib/db/vocabulary";
import { addPatterns } from "@/lib/db/patterns";
import {
  addMaterial,
  getAllMaterials,
  deleteMaterial,
} from "@/lib/db/materials";
import type {
  ExtractionResult,
  MaterialRecord,
  MaterialSourceItem,
} from "@/lib/types/material";
import type { WordCategory } from "@/lib/types/vocabulary";
import type { PatternScenario } from "@/lib/types/pattern";
import {
  FileText,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { pullLearningData, pushLearningData } from "@/lib/supabase/data-sync";

type ImportMode = "text" | "url";
type ImportStep = "input" | "extracting" | "review" | "saved" | "queued";
type UrlContentType =
  | "youtube"
  | "twitter"
  | "zhihu"
  | "wechat"
  | "xiaohongshu"
  | "generic"
  | null;

const MAX_BATCH_URLS = 10;
const JOB_PANEL_VISIBLE_COUNT = 5;
const JOB_REFRESH_INTERVAL_MS = 2500;
const JOB_FAST_REFRESH_STEPS_MS = [0, 800, 1800];
const JOB_CACHE_KEY = "good-english-import-jobs";

type FetchedSource = MaterialSourceItem & {
  warning?: string;
};

type FetchJobStatus = "pending" | "processing" | "completed" | "failed";

type QueuedJob = {
  id: string;
  source_url: string;
  status: FetchJobStatus;
  error?: string | null;
  requested_at?: string;
  completed_at?: string | null;
  result_summary?: {
    title?: string;
    wordsCount?: number;
    patternsCount?: number;
  } | null;
};

function loadCachedJobs(): QueuedJob[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(JOB_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedJob[];
  } catch {
    return [];
  }
}

function saveCachedJobs(jobs: QueuedJob[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(JOB_CACHE_KEY, JSON.stringify(jobs));
  } catch {
    // Ignore cache failures and keep live sync working.
  }
}

function clearCachedJobs() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(JOB_CACHE_KEY);
  } catch {
    // Ignore cache cleanup failures.
  }
}

const EMBEDDED_URL_RE = /https?:\/\/[^\s\u4e00-\u9fa5，。！？、""''【】《》]+/;

function extractUrl(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.startsWith("http")) return trimmed;
  const match = trimmed.match(EMBEDDED_URL_RE);
  return match ? match[0].replace(/[.,!?）)]+$/, "") : null;
}

function parseUrls(input: string): string[] {
  return input
    .split("\n")
    .map(extractUrl)
    .filter((u): u is string => u !== null)
    .slice(0, MAX_BATCH_URLS);
}

function urlTypeLabel(type: UrlContentType): string {
  if (type === "youtube") return "📹 YouTube";
  if (type === "twitter") return "🐦 X / Twitter";
  if (type === "zhihu") return "📚 知乎";
  if (type === "wechat") return "💬 微信公众号";
  if (type === "xiaohongshu") return "📕 小红书";
  return "🌐 网页";
}

function detectUrlType(url: string): UrlContentType {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/(?:x\.com|twitter\.com)/i.test(url)) return "twitter";
  if (/zhihu\.com/i.test(url)) return "zhihu";
  if (/mp\.weixin\.qq\.com/i.test(url)) return "wechat";
  if (/(?:xiaohongshu\.com|xhslink\.com)/i.test(url)) return "xiaohongshu";
  if (url.startsWith("http")) return "generic";
  return null;
}

function formatImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Could not find the table 'public.content_fetch_jobs'") ||
    message.includes("content_fetch_jobs")
  ) {
    return "Supabase 还没有初始化 URL 抓取队列表 `content_fetch_jobs`。先运行 `node scripts/setup-sync-table.mjs`，或到 `/api/admin/setup-db` 复制 SQL 去 Supabase 执行。";
  }

  return message;
}

export default function ImportPage() {
  const { getActiveProvider } = useSettings();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<ImportMode>("url");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState("");
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
  const [selectedPatterns, setSelectedPatterns] = useState<Set<number>>(
    new Set(),
  );
  const [extractingMsg, setExtractingMsg] = useState(
    "AI 正在分析内容，提取词汇和句型...",
  );
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    url: string;
  } | null>(null);
  const [fetchedSources, setFetchedSources] = useState<FetchedSource[]>([]);
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
  const [authError, setAuthError] = useState("");
  const urlSubmitDisabled = !urlInput.trim();
  const lastJobSignatureRef = useRef("");

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    const cachedJobs = loadCachedJobs();
    if (cachedJobs.length > 0) {
      setQueuedJobs(cachedJobs);
    }
  }, []);

  useEffect(() => {
    if (queuedJobs.length > 0) {
      saveCachedJobs(queuedJobs);
    } else if (!authLoading && !user) {
      clearCachedJobs();
    }
  }, [authLoading, queuedJobs, user]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let focusHandler: (() => void) | null = null;
    let visibilityHandler: (() => void) | null = null;
    const fastRefreshTimers: number[] = [];

    async function refreshJobs(userId: string) {
      const { data, error } = await supabase
        .from("content_fetch_jobs")
        .select(
          "id, source_url, status, error, result_summary, requested_at, completed_at",
        )
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(20);

      if (cancelled || error || !data) return;

      const jobs = data as QueuedJob[];
      setQueuedJobs(jobs);
      saveCachedJobs(jobs);

      const signature = jobs.map((job) => `${job.id}:${job.status}`).join("|");
      const hasStatusChange =
        signature.length > 0 && signature !== lastJobSignatureRef.current;
      lastJobSignatureRef.current = signature;

      if (
        hasStatusChange &&
        jobs.some(
          (job) => job.status === "completed" || job.status === "failed",
        )
      ) {
        await pullLearningData(supabase);
        await loadMaterials();
      }
    }

    async function resolveCurrentUserId() {
      if (user?.id) return user.id;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user?.id ?? null;
    }

    async function initializeJobsSync() {
      const currentUserId = await resolveCurrentUserId();
      if (cancelled) return;

      if (!currentUserId) {
        if (!authLoading) {
          setQueuedJobs([]);
          clearCachedJobs();
        }
        return;
      }

      await refreshJobs(currentUserId);

      for (const delay of JOB_FAST_REFRESH_STEPS_MS) {
        const timer = window.setTimeout(() => {
          refreshJobs(currentUserId).catch(() => {});
        }, delay);
        fastRefreshTimers.push(timer);
      }

      channel = supabase
        .channel(`content-fetch-jobs-${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "content_fetch_jobs",
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            refreshJobs(currentUserId).catch(() => {});
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            refreshJobs(currentUserId).catch(() => {});
          }
        });

      focusHandler = () => {
        refreshJobs(currentUserId).catch(() => {});
      };

      visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          refreshJobs(currentUserId).catch(() => {});
        }
      };

      window.addEventListener("focus", focusHandler);
      document.addEventListener("visibilitychange", visibilityHandler);
    }

    initializeJobsSync().catch(() => {});

    const timer = window.setInterval(() => {
      resolveCurrentUserId()
        .then((currentUserId) => {
          if (!currentUserId) return;
          return refreshJobs(currentUserId);
        })
        .catch(() => {});
    }, JOB_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      fastRefreshTimers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (focusHandler) window.removeEventListener("focus", focusHandler);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  async function loadMaterials() {
    await getAllMaterials();
  }

  async function deleteJob(id: string) {
    if (!confirm("确定删除这条失败任务？")) return;
    const supabase = createClient();
    await supabase.from("content_fetch_jobs").delete().eq("id", id);
    setQueuedJobs((prev) => prev.filter((j) => j.id !== id));
  }

  async function fetchAndExtract(
    url: string,
    provider: ReturnType<typeof getActiveProvider>,
  ): Promise<{ extraction: ExtractionResult; source: FetchedSource } | null> {
    const urlType = detectUrlType(url);
    const fetchMsgs: Record<NonNullable<UrlContentType>, string> = {
      youtube: "📹 正在提取字幕...",
      twitter: "🐦 正在抓取全文...",
      zhihu: "📚 正在抓取知乎...",
      wechat: "💬 正在抓取公众号...",
      xiaohongshu: "📕 正在抓取小红书...",
      generic: "🌐 正在抓取网页...",
    };
    setExtractingMsg(fetchMsgs[urlType ?? "generic"]);

    const fetchRes = await fetch("/api/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const fetchData = await fetchRes.json();
    if (!fetchRes.ok) throw new Error(fetchData.error || "抓取失败");

    const content: string = fetchData.content;
    if (!content.trim()) throw new Error("抓取内容为空");

    setExtractingMsg(
      fetchData.isLong
        ? "📊 长视频已抽样，AI 正在提取词汇..."
        : "AI 正在提取词汇和句型...",
    );

    const extractRes = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, provider }),
    });
    const extractData = await extractRes.json();
    if (!extractRes.ok) throw new Error(extractData.error || "提取失败");
    return {
      extraction: extractData as ExtractionResult,
      source: {
        url,
        title: fetchData.title,
        contentType: fetchData.contentType ?? (urlType || "generic"),
        content,
        markdown: fetchData.markdown,
        archivePath: fetchData.archivePath,
        archiveRelativePath: fetchData.archiveRelativePath,
        fetchMethod: fetchData.fetchMethod,
        warning: fetchData.warning,
      },
    };
  }

  async function handleExtract() {
    const provider = getActiveProvider();
    if (mode === "text" && !provider?.apiKey) {
      setError("请先在设置页面配置 AI Provider 的 API Key");
      return;
    }
    setError("");
    setStep("extracting");

    // ── Text mode ──
    if (mode === "text") {
      const content = textInput.trim();
      if (!content) {
        setError("内容不能为空");
        setStep("input");
        return;
      }
      setExtractingMsg("AI 正在分析内容，提取词汇和句型...");
      setFetchedSources([]);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "提取失败");
        setExtraction(data);
        setSelectedWords(
          new Set(data.words?.map((_: unknown, i: number) => i) ?? []),
        );
        setSelectedPatterns(
          new Set(data.patterns?.map((_: unknown, i: number) => i) ?? []),
        );
        setStep("review");
      } catch (e) {
        setError(formatImportError(e) || "提取失败");
        setStep("input");
      }
      return;
    }

    // ── URL mode ──
    const urls = parseUrls(urlInput);
    if (urls.length === 0) {
      setError("请输入有效的 URL（以 http 开头）");
      setStep("input");
      return;
    }

    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setError(
        "URL 导入需要先登录 Google，这样 Mac mini 才能把结果写回你的 Supabase",
      );
      setStep("input");
      return;
    }

    setExtractingMsg("正在提交抓取任务到 Mac mini...");
    setBatchProgress(null);
    setFetchedSources([]);

    try {
      const { data, error } = await supabase
        .from("content_fetch_jobs")
        .insert(
          urls.map((url) => ({
            user_id: currentUser.id,
            source_url: url,
            status: "pending",
          })),
        )
        .select("id, source_url, status, error, result_summary");

      if (error || !data) {
        throw new Error(error?.message || "任务提交失败");
      }

      setQueuedJobs(data as QueuedJob[]);
      setStep("queued");
    } catch (e) {
      setError(formatImportError(e) || "任务提交失败");
      setStep("input");
    }
  }

  async function handleSave() {
    if (!extraction) return;

    const wordsToSave = extraction.words
      .filter((_, i) => selectedWords.has(i))
      .map((w) => ({
        english: w.english,
        chinese: w.chinese,
        partOfSpeech: w.partOfSpeech,
        exampleSentence: w.exampleSentence,
        exampleTranslation: w.exampleTranslation || "",
        context: w.context,
        category: w.category as WordCategory,
        tags: [] as string[],
      }));

    const patternsToSave = extraction.patterns
      .filter((_, i) => selectedPatterns.has(i))
      .map((p) => ({
        pattern: p.pattern,
        patternChinese: p.patternChinese,
        scenario: p.scenario as PatternScenario,
        examples: p.examples,
        difficulty: 2 as const,
      }));

    const wordIds = wordsToSave.length > 0 ? await addWords(wordsToSave) : [];
    const patternIds =
      patternsToSave.length > 0 ? await addPatterns(patternsToSave) : [];

    const urls = mode === "url" ? parseUrls(urlInput) : [];
    const batchTitle =
      urls.length > 1
        ? `批量导入 (${urls.length} 条链接)`
        : urls.length === 1
          ? fetchedSources[0]?.title || urls[0]
          : textInput.slice(0, 60) + "...";
    await addMaterial({
      title: batchTitle,
      content:
        mode === "url"
          ? fetchedSources
              .map((source) =>
                [`# ${source.title || source.url}`, "", source.content].join(
                  "\n",
                ),
              )
              .join("\n\n---\n\n")
          : textInput,
      sourceType: mode,
      sourceUrl: mode === "url" ? urls[0] : undefined,
      sourceItems: mode === "url" ? fetchedSources : undefined,
      extractedWordIds: wordIds,
      extractedPatternIds: patternIds,
      keyPhrases: extraction.keyPhrases || [],
      tags:
        mode === "url"
          ? Array.from(
              new Set(fetchedSources.map((source) => source.contentType)),
            )
          : [],
    });

    setStep("saved");
    await loadMaterials();

    // Push to cloud if logged in (fire-and-forget)
    pushLearningData(createClient()).catch(() => {});

    setTimeout(() => {
      setStep("input");
      setTextInput("");
      setUrlInput("");
      setExtraction(null);
      setFetchedSources([]);
      setQueuedJobs([]);
    }, 2000);
  }

  async function handleDeleteMaterial(id: string) {
    await deleteMaterial(id);
    await loadMaterials();
  }

  function renderQueuedJobsPanel(showHeader = true) {
    if (queuedJobs.length === 0) return null;
    const hasOverflow = queuedJobs.length > JOB_PANEL_VISIBLE_COUNT;

    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="font-semibold">最近抓取任务</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              排队中和处理中的任务会持续显示；完成后会自动写入素材、词汇和句型。
            </p>
          </div>
        )}

        <div
          className={cn(
            "space-y-2",
            hasOverflow && "max-h-[26rem] overflow-y-auto pr-1",
          )}
        >
          {queuedJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {job.result_summary?.title || job.source_url}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)] truncate">
                    {job.source_url}
                  </p>
                  {job.status === "failed" && job.error && (
                    <p className="mt-2 text-xs text-red-400">{job.error}</p>
                  )}
                  {job.status === "failed" && (
                    <div className="mt-2">
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="text-xs text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  )}
                  {job.status === "completed" && (
                    <p className="mt-2 text-xs text-emerald-400">
                      已入库：{job.result_summary?.wordsCount ?? 0} 词 ·{" "}
                      {job.result_summary?.patternsCount ?? 0} 句型
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-xs",
                    job.status === "completed" &&
                      "bg-emerald-500/10 text-emerald-400",
                    job.status === "failed" && "bg-red-500/10 text-red-400",
                    job.status === "processing" && "bg-sky-500/10 text-sky-400",
                    job.status === "pending" &&
                      "bg-amber-500/10 text-amber-400",
                  )}
                >
                  {job.status === "completed"
                    ? "已完成"
                    : job.status === "failed"
                      ? "失败"
                      : job.status === "processing"
                        ? "处理中"
                        : "排队中"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">素材导入</h1>
        <p className="text-sm text-[var(--muted-foreground)] hidden sm:block">
          粘贴内容或 URL，AI 自动提取词汇和句型
        </p>
      </div>

      {/* Input Step */}
      {step === "input" && (
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("url")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors",
                mode === "url"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              <LinkIcon className="h-4 w-4" /> 粘贴 URL
            </button>
            <button
              onClick={() => setMode("text")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors",
                mode === "text"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              <FileText className="h-4 w-4" /> 粘贴文本
            </button>
          </div>

          {/* Input Area */}
          {mode === "text" ? (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="粘贴英文推文、文章、逐字稿等内容..."
              className="w-full h-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-base outline-none focus:border-[var(--primary)] resize-none transition-colors"
            />
          ) : (
            <textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={
                "https://x.com/...\nhttps://zhihu.com/...\nhttps://mp.weixin.qq.com/..."
              }
              rows={8}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-base outline-none focus:border-[var(--primary)] resize-none transition-colors leading-relaxed overflow-x-hidden [word-break:break-all]"
            />
          )}

          {/* URL type hint */}
          {mode === "url" &&
            urlInput &&
            (() => {
              const urls = parseUrls(urlInput);
              if (urls.length === 0) return null;
              if (urls.length === 1) {
                const t = detectUrlType(urls[0]);
                if (t === "youtube")
                  return (
                    <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      📹 将提取 YouTube 视频字幕（支持长视频，超过 8000
                      词自动抽样）
                    </div>
                  );
                if (t === "twitter")
                  return (
                    <div className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-400">
                      🐦 将全量抓取推文 / X Article 全文（Playwright 渲染，约需
                      30-60 秒）
                    </div>
                  );
                if (t === "zhihu")
                  return (
                    <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-400">
                      📚 将全量抓取知乎文章 / 回答（Playwright 渲染，约需 30-60
                      秒）
                    </div>
                  );
                if (t === "wechat")
                  return (
                    <div className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
                      💬 将全量抓取微信公众号文章（Playwright 渲染，约需 30-60
                      秒）
                    </div>
                  );
                return null;
              }
              return (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs space-y-1.5">
                  <div className="text-[var(--muted-foreground)]">
                    已识别{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {urls.length}
                    </span>{" "}
                    个链接，将按顺序依次抓取
                    {urls.length >= MAX_BATCH_URLS && (
                      <span className="text-amber-400 ml-1">
                        （已达上限 {MAX_BATCH_URLS} 条）
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {urls.map((u, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[var(--muted-foreground)]"
                      >
                        <span className="w-4 text-right shrink-0 tabular-nums">
                          {i + 1}.
                        </span>
                        <span className="shrink-0">
                          {urlTypeLabel(detectUrlType(u))}
                        </span>
                        <span className="truncate opacity-70">{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {mode === "url" && !authLoading && !user && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                URL 导入会把任务发给 Mac mini 处理，所以需要先登录
                Google，系统才能把结果写回你自己的 Supabase。
              </p>
              <button
                onClick={async () => {
                  setAuthError("");
                  const { error } = await signInWithGoogle("/import");
                  if (error) setAuthError(error.message);
                }}
                className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
              >
                先登录 Google
              </button>
              {authError && (
                <p className="mt-2 text-xs text-red-400">{authError}</p>
              )}
            </div>
          )}

          {mode === "url" && authLoading && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
              页面还在恢复登录状态；如果你已经登录成功，也可以直接点“提交抓取任务”，系统会再次向
              Supabase 确认当前账号。
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={mode === "text" ? !textInput.trim() : urlSubmitDisabled}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            {mode === "url" ? "提交抓取任务" : "AI 提取词汇和句型"}
          </button>

          {mode === "url" && renderQueuedJobsPanel(false)}
        </div>
      )}

      {/* Extracting Step */}
      {step === "extracting" && (
        <div className="flex flex-col items-center justify-center py-16 gap-5">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />

          {batchProgress ? (
            <div className="w-full max-w-sm space-y-3">
              {/* N/M counter */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  {extractingMsg}
                </span>
                <span className="tabular-nums font-medium text-[var(--foreground)]">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-[var(--secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{
                    width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                  }}
                />
              </div>
              {/* Current URL */}
              <p className="text-xs text-[var(--muted-foreground)] truncate text-center">
                {batchProgress.url}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              {extractingMsg}
            </p>
          )}
        </div>
      )}

      {step === "queued" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="font-semibold">已提交到 Mac mini 抓取队列</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Mac mini 会调用 Content Fetcher 抓全文，整理
              Markdown，提取词汇和句型，然后直接写入 Supabase。
            </p>
          </div>

          {renderQueuedJobsPanel(false)}

          <div className="flex gap-3">
            <button
              onClick={async () => {
                await loadMaterials();
                setStep("input");
                setUrlInput("");
              }}
              className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              返回继续导入
            </button>
            <button
              onClick={async () => {
                const supabase = createClient();
                await pullLearningData(supabase);
                await loadMaterials();
              }}
              className="rounded-lg bg-[var(--secondary)] px-4 py-2.5 text-sm hover:bg-[var(--muted)]"
            >
              手动刷新素材库
            </button>
          </div>
        </div>
      )}

      {/* Review Step */}
      {step === "review" && extraction && (
        <div className="space-y-6">
          {mode === "url" && fetchedSources.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
              <p className="font-medium">
                已抓取 {fetchedSources.length} 条素材，并整理为 Markdown
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {fetchedSources.some((source) => source.archiveRelativePath)
                  ? `归档目录：DB / ${fetchedSources
                      .find((source) => source.archiveRelativePath)
                      ?.archiveRelativePath?.split("/")
                      .pop()}`
                  : "当前环境未返回本地归档路径"}
              </p>
            </div>
          )}

          {/* Extracted Words */}
          {extraction.words?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  提取的词汇 ({selectedWords.size}/{extraction.words.length})
                </h3>
                <button
                  onClick={() => {
                    if (selectedWords.size === extraction.words.length) {
                      setSelectedWords(new Set());
                    } else {
                      setSelectedWords(
                        new Set(extraction.words.map((_, i) => i)),
                      );
                    }
                  }}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  {selectedWords.size === extraction.words.length
                    ? "取消全选"
                    : "全选"}
                </button>
              </div>
              <div className="space-y-2">
                {extraction.words.map((word, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const next = new Set(selectedWords);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setSelectedWords(next);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      selectedWords.has(i)
                        ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                        : "border-[var(--border)] bg-[var(--card)] opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        selectedWords.has(i)
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-[var(--muted)]",
                      )}
                    >
                      {selectedWords.has(i) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{word.english}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          ({word.partOfSpeech})
                        </span>
                        <span className="text-sm text-[var(--secondary-foreground)]">
                          {word.chinese}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">
                        {word.exampleSentence}
                      </p>
                      <span className="inline-block mt-1 text-xs rounded px-1.5 py-0.5 bg-[var(--secondary)]">
                        {word.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Patterns */}
          {extraction.patterns?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  提取的句型 ({selectedPatterns.size}/
                  {extraction.patterns.length})
                </h3>
                <button
                  onClick={() => {
                    if (selectedPatterns.size === extraction.patterns.length) {
                      setSelectedPatterns(new Set());
                    } else {
                      setSelectedPatterns(
                        new Set(extraction.patterns.map((_, i) => i)),
                      );
                    }
                  }}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  {selectedPatterns.size === extraction.patterns.length
                    ? "取消全选"
                    : "全选"}
                </button>
              </div>
              <div className="space-y-2">
                {extraction.patterns.map((pattern, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const next = new Set(selectedPatterns);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setSelectedPatterns(next);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      selectedPatterns.has(i)
                        ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-[var(--card)] opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        selectedPatterns.has(i)
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--muted)]",
                      )}
                    >
                      {selectedPatterns.has(i) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium font-mono text-sm">
                        {pattern.pattern}
                      </p>
                      <p className="text-sm text-[var(--secondary-foreground)] mt-1">
                        {pattern.patternChinese}
                      </p>
                      {pattern.examples?.length > 0 && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">
                          e.g. {pattern.examples[0].english}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Phrases */}
          {extraction.keyPhrases?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">关键短语</h3>
              <div className="flex flex-wrap gap-2">
                {extraction.keyPhrases.map((phrase, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-[var(--secondary)] px-3 py-1 text-xs"
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={selectedWords.size === 0 && selectedPatterns.size === 0}
              className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              保存 {selectedWords.size} 词 + {selectedPatterns.size} 句型
            </button>
            <button
              onClick={() => {
                setStep("input");
                setExtraction(null);
                setFetchedSources([]);
              }}
              className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-4 py-2.5 text-sm hover:bg-[var(--muted)]"
            >
              <X className="h-4 w-4" /> 取消
            </button>
          </div>
        </div>
      )}

      {/* Saved Step */}
      {step === "saved" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            保存成功！词汇和句型已加入学习库
          </p>
        </div>
      )}
    </div>
  );
}
