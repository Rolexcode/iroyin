from pathlib import Path

import json

from iroyin_benchmark.manifest import sha256_file
from iroyin_benchmark.selection import select_rows, validate_afriswitch_manifest


def _rows():
    rows = []
    for index in range(36):
        rows.append({
            "filename": f"clip-{index}.wav",
            "duration": 3.0 + index % 10,
            "cmi": index / 36,
            "num_switch_points": 1,
            "transcription": "local [[EN]]hello[[/EN]]",
        })
    return rows


def test_selection_is_deterministic_and_balanced():
    first = select_rows(_rows(), config="pidgin")
    second = select_rows(list(reversed(_rows())), config="pidgin")
    assert [row["clipId"] for row in first] == [row["clipId"] for row in second]
    assert {(row["cmiBucket"], row["durationBucket"]) for row in first} == {
        (cmi, duration)
        for cmi in ("low-tertile", "middle-tertile", "high-tertile")
        for duration in ("short-at-or-below-config-median", "long-above-config-median")
    }
    assert all(sum(row["cmiBucket"] == cmi and row["durationBucket"] == duration for row in first) == 3 for cmi in ("low-tertile", "middle-tertile", "high-tertile") for duration in ("short-at-or-below-config-median", "long-above-config-median"))


def test_validation_rejects_missing_private_manifest(tmp_path: Path):
    errors = validate_afriswitch_manifest(tmp_path / "missing.jsonl", tmp_path)
    assert errors == [f"Manifest not found: {tmp_path / 'missing.jsonl'}"]


def test_validation_checks_required_fields_and_audio_hashes(tmp_path: Path):
    source = tmp_path / "source.wav"
    normalized = tmp_path / "normalized.wav"
    source.write_bytes(b"source")
    normalized.write_bytes(b"normalized")
    rows = []
    for config in ("pcm", "yo"):
        for stratum in range(6):
            for item in range(3):
                clip = f"{config}-{stratum}-{item}"
                rows.append({
                    "clipId": clip,
                    "source": "afriswitch",
                    "sourceConfig": config,
                    "scenario": "afriswitch-code-switch",
                    "languagePair": f"{config}_en",
                    "noiseCondition": "dataset-default",
                    "speakerIdPseudonym": f"speaker-{clip}",
                    "durationSeconds": 5,
                    "cmi": 1,
                    "switchPointCount": 1,
                    "sourceAudioSha256": sha256_file(source),
                    "normalizedAudioSha256": sha256_file(normalized),
                    "referenceTranscript": "local hello",
                    "switchTokenIndices": [1],
                    "referenceSlots": [{"slot": "transcript", "value": "local hello"}],
                    "consentOrLicenseBasis": "license:CC BY-NC-SA-4.0",
                    "sourceAudioPath": "source.wav",
                    "normalizedAudioPath": "normalized.wav",
                    "selection": {
                        "seed": 260903,
                        "cmiBucket": ("low-tertile", "middle-tertile", "high-tertile")[stratum // 2],
                        "durationBucket": ("short-at-or-below-config-median", "long-above-config-median")[stratum % 2],
                    },
                })
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    assert validate_afriswitch_manifest(manifest, tmp_path) == []
    normalized.write_bytes(b"tampered")
    assert any("normalizedAudioPath SHA-256 mismatch" in error for error in validate_afriswitch_manifest(manifest, tmp_path))