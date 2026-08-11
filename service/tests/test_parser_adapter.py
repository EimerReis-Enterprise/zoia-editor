from pathlib import Path

import pytest

from service.parser_adapter import InvalidPatchError, parse_patch

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / ".vendor" / "zoia_lib" / "zoia_lib" / "tests" / "sample_files" / "input_test.bin"


def test_parses_reference_fixture_into_lossless_patch_document():
    source = FIXTURE.read_bytes()
    document = parse_patch(source, FIXTURE.name)

    assert document["format"] == "zoia-patch"
    assert document["schemaVersion"] == 1
    assert document["name"] == "UserPatch"
    assert len(document["modules"]) == 2
    assert document["modules"][0]["type"] == "Audio Input"
    assert document["modules"][0]["hardware"]["moduleIndex"] == 0
    assert document["source"]["filename"] == FIXTURE.name
    assert document["source"]["binaryBase64"]
    assert document["opaque"]["codecPatch"]


def test_rejects_non_binary_extension():
    with pytest.raises(InvalidPatchError, match=".bin extension"):
        parse_patch(b"not a patch", "notes.txt")
