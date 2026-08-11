#!/usr/bin/env python3
"""Add default zoia_lib Module definitions as Experimental authoring configurations."""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "shared" / "module-configurations.v1.json"
INDEX_PATH = ROOT / ".vendor/zoia_lib/zoia_lib/common/schemas/ModuleIndex.json"
# These definitions calculate a different default grid size than their static
# ModuleIndex metadata reports and remain hidden until their options are modeled.
EXCLUDED_MODULE_INDICES = {4, 40, 75, 83, 104}

KIND = {
    "audio_in": "audioInput",
    "audio_out": "audioOutput",
    "cv_in": "cvInput",
    "cv_out": "cvOutput",
}


def safe_range(values: list[object]) -> list[float | None]:
    return [
        float(value)
        if isinstance(value, (int, float)) and math.isfinite(value)
        else None
        for value in values
    ]


def title(key: str) -> str:
    return key.replace("_", " ").title()


registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
curated = [entry for entry in registry["configurations"] if not entry.get("experimental")]
for entry in curated:
    definition = index[str(entry["codec"]["moduleIndex"])]
    entry["options"] = [
        {
            "key": key,
            "name": title(key),
            "selectedValue": values[entry["codec"]["optionIndices"][key]],
            "values": values,
        }
        for key, values in definition.get("options", {}).items()
    ]
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
    active_blocks = {
        key: block
        for key, block in definition.get("blocks", {}).items()
        if block.get("isDefault")
    }
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
                "range": safe_range(metadata.get("range", [])),
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
            "blockCount": int(definition.get("default_blocks", len(active_blocks) or 1)),
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
