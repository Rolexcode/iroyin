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
    audio_duration_in_seconds?: number;
    processing_status?: string;
  };
  message?: string;
  status?: string;
};

function chooseVoice(language: VoiceLanguage = "en") {
  if (language === "yo") return { language: "yo", accent: "yoruba" };
  if (language === "pcm") return { language: "pcm", accent: "pidgin" };
  return { language: "en", accent: "yoruba" };
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
    return NextResponse.json({ error: { message: "Voice text is too long." } }, { status: 400 });
  }

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
    const audioUrl = payload.data?.audio_path?.trim();

    if (!response.ok || !audioUrl) {
      return NextResponse.json(
        {
          error: { message: payload.message || "Intron could not generate speech." },
          provider: "intron",
          voiceLanguage: voice.language,
          voiceAccent: voice.accent,
        },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }

    return NextResponse.json({
      audioUrl,
      provider: "intron",
      voiceLanguage: voice.language,
      voiceAccent: voice.accent,
      duration: payload.data?.audio_duration_in_seconds ?? null,
    });
  } catch (error) {
    console.error("Intron TTS failed", error);
    return NextResponse.json(
      { error: { message: "Intron TTS is temporarily unavailable." }, provider: "intron" },
      { status: 502 },
    );
  }
}
