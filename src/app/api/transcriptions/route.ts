import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { ACCEPTED_AUDIO_TYPES, MAX_AUDIO_BYTES } from "@/lib/constants";
import { transcribeWithSahara } from "@/lib/server/intron";

export const runtime = "nodejs";
export const maxDuration = 150;

const languageSchema = z.enum(["pcm_en", "yo_en"]);

export async function POST(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) {
    return apiError(503, "provider_not_configured", "Sahara transcription is not configured on this server.", false);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "invalid_form", "Send the recording as multipart form data.");
  }
  const file = form.get("audio");
  const languageResult = languageSchema.safeParse(form.get("languagePair"));
  if (!(file instanceof File)) return apiError(400, "audio_required", "Choose or record an audio file first.");
  if (!languageResult.success) return apiError(400, "language_required", "Choose a supported language pair.");
  if (file.size === 0) return apiError(400, "audio_empty", "The selected audio file is empty.");
  if (file.size > MAX_AUDIO_BYTES) return apiError(413, "audio_too_large", "Audio must be 25 MB or smaller.");
  if (file.type && !ACCEPTED_AUDIO_TYPES.includes(file.type)) {
    return apiError(415, "audio_type_unsupported", "Use WAV, MP3, MP4, M4A, OGG, WebM, or FLAC audio.");
  }
  try {
    const result = await transcribeWithSahara(file, languageResult.data, apiKey);
    if (result.state === "failed") {
      return apiError(502, "transcription_failed", "Sahara could not transcribe this recording.", true, result.message);
    }
    return NextResponse.json(result, { status: result.state === "processing" ? 202 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected provider error.";
    return apiError(502, "transcription_provider_error", "The Sahara transcription request failed.", true, message);
  }
}
