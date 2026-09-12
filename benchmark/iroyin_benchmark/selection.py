from __future__ import annotations

import argparse
import hashlib
import random
import re
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Iterable

from .audio import normalize_audio
from .manifest import sha256_file, write_jsonl

SEED = 260903
DATASET = "intronhealth/AfriSwitch"
CONFIGS = {"pidgin": "pcm", "yoruba": "yo"}
REQUIRED_FIELDS = {
    "clipId", "source", "sourceConfig", "scenario", "languagePair", "noiseCondition",
    "speakerIdPseudonym", "durationSeconds", "cmi", "switchPointCount",
    "sourceAudioSha256", "normalizedAudioSha256", "referenceTranscript",
    "switchTokenIndices", "referenceSlots", "consentOrLicenseBasis",
    "sourceAudioPath", "normalizedAudioPath",
}


def clip_id(config: str, filename: str) -> str:
    digest = hashlib.sha256(filename.encode("utf-8")).hexdigest()[:16]
    return f"afriswitch-{CONFIGS[config]}-{digest}"


def _eligible(row: dict) -> bool:
    return 3 <= float(row["duration"]) <= 30 and int(row["num_switch_points"]) >= 1


def _cmi_buckets(rows: list[dict]) -> dict[str, str]:
    ordered = sorted(rows, key=lambda row: (float(row["cmi"]), row["clipId"]))
    labels = ("low-tertile", "middle-tertile", "high-tertile")
    return {row["clipId"]: labels[min(2, index * 3 // len(ordered))] for index, row in enumerate(ordered)}


def select_rows(rows: Iterable[dict], *, config: str, seed: int = SEED) -> list[dict]:
    if config not in CONFIGS:
        raise ValueError(f"Unsupported AfriSwitch config: {config}")
    eligible = []
    for row in rows:
        if not _eligible(row):
            continue
        item = dict(row)
        item["clipId"] = clip_id(config, str(item["filename"]))
        item["sourceConfig"] = CONFIGS[config]
        eligible.append(item)
    if len(eligible) < 18:
        raise ValueError(f"{config}: only {len(eligible)} eligible clips; need at least 18")

    duration_median = median(float(row["duration"]) for row in eligible)
    cmi_bucket = _cmi_buckets(eligible)
    strata: dict[tuple[str, str], list[dict]] = {}
    for row in eligible:
        duration_bucket = "short-at-or-below-config-median" if float(row["duration"]) <= duration_median else "long-above-config-median"
        strata.setdefault((cmi_bucket[row["clipId"]], duration_bucket), []).append(row)

    selected: list[dict] = []
    expected_strata = [(cmi, duration) for cmi in ("low-tertile", "middle-tertile", "high-tertile") for duration in ("short-at-or-below-config-median", "long-above-config-median")]
    for stratum_index, stratum in enumerate(expected_strata):
        candidates = sorted(strata.get(stratum, []), key=lambda row: row["clipId"])
        random.Random(seed + stratum_index).shuffle(candidates)
        if len(candidates) < 3:
            raise ValueError(f"{config}: stratum {stratum[0]}/{stratum[1]} has {len(candidates)} clips; need 3")
        for row in candidates[:3]:
            selected.append({**row, "cmiBucket": stratum[0], "durationBucket": stratum[1]})
    return sorted(selected, key=lambda row: row["clipId"])


def _tagged_switch_indices(tagged: str) -> list[int]:
    tokens = [part for part in re.split(r"(\[\[EN\]\]|\[\[/EN\]\])", tagged) if part]
    language = "local"
    indices: list[int] = []
    word_index = -1
    for token in tokens:
        if token == "[[EN]]":
            if language != "english":
                indices.append(word_index + 1)
            language = "english"
        elif token == "[[/EN]]":
            if language == "english":
                indices.append(word_index + 1)
            language = "local"
        else:
            word_index += len(token.split())
    return indices


def _audio_bytes(audio: dict) -> bytes:
    if audio.get("bytes") is not None:
        return bytes(audio["bytes"])
    path = audio.get("path")
    if path:
        return Path(path).read_bytes()
    raise ValueError("AfriSwitch audio item contains neither bytes nor path")


def build_manifest_rows(selected: Iterable[dict], repository_root: Path) -> list[dict]:
    rows: list[dict] = []
    for row in selected:
        clip = row["clipId"]
        source_path = repository_root / "benchmark" / "audio" / "afriswitch" / f"{clip}.wav"
        normalized_path = repository_root / "benchmark" / "audio" / "afriswitch" / "normalized" / f"{clip}.wav"
        source_path.parent.mkdir(parents=True, exist_ok=True)
        if not source_path.exists():
            source_path.write_bytes(_audio_bytes(row["audio"]))
        if not normalized_path.exists():
            normalize_audio(source_path, normalized_path)
        transcript = str(row["transcription"])
        rows.append({
            "clipId": clip,
            "source": "afriswitch",
            "sourceConfig": row["sourceConfig"],
            "scenario": "afriswitch-code-switch",
            "languagePair": f"{row['sourceConfig']}_en",
            "noiseCondition": "dataset-default",
            "speakerIdPseudonym": f"afriswitch-{row['sourceConfig']}-{hashlib.sha256(str(row['filename']).encode()).hexdigest()[:12]}",
            "durationSeconds": float(row["duration"]),
            "cmi": float(row["cmi"]),
            "switchPointCount": int(row["num_switch_points"]),
            "sourceAudioSha256": sha256_file(source_path),
            "normalizedAudioSha256": sha256_file(normalized_path),
            "referenceTranscript": transcript,
            "switchTokenIndices": _tagged_switch_indices(str(row.get("transcription_tagged", transcript))),
            "referenceSlots": [{"slot": "transcript", "value": transcript}],
            "consentOrLicenseBasis": "license:CC BY-NC-SA-4.0; dataset:intronhealth/AfriSwitch",
            "sourceAudioPath": source_path.relative_to(repository_root).as_posix(),
            "normalizedAudioPath": normalized_path.relative_to(repository_root).as_posix(),
            "selection": {"seed": SEED, "cmiBucket": row["cmiBucket"], "durationBucket": row["durationBucket"]},
        })
    return rows


def validate_afriswitch_manifest(path: Path, repository_root: Path) -> list[str]:
    from .manifest import read_jsonl

    if not path.exists():
        return [f"Manifest not found: {path}"]
    clips = read_jsonl(path)
    errors: list[str] = []
    if len(clips) != 36:
        errors.append(f"Expected 36 AfriSwitch clips, found {len(clips)}")
    if len({clip.get("clipId") for clip in clips}) != len(clips):
        errors.append("clipId values must be unique")
    if Counter(clip.get("sourceConfig") for clip in clips) != Counter({"pcm": 18, "yo": 18}):
        errors.append("Expected sourceConfig counts pcm=18/yo=18")
    strata = Counter((clip.get("sourceConfig"), clip.get("selection", {}).get("cmiBucket"), clip.get("selection", {}).get("durationBucket")) for clip in clips)
    if any(count != 3 for count in strata.values()) or len(strata) != 12:
        errors.append(f"Expected 3 clips in each of 12 strata, found {dict(strata)}")
    for clip in clips:
        missing = sorted(REQUIRED_FIELDS - clip.keys())
        if missing:
            errors.append(f"{clip.get('clipId', '<missing>')}: missing fields {', '.join(missing)}")
            continue
        if clip["source"] != "afriswitch" or float(clip["durationSeconds"]) < 3 or float(clip["durationSeconds"]) > 30 or int(clip["switchPointCount"]) < 1:
            errors.append(f"{clip['clipId']}: eligibility fields are invalid")
        if not clip["referenceTranscript"] or not clip["referenceSlots"] or len(clip["switchTokenIndices"]) < 1:
            errors.append(f"{clip['clipId']}: annotations are incomplete")
        if not str(clip["consentOrLicenseBasis"]).startswith("license:"):
            errors.append(f"{clip['clipId']}: license basis is missing")
        for field in ("sourceAudioPath", "normalizedAudioPath"):
            asset = (repository_root / clip[field]).resolve()
            if not asset.is_file():
                errors.append(f"{clip['clipId']}: audio missing: {asset}")
            elif sha256_file(asset) != str(clip[field.replace("Path", "Sha256")]).lower():
                errors.append(f"{clip['clipId']}: {field} SHA-256 mismatch")
    return errors


def generate(dataset: str, repository_root: Path, output: Path) -> None:
    from datasets import Audio, load_dataset

    selected: list[dict] = []
    for config in CONFIGS:
        dataset_rows = load_dataset(dataset, config, split="test", streaming=True).cast_column("audio", Audio(decode=False))
        selected.extend(select_rows(dataset_rows, config=config))
    rows = build_manifest_rows(selected, repository_root)
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite private manifest: {output}")
    write_jsonl(output, rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and validate the private AfriSwitch manifest")
    subparsers = parser.add_subparsers(dest="command", required=True)
    generate_parser = subparsers.add_parser("generate")
    generate_parser.add_argument("--dataset", default=DATASET)
    generate_parser.add_argument("--repository-root", type=Path, default=Path.cwd().parent)
    generate_parser.add_argument("--output", type=Path, default=Path("manifests/private/manifest.v1.jsonl"))
    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("--repository-root", type=Path, default=Path.cwd().parent)
    validate_parser.add_argument("--manifest", type=Path, default=Path("manifests/private/manifest.v1.jsonl"))
    args = parser.parse_args()
    if args.command == "generate":
        output = args.output if args.output.is_absolute() else args.repository_root / args.output
        generate(args.dataset, args.repository_root.resolve(), output.resolve())
    else:
        manifest = args.manifest if args.manifest.is_absolute() else args.repository_root / args.manifest
        errors = validate_afriswitch_manifest(manifest.resolve(), args.repository_root.resolve())
        if errors:
            raise SystemExit("\n".join(errors))
        print("AfriSwitch manifest validation passed")


if __name__ == "__main__":
    main()