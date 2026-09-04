from __future__ import annotations

import importlib.metadata
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import PROTOCOL_ID


TRACKED_PACKAGES = ["datasets", "faster-whisper", "huggingface-hub", "jiwer", "openai", "pydantic", "requests", "soundfile"]


def _git(repository_root: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repository_root), *args], check=True, capture_output=True, text=True)
    return result.stdout.strip()


def environment_receipt(repository_root: Path, compute_location: str, provider: str) -> dict:
    packages: dict[str, str] = {}
    for name in TRACKED_PACKAGES:
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = "not-installed"
    return {
        "protocolId": PROTOCOL_ID,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "provider": provider,
        "computeLocation": compute_location,
        "gitCommit": _git(repository_root, "rev-parse", "HEAD"),
        "protocolTagCommit": _git(repository_root, "rev-list", "-n", "1", "benchmark-protocol-v1.0"),
        "gitDirty": bool(_git(repository_root, "status", "--porcelain")),
        "python": sys.version,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "packages": packages,
    }


def write_new_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
