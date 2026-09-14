from __future__ import annotations

import json
from pathlib import Path

from .manifest import read_jsonl, write_jsonl

RIS_CATEGORIES = {
    "event_or_action", "negation", "amount_quantity_or_count", "actor_or_affected_person",
    "incident_type", "location", "time_date_or_duration", "urgency_or_risk",
    "other_context_or_evidence",
}


def write_annotation_template(manifest_path: Path, output: Path) -> None:
    """Create a private, human-editable annotation sidecar without fake labels."""
    rows = []
    for clip in read_jsonl(manifest_path):
        rows.append({
            "clipId": clip["clipId"],
            "referenceSlots": [],
            "consentOrLicenseBasis": clip.get("consentOrLicenseBasis", ""),
            "annotatorNotes": "Listen to the normalized clip and add weighted RIS slots.",
        })
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite annotation template: {output}")
    write_jsonl(output, rows)


def apply_annotations(manifest_path: Path, annotations_path: Path, output: Path) -> None:
    manifest = read_jsonl(manifest_path)
    annotations = {row.get("clipId"): row for row in read_jsonl(annotations_path)}
    if set(annotations) != {row.get("clipId") for row in manifest}:
        raise ValueError("Annotation sidecar must contain exactly one row for every manifest clip")
    merged = []
    for clip in manifest:
        annotation = annotations[clip["clipId"]]
        slots = annotation.get("referenceSlots")
        if not isinstance(slots, list) or not slots:
            raise ValueError(f"{clip['clipId']}: at least one reference slot is required")
        for slot in slots:
            if not isinstance(slot, dict) or slot.get("category") not in RIS_CATEGORIES or not str(slot.get("value", "")).strip():
                raise ValueError(f"{clip['clipId']}: invalid reference slot; use category and non-empty value")
        basis = str(annotation.get("consentOrLicenseBasis", clip.get("consentOrLicenseBasis", "")))
        if clip.get("source") == "custom" and not basis.startswith("consent:"):
            raise ValueError(f"{clip['clipId']}: custom clips require consent: basis")
        if clip.get("source") == "afriswitch" and not basis.startswith("license:"):
            raise ValueError(f"{clip['clipId']}: AfriSwitch clips require license: basis")
        merged.append({**clip, "referenceSlots": slots, "consentOrLicenseBasis": basis})
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite annotated manifest: {output}")
    write_jsonl(output, merged)
