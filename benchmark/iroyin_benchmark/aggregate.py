from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from .manifest import read_jsonl
from .scoring import cer, switch_window_wer, wer


def aggregate_run(manifest_path: Path, run_dir: Path, output: Path | None = None) -> dict:
    manifest = {row["clipId"]: row for row in read_jsonl(manifest_path)}
    by_provider: dict[str, list[dict]] = defaultdict(list)
    for provider_dir in sorted(path for path in run_dir.iterdir() if path.is_dir()):
        for result_path in sorted(provider_dir.glob("*.json")):
            by_provider[provider_dir.name].append(json.loads(result_path.read_text(encoding="utf-8")))

    providers: dict[str, dict] = {}
    for provider, records in by_provider.items():
        per_clip = []
        for record in records:
            clip = manifest.get(record.get("clipId"))
            if clip is None:
                continue
            failed = bool(record.get("failed"))
            transcript = "" if failed else str(record.get("transcript", ""))
            try:
                switch_score = switch_window_wer(
                    clip["referenceTranscript"], transcript, clip["switchTokenIndices"]
                )
            except (ValueError, KeyError, TypeError):
                switch_score = 1.0
            per_clip.append({
                "clipId": clip["clipId"],
                "failed": failed,
                "werRaw": wer(clip["referenceTranscript"], transcript, normalized=False),
                "werNormalized": wer(clip["referenceTranscript"], transcript),
                "cerRaw": cer(clip["referenceTranscript"], transcript, normalized=False),
                "cerNormalized": cer(clip["referenceTranscript"], transcript),
                "switchWindowWer": switch_score,
            })
        count = len(per_clip)
        providers[provider] = {
            "clipCount": count,
            "failureCount": sum(item["failed"] for item in per_clip),
            "metrics": {
                metric: (sum(item[metric] for item in per_clip) / count if count else 0.0)
                for metric in ("werRaw", "werNormalized", "cerRaw", "cerNormalized", "switchWindowWer")
            },
            "clips": per_clip,
        }
    report = {"protocolId": "iroyin-benchmark-v1.1", "providers": providers}
    if output is not None:
        if output.exists():
            raise FileExistsError(f"Refusing to overwrite aggregate report: {output}")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report
