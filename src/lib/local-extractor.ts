import { CASE_TTL_MS, SCENARIOS } from "./constants";
import { calculateMissingCriticalFields, createFact } from "./incident";
import type { FactField, IroyinCase, LanguagePair, Scenario } from "./types";

type Candidate = { field: FactField; value: string; quote: string };

function firstMatch(transcript: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function inferScenario(transcript: string): Scenario {
  const text = transcript.toLocaleLowerCase();
  if (/landlord|tenant|rent|house|room|evict|quit notice|roof|apartment/.test(text)) return "tenancy_housing";
  if (/transformer|electric|cable|road|pothole|drain|water|bridge|streetlight|spark|flood/.test(text)) {
    return "infrastructure_hazard";
  }
  return "workplace_public_service";
}

export function extractWithLocalRules(transcript: string, languagePair: LanguagePair): IroyinCase {
  const scenario = inferScenario(transcript);
  const critical = SCENARIOS[scenario].criticalFields;
  const candidates: Candidate[] = [];
  const location = firstMatch(transcript, [
    /(?:at|in|for|along|near)\s+[A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}'-]*){0,3}/u,
    /\b(?:Surulere|Yaba|Ikeja|Lekki|Ajah|Ikorodu|Abeokuta|Ibadan|Abuja|Lagos)\b/i,
  ]);
  const time = firstMatch(transcript, [
    /\b(?:since\s+)?yesterday(?:\s+(?:morning|afternoon|evening|night))?\b/i,
    /\b(?:today|last\s+(?:week|month|night)|this\s+(?:morning|afternoon|evening))\b/i,
    /\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/i,
  ]);
  const amount = firstMatch(transcript, [/₦\s?[\d,]+(?:\.\d{2})?/, /\b\d[\d,]*\s*(?:naira|months?|days?)\b/i]);
  const risk = firstMatch(transcript, [
    /(?:cable|wire)\s+(?:dey\s+)?burn[^.?!]*/i,
    /children?[^.?!]*(?:near|play)[^.?!]*/i,
    /(?:danger|unsafe|injur|fire|spark)[^.?!]*/i,
  ]);

  if (scenario === "infrastructure_hazard") {
    const event = firstMatch(transcript, [/(?:transformer|cable|road|drain|water)[^.?!]*/i]);
    const incident = firstMatch(transcript, [/transformer|cable|pothole|flood|drain|water/i]);
    if (incident) candidates.push({ field: "incident_type", value: "Public infrastructure hazard", quote: incident });
    if (event) candidates.push({ field: "event_or_action", value: event.trim(), quote: event });
  } else if (scenario === "tenancy_housing") {
    const event = firstMatch(transcript, [/(?:landlord|tenant|rent|room|house)[^.?!]*/i]);
    if (event) {
      candidates.push({ field: "incident_type", value: "Tenancy or housing complaint", quote: event.split(/\s+/).slice(0, 3).join(" ") });
      candidates.push({ field: "event_or_action", value: event.trim(), quote: event });
    }
  } else {
    const event = firstMatch(transcript, [/(?:employer|boss|salary|office|agency|service|hospital|school)[^.?!]*/i]);
    if (event) {
      candidates.push({ field: "incident_type", value: "Workplace or public-service complaint", quote: event.split(/\s+/).slice(0, 3).join(" ") });
      candidates.push({ field: "event_or_action", value: event.trim(), quote: event });
    }
  }
  if (location) candidates.push({ field: "location", value: location.replace(/^(at|in|for|along|near)\s+/i, ""), quote: location });
  if (time) candidates.push({ field: "time_date_or_duration", value: time, quote: time });
  if (amount) candidates.push({ field: "amount_quantity_or_count", value: amount, quote: amount });
  if (risk) candidates.push({ field: "urgency_or_risk", value: risk.trim(), quote: risk });

  const fields = new Set<FactField>([...critical, ...candidates.map((item) => item.field)]);
  const facts = [...fields].map((field) => {
    const candidate = candidates.find((item) => item.field === field);
    return createFact(transcript, field, candidate?.value ?? null, candidate?.quote ?? null, critical);
  });
  const missingCriticalFields = calculateMissingCriticalFields(scenario, facts);
  const now = new Date();
  const known = facts.filter((fact) => fact.value).map((fact) => `${fact.label.toLocaleLowerCase()}: ${fact.value}`);

  return {
    schemaVersion: "1.0",
    caseId: `IRY-${now.getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CASE_TTL_MS).toISOString(),
    stage: missingCriticalFields.length ? "clarifying" : "review",
    scenario,
    languagePair,
    transcript,
    transcriptProvider: "manual",
    extractionMode: "local_rules",
    summary: known.length ? `Reported ${known.slice(0, 3).join("; ")}.` : "The transcript needs more detail before a report can be prepared.",
    facts,
    missingCriticalFields,
    clarifications: [],
    verification: { status: "unverified", verifiedAt: null, confirmationText: null },
  };
}
