import { CASE_TTL_MS } from "./constants";
import { createFact } from "./incident";
import type { IroyinCase } from "./types";

export const DEMO_TRANSCRIPT =
  "Transformer for our street don spark since yesterday. The cable dey burn and children dey play near am.";

export function createDemoCase(): IroyinCase {
  const now = new Date();
  const critical = [
    "incident_type",
    "event_or_action",
    "location",
    "time_date_or_duration",
    "urgency_or_risk",
  ] as const;
  const facts = [
    createFact(DEMO_TRANSCRIPT, "incident_type", "Electrical transformer hazard", "Transformer", [...critical]),
    createFact(DEMO_TRANSCRIPT, "event_or_action", "Transformer sparked and a cable is burning", "Transformer for our street don spark", [...critical]),
    createFact(DEMO_TRANSCRIPT, "location", null, null, [...critical]),
    createFact(DEMO_TRANSCRIPT, "time_date_or_duration", "Since yesterday", "since yesterday", [...critical]),
    createFact(DEMO_TRANSCRIPT, "urgency_or_risk", "Burning cable near children", "The cable dey burn and children dey play near am", [...critical]),
  ];
  return {
    schemaVersion: "1.0",
    caseId: `IRY-${now.getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CASE_TTL_MS).toISOString(),
    stage: "clarifying",
    scenario: "infrastructure_hazard",
    languagePair: "pcm_en",
    transcript: DEMO_TRANSCRIPT,
    transcriptProvider: "demo",
    extractionMode: "demo_fixture",
    summary: "A street transformer sparked yesterday, leaving a cable burning near children. The exact location is still needed.",
    facts,
    missingCriticalFields: ["location"],
    clarifications: [],
    verification: { status: "unverified", verifiedAt: null, confirmationText: null },
  };
}
