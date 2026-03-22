import { YoutubeTranscript } from 'youtube-transcript';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const MAX_WORDS = 8000;

type UrlType = 'youtube' | 'twitter' | 'generic';

function detectUrlType(url: string): UrlType {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/(?:x\.com|twitter\.com)/i.test(url)) return 'twitter';
  return 'generic';
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

async function fetchYouTube(videoId: string): Promise<{ content: string; isLong: boolean }> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId);

  const fullText = segments.map(s => s.text).join(' ');
  const wordCount = fullText.split(/\s+/).length;

  if (wordCount <= MAX_WORDS) {
    return { content: fullText, isLong: false };
  }

  // Long video: sample uniformly to preserve full-timeline coverage
  const targetSegments = Math.floor(segments.length * (MAX_WORDS / wordCount));
  const step = Math.max(1, Math.ceil(segments.length / targetSegments));
  const sampled = segments.filter((_, i) => i % step === 0);

  const content = '[视频过长，已抽样关键片段]\n\n' +
    sampled.map(s => {
      const mins = Math.floor(s.offset / 60);
      const secs = Math.floor(s.offset % 60);
      return `[${mins}:${secs.toString().padStart(2, '0')}] ${s.text}`;
    }).join('\n');

  return { content, isLong: true };
}

async function fetchTwitter(tweetId: string): Promise<string> {
  const res = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { text?: string; quoted_tweet?: { text?: string } };

  const parts: string[] = [];
  if (data.text) parts.push(data.text);
  if (data.quoted_tweet?.text) parts.push(`\nQuoted tweet: ${data.quoted_tweet.text}`);
  if (parts.length === 0) throw new Error('No text found in response');
  return parts.join('\n');
}

async function fetchGeneric(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoodEnglish/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.textContent) {
    return article.textContent.replace(/\s+/g, ' ').trim();
  }

  // Fallback: basic HTML stripping
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  const { url } = await req.json() as { url: string };

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const type = detectUrlType(url);

  try {
    if (type === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return Response.json({ error: '无效的 YouTube URL，无法提取视频 ID' }, { status: 400 });
      }
      const { content, isLong } = await fetchYouTube(videoId);
      return Response.json({ content, url, contentType: 'youtube', isLong });
    }

    if (type === 'twitter') {
      const tweetId = extractTweetId(url);
      if (!tweetId) {
        return Response.json(
          { error: '无效的 Twitter/X URL，请确保链接包含推文 ID（/status/...）' },
          { status: 400 },
        );
      }
      try {
        const content = await fetchTwitter(tweetId);
        return Response.json({ content, url, contentType: 'twitter' });
      } catch {
        return Response.json(
          { error: '推文抓取失败。请确保推文公开，或直接粘贴推文文本到文本框。' },
          { status: 502 },
        );
      }
    }

    // Generic webpage
    const content = await fetchGeneric(url);
    return Response.json({ content, url, contentType: 'generic' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (type === 'youtube') {
      return Response.json(
        { error: `YouTube 字幕提取失败：${msg}。视频可能没有字幕，或字幕未公开。` },
        { status: 502 },
      );
    }
    return Response.json({ error: `内容抓取失败：${msg}` }, { status: 502 });
  }
}
