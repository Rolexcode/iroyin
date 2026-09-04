import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { applyClarification, nextClarification } from "@/lib/incident";
import type { IroyinCase } from "@/lib/types";

const bodySchema = z.object({
  caseFile: z.record(z.string(), z.unknown()),
  field: z.enum([
    "incident_type",
    "event_or_action",
    "location",
    "time_date_or_duration",
    "actor_or_affected_person",
    "amount_quantity_or_count",
    "urgency_or_risk",
    "other_context_or_evidence",
  ]),
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
  const caseFile = applyClarification(
    parsed.data.caseFile as IroyinCase,
    parsed.data.field,
    parsed.data.question,
    parsed.data.answer,
  );
  return NextResponse.json({ caseFile, next: nextClarification(caseFile) });
}
