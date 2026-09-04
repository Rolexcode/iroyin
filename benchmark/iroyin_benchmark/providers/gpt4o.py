from __future__ import annotations

import time
from pathlib import Path

from openai import OpenAI


def transcribe(audio_path: Path, api_key: str) -> dict:
    client = OpenAI(api_key=api_key)
    started = time.perf_counter()
    with audio_path.open("rb") as audio:
        response = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=audio,
            response_format="json",
            temperature=0,
        )
    return {
        "transcript": response.text,
        "latencySeconds": time.perf_counter() - started,
        "settings": {"model": "gpt-4o-transcribe", "temperature": 0, "responseFormat": "json", "languageHint": None, "prompt": None},
    }
