"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/hooks/use-settings";
import { addWords } from "@/lib/db/vocabulary";
import { addPatterns } from "@/lib/db/patterns";
import {
  addMaterial,
  getAllMaterials,
  deleteMaterial,
} from "@/lib/db/materials";
import type { ExtractionResult, MaterialRecord } from "@/lib/types/material";
import type { WordCategory } from "@/lib/types/vocabulary";
import type { PatternScenario } from "@/lib/types/pattern";
import {
  FileText,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ImportMode = "text" | "url";
type ImportStep = "input" | "extracting" | "review" | "saved";
type UrlContentType = "youtube" | "twitter" | "generic" | null;

function detectUrlType(url: string): UrlContentType {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/(?:x\.com|twitter\.com)/i.test(url)) return "twitter";
  if (url.startsWith("http")) return "generic";
  return null;
}

export default function ImportPage() {
  const { getActiveProvider } = useSettings();
  const [mode, setMode] = useState<ImportMode>("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
  const [selectedPatterns, setSelectedPatterns] = useState<Set<number>>(
    new Set(),
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [extractingMsg, setExtractingMsg] = useState(
    "AI 正在分析内容，提取词汇和句型...",
  );

  useEffect(() => {
    loadMaterials();
  }, []);

  async function loadMaterials() {
    const mats = await getAllMaterials();
    setMaterials(mats);
  }

  async function handleExtract() {
    const provider = getActiveProvider();
    if (!provider?.apiKey) {
      setError("请先在设置页面配置 AI Provider 的 API Key");
      return;
    }

    let content = "";
    setError("");

    if (mode === "url") {
      const urlType = detectUrlType(urlInput);
      if (urlType === "youtube") {
        setExtractingMsg("📹 正在提取 YouTube 字幕，长视频约需 15-30 秒...");
      } else if (urlType === "twitter") {
        setExtractingMsg("🐦 正在抓取推文内容...");
      } else {
        setExtractingMsg("🌐 正在抓取网页内容...");
      }
    } else {
      setExtractingMsg("AI 正在分析内容，提取词汇和句型...");
    }
    setStep("extracting");

    if (mode === "url") {
      try {
        const fetchRes = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlInput }),
        });
        const fetchData = await fetchRes.json();
        if (!fetchRes.ok) {
          setError(fetchData.error || "URL 抓取失败");
          setStep("input");
          return;
        }
        content = fetchData.content;
        if (fetchData.isLong) {
          setExtractingMsg("📊 长视频已智能抽样，AI 正在分析关键片段...");
        } else {
          setExtractingMsg("AI 正在分析内容，提取词汇和句型...");
        }
      } catch {
        setError("URL 抓取失败");
        setStep("input");
        return;
      }
    } else {
      content = textInput;
    }

    if (!content.trim()) {
      setError("内容不能为空");
      setStep("input");
      return;
    }

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提取失败");
        setStep("input");
        return;
      }
      setExtraction(data);
      // Select all by default
      setSelectedWords(
        new Set(data.words?.map((_: unknown, i: number) => i) || []),
      );
      setSelectedPatterns(
        new Set(data.patterns?.map((_: unknown, i: number) => i) || []),
      );
      setStep("review");
    } catch {
      setError("提取失败，请检查 AI Provider 配置");
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

    await addMaterial({
      title: mode === "url" ? urlInput : textInput.slice(0, 60) + "...",
      content: mode === "url" ? urlInput : textInput,
      sourceType: mode,
      sourceUrl: mode === "url" ? urlInput : undefined,
      extractedWordIds: wordIds,
      extractedPatternIds: patternIds,
      keyPhrases: extraction.keyPhrases || [],
      tags: [],
    });

    setStep("saved");
    await loadMaterials();
    setTimeout(() => {
      setStep("input");
      setTextInput("");
      setUrlInput("");
      setExtraction(null);
    }, 2000);
  }

  async function handleDeleteMaterial(id: string) {
    await deleteMaterial(id);
    await loadMaterials();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">素材导入</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            粘贴内容或 URL，AI 自动提取词汇和句型
          </p>
        </div>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          素材库 ({materials.length})
          {showLibrary ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Material Library */}
      {showLibrary && materials.length > 0 && (
        <div className="mb-6 space-y-2">
          {materials.map((mat) => (
            <div
              key={mat.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{mat.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {mat.extractedWordIds.length} 词 ·{" "}
                  {mat.extractedPatternIds.length} 句型 ·{" "}
                  {new Date(mat.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDeleteMaterial(mat.id)}
                className="ml-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Step */}
      {step === "input" && (
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
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
          </div>

          {/* Input Area */}
          {mode === "text" ? (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="粘贴英文推文、文章、逐字稿等内容..."
              className="w-full h-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm outline-none focus:border-[var(--primary)] resize-none transition-colors"
            />
          ) : (
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://x.com/... 或 https://blog.example.com/..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] transition-colors"
            />
          )}

          {/* URL type hint */}
          {mode === "url" &&
            urlInput &&
            (() => {
              const urlType = detectUrlType(urlInput);
              if (urlType === "youtube")
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    📹 将提取 YouTube 视频字幕（支持长视频，超过 8000
                    词自动抽样）
                  </div>
                );
              if (urlType === "twitter")
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-400">
                    🐦 将提取推文全文（仅支持公开推文）
                  </div>
                );
              return null;
            })()}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={mode === "text" ? !textInput.trim() : !urlInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Sparkles className="h-4 w-4" /> AI 提取词汇和句型
          </button>
        </div>
      )}

      {/* Extracting Step */}
      {step === "extracting" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--muted-foreground)]">
            {extractingMsg}
          </p>
        </div>
      )}

      {/* Review Step */}
      {step === "review" && extraction && (
        <div className="space-y-6">
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
