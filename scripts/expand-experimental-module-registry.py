#!/usr/bin/env python3
"""Add default zoia_lib Module definitions as Experimental authoring configurations."""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "shared" / "module-configurations.v1.json"
ZOIA_LIB_PATH = ROOT / ".vendor" / "zoia_lib"
INDEX_PATH = ZOIA_LIB_PATH / "zoia_lib" / "common" / "schemas" / "ModuleIndex.json"
# These definitions calculate a different default grid size than their static
# ModuleIndex metadata reports and remain hidden until their options are modeled.
EXCLUDED_MODULE_INDICES = {4, 40, 75, 83, 104}

sys.path.insert(0, str(ROOT))
from service.module_catalog import scaled_parameter_range

KIND = {
    "audio_in": "audioInput",
    "audio_out": "audioOutput",
    "cv_in": "cvInput",
    "cv_out": "cvOutput",
}


def safe_range(
    values: list[object], preserve_numeric_type: bool = False
) -> list[float | int | None]:
    return [
        (value if preserve_numeric_type else float(value))
        if isinstance(value, (int, float)) and math.isfinite(value)
        else None
        for value in values
    ]


def title(key: str) -> str:
    return key.replace("_", " ").title()


def load_patch_binary():
    sys.path.insert(0, str(ZOIA_LIB_PATH))
    previous_cwd = Path.cwd()
    try:
        os.chdir(ZOIA_LIB_PATH)
        from zoia_lib.backend.patch_binary import PatchBinary
    finally:
        os.chdir(previous_cwd)
    return PatchBinary


PatchBinary = load_patch_binary()
registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
curated = [entry for entry in registry["configurations"] if not entry.get("experimental")]
for entry in curated:
    module_index = int(entry["codec"]["moduleIndex"])
    definition = index[str(module_index)]
    selected = {
        key: definition["options"][key][option_index]
        for key, option_index in entry["codec"]["optionIndices"].items()
    }
    entry["options"] = [
        {
            "key": key,
            "name": title(key),
            "selectedValue": values[entry["codec"]["optionIndices"][key]],
            "values": values,
        }
        for key, values in definition.get("options", {}).items()
    ]
    for parameter in entry["parameters"]:
        metadata = definition["param_defaults"][parameter["key"]]
        parameter["range"] = safe_range(
            scaled_parameter_range(
                module_index,
                parameter["key"],
                metadata,
                selected,
            ),
            preserve_numeric_type=True,
        )
entries = list(curated)
curated_defaults = {
    (entry["codec"]["moduleIndex"], tuple(sorted(entry["codec"]["optionIndices"].items())))
    for entry in curated
}

for module_index, definition in index.items():
    if int(module_index) in EXCLUDED_MODULE_INDICES:
        continue
    options = {key: 0 for key in definition.get("options", {})}
    signature = (int(module_index), tuple(sorted(options.items())))
    if signature in curated_defaults:
        continue
    selected_options = {
        key: definition["options"][key][option_index]
        for key, option_index in options.items()
    }
    active_blocks = PatchBinary()._calc_blocks(
        {
            "mod_idx": int(module_index),
            "version": 0,
            "options": selected_options,
        }
    )
    parameters = []
    for key, metadata in definition.get("param_defaults", {}).items():
        block = active_blocks.get(key)
        if not block or not block.get("isParam"):
            continue
        normalized = float(metadata.get("value", 0))
        parameters.append(
            {
                "key": key,
                "name": title(key),
                "defaultRawValue": max(0, min(65_535, round(normalized * 65_535))),
                "unit": metadata.get("unit"),
                "range": safe_range(
                    scaled_parameter_range(
                        int(module_index),
                        key,
                        metadata,
                        selected_options,
                    )
                ),
            }
        )
    endpoints = [
        {
            "id": key,
            "key": key,
            "name": title(key),
            "kind": KIND.get(block.get("type"), "unknown"),
            "hardwareBlockIndex": int(block["position"]),
        }
        for key, block in active_blocks.items()
    ]
    option_metadata = [
        {
            "key": key,
            "name": title(key),
            "selectedValue": values[options[key]],
            "values": values,
        }
        for key, values in definition.get("options", {}).items()
    ]
    entry = {
            "id": f"experimental-{module_index}-default",
            "name": f"{definition['name']} · Experimental {module_index}",
            "type": definition["name"],
            "category": definition.get("category", "Other"),
            "description": " ".join(definition.get("description", "").split()),
            "role": "effect",
            "cpu": float(definition.get("cpu", 0)),
            "blockCount": len(active_blocks) or 1,
            "experimental": True,
            "options": option_metadata,
            "parameters": parameters,
            "endpoints": endpoints,
            "codec": {"moduleIndex": int(module_index), "optionIndices": options},
        }
    if int(module_index) == 11:
        entry["name"] = "OD & Distortion · Plexi"
    entries.append(entry)

    # OD & Distortion exposes five hardware models as an option, not as five
    # parameters. Publish each model as an Experimental configuration so it is
    # visible and selectable without pretending the model is a CV parameter.
    if int(module_index) == 11:
        models = definition["options"]["model"]
        for model_index, model in enumerate(models[1:], start=1):
            variant = json.loads(json.dumps(entry))
            variant["id"] = f"experimental-11-model-{model_index}"
            variant["name"] = f"OD & Distortion · {model.title()}"
            variant["codec"]["optionIndices"]["model"] = model_index
            variant["options"][0]["selectedValue"] = model
            entries.append(variant)

registry["configurations"] = entries
REGISTRY_PATH.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(entries)} configurations ({len(entries) - len(curated)} Experimental).")
