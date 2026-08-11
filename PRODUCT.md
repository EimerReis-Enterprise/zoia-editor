# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start with React and TypeScript in client-rendered SPA mode, without React Server Components. React Flow provides graph interaction, Zustand holds UI state, and Tailwind CSS provides styling. Framework-neutral frontend code follows the project's `lib/` architecture. A local Python service initially wraps `zoia_lib`; a native TypeScript parser may replace it later.

## Users

Empress ZOIA owners, power users, community patch creators, and musicians studying existing patches. They use the product to understand signal flow that is difficult to infer from the pedal's LED grid.

## Product Purpose

Transform ZOIA patches into understandable logical graphs and a portable JSON-first authoring workflow. Visualization success means a user can import a binary or Patch Document and follow its audio signal flow; authoring success means a user can build and save a Patch Document independently, then explicitly compile a hardware-testable mono Signal Chain binary when needed.

## Positioning

The product represents a patch according to its logical module relationships rather than reproducing the ZOIA's physical grid.

## Operating Context

The MVP runs locally through one development command. Imported `.bin` parsing is ephemeral and never uploaded; `.zoia.json` Patch Documents are portable user-owned files, while browser recovery and up to 20 undo snapshots persist locally in IndexedDB.

## Capabilities and Constraints

- MVP scope includes `.bin`, `.zoia.json`, and generic `.json` import, audio signal-flow visualization, a Module Inspector, JSON saving, and explicit binary export.
- One graph node represents one Module and one edge represents one audio Connection.
- Detailed endpoints appear in the Module Inspector rather than as separate graph nodes.
- Layout is deterministic and left-to-right, with zoom, pan, fit-to-view, and visible return edges.
- Parameter values are decoded where trustworthy metadata exists and otherwise show explicit raw fallbacks.
- One versioned, lossless Patch Document is canonical for binary imports, JSON imports, and new authoring; Patch Projections are derived views only.
- Safe authoring starts with a prewired mono Signal Chain; Advanced authoring starts with stereo I/O and supports explicit type-compatible audio and CV endpoint Connections, branches, and disconnected construction states.
- Patch Document state and bounded undo history live in the browser; a stateless local codec compiles, reparses, and validates exact Patch Revisions.
- Initial authoring supports direct Connection insertion, connector- and card-drag linear Module reordering, structural Module removal, Parameter Edits, 100 in-session undo snapshots, 20 persisted undo snapshots, local recovery, background Validation Findings, deterministic JSON downloads, and explicit binary downloads.
- The initial advanced registry supports stereo audio, branches, CV, MIDI-derived control, clock routing, Looper, Sequencer, Audio Balance, and selected processing configurations. Feedback-specific safeguards, arbitrary Module options, bank export, hardware connectivity, hosted storage, and broad firmware compatibility remain outside the release.
- Initial binary compatibility is pinned to one `zoia_lib` revision and hardware-tested fixtures. Structurally valid Patch Documents with unsupported configurations remain openable and saveable, while unsupported binary compilation fails with clear Validation Findings.

## Evidence on Hand

- Product scope and terminology are recorded in `CONTEXT.md`.
- `meanmedianmoge/zoia_lib` is the confirmed parser reference and includes parser tests and sample binary fixtures.
- No product logo, established visual identity, customer claims, or performance benchmarks are available and none should be fabricated.

## Product Principles

- Represent the logical patch, not the physical hardware.
- Make complex routing understandable at a glance.
- Optimize for exploration and learning before editing.
- Treat unknown binary or parameter data honestly rather than guessing.
- Keep early technical decisions reversible where the long-term editor architecture remains unknown.

## Accessibility & Inclusion

Graph meaning must not depend on color alone. Core import, selection, inspection, and navigation controls must remain keyboard accessible, and motion must respect reduced-motion preferences.
