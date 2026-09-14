from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .manifest import read_jsonl, validate_manifest
from .provenance import environment_receipt


Provider = Callable[..., dict]


def _providers() -> dict[str, Provider]:
    from .providers import deepgram, sahara, whisper

    return {
        "sahara": sahara.transcribe,
        "whisper-large-v3-groq": whisper.transcribe,
        "deepgram-nova-3": deepgram.transcribe,
    }


def _invoke(name: str, fn: Provider, clip: dict, audio_path: Path) -> dict:
    if name == "sahara":
        key = os.environ.get("INTRON_API_KEY")
        if not key:
            raise RuntimeError("INTRON_API_KEY is required for Sahara")
        return fn(audio_path, str(clip["languagePair"]), key)
    return fn(audio_path)


def run_benchmark(manifest_path: Path, repository_root: Path, output_dir: Path) -> Path:
    """Run every frozen clip through every v1.1 provider.

    Failed provider calls are recorded as failures, never dropped. Existing run
    directories are rejected so raw outputs remain immutable.
    """
    validation = validate_manifest(manifest_path, repository_root, require_normalized=True)
    if not validation.ok:
        raise ValueError("Manifest validation failed:\n" + "\n".join(validation.errors))
    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError(f"Refusing to overwrite existing run directory: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    providers = _providers()
    for provider in providers:
        (output_dir / provider).mkdir()
    metadata = {
        "protocolId": "iroyin-benchmark-v1.1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "manifest": str(manifest_path.resolve()),
        "providers": list(providers),
        "receipts": {
            name: environment_receipt(repository_root, "local", name) for name in providers
        },
    }
    (output_dir / "run.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    for clip in sorted(read_jsonl(manifest_path), key=lambda row: row["clipId"]):
        audio_path = (repository_root / clip["normalizedAudioPath"]).resolve()
        for name, fn in providers.items():
            payload: dict
            try:
                payload = _invoke(name, fn, clip, audio_path)
                record = {"clipId": clip["clipId"], "provider": name, "failed": False, **payload}
            except Exception as error:  # noqa: BLE001 - failures are benchmark data
                record = {
                    "clipId": clip["clipId"],
                    "provider": name,
                    "failed": True,
                    "error": f"{type(error).__name__}: {error}",
                }
            target = output_dir / name / f"{clip['clipId']}.json"
            target.write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output_dir
