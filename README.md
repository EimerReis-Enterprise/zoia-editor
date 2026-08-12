# ZOIA Patch Visualizer and Editor

A free and open-source signal-flow visualizer and Patch authoring workbench for Empress ZOIA `.bin` files and portable `.zoia.json` Patch Documents.

The public editor is deployed at <https://zoia.eimerreis.de>. Patch Documents and Patch History stay in your browser; binary operations use a stateless Hosted Codec and are not retained.

## Run

```bash
pnpm install
pnpm dev
```

The first run creates `.venv`, installs the Python parser service, and clones the pinned `meanmedianmoge/zoia_lib` revision into `.vendor/`. Open <http://localhost:3000>.

## Create a Patch from scratch

1. Choose **New mono patch** and name the Patch.
2. Hover a Connection and choose its `+`, tap the Connection, or use **Insert Module**.
3. Pick VCA, Filter, Compressor, Distortion, Delay, Reverb, or Mixer.
4. Tune parameters in musician-facing units or enter exact raw values.
5. Choose **Save .zoia.json** for the normal authoring artifact.
6. When needed, wait for **Revision ready** and explicitly choose **Export experimental .bin**.

New Patch Documents begin as Left Audio Input → Left Audio Output. Insertions rewire the selected Connection automatically. Drag a Module card into another gap, or connect an audio output to another Module input, to reorder effects while preserving one valid linear Signal Chain. Input and Output remain fixed. Browser recovery keeps 20 persisted undo snapshots; redo remains session-only.

## Build an advanced routed Patch

Choose **Advanced stereo routing** in the New Patch dialog. Add Modules from the shared registry, choose option variants within each Module family, rename repeated instances in the Module Inspector, and use **Connect** to create or remove explicit audio and CV endpoint Connections. The current registry includes stereo I/O and processing, Looper, MIDI Clock/CC/Notes inputs, Clock Divider, Sequencer, LFO, CV utilities, Audio Balance, Mixer, Delay, Reverb Lite, filters, compression, and Pixel configurations.

Advanced Patch Documents are compiled endpoint-by-endpoint and receive deterministic Hardware Placement. Every generated configuration remains Experimental until tested on ZOIA hardware.

The editable NTS-4 / Euroburo performance rig is available at `patches/nts4-performance-rig.zoia.json`. Regenerate it with:

```bash
python3 scripts/build-nts4-performance-patch.py
```

Before changing or hardware-testing this rig, read its topology, controls, known risks, and test history in [`docs/patches/nts4-performance-rig.md`](docs/patches/nts4-performance-rig.md).

## Test round-trip editing

1. Import a `.bin`, `.zoia.json`, or ordinary `.json` Patch.
2. Choose an editable Module from the **Edit** selector.
3. Change a raw parameter with the slider or exact-value field, or choose one of the 15 ZOIA Module colors.
4. Wait for **Revision ready**.
5. Use undo/redo as needed, then save the Patch Document or choose **Export test .bin**.

An unchanged binary import exports the exact original bytes. Edited binaries are compiled and reparsed before download. Exports never overwrite the imported file and remain experimental until tested on real ZOIA hardware.

Patch Document JSON import, authoring, visualization, and saving work without the Python service. Binary decoding and compilation use the local codec adapter in development and the transient Hosted Codec on the public deployment.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm architecture
pnpm test
pnpm build
```

Generate semantic round-trip binaries for real-hardware testing:

```bash
pnpm conformance:compiler
```

See `docs/testing/patch-compiler-conformance.md` before loading generated artifacts onto a ZOIA.

## Agent skill

Project-local agents can load [`zoia-preset-creation`](.pi/skills/zoia-preset-creation/SKILL.md) to create and structurally validate new authored Free Routing presets from musical briefs. After Pi restarts in this project, invoke it with `/skill:zoia-preset-creation`.

## Architecture

- `shared/patch-document.v1.schema.json` — public Patch Document JSON Schema
- `shared/module-configurations.v1.json` — Module Configuration Registry consumed by browser and codec
- `src/lib/domain/patch/` — framework-neutral Patch Document, projections, authoring, and validation
- `src/lib/infra/parser-api/` — HTTP adapter for the local parser
- `src/lib/infra/draft-storage/` — browser-local IndexedDB recovery
- `src/features/patch-workbench/` — React Flow UI and Zustand view state
- `service/` — replaceable local FastAPI binary codec adapter around the pinned reference library

The repository is licensed under GPL-3.0. The Hosted Codec includes pinned GPL-3.0 `zoia_lib`; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Production deployment is documented in [`docs/deployment.md`](docs/deployment.md).
