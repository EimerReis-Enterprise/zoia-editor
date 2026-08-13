import zipfile
from pathlib import Path

import pytest

from service.parser_adapter import (
    InvalidPatchError,
    _display_parameter_value,
    _parameter_projection,
    parse_patch,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / ".vendor" / "zoia_lib" / "zoia_lib" / "tests" / "sample_files" / "input_test.bin"
FIXTURE_ARCHIVE = (
    ROOT
    / ".vendor"
    / "zoia_lib"
    / "zoia_lib"
    / "tests"
    / "sample_files"
    / "sampleZIPBytes.bin"
)


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


def test_decodes_parameters_with_known_zoia_lib_metadata():
    with zipfile.ZipFile(FIXTURE_ARCHIVE) as archive:
        archived_name = next(name for name in archive.namelist() if name.endswith(".bin"))
        document = parse_patch(archive.read(archived_name), Path(archived_name).name)

    parameter = document["modules"][0]["parameters"][0]
    assert parameter == {
        "id": "parameter-0",
        "key": "value",
        "kind": "parameter",
        "name": "Value",
        "displayValue": "0.3",
        "rawValue": 16_930,
        "decoded": True,
        "defaultRawValue": 0,
        "unit": None,
        "range": [0.0, 1.0],
    }


def test_matches_zoia_lib_nonlinear_parameter_display_curve():
    assert (
        _display_parameter_value(
            1_096,
            "Hz",
            [27.5, 155.56, 880.0, 4_978.0, 23_999.0],
            0,
        )
        == "29.2 Hz"
    )
    assert (
        _display_parameter_value(
            54_394,
            "dB",
            [-100.0, -70.0, -40.0, -10.0, 20.0],
            54_394,
        )
        == "0.0 dB"
    )


def test_preserves_raw_fallback_when_zoia_lib_has_no_parameter_metadata():
    parameters = _parameter_projection(
        {
            "mod_idx": 70,
            "parameters": {"tap_tempo_in": 0.5},
            "parameters_raw": [32_768],
        }
    )

    assert parameters == [
        {
            "id": "parameter-0",
            "key": "tap_tempo_in",
            "kind": "parameter",
            "name": "Tap Tempo In",
            "displayValue": "50% normalized",
            "rawValue": 32_768,
            "decoded": False,
        }
    ]


def test_rejects_non_binary_extension():
    with pytest.raises(InvalidPatchError, match=".bin extension"):
        parse_patch(b"not a patch", "notes.txt")
