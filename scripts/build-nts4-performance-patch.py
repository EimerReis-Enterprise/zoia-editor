#!/usr/bin/env python3
"""Build the editable JSON source for the NTS-4 / Euroburo performance rig."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "shared" / "module-configurations.v1.json"
OUTPUT_PATH = ROOT / "patches" / "nts4-performance-rig.zoia.json"

registry_payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
registry = {item["id"]: item for item in registry_payload["configurations"]}

modules: list[dict] = []
connections: list[dict] = []


def add(module_id: str, configuration_id: str, name: str, values: dict[str, int] | None = None):
    configuration = registry[configuration_id]
    values = values or {}
    module = {
        "id": module_id,
        "configurationId": configuration_id,
        "name": name[:16],
        "type": configuration["type"],
        "category": configuration["category"],
        "parameters": [
            {
                "id": f"parameter-{index}",
                "key": parameter["key"],
                "kind": "parameter",
                "name": parameter["name"],
                "rawValue": values.get(parameter["key"], parameter["defaultRawValue"]),
                "displayValue": "Configured in Patch Document",
                "decoded": True,
                "unit": parameter["unit"],
                "range": parameter["range"],
            }
            for index, parameter in enumerate(configuration["parameters"])
        ],
        "endpoints": configuration["endpoints"],
        "hardware": None,
    }
    modules.append(module)
    return module


def endpoint(module_id: str, endpoint_id: str):
    module = next(item for item in modules if item["id"] == module_id)
    return next(item for item in module["endpoints"] if item["id"] == endpoint_id)


def connect(source_module: str, source_endpoint: str, target_module: str, target_endpoint: str):
    source = endpoint(source_module, source_endpoint)
    target = endpoint(target_module, target_endpoint)
    kind = "audio" if source["kind"] == "audioOutput" else "cv"
    connections.append(
        {
            "id": f"connection-{len(connections)}",
            "sourceModuleId": source_module,
            "targetModuleId": target_module,
            "sourceEndpointId": source_endpoint,
            "targetEndpointId": target_endpoint,
            "sourceEndpoint": source["name"],
            "targetEndpoint": target["name"],
            "kind": kind,
            "strengthRaw": 10_000,
        }
    )


# Infrastructure and controller inputs
add("audio-in", "audio-input-stereo", "NTS-4 Send")
add("audio-out", "audio-output-stereo", "NTS-4 Return")
add("midi-clock", "midi-clock-in", "OP-XY Clock")
add("bar-clock", "clock-divider", "1 Bar Clock")
add("phrase-clock", "clock-divider", "4 Bar Clock")
add("crossfade-cc", "midi-cc-20", "Crossfade CC20")
add("loop-trigger", "midi-notes-loop-trigger", "Loop Rec Note60")
add("record-quantize", "sequencer-quantize-one-shot", "Record Quantize", {"step_1": 65_535})

# Sidechain pump
add("pump-lfo", "lfo-sidechain-ramp", "Quarter Pump")
add("pump-invert", "cv-invert", "Pump Invert")
add("pump-depth", "value", "Pump Depth", {"value": 26_214})
add("pump-scale", "multiplier-2", "Pump Scale")
# Start at unity: the inverted 0–40% pump subtracts from this baseline.
add("sidechain-vca", "vca-stereo", "Sidechain VCA", {"level_control": 65_535})

# Mono wash send, returned as stereo
add("wash-sum", "mixer", "Wash Send Sum")
add("wash-delay", "delay-clocked", "Wash Delay")
add("wash-hpf", "filter-highpass", "Wash HPF", {"frequency": 0, "resonance": 0})
add("wash-reverb", "reverb-send-stereo", "Wash Reverb", {"decay_time": 0, "mix": 65_535})
add("live-mix", "mixer-stereo", "Live Mix")

# Mono loop duplicated to the stereo A side; live signal occupies B
add("looper", "looper-8s-once", "4 Bar Looper")
add("crossfader", "audio-balance-stereo", "Loop Live Fade", {"mix": 32_768})

# Page 3 performance controls. Their order intentionally forces a new hardware page.
add("wash-return-vca", "vca-stereo", "Wash Return VCA", {"level_control": 0})
add("wash-intensity", "value", "Wash Intensity", {"value": 32_768})
add("loop-rec-button", "ui-button-momentary", "Loop Rec", {"in": 0})

# Clock and MIDI control
connect("midi-clock", "quarter_out", "bar-clock", "cv_input")
connect("midi-clock", "quarter_out", "phrase-clock", "cv_input")
connect("midi-clock", "quarter_out", "pump-lfo", "tap_control")
connect("midi-clock", "quarter_out", "pump-lfo", "phase_reset")
connect("midi-clock", "quarter_out", "wash-delay", "tap_tempo_in")
connect("loop-trigger", "trigger_out_1", "record-quantize", "queue_start")
connect("loop-rec-button", "cv_output", "record-quantize", "queue_start")
connect("bar-clock", "cv_output", "record-quantize", "gate_in")
connect("record-quantize", "out_track_1", "looper", "record")
connect("phrase-clock", "cv_output", "looper", "restart_playback")
connect("crossfade-cc", "cc_out", "crossfader", "mix")

# Sidechain control and stereo dry path
connect("pump-lfo", "output", "pump-invert", "cv_input")
connect("pump-invert", "cv_output", "pump-scale", "cv_input_1")
connect("pump-depth", "cv_output", "pump-scale", "cv_input_2")
connect("pump-scale", "cv_output", "sidechain-vca", "level_control")
connect("audio-in", "output_L", "sidechain-vca", "audio_in_1")
connect("audio-in", "output_R", "sidechain-vca", "audio_in_2")
connect("sidechain-vca", "audio_out_1", "live-mix", "audio_in_1_L")
connect("sidechain-vca", "audio_out_2", "live-mix", "audio_in_1_R")

# Wash send: sum stereo to mono, delay and thin it, then return in stereo
connect("sidechain-vca", "audio_out_1", "wash-sum", "audio_in_1_L")
connect("sidechain-vca", "audio_out_2", "wash-sum", "audio_in_2_L")
connect("wash-sum", "audio_out_L", "wash-delay", "audio_in")
connect("wash-delay", "audio_out", "wash-hpf", "audio_in")
connect("wash-hpf", "hipass_output", "wash-reverb", "audio_in_L")
connect("wash-reverb", "audio_out_L", "wash-return-vca", "audio_in_1")
connect("wash-reverb", "audio_out_R", "wash-return-vca", "audio_in_2")
connect("wash-return-vca", "audio_out_1", "live-mix", "audio_in_2_L")
connect("wash-return-vca", "audio_out_2", "live-mix", "audio_in_2_R")
connect("wash-intensity", "cv_output", "wash-return-vca", "level_control")
connect("wash-intensity", "cv_output", "wash-hpf", "frequency")
connect("wash-intensity", "cv_output", "wash-reverb", "decay_time")

# Loop/live crossfade and output. The optimized Looper records the left live mix.
connect("live-mix", "audio_out_L", "looper", "audio_in")
connect("looper", "audio_out", "crossfader", "audio_in_1_L")
connect("looper", "audio_out", "crossfader", "audio_in_1_R")
connect("live-mix", "audio_out_L", "crossfader", "audio_in_2_L")
connect("live-mix", "audio_out_R", "crossfader", "audio_in_2_R")
connect("crossfader", "audio_output_L", "audio-out", "input_L")
connect("crossfader", "audio_output_R", "audio-out", "input_R")

patch = {
    "format": "zoia-patch",
    "schemaVersion": 1,
    "documentId": "nts4-performance-rig-v1",
    "name": "NTS4 Loop Wash",
    "authoringMode": "free",
    "modules": modules,
    "connections": connections,
    "pages": [],
    "starred": [],
    "colors": [],
    "source": None,
    "opaque": {},
    "sequences": {"nextModule": len(modules), "nextConnection": len(connections)},
    "annotations": {
        "architecture": "Stereo ducked live signal with mono wash send, mono 8-second Looper, and stereo loop/live crossfade.",
        "masterCompression": "Delegated to NTS-4 TOTAL-FX so compression is applied to the real sum.",
        "clockSetup": "Tune 1 Bar Clock to divide quarter-note pulses by 4 and 4 Bar Clock to divide by 16 on hardware.",
        "recordLogic": "Record is queued to the next bar; verify the Looper record-window behavior and 4-bar phase on hardware before performance use.",
        "midi": "MIDI channel 1; crossfade CC 20; loop-record trigger note 60. Future Wash MIDI should target the Wash Intensity macro input only.",
        "page3Macros": "Wash Intensity is a continuous Value macro; Loop Rec is an on-device UI Button feeding the same quantized trigger input as the Launchpad.",
        "hardwareStatus": "Experimental: generated configurations have not yet been verified on Euroburo hardware."
    },
    "extensions": {},
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(json.dumps(patch, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}: {len(modules)} Modules, {len(connections)} Connections")
