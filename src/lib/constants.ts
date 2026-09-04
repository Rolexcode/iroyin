import type { FactField, LanguagePair, Scenario } from "./types";

export const APP_NAME = "Ìròyìn";
export const CASE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_CLARIFICATIONS = 3;

export const LANGUAGE_OPTIONS: Array<{
  value: LanguagePair;
  label: string;
  helper: string;
  intronCode: "pcm" | "yo";
}> = [
  {
    value: "pcm_en",
    label: "Pidgin + English",
    helper: "Nigerian Pidgin and English code-switching",
    intronCode: "pcm",
  },
  {
    value: "yo_en",
    label: "Yorùbá + English",
    helper: "Yorùbá and English code-switching",
    intronCode: "yo",
  },
];

export const SCENARIOS: Record<
  Scenario,
  {
    label: string;
    shortLabel: string;
    description: string;
    criticalFields: FactField[];
  }
> = {
  tenancy_housing: {
    label: "Tenancy & housing",
    shortLabel: "Housing",
    description: "Rent, eviction, repairs, utilities, or landlord disputes.",
    criticalFields: [
      "incident_type",
      "event_or_action",
      "location",
      "time_date_or_duration",
      "actor_or_affected_person",
    ],
  },
  infrastructure_hazard: {
    label: "Public infrastructure hazard",
    shortLabel: "Infrastructure",
    description: "Unsafe power, roads, water, drainage, or public facilities.",
    criticalFields: [
      "incident_type",
      "event_or_action",
      "location",
      "time_date_or_duration",
      "urgency_or_risk",
    ],
  },
  workplace_public_service: {
    label: "Workplace or public-service complaint",
    shortLabel: "Work & services",
    description: "Pay, treatment at work, or a problem with a public service.",
    criticalFields: [
      "incident_type",
      "event_or_action",
      "location",
      "time_date_or_duration",
      "actor_or_affected_person",
    ],
  },
};

export const FACT_LABELS: Record<FactField, string> = {
  incident_type: "Incident type",
  event_or_action: "What happened",
  location: "Location",
  time_date_or_duration: "When / how long",
  actor_or_affected_person: "People involved",
  amount_quantity_or_count: "Amount / quantity",
  urgency_or_risk: "Urgency or risk",
  other_context_or_evidence: "Other context",
};

export const CLARIFICATION_QUESTIONS: Record<FactField, string> = {
  incident_type: "What kind of problem are you reporting?",
  event_or_action: "What exactly happened?",
  location: "Where exactly did this happen?",
  time_date_or_duration: "When did this happen, or how long has it been happening?",
  actor_or_affected_person: "Who did this affect or who was involved?",
  amount_quantity_or_count: "What amount or quantity was involved?",
  urgency_or_risk: "Is anyone in immediate danger, and what is the risk?",
  other_context_or_evidence: "What other detail should the report include?",
};

export const ACCEPTED_AUDIO_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/flac",
];
