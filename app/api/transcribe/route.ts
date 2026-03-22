import { NextRequest, NextResponse } from 'next/server';

async function transcribeOpenAI(audio: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.text;
}

async function transcribeMinimax(audio: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, 'audio.webm');
  form.append('model', 'speech-01');

  const res = await fetch('https://api.minimax.chat/v1/speech_recognition', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  // MiniMax returns { text: "..." } or nested under output
  return data.text ?? data.output?.text ?? '';
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob | null;
  const apiKey = formData.get('apiKey') as string | null;
  const provider = (formData.get('provider') as string) || 'openai';

  if (!audio || !apiKey) {
    return NextResponse.json({ error: 'Missing audio or apiKey' }, { status: 400 });
  }

  try {
    let text: string;
    if (provider === 'minimax') {
      text = await transcribeMinimax(audio, apiKey);
    } else {
      // openai / kimi-voice (kimi 没有 ASR，用 openai key 兜底)
      text = await transcribeOpenAI(audio, apiKey);
    }
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
