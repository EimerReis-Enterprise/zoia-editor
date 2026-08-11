---
name: zoia-preset-creation
description: Creates new authored Free Routing Empress ZOIA presets from musical briefs as portable Patch Documents, including Control Mappings and compiler validation. Use when asked to create, generate, design, or iterate on a ZOIA preset, patch, sound, or performance rig.
---

# ZOIA Preset Creation

Create a new, hardware-oriented `.zoia.json` Patch Document from a musical brief. Do not modify or structurally extend imported binary Patch Documents.

## Before authoring

1. Read `CONTEXT.md`, `docs/patch-document.md`, and `shared/module-configurations.v1.json`.
2. Read `docs/patches/nts4-performance-rig.md` and `patches/nts4-performance-rig.zoia.json` when building a performance-oriented preset or needing an example.
3. Ask only for missing musical constraints that materially affect the topology: sound source/I/O, performance controls, sync/MIDI needs, and hardware target.

## Authoring rules

- Create an authored Patch Document with `authoringMode: "free"`, `source: null`, and stable logical Module IDs.
- Use only configurations from `shared/module-configurations.v1.json`.
- Preserve all required Patch Document fields and set valid `sequences` values.
- Connect audio as `audioOutput → audioInput`; connect control as `cvOutput → cvInput`.
- Use one Control Mapping per newly mapped target CV input. A mapping is a CV Connection: the target parameter's `rawValue` is its minimum; `strengthRaw` is `maximum - minimum`.
- Name Modules by musical role, keep names within ZOIA's 16-character limit, and choose intentional hardware colors.
- Put the generated Patch Document in `patches/<slug>.zoia.json`; add a companion `docs/patches/<slug>.md` when topology, controls, or hardware test steps need explanation.
- Treat compiler success as structural validation only. Mark generated configurations Experimental until tested on hardware.

## Validate

```bash
pnpm setup:parser
.venv/bin/python .pi/skills/zoia-preset-creation/scripts/validate_preset.py patches/<slug>.zoia.json --output conformance-out/zoia_<slug>.bin
```

Fix every error finding before presenting the preset. Report warnings explicitly; never claim hardware verification from compiler success.

## Completion

Report the output files, signal/control topology, exposed performance controls, validation findings, and exact hardware test steps. See [references/preset-checklist.md](references/preset-checklist.md) before handoff.
