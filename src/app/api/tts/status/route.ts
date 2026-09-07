import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INTRON_TTS_STATUS_URL = "https://infer.voice.intron.io/tts/v1/status";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function parseStatus(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const result = asRecord(data.result);
  const nestedAudio = asRecord(data.audio);

  const status = firstString(
    data.processing_status,
    data.processingStatus,
    data.status,
    result.processing_status,
    result.status,
    root.processing_status,
    root.status,
  ).toUpperCase();

  const audioPath = firstString(
    data.audio_path,
    data.audioPath,
    data.audio_url,
    data.audioUrl,
    nestedAudio.path,
    nestedAudio.url,
    result.audio_path,
    result.audio_url,
    root.audio_path,
    root.audio_url,
  );

  const durationValue = data.audio_duration_in_seconds ?? data.duration ?? result.audio_duration_in_seconds;
  const duration = typeof durationValue === "number" ? durationValue : null;
  const message = firstString(root.message, data.message, result.message);
  return { status, audioPath, duration, message };
}

function isReady(status: string, audioPath: string) {
  if (!audioPath) return false;
  return status.includes("GENERATED") || status.includes("COMPLETE") || status.includes("COMPLETED") || status.includes("SUCCESS") || status.includes("READY") || !status;
}

function isFailed(status: string) {
  return status.includes("FAIL") || status.includes("ERROR") || status.includes("CANCEL");
}

export async function GET(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: "Intron TTS is not configured." } }, { status: 503 });

  const textId = new URL(request.url).searchParams.get("textId")?.trim();
  if (!textId || !/^[a-zA-Z0-9_-]+$/.test(textId)) {
    return NextResponse.json({ error: { message: "A valid TTS job id is required." } }, { status: 400 });
  }

  try {
    const response = await fetch(`${INTRON_TTS_STATUS_URL}/${encodeURIComponent(textId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const raw = await response.json().catch(() => ({}));
    const parsed = parseStatus(raw);

    if (!response.ok) {
      return NextResponse.json({
        error: { message: parsed.message || "Could not check voice status." },
        provider: "intron",
        stage: "status",
      }, { status: response.status });
    }

    if (isReady(parsed.status, parsed.audioPath)) {
      return NextResponse.json({
        state: "ready",
        audioUrl: `/api/tts/audio?textId=${encodeURIComponent(textId)}`,
        provider: "intron",
        duration: parsed.duration,
        upstreamStatus: parsed.status || "AUDIO_AVAILABLE",
      });
    }

    if (isFailed(parsed.status)) {
      return NextResponse.json({
        state: "failed",
        provider: "intron",
        upstreamStatus: parsed.status,
        error: { message: parsed.message || "Intron could not generate this voice." },
      });
    }

    return NextResponse.json({
      state: "processing",
      provider: "intron",
      upstreamStatus: parsed.status || "PROCESSING",
    });
  } catch (error) {
    console.error("TTS status failed", error);
    return NextResponse.json({
      error: { message: "Intron TTS status is temporarily unavailable." },
      provider: "intron",
      stage: "status-network",
    }, { status: 502 });
  }
}
