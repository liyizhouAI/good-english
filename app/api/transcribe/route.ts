import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob | null;
  const apiKey = formData.get('apiKey') as string | null;
  const provider = (formData.get('provider') as string) || 'openai';

  if (!audio || !apiKey) {
    return NextResponse.json({ error: 'Missing audio or apiKey' }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.append('file', audio, 'audio.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'en');

  const baseUrl = provider === 'minimax'
    ? 'https://api.minimax.chat/v1'
    : 'https://api.openai.com/v1';

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ text: data.text });
}
