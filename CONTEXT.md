# ZOIA Patch Visualizer

A visual language for understanding the logical structure and routing of Empress ZOIA patches independently of their hardware-grid presentation.

## Language

**Patch**:
A complete ZOIA program containing modules, their parameter values, and connections.
_Avoid_: Project, program file

**Patch Document**:
A portable, versioned, lossless JSON representation of Patch content used for authoring and exchange. It excludes transient workspace state; for a binary import, it preserves the exact original bytes while unchanged and preserves all known semantics and opaque source data after edits.
_Avoid_: Session file, patch JSON, Patch Projection

**Patch Projection**:
A read-only, potentially lossy view of a Patch containing the information needed for visualization. It is derived from a Patch Document and is not suitable for binary export.
_Avoid_: Parsed patch, editable patch

**Round-trip Export**:
Producing a new binary from a Patch Document. An unchanged binary import is byte-identical; an edited import preserves known semantics and opaque source data without promising byte identity.
_Avoid_: Save, write-back

**Patch Authoring**:
Creating or modifying a Patch Document before compilation and validation.
_Avoid_: Patch writing, editing from scratch

**Patch Revision**:
A monotonically increasing identifier for one exact working state of a Patch Document. Validation and export results apply only to the revision they compiled.
_Avoid_: Draft Revision, version, save number

**Patch Version**:
An explicitly saved, portable snapshot in a sequence of related Patch Documents. It has an automatically assigned sequence number and a user-written summary.
_Avoid_: Patch Revision, commit, filename version

**Patch History**:
The ordered collection of Patch Versions sharing one stable series identity. It can be reconstructed from portable Patch Documents or retained locally by the editor.
_Avoid_: Undo history, Git repository

**Version Inspector**:
A chronological browser for Patch History that summarizes how each Patch Version differs from its predecessor and can restore a chosen snapshot for further authoring.
_Avoid_: Git log, undo panel, JSON diff viewer

**Local Workspace**:
The anonymous user's browser-owned Patch Documents, recovery state, and Patch Histories on one device. It is usable without an account and is distinct from future hosted Preset management.
_Avoid_: Account, cloud library, server workspace

**Hosted Codec**:
The public, stateless processor that transiently decodes and compiles ZOIA binary data without retaining it. Sending a binary to it requires an informed first-use acknowledgement; Patch Document authoring and Patch History remain in the Local Workspace.
_Avoid_: Cloud storage, hosted editor, local parser

**Patch Compilation**:
Transforming one Patch Revision into a ZOIA binary and a validation report.
_Avoid_: Save, serialization

**Validation Finding**:
A warning or error produced for a specific Patch Revision, optionally associated with a Module, parameter, or Connection.
_Avoid_: Toast, compiler message

**Authoring Operation**:
One atomic user-intended change to a Patch Document, such as inserting a Module into a Signal Chain or changing one parameter.
_Avoid_: Action, state update, edit event

**Parameter Edit**:
A change to one existing Module parameter that does not alter Patch structure or module options.
_Avoid_: Patch edit, value tweak

**Raw Parameter Value**:
The exact unsigned 16-bit value stored by ZOIA for a Module parameter. It is canonical in a Patch Document even when shown using musician-friendly units.
_Avoid_: Normalized value, display value

**Module Configuration Registry**:
The versioned catalog of authorable Module configurations shared by the browser and binary codec. Patch Documents reference stable configuration identities but retain enough resolved information to remain understandable independently; ordinary authoring remains available when the codec is unavailable.
_Avoid_: Python catalog, Module Library data

**Verified Module Configuration**:
A specific Module type and option combination whose generated binary has passed structural validation and testing on real ZOIA hardware.
_Avoid_: Supported module, valid module

**Hardware Verification Record**:
A durable result that one Module Configuration or parameter was tested on a specified ZOIA hardware target and firmware version. It is evidence for a Verified Module Configuration, not a compiler finding.
_Avoid_: Verified flag, supported module

**Experimental Export**:
An exported Patch containing one or more Module configurations that have not completed hardware verification.
_Avoid_: Invalid patch, beta patch

**Module**:
A functional unit within a Patch, such as an audio input, delay, LFO, or output.
_Avoid_: Node, block

**Hardware Placement**:
A Module's physical page and grid position on ZOIA. It is preserved when known but may remain unassigned in an authored Patch Document until compilation.
_Avoid_: Graph position, canvas position

**Workspace Layout**:
Optional presentation metadata describing where Modules appear on the editor canvas. It travels in Patch Document extension metadata, remains independent of Hardware Placement, and has no effect on compilation.
_Avoid_: Hardware layout, ZOIA grid position

**Module Endpoint**:
A typed input or output attachment point on a Module. An input Endpoint is presented as an inlet and an output Endpoint as an outlet; users create a Connection by dragging from a compatible outlet to an inlet.
_Avoid_: React Flow handle, generic port

**Connection**:
A directed routing relationship from one Module Endpoint to another.
_Avoid_: Wire, edge, link

**Audio Signal Flow**:
The subset of Connections that carry audio between Modules, represented according to logical routing rather than hardware position.
_Avoid_: Hardware layout, patch layout

**Signal Chain**:
A linear Audio Signal Flow in which each Module feeds the next Module in order.
_Avoid_: Pipeline, module list

**Free Routing**:
Patch Authoring through explicit Module endpoints, allowing audio branches and audio or CV Connections outside a Signal Chain. Every Connection remains directed and type-compatible.
_Avoid_: Arbitrary wiring, advanced Signal Chain

**Module Inspector**:
The detailed representation of a selected Module, including its identity, type, parameters, values, and Connections.
_Avoid_: Node inspector, properties panel

**Connection Inspector**:
The focused representation of one selected Connection, including its source and target Module Endpoints, signal kind, strength, Target Range, and applicable calibration controls.
_Avoid_: Edge inspector, wire properties

**Control Source**:
Any Module endpoint that emits CV and can drive a target CV input, including UI Buttons, Values, LFOs, and MIDI-derived controls.
_Avoid_: Macro knob, button-only control

**Target Range**:
The minimum and maximum values a Control Mapping can set on one target parameter, expressed in that parameter’s native units. The minimum initializes from the target’s current value.
_Avoid_: CV strength, modulation depth

**Macro Control**:
One Control Source and the set of Control Mappings it drives, edited as a single performance control while remaining hardware-backed CV Connections in the Patch Document.
_Avoid_: Virtual macro, editor-only automation

**Response Calibration**:
A musician-defined outcome for a Control Mapping at a chosen Control Source position, such as a target value at 80% travel. The editor derives the underlying linear target range and makes saturation explicit.
_Avoid_: Magic strength value, hand-tuned raw mapping

**Source Calibration**:
The observed controller position at which a Control Source reaches its full effective CV output. It lets the editor present mappings on the controller’s native scale, such as MIDI CC 0–127, while deriving hardware Connection strengths.
_Avoid_: MIDI learn, source strength

**Control Mapping**:
A managed CV Connection from a Control Source to one target CV input, with a Target Range defined independently. A target CV input has at most one Control Mapping in the first release. It is authored from the Control Source’s Module Inspector; removing it leaves the target at its minimum value.
_Avoid_: Macro, virtual automation, editor-only mapping
