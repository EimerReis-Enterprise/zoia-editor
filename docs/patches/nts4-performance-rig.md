# NTS-4 / Euroburo Performance Rig Handoff

## Purpose

This document is the continuation point for `patches/nts4-performance-rig.zoia.json`. The Patch is an editable, JSON-first experimental performance rig for an NTS-4/OP-XY setup and an Empress Euroburo. Compiler success proves structural encoding only; musical behavior remains subject to hardware verification.

## Source of truth

- Editable artifact: `patches/nts4-performance-rig.zoia.json`
- Generator: `scripts/build-nts4-performance-patch.py`
- Shared Module configurations: `shared/module-configurations.v1.json`
- Compiler regression: `test_nts4_performance_patch_document_compiles` in `service/tests/test_patch_compiler.py`
- Pinned codec library revision: `9a959c4ef2ecbaa82f6525761472058bbead7d66`

Do not hand-edit the generated JSON without making the equivalent generator change. Regenerate it with:

```bash
python3 scripts/build-nts4-performance-patch.py
```

The expected generated document currently contains **23 Modules** and **38 Connections**.

## Current topology

```text
NTS-4 stereo send → Sidechain VCA
                    ├→ Live Mix input A (stereo live path)
                    └→ mono Wash Sum
                         → clocked Delay
                         → HPF
                         → mono-to-stereo Reverb
                         → Wash Return VCA
                         → Live Mix input B

Live Mix left → mono 8-second Looper
Looper output duplicated to stereo → Audio Balance A
Live Mix stereo                  → Audio Balance B
Audio Balance stereo             → NTS-4 return
```

Master compression is intentionally delegated to NTS-4 TOTAL-FX so it processes the actual final sum.

## Control routing

### Clock and recording

- MIDI channel: **1**
- OP-XY quarter-note MIDI clock drives:
  - the one-bar divider,
  - the four-bar divider,
  - the sidechain ramp,
  - clocked wash Delay.
- Launchpad/keyboard note **60** and the Page 3 **Loop Rec** UI Button both feed `Record Quantize: queue start`.
- The one-bar clock gates the recording queue.
- The quantizer starts Looper recording.
- The four-bar clock restarts Looper playback.

### Sidechain pump

```text
Quarter Pump → CV Invert → Pump Scale ← Pump Depth
                                      ↓
                               Sidechain VCA level
```

The Sidechain VCA must start at unity (`level_control = 65535`). `CV Invert` produces negative modulation; it does not calculate `1 − CV`. The inverted pump therefore subtracts up to the configured depth from the unity baseline.

### Wash Intensity

The Page 3 `Value` Module named **Wash Intensity** is the single internal macro boundary. Its output controls:

- Wash Return VCA level,
- Wash HPF frequency,
- Wash Reverb decay.

Reverb mix remains 100% wet and Delay time remains clock-synchronized. Future MIDI automation should target the Wash Intensity macro input rather than connect MIDI independently to those three internal destinations.

### Loop/live mix

MIDI **CC20** controls `Loop Live Fade`. The Looper Mix UI macro was deliberately deferred because two continuous sources connected directly to the same destination would sum and fight each other. Direction, endpoints, and useful crossfade range still require hardware verification.

## Deterministic hardware placement

The compiler allocates Modules in document order with a 40-block page limit. Current expected placement is:

| Page | Modules |
|---|---|
| 1 | NTS-4 Send, NTS-4 Return, OP-XY Clock, 1 Bar Clock, 4 Bar Clock, Crossfade CC20, Loop Rec Note60, Record Quantize, Quarter Pump, Pump Invert, Pump Depth, Pump Scale, Sidechain VCA |
| 2 | Wash Send Sum, Wash Delay, Wash HPF, Wash Reverb, Live Mix, 4 Bar Looper, Loop Live Fade |
| 3 | Wash Return VCA, Wash Intensity, Loop Rec |

Page 3 placement currently depends on module order and block counts, not an explicit page-pinning feature. The compiler regression reparses the binary and verifies the three Page 3 Modules have hardware page index `2`.

## Hardware test history

### First load

- The generated Patch loaded on hardware.
- No audio was heard through the headphone output.
- Inspection found `Sidechain VCA: Level Control` at zero.
- Root cause: the generator used a zero VCA baseline while feeding it negative modulation from CV Invert.
- Fix applied in the generator and JSON: initialize Sidechain VCA level to raw `65535`.
- Automated compilation and semantic reparse pass after the correction.
- **Pending:** confirm audibility and pump behavior on hardware with the corrected VCA baseline.

Record every subsequent hardware session below with date, artifact/hash if available, setup, observations, and resulting changes.

## Hardware verification checklist

1. Connect the intended NTS-4 stereo send to Euroburo inputs and Euroburo outputs to the intended NTS-4 return path.
2. Start with output/headphone levels low, then confirm clean stereo dry passthrough.
3. Confirm Sidechain VCA starts audible without MIDI clock.
4. Send quarter-note MIDI clock and verify the pump ducks rather than mutes or boosts.
5. Tune `1 Bar Clock` to quarter-note ÷4.
6. Tune `4 Bar Clock` to quarter-note ÷16.
7. Verify note 60 and Page 3 Loop Rec both queue recording at the next bar.
8. Verify Looper record duration, restart behavior, and four-bar phase.
9. Sweep Wash Intensity and evaluate return level, HPF range, Reverb decay, and CPU use.
10. Confirm the Delay remains tempo-synchronized across the Wash sweep.
11. Sweep CC20 and document the live/loop direction and useful range.
12. Confirm stereo output and headphone monitoring.
13. Monitor Euroburo CPU and look for clipping or control-rate instability.

## Known risks and deferred work

- Divider raw values and Looper timing are not yet calibrated on hardware.
- UI Button momentary behavior remains unverified.
- Wash Intensity uses direct linear mappings; scaling or curves may be required.
- The mono Looper records only the left Live Mix channel and duplicates playback to stereo.
- CC20 and a future local Loop Mix macro need explicit source-selection or takeover logic.
- Page placement can drift if earlier Modules or block counts change.
- The headphone-output issue is only provisionally resolved until the corrected artifact is heard.
- All generated configurations remain Experimental until verified on real hardware.

## Validation before handoff

Run:

```bash
python3 scripts/build-nts4-performance-patch.py
pnpm check
```

Expected results:

- JSON reports 23 Modules and 38 Connections.
- Binary compiler produces 32,768 bytes.
- The only fixture compilation finding is `hardware_unverified`.
- Page 3 regression passes.
- Frontend, parser, architecture, lint, typecheck, and production build pass.

Then import the regenerated `.zoia.json` into the editor, wait for **Revision ready**, and explicitly export the experimental `.bin`. Never treat compiler success as hardware verification.
