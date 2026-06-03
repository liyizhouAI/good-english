#!/usr/bin/env node

const apiKey = process.env.DASHSCOPE_API_KEY;
const baseUrl =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.DASHSCOPE_ASR_MODEL || "qwen3-asr-flash";
const sampleAudioUrl =
  process.env.DASHSCOPE_ASR_AUDIO_URL ||
  "https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3";

if (!apiKey) {
  console.error("Missing DASHSCOPE_API_KEY");
  console.error("Usage: DASHSCOPE_API_KEY=sk-... npm run asr:test");
  process.exit(1);
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: sampleAudioUrl,
            },
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

const text = await response.text();
let data = null;
try {
  data = JSON.parse(text);
} catch {
  // keep raw text
}

if (!response.ok) {
  console.error(`DashScope ASR failed: HTTP ${response.status}`);
  console.error(typeof data?.error === "object" ? JSON.stringify(data.error) : text);
  process.exit(1);
}

const transcript = data?.choices?.[0]?.message?.content;
if (!transcript) {
  console.error("DashScope ASR returned no transcript");
  console.error(text);
  process.exit(1);
}

console.log(transcript);
