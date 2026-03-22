#!/usr/bin/env node

import { execFile } from "child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://twjsspsplskqsgmnegrk.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL =
  process.env.GOOD_ENGLISH_APP_URL || "https://good-english-two.vercel.app";
const CONTENT_FETCHER_SCRIPT =
  process.env.CONTENT_FETCHER_SCRIPT ||
  "/Users/liyizhouai/Desktop/openclaw/skill/内容抓取/scripts/fetch.py";
const ARCHIVE_DIR =
  process.env.GOOD_ENGLISH_ARCHIVE_DIR ||
  path.join(process.cwd(), "抓内容素材");
const JOB_LIMIT = Number(process.env.GOOD_ENGLISH_JOB_LIMIT || 3);
const POLL_INTERVAL_MS = Number(process.env.GOOD_ENGLISH_POLL_INTERVAL_MS || 15000);
const WATCH_MODE = process.argv.includes("--watch");

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!existsSync(CONTENT_FETCHER_SCRIPT)) {
  console.error(`❌ Content Fetcher script not found: ${CONTENT_FETCHER_SCRIPT}`);
  process.exit(1);
}

mkdirSync(ARCHIVE_DIR, { recursive: true });

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function slugify(input) {
  const ascii = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return ascii.slice(0, 48) || "material";
}

function shortHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function detectUrlType(url) {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/(?:x\.com|twitter\.com)/i.test(url)) return "twitter";
  if (/zhihu\.com/i.test(url)) return "zhihu";
  if (/mp\.weixin\.qq\.com/i.test(url)) return "wechat";
  return "generic";
}

function getFrontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?$`, "m"));
  return match?.[1]?.trim();
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBody(markdown) {
  const transcriptMatch = markdown.match(/##\s+📝\s+全文逐字稿\s*\n([\s\S]+?)(?:\n🏷️|$)/);
  if (transcriptMatch?.[1]) {
    return transcriptMatch[1].trim();
  }
  return stripMarkdown(markdown.replace(/^---\n[\s\S]*?\n---\n?/, ""));
}

function getDefaultSM2Fields() {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: Date.now(),
    lastReviewedAt: undefined,
  };
}

function buildArchiveStem(url, type, title) {
  return `${type}-${slugify(title || "material")}-${shortHash(url)}`;
}

function rewriteAssetPaths(markdown, fromDir, toDir) {
  if (!fromDir || fromDir === toDir) return markdown;
  const escaped = fromDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(escaped, "g"), toDir);
}

function archiveMarkdown(url, type, markdown, title, assetDir) {
  const stem = buildArchiveStem(url, type, title);
  const markdownPath = path.join(ARCHIVE_DIR, `${stem}.md`);
  let finalMarkdown = markdown;

  if (assetDir?.path && assetDir?.name && existsSync(assetDir.path)) {
    const targetAssetDirName = `${stem}-media`;
    const targetAssetDir = path.join(ARCHIVE_DIR, targetAssetDirName);
    rmSync(targetAssetDir, { recursive: true, force: true });
    cpSync(assetDir.path, targetAssetDir, { recursive: true });
    finalMarkdown = rewriteAssetPaths(
      finalMarkdown,
      `${assetDir.name}/`,
      `${targetAssetDirName}/`,
    );
  }

  writeFileSync(markdownPath, finalMarkdown, "utf8");

  return {
    markdown: finalMarkdown,
    archivePath: markdownPath,
    archiveRelativePath: path.relative(process.cwd(), markdownPath),
  };
}

async function fetchContent(url) {
  const type = detectUrlType(url);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "good-english-job-"));

  try {
    const args = [CONTENT_FETCHER_SCRIPT, url, "-o", tempDir];
    if (type === "zhihu") args.push("--show-browser");

    const { stdout, stderr } = await execFileAsync("python3", args, {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const match = stdout.match(/完成!\s+(.+\.md)/);
    if (!match) {
      throw new Error(stderr || stdout || "Content Fetcher 未生成 Markdown");
    }

    const sourceFileName = match[1].trim();
    const sourceFilePath = path.join(tempDir, sourceFileName);
    const sourceMarkdown = readFileSync(sourceFilePath, "utf8");
    const sourceStem = path.basename(sourceFileName, ".md");
    const sourceAssetDir = path.join(tempDir, `${sourceStem}_图片`);
    const title = getFrontmatterValue(sourceMarkdown, "title") || url;
    const archived = archiveMarkdown(
      url,
      type,
      sourceMarkdown,
      title,
      existsSync(sourceAssetDir)
        ? { path: sourceAssetDir, name: `${sourceStem}_图片` }
        : null,
    );

    return {
      title,
      contentType: type,
      content: extractBody(archived.markdown),
      markdown: archived.markdown,
      archivePath: archived.archivePath,
      archiveRelativePath: archived.archiveRelativePath,
      fetchMethod: "content-fetcher",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractContent(content, provider) {
  const response = await fetch(`${APP_URL.replace(/\/$/, "")}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, provider }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "提取失败");
  }
  return data;
}

async function getActiveProvider(userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings_data")
    .eq("user_id", userId)
    .single();

  if (error || !data?.settings_data) {
    throw new Error("未找到用户设置，请先在 Good English 设置页登录并配置 API Key");
  }

  const settings = JSON.parse(data.settings_data);
  const provider = settings.providers?.find(
    (item) => item.id === settings.activeProviderId,
  );

  if (!provider?.apiKey) {
    throw new Error("用户未配置可用的 AI Provider API Key");
  }

  return provider;
}

function upsertWord(existingWords, word) {
  const now = Date.now();
  const normalized = word.english.trim().toLowerCase();
  const index = existingWords.findIndex(
    (item) => item.english?.trim().toLowerCase() === normalized,
  );

  if (index >= 0) {
    const current = existingWords[index];
    existingWords[index] = {
      ...current,
      chinese: word.chinese,
      partOfSpeech: word.partOfSpeech,
      exampleSentence: word.exampleSentence,
      exampleTranslation: word.exampleTranslation || "",
      context: word.context,
      category: word.category,
      updatedAt: now,
    };
    return existingWords[index].id;
  }

  const record = {
    id: nanoid(),
    english: word.english,
    chinese: word.chinese,
    partOfSpeech: word.partOfSpeech,
    exampleSentence: word.exampleSentence,
    exampleTranslation: word.exampleTranslation || "",
    context: word.context,
    category: word.category,
    tags: [],
    ...getDefaultSM2Fields(),
    createdAt: now,
    updatedAt: now,
  };
  existingWords.push(record);
  return record.id;
}

function upsertPattern(existingPatterns, pattern) {
  const now = Date.now();
  const normalized = pattern.pattern.trim().toLowerCase();
  const index = existingPatterns.findIndex(
    (item) => item.pattern?.trim().toLowerCase() === normalized,
  );

  if (index >= 0) {
    const current = existingPatterns[index];
    existingPatterns[index] = {
      ...current,
      patternChinese: pattern.patternChinese,
      scenario: pattern.scenario,
      examples: pattern.examples,
      updatedAt: now,
    };
    return existingPatterns[index].id;
  }

  const record = {
    id: nanoid(),
    pattern: pattern.pattern,
    patternChinese: pattern.patternChinese,
    scenario: pattern.scenario,
    examples: pattern.examples,
    difficulty: 2,
    ...getDefaultSM2Fields(),
    createdAt: now,
    updatedAt: now,
  };
  existingPatterns.push(record);
  return record.id;
}

function upsertMaterial(existingMaterials, job, source, extraction, wordIds, patternIds) {
  const now = Date.now();
  const sourceItem = {
    url: job.source_url,
    title: source.title,
    contentType: source.contentType,
    content: source.content,
    markdown: source.markdown,
    archivePath: source.archivePath,
    archiveRelativePath: source.archiveRelativePath,
    fetchMethod: source.fetchMethod,
  };

  const index = existingMaterials.findIndex(
    (item) => item.sourceUrl === job.source_url,
  );

  if (index >= 0) {
    const current = existingMaterials[index];
    existingMaterials[index] = {
      ...current,
      title: source.title || current.title,
      content: source.content,
      sourceType: "url",
      sourceUrl: job.source_url,
      sourceItems: [sourceItem],
      extractedWordIds: wordIds,
      extractedPatternIds: patternIds,
      keyPhrases: extraction.keyPhrases || [],
      tags: [source.contentType],
      updatedAt: now,
    };
    return existingMaterials[index].id;
  }

  const material = {
    id: nanoid(),
    title: source.title || job.source_url,
    content: source.content,
    sourceType: "url",
    sourceUrl: job.source_url,
    sourceItems: [sourceItem],
    extractedWordIds: wordIds,
    extractedPatternIds: patternIds,
    keyPhrases: extraction.keyPhrases || [],
    tags: [source.contentType],
    createdAt: now,
    updatedAt: now,
  };

  existingMaterials.push(material);
  return material.id;
}

async function loadLearningData(userId) {
  const { data, error } = await supabase
    .from("user_learning_data")
    .select("words_data, patterns_data, materials_data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return {
    words: data?.words_data ? JSON.parse(data.words_data) : [],
    patterns: data?.patterns_data ? JSON.parse(data.patterns_data) : [],
    materials: data?.materials_data ? JSON.parse(data.materials_data) : [],
  };
}

async function saveLearningData(userId, payload) {
  const { error } = await supabase.from("user_learning_data").upsert(
    {
      user_id: userId,
      words_data: JSON.stringify(payload.words),
      patterns_data: JSON.stringify(payload.patterns),
      materials_data: JSON.stringify(payload.materials),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

async function claimJob(jobId) {
  const { data, error } = await supabase
    .from("content_fetch_jobs")
    .update({
      status: "processing",
      error: null,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function completeJob(jobId, resultSummary) {
  const { error } = await supabase
    .from("content_fetch_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_summary: resultSummary,
      error: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function failJob(jobId, errorMessage) {
  const { error } = await supabase
    .from("content_fetch_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: errorMessage.slice(0, 5000),
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function processJob(job) {
  const claimed = await claimJob(job.id);
  if (!claimed) return false;

  try {
    const provider = await getActiveProvider(job.user_id);
    const source = await fetchContent(job.source_url);
    const extraction = await extractContent(source.content, provider);
    const learningData = await loadLearningData(job.user_id);

    const wordIds = (extraction.words || []).map((word) =>
      upsertWord(learningData.words, word),
    );
    const patternIds = (extraction.patterns || []).map((pattern) =>
      upsertPattern(learningData.patterns, pattern),
    );
    const materialId = upsertMaterial(
      learningData.materials,
      job,
      source,
      extraction,
      wordIds,
      patternIds,
    );

    await saveLearningData(job.user_id, learningData);
    await completeJob(job.id, {
      title: source.title,
      materialId,
      wordsCount: wordIds.length,
      patternsCount: patternIds.length,
      archivePath: source.archivePath,
    });

    console.log(`✅ Completed ${job.source_url}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(job.id, message);
    console.error(`❌ Failed ${job.source_url}: ${message}`);
    return false;
  }
}

async function loadPendingJobs() {
  const { data, error } = await supabase
    .from("content_fetch_jobs")
    .select("id, user_id, source_url, status, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(JOB_LIMIT);

  if (error) {
    throw new Error(`Failed to load jobs: ${error.message}`);
  }

  return data || [];
}

let processing = false;
let rerunRequested = false;

async function processPendingJobs(trigger = "manual") {
  if (processing) {
    rerunRequested = true;
    return;
  }

  processing = true;
  try {
    const jobs = await loadPendingJobs();
    if (jobs.length === 0) {
      if (!WATCH_MODE) {
        console.log("ℹ️ No pending content fetch jobs");
      }
      return;
    }

    console.log(`📥 ${trigger}: ${jobs.length} pending job(s)`);

    let processed = 0;
    for (const job of jobs) {
      const ok = await processJob(job);
      if (ok) processed += 1;
    }

    console.log(`✅ Processed ${processed}/${jobs.length} job(s)`);
  } finally {
    processing = false;
    if (rerunRequested) {
      rerunRequested = false;
      queueMicrotask(() => {
        processPendingJobs("queued-rerun").catch((error) => {
          console.error("❌ Worker rerun failed:", error.message);
        });
      });
    }
  }
}

if (!WATCH_MODE) {
  try {
    await processPendingJobs("one-shot");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

console.log(`👂 Good English worker watching for new jobs`);
console.log(`   Archive dir: ${ARCHIVE_DIR}`);
console.log(`   Poll fallback: ${POLL_INTERVAL_MS}ms`);

await processPendingJobs("startup");

const channel = supabase
  .channel("content-fetch-jobs-worker")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "content_fetch_jobs",
    },
    (payload) => {
      const next = payload.new;
      if (next && typeof next === "object" && next.status === "pending") {
        processPendingJobs("realtime").catch((error) => {
          console.error("❌ Worker realtime run failed:", error.message);
        });
      }
    },
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("🔌 Supabase realtime connected");
    }
  });

const interval = setInterval(() => {
  processPendingJobs("poll").catch((error) => {
    console.error("❌ Worker poll failed:", error.message);
  });
}, POLL_INTERVAL_MS);

function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down worker`);
  clearInterval(interval);
  supabase.removeChannel(channel).finally(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
