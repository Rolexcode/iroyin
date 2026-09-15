# Ìròyìn

**Speak naturally. Leave a record you trust.**

Ìròyìn is a voice-first public-service reporting assistant for Nigerian code-switched speech. A person can speak in Pidgin–English or Yorùbá–English, review Sahara by Intron's transcript, and then explain, express, or structure the account into a report they can correct, verify, export, and route through an official channel.

- Live app: https://iroyin.vercel.app
- Track: Legal & Public Services
- Benchmark pilot: [docs/pilot-benchmark-2026-09-15.md](docs/pilot-benchmark-2026-09-15.md)
- Responsible AI: [docs/responsible-ai.md](docs/responsible-ai.md)
- Submission pack and demo script: [docs/submission-2026-09-15.html](docs/submission-2026-09-15.html)

## Why it exists

Public complaints often begin as speech, not a polished form. People who naturally code-switch may have to translate themselves, choose formal language, and remember exact details before a system will accept their account. That adds friction precisely when the event is stressful or high-stakes.

Ìròyìn uses Sahara where it is especially valuable: at the first mile, where the speaker's natural code-switched voice becomes the source record. The transcript stays visible and editable; the product then preserves evidence, asks for missing critical facts, and keeps submission under the reporter's control.

## What works

- Record up to two minutes or upload an audio file.
- Transcribe Pidgin–English (`pcm`) and Yorùbá–English (`yo`) with Sahara.
- Preserve the original Sahara transcript and show any user correction separately.
- Explain difficult speech in simple English, Pidgin–English, or Yorùbá–English.
- Express the same thought in clear, academic, or professional English.
- Build an incident record with deterministic, evidence-linked extraction.
- Block verification while critical details are missing.
- Let the reporter correct facts, verify the record, copy it, or export a PDF.
- Show matched official channels without submitting anything automatically.
- Store report cases only in the current browser and expire them after 24 hours.

## Architecture

```text
voice or audio file
  -> Next.js server route
  -> Sahara speech-to-text
  -> user transcript check
  -> Explain / Express (Groq with local fallback)
     or Report (deterministic local extraction)
  -> clarification + correction + verification
  -> PDF/text export + official-channel guidance
```

The web application is Next.js 16 with React 19 and TypeScript. `INTRON_API_KEY` and `GROQ_API_KEY` are used only by server routes. Report cases and audio blobs are stored in IndexedDB rather than a server-side case database.

## Run locally

Requirements: Node.js 20+, pnpm 10, and a Sahara API key.

```powershell
git clone https://github.com/Rolexcode/iroyin.git
cd iroyin
Copy-Item .env.example .env.local
pnpm install
pnpm dev
```

Set the required values in `.env.local`:

```dotenv
INTRON_API_KEY=your_sahara_key
GROQ_API_KEY=your_groq_key
DEEPGRAM_API_KEY=your_deepgram_key
```

`INTRON_API_KEY` is required for live transcription. `GROQ_API_KEY` enables the hosted Explain/Express layer; those modes retain a limited local fallback. `DEEPGRAM_API_KEY` is used only by the benchmark runner.

Quality checks:

```powershell
pnpm lint
pnpm build
pnpm exec vitest run
```

## Benchmark status

The repository freezes a 60-clip comparison protocol: Sahara, Groq-hosted Whisper large-v3, and Deepgram Nova-3 across 36 AfriSwitch clips plus 24 consented acted incident clips. The runner, scoring, aggregation, annotation gates, audio hashes, and v1.1 provenance checks are implemented under `benchmark/`.

The full benchmark has **not** been run. Downloading the gated AfriSwitch shards repeatedly stalled at the upstream CDN, and no full-corpus result is claimed. To provide reproducible evidence without inventing results, we ran an explicitly limited one-clip pilot through all three providers. On that clip, Sahara had the lowest normalized WER, normalized CER, and switch-window WER. See the [pilot report](docs/pilot-benchmark-2026-09-15.md) for settings, hashes, transcripts, metrics, and limitations.

Python benchmark setup:

```powershell
cd benchmark
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
python -m pytest -q
```

The complete benchmark remains gated until the selected audio, human reference-slot annotations, consent/license fields, and hashes all validate.

## Responsible use

Ìròyìn does not provide legal advice, decide whether an allegation is true, or submit complaints on a person's behalf. AI transcription can be wrong. The interface preserves the source transcript, requires human review for high-stakes reports, marks the evidence behind extracted facts, and blocks verification when required details are missing.

See [docs/responsible-ai.md](docs/responsible-ai.md) for the full data, safety, and limitation statement.

## Repository map

```text
src/app/                 Next.js pages and server routes
src/components/          capture, transcript, and review interfaces
src/lib/                 Sahara client, extraction, verification, storage
benchmark/               frozen protocol, providers, runner, scoring, tests
schemas/                 incident and benchmark schemas
docs/                    product, benchmark, safety, and submission evidence
```

## Current limitations

- The product currently supports two code-switched language pairs.
- The report extractor is deterministic and intentionally conservative; it is not a general fact-understanding model.
- Cases exist only in the browser where they were created.
- Official-channel suggestions are informational and must be checked by the reporter.
- The full 60-clip benchmark is still pending; the published pilot is `n=1` and cannot establish general model superiority.
