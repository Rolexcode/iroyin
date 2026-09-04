from __future__ import annotations

import json
import time
from pathlib import Path

from faster_whisper import WhisperModel

from .. import WHISPER_REVISION


def verify_model_receipt(model_dir: Path) -> None:
    receipt_path = model_dir / "iroyin-model-revision.json"
    if not receipt_path.is_file():
        raise RuntimeError(f"Whisper model receipt missing: {receipt_path}")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if receipt.get("sourceRevision") != WHISPER_REVISION:
        raise RuntimeError("Whisper directory does not match the frozen source revision")
    if receipt.get("computeType") != "float32":
        raise RuntimeError("Whisper directory must use frozen float32 compute type")


def transcribe(audio_path: Path, model_dir: Path) -> dict:
    verify_model_receipt(model_dir)
    model = WhisperModel(str(model_dir), device="auto", compute_type="float32")
    started = time.perf_counter()
    segments, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        temperature=0,
        condition_on_previous_text=False,
        vad_filter=False,
        language=None,
    )
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    return {
        "transcript": transcript,
        "latencySeconds": time.perf_counter() - started,
        "detectedLanguage": info.language,
        "settings": {
            "modelRevision": WHISPER_REVISION,
            "beamSize": 5,
            "temperature": 0,
            "conditionOnPreviousText": False,
            "vadFilter": False,
            "language": None,
            "computeType": "float32",
        },
    }
