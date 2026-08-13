from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from service.module_catalog import (
    CONFIGURATIONS,
    ModuleConfiguration,
    default_raw_value,
    module_definition,
    scaled_parameter_range,
    selected_options,
)

ROOT = Path(__file__).resolve().parents[1]
ZOIA_LIB_PATH = Path(os.environ.get("ZOIA_LIB_PATH", ROOT / ".vendor" / "zoia_lib"))


@dataclass(frozen=True)
class ParameterEdit:
    module_id: int
    parameter_name: str
    raw_value: int


@dataclass(frozen=True)
class ModuleColorEdit:
    module_id: int
    color_id: int


@dataclass(frozen=True)
class CompileImportedPatchRequest:
    draft_revision: int
    source_filename: str
    parameter_edits: tuple[ParameterEdit, ...]
    color_edits: tuple[ModuleColorEdit, ...] = ()


@dataclass(frozen=True)
class DraftModule:
    id: str
    catalog_id: str
    name: str
    raw_parameters: dict[str, int]


@dataclass(frozen=True)
class DraftConnection:
    id: str
    source_module_id: str
    target_module_id: str


@dataclass(frozen=True)
class CompilePatchDraftRequest:
    draft_revision: int
    name: str
    modules: tuple[DraftModule, ...]
    connections: tuple[DraftConnection, ...]


@dataclass(frozen=True)
class ValidationFinding:
    severity: Literal["warning", "error"]
    code: str
    message: str
    module_id: int | None = None
    parameter_name: str | None = None


@dataclass(frozen=True)
class ConformanceReport:
    unchanged_fields_preserved: bool
    changed_parameter_count: int


@dataclass(frozen=True)
class CompilationResult:
    draft_revision: int
    binary: bytes | None
    output_filename: str
    findings: tuple[ValidationFinding, ...]
    conformance: ConformanceReport


class CompilerUnavailableError(RuntimeError):
    pass


def _load_codec():
    if not ZOIA_LIB_PATH.exists():
        raise CompilerUnavailableError(
            "The reference compiler is not installed. Run `pnpm setup:parser`."
        )

    path = str(ZOIA_LIB_PATH)
    if path not in sys.path:
        sys.path.insert(0, path)

    previous_cwd = Path.cwd()
    try:
        os.chdir(ZOIA_LIB_PATH)
        from zoia_lib.backend.patch_binary import PatchBinary
        from zoia_lib.backend.patch_encode import PatchEncoder
    except (ImportError, FileNotFoundError) as error:
        raise CompilerUnavailableError(
            "The pinned zoia_lib compiler could not be loaded. Run `pnpm setup:parser`."
        ) from error
    finally:
        os.chdir(previous_cwd)

    return PatchBinary, PatchEncoder


def _with_zoia_cwd(operation):
    previous_cwd = Path.cwd()
    try:
        os.chdir(ZOIA_LIB_PATH)
        return operation()
    finally:
        os.chdir(previous_cwd)


def _semantic_patch(patch: dict[str, Any]) -> dict[str, Any]:
    module_keys = (
        "number",
        "mod_idx",
        "version",
        "page",
        "header_color_id",
        "size",
        "size_of_saveable_data",
        "params",
        "name",
    )
    connection_keys = (
        "source_raw",
        "source_block_raw",
        "dest_raw",
        "dest_block_raw",
        "strength_raw",
    )

    return {
        "name": patch["name"],
        "modules": [
            {
                **{key: module.get(key) for key in module_keys},
                "position": tuple(module.get("position", [])),
                "options_binary": dict(module.get("options_binary", {})),
                "parameters_raw": tuple(module.get("parameters_raw", [])),
                "saved_data": tuple(module.get("saved_data", [])),
            }
            for module in patch["modules"]
        ],
        "connections": [
            tuple(connection.get(key) for key in connection_keys)
            for connection in patch["connections"]
        ],
        "pages": tuple(patch.get("pages", [])),
        "starred": tuple(
            (item.get("module"), item.get("block"), item.get("midi_cc"))
            for item in patch.get("starred", [])
        ),
        "colors": tuple(patch.get("colors", [])),
    }


def _output_filename(source_filename: str) -> str:
    stem = Path(source_filename).stem
    if stem.startswith("zoia_"):
        stem = stem[5:]
    safe_stem = "".join(character for character in stem if character.isalnum() or character in "-_ ").strip()
    return f"zoia_{safe_stem or 'patch'}.bin"


def _apply_parameter_edits(
    patch: dict[str, Any],
    edits: tuple[ParameterEdit, ...],
) -> tuple[list[ValidationFinding], int]:
    findings: list[ValidationFinding] = []
    changed_parameters: set[tuple[int, str]] = set()
    modules = {module["number"]: module for module in patch["modules"]}

    for edit in edits:
        module = modules.get(edit.module_id)
        if module is None:
            findings.append(
                ValidationFinding(
                    severity="error",
                    code="unknown_module",
                    message=f"Module {edit.module_id} does not exist in the imported Patch.",
                    module_id=edit.module_id,
                )
            )
            continue
        if not 0 <= edit.raw_value <= 65_535:
            findings.append(
                ValidationFinding(
                    severity="error",
                    code="raw_parameter_value_out_of_range",
                    message="Raw Parameter Values must be between 0 and 65535.",
                    module_id=edit.module_id,
                    parameter_name=edit.parameter_name,
                )
            )
            continue

        parameter_names = list(module.get("parameters", {}))
        if edit.parameter_name not in parameter_names:
            findings.append(
                ValidationFinding(
                    severity="error",
                    code="unknown_parameter",
                    message=(
                        f"Module {edit.module_id} has no parameter named "
                        f"{edit.parameter_name!r}."
                    ),
                    module_id=edit.module_id,
                    parameter_name=edit.parameter_name,
                )
            )
            continue

        parameter_index = parameter_names.index(edit.parameter_name)
        module["parameters_raw"][parameter_index] = edit.raw_value
        module["parameters"][edit.parameter_name] = round(edit.raw_value / 65_535, 2)
        changed_parameters.add((edit.module_id, edit.parameter_name))

    return findings, len(changed_parameters)


_ZOIA_COLOR_NAMES = {
    1: "Blue",
    2: "Green",
    3: "Red",
    4: "Yellow",
    5: "Aqua",
    6: "Magenta",
    7: "White",
    8: "Orange",
    9: "Lima",
    10: "Surf",
    11: "Sky",
    12: "Purple",
    13: "Pink",
    14: "Peach",
    15: "Mango",
}


def _apply_module_color_edits(
    patch: dict[str, Any],
    edits: tuple[ModuleColorEdit, ...],
) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    modules = {int(module["number"]): module for module in patch["modules"]}
    colors = list(patch.get("colors", []))
    while len(colors) < len(patch["modules"]):
        colors.append(2)

    for edit in edits:
        module = modules.get(edit.module_id)
        if module is None:
            findings.append(ValidationFinding("error", "unknown_module", f"Module {edit.module_id} does not exist."))
            continue
        if edit.color_id not in _ZOIA_COLOR_NAMES:
            findings.append(ValidationFinding("error", "invalid_module_color", "ZOIA Module colors must be between 1 and 15.", edit.module_id))
            continue
        module["header_color_id"] = edit.color_id
        module["color"] = _ZOIA_COLOR_NAMES[edit.color_id]
        colors[edit.module_id] = edit.color_id

    patch["colors"] = colors
    return findings


def _document_module_color_id(document: dict[str, Any], module: dict[str, Any], index: int) -> int:
    hardware = module.get("hardware")
    color_id = hardware.get("headerColorId") if isinstance(hardware, dict) else None
    colors = document.get("colors", [])
    if not isinstance(color_id, int) and isinstance(colors, list) and index < len(colors):
        color_id = colors[index]
    return color_id if isinstance(color_id, int) and color_id in _ZOIA_COLOR_NAMES else 2


def _failed_document_compilation(
    draft_revision: int,
    source_filename: str,
    code: str,
    message: str,
) -> CompilationResult:
    return CompilationResult(
        draft_revision=draft_revision,
        binary=None,
        output_filename=_output_filename(source_filename),
        findings=(ValidationFinding("error", code, message),),
        conformance=ConformanceReport(False, 0),
    )


def _document_structure(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": document.get("name"),
        "modules": [
            {
                "id": module.get("id"),
                "configurationId": module.get("configurationId"),
                "name": module.get("name"),
                "type": module.get("type"),
                "category": module.get("category"),
                "options": [
                    (parameter.get("key"), parameter.get("rawValue"))
                    for parameter in module.get("parameters", [])
                    if parameter.get("kind") == "option"
                ],
                "endpoints": module.get("endpoints", []),
                "hardware": {
                    key: value
                    for key, value in (module.get("hardware") or {}).items()
                    if key != "headerColorId"
                } or None,
            }
            for module in document.get("modules", [])
        ],
        "connections": document.get("connections", []),
        "pages": document.get("pages", []),
        "starred": document.get("starred", []),
    }


def compile_patch_document(document: dict[str, Any], draft_revision: int) -> CompilationResult:
    source = document.get("source")
    if source is None:
        return compile_authored_patch_document(document, draft_revision)

    filename = str(source.get("filename") or "patch.bin")
    try:
        binary = base64.b64decode(source["binaryBase64"], validate=True)
    except (KeyError, TypeError, ValueError) as error:
        return _failed_document_compilation(
            draft_revision, filename, "invalid_source_binary", f"The embedded source binary is invalid: {error}"
        )
    if hashlib.sha256(binary).hexdigest() != source.get("sha256"):
        return _failed_document_compilation(
            draft_revision,
            filename,
            "source_checksum_mismatch",
            "The embedded source binary does not match its SHA-256 checksum.",
        )

    try:
        from service.parser_adapter import parse_patch

        original_document = parse_patch(binary, filename)
    except Exception as error:
        return _failed_document_compilation(
            draft_revision, filename, "source_decode_failed", f"The embedded source binary could not be decoded: {error}"
        )
    if _document_structure(document) != _document_structure(original_document):
        return _failed_document_compilation(
            draft_revision,
            filename,
            "unsupported_document_structure_change",
            "This codec can currently export only Parameter changes for an imported Patch Document.",
        )

    original_modules = {
        module["hardware"]["moduleIndex"]: module
        for module in original_document["modules"]
        if module.get("hardware")
    }
    edits: list[ParameterEdit] = []
    color_edits: list[ModuleColorEdit] = []
    for index, module in enumerate(document.get("modules", [])):
        hardware = module.get("hardware")
        if not hardware:
            continue
        module_id = int(hardware["moduleIndex"])
        original = original_modules.get(module_id)
        if original is None:
            continue
        color_id = _document_module_color_id(document, module, index)
        if color_id != int(original["hardware"].get("headerColorId") or 2):
            color_edits.append(ModuleColorEdit(module_id, color_id))
        original_parameters = {
            parameter["key"]: parameter.get("rawValue")
            for parameter in original.get("parameters", [])
            if parameter.get("kind") == "parameter"
        }
        for parameter in module.get("parameters", []):
            raw_value = parameter.get("rawValue")
            if (
                parameter.get("kind") == "parameter"
                and isinstance(raw_value, int)
                and raw_value != original_parameters.get(parameter.get("key"))
            ):
                edits.append(ParameterEdit(module_id, str(parameter["key"]), raw_value))

    if not edits and not color_edits:
        return CompilationResult(
            draft_revision=draft_revision,
            binary=binary,
            output_filename=_output_filename(filename),
            findings=(),
            conformance=ConformanceReport(True, 0),
        )
    return compile_imported_patch(
        binary,
        CompileImportedPatchRequest(draft_revision, filename, tuple(edits), tuple(color_edits)),
    )


def compile_imported_patch(
    source: bytes,
    request: CompileImportedPatchRequest,
) -> CompilationResult:
    PatchBinary, PatchEncoder = _load_codec()
    findings: list[ValidationFinding] = []
    changed_parameter_count = 0

    try:
        parsed = _with_zoia_cwd(lambda: PatchBinary().parse_data(source))
        edit_findings, changed_parameter_count = _apply_parameter_edits(
            parsed, request.parameter_edits
        )
        findings.extend(edit_findings)
        findings.extend(_apply_module_color_edits(parsed, request.color_edits))
        if findings:
            raise ValueError("Parameter Edits failed validation.")

        intended_semantics = _semantic_patch(parsed)
        encoded = bytes(_with_zoia_cwd(lambda: PatchEncoder().encode(parsed)))
        reparsed = _with_zoia_cwd(lambda: PatchBinary().parse_data(encoded))
        unchanged_fields_preserved = intended_semantics == _semantic_patch(reparsed)
    except Exception as error:
        if not findings:
            findings.append(
                ValidationFinding(
                    severity="error",
                    code="compile_failed",
                    message=f"The imported Patch could not be compiled: {error}",
                )
            )
        encoded = None
        unchanged_fields_preserved = False

    if encoded is not None and not unchanged_fields_preserved:
        findings.append(
            ValidationFinding(
                severity="error",
                code="encode_reparse_mismatch",
                message="The encoded Patch did not preserve imported patch semantics.",
            )
        )
        encoded = None

    return CompilationResult(
        draft_revision=request.draft_revision,
        binary=encoded,
        output_filename=_output_filename(request.source_filename),
        findings=tuple(findings),
        conformance=ConformanceReport(
            unchanged_fields_preserved=unchanged_fields_preserved,
            changed_parameter_count=changed_parameter_count,
        ),
    )


def _validate_patch_draft(
    request: CompilePatchDraftRequest,
) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    if not request.name.strip():
        findings.append(
            ValidationFinding("error", "patch_name_required", "Give the Patch Document a name.")
        )
    if len(request.name.encode("ascii", errors="ignore")) != len(request.name):
        findings.append(
            ValidationFinding(
                "error",
                "patch_name_ascii_only",
                "Patch names currently support ASCII characters only.",
            )
        )
    if len(request.name) > 16:
        findings.append(
            ValidationFinding(
                "error", "patch_name_too_long", "Patch names may contain at most 16 characters."
            )
        )

    module_ids = [module.id for module in request.modules]
    if len(module_ids) != len(set(module_ids)):
        findings.append(
            ValidationFinding("error", "duplicate_module_id", "Every Module must have a unique ID.")
        )
    if not 2 <= len(request.modules) <= 64:
        findings.append(
            ValidationFinding(
                "error",
                "module_count_out_of_range",
                "A Patch Document must contain between 2 and 64 Modules.",
            )
        )

    roles = []
    for module in request.modules:
        configuration = CONFIGURATIONS.get(module.catalog_id)
        if configuration is None:
            findings.append(
                ValidationFinding(
                    "error",
                    "unknown_module_configuration",
                    f"Module {module.name!r} uses an unsupported configuration.",
                )
            )
            continue
        roles.append(configuration.role)
        expected_parameters = set(configuration.parameter_keys)
        if set(module.raw_parameters) != expected_parameters:
            findings.append(
                ValidationFinding(
                    "error",
                    "parameter_set_mismatch",
                    f"Module {module.name!r} does not match its verified parameter configuration.",
                )
            )
        for key, raw_value in module.raw_parameters.items():
            if not 0 <= raw_value <= 65_535:
                findings.append(
                    ValidationFinding(
                        "error",
                        "raw_parameter_value_out_of_range",
                        "Raw Parameter Values must be between 0 and 65535.",
                        parameter_name=key,
                    )
                )

    if roles.count("input") != 1 or roles.count("output") != 1:
        findings.append(
            ValidationFinding(
                "error",
                "mono_io_required",
                "The first authoring workflow requires one mono Audio Input and one mono Audio Output.",
            )
        )
    if roles and (roles[0] != "input" or roles[-1] != "output"):
        findings.append(
            ValidationFinding(
                "error",
                "invalid_signal_chain_order",
                "The Signal Chain must start at Audio Input and end at Audio Output.",
            )
        )

    expected_pairs = set(zip(module_ids, module_ids[1:]))
    actual_pairs = {
        (connection.source_module_id, connection.target_module_id)
        for connection in request.connections
    }
    if len(request.connections) != max(0, len(request.modules) - 1) or actual_pairs != expected_pairs:
        findings.append(
            ValidationFinding(
                "error",
                "non_linear_signal_chain",
                "Every adjacent Module must have exactly one forward audio Connection.",
            )
        )

    cpu = sum(
        float(module_definition(CONFIGURATIONS[module.catalog_id]).get("cpu", 0))
        for module in request.modules
        if module.catalog_id in CONFIGURATIONS
    )
    if cpu > 100:
        findings.append(
            ValidationFinding(
                "warning",
                "estimated_cpu_over_budget",
                f"Estimated CPU is {cpu:.1f}%, above the nominal 100% budget.",
            )
        )
    return findings


def _active_blocks(PatchBinary, configuration: ModuleConfiguration) -> dict[str, Any]:
    return PatchBinary()._calc_blocks(
        {
            "mod_idx": configuration.mod_idx,
            "version": 0,
            "options": selected_options(configuration),
        }
    )


def resolve_experimental_configuration(
    module_index: int, option_indices: dict[str, int]
) -> dict[str, Any]:
    PatchBinary, _ = _load_codec()
    definition = json.loads(
        (ZOIA_LIB_PATH / "zoia_lib" / "common" / "schemas" / "ModuleIndex.json").read_text(
            encoding="utf-8"
        )
    ).get(str(module_index))
    if not definition:
        raise ValueError("Unknown zoia_lib Module index.")
    expected_options = definition.get("options", {})
    if set(option_indices) != set(expected_options) or any(
        not isinstance(index, int) or index < 0 or index >= len(expected_options[key])
        for key, index in option_indices.items()
    ):
        raise ValueError("Invalid Experimental Module options.")
    configuration = ModuleConfiguration(
        catalog_id="experimental-dynamic",
        mod_idx=module_index,
        option_indices=option_indices,
        parameter_keys=(),
        block_count=0,
    )
    blocks = _active_blocks(PatchBinary, configuration)
    parameters = []
    for key, metadata in sorted(
        definition.get("param_defaults", {}).items(),
        key=lambda item: item[1].get("order", 0),
    ):
        block = blocks.get(key)
        if not block or not block.get("isParam"):
            continue
        value = max(0, min(65_535, round(float(metadata.get("value", 0)) * 65_535)))
        parameters.append(
            {
                "key": key,
                "name": key.replace("_", " ").title(),
                "defaultRawValue": value,
                "unit": metadata.get("unit"),
                "range": [
                    float(item)
                    if isinstance(item, (int, float)) and math.isfinite(item)
                    else None
                    for item in scaled_parameter_range(
                        module_index,
                        key,
                        metadata,
                        selected_options(configuration),
                    )
                ],
            }
        )
    kind = {
        "audio_in": "audioInput",
        "audio_out": "audioOutput",
        "cv_in": "cvInput",
        "cv_out": "cvOutput",
    }
    suffix = "-".join(f"{key}-{option_indices[key]}" for key in sorted(option_indices))
    return {
        "id": f"experimental-dynamic-{module_index}-{suffix}",
        "name": f"{definition['name']} · Experimental",
        "type": definition["name"],
        "category": definition.get("category", "Other"),
        "description": " ".join(definition.get("description", "").split()),
        "role": "effect",
        "cpu": float(definition.get("cpu", 0)),
        "blockCount": len(blocks),
        "experimental": True,
        "codec": {"moduleIndex": module_index, "optionIndices": option_indices},
        "options": [
            {
                "key": key,
                "name": key.replace("_", " ").title(),
                "selectedValue": values[option_indices[key]],
                "values": values,
            }
            for key, values in expected_options.items()
        ],
        "parameters": parameters,
        "endpoints": [
            {
                "id": key,
                "key": key,
                "name": key.replace("_", " ").title(),
                "kind": kind.get(block.get("type"), "unknown"),
                "hardwareBlockIndex": int(block["position"]),
            }
            for key, block in blocks.items()
        ],
    }


def _first_block_position(blocks: dict[str, Any], block_type: str) -> int:
    return int(
        next(block["position"] for block in blocks.values() if block["type"] == block_type)
    )


def _build_draft_patch(PatchBinary, request: CompilePatchDraftRequest) -> tuple[dict[str, Any], int]:
    modules: list[dict[str, Any]] = []
    modules_by_id: dict[str, tuple[int, dict[str, Any]]] = {}
    colors: list[int] = []
    page = 0
    cursor = 0
    changed_parameter_count = 0

    for number, draft_module in enumerate(request.modules):
        configuration = CONFIGURATIONS[draft_module.catalog_id]
        definition = module_definition(configuration)
        blocks = _active_blocks(PatchBinary, configuration)
        block_count = len(blocks)
        if block_count != configuration.block_count:
            raise ValueError(
                f"Module configuration {configuration.catalog_id!r} changed its grid size."
            )
        if cursor + block_count > 40:
            page += 1
            cursor = 0
        if page >= 64:
            raise ValueError("The Patch Document exceeds the 64-page grid capacity.")

        raw_parameters = [
            draft_module.raw_parameters[key] for key in configuration.parameter_keys
        ]
        changed_parameter_count += sum(
            draft_module.raw_parameters[key] != default_raw_value(configuration, key)
            for key in configuration.parameter_keys
        )
        module_name = (draft_module.name.strip() or definition["name"])[:16]
        module = {
            "number": number,
            "mod_idx": configuration.mod_idx,
            "version": 0,
            "page": page,
            "header_color_id": 2,
            "position": list(range(cursor, cursor + block_count)),
            "params": len(configuration.parameter_keys),
            "size_of_saveable_data": 0,
            "options_binary": dict(configuration.option_indices),
            "parameters_raw": raw_parameters,
            "parameters": {
                key: raw / 65_535
                for key, raw in zip(configuration.parameter_keys, raw_parameters)
            },
            "saved_data": [],
            "name": module_name,
            "size": 14 + len(configuration.parameter_keys),
            "color": "Green",
        }
        modules.append(module)
        modules_by_id[draft_module.id] = (number, blocks)
        colors.append(2)
        cursor += block_count

    connections = []
    for connection in request.connections:
        source_number, source_blocks = modules_by_id[connection.source_module_id]
        target_number, target_blocks = modules_by_id[connection.target_module_id]
        connections.append(
            {
                "source_raw": source_number,
                "source_block_raw": _first_block_position(source_blocks, "audio_out"),
                "dest_raw": target_number,
                "dest_block_raw": _first_block_position(target_blocks, "audio_in"),
                "strength_raw": 10_000,
            }
        )

    page_count = page + 1
    pages = [f"PAGE {index + 1}" for index in range(page_count)]
    patch = {
        "name": request.name.strip(),
        "size": 0,
        "modules": modules,
        "connections": connections,
        "pages": pages,
        "pages_count": page_count,
        "starred": [],
        "colors": colors,
        "meta": {
            "n_modules": len(modules),
            "n_connections": len(connections),
            "n_pages": page_count,
            "n_starred": 0,
        },
    }
    return patch, changed_parameter_count


def _build_authored_document_patch(
    PatchBinary,
    document: dict[str, Any],
) -> tuple[dict[str, Any], int, list[ValidationFinding]]:
    findings: list[ValidationFinding] = []
    name = str(document.get("name", "")).strip()
    if not name or len(name) > 16 or not name.isascii():
        findings.append(
            ValidationFinding(
                "error",
                "invalid_patch_name",
                "Patch Document names must contain 1–16 ASCII characters.",
            )
        )

    modules_payload = document.get("modules", [])
    if not isinstance(modules_payload, list) or not 1 <= len(modules_payload) <= 64:
        findings.append(
            ValidationFinding("error", "module_count_out_of_range", "A Patch must contain 1–64 Modules.")
        )
        return {}, 0, findings

    modules: list[dict[str, Any]] = []
    modules_by_id: dict[str, tuple[int, dict[str, Any]]] = {}
    colors: list[int] = []
    page = 0
    cursor = 0
    changed_parameter_count = 0

    for number, document_module in enumerate(modules_payload):
        module_id = str(document_module.get("id", ""))
        configuration_id = document_module.get("configurationId")
        configuration = CONFIGURATIONS.get(str(configuration_id))
        if configuration is None:
            opaque = document_module.get("opaque")
            experimental_codec = (
                opaque.get("experimentalCodec") if isinstance(opaque, dict) else None
            )
            if isinstance(experimental_codec, dict):
                try:
                    resolved = resolve_experimental_configuration(
                        int(experimental_codec["moduleIndex"]),
                        {
                            str(key): int(value)
                            for key, value in experimental_codec["optionIndices"].items()
                        },
                    )
                    configuration = ModuleConfiguration(
                        catalog_id=str(configuration_id),
                        mod_idx=int(resolved["codec"]["moduleIndex"]),
                        option_indices=resolved["codec"]["optionIndices"],
                        parameter_keys=tuple(
                            parameter["key"] for parameter in resolved["parameters"]
                        ),
                        block_count=int(resolved["blockCount"]),
                    )
                except (KeyError, TypeError, ValueError):
                    configuration = None
        if not module_id or configuration is None:
            findings.append(
                ValidationFinding(
                    "error",
                    "unknown_module_configuration",
                    f"Module {document_module.get('name', module_id)!r} uses an unsupported configuration.",
                )
            )
            continue
        definition = module_definition(configuration)
        blocks = _active_blocks(PatchBinary, configuration)
        if len(blocks) != configuration.block_count:
            findings.append(
                ValidationFinding(
                    "error",
                    "module_configuration_changed",
                    f"Module configuration {configuration.catalog_id!r} changed its grid size.",
                )
            )
            continue
        if cursor + len(blocks) > 40:
            page += 1
            cursor = 0
        if page >= 64:
            findings.append(
                ValidationFinding("error", "grid_capacity_exceeded", "The Patch exceeds 64 hardware pages.")
            )
            continue

        raw_by_key = {
            str(parameter.get("key")): parameter.get("rawValue")
            for parameter in document_module.get("parameters", [])
            if parameter.get("kind") == "parameter"
        }
        if set(raw_by_key) != set(configuration.parameter_keys) or any(
            not isinstance(value, int) or not 0 <= value <= 65_535
            for value in raw_by_key.values()
        ):
            findings.append(
                ValidationFinding(
                    "error",
                    "parameter_set_mismatch",
                    f"Module {document_module.get('name', module_id)!r} has invalid Raw Parameter Values.",
                )
            )
            continue
        raw_parameters = [int(raw_by_key[key]) for key in configuration.parameter_keys]
        changed_parameter_count += sum(
            raw_by_key[key] != default_raw_value(configuration, key)
            for key in configuration.parameter_keys
        )
        module_name = (str(document_module.get("name", "")).strip() or definition["name"])[:16]
        color_id = _document_module_color_id(document, document_module, number)
        module = {
            "number": number,
            "mod_idx": configuration.mod_idx,
            "version": 0,
            "page": page,
            "header_color_id": color_id,
            "position": list(range(cursor, cursor + len(blocks))),
            "params": len(configuration.parameter_keys),
            "size_of_saveable_data": 0,
            "options_binary": dict(configuration.option_indices),
            "parameters_raw": raw_parameters,
            "parameters": {
                key: raw / 65_535
                for key, raw in zip(configuration.parameter_keys, raw_parameters)
            },
            "saved_data": [],
            "name": module_name,
            "size": 14 + len(configuration.parameter_keys),
            "color": _ZOIA_COLOR_NAMES[color_id],
        }
        modules.append(module)
        modules_by_id[module_id] = (number, blocks)
        colors.append(color_id)
        cursor += len(blocks)

    if findings:
        return {}, changed_parameter_count, findings

    connections: list[dict[str, int]] = []
    for connection in document.get("connections", []):
        source = modules_by_id.get(str(connection.get("sourceModuleId")))
        target = modules_by_id.get(str(connection.get("targetModuleId")))
        if source is None or target is None:
            findings.append(
                ValidationFinding("error", "unknown_connection_module", "A Connection references an unknown Module.")
            )
            continue
        source_key = str(connection.get("sourceEndpointId", ""))
        target_key = str(connection.get("targetEndpointId", ""))
        source_block = source[1].get(source_key)
        target_block = target[1].get(target_key)
        if source_block is None or target_block is None:
            findings.append(
                ValidationFinding(
                    "error",
                    "unknown_connection_endpoint",
                    f"Connection {connection.get('id', '')!r} references an inactive endpoint.",
                )
            )
            continue
        source_type = source_block.get("type")
        target_type = target_block.get("type")
        if (source_type, target_type) not in {("audio_out", "audio_in"), ("cv_out", "cv_in")}:
            findings.append(
                ValidationFinding(
                    "error",
                    "incompatible_connection_endpoints",
                    f"Connection {connection.get('id', '')!r} has incompatible endpoint types.",
                )
            )
            continue
        strength_raw = int(connection.get("strengthRaw", 10_000))
        if not 0 <= strength_raw <= 65_535:
            findings.append(
                ValidationFinding("error", "connection_strength_out_of_range", "Connection strength is invalid.")
            )
            continue
        connections.append(
            {
                "source_raw": source[0],
                "source_block_raw": int(source_block["position"]),
                "dest_raw": target[0],
                "dest_block_raw": int(target_block["position"]),
                "strength_raw": strength_raw,
            }
        )

    page_count = page + 1
    patch = {
        "name": name,
        "size": 0,
        "modules": modules,
        "connections": connections,
        "pages": [f"PAGE {index + 1}" for index in range(page_count)],
        "pages_count": page_count,
        "starred": [],
        "colors": colors,
        "meta": {
            "n_modules": len(modules),
            "n_connections": len(connections),
            "n_pages": page_count,
            "n_starred": 0,
        },
    }
    return patch, changed_parameter_count, findings


def compile_authored_patch_document(
    document: dict[str, Any],
    draft_revision: int,
) -> CompilationResult:
    PatchBinary, PatchEncoder = _load_codec()
    patch, changed_parameter_count, findings = _build_authored_document_patch(PatchBinary, document)
    encoded: bytes | None = None
    unchanged_fields_preserved = False
    if not findings:
        try:
            intended_semantics = _semantic_patch(patch)
            encoded = bytes(_with_zoia_cwd(lambda: PatchEncoder().encode(patch)))
            reparsed = _with_zoia_cwd(lambda: PatchBinary().parse_data(encoded))
            unchanged_fields_preserved = intended_semantics == _semantic_patch(reparsed)
        except Exception as error:
            findings.append(
                ValidationFinding("error", "compile_failed", f"The Patch Document could not be compiled: {error}")
            )
            encoded = None
    if encoded is not None and not unchanged_fields_preserved:
        findings.append(
            ValidationFinding("error", "encode_reparse_mismatch", "The encoded Patch did not preserve Patch Document semantics.")
        )
        encoded = None
    if encoded is not None:
        findings.append(
            ValidationFinding(
                "warning",
                "hardware_unverified",
                "Experimental export: this Module configuration has not yet been verified on ZOIA hardware.",
            )
        )
    return CompilationResult(
        draft_revision=draft_revision,
        binary=encoded,
        output_filename=_output_filename(str(document.get("name", "patch"))),
        findings=tuple(findings),
        conformance=ConformanceReport(unchanged_fields_preserved, changed_parameter_count),
    )


def compile_patch_draft(request: CompilePatchDraftRequest) -> CompilationResult:
    PatchBinary, PatchEncoder = _load_codec()
    findings = _validate_patch_draft(request)
    errors = [finding for finding in findings if finding.severity == "error"]
    encoded: bytes | None = None
    unchanged_fields_preserved = False
    changed_parameter_count = 0

    if not errors:
        try:
            patch, changed_parameter_count = _build_draft_patch(PatchBinary, request)
            intended_semantics = _semantic_patch(patch)
            encoded = bytes(_with_zoia_cwd(lambda: PatchEncoder().encode(patch)))
            reparsed = _with_zoia_cwd(lambda: PatchBinary().parse_data(encoded))
            unchanged_fields_preserved = intended_semantics == _semantic_patch(reparsed)
        except Exception as error:
            findings.append(
                ValidationFinding(
                    "error",
                    "compile_failed",
                    f"The Patch Document could not be compiled: {error}",
                )
            )
            encoded = None

    if encoded is not None and not unchanged_fields_preserved:
        findings.append(
            ValidationFinding(
                "error",
                "encode_reparse_mismatch",
                "The encoded Patch did not preserve Patch Document semantics.",
            )
        )
        encoded = None

    if encoded is not None:
        findings.append(
            ValidationFinding(
                "warning",
                "hardware_unverified",
                "Experimental export: this Module configuration has not yet been verified on ZOIA hardware.",
            )
        )

    return CompilationResult(
        draft_revision=request.draft_revision,
        binary=encoded,
        output_filename=_output_filename(request.name),
        findings=tuple(findings),
        conformance=ConformanceReport(
            unchanged_fields_preserved=unchanged_fields_preserved,
            changed_parameter_count=changed_parameter_count,
        ),
    )
