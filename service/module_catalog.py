from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]
ZOIA_LIB_PATH = Path(os.environ.get("ZOIA_LIB_PATH", ROOT / ".vendor" / "zoia_lib"))
MODULE_INDEX_PATH = ZOIA_LIB_PATH / "zoia_lib" / "common" / "schemas" / "ModuleIndex.json"
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


@cache
def _module_index() -> dict[str, dict[str, Any]]:
    return json.loads(MODULE_INDEX_PATH.read_text(encoding="utf-8"))


def module_definition_by_index(module_index: int) -> dict[str, Any]:
    return _module_index()[str(module_index)]


def module_definition(configuration: ModuleConfiguration) -> dict[str, Any]:
    return module_definition_by_index(configuration.mod_idx)


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


def _max_time_scale(value: Any, base_seconds: float) -> float | None:
    if isinstance(value, (int, float)):
        seconds = float(value)
    elif isinstance(value, str):
        normalized = value.strip().lower()
        try:
            seconds = (
                float(normalized[:-2].strip()) / 1_000
                if normalized.endswith("ms")
                else float(normalized[:-1].strip())
                if normalized.endswith("s")
                else float("nan")
            )
        except ValueError:
            return None
    else:
        return None
    return seconds / base_seconds if math.isfinite(seconds) and seconds > 0 else None


def scaled_parameter_range(
    module_index: int,
    parameter_key: str,
    metadata: dict[str, Any],
    options: dict[str, Any],
) -> list[Any]:
    values = list(metadata.get("range", []))
    factor = None
    if metadata.get("unit") == "ms" and options.get("max_time") is not None:
        factor = _max_time_scale(options["max_time"], 16.0)
    elif (
        module_index == 30
        and options.get("length_edit") == "on"
        and parameter_key in {"loop_length", "start_position"}
        and metadata.get("unit") == "s"
    ):
        factor = _max_time_scale(options.get("max_rec_time"), 32.0)
    elif (
        module_index == 83
        and parameter_key in {"grain_size", "grain_position"}
        and metadata.get("unit") == "ms"
    ):
        factor = _max_time_scale(options.get("max_grain_size"), 16.0)
    if factor is None:
        return values
    return [
        float(value) * factor if isinstance(value, (int, float)) else value
        for value in values
    ]


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
                    "range": _safe_range(
                        scaled_parameter_range(
                            configuration.mod_idx,
                            key,
                            metadata,
                            selected_options(configuration),
                        )
                    ),
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
