import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const INTRON_TTS_URL = "https://infer.voice.intron.io/tts/v1/generate";
const MAX_TEXT_LENGTH = 100;

type VoiceLanguage = "pcm" | "yo" | "en";
type TtsRequest = { text?: string; language?: VoiceLanguage };

type IntronTtsResponse = {
  data?: {
    audio_path?: string;
    processing_status?: string;
  };
  message?: string;
};

function chooseVoice(requested: VoiceLanguage = "en") {
  // Intron TTS treats Nigerian varieties as accents on its English voice.
  // This matches the provider docs/examples for Yoruba and Pidgin accents.
  if (requested === "pcm") return { requested, language: "en", accent: "pidgin" };
  if (requested === "yo") return { requested, language: "en", accent: "yoruba" };
  return { requested, language: "en", accent: "yoruba" };
}

function errorJson(message: string, stage: string, status: number) {
  return NextResponse.json({ error: { message }, stage }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return errorJson("Intron TTS is not configured.", "config", 503);

  let body: TtsRequest;
  try {
    body = (await request.json()) as TtsRequest;
  } catch {
    return errorJson("Invalid TTS request.", "request", 400);
  }

  const text = body.text?.trim();
  if (!text) return errorJson("Text is required.", "request", 400);
  if (text.length > MAX_TEXT_LENGTH) return errorJson("Voice text chunk is too long.", "request", 400);

  const voice = chooseVoice(body.language);

  try {
    const response = await fetch(INTRON_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_language: voice.language,
        voice_accent: voice.accent,
        voice_gender: "female",
        output_audio_format: "wav",
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as IntronTtsResponse;
    const audioPath = payload.data?.audio_path?.trim();

    if (!response.ok || !audioPath) {
      return errorJson(payload.message || "Intron could not generate speech.", "generate", response.status >= 400 ? response.status : 502);
    }

    const audioUrl = new URL(audioPath);
    const audioResponse = await fetch(audioUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "audio/*,*/*" },
    });

    if (!audioResponse.ok) return errorJson("Generated voice could not be loaded.", "audio-fetch", 502);

    const audioBytes = await audioResponse.arrayBuffer();
    if (!audioBytes.byteLength) return errorJson("Intron returned an empty audio file.", "audio-fetch", 502);

    return new Response(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=iroyin-voice.wav",
        "X-Iroyin-Voice-Provider": "intron",
        "X-Iroyin-Voice-Language": voice.requested,
        "X-Iroyin-Voice-Accent": voice.accent,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Intron TTS failed", error);
    return errorJson("Intron TTS is temporarily unavailable.", "network", 502);
  }
}
