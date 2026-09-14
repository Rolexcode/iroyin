from __future__ import annotations

import argparse
from pathlib import Path

from .aggregate import aggregate_run
from .annotations import apply_annotations, write_annotation_template
from .runner import run_benchmark
from .selection import generate, validate_afriswitch_manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Ìròyìn benchmark v1.1 tools")
    sub = parser.add_subparsers(dest="command", required=True)
    generate_parser = sub.add_parser("generate", help="generate the private AfriSwitch manifest")
    generate_parser.add_argument("--dataset", default="intronhealth/AfriSwitch")
    generate_parser.add_argument("--repository-root", type=Path, default=Path.cwd().parent)
    generate_parser.add_argument("--output", type=Path, default=Path("manifests/private/manifest.v1.jsonl"))
    validate_parser = sub.add_parser("validate", help="validate the AfriSwitch manifest")
    validate_parser.add_argument("--repository-root", type=Path, default=Path.cwd().parent)
    validate_parser.add_argument("--manifest", type=Path, default=Path("manifests/private/manifest.v1.jsonl"))
    run_parser = sub.add_parser("run", help="run all providers over a validated 60-clip manifest")
    run_parser.add_argument("--repository-root", type=Path, required=True)
    run_parser.add_argument("--manifest", type=Path, required=True)
    run_parser.add_argument("--output-dir", type=Path, required=True)
    agg_parser = sub.add_parser("aggregate", help="aggregate a completed immutable run")
    agg_parser.add_argument("--manifest", type=Path, required=True)
    agg_parser.add_argument("--run-dir", type=Path, required=True)
    agg_parser.add_argument("--output", type=Path, required=True)
    template_parser = sub.add_parser("annotation-template", help="create a human annotation sidecar")
    template_parser.add_argument("--manifest", type=Path, required=True)
    template_parser.add_argument("--output", type=Path, required=True)
    apply_parser = sub.add_parser("apply-annotations", help="merge validated human annotations")
    apply_parser.add_argument("--manifest", type=Path, required=True)
    apply_parser.add_argument("--annotations", type=Path, required=True)
    apply_parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "generate":
        target = args.output if args.output.is_absolute() else args.repository_root / args.output
        generate(args.dataset, args.repository_root.resolve(), target.resolve())
    elif args.command == "validate":
        target = args.manifest if args.manifest.is_absolute() else args.repository_root / args.manifest
        errors = validate_afriswitch_manifest(target.resolve(), args.repository_root.resolve())
        if errors:
            raise SystemExit("\n".join(errors))
        print("AfriSwitch manifest validation passed")
    elif args.command == "run":
        run_benchmark(args.manifest.resolve(), args.repository_root.resolve(), args.output_dir.resolve())
        print(f"Run written to {args.output_dir.resolve()}")
    elif args.command == "aggregate":
        aggregate_run(args.manifest.resolve(), args.run_dir.resolve(), args.output.resolve())
        print(f"Aggregate written to {args.output.resolve()}")
    elif args.command == "annotation-template":
        write_annotation_template(args.manifest.resolve(), args.output.resolve())
        print(f"Annotation template written to {args.output.resolve()}")
    else:
        apply_annotations(args.manifest.resolve(), args.annotations.resolve(), args.output.resolve())
        print(f"Annotated manifest written to {args.output.resolve()}")


if __name__ == "__main__":
    main()
