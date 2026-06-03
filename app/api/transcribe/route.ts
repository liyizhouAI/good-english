import { NextRequest, NextResponse } from 'next/server';

type VoiceProviderId = 'openai' | 'dashscope';
const SAMPLE_AUDIO_URL =
  'https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3';

async function transcribeWithOpenAI(audio: Blob, apiKey: string, model: string) {
  const form = new FormData();
  form.append('file', audio, 'audio.webm');
  form.append('model', model);
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

async function transcribeWithDashScope(
  audio: Blob | string,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  let audioData: string;

  if (typeof audio === 'string') {
    audioData = audio;
  } else {
    const audioBytes = Buffer.from(await audio.arrayBuffer());
    if (audioBytes.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'DashScope ASR 单次语音识别限制为 10MB 以内' },
        { status: 413 },
      );
    }

    const mimeType = audio.type.split(';')[0] || 'audio/webm';
    audioData = `data:${mimeType};base64,${audioBytes.toString('base64')}`;
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: [
            {
              text: 'Transcribe the user audio accurately for English speaking practice. Preserve English words and mixed Chinese-English content.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: audioData },
            },
          ],
        },
      ],
      stream: false,
      asr_options: {
        enable_itn: true,
      },
    }),
  });

  const responseText = await res.text();
  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: unknown;
  } | null = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = null;
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error ?? responseText },
      { status: res.status },
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    return NextResponse.json(
      { error: 'DashScope 未返回有效转写文本' },
      { status: 502 },
    );
  }

  return NextResponse.json({ text });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob | null;
  const apiKey = formData.get('apiKey') as string | null;
  const testAudio = formData.get('testAudio') as string | null;
  const useSampleAudio = testAudio === 'dashscope-welcome';
  const providerId =
    (formData.get('providerId') as VoiceProviderId | null) ?? 'openai';
  const model =
    (formData.get('model') as string | null) ??
    (providerId === 'dashscope' ? 'qwen3-asr-flash' : 'gpt-4o-mini-transcribe');
  const baseUrl =
    (formData.get('baseUrl') as string | null) ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if ((!audio && !useSampleAudio) || !apiKey) {
    return NextResponse.json({ error: 'Missing audio or apiKey' }, { status: 400 });
  }

  if (providerId === 'dashscope') {
    return transcribeWithDashScope(audio ?? SAMPLE_AUDIO_URL, apiKey, model, baseUrl);
  }

  if (!audio && useSampleAudio) {
    const sampleResponse = await fetch(SAMPLE_AUDIO_URL);
    if (!sampleResponse.ok) {
      return NextResponse.json(
        { error: '无法加载语音识别测试音频' },
        { status: 502 },
      );
    }

    const sampleAudio = await sampleResponse.blob();
    return transcribeWithOpenAI(sampleAudio, apiKey, model);
  }

  if (!audio) {
    return NextResponse.json({ error: 'Missing audio or apiKey' }, { status: 400 });
  }

  return transcribeWithOpenAI(audio, apiKey, model);
}
