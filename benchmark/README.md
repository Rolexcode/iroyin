# Ìròyìn benchmark runner

This package preserves frozen protocol `iroyin-benchmark-v1.0` and its pre-inference audit trail. On 5 September 2026, protocol amendment `v1.1` was recorded in `config/protocol.v1.1-amendment.json` to remove paid OpenAI dependencies before benchmark inference. The corpus selection, audio preprocessing and scoring methodology remain unchanged.

The v1.1 comparison set is:

- Sahara by Intron — sponsor / primary product ASR.
- Whisper large-v3 — comparison ASR, using Groq free-plan access for the zero-cost run.
- Deepgram Nova-3 — comparison ASR, using available promotional credit.

The original `protocol.v1.json` is intentionally not rewritten. It remains the frozen historical record.

## Reproducible environment

Use Python 3.11. Every benchmark result must retain provider/model settings, compute location, git revision and audio hashes.

```powershell
cd C:\Users\WINDOWS\OneDrive\Desktop\iroyin\benchmark
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

FFmpeg must be available on `PATH` for provider-neutral PCM conversion.

## Required inputs

1. Generate the deterministic AfriSwitch selection plan using the frozen v1.0 rules.
2. Record and annotate the 24 acted clips described in `custom-clip-design.md`.
3. Place the private manifest under `manifests/private/` and source audio under the ignored `audio/` directory.
4. Validate all protocol gates before scoring or publishing.

AfriSwitch contributes 36 clips: 18 Pidgin-English and 18 Yoruba-English. The custom set contributes 24 clips: 12 Pidgin-English and 12 Yoruba-English. The complete benchmark therefore remains 60 clips.

## Remote credentials

- `INTRON_API_KEY` — Sahara ASR.
- `GROQ_API_KEY` — Groq-hosted Whisper large-v3 and the common downstream semantic layer.
- `DEEPGRAM_API_KEY` — Deepgram Nova-3 ASR.

No OpenAI API key is required by the v1.1 benchmark plan.

Never put keys in a manifest, result artifact, notebook output, client-side bundle or command-line argument.

## Fairness rule

Every audio clip must be sent to all three ASR providers without provider-specific transcript correction. The same human reference is used for WER/CER and switch-window scoring. Any downstream meaning/report evaluation must use the exact same Groq model, prompt, schema and settings for transcripts from all three providers. Provider identity must not be supplied to the downstream model.

Failures remain failures; they are not silently excluded from aggregate reporting.

## Run sequence

The provider adapters are being migrated to the v1.1 set. Do not run the final AfriSwitch benchmark until all three adapters, the v1.1 runner wiring and provenance checks are complete. Custom clips may be used for integration testing beforehand.

Final sequence:

```text
validate corpus + hashes
→ Sahara transcription
→ Whisper large-v3 transcription
→ Deepgram Nova-3 transcription
→ WER/CER + switch-window + critical-entity scoring
→ provider-blind downstream evaluation through Groq
→ aggregate + publish
```

Run directories and raw provider outputs should remain immutable once inference begins. The final report must disclose the v1.1 amendment and the reason for replacing the original paid OpenAI dependencies.
