# Benchmark manifests

No benchmark inference has been run. `selection-plan.v1.json` freezes the deterministic sampling and annotation contract before any provider output exists.

The generated private manifest belongs at `benchmark/manifests/private/manifest.v1.jsonl` and is intentionally ignored because it can reference licensed audio and speaker metadata. A redacted public manifest may be generated after validation. The runner must refuse inference unless all expected counts, annotations, consent/license fields, and audio hashes pass validation.
