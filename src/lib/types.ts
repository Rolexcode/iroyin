export type LanguagePair = "pcm_en" | "yo_en";

export type Scenario =
  | "tenancy_housing"
  | "infrastructure_hazard"
  | "workplace_public_service";

export type FactField =
  | "incident_type"
  | "event_or_action"
  | "location"
  | "time_date_or_duration"
  | "actor_or_affected_person"
  | "amount_quantity_or_count"
  | "urgency_or_risk"
  | "other_context_or_evidence";

export type FactStatus = "extracted" | "clarified" | "corrected" | "missing";

export type EvidenceSpan = {
  quote: string;
  start: number;
  end: number;
};

export type IncidentFact = {
  id: string;
  field: FactField;
  label: string;
  value: string | null;
  status: FactStatus;
  critical: boolean;
  evidence: EvidenceSpan | null;
};

export type ClarificationExchange = {
  field: FactField;
  question: string;
  answer: string;
  askedAt: string;
};

export type CaseStage =
  | "captured"
  | "structured"
  | "clarifying"
  | "review"
  | "verified";

export type IroyinCase = {
  schemaVersion: "1.0";
  caseId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  stage: CaseStage;
  scenario: Scenario;
  languagePair: LanguagePair;
  transcript: string;
  transcriptProvider: "sahara" | "demo" | "manual";
  transcriptFileId?: string;
  extractionMode: "openai" | "local_rules" | "demo_fixture";
  summary: string;
  facts: IncidentFact[];
  missingCriticalFields: FactField[];
  clarifications: ClarificationExchange[];
  verification: {
    status: "unverified" | "verified";
    verifiedAt: string | null;
    confirmationText: string | null;
  };
};

export type VerifiedResource = {
  id: string;
  scenario: Scenario;
  name: string;
  organization: string;
  description: string;
  channelLabel: string;
  channelUrl: string;
  sourceUrl: string;
  verifiedOn: string;
  coverage: string;
};

export type BenchmarkMetricSet = {
  normalizedWer?: number;
  normalizedCer?: number;
  switchWindowWer?: number;
  criticalEntityF1?: number;
  reportIntegrityScore?: number;
  oracleReportIntegrityScore?: number;
  asrIntegrityLoss?: number;
  medianLatencySeconds?: number;
  failureRate?: number;
};

export type BenchmarkArtifact = {
  protocolId: "iroyin-benchmark-v1.0";
  status: "not_run" | "complete" | "failed_validation";
  generatedAt: string | null;
  corpus: { expectedClips: 60; completedClips: number };
  providers: Array<{
    id: "sahara" | "gpt4o-transcribe" | "whisper-large-v3";
    label: string;
    metrics: BenchmarkMetricSet;
  }>;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: string;
  };
};
