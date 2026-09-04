import { CASE_TTL_MS, FACT_LABELS, SCENARIOS } from "../constants";
import { calculateMissingCriticalFields, createFact } from "../incident";
import type { FactField, IroyinCase, LanguagePair, Scenario } from "../types";

const MODEL = "gpt-5-mini-2025-08-07";
const FACT_FIELDS: FactField[] = [
  "incident_type",
  "event_or_action",
  "location",
  "time_date_or_duration",
  "actor_or_affected_person",
  "amount_quantity_or_count",
  "urgency_or_risk",
  "other_context_or_evidence",
];

type ExtractionOutput = {
  scenario: Scenario;
  summary: string;
  facts: Array<{ field: FactField; value: string; evidenceQuote: string }>;
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scenario", "summary", "facts"],
  properties: {
    scenario: {
      type: "string",
      enum: ["tenancy_housing", "infrastructure_hazard", "workplace_public_service"],
    },
    summary: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "evidenceQuote"],
        properties: {
          field: { type: "string", enum: FACT_FIELDS },
          value: { type: "string" },
          evidenceQuote: { type: "string" },
        },
      },
    },
  },
} as const;

function outputText(payload: unknown): string {
  const response = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
}

export async function extractWithOpenAI(
  transcript: string,
  languagePair: LanguagePair,
  apiKey: string,
  transcriptProvider: "sahara" | "manual" = "sahara",
  transcriptFileId?: string,
): Promise<IroyinCase> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      temperature: 0,
      instructions:
        "Extract only facts explicitly supported by the transcript. evidenceQuote must be a non-empty exact contiguous substring of the transcript. Never infer a location, date, amount, identity, risk, or event. Omit unsupported facts. Classify into exactly one allowed scenario. Write a neutral one-sentence summary that explicitly says when a critical fact is missing. This is incident structuring, not legal advice.",
      input: `Language pair: ${languagePair}\nTranscript:\n${transcript}`,
      text: {
        format: {
          type: "json_schema",
          name: "iroyin_incident_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const error = payload as { error?: { message?: string } };
    throw new Error(error.error?.message ?? `OpenAI returned HTTP ${response.status}`);
  }
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI returned no structured extraction output.");
  const parsed = JSON.parse(text) as ExtractionOutput;
  if (!SCENARIOS[parsed.scenario]) throw new Error("OpenAI returned an unsupported incident scenario.");
  const critical = SCENARIOS[parsed.scenario].criticalFields;
  const seen = new Set<FactField>();
  const facts = parsed.facts.flatMap((candidate) => {
    if (seen.has(candidate.field) || !FACT_LABELS[candidate.field]) return [];
    seen.add(candidate.field);
    const fact = createFact(transcript, candidate.field, candidate.value, candidate.evidenceQuote, critical);
    return fact.value ? [fact] : [];
  });
  for (const field of critical) {
    if (!seen.has(field)) facts.push(createFact(transcript, field, null, null, critical));
  }
  const missingCriticalFields = calculateMissingCriticalFields(parsed.scenario, facts);
  const now = new Date();
  return {
    schemaVersion: "1.0",
    caseId: `IRY-${now.getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CASE_TTL_MS).toISOString(),
    stage: missingCriticalFields.length ? "clarifying" : "review",
    scenario: parsed.scenario,
    languagePair,
    transcript,
    transcriptProvider,
    transcriptFileId,
    extractionMode: "openai",
    summary: parsed.summary.trim(),
    facts,
    missingCriticalFields,
    clarifications: [],
    verification: { status: "unverified", verifiedAt: null, confirmationText: null },
  };
}
