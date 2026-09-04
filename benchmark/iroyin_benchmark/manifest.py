from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ValidationResult:
    clips: list[dict]
    errors: list[str]

    @property
    def ok(self) -> bool:
        return not self.errors


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_jsonl(path: Path) -> list[dict]:
    items: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSON: {error}") from error
            if not isinstance(item, dict):
                raise ValueError(f"{path}:{line_number}: expected an object")
            items.append(item)
    return items


def write_jsonl(path: Path, items: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        for item in items:
            handle.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")


def validate_manifest(path: Path, repository_root: Path, *, require_normalized: bool) -> ValidationResult:
    if not path.exists():
        return ValidationResult([], [f"Manifest not found: {path}"])
    try:
        clips = read_jsonl(path)
    except ValueError as error:
        return ValidationResult([], [str(error)])
    errors: list[str] = []
    if len(clips) != 60:
        errors.append(f"Expected 60 clips, found {len(clips)}")
    ids = [str(clip.get("clipId", "")) for clip in clips]
    if len(set(ids)) != len(ids) or any(not clip_id for clip_id in ids):
        errors.append("clipId values must be non-empty and unique")
    source_counts = Counter(clip.get("source") for clip in clips)
    if source_counts != Counter({"afriswitch": 36, "custom": 24}):
        errors.append(f"Expected source counts afriswitch=36/custom=24, found {dict(source_counts)}")
    afri = [clip for clip in clips if clip.get("source") == "afriswitch"]
    afri_config = Counter(clip.get("sourceConfig") for clip in afri)
    if afri_config != Counter({"pcm": 18, "yo": 18}):
        errors.append(f"Expected AfriSwitch pcm=18/yo=18, found {dict(afri_config)}")
    custom = [clip for clip in clips if clip.get("source") == "custom"]
    scenarios = Counter(clip.get("scenario") for clip in custom)
    expected_scenarios = {"tenancy_housing": 8, "infrastructure_hazard": 8, "workplace_public_service": 8}
    if scenarios != Counter(expected_scenarios):
        errors.append(f"Custom scenario totals are invalid: {dict(scenarios)}")
    pairs = Counter(clip.get("languagePair") for clip in custom)
    if pairs != Counter({"pcm_en": 12, "yo_en": 12}):
        errors.append(f"Custom language-pair totals are invalid: {dict(pairs)}")
    noise = Counter(clip.get("noiseCondition") for clip in custom)
    if noise != Counter({"quiet": 12, "everyday_noise": 12}):
        errors.append(f"Custom noise totals are invalid: {dict(noise)}")
    speakers = {clip.get("speakerIdPseudonym") for clip in custom if clip.get("speakerIdPseudonym")}
    if len(speakers) < 4:
        errors.append(f"Custom corpus requires at least 4 distinct speakers, found {len(speakers)}")

    required = {
        "clipId", "source", "sourceConfig", "scenario", "languagePair", "noiseCondition",
        "speakerIdPseudonym", "durationSeconds", "cmi", "switchPointCount", "sourceAudioSha256",
        "referenceTranscript", "switchTokenIndices", "referenceSlots", "consentOrLicenseBasis", "sourceAudioPath",
    }
    if require_normalized:
        required |= {"normalizedAudioSha256", "normalizedAudioPath"}
    for clip in clips:
        clip_id = clip.get("clipId", "<missing>")
        missing = sorted(field for field in required if field not in clip)
        if missing:
            errors.append(f"{clip_id}: missing fields {', '.join(missing)}")
            continue
        if not clip.get("referenceTranscript"):
            errors.append(f"{clip_id}: referenceTranscript is empty")
        if not clip.get("referenceSlots"):
            errors.append(f"{clip_id}: referenceSlots is empty")
        if clip.get("source") == "custom" and not str(clip.get("consentOrLicenseBasis", "")).startswith("consent:"):
            errors.append(f"{clip_id}: custom consent basis must start with 'consent:'")
        source_path = (repository_root / str(clip.get("sourceAudioPath", ""))).resolve()
        if not source_path.is_file():
            errors.append(f"{clip_id}: source audio missing: {source_path}")
        elif sha256_file(source_path) != str(clip.get("sourceAudioSha256", "")).lower():
            errors.append(f"{clip_id}: source audio SHA-256 mismatch")
        if require_normalized:
            normalized_path = (repository_root / str(clip.get("normalizedAudioPath", ""))).resolve()
            if not normalized_path.is_file():
                errors.append(f"{clip_id}: normalized audio missing: {normalized_path}")
            elif sha256_file(normalized_path) != str(clip.get("normalizedAudioSha256", "")).lower():
                errors.append(f"{clip_id}: normalized audio SHA-256 mismatch")
    return ValidationResult(clips, errors)
