import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { factFieldSchema, iroyinCaseSchema } from "@/lib/case-schema";
import { applyClarification, nextClarification } from "@/lib/incident";

const bodySchema = z.object({
  caseFile: iroyinCaseSchema,
  field: factFieldSchema,
  question: z.string().min(1).max(300),
  answer: z.string().trim().min(1).max(1_000),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Send a valid JSON clarification request.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError(400, "invalid_clarification", "A case, missing field, and concise answer are required.");
  const expected = nextClarification(parsed.data.caseFile);
  if (!expected || expected.field !== parsed.data.field) {
    return apiError(409, "unexpected_clarification", "Answer the next missing critical detail shown by Ìròyìn.");
  }
  const caseFile = applyClarification(
    parsed.data.caseFile,
    parsed.data.field,
    parsed.data.question,
    parsed.data.answer,
  );
  return NextResponse.json({ caseFile, next: nextClarification(caseFile) });
}
