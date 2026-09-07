import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 150;

const INTRON_TTS_GENERATE_URL = "https://infer.voice.intron.io/tts/v1/generate";
const INTRON_TTS_ENQUEUE_URL = "https://infer.voice.intron.io/tts/v1/enqueue";
const MAX_TEXT_LENGTH = 600;

type TtsRequest = { text?: string; language?: "pcm" | "yo" | "en" };
type IntronTtsResponse = {
  data?: {
    text_id?: string;
    audio_path?: string;
    processing_status?: string;
    audio_duration_in_seconds?: number;
  };
  message?: string;
  status?: string;
};

function inferVoice(text: string, requested?: TtsRequest["language"]) {
  if (requested === "yo") return { language: "yo", accent: "yoruba" };
  if (requested === "pcm") return { language: "pcm", accent: "pidgin" };
  if (requested === "en") return { language: "en", accent: "yoruba" };

  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text)
    || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n)\b/i.test(text);
  if (hasYoruba) return { language: "yo", accent: "yoruba" };

  const pidgin = [" na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " e mean ", " wey ", " una ", " dem ", " am "]
    .some((token) => lower.includes(token));
  return pidgin ? { language: "pcm", accent: "pidgin" } : { language: "en", accent: "yoruba" };
}

function voicePayload(text: string, voice: { language: string; accent: string }) {
  return {
    text,
    voice_language: voice.language,
    voice_accent: voice.accent,
    voice_gender: "female",
    output_audio_format: "wav",
  };
}

async function proxyGeneratedAudio(audioPath: string, language: string) {
  let url: URL;
  try {
    url = new URL(audioPath);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok || !response.body) return null;

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "audio/wav",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline; filename=iroyin-voice.wav",
      "X-Iroyin-TTS-Provider": "intron",
      "X-Iroyin-TTS-Language": language,
    },
  });
}

async function enqueue(apiKey: string, text: string, voice: { language: string; accent: string }) {
  const response = await fetch(INTRON_TTS_ENQUEUE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(voicePayload(text, voice)),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as IntronTtsResponse;
  return { response, payload };
}

export async function POST(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });
  }

  let body: TtsRequest;
  try {
    body = (await request.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: { message: "Invalid TTS request." } }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: { message: "Text is required." } }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: { message: "That response is too long to speak at once." } }, { status: 400 });
  }

  const voice = inferVoice(text, body.language);

  try {
    // Fast path: Intron's synchronous endpoint is much quicker for the short
    // speech excerpt the client sends. If it finishes, return the WAV itself so
    // mobile browsers never touch an upstream/mixed-content audio URL.
    const generateResponse = await fetch(INTRON_TTS_GENERATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(voicePayload(text, voice)),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (generateResponse) {
      const payload = (await generateResponse.json().catch(() => ({}))) as IntronTtsResponse;
      const audioPath = payload.data?.audio_path;
      if (generateResponse.ok && audioPath) {
        const audio = await proxyGeneratedAudio(audioPath, voice.language);
        if (audio) return audio;
      }

      // Intron documents that a timed-out synchronous request can include a
      // text id. Reuse it rather than creating a duplicate job.
      const timedOutId = payload.data?.text_id;
      if (timedOutId) {
        return NextResponse.json({
          textId: timedOutId,
          state: "processing",
          provider: "intron",
          voiceLanguage: voice.language,
          voiceAccent: voice.accent,
        }, { status: 202 });
      }

      if (!generateResponse.ok && generateResponse.status !== 503) {
        return NextResponse.json({
          error: { message: payload.message || "Intron could not generate speech." },
          provider: "intron",
          stage: "generate",
        }, { status: generateResponse.status });
      }
    }

    // Resilient path: if synchronous generation is slow/capacity-constrained,
    // queue the same short excerpt and let the client poll without holding one
    // long mobile HTTP request open.
    const queued = await enqueue(apiKey, text, voice);
    const textId = queued.payload.data?.text_id;
    if (!queued.response.ok || !textId) {
      return NextResponse.json({
        error: { message: queued.payload.message || "Intron could not queue speech." },
        provider: "intron",
        stage: "enqueue",
      }, { status: queued.response.status >= 400 ? queued.response.status : 502 });
    }

    return NextResponse.json({
      textId,
      state: "processing",
      provider: "intron",
      voiceLanguage: voice.language,
      voiceAccent: voice.accent,
    }, { status: 202 });
  } catch (error) {
    console.error("TTS request failed", error);
    return NextResponse.json({
      error: { message: "Could not reach Intron TTS." },
      provider: "intron",
      stage: "network",
    }, { status: 502 });
  }
}
