from __future__ import annotations

import subprocess
from pathlib import Path

from .manifest import sha256_file


def normalize_audio(source: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite normalized audio: {destination}")
    subprocess.run(
        [
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(source),
            "-map_metadata", "-1", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(destination),
        ],
        check=True,
    )
    return sha256_file(destination)
