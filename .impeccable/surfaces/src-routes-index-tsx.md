---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: ["src/features/patch-workbench/patch-workbench.tsx"]
---

## Scope and mode

- Surface: local patch visualizer at `/`
- Mode: Operate

## Audience and task

ZOIA owners import a local `.bin` or `.zoia.json`, create a safe mono Signal Chain or an advanced stereo Patch Document, add and rename Modules, connect explicit audio/CV endpoints, save portable JSON, and explicitly export an experimental binary. Primary action is **New patch**; import and recovery remain immediately available.

## Content and constraints

- The graph is the dominant working surface.
- Imported files remain local and untouched; Patch Document JSON is user-owned while recovery remains explicitly browser-local.
- Authored binaries and Module configurations remain visibly Experimental until hardware verification.
- No RSC or hosted storage. Advanced routing supports stereo audio and explicit CV/MIDI-derived control Connections, while richer dedicated MIDI/modulation views remain deferred.
- Meaning may not depend on color alone.

## Chosen direction

**Signal Bench**: calibrated CRT scope, graphite instrument housing, etched graticule, phosphor signal traces, and restrained amber state. The memorable authoring moment is revealing a `+` directly on the live line, inserting a Module there, then dragging either its sockets or its full instrument card to reorder the chain without breaking signal continuity.

## Unresolved

Dense feedback-heavy patch behavior and module metadata fidelity remain dependent on broader real-world fixtures.
