import { NextResponse } from "next/server";

const INTRON_TTS_GENERATE_URL = "https://infer.voice.intron.io/tts/v1/generate";
const INTRON_TTS_STATUS_URL = "https://infer.voice.intron.io/tts/v1/status";
const MAX_TEXT_LENGTH = 600;

type TtsRequest = {
  text?: string;
  language?: "pcm" | "yo" | "en";
};

type IntronTtsResponse = {
  data?: {
    text_id?: string;
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
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text) || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n)\b/i.test(text);
  if (hasYoruba) return { language: "yo", accent: "yoruba" };

  const pidginHits = [" na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " e mean ", " wey ", " una ", " dem ", " am "]
    .filter((token) => lower.includes(token)).length;
  if (pidginHits >= 1) return { language: "pcm", accent: "pidgin" };

  return { language: "en", accent: "yoruba" };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveGeneratedAudio(apiKey: string, initial: IntronTtsResponse) {
  if (initial.data?.audio_path) return initial.data.audio_path;
  const textId = initial.data?.text_id;
  if (!textId) return null;

  // The synchronous endpoint may return a job id if generation is not immediately
  // complete. Poll briefly so callers still receive one playable response.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt < 5 ? 500 : 900);
    const statusResponse = await fetch(`${INTRON_TTS_STATUS_URL}/${encodeURIComponent(textId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const payload = (await statusResponse.json().catch(() => ({}))) as IntronTtsResponse;
    if (!statusResponse.ok) return null;
    if (payload.data?.processing_status === "TTS_TEXT_AUDIO_GENERATED" && payload.data.audio_path) {
      return payload.data.audio_path;
    }
    if (payload.data?.processing_status === "TTS_TEXT_AUDIO_PROCESSING_FAILED") return null;
  }
  return null;
}

async function fetchAudio(audioPath: string) {
  let url: URL;
  try {
    url = new URL(audioPath);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok || !response.body) return null;
  return response;
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
  const startedAt = Date.now();

  try {
    const response = await fetch(INTRON_TTS_GENERATE_URL, {
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
    if (!response.ok && response.status !== 503) {
      return NextResponse.json(
        {
          error: { message: payload.message || "Intron could not generate speech." },
          provider: "intron",
          voiceLanguage: voice.language,
          stage: "generate",
        },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }

    const audioPath = await resolveGeneratedAudio(apiKey, payload);
    if (!audioPath) {
      return NextResponse.json(
        {
          error: { message: payload.message || "Intron did not return playable audio." },
          provider: "intron",
          voiceLanguage: voice.language,
          stage: "generate-or-status",
        },
        { status: 502 },
      );
    }

    const audioResponse = await fetchAudio(audioPath);
    if (!audioResponse) {
      return NextResponse.json(
        {
          error: { message: "Intron generated the voice, but the audio file could not be loaded." },
          provider: "intron",
          voiceLanguage: voice.language,
          stage: "audio-fetch",
        },
        { status: 502 },
      );
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename=iroyin-voice.wav",
        "X-Iroyin-TTS-Provider": "intron",
        "X-Iroyin-TTS-Language": voice.language,
        "X-Iroyin-TTS-Ms": String(Date.now() - startedAt),
      },
    });
  } catch (error) {
    console.error("TTS route failed", error);
    return NextResponse.json(
      {
        error: { message: "Intron TTS is temporarily unavailable." },
        provider: "intron",
        voiceLanguage: voice.language,
        stage: "unexpected",
      },
      { status: 502 },
    );
  }
}
