import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSaharaStatus } from "@/lib/server/intron";

export const runtime = "nodejs";

const fileIdSchema = z.string().uuid();

export async function GET(request: Request) {
  const apiKey = process.env.INTRON_API_KEY;
  if (!apiKey) return apiError(503, "provider_not_configured", "Sahara is not configured on this server.");
  const fileId = new URL(request.url).searchParams.get("fileId");
  const parsed = fileIdSchema.safeParse(fileId);
  if (!parsed.success) return apiError(400, "invalid_file_id", "A valid Sahara file ID is required.");
  try {
    const result = await getSaharaStatus(parsed.data, apiKey);
    return NextResponse.json(result, { status: result.state === "processing" ? 202 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected provider error.";
    return apiError(502, "status_provider_error", "Could not check the Sahara transcription status.", true, message);
  }
}
