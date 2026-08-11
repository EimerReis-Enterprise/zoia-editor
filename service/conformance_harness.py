from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

from service.patch_compiler import (
    CompileImportedPatchRequest,
    ParameterEdit,
    compile_imported_patch,
)

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ARCHIVE = (
    ROOT
    / ".vendor"
    / "zoia_lib"
    / "zoia_lib"
    / "tests"
    / "sample_files"
    / "sampleZIPBytes.bin"
)
ZOIA_LIB_REVISION = "9a959c4ef2ecbaa82f6525761472058bbead7d66"


def _fixture() -> tuple[str, bytes]:
    with zipfile.ZipFile(FIXTURE_ARCHIVE) as archive:
        archived_name = next(name for name in archive.namelist() if name.endswith(".bin"))
        return Path(archived_name).name, archive.read(archived_name)


def _artifact(binary: bytes, path: Path, *, operation: str) -> dict:
    path.write_bytes(binary)
    return {
        "file": path.name,
        "operation": operation,
        "bytes": len(binary),
        "sha256": hashlib.sha256(binary).hexdigest(),
        "hardwareStatus": "pending",
    }


def run(output_directory: Path) -> Path:
    output_directory.mkdir(parents=True, exist_ok=True)
    filename, source = _fixture()

    unchanged = compile_imported_patch(
        source,
        CompileImportedPatchRequest(
            draft_revision=1,
            source_filename=filename,
            parameter_edits=(),
        ),
    )
    edited = compile_imported_patch(
        source,
        CompileImportedPatchRequest(
            draft_revision=2,
            source_filename=filename,
            parameter_edits=(
                ParameterEdit(module_id=0, parameter_name="value", raw_value=20_000),
            ),
        ),
    )

    for result in (unchanged, edited):
        if result.binary is None or result.findings:
            messages = "; ".join(finding.message for finding in result.findings)
            raise RuntimeError(f"Conformance compilation failed: {messages}")

    artifacts = [
        _artifact(
            unchanged.binary,
            output_directory / "roundtrip-unchanged.bin",
            operation="parse and encode without edits",
        ),
        _artifact(
            edited.binary,
            output_directory / "roundtrip-parameter-edit.bin",
            operation="set Module 0 parameter 'value' raw value from 16930 to 20000",
        ),
    ]
    report = {
        "zoiaLibRevision": ZOIA_LIB_REVISION,
        "sourceFixture": filename,
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "semanticConformance": "passed",
        "artifacts": artifacts,
    }
    report_path = output_directory / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate ZOIA compiler artifacts for hardware conformance testing."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "conformance-out",
        help="Directory for generated binaries and report.json.",
    )
    arguments = parser.parse_args()
    report_path = run(arguments.output)
    print(f"Conformance artifacts ready: {report_path}")


if __name__ == "__main__":
    main()
