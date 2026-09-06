import { NextResponse } from "next/server";

const INTRON_TTS_ENQUEUE_URL = "https://infer.voice.intron.io/tts/v1/enqueue";
const MAX_TEXT_LENGTH = 600;

type TtsRequest = { text?: string; language?: "pcm" | "yo" | "en" };
type IntronTtsResponse = { data?: { text_id?: string }; message?: string; status?: string };

function inferVoice(text: string, requested?: TtsRequest["language"]) {
  if (requested === "yo") return { language: "yo", accent: "yoruba" };
  if (requested === "pcm") return { language: "pcm", accent: "pidgin" };
  if (requested === "en") return { language: "en", accent: "yoruba" };
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text) || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n)\b/i.test(text);
  if (hasYoruba) return { language: "yo", accent: "yoruba" };
  const pidgin = [" na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " e mean ", " wey ", " una ", " dem ", " am "].some((token) => lower.includes(token));
  return pidgin ? { language: "pcm", accent: "pidgin" } : { language: "en", accent: "yoruba" };
}

export async function POST(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });

  let body: TtsRequest;
  try { body = (await request.json()) as TtsRequest; }
  catch { return NextResponse.json({ error: { message: "Invalid TTS request." } }, { status: 400 }); }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: { message: "Text is required." } }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: { message: "That response is too long to speak at once." } }, { status: 400 });

  const voice = inferVoice(text, body.language);
  try {
    const response = await fetch(INTRON_TTS_ENQUEUE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_language: voice.language, voice_accent: voice.accent, voice_gender: "female", output_audio_format: "wav" }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as IntronTtsResponse;
    const textId = payload.data?.text_id;
    if (!response.ok || !textId) {
      return NextResponse.json({ error: { message: payload.message || "Intron could not queue speech." }, provider: "intron", stage: "enqueue" }, { status: response.status >= 400 ? response.status : 502 });
    }
    return NextResponse.json({ textId, state: "processing", provider: "intron", voiceLanguage: voice.language, voiceAccent: voice.accent }, { status: 202 });
  } catch (error) {
    console.error("TTS enqueue failed", error);
    return NextResponse.json({ error: { message: "Could not reach Intron TTS." }, provider: "intron", stage: "enqueue-network" }, { status: 502 });
  }
}
