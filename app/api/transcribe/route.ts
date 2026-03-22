import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob | null;
  const apiKey = formData.get('apiKey') as string | null;

  if (!audio || !apiKey) {
    return NextResponse.json({ error: 'Missing audio or apiKey' }, { status: 400 });
  }

  const form = new FormData();
  form.append('file', audio, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ text: data.text });
}
