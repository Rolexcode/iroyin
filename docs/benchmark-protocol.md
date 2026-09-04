# Ìròyìn Benchmark Protocol v1.0

Status: **frozen before inference**  
Protocol ID: `iroyin-benchmark-v1.0`  
Freeze date: 2026-09-03

This document is the human-readable companion to `benchmark/config/protocol.v1.json`. If they differ, the JSON configuration controls. Any change that can affect benchmark values requires a new protocol version and fresh result directory; old and new results must never be pooled.

## Research question

How much report-critical meaning survives when the same Nigerian code-switched incident audio is transcribed by Sahara, GPT-4o Transcribe, or Whisper large-v3 and then passed through one frozen extraction pipeline?

The benchmark separates recognition failure from extraction failure by scoring both provider transcripts and a human-transcript oracle through the same extractor.

## Corpus

- 36 official AfriSwitch clips: 18 Pidgin-English and 18 Yoruba-English.
- 24 custom acted incident clips: eight each for tenancy/housing, public infrastructure hazards, and workplace/public-service complaints.
- Every ASR provider receives byte-identical normalized audio for a clip.
- Custom clips must have speaker consent, clean verbatim annotation, evidence-slot annotation, and no real complainant personal data.

AfriSwitch selection is deterministic. Eligible clips have duration from 3 through 30 seconds and at least one switch point. Within each language, clips are split into CMI tertiles and short/long duration at the eligible-set median; three clips are sampled from each of the six strata using seed `260903`. Duplicates are prohibited.

## Audio normalization

Before provider calls, audio is converted once to mono, 16 kHz, signed 16-bit PCM WAV. There is no denoising, silence trimming, loudness normalization, or provider-specific preprocessing. The runner records the source and normalized SHA-256 hashes.

## Frozen ASR systems

1. Sahara via Intron Voice API, with `pcm` for Pidgin-English and `yo` for Yoruba-English and corrections enabled.
2. OpenAI `gpt-4o-transcribe`, temperature `0`, JSON response.
3. Whisper large-v3 via `faster-whisper==1.2.1`, model revision `06f233fe06e710322aca913c1bc4249a0d71fce1`, beam size `5`, temperature `0`, condition-on-previous-text disabled, VAD disabled.

Whisper large-v3 may run on local hardware or in a reproducible GPU notebook/cloud environment. Compute location is metadata, not a protocol change, only when the pinned model revision, decoding settings, preprocessing, dependency versions, and input audio hashes remain identical. Replacing Whisper with another model requires explicit approval and a new protocol version.

## Frozen extraction

Every provider transcript and human oracle transcript is sent independently through the same extraction contract and model configuration. No provider name is exposed to the extractor. A fact is scorable only when it includes an exact transcript evidence span. Missing facts remain `missing`; unsupported inferences score as hallucinations.

## Metrics

- Raw and normalized WER and CER.
- Switch-window WER over ±3 reference tokens around each annotated language switch.
- Critical-entity precision, recall, and F1.
- Report Integrity Score (RIS), using the frozen slot weights and deterministic rules in `report-integrity-weights.v1.json`.
- End-to-end and provider latency plus failure rate.
- Oracle RIS and ASR integrity loss: `oracle_ris - provider_ris`, without clamping.

Macro averages are reported over clips. Missing or failed outputs remain visible and are never silently dropped.

## Execution and provenance

Each run writes an immutable directory containing the protocol ID, git commit, environment manifest, compute location, dependency versions, model revisions, provider request settings, audio hashes, raw transcripts, normalized transcripts, extracted JSON, per-clip metrics, aggregate metrics, and error records. The public UI reads generated aggregate artifacts only; no result value may be hard-coded into the interface.

Secrets, source recordings, and provider response payloads containing sensitive material are never committed. Public artifacts use acted or officially licensed benchmark material and redacted identifiers.
