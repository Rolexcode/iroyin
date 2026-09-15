import { z } from "zod";
import { LANGUAGE_PAIR_VALUES } from "./constants";

export const factFieldSchema = z.enum([
  "incident_type",
  "event_or_action",
  "location",
  "time_date_or_duration",
  "actor_or_affected_person",
  "amount_quantity_or_count",
  "urgency_or_risk",
  "other_context_or_evidence",
]);

const evidenceSchema = z.object({
  quote: z.string().min(1).max(8_000),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
const factSchema = z.object({
  id: z.string().min(1).max(160),
  field: factFieldSchema,
  label: z.string().min(1).max(120),
  value: z.string().trim().min(1).max(8_000).nullable(),
  status: z.enum(["extracted", "clarified", "corrected", "missing"]),
  critical: z.boolean(),
  evidence: evidenceSchema.nullable(),
});

export const iroyinCaseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  caseId: z.string().regex(/^IRY-\d{4}-[A-Z0-9]{6}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  stage: z.enum(["captured", "structured", "clarifying", "review", "verified"]),
  scenario: z.enum(["tenancy_housing", "infrastructure_hazard", "workplace_public_service"]),
  languagePair: z.enum(LANGUAGE_PAIR_VALUES),
  transcript: z.string().min(1).max(50_000),
  transcriptProvider: z.enum(["sahara", "demo", "manual"]),
  transcriptFileId: z.string().min(1).max(300).optional(),
  extractionMode: z.enum(["local_rules", "demo_fixture"]),
  summary: z.string().min(1).max(8_000),
  facts: z.array(factSchema).max(50),
  missingCriticalFields: z.array(factFieldSchema).max(8),
  clarifications: z.array(z.object({
    field: factFieldSchema,
    question: z.string().min(1).max(300),
    answer: z.string().min(1).max(1_000),
    askedAt: z.string().datetime(),
  })).max(3),
  verification: z.object({
    status: z.enum(["unverified", "verified"]),
    verifiedAt: z.string().datetime().nullable(),
    confirmationText: z.string().max(300).nullable(),
  }),
});
