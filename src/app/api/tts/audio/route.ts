import { NextResponse } from "next/server";

const INTRON_TTS_STATUS_URL = "https://infer.voice.intron.io/tts/v1/status";

type IntronStatusResponse = {
  data?: { audio_path?: string; processing_status?: string };
  message?: string;
};

export async function GET(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });

  const textId = new URL(request.url).searchParams.get("textId")?.trim();
  if (!textId || !/^[a-zA-Z0-9-]+$/.test(textId)) {
    return NextResponse.json({ error: { message: "A valid TTS job id is required." } }, { status: 400 });
  }

  try {
    const statusResponse = await fetch(`${INTRON_TTS_STATUS_URL}/${encodeURIComponent(textId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const statusPayload = (await statusResponse.json().catch(() => ({}))) as IntronStatusResponse;
    const audioPath = statusPayload.data?.audio_path;
    if (!statusResponse.ok || statusPayload.data?.processing_status !== "TTS_TEXT_AUDIO_GENERATED" || !audioPath) {
      return NextResponse.json({ error: { message: statusPayload.message || "Voice is not ready yet." } }, { status: statusResponse.ok ? 409 : statusResponse.status });
    }

    const audioResponse = await fetch(audioPath, { cache: "no-store" });
    if (!audioResponse.ok || !audioResponse.body) {
      return NextResponse.json({ error: { message: "Generated voice could not be loaded." } }, { status: 502 });
    }

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: { message: "Generated voice is temporarily unavailable." } }, { status: 502 });
  }
}
