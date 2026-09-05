from __future__ import annotations

import os
import time
from pathlib import Path

import requests

DEEPGRAM_ENDPOINT = "https://api.deepgram.com/v1/listen"
DEEPGRAM_MODEL = "nova-3"


def transcribe(audio_path: Path) -> dict:
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPGRAM_API_KEY is required for the Deepgram benchmark provider")

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/wav",
    }
    params = {
        "model": DEEPGRAM_MODEL,
        "smart_format": "false",
        "punctuate": "true",
        "diarize": "false",
    }

    started = time.perf_counter()
    with audio_path.open("rb") as audio_file:
        response = requests.post(
            DEEPGRAM_ENDPOINT,
            headers=headers,
            params=params,
            data=audio_file,
            timeout=120,
        )
    latency = time.perf_counter() - started
    response.raise_for_status()
    payload = response.json()

    try:
        alternative = payload["results"]["channels"][0]["alternatives"][0]
        transcript = alternative.get("transcript", "").strip()
        confidence = alternative.get("confidence")
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Deepgram returned an unexpected transcription response") from exc

    return {
        "transcript": transcript,
        "latencySeconds": latency,
        "confidence": confidence,
        "settings": {
            "provider": "deepgram",
            "model": DEEPGRAM_MODEL,
            "smartFormat": False,
            "punctuate": True,
            "diarize": False,
            "languageHint": None,
        },
    }
