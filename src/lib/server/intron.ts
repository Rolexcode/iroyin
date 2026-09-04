import { readJsonSafely } from "../api";
import type { LanguagePair } from "../types";

const INTRON_SYNC_URL = "https://infer.voice.intron.io/file/v1/upload/sync";
const INTRON_STATUS_URL = "https://infer.voice.intron.io/file/v1/status";

type IntronData = {
  file_id?: string;
  processing_status?: string;
  audio_transcript?: string;
  processed_audio_duration_in_seconds?: number;
};

type IntronPayload = {
  data?: IntronData;
  message?: string;
  status?: string;
};

export type IntronResult = {
  state: "complete" | "processing" | "failed";
  fileId: string | null;
  transcript: string | null;
  durationSeconds: number | null;
  providerStatus: string;
  message?: string;
};

function languageCode(languagePair: LanguagePair) {
  return languagePair === "yo_en" ? "yo" : "pcm";
}

function normalizePayload(payload: unknown, responseStatus: number): IntronResult {
  const parsed = (payload ?? {}) as IntronPayload;
  const data = parsed.data ?? {};
  const providerStatus = data.processing_status ?? parsed.status ?? `HTTP_${responseStatus}`;
  if (data.audio_transcript && providerStatus === "FILE_TRANSCRIBED") {
    return {
      state: "complete",
      fileId: data.file_id ?? null,
      transcript: data.audio_transcript,
      durationSeconds: data.processed_audio_duration_in_seconds ?? null,
      providerStatus,
      message: parsed.message,
    };
  }
  if (["FILE_QUEUED", "FILE_PENDING", "FILE_PROCESSING"].includes(providerStatus) || responseStatus === 503) {
    return {
      state: "processing",
      fileId: data.file_id ?? null,
      transcript: null,
      durationSeconds: data.processed_audio_duration_in_seconds ?? null,
      providerStatus,
      message: parsed.message,
    };
  }
  return {
    state: "failed",
    fileId: data.file_id ?? null,
    transcript: null,
    durationSeconds: data.processed_audio_duration_in_seconds ?? null,
    providerStatus,
    message: parsed.message,
  };
}

export async function transcribeWithSahara(
  file: File,
  languagePair: LanguagePair,
  apiKey: string,
): Promise<IntronResult> {
  const form = new FormData();
  form.append("audio_file_name", file.name || `iroyin-${Date.now()}`);
  form.append("audio_file_blob", file, file.name);
  form.append("use_language_asr_input", languageCode(languagePair));

  const response = await fetch(INTRON_SYNC_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(125_000),
    cache: "no-store",
  });
  const payload = await readJsonSafely(response);
  if (!response.ok && response.status !== 503) {
    const message = (payload as IntronPayload | null)?.message ?? `Sahara returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return normalizePayload(payload, response.status);
}

export async function getSaharaStatus(fileId: string, apiKey: string): Promise<IntronResult> {
  const response = await fetch(`${INTRON_STATUS_URL}/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const message = (payload as IntronPayload | null)?.message ?? `Sahara returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return normalizePayload(payload, response.status);
}
