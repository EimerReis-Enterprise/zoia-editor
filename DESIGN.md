---
name: ZOIA / SCOPE
description: A calibrated signal bench for understanding logical ZOIA patch routing.
colors:
  phosphor: "#78f0a3"
  phosphor-bright: "#a7ffc2"
  readout: "#dce8da"
  phosphor-dim: "#8eac91"
  amber: "#e8a94b"
  crt-black: "#070a08"
  bench-black: "#0b100d"
  panel: "#111813"
  panel-raised: "#18201a"
  graticule: "#294331"
  line: "#344b39"
  light-phosphor: "#137a3b"
  light-scope: "#f3f7f0"
  light-panel: "#f7faf5"
typography:
  display:
    fontFamily: "Barlow Condensed, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4.7rem)"
    fontWeight: 500
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
  instrument-label:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.62rem"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  control: "5px"
  panel: "8px"
  scope: "18px"
spacing:
  tight: "5px"
  control: "10px"
  panel: "20px"
components:
  button-primary:
    backgroundColor: "{colors.phosphor}"
    textColor: "{colors.crt-black}"
    typography: "{typography.instrument-label}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  module-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.readout}"
    rounded: "{rounded.control}"
    width: "188px"
    height: "92px"
---

# Design System: ZOIA / SCOPE

## Overview

**Creative North Star: "The Signal Bench"**

ZOIA / SCOPE behaves like calibrated studio test equipment rather than a generic developer graph. The graph is the observed signal: it owns the largest surface, sits against an etched graticule, and uses restrained phosphor only for routing, selection, and primary action. The surrounding interface is a matte, structural housing rather than decoration.

The system is dense but quiet. Familiar controls and direct labels keep operation clear, while instrument readouts give patch state a recognizable technical cadence. Dark mode evokes the illuminated bench; light mode becomes a daylight calibration sheet with darker green traces and white instrument modules. Physical references remain abstracted into useful hierarchy—never fake knobs, bevels, or ornamental machinery.

**Key Characteristics:**
- A near-black calibrated work surface
- Phosphor reserved for live routing and action
- Compact instrument labels paired with readable body text
- Structural frames and offset shadows
- Full-width graph topology with a docked detail inspector

## Colors

The restrained palette uses one functional green signal family, amber status, and green-biased neutrals. Dark mode uses graphite housings and luminous traces; light mode uses cool calibration paper, white modules, and a darker trace green that preserves contrast.

### Primary
- **Phosphor Trace**: Active audio edges, selected modules, keyboard focus, and primary actions.
- **Bright Phosphor**: High-emphasis readouts and selected values; use more sparingly than the main trace.

### Secondary
- **Armed Amber**: Ready, warning, and hardware-like status indicators. It does not decorate inactive controls.

### Neutral
- **CRT Black** and **Bench Black**: Page and scope depths.
- **Panel Graphite** and **Raised Graphite**: Instrument housings, nodes, and inspectors.
- **Etched Graticule** and **Structural Line**: Calibrated grids, separators, and borders.
- **Readout White** and **Dim Phosphor**: Primary and secondary text.

**The Live Signal Rule.** Signal green identifies something actionable, selected, or carrying signal; use luminous phosphor in dark mode and deep calibration green in light mode.

## Typography

**Display Font:** Barlow Condensed (with UI sans fallback)  
**Body Font:** Platform UI sans  
**Label/Mono Font:** Platform monospace

**Character:** Condensed display type recalls calibrated instrument faces without reducing body readability. Monospace is restricted to measurements, identifiers, statuses, and compact controls.

### Hierarchy
- **Display** (500, responsive 2.2–4.7rem, 0.92): Empty-state thesis only.
- **Title** (600, 0.98–1.28rem): Patch and module names.
- **Body** (400, 0.75–0.95rem): Guidance, values, and explanations.
- **Instrument Label** (500, 0.52–0.65rem, 0.08–0.14em tracking): Uppercase IDs, states, and measurements.

**The Measurement Rule.** Monospace earns its place only when text behaves like a reading, ID, endpoint, status, or control label.

## Layout

The viewport is a fixed local workbench: a 78px instrument rail above a flexible scope surface. The graph receives the remaining height and lays audio flow left-to-right. The Module Inspector docks over the right edge on desktop and rises from the bottom on narrow screens.

Spacing is compact inside controls and generous between functional regions. At 820px the patch readout collapses, the rail becomes 66px, and the inspector becomes a bottom sheet. The graph remains pannable at a readable minimum zoom rather than shrinking the full patch into illegibility.

## Elevation & Depth

Depth is structural. Wide, downward shadows separate the instrument rail, scope housing, nodes, and inspector from the bench. Inset lines describe housings and CRT depth. Green halos are confined to signal traces and armed states rather than used as generic elevation.

**The Housing Rule.** A surface may use a structural border or a shadow plus inset housing detail; it must not become a soft floating card.

## Shapes

Controls and modules use precise 5–8px corners. The outer scope housing alone receives an 18px radius to establish the instrument silhouette. Connection handles are narrow rectangular sockets, status lamps are circular, and the graph remains rectilinear.

## Components

### Buttons
- **Shape:** Compact instrument control (5px radius, 40px height).
- **Primary:** Solid phosphor with CRT-black text.
- **Secondary:** Graphite fill, structural green-gray border, readout text.
- **Hover / Focus:** Increase border or fill contrast; keyboard focus uses a two-pixel bright phosphor outline.

### Module Panels
- **Shape:** 188×92px rectangular instrument module with a 5px corner.
- **Structure:** Vertical module ID, type icon, name, module type, and directional audio sockets.
- **State:** Selection changes the structural border to phosphor and adds a restrained inner signal reflection. In editable Patch Documents, sockets enlarge slightly and use a crosshair to signal reconnection.

### Patch Document Control Rail
- **Structure:** Atomic undo/redo controls, direct Module insertion, editable Module selector, revision validation readout, edit count, a neutral **Save .zoia.json** action, and a separate experimental binary export.
- **State:** JSON saving never waits for compilation. Pending binary validation animates only its status glyph; valid uses signal green; findings float above the bottom-center canvas without changing its geometry. Findings are dismissible and reappear for a new Patch Revision.
- **Responsive behavior:** The Module selector moves to a full-width second row on narrow screens.

### Module Library
- **Structure:** A Connection picker and fuzzy filter sit above one row per ZOIA Module family. Option variants such as Mono/Stereo or Lowpass/Highpass appear as compact add buttons within that row rather than duplicating its description.
- **Interaction:** Hovering or focusing a Connection reveals a midpoint `+`; choosing it opens the library with that Connection fixed. Touching the edge opens the same flow directly.
- **Responsive behavior:** Right-side instrument drawer on desktop; bounded lower drawer on mobile.

### Module Inspector
- **Structure:** Sticky identity header, three-column facts, editable raw parameter controls, then directional connections.
- **Parameter editing:** A continuous range and exact numeric field share one Raw Parameter Value and one coalesced undo gesture; authored values lead with decoded musician units.
- **Structural editing:** Authored non-I/O Modules expose one restrained destructive action that removes the Module and reconnects its neighbors.
- **Responsive behavior:** Right dock on desktop; bounded bottom sheet on mobile.

### Connection Editing
- **Safe Signal Chain:** A circular phosphor `+` appears only on hover, focus, or selection. Socket or card dragging reorders the chain while Input and Output remain fixed.
- **Free Routing:** A dedicated **Connect** control opens an endpoint-aware routing dialog that lists existing Connections, removes obsolete routes, and creates explicit audio or CV routes. Duplicate Modules can be renamed in the Inspector before wiring.
- **Invalid state:** Self-links, duplicate routes, incompatible endpoint kinds, no-op adjacency, and endpoint violations are rejected rather than producing an invalid Patch Document.

### Scope Surface
- **Structure:** Inset housing, calibrated labels, etched line grid, graph canvas, controls, and a compact channel footer.
- **State:** Empty mode carries one illustrative waveform and two import paths; loaded mode gives the graph full priority.

## Do's and Don'ts

### Do:
- **Do** preserve left-to-right signal direction and make feedback return edges explicit.
- **Do** use green as semantic signal state, not ambient decoration.
- **Do** keep module identity readable before exposing deeper metadata.
- **Do** retain pan, zoom, fit-view, keyboard focus, and reduced-motion behavior.

### Don't:
- **Don't** reproduce the physical LED grid as the graph's organizing model.
- **Don't** add fake knobs, metal textures, or ornamental oscilloscope controls that do not operate.
- **Don't** introduce generic white cards or unrelated accent colors.
- **Don't** collapse a large mobile graph until its labels become unreadable; preserve zoom and pan instead.
