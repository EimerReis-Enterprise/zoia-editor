import zipfile
from pathlib import Path

from service.parser_adapter import parse_patch
from service.patch_compiler import (
    CompileImportedPatchRequest,
    CompilePatchDraftRequest,
    DraftConnection,
    DraftModule,
    ModuleColorEdit,
    ParameterEdit,
    compile_imported_patch,
    compile_patch_document,
    compile_patch_draft,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ARCHIVE = (
    ROOT
    / ".vendor"
    / "zoia_lib"
    / "zoia_lib"
    / "tests"
    / "sample_files"
    / "sampleZIPBytes.bin"
)


def _complex_patch() -> tuple[str, bytes]:
    with zipfile.ZipFile(FIXTURE_ARCHIVE) as archive:
        filename = next(name for name in archive.namelist() if name.endswith(".bin"))
        return Path(filename).name, archive.read(filename)


def test_unchanged_imported_patch_compiles_with_equivalent_semantics():
    filename, source = _complex_patch()

    result = compile_imported_patch(
        source,
        CompileImportedPatchRequest(
            draft_revision=1,
            source_filename=filename,
            parameter_edits=(),
        ),
    )

    assert result.binary is not None
    assert len(result.binary) == 32_768
    assert result.draft_revision == 1
    assert result.findings == ()
    assert result.conformance.unchanged_fields_preserved is True


def test_parameter_edit_changes_only_the_target_raw_value():
    filename, source = _complex_patch()
    before = parse_patch(source, filename)

    result = compile_imported_patch(
        source,
        CompileImportedPatchRequest(
            draft_revision=2,
            source_filename=filename,
            parameter_edits=(
                ParameterEdit(module_id=0, parameter_name="value", raw_value=20_000),
            ),
        ),
    )

    assert result.binary is not None
    after = parse_patch(result.binary, result.output_filename)
    before_values = {
        (module["hardware"]["moduleIndex"], parameter["name"]): parameter["rawValue"]
        for module in before["modules"]
        for parameter in module["parameters"]
    }
    after_values = {
        (module["hardware"]["moduleIndex"], parameter["name"]): parameter["rawValue"]
        for module in after["modules"]
        for parameter in module["parameters"]
    }

    changed_values = {
        key: value
        for key, value in after_values.items()
        if value != before_values[key]
    }
    assert changed_values == {(0, "Value"): 20_000}
    assert result.conformance.changed_parameter_count == 1
    assert result.findings == ()


def test_module_color_edit_survives_binary_roundtrip():
    filename, source = _complex_patch()

    result = compile_imported_patch(
        source,
        CompileImportedPatchRequest(
            draft_revision=3,
            source_filename=filename,
            parameter_edits=(),
            color_edits=(ModuleColorEdit(module_id=0, color_id=13),),
        ),
    )

    assert result.binary is not None
    reparsed = parse_patch(result.binary, result.output_filename)
    assert reparsed["modules"][0]["hardware"]["headerColorId"] == 13


def test_unchanged_patch_document_exports_exact_source_bytes():
    filename, source = _complex_patch()
    document = parse_patch(source, filename)

    result = compile_patch_document(document, draft_revision=9)

    assert result.binary == source
    assert result.conformance.unchanged_fields_preserved is True
    assert result.conformance.changed_parameter_count == 0


def test_edited_patch_document_compiles_parameter_change_from_json():
    filename, source = _complex_patch()
    document = parse_patch(source, filename)
    parameter = next(
        parameter
        for parameter in document["modules"][0]["parameters"]
        if parameter["key"] == "value"
    )
    parameter["rawValue"] = 20_000

    result = compile_patch_document(document, draft_revision=10)

    assert result.binary is not None
    assert result.binary != source
    reparsed = parse_patch(result.binary, result.output_filename)
    reparsed_parameter = next(
        parameter
        for parameter in reparsed["modules"][0]["parameters"]
        if parameter["key"] == "value"
    )
    assert reparsed_parameter["rawValue"] == 20_000


def test_authored_patch_document_compiles_endpoint_aware_audio_and_cv_graph():
    registry = {
        item["id"]: item
        for item in __import__("json").loads(
            (ROOT / "shared" / "module-configurations.v1.json").read_text()
        )["configurations"]
    }

    def module(module_id, configuration_id):
        configuration = registry[configuration_id]
        return {
            "id": module_id,
            "configurationId": configuration_id,
            "name": configuration["name"],
            "type": configuration["type"],
            "category": configuration["category"],
            "parameters": [
                {
                    "id": f"parameter-{index}",
                    "key": parameter["key"],
                    "kind": "parameter",
                    "name": parameter["name"],
                    "rawValue": parameter["defaultRawValue"],
                    "displayValue": "default",
                    "decoded": True,
                }
                for index, parameter in enumerate(configuration["parameters"])
            ],
            "endpoints": configuration["endpoints"],
            "hardware": None,
        }

    modules = [
        module("input", "audio-input-mono"),
        module("clock", "midi-clock-in"),
        module("divider", "clock-divider"),
        module("looper", "looper-8s-once"),
        module("output", "audio-output-mono"),
    ]
    connections = [
        ("input", "output_L", "looper", "audio_in", "audio"),
        ("looper", "audio_out", "output", "input_L", "audio"),
        ("clock", "quarter_out", "divider", "cv_input", "cv"),
        ("divider", "cv_output", "looper", "record", "cv"),
    ]
    document = {
        "format": "zoia-patch",
        "schemaVersion": 1,
        "documentId": "endpoint-test",
        "name": "Graph Test",
        "authoringMode": "free",
        "modules": modules,
        "connections": [
            {
                "id": f"connection-{index}",
                "sourceModuleId": source,
                "sourceEndpointId": source_endpoint,
                "targetModuleId": target,
                "targetEndpointId": target_endpoint,
                "sourceEndpoint": source_endpoint,
                "targetEndpoint": target_endpoint,
                "kind": kind,
                "strengthRaw": 10_000,
            }
            for index, (source, source_endpoint, target, target_endpoint, kind) in enumerate(connections)
        ],
        "pages": [],
        "starred": [],
        "colors": [],
        "source": None,
        "opaque": {},
        "sequences": {"nextModule": 0, "nextConnection": 4},
        "extensions": {},
    }

    result = compile_patch_document(document, draft_revision=12)

    assert result.binary is not None
    reparsed = parse_patch(result.binary, result.output_filename)
    assert len(reparsed["modules"]) == 5
    assert len(reparsed["connections"]) == 4


def test_nts4_performance_patch_document_compiles():
    document = __import__("json").loads(
        (ROOT / "patches" / "nts4-performance-rig.zoia.json").read_text()
    )

    result = compile_patch_document(document, draft_revision=13)

    assert len(document["modules"]) == 23
    assert len(document["connections"]) == 38
    sidechain = next(module for module in document["modules"] if module["id"] == "sidechain-vca")
    level = next(parameter for parameter in sidechain["parameters"] if parameter["key"] == "level_control")
    assert level["rawValue"] == 65_535
    assert result.binary is not None
    assert len(result.binary) == 32_768
    assert [finding.code for finding in result.findings] == ["hardware_unverified"]
    reparsed = parse_patch(result.binary, result.output_filename)
    macro_pages = {
        module["name"]: module["hardware"]["page"]
        for module in reparsed["modules"]
        if module["name"] in {"Wash Return VCA", "Wash Intensity", "Loop Rec"}
    }
    assert macro_pages == {
        "Wash Return VCA": 2,
        "Wash Intensity": 2,
        "Loop Rec": 2,
    }


def test_mono_patch_draft_compiles_and_reparses_as_a_signal_chain():
    result = compile_patch_draft(
        CompilePatchDraftRequest(
            draft_revision=3,
            name="First Patch",
            modules=(
                DraftModule("input", "audio-input-mono", "Input", {}),
                DraftModule("gain", "vca", "Gain", {"level_control": 32_768}),
                DraftModule("output", "audio-output-mono", "Output", {}),
            ),
            connections=(
                DraftConnection("input-gain", "input", "gain"),
                DraftConnection("gain-output", "gain", "output"),
            ),
        )
    )

    assert result.binary is not None
    assert len(result.binary) == 32_768
    assert result.conformance.unchanged_fields_preserved is True
    assert result.conformance.changed_parameter_count == 1
    assert [finding.code for finding in result.findings] == ["hardware_unverified"]

    parsed = parse_patch(result.binary, result.output_filename)
    assert parsed["name"] == "First Patch"
    assert [module["type"] for module in parsed["modules"]] == [
        "Audio Input",
        "VCA",
        "Audio Output",
    ]
    assert [
        (connection["sourceModuleId"], connection["targetModuleId"])
        for connection in parsed["connections"]
    ] == [
        ("module-0", "module-1"),
        ("module-1", "module-2"),
    ]


def test_patch_draft_rejects_a_broken_signal_chain():
    result = compile_patch_draft(
        CompilePatchDraftRequest(
            draft_revision=4,
            name="Broken",
            modules=(
                DraftModule("input", "audio-input-mono", "Input", {}),
                DraftModule("output", "audio-output-mono", "Output", {}),
            ),
            connections=(),
        )
    )

    assert result.binary is None
    assert "non_linear_signal_chain" in {
        finding.code for finding in result.findings
    }


def test_all_curated_modules_compile_in_one_mono_chain():
    module_specs = (
        ("input", "audio-input-mono", {}),
        ("vca", "vca", {"level_control": 0}),
        ("filter", "filter", {"frequency": 0, "resonance": 0}),
        ("compressor", "compressor", {"threshold": 32_768}),
        ("distortion", "distortion", {"input_gain": 16_384, "output_gain": 49_151}),
        ("delay", "delay", {"delay_time": 0}),
        ("reverb", "reverb", {"decay_time": 32_768, "mix": 32_768}),
        ("mixer", "mixer", {"gain_1": 54_394, "gain_2": 54_394}),
        ("output", "audio-output-mono", {}),
    )
    modules = tuple(
        DraftModule(module_id, catalog_id, module_id.title(), parameters)
        for module_id, catalog_id, parameters in module_specs
    )
    connections = tuple(
        DraftConnection(f"connection-{index}", source.id, target.id)
        for index, (source, target) in enumerate(zip(modules, modules[1:]))
    )

    result = compile_patch_draft(
        CompilePatchDraftRequest(6, "Full Chain", modules, connections)
    )

    assert result.binary is not None
    parsed = parse_patch(result.binary, result.output_filename)
    assert len(parsed["modules"]) == len(module_specs)
    assert len(parsed["connections"]) == len(module_specs) - 1
