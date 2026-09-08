from __future__ import annotations

import os
import time
from pathlib import Path

import requests

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_WHISPER_MODEL = "whisper-large-v3"


def transcribe(audio_path: Path) -> dict:
    """Transcribe one frozen benchmark clip with Groq-hosted Whisper large-v3.

    No language hint or transcript prompt is supplied so the comparison model
    sees the same code-switched audio without provider-specific correction.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is required for the Groq Whisper benchmark provider")

    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": GROQ_WHISPER_MODEL,
        "response_format": "json",
        "temperature": "0",
    }

    started = time.perf_counter()
    with audio_path.open("rb") as audio_file:
        response = requests.post(
            GROQ_TRANSCRIPTIONS_URL,
            headers=headers,
            data=data,
            files={"file": (audio_path.name, audio_file, "audio/wav")},
            timeout=120,
        )
    latency = time.perf_counter() - started
    response.raise_for_status()
    payload = response.json()
    transcript = str(payload.get("text", "")).strip()
    if not transcript:
        raise RuntimeError("Groq Whisper returned an empty transcription")

    return {
        "transcript": transcript,
        "latencySeconds": latency,
        "settings": {
            "provider": "groq",
            "model": GROQ_WHISPER_MODEL,
            "responseFormat": "json",
            "temperature": 0,
            "languageHint": None,
            "prompt": None,
        },
    }
