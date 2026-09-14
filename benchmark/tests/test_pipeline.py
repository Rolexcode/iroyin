import json
from pathlib import Path

import pytest

from iroyin_benchmark.aggregate import aggregate_run
from iroyin_benchmark.annotations import apply_annotations, write_annotation_template


def _clip(tmp_path: Path) -> dict:
    audio = tmp_path / "clip.wav"
    audio.write_bytes(b"audio")
    from iroyin_benchmark.manifest import sha256_file

    digest = sha256_file(audio)
    return {
        "clipId": "clip-1",
        "source": "afriswitch",
        "sourceConfig": "pcm",
        "languagePair": "pcm_en",
        "referenceTranscript": "local hello",
        "switchTokenIndices": [1],
        "referenceSlots": [{"category": "event_or_action", "value": "hello"}],
        "consentOrLicenseBasis": "license:CC BY-NC-SA-4.0",
        "sourceAudioPath": "clip.wav",
        "sourceAudioSha256": digest,
        "normalizedAudioPath": "clip.wav",
        "normalizedAudioSha256": digest,
    }


def test_annotation_template_requires_real_slots(tmp_path: Path):
    clip = _clip(tmp_path)
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text(json.dumps(clip) + "\n", encoding="utf-8")
    template = tmp_path / "annotations.jsonl"
    write_annotation_template(manifest, template)
    data = json.loads(template.read_text(encoding="utf-8"))
    assert data["referenceSlots"] == []
    with pytest.raises(ValueError, match="at least one"):
        apply_annotations(manifest, template, tmp_path / "annotated.jsonl")


def test_aggregate_retains_provider_failures(tmp_path: Path):
    clip = _clip(tmp_path)
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text(json.dumps(clip) + "\n", encoding="utf-8")
    run = tmp_path / "run" / "sahara"
    run.mkdir(parents=True)
    (run / "clip-1.json").write_text(json.dumps({"clipId": "clip-1", "failed": True}), encoding="utf-8")
    report = aggregate_run(manifest, run.parent)
    assert report["providers"]["sahara"]["failureCount"] == 1
    assert report["providers"]["sahara"]["metrics"]["werNormalized"] == 1.0
