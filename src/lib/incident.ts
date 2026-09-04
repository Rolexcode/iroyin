import {
  CLARIFICATION_QUESTIONS,
  FACT_LABELS,
  MAX_CLARIFICATIONS,
  SCENARIOS,
} from "./constants";
import type {
  EvidenceSpan,
  FactField,
  IncidentFact,
  IroyinCase,
  Scenario,
} from "./types";

export function evidenceFor(transcript: string, quote: string): EvidenceSpan | null {
  const start = transcript.toLocaleLowerCase().indexOf(quote.toLocaleLowerCase());
  if (start < 0) return null;
  return { quote: transcript.slice(start, start + quote.length), start, end: start + quote.length };
}

export function createFact(
  transcript: string,
  field: FactField,
  value: string | null,
  evidenceQuote: string | null,
  criticalFields: FactField[],
): IncidentFact {
  const evidence = value && evidenceQuote ? evidenceFor(transcript, evidenceQuote) : null;
  return {
    id: `${field}-${crypto.randomUUID()}`,
    field,
    label: FACT_LABELS[field],
    value: evidence ? value : null,
    status: evidence ? "extracted" : "missing",
    critical: criticalFields.includes(field),
    evidence,
  };
}

export function calculateMissingCriticalFields(
  scenario: Scenario,
  facts: IncidentFact[],
): FactField[] {
  const values = new Map(facts.map((fact) => [fact.field, fact.value?.trim()]));
  return SCENARIOS[scenario].criticalFields.filter((field) => !values.get(field));
}

export function nextClarification(caseFile: IroyinCase) {
  if (caseFile.clarifications.length >= MAX_CLARIFICATIONS) return null;
  const field = caseFile.missingCriticalFields[0];
  if (!field) return null;
  return { field, question: CLARIFICATION_QUESTIONS[field] };
}

export function applyClarification(
  caseFile: IroyinCase,
  field: FactField,
  question: string,
  answer: string,
): IroyinCase {
  const value = answer.trim();
  if (!value) return caseFile;

  const existing = caseFile.facts.find((fact) => fact.field === field);
  const fact: IncidentFact = {
    id: existing?.id ?? `${field}-${crypto.randomUUID()}`,
    field,
    label: FACT_LABELS[field],
    value,
    status: "clarified",
    critical: SCENARIOS[caseFile.scenario].criticalFields.includes(field),
    evidence: null,
  };
  const facts = existing
    ? caseFile.facts.map((item) => (item.id === existing.id ? fact : item))
    : [...caseFile.facts, fact];
  const missingCriticalFields = calculateMissingCriticalFields(caseFile.scenario, facts);
  const now = new Date().toISOString();

  return {
    ...caseFile,
    updatedAt: now,
    stage:
      missingCriticalFields.length > 0 && caseFile.clarifications.length + 1 < MAX_CLARIFICATIONS
        ? "clarifying"
        : "review",
    facts,
    missingCriticalFields,
    clarifications: [
      ...caseFile.clarifications,
      { field, question, answer: value, askedAt: now },
    ],
  };
}

export function applyFactCorrection(
  caseFile: IroyinCase,
  factId: string,
  value: string,
): IroyinCase {
  const facts = caseFile.facts.map((fact) =>
    fact.id === factId
      ? { ...fact, value: value.trim() || null, status: "corrected" as const, evidence: null }
      : fact,
  );
  return {
    ...caseFile,
    facts,
    missingCriticalFields: calculateMissingCriticalFields(caseFile.scenario, facts),
    verification: { status: "unverified", verifiedAt: null, confirmationText: null },
    stage: "review",
    updatedAt: new Date().toISOString(),
  };
}

export function verifyCase(caseFile: IroyinCase): IroyinCase {
  const now = new Date().toISOString();
  return {
    ...caseFile,
    stage: "verified",
    updatedAt: now,
    verification: {
      status: "verified",
      verifiedAt: now,
      confirmationText: "I confirm that this report is accurate to the best of my knowledge.",
    },
  };
}

export function formatPlainTextReport(caseFile: IroyinCase): string {
  const facts = caseFile.facts
    .filter((fact) => fact.value)
    .map((fact) => `${fact.label}: ${fact.value}`)
    .join("\n");
  return [
    "ÌRÒYÌN INCIDENT REPORT",
    `Reference: ${caseFile.caseId}`,
    `Category: ${SCENARIOS[caseFile.scenario].label}`,
    `Created: ${new Date(caseFile.createdAt).toLocaleString("en-NG")}`,
    "",
    "SUMMARY",
    caseFile.summary,
    "",
    "REPORTED FACTS",
    facts,
    "",
    `Verification: ${caseFile.verification.status === "verified" ? "Confirmed by reporter" : "Not yet confirmed"}`,
    "",
    "This document records information supplied by the reporter. It is not legal advice and has not been submitted automatically.",
  ].join("\n");
}
