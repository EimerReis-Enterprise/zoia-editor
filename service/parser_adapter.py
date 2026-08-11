from __future__ import annotations

import base64
import hashlib
import math
import os
import sys
from pathlib import Path
from typing import Any

from service.module_catalog import CONFIGURATIONS

ROOT = Path(__file__).resolve().parents[1]
ZOIA_LIB_PATH = Path(os.environ.get("ZOIA_LIB_PATH", ROOT / ".vendor" / "zoia_lib"))


class ParserUnavailableError(RuntimeError):
    pass


class InvalidPatchError(ValueError):
    pass


def _load_parser():
    if not ZOIA_LIB_PATH.exists():
        raise ParserUnavailableError(
            "The reference parser is not installed. Run `pnpm setup:parser` and try again."
        )

    path = str(ZOIA_LIB_PATH)
    if path not in sys.path:
        sys.path.insert(0, path)

    previous_cwd = Path.cwd()
    try:
        os.chdir(ZOIA_LIB_PATH)
        from zoia_lib.backend.patch_binary import PatchBinary
    except (ImportError, FileNotFoundError) as error:
        raise ParserUnavailableError(
            "The pinned zoia_lib parser could not be loaded. Run `pnpm setup:parser`."
        ) from error
    finally:
        os.chdir(previous_cwd)

    return PatchBinary


def _block_for_position(module: dict[str, Any], position: int) -> tuple[str, dict[str, Any]] | None:
    for name, block in module.get("blocks", {}).items():
        block_position = block.get("position")
        if block_position == position or (
            isinstance(block_position, list) and position in block_position
        ):
            return name, block
    return None


def _parameter_projection(module: dict[str, Any]) -> list[dict[str, Any]]:
    projected: list[dict[str, Any]] = []
    raw_values = module.get("parameters_raw", [])

    for index, (name, value) in enumerate(module.get("parameters", {}).items()):
        raw = raw_values[index] if index < len(raw_values) else None
        projected.append(
            {
                "id": f"parameter-{index}",
                "key": name,
                "kind": "parameter",
                "name": name.replace("_", " ").strip().title(),
                "displayValue": f"{round(float(value) * 100)}% normalized",
                "rawValue": raw,
                "decoded": False,
            }
        )

    for name, value in module.get("options", {}).items():
        projected.append(
            {
                "id": f"option-{name}",
                "key": name,
                "kind": "option",
                "name": name.replace("_", " ").strip().title(),
                "displayValue": str(value).replace("_", " "),
                "rawValue": module.get("options_binary", {}).get(name),
                "decoded": True,
            }
        )

    return projected


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _endpoint_id(name: str, block: dict[str, Any]) -> str:
    position = block.get("position")
    suffix = "-".join(str(item) for item in position) if isinstance(position, list) else str(position)
    safe_name = "-".join(name.lower().replace("_", " ").split())
    return f"{safe_name}-{suffix}"


def _endpoint_kind(block_type: str) -> str:
    return {
        "audio_in": "audioInput",
        "audio_out": "audioOutput",
        "cv_in": "cvInput",
        "cv_out": "cvOutput",
        "midi": "midi",
    }.get(block_type, "unknown")


def _connection_kind(source_block: dict[str, Any], target_block: dict[str, Any]) -> str:
    types = {source_block.get("type"), target_block.get("type")}
    if types <= {"audio_in", "audio_out"}:
        return "audio"
    if types <= {"cv_in", "cv_out"}:
        return "cv"
    if "midi" in types:
        return "midi"
    return "unknown"


def _configuration_id(module: dict[str, Any]) -> str | None:
    matches = [
        configuration.catalog_id
        for configuration in CONFIGURATIONS.values()
        if configuration.mod_idx == module.get("mod_idx")
        and configuration.option_indices == module.get("options_binary", {})
    ]
    return matches[0] if len(matches) == 1 else None


def parse_patch(data: bytes, filename: str) -> dict[str, Any]:
    if not data:
        raise InvalidPatchError("The selected patch is empty.")
    if len(data) > 1_048_576:
        raise InvalidPatchError("The selected file is larger than the 1 MB patch limit.")
    if not filename.lower().endswith(".bin"):
        raise InvalidPatchError("Select a ZOIA patch with a .bin extension.")

    PatchBinary = _load_parser()
    previous_cwd = Path.cwd()
    try:
        os.chdir(ZOIA_LIB_PATH)
        parsed = PatchBinary().parse_data(data)
    except Exception as error:
        raise InvalidPatchError(
            "This file could not be parsed by the pinned zoia_lib revision."
        ) from error
    finally:
        os.chdir(previous_cwd)

    modules_by_number = {module["number"]: module for module in parsed["modules"]}
    connections: list[dict[str, Any]] = []

    for index, connection in enumerate(parsed.get("connections", [])):
        source_module = modules_by_number.get(connection["source_raw"])
        target_module = modules_by_number.get(connection["dest_raw"])
        if source_module is None or target_module is None:
            continue
        source_block = _block_for_position(source_module, connection["source_block_raw"])
        target_block = _block_for_position(target_module, connection["dest_block_raw"])
        if source_block is None or target_block is None:
            continue
        connections.append(
            {
                "id": f"connection-{index}",
                "sourceModuleId": f"module-{source_module['number']}",
                "targetModuleId": f"module-{target_module['number']}",
                "sourceEndpointId": _endpoint_id(*source_block),
                "targetEndpointId": _endpoint_id(*target_block),
                "sourceEndpoint": source_block[0].replace("_", " ").title(),
                "targetEndpoint": target_block[0].replace("_", " ").title(),
                "kind": _connection_kind(source_block[1], target_block[1]),
                "strengthRaw": int(connection.get("strength_raw", 10_000)),
            }
        )

    modules = []
    for module in parsed["modules"]:
        endpoints = [
            {
                "id": _endpoint_id(name, block),
                "key": name,
                "name": name.replace("_", " ").title(),
                "kind": _endpoint_kind(str(block.get("type", ""))),
                "hardwareBlockIndex": (
                    int(block["position"])
                    if isinstance(block.get("position"), int)
                    else int(block["position"][0])
                    if isinstance(block.get("position"), list) and block["position"]
                    else None
                ),
            }
            for name, block in module.get("blocks", {}).items()
        ]
        modules.append(
            {
                "id": f"module-{module['number']}",
                "configurationId": _configuration_id(module),
                "name": module.get("name") or module.get("type") or f"Module {module['number']}",
                "type": module.get("type") or "Unknown module",
                "category": module.get("category") or "Unknown",
                "parameters": _parameter_projection(module),
                "endpoints": endpoints,
                "hardware": {
                    "moduleIndex": int(module["number"]),
                    "moduleTypeIndex": int(module["mod_idx"]),
                    "version": int(module.get("version", 0)),
                    "page": int(module.get("page", 0)),
                    "headerColorId": int(module.get("header_color_id", 0)),
                    "position": [int(item) for item in module.get("position", [])],
                },
                "opaque": _json_safe(module),
            }
        )

    return {
        "format": "zoia-patch",
        "schemaVersion": 1,
        "documentId": f"local-{Path(filename).stem}",
        "name": parsed.get("name") or Path(filename).stem,
        "authoringMode": "preserved",
        "modules": modules,
        "connections": connections,
        "pages": _json_safe(parsed.get("pages", [])),
        "starred": _json_safe(parsed.get("starred", [])),
        "colors": _json_safe(parsed.get("colors", [])),
        "source": {
            "kind": "binary",
            "filename": filename,
            "sha256": hashlib.sha256(data).hexdigest(),
            "binaryBase64": base64.b64encode(data).decode("ascii"),
            "codec": {
                "name": "zoia_lib",
                "revision": "9a959c4ef2ecbaa82f6525761472058bbead7d66",
            },
        },
        "opaque": {"codecPatch": _json_safe(parsed)},
        "sequences": {
            "nextModule": len(modules),
            "nextConnection": len(connections),
        },
        "extensions": {},
    }
