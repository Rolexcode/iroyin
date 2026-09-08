import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 150;

const INTRON_TTS_URL = "https://infer.voice.intron.io/tts/v1/generate";
const MAX_TEXT_LENGTH = 600;

type TtsRequest = {
  text?: string;
  language?: "pcm" | "yo" | "en";
};

type IntronTtsResponse = {
  data?: {
    audio_path?: string;
    audio_duration_in_seconds?: number;
    processing_status?: string;
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

function errorJson(message: string, stage: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { message }, stage, ...extra }, { status });
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
  if (text.length > MAX_TEXT_LENGTH) {
    return errorJson("That response is too long to speak at once.", "request", 400);
  }

  const voice = inferVoice(text, body.language);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70000);

    let generationResponse: Response;
    try {
      generationResponse = await fetch(INTRON_TTS_URL, {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await generationResponse.json().catch(() => ({}))) as IntronTtsResponse;
    const audioPath = payload.data?.audio_path?.trim();

    if (!generationResponse.ok || !audioPath) {
      return errorJson(
        payload.message || "Intron could not generate speech.",
        "generate",
        generationResponse.status >= 400 ? generationResponse.status : 502,
        { upstreamStatus: payload.data?.processing_status ?? null },
      );
    }

    let audioUrl: URL;
    try {
      audioUrl = new URL(audioPath);
    } catch {
      return errorJson("Intron returned an invalid audio location.", "audio-url", 502);
    }

    if (audioUrl.protocol !== "https:" && audioUrl.protocol !== "http:") {
      return errorJson("Intron returned an unsupported audio location.", "audio-url", 502);
    }

    const audioResponse = await fetch(audioUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "audio/*,*/*" },
    });

    if (!audioResponse.ok) {
      return errorJson(`Generated voice could not be loaded (${audioResponse.status}).`, "audio-fetch", 502);
    }

    const audioBytes = await audioResponse.arrayBuffer();
    if (!audioBytes.byteLength) {
      return errorJson("Intron returned an empty audio file.", "audio-fetch", 502);
    }

    return new Response(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=iroyin-voice.wav",
        "X-Iroyin-Voice-Language": voice.language,
        "X-Iroyin-Voice-Accent": voice.accent,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("Intron TTS generation failed", error);
    return errorJson(
      timedOut ? "Voice generation took too long. Please retry." : "Intron TTS is temporarily unavailable.",
      timedOut ? "timeout" : "network",
      502,
    );
  }
}
