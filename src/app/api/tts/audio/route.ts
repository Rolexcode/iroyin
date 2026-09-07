import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const INTRON_TTS_STATUS_URL = "https://infer.voice.intron.io/tts/v1/status";
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord { return value && typeof value === "object" ? value as UnknownRecord : {}; }
function firstString(...values: unknown[]) { return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? ""; }

function audioPathFrom(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const result = asRecord(data.result);
  const audio = asRecord(data.audio);
  return firstString(
    data.audio_path, data.audioPath, data.audio_url, data.audioUrl,
    audio.path, audio.url, result.audio_path, result.audio_url,
    root.audio_path, root.audio_url,
  );
}

export async function GET(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });

  const textId = new URL(request.url).searchParams.get("textId")?.trim();
  if (!textId || !/^[a-zA-Z0-9_-]+$/.test(textId)) {
    return NextResponse.json({ error: { message: "A valid TTS job id is required." } }, { status: 400 });
  }

  try {
    const statusResponse = await fetch(`${INTRON_TTS_STATUS_URL}/${encodeURIComponent(textId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const raw = await statusResponse.json().catch(() => ({}));
    const audioPath = audioPathFrom(raw);
    if (!statusResponse.ok || !audioPath) {
      const root = asRecord(raw);
      return NextResponse.json({ error: { message: firstString(root.message) || "Voice is not ready yet." } }, { status: statusResponse.ok ? 409 : statusResponse.status });
    }

    let url: URL;
    try { url = new URL(audioPath); }
    catch { return NextResponse.json({ error: { message: "Intron returned an invalid audio location." } }, { status: 502 }); }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return NextResponse.json({ error: { message: "Intron returned an unsupported audio location." } }, { status: 502 });
    }

    const audioResponse = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!audioResponse.ok || !audioResponse.body) {
      return NextResponse.json({ error: { message: "Generated voice could not be loaded." } }, { status: 502 });
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline; filename=iroyin-voice.wav",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("TTS audio proxy failed", error);
    return NextResponse.json({ error: { message: "Generated voice is temporarily unavailable." } }, { status: 502 });
  }
}
