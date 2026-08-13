import json
import math
from pathlib import Path

from service.module_catalog import (
    CONFIGURATIONS,
    module_definition,
    scaled_parameter_range,
    selected_options,
)
from service.patch_compiler import _active_blocks, _load_codec

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "shared" / "module-configurations.v1.json"


def _safe_range(values: list[object]) -> list[float | None]:
    return [
        float(value)
        if isinstance(value, (int, float)) and math.isfinite(value)
        else None
        for value in values
    ]


def test_registry_includes_every_active_parameter_with_known_codec_metadata():
    PatchBinary, _ = _load_codec()
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    for entry in registry["configurations"]:
        configuration = CONFIGURATIONS[entry["id"]]
        definition = module_definition(configuration)
        active_blocks = _active_blocks(PatchBinary, configuration)
        metadata = definition.get("param_defaults", {})
        expected_keys = {
            key
            for key, block in active_blocks.items()
            if block.get("isParam") and key in metadata
        }
        parameters = {parameter["key"]: parameter for parameter in entry["parameters"]}

        assert set(parameters) == expected_keys, entry["id"]
        for key, parameter in parameters.items():
            expected = metadata[key]
            assert parameter["unit"] == expected.get("unit"), (entry["id"], key)
            assert parameter["range"] == _safe_range(
                scaled_parameter_range(
                    configuration.mod_idx,
                    key,
                    expected,
                    selected_options(configuration),
                )
            ), (
                entry["id"],
                key,
            )
