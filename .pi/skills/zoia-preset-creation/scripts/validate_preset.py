#!/usr/bin/env python3
"""Compile one authored ZOIA Patch Document and report validation findings."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

from service.patch_compiler import compile_patch_document  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("preset", type=Path, help="Path to an authored .zoia.json preset")
    parser.add_argument("--output", type=Path, help="Write the compiled .bin to this path")
    args = parser.parse_args()

    preset_path = args.preset.resolve()
    try:
        document = json.loads(preset_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Unable to read Patch Document: {error}", file=sys.stderr)
        return 2

    if document.get("authoringMode") != "free" or document.get("source") is not None:
        print("Only new authored Free Routing Patch Documents can be validated by this skill.", file=sys.stderr)
        return 2

    result = compile_patch_document(document, draft_revision=1)
    for finding in result.findings:
        print(f"{finding.severity.upper()} [{finding.code}] {finding.message}")

    if result.binary is None:
        if not result.findings:
            print("ERROR [compile_failed] The compiler returned no binary.")
        return 1

    if args.output:
        output_path = args.output.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(result.binary)
        print(f"Compiled binary: {output_path}")

    warning_count = sum(finding.severity == "warning" for finding in result.findings)
    print(f"Valid Patch Document ({warning_count} warning{'s' if warning_count != 1 else ''}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
