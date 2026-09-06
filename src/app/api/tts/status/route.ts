import { NextResponse } from "next/server";

const INTRON_TTS_STATUS_URL = "https://infer.voice.intron.io/tts/v1/status";

type IntronStatusResponse = {
  data?: {
    audio_path?: string;
    processing_status?: string;
    audio_duration_in_seconds?: number;
  };
  message?: string;
  status?: string;
};

export async function GET(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });

  const textId = new URL(request.url).searchParams.get("textId")?.trim();
  if (!textId || !/^[a-zA-Z0-9-]+$/.test(textId)) {
    return NextResponse.json({ error: { message: "A valid TTS job id is required." } }, { status: 400 });
  }

  try {
    const response = await fetch(`${INTRON_TTS_STATUS_URL}/${encodeURIComponent(textId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as IntronStatusResponse;
    if (!response.ok) {
      return NextResponse.json({ error: { message: payload.message || "Could not check voice status." } }, { status: response.status });
    }

    const status = payload.data?.processing_status || "";
    const audioUrl = payload.data?.audio_path;
    if (status === "TTS_TEXT_AUDIO_GENERATED" && audioUrl) {
      return NextResponse.json({ state: "ready", audioUrl, provider: "intron", duration: payload.data?.audio_duration_in_seconds ?? null });
    }
    if (status === "TTS_TEXT_AUDIO_PROCESSING_FAILED") {
      return NextResponse.json({ state: "failed", provider: "intron" });
    }
    return NextResponse.json({ state: "processing", provider: "intron" });
  } catch {
    return NextResponse.json({ error: { message: "Intron TTS status is temporarily unavailable." } }, { status: 502 });
  }
}
