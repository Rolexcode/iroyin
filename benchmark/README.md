# Ìròyìn benchmark runner

This package implements frozen protocol `iroyin-benchmark-v1.0`. It does not contain benchmark results and does not run inference during installation.

## Reproducible environment

Use Python 3.11. The lock-worthy package versions are exact in `pyproject.toml`; every run also writes the resolved platform, Python, dependency, model, compute-location, git, and audio-hash metadata.

```powershell
cd C:\Users\WINDOWS\OneDrive\Desktop\iroyin\benchmark
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

FFmpeg must be available on `PATH` for the one-time, provider-neutral PCM conversion.

## Required inputs

1. Generate the deterministic AfriSwitch selection plan with `iroyin-benchmark select-afriswitch`.
2. Record and annotate the 24 acted incidents described in `custom-clip-design.md`.
3. Place the private manifest at `manifests/private/manifest.v1.jsonl` and source audio under the ignored `audio/` directory.
4. Run `iroyin-benchmark validate` until all protocol gates pass.

## Whisper compute

Run `iroyin-benchmark prepare-whisper --output <directory>` once. This downloads exactly Hugging Face revision `06f233fe06e710322aca913c1bc4249a0d71fce1`, converts it to CTranslate2, and writes a revision receipt. The resulting directory can be used locally or copied to a reproducible Colab, Kaggle, or cloud GPU environment.

Compute location is supplied as run metadata:

```powershell
iroyin-benchmark run --provider whisper-large-v3 --compute-location colab --whisper-model-dir D:\models\iroyin-whisper-v3
```

The runner refuses Whisper directories whose receipt does not match the frozen revision.

## Remote credentials

- `INTRON_API_KEY` for Sahara.
- `OPENAI_API_KEY` for GPT-4o Transcribe and the frozen downstream extractor.

Never put keys in a manifest, notebook, result artifact, or command-line argument.

## Run sequence

```powershell
iroyin-benchmark validate
iroyin-benchmark normalize
iroyin-benchmark run --provider sahara --compute-location remote-api
iroyin-benchmark run --provider gpt4o-transcribe --compute-location remote-api
iroyin-benchmark run --provider whisper-large-v3 --compute-location cloud-gpu --whisper-model-dir D:\models\iroyin-whisper-v3
iroyin-benchmark score
iroyin-benchmark publish
```

Run directories are immutable. `publish` succeeds only when all 60 clips have terminal outputs for every provider and every protocol/audio hash verifies. It writes the aggregate artifact consumed by the web app; it never edits UI source values.
