import { execFile } from "child_process";
import {
  accessSync,
  constants,
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
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { YoutubeTranscript } from "youtube-transcript";

const execFileAsync = promisify(execFile);

const MAX_WORDS = 8000;
const REMOTE_READER_PREFIX = "https://r.jina.ai/http://";
const DEFAULT_FETCHER_SCRIPT =
  "/Users/liyizhouai/Desktop/openclaw/skill/内容抓取/scripts/fetch.py";
const DEFAULT_FETCHER_PYTHON = "/opt/homebrew/bin/python3";

export type UrlType = "youtube" | "twitter" | "zhihu" | "wechat" | "generic";

export interface FetchedUrlResult {
  url: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  content: string;
  markdown: string;
  contentType: UrlType;
  archivePath?: string;
  archiveRelativePath?: string;
  fetchMethod: "content-fetcher" | "youtube-transcript" | "jina-reader" | "readability";
  isLong?: boolean;
  warning?: string;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function formatArchiveTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}`;
}

function slugify(input: string): string {
  const ascii = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return ascii.slice(0, 48) || "material";
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function stripMarkdown(markdown: string): string {
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

function extractFrontmatterValue(markdown: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?$`, "m");
  const match = markdown.match(pattern);
  return match?.[1]?.trim();
}

function extractBodyFromMarkdown(markdown: string): string {
  const transcriptMatch = markdown.match(/##\s+📝\s+全文逐字稿\s*\n([\s\S]+?)(?:\n🏷️|$)/);
  if (transcriptMatch?.[1]) {
    return collapseWhitespace(transcriptMatch[1]);
  }

  const contentMatch = markdown.match(/Markdown Content:\n([\s\S]+)$/);
  if (contentMatch?.[1]) {
    return stripMarkdown(contentMatch[1]);
  }

  return stripMarkdown(stripFrontmatter(markdown));
}

function detectUrlType(url: string): UrlType {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/(?:x\.com|twitter\.com)/i.test(url)) return "twitter";
  if (/zhihu\.com/i.test(url)) return "zhihu";
  if (/mp\.weixin\.qq\.com/i.test(url)) return "wechat";
  return "generic";
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function resolveFetcherScriptPath(): string | null {
  const candidates = [
    process.env.CONTENT_FETCHER_SCRIPT,
    DEFAULT_FETCHER_SCRIPT,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveFetcherPython(): string {
  const candidates = [
    process.env.CONTENT_FETCHER_PYTHON,
    DEFAULT_FETCHER_PYTHON,
    "python3",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === "python3" || existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function resolveArchiveRoot(): { root: string; warning?: string } {
  const defaultRoot = path.join(process.cwd(), "DB");
  const candidates = [
    process.env.GOOD_ENGLISH_ARCHIVE_DIR,
    defaultRoot,
    path.join(os.tmpdir(), "good-english-materials"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      accessSync(candidate, constants.W_OK);
      const warning =
        candidate.startsWith(os.tmpdir()) ||
        candidate !== defaultRoot
          ? `当前环境无法稳定写入项目目录，已写入 ${candidate}`
          : undefined;
      return { root: candidate, warning };
    } catch {
      continue;
    }
  }

  throw new Error("无法创建素材归档目录");
}

function buildArchiveStem(url: string, type: UrlType, title?: string): string {
  return [
    formatArchiveTimestamp(),
    type,
    slugify(title || "material"),
    shortHash(url),
  ].join("_");
}

function rewriteAssetPaths(markdown: string, fromDir: string, toDir: string): string {
  if (!fromDir || fromDir === toDir) return markdown;
  const escaped = fromDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(escaped, "g"), toDir);
}

function archiveGeneratedMarkdown(params: {
  url: string;
  title?: string;
  contentType: UrlType;
  markdown: string;
  sourceAssetDir?: string;
  sourceAssetDirName?: string;
}): { archivePath?: string; archiveRelativePath?: string; warning?: string; markdown: string } {
  const archive = resolveArchiveRoot();
  const stem = buildArchiveStem(params.url, params.contentType, params.title);
  const markdownPath = path.join(archive.root, `${stem}.md`);
  let finalMarkdown = params.markdown;

  if (params.sourceAssetDir && params.sourceAssetDirName && existsSync(params.sourceAssetDir)) {
    const targetAssetDirName = `${stem}-media`;
    const targetAssetDir = path.join(archive.root, targetAssetDirName);
    rmSync(targetAssetDir, { recursive: true, force: true });
    cpSync(params.sourceAssetDir, targetAssetDir, { recursive: true });
    finalMarkdown = rewriteAssetPaths(
      finalMarkdown,
      `${params.sourceAssetDirName}/`,
      `${targetAssetDirName}/`,
    );
  }

  writeFileSync(markdownPath, finalMarkdown, "utf8");

  return {
    archivePath: markdownPath,
    archiveRelativePath: path.relative(process.cwd(), markdownPath),
    warning: archive.warning,
    markdown: finalMarkdown,
  };
}

function buildStructuredMarkdown(params: {
  url: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  contentType: UrlType;
  content: string;
  fetchMethod: FetchedUrlResult["fetchMethod"];
}): string {
  const lines = ["---"];
  lines.push(`title: ${quoteYaml(params.title || "未命名素材")}`);
  lines.push(`platform: ${params.contentType}`);
  if (params.author) lines.push(`author: ${quoteYaml(params.author)}`);
  lines.push(`url: ${params.url}`);
  lines.push(`fetched_at: ${new Date().toISOString()}`);
  if (params.publishedAt) lines.push(`published_at: ${quoteYaml(params.publishedAt)}`);
  lines.push(`fetch_method: ${params.fetchMethod}`);
  lines.push("---");
  lines.push("");
  lines.push(`原文链接: ${params.url}`);
  lines.push("");
  lines.push("## 📝 全文逐字稿");
  lines.push("");
  lines.push(params.content.trim() || "（无内容）");
  lines.push("");
  return lines.join("\n");
}

async function fetchViaContentFetcher(url: string, type: UrlType): Promise<FetchedUrlResult> {
  const scriptPath = resolveFetcherScriptPath();
  if (!scriptPath) {
    throw new Error("Content Fetcher 脚本不可用");
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "good-english-fetch-"));

  try {
    const args = [scriptPath, url, "-o", tempDir];
    if (type === "zhihu") args.push("--show-browser");

    const { stdout, stderr } = await execFileAsync(resolveFetcherPython(), args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const match = stdout.match(/完成!\s+(.+\.md)/);
    if (!match) {
      throw new Error(stderr || stdout || "抓取脚本未生成 Markdown");
    }

    const sourceFileName = match[1].trim();
    const sourceFilePath = path.join(tempDir, sourceFileName);
    const sourceMarkdown = readFileSync(sourceFilePath, "utf8");
    const sourceStem = path.basename(sourceFileName, ".md");
    const sourceAssetDirName = `${sourceStem}_图片`;
    const sourceAssetDir = path.join(tempDir, sourceAssetDirName);

    const archived = archiveGeneratedMarkdown({
      url,
      title: extractFrontmatterValue(sourceMarkdown, "title"),
      contentType: type,
      markdown: sourceMarkdown,
      sourceAssetDir: existsSync(sourceAssetDir) ? sourceAssetDir : undefined,
      sourceAssetDirName: existsSync(sourceAssetDir) ? sourceAssetDirName : undefined,
    });

    return {
      url,
      title: extractFrontmatterValue(archived.markdown, "title"),
      author: extractFrontmatterValue(archived.markdown, "author"),
      publishedAt: extractFrontmatterValue(archived.markdown, "published_at"),
      content: extractBodyFromMarkdown(archived.markdown),
      markdown: archived.markdown,
      contentType: type,
      archivePath: archived.archivePath,
      archiveRelativePath: archived.archiveRelativePath,
      fetchMethod: "content-fetcher",
      warning: archived.warning,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function fetchYouTubeFallback(url: string): Promise<FetchedUrlResult> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error("无效的 YouTube URL，无法提取视频 ID");
  }

  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  const fullText = segments.map((segment) => segment.text).join(" ");
  const wordCount = fullText.split(/\s+/).length;

  let content = fullText;
  let isLong = false;

  if (wordCount > MAX_WORDS) {
    const targetSegments = Math.max(
      1,
      Math.floor(segments.length * (MAX_WORDS / wordCount)),
    );
    const step = Math.max(1, Math.ceil(segments.length / targetSegments));
    const sampled = segments.filter((_, index) => index % step === 0);

    content =
      "[视频过长，已抽样关键片段]\n\n" +
      sampled
        .map((segment) => {
          const mins = Math.floor(segment.offset / 60);
          const secs = Math.floor(segment.offset % 60);
          return `[${mins}:${secs.toString().padStart(2, "0")}] ${segment.text}`;
        })
        .join("\n");
    isLong = true;
  }

  const markdown = buildStructuredMarkdown({
    url,
    title: `YouTube 视频 ${videoId}`,
    contentType: "youtube",
    content,
    fetchMethod: "youtube-transcript",
  });
  const archived = archiveGeneratedMarkdown({
    url,
    title: `youtube-${videoId}`,
    contentType: "youtube",
    markdown,
  });

  return {
    url,
    title: `YouTube 视频 ${videoId}`,
    content,
    markdown: archived.markdown,
    contentType: "youtube",
    archivePath: archived.archivePath,
    archiveRelativePath: archived.archiveRelativePath,
    fetchMethod: "youtube-transcript",
    isLong,
    warning: archived.warning,
  };
}

async function fetchViaJinaReader(url: string, type: UrlType): Promise<FetchedUrlResult> {
  const response = await fetch(`${REMOTE_READER_PREFIX}${url}`, {
    headers: { Accept: "text/plain" },
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`远程正文提取失败：HTTP ${response.status}`);
  }

  const warning = raw.match(/^Warning:\s*(.+)$/m)?.[1]?.trim();
  const markdownSection = raw.match(/Markdown Content:\n([\s\S]+)$/)?.[1]?.trim();
  const title = raw.match(/^Title:\s*(.*)$/m)?.[1]?.trim();

  if (!markdownSection) {
    throw new Error("远程正文提取未返回正文");
  }

  if (warning) {
    throw new Error(`远程正文提取不可用：${warning}`);
  }

  if (
    type === "wechat" &&
    /Parameter error/i.test(markdownSection)
  ) {
    throw new Error("公众号正文提取失败");
  }

  const content = stripMarkdown(markdownSection);
  if (content.length < 80) {
    throw new Error("远程正文提取结果过短");
  }

  const markdown = buildStructuredMarkdown({
    url,
    title,
    contentType: type,
    content: markdownSection,
    fetchMethod: "jina-reader",
  });
  const archived = archiveGeneratedMarkdown({
    url,
    title,
    contentType: type,
    markdown,
  });

  return {
    url,
    title,
    content,
    markdown: archived.markdown,
    contentType: type,
    archivePath: archived.archivePath,
    archiveRelativePath: archived.archiveRelativePath,
    fetchMethod: "jina-reader",
    warning: archived.warning,
  };
}

async function fetchViaReadability(url: string): Promise<FetchedUrlResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GoodEnglish/1.0)" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const content = article?.textContent?.replace(/\s+/g, " ").trim();
  if (!content) {
    throw new Error("未能从页面提取正文");
  }

  const markdown = buildStructuredMarkdown({
    url,
    title: article?.title || url,
    contentType: "generic",
    content,
    fetchMethod: "readability",
  });
  const archived = archiveGeneratedMarkdown({
    url,
    title: article?.title || url,
    contentType: "generic",
    markdown,
  });

  return {
    url,
    title: article?.title || url,
    content,
    markdown: archived.markdown,
    contentType: "generic",
    archivePath: archived.archivePath,
    archiveRelativePath: archived.archiveRelativePath,
    fetchMethod: "readability",
    warning: archived.warning,
  };
}

export async function fetchUrlContent(url: string): Promise<FetchedUrlResult> {
  const type = detectUrlType(url);
  const errors: string[] = [];

  if (type === "youtube") {
    try {
      return await fetchViaContentFetcher(url, type);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      return await fetchYouTubeFallback(url);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    throw new Error(
      `YouTube 字幕提取失败：${errors.join("；") || "未知错误"}。视频可能没有字幕或当前环境无法访问字幕。`,
    );
  }

  if (type === "twitter" || type === "zhihu" || type === "wechat") {
    try {
      return await fetchViaContentFetcher(url, type);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    if (type === "twitter") {
      try {
        return await fetchViaJinaReader(url, type);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(
      `${type === "twitter" ? "X / Twitter" : type === "zhihu" ? "知乎" : "微信公众号"} 抓取失败：${errors.join("；") || "未知错误"}。本地运行时请确保 Content Fetcher 可用；线上环境对这类站点通常会受限。`,
    );
  }

  try {
    return await fetchViaReadability(url);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    return await fetchViaJinaReader(url, type);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`内容抓取失败：${errors.join("；") || "未知错误"}`);
}
