from __future__ import annotations

import time
from pathlib import Path

import requests

SYNC_URL = "https://infer.voice.intron.io/file/v1/upload/sync"
STATUS_URL = "https://infer.voice.intron.io/file/v1/status"


def transcribe(audio_path: Path, language_pair: str, api_key: str) -> dict:
    started = time.perf_counter()
    language = "yo" if language_pair == "yo_en" else "pcm"

    with audio_path.open("rb") as audio:
        response = requests.post(
            SYNC_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            data={
                "audio_file_name": audio_path.name,
                "use_language_asr_input": language,
            },
            files={"audio_file_blob": (audio_path.name, audio, "audio/wav")},
            timeout=125,
        )

    payload = response.json()
    data = payload.get("data", {})

    if response.status_code not in {200, 503}:
        response.raise_for_status()

    file_id = data.get("file_id")
    pending = {"FILE_QUEUED", "FILE_PENDING", "FILE_PROCESSING"}

    if file_id and data.get("processing_status") in pending:
        for _ in range(60):
            time.sleep(2)
            status = requests.get(
                f"{STATUS_URL}/{file_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=20,
            )
            status.raise_for_status()
            payload = status.json()
            data = payload.get("data", {})

            if data.get("processing_status") not in pending:
                break

    if data.get("processing_status") != "FILE_TRANSCRIBED" or not data.get("audio_transcript"):
        raise RuntimeError(
            payload.get("message")
            or f"Sahara terminal status: {data.get('processing_status')}"
        )

    return {
        "transcript": data["audio_transcript"],
        "latencySeconds": time.perf_counter() - started,
        "providerFileId": data.get("file_id"),
        "providerStatus": data.get("processing_status"),
        "settings": {"language": language, "corrections": True},
    }