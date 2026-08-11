from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]
MODULE_INDEX_PATH = (
    ROOT / ".vendor" / "zoia_lib" / "zoia_lib" / "common" / "schemas" / "ModuleIndex.json"
)
REGISTRY_PATH = ROOT / "shared" / "module-configurations.v1.json"


@dataclass(frozen=True)
class ModuleConfiguration:
    catalog_id: str
    mod_idx: int
    option_indices: dict[str, int]
    parameter_keys: tuple[str, ...]
    role: Literal["input", "output", "effect"] = "effect"
    block_count: int = 1


_REGISTRY = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
if _REGISTRY.get("format") != "zoia-module-configurations" or _REGISTRY.get("schemaVersion") != 1:
    raise ValueError("The shared Module Configuration Registry is invalid.")

_CONFIGURATIONS = tuple(
    ModuleConfiguration(
        catalog_id=entry["id"],
        mod_idx=int(entry["codec"]["moduleIndex"]),
        option_indices={key: int(value) for key, value in entry["codec"]["optionIndices"].items()},
        parameter_keys=tuple(parameter["key"] for parameter in entry["parameters"]),
        role=entry["role"],
        block_count=int(entry["blockCount"]),
    )
    for entry in _REGISTRY["configurations"]
)
CONFIGURATIONS = {configuration.catalog_id: configuration for configuration in _CONFIGURATIONS}
INSERTABLE_CONFIGURATIONS = tuple(
    configuration for configuration in _CONFIGURATIONS if configuration.role == "effect"
)


def _module_index() -> dict[str, dict[str, Any]]:
    return json.loads(MODULE_INDEX_PATH.read_text(encoding="utf-8"))


def module_definition(configuration: ModuleConfiguration) -> dict[str, Any]:
    return _module_index()[str(configuration.mod_idx)]


def default_raw_value(configuration: ModuleConfiguration, parameter_key: str) -> int:
    definition = module_definition(configuration)
    normalized = float(definition["param_defaults"][parameter_key]["value"])
    return max(0, min(65_535, round(normalized * 65_535)))


def selected_options(configuration: ModuleConfiguration) -> dict[str, Any]:
    definition = module_definition(configuration)
    return {
        key: definition["options"][key][index]
        for key, index in configuration.option_indices.items()
    }


def _safe_range(values: list[Any]) -> list[float | None]:
    return [
        float(value) if isinstance(value, (int, float)) and math.isfinite(value) else None
        for value in values
    ]


def catalog_payload() -> list[dict[str, Any]]:
    payload = []
    for configuration in INSERTABLE_CONFIGURATIONS:
        definition = module_definition(configuration)
        parameters = []
        for key in configuration.parameter_keys:
            metadata = definition["param_defaults"][key]
            parameters.append(
                {
                    "key": key,
                    "name": key.replace("_", " ").title(),
                    "defaultRawValue": default_raw_value(configuration, key),
                    "unit": metadata.get("unit"),
                    "range": _safe_range(metadata.get("range", [])),
                }
            )
        payload.append(
            {
                "id": configuration.catalog_id,
                "name": definition["name"],
                "type": definition["name"],
                "category": definition["category"],
                "description": " ".join(definition.get("description", "").split()),
                "cpu": float(definition.get("cpu", 0)),
                "blockCount": configuration.block_count,
                "parameters": parameters,
            }
        )
    return payload
