import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { extractWithLocalRules } from "@/lib/local-extractor";

export const runtime = "nodejs";
export const maxDuration = 65;

const bodySchema = z.object({
  transcript: z.string().trim().min(3).max(12_000),
  languagePair: z.enum(["pcm_en", "yo_en"]),
  transcriptProvider: z.enum(["sahara", "manual"]).default("manual"),
  transcriptFileId: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Send a valid JSON extraction request.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      "invalid_extraction_request",
      "A transcript and supported language pair are required.",
    );
  }

  const { transcript, languagePair, transcriptProvider, transcriptFileId } = parsed.data;

  // Temporary product-testing mode: keep Sahara live for speech-to-text,
  // but bypass OpenAI extraction so we can verify the full Sahara flow
  // without requiring paid OpenAI API usage.
  const caseFile = extractWithLocalRules(transcript, languagePair);
  caseFile.transcriptProvider = transcriptProvider;
  caseFile.transcriptFileId = transcriptFileId;

  return NextResponse.json({
    caseFile,
    mode: "local_rules",
    notice: "Sahara transcription is live; structured extraction is temporarily using deterministic local rules for testing.",
  });
}
