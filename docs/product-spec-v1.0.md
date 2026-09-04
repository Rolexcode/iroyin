# Ìròyìn Technical Blueprint

**Version:** 1.0 frozen  
**Date:** 3 September 2026  
**Status:** Approved with Whisper compute-location amendment  
**Implementation:** Authorized after protocol freeze

This document is the proposed source of truth for the first Ìròyìn prototype. Any change that affects benchmark data, model configuration, scoring, product scope, or safety rules must increment the specification version. Benchmark-affecting changes made after inference begins must be disclosed; old results may not be mixed with results from the amended protocol.

## 1. Product lock

### Identity

- **Name:** Ìròyìn
- **Tagline:** Speak it. Structure it. Act on it.
- **Descriptor:** Voice-first incident reporting built for how Africa actually speaks.
- **Challenge category:** Legal & Public Services
- **Prototype language pairs:** Nigerian Pidgin–English and Yoruba–English

### Product thesis

People should be able to report what happened in the language they naturally speak, not the language a form expects.

Ìròyìn converts a natural, code-switched account into a structured incident record. It identifies missing critical information, asks only the minimum necessary clarification, requires the reporter to verify the result, and then offers a small set of verified reporting or support resources.

### Core flow

**Speak or upload → transcribe → structure → detect critical gaps → ask targeted clarification → review and correct → verify → generate report → route or export**

### Product invariants

1. A populated fact must be supported by an exact source span from the original transcript or a clarification response.
2. Missing facts remain missing. The system never fills a gap by guessing.
3. Clarification is field-specific, deterministic, and bounded; it is not an open-ended chat.
4. No report is labelled verified until the reporter explicitly confirms it.
5. Resources are suggestions with provenance, not legal advice or guaranteed destinations.
6. Ìròyìn never submits a complaint or contacts an institution in this prototype.
7. The original transcript remains visible alongside the structured record.
8. Benchmark methodology and raw model outputs are inspectable and reproducible.

## 2. Prototype scope

### Supported scenarios

The first resource directory and clarification rules support only these categories:

1. **Tenancy or housing**
   - Lockout
   - Forced or threatened eviction
   - Removal of belongings
   - Landlord–tenant access dispute
2. **Public infrastructure hazard**
   - Sparking or exposed electricity infrastructure
   - Dangerous road or public-space condition
   - Unresolved hazard posing an immediate risk
3. **Workplace or public-service complaint**
   - Unpaid wages or withheld compensation
   - Improper workplace exclusion or dismissal account
   - Failure or misconduct in a supported public-service interaction

Each category exposes at most three verified resources for the jurisdiction covered by the demo. Unsupported categories are labelled clearly and produce a report without pretending that a verified destination is available.

### Users

- **Reporter:** records an account, supplies clarification, corrects facts, verifies, and exports.
- **Evaluator or judge:** inspects product behavior, model comparisons, methodology, and reproducibility artifacts.

There is no authentication, organization dashboard, case-management back office, social feature, or administrator interface in version 1.

### Explicit non-goals

- Translation as a standalone feature
- General-purpose voice assistant or chatbot
- Legal diagnosis, legal advice, eligibility decisions, or outcome predictions
- Automatic emergency dispatch
- Automatic submission to agencies or third parties
- Comprehensive Nigerian legal/public-service directory
- User profiles, saved history across devices, analytics dashboard, or collaboration
- Model training or fine-tuning
- Live execution of all benchmark models from the public web interface
- More languages or incident categories before the core submission is complete

## 3. Experience specification

### Case state machine

`idle → capturing/uploading → transcribing → extracting → needs_clarification → ready_for_review → verified → exported`

Recoverable error states may occur after upload, transcription, extraction, clarification, resource lookup, or export. An error must preserve the recording and all completed user work. A reporter may skip a clarification; skipped critical facts remain visibly marked **Not provided**.

### Surface A: Report

**Route:** `/`

Purpose: capture a single account with minimal setup.

Required elements:

- Product identity and one-sentence explanation
- Language-pair selector: `Pidgin + English` or `Yoruba + English`
- Required processing notice and consent checkbox
- Primary recording control with elapsed time and a 90-second limit
- File upload alternative
- Audio playback and replace-recording action
- Primary action: **Transcribe account**
- Clear supported-format, duration, and privacy guidance

States:

- Idle
- Permission request
- Recording
- Paused/stopped
- Audio ready
- Uploading/transcribing with progress copy
- Permission denied
- Unsupported file or duration
- Network/provider/rate-limit failure with retry

The page accepts WebM, WAV, MP3, M4A, OGG, and FLAC; the product cap is 90 seconds and 20 MB even though the upstream synchronous endpoint supports up to 120 seconds.

### Surface B: Review

**Route:** `/report/[caseId]/review`

Purpose: turn the transcript into a verified record without hiding uncertainty.

Layout:

- Original-audio player
- Editable transcript with revision history for the current session
- Detected category and subtype
- Structured fact list
- Evidence-span affordance for every extracted fact
- Missing/ambiguous status shown with text and icon, never color alone
- One targeted clarification card at a time
- Generated report preview
- Verified-resource recommendations
- Final verification statement
- Copy and PDF export actions

The clarification card is not a chat thread. It contains:

- One fixed question
- Why the field is needed
- Text answer input
- Optional **Answer by voice** control using the same recorder
- **I don't know / Skip** action

Only the requested field may be updated from a clarification response. The system re-evaluates the missing-field rules after every answer and asks at most three questions per case.

The final confirmation reads: **I reviewed this report and it accurately reflects the account I provided.** Export remains disabled until that confirmation is checked. Missing fields do not prevent export, but they remain visible in the report.

### Surface C: Benchmark Lab

**Route:** `/benchmark`

Purpose: let judges inspect the claim instead of trusting marketing copy.

Required elements:

- Sahara, GPT-4o Transcribe, and Whisper large-v3 comparison
- Dataset filter: official AfriSwitch or Ìròyìn incident set
- Language-pair, scenario, noise condition, and speaker filters stored in URL search parameters
- Exact metric table before charts
- Per-clip transcript comparison
- Highlighted substitutions, insertions, deletions, switch boundaries, and critical entities
- Report Integrity Score breakdown by field family
- Human-transcript oracle comparison
- Latency and failure-rate table
- Methodology, model configuration, protocol hash, run date, and limitations
- Download links for the non-sensitive result manifest and aggregate metrics

The public interface reads precomputed artifacts. It does not spend API credit or run Whisper in Vercel.

### Supporting routes

- `/benchmark/methodology` — full frozen protocol and limitations
- `/privacy` — processing destinations, retention behavior, and reporter controls

These are supporting documents, not additional product surfaces.

### Accessibility and responsive behavior

- Semantic buttons, links, labels, fieldsets, and status regions
- Logical keyboard order and visible focus rings
- Minimum 44 × 44 px mobile targets for record, playback, clarification, and export controls
- Screen-reader announcement of recording state, elapsed time, upload progress, and errors
- No important meaning conveyed through color alone
- WCAG AA text and control contrast
- Reduced-motion support; no decorative motion is required for comprehension
- Tested at 375 px, 768 px, and 1280 px widths
- Loading, empty, success, partial, offline, and error states defined for every data-driven component
- Neutral token-based light/dark theme until a separate brand decision is approved

## 4. Domain and data schemas

The TypeScript-like definitions below are contracts, not implementation code.

```ts
type SupportedLanguagePair = "pcm-en" | "yo-en";

type IncidentCategory =
  | "tenancy_housing"
  | "public_infrastructure_hazard"
  | "workplace_public_service_complaint"
  | "unsupported";

type CaseStatus =
  | "draft"
  | "transcribing"
  | "extracting"
  | "needs_clarification"
  | "ready_for_review"
  | "verified"
  | "exported";

type FactState = "explicit" | "missing" | "ambiguous";
type FactOrigin = "initial_transcript" | "clarification" | "user_correction";
type VerificationState = "unreviewed" | "confirmed" | "corrected";

interface EvidenceRef {
  source: "initial_transcript" | "clarification_response";
  sourceId: string;
  startChar: number;
  endChar: number;
  quote: string;
}

interface Fact<T> {
  field: FactField;
  value: T | null;
  state: FactState;
  origin: FactOrigin;
  verification: VerificationState;
  evidence: EvidenceRef[];
}
```

A fact with `state: "explicit"` must have a non-null value and at least one evidence reference. A fact with `state: "missing"` must have a null value and no fabricated evidence. `ambiguous` facts retain the competing source references but have no selected value until the reporter resolves them.

```ts
type FactField =
  | "incident_type"
  | "event_action"
  | "negation_polarity"
  | "actor_responsible_party"
  | "affected_party"
  | "location"
  | "occurred_at"
  | "duration"
  | "amounts_quantities_counts"
  | "hazard_or_harm"
  | "people_at_risk"
  | "urgency"
  | "evidence_mentioned"
  | "other_context";

interface TranscriptRecord {
  id: string;
  provider: "sahara" | "human";
  model: string;
  languagePair: SupportedLanguagePair;
  text: string;
  durationMs: number;
  createdAt: string;
  revisions: Array<{
    text: string;
    reason: "provider_output" | "user_correction";
    createdAt: string;
  }>;
}

interface CaseRecord {
  schemaVersion: "1.0";
  id: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  languagePair: SupportedLanguagePair;
  localAudioAssetId: string;
  transcript: TranscriptRecord;
  category: Fact<IncidentCategory>;
  subtype: Fact<string>;
  facts: Record<FactField, Fact<unknown>>;
  clarificationHistory: ClarificationTurn[];
  reporterVerifiedAt: string | null;
}
```

### Clarification contract

```ts
type ClarificationReason = "missing" | "ambiguous" | "conflicting";

interface ClarificationRequest {
  id: string;
  caseId: string;
  field: FactField;
  reason: ClarificationReason;
  priority: number;
  questionTemplateId: string;
  question: string;
  acceptedAnswerModes: Array<"text" | "voice">;
}

interface ClarificationTurn {
  request: ClarificationRequest;
  answer: {
    mode: "text" | "voice" | "skipped";
    text: string | null;
    transcriptId: string | null;
    createdAt: string;
  };
  resultingFact: Fact<unknown>;
}
```

Question text comes from a versioned allowlist. The extraction model may identify the missing field, but it may not invent new question forms.

### Category-specific required fields

| Category | Required critical fields | Conditional fields |
|---|---|---|
| Tenancy/housing | incident type, event/action, affected party, location, time/date | responsible party; amount only when money/rent is material |
| Infrastructure hazard | hazard/event, location, first-observed time or duration, immediate risk | people at risk; responsible service if explicitly known |
| Workplace/public service | event/action or omission, affected party, organization/respondent, time/date or duration, jurisdiction/location | amount for wages/fees; urgency when continuing harm is described |

Priority is category-aware. Immediate hazard/risk is asked before administrative detail. Otherwise: incident type or action → location → affected party/respondent → time/date → conditional amount. The system asks no more than three questions and never asks for phone number, email, government ID, or an exact victim name unless a later approved workflow makes it essential.

### Resource schema

```ts
interface VerifiedResource {
  schemaVersion: "1.0";
  id: string;
  categories: IncidentCategory[];
  supportedSubtypes: string[];
  jurisdiction: {
    country: "NG";
    state?: string;
    locality?: string;
  };
  organizationName: string;
  channelType: "web" | "phone" | "email" | "in_person";
  channelValue: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  eligibilityNote: string;
  limitationNote: string;
  active: boolean;
}
```

Every displayed recommendation shows its source and verification date. Matching is deterministic: supported category/subtype plus jurisdiction, ordered by specificity and then by a manually frozen priority. The UI shows at most three results. If no verified match exists, it says so plainly.

### Generated report schema

```ts
interface GeneratedReport {
  schemaVersion: "1.0";
  caseId: string;
  title: string;
  category: IncidentCategory;
  structuredFacts: Array<{
    label: string;
    value: string | null;
    state: FactState;
  }>;
  statement: string;
  unansweredCriticalFields: FactField[];
  reporterVerifiedAt: string;
  generatedAt: string;
  disclaimer: string;
}
```

The statement is rendered from confirmed facts with deterministic templates. A language model may not add facts during report rendering.

## 5. API contracts

### Common envelope

```ts
type ApiSuccess<T> = { ok: true; requestId: string; data: T };

type ApiFailure = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
};
```

Provider errors and stack traces are never returned to the browser.

### `POST /api/transcriptions`

Accepts `multipart/form-data`:

- `audio`: required binary file
- `languagePair`: `pcm-en` or `yo-en`
- `consent`: literal `true`

Validation: supported content signature, 20 MB maximum, 90 seconds maximum after decoding, non-empty audio, and a permitted language pair.

Response `200`:

```json
{
  "ok": true,
  "requestId": "req_...",
  "data": {
    "status": "complete",
    "transcript": {
      "id": "tr_...",
      "provider": "sahara",
      "model": "sahara-v2.5",
      "languagePair": "pcm-en",
      "text": "...",
      "durationMs": 18000,
      "createdAt": "...",
      "revisions": []
    },
    "latencyMs": 2200
  }
}
```

If Sahara returns a pending file identifier, respond `202` with an opaque, signed, expiring `pollToken`. Do not expose a raw provider credential or use an unsigned provider file ID.

### `GET /api/transcriptions/status?token=...`

Verifies the signed token and proxies Sahara's status endpoint. Returns `202` while pending, `200` with the normalized `TranscriptRecord` when complete, and a retryable failure for capacity or timeout conditions.

### `POST /api/incidents/extract`

Request:

```json
{
  "caseId": "case_...",
  "languagePair": "pcm-en",
  "transcript": { "id": "tr_...", "text": "..." }
}
```

Response: schema-validated `CaseRecord`, the first `ClarificationRequest` if one is required, and a list of validation warnings. The server rejects every populated fact whose cited quote is not an exact substring of the referenced source.

The reasoning provider is a pinned structured-output model, initially `gpt-5-mini-2025-08-07`. The model ID, extraction prompt hash, and schema version are recorded in benchmark manifests. A model change requires a protocol version change before new benchmark results are produced.

### `POST /api/incidents/clarify`

Request:

```json
{
  "case": {},
  "requestId": "clarify_...",
  "answer": {
    "mode": "text",
    "text": "It happened opposite number 12, Oke Street."
  }
}
```

The endpoint may update only the requested fact. For a voice answer, the browser first obtains a Sahara transcript and supplies that transcript ID and text. Response: updated case, resulting fact, and the next deterministic question or `null`.

### `GET /api/resources`

Parameters: `category`, `subtype`, `country`, optional `state` and `locality`. Returns zero to three matching `VerifiedResource` objects and an explicit coverage message.

### `POST /api/reports/render`

Accepts a verified `CaseRecord`, revalidates its evidence and verification state, and returns `application/pdf`. Copyable plain text is rendered client-side from the same `GeneratedReport` object. No report is stored server-side.

### `GET /api/benchmark/results`

Returns the public result manifest, aggregate metrics, protocol hash, model configurations, and safe per-clip comparison data. Audio and personally identifying content are excluded unless explicit publication consent is recorded.

### External integration lock

- **Product ASR:** Intron Sahara synchronous file transcription; Pidgin–English uses language code `pcm`, Yoruba–English uses `yo`. A pending job falls back to status polling.
- **Benchmark ASR A:** the same Sahara adapter and settings as the product.
- **Benchmark ASR B:** OpenAI Audio Transcriptions, model `gpt-4o-transcribe`, JSON response, temperature 0, no lexical prompt, no language hint.
- **Benchmark ASR C:** `faster-whisper` using Whisper `large-v3`, a pinned model revision, automatic language detection, beam size 5, temperature 0, and `condition_on_previous_text=false` for independent short clips. Execution may use local hardware or a reproducible GPU notebook/cloud environment.
- **Extraction:** pinned schema-constrained text model, identical prompt and schema for all ASR outputs and the human oracle.

API keys exist only in server or local benchmark-runner environment variables. Transcript/audio content is excluded from application logs.

## 6. Targeted clarification rules

The clarification engine is a rules service over the validated `CaseRecord`.

1. Classify the case into a supported category or `unsupported`.
2. Load the category's required-field rule set.
3. Mark a field eligible for clarification only when it is required and is missing, ambiguous, or conflicting.
4. Rank eligible fields using the frozen category priority.
5. Emit exactly one allowlisted question.
6. Accept an answer, a correction, or a skip.
7. Update only that field and re-run the rules.
8. Stop when there are no eligible fields, three questions have been asked, or the reporter chooses to proceed.

Initial question templates include:

| Field | Template |
|---|---|
| Incident type/action | “What exactly happened?” |
| Location | “Where exactly did this happen?” |
| Time/date | “When did this happen?” |
| Affected party | “Who was directly affected?” |
| Responsible party | “Who took, failed to take, or threatened the action?” |
| Amount/quantity | “What amount or quantity was involved?” |
| Immediate risk | “Is anyone in immediate danger from this right now?” |

Question wording may be localized later, but changes are versioned. No model-generated follow-up prose is permitted in version 1.

## 7. Frozen benchmark protocol

### Freeze mechanism

Before the first model call:

1. Commit the protocol, dataset manifests, normalization rules, extraction prompt, JSON schemas, model settings, and metric weights.
2. Generate a SHA-256 hash of the combined protocol files.
3. Tag the commit `benchmark-protocol-v1`.
4. Write the Git commit, protocol hash, model IDs/revisions, dependency lock hashes, and run timestamp into every result manifest.

If an integration blocker requires a model or setting change, create protocol `v1.1` before running that changed configuration. Never overwrite or merge incompatible raw runs.

### Corpus A: official code-switching subset

Source: `intronhealth/AfriSwitch`, test split, configs `pidgin` and `yoruba`.

Selection:

- Filter to 3–30 second clips with at least one annotated switch point.
- Within each language, divide Code-Mixing Index into low, medium, and high tertiles.
- Within each tertile, divide clips into short and long duration buckets at the language-specific median.
- Select three clips from each of the six cells with fixed seed `260903`.
- Result: 18 Pidgin–English + 18 Yoruba–English = **36 official clips**.

The frozen manifest stores dataset revision, config, filename, reference-text hash, duration, CMI, switch-point count, and selection cell. It references the Hugging Face source rather than republishing audio.

### Corpus B: Ìròyìn incident set

Start with **24 custom clips**:

- 8 tenancy/housing
- 8 public infrastructure hazards
- 8 workplace/public-service complaints
- 12 Pidgin–English and 12 Yoruba–English
- 12 quiet and 12 controlled-noise recordings
- At least four consenting speakers, with no speaker contributing more than eight clips
- Unique 8–30 second acted scenarios; no account of a real identifiable incident

Coverage requirements may overlap:

- At least 8 clips deliberately omit a critical fact
- At least 8 contain meaningful negation
- At least 8 contain an amount, quantity, or count
- At least 8 contain a specific time/date or duration
- At least 8 contain a locally meaningful named location or organization
- Every clip contains at least one natural language switch

Each clip has a signed consent record kept outside the public repository, a human reference transcript reviewed by a proficient speaker, token-level language tags or annotated switch boundaries, and a gold structured report. The set may expand only after the initial 24-clip run is complete; expansion is reported as a separate cohort.

### Audio preprocessing

- Preserve original files and SHA-256 hashes.
- Decode once to PCM WAV, 16 kHz, mono, 16-bit.
- Do not denoise, enhance, trim speech manually, or perform provider-specific preprocessing.
- Do not manually correct model transcripts.
- Use identical normalized audio bytes for all three ASR systems.
- Record end-to-end latency separately from model-reported processing time.

### Provider settings

| Provider | Frozen setting |
|---|---|
| Sahara | Sync file endpoint; `use_language_asr_input=pcm` or `yo`; LLM correction left enabled explicitly with `use_disable_llm_corrections=FALSE`; no category template, summary, or entity add-on |
| GPT-4o Transcribe | `gpt-4o-transcribe`; JSON; temperature 0; no prompt; no language hint |
| Whisper | `large-v3` through pinned `faster-whisper`; automatic language detection; beam 5; temperature 0; no prior-text conditioning; local or reproducible GPU notebook/cloud execution permitted |

The Sahara language-pair selector is a documented provider requirement/feature and is disclosed as a configuration difference. No model receives incident vocabulary, expected entities, or reference text.

Transient failures may be retried twice with exponential backoff. Every attempt and terminal failure is retained in the raw manifest; successful retries do not erase the failure record.

### Text normalization

Report both raw and normalized WER/CER.

Normalized text applies Unicode NFKC, lowercase conversion, punctuation removal, and whitespace collapse. It preserves Yoruba diacritics and numeric content. A separate deterministic entity canonicalizer maps equivalent currency/number surface forms such as `₦20,000`, `20k`, and `twenty thousand naira` to a canonical typed value for downstream scoring; it does not alter WER reference text.

### ASR metrics

- Raw WER and CER
- Normalized WER and CER
- Switch-window WER: WER on reference tokens within three tokens on either side of each annotated switch boundary
- Critical-entity retention by entity family
- End-to-end latency
- Provider failure and retry rate

Official AfriSwitch clips receive ASR metrics only. Downstream report metrics run on the custom incident set, which has gold structured reports.

### Report Integrity Score

The Report Integrity Score (RIS) is frozen before inference.

Each benchmark case defines a fixed set of gold slots. Each slot belongs to one weight family:

| Field family | Weight |
|---|---:|
| Core event/action | 5 |
| Negation or polarity | 5 |
| Amount, quantity, or count | 5 |
| Actor or affected party | 5 |
| Incident type | 4 |
| Location | 4 |
| Time, date, or duration | 3 |
| Urgency or immediate risk | 3 |
| Context or evidence mention | 1 |

For field `f`, deterministic score `s_f` is between 0 and 1:

- Gold present, prediction present: exact canonical match for enums, polarity, numbers, dates, and booleans; set F1 for lists; normalized token F1 for free-text entities.
- Gold present, prediction missing: `0`.
- Gold missing, prediction missing: `1`.
- Gold missing, prediction populated: `0` because the system invented a fact.
- Gold ambiguous, prediction ambiguous: `1`; selecting an unsupported value scores `0`.

```text
RIS_case = 100 × Σ(weight_f × score_f) / Σ(weight_f)
RIS_model = macro-average(RIS_case across all custom cases)
```

There is no manual partial-credit override and no reweighting after results are visible. Confidence intervals are produced by paired bootstrap resampling over clips. Results remain descriptive given the small prototype dataset.

### Clarification metrics

- Critical-gap detection precision, recall, and F1
- Unnecessary-question rate
- Mean number of questions per case
- Critical-gap resolution rate after clarification
- Fact accuracy before and after clarification

### Human-transcript oracle

The exact same pinned extractor, prompt, schema, gap rules, and scorer run on:

1. The human reference transcript
2. Sahara's transcript
3. GPT-4o Transcribe's transcript
4. Whisper large-v3's transcript

Report:

```text
Oracle RIS = RIS from the human reference transcript
Provider RIS = RIS from a provider transcript
ASR integrity loss = Oracle RIS − Provider RIS
```

The value is not clamped. A negative value is retained and investigated rather than hidden. Raw extraction JSON, prompt hash, model response identifier, schema version, and scorer output are cached for every run. This separates extraction limitations from information lost during transcription.

## 8. Repository structure

```text
iroyin/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ report/[caseId]/review/page.tsx
│  │  ├─ benchmark/page.tsx
│  │  ├─ benchmark/methodology/page.tsx
│  │  ├─ privacy/page.tsx
│  │  └─ api/
│  │     ├─ transcriptions/route.ts
│  │     ├─ transcriptions/status/route.ts
│  │     ├─ incidents/extract/route.ts
│  │     ├─ incidents/clarify/route.ts
│  │     ├─ resources/route.ts
│  │     ├─ reports/render/route.ts
│  │     └─ benchmark/results/route.ts
│  ├─ components/
│  │  ├─ shell/
│  │  ├─ report/
│  │  │  ├─ audio-recorder.tsx
│  │  │  ├─ audio-upload.tsx
│  │  │  ├─ transcript-editor.tsx
│  │  │  ├─ fact-list.tsx
│  │  │  ├─ fact-field.tsx
│  │  │  ├─ evidence-reference.tsx
│  │  │  ├─ clarification-card.tsx
│  │  │  ├─ report-preview.tsx
│  │  │  ├─ resource-recommendations.tsx
│  │  │  └─ verification-actions.tsx
│  │  ├─ benchmark/
│  │  │  ├─ metric-table.tsx
│  │  │  ├─ transcript-diff.tsx
│  │  │  ├─ critical-fact-matrix.tsx
│  │  │  ├─ ris-breakdown.tsx
│  │  │  ├─ oracle-comparison.tsx
│  │  │  └─ benchmark-filters.tsx
│  │  └─ ui/
│  ├─ domain/
│  │  ├─ case/
│  │  ├─ clarification/
│  │  ├─ report/
│  │  ├─ resources/
│  │  └─ benchmark/
│  ├─ server/
│  │  ├─ asr/sahara.ts
│  │  ├─ extraction/
│  │  ├─ report-rendering/
│  │  ├─ rate-limit/
│  │  └─ logging/
│  └─ storage/
│     └─ local-case-store.ts
├─ schemas/
│  ├─ case-record.schema.json
│  ├─ resource.schema.json
│  ├─ benchmark-case.schema.json
│  └─ report-integrity.schema.json
├─ data/
│  └─ resources/
│     ├─ tenancy-housing.json
│     ├─ infrastructure-hazard.json
│     └─ workplace-public-service.json
├─ benchmark/
│  ├─ README.md
│  ├─ pyproject.toml
│  ├─ config/protocol.v1.json
│  ├─ config/report-integrity-weights.v1.json
│  ├─ manifests/afriswitch.v1.jsonl
│  ├─ manifests/iroyin-incidents.v1.jsonl
│  ├─ adapters/sahara.py
│  ├─ adapters/openai_transcribe.py
│  ├─ adapters/whisper_large_v3.py
│  ├─ evaluation/normalize.py
│  ├─ evaluation/asr_metrics.py
│  ├─ evaluation/report_integrity.py
│  ├─ evaluation/clarification_metrics.py
│  ├─ evaluation/oracle.py
│  └─ runs/.gitkeep
├─ public/benchmark-results/
│  └─ latest/
│     ├─ manifest.json
│     ├─ aggregate.json
│     └─ safe-comparisons.json
├─ tests/
│  ├─ unit/
│  ├─ contracts/
│  ├─ fixtures/
│  └─ e2e/
├─ docs/
│  ├─ product-spec.md
│  ├─ benchmark-protocol.md
│  ├─ responsible-ai.md
│  ├─ data-handling.md
│  ├─ resource-verification.md
│  └─ demo-script.md
├─ .env.example
├─ brand.md
└─ README.md
```

### Technology lock

- Current stable Next.js App Router + TypeScript
- Tailwind CSS and shadcn/ui using semantic theme tokens
- React Hook Form + Zod for editable facts and clarification inputs
- IndexedDB for the current browser-local case and audio blob; no server-side case database
- Server-only provider adapters and secrets
- Python 3.11 benchmark runner with a locked environment
- `jiwer` or an equivalently pinned library for WER/CER
- `faster-whisper` with a pinned model revision for Whisper large-v3 on local or reproducible GPU notebook/cloud compute
- Print/PDF renderer consuming the validated report schema

Browser-local case data receives a 24-hour expiry and an explicit **Clear this report** control. Audio is streamed through the server to the transcription provider and is not persisted by the application backend. The privacy page must disclose that audio/transcript content is processed by Intron and that transcript content is sent to the configured extraction provider.

## 9. Security, privacy, and safety

- Secrets are server-only environment variables and never bundled into client code.
- Validate file signature, size, duration, and decoded audio before provider calls.
- Apply shared, serverless-compatible rate limits to transcription and extraction routes to protect challenge credits.
- Never log raw audio, transcript text, clarification answers, report content, or API credentials.
- Use request IDs and structured operational metadata only: route, provider, duration, latency, status, and sanitized error code.
- Add timeouts, bounded retries, and clear capacity/quota states.
- Treat provider output as untrusted; validate every response against local schemas.
- Require exact evidence-span validation for extracted facts.
- Preserve **Not provided** and **Ambiguous** states through report generation.
- Do not claim that a recommended channel will accept, resolve, or act on a report.
- Display urgent-safety wording as general information, not emergency dispatch or legal advice.
- Do not collect account credentials, government IDs, or contact details in version 1.
- Public benchmark artifacts exclude keys, private consent records, unapproved audio, and identifying metadata.

## 10. Test and acceptance gates

### Product gate

- A reporter can record or upload a valid Pidgin–English or Yoruba–English clip.
- Sahara returns a transcript or a recoverable, human-readable error.
- The extractor returns only schema-valid, evidence-backed facts.
- A missing critical location produces “Where exactly did this happen?” rather than a guessed location.
- At most three field-specific questions appear; skip is always available.
- Transcript and facts can be corrected without losing the audio.
- Unsupported incidents still produce a report but no invented resource recommendation.
- Verification is required before copy/PDF export.
- Clearing a case removes its browser-local audio and record.

### Benchmark gate

- Protocol tag and SHA-256 exist before provider inference.
- All three ASR adapters run the same normalized audio bytes.
- Exactly 36 frozen AfriSwitch clips and 24 initial custom clips are accounted for, including failures.
- Raw/normalized WER and CER, switch-window WER, latency, retries, and failures are reproducible.
- RIS weights and scorer tests match this document.
- Human-oracle and all three provider extractions use one pinned prompt/model/schema.
- Benchmark Lab values are generated from artifacts, not hardcoded UI copy.
- Aggregate values link back to safe per-clip evidence.

### Quality gate

- Unit tests cover schema validation, evidence-span enforcement, gap priority, question limits, resource matching, normalization, RIS, and oracle delta.
- Contract tests use recorded, sanitized provider fixtures.
- End-to-end tests cover upload → clarification → correction → verification → export using fixture audio.
- Keyboard navigation, focus return, screen-reader status, reduced motion, AA contrast, and 375/768/1280 layouts pass review.
- Every asynchronous component includes idle, loading, success, empty/partial, and recoverable error states.

## 11. Build sequence after approval

1. **Foundation:** scaffold, schemas, theme tokens, app shell, local case store, fixtures, and test harness.
2. **Audio path:** recorder/upload, validation, Sahara adapter, polling fallback, and transcript states.
3. **Understanding:** pinned extraction schema/prompt, evidence validation, category rules, and fact editing.
4. **Clarification:** deterministic gap engine, allowlisted questions, typed/voice answers, and three-question cap.
5. **Action:** report templates, verification, narrow resource datasets, copy/PDF export, and privacy disclosures.
6. **Benchmark runner:** freeze protocol, select manifests, implement three adapters, preprocessing, metrics, RIS, and oracle.
7. **Benchmark Lab:** artifact ingestion, exact tables, transcript diff, critical-field matrix, oracle view, and methodology.
8. **Submission hardening:** accessibility, responsive QA, failure-path rehearsal, documentation, responsible-AI note, and demo script.

## 12. Decisions frozen by approval

Approval of this blueprint freezes the following:

- Three product surfaces and three supported scenario families
- Pidgin–English and Yoruba–English prototype scope
- 24 initial custom clips and a 36-clip deterministic AfriSwitch subset
- Sahara, GPT-4o Transcribe, and Whisper large-v3
- The RIS formula and field weights in this document
- The human-transcript oracle design
- Deterministic, maximum-three-question clarification behavior
- Static, narrow, source-backed resource routing
- No automatic submission, legal advice, accounts, server-side case history, or live public benchmark execution

Whisper large-v3 remains the frozen third ASR model. Benchmark execution may occur on local hardware or a reproducible GPU notebook/cloud environment. Compute location does not constitute a protocol change provided the pinned model revision, decoding settings, preprocessing, dependency versions, and input audio hashes remain identical. Replacing Whisper with another model still requires explicit approval and a new protocol version before results are generated.

## 13. Authoritative implementation references

- [Sahara CodeSwitch Africa Challenge](https://www.intron.io/compete/)
- [Intron synchronous file transcription](https://docs.voice.intron.io/docs/stt/file-upload-sync)
- [Intron transcription status](https://docs.voice.intron.io/docs/stt/file-status)
- [Intron supported and code-switched language codes](https://docs.voice.intron.io/docs/stt/supported-languages)
- [AfriSwitch dataset card](https://huggingface.co/datasets/intronhealth/AfriSwitch)
- [Intron Multimodal Benchmarking repository](https://github.com/intron-innovation/Intron-Multimodal-Benchmarking)
- [OpenAI Audio Transcriptions API](https://platform.openai.com/docs/api-reference/audio/createTranscription)
