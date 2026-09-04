import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { extractWithLocalRules } from "@/lib/local-extractor";
import { extractWithOpenAI } from "@/lib/server/openai-extractor";

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
  if (!parsed.success) return apiError(400, "invalid_extraction_request", "A transcript and supported language pair are required.");
  const { transcript, languagePair, transcriptProvider, transcriptFileId } = parsed.data;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const caseFile = extractWithLocalRules(transcript, languagePair);
    caseFile.transcriptProvider = transcriptProvider;
    caseFile.transcriptFileId = transcriptFileId;
    return NextResponse.json({ caseFile, mode: "local_rules", notice: "OpenAI is not configured; deterministic local extraction was used." });
  }
  try {
    const caseFile = await extractWithOpenAI(transcript, languagePair, apiKey, transcriptProvider, transcriptFileId);
    return NextResponse.json({ caseFile, mode: "openai" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected extraction error.";
    return apiError(502, "extraction_provider_error", "The structured extraction request failed.", true, message);
  }
}
