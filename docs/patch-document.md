# Patch Document v1

A Patch Document is the portable, canonical authoring and exchange format for ZOIA / SCOPE. Its preferred filename is `name.zoia.json`; import also accepts ordinary `.json` files.

The machine-readable contract is [`shared/patch-document.v1.schema.json`](../shared/patch-document.v1.schema.json). Authorable Module configurations are listed in [`shared/module-configurations.v1.json`](../shared/module-configurations.v1.json).

## Guarantees

- An unchanged `.bin` import exported through its Patch Document returns the exact original bytes.
- An edited binary import preserves known semantics and opaque source data, but its encoded bytes may differ.
- Raw Parameter Values remain canonical unsigned 16-bit values.
- Logical Module and endpoint IDs do not depend on hardware indexes.
- Hardware Placement may be absent until binary compilation.
- `linear` authoring preserves a safe mono Signal Chain; `free` authoring uses explicit audio and CV endpoints for stereo, branches, clocking, and modulation.
- Unsupported configurations do not prevent JSON import or saving, but may block binary export.
- Transient selection, viewport, validation, autosave, and undo/redo state are not part of the file.

## Top-level shape

```json
{
  "format": "zoia-patch",
  "schemaVersion": 1,
  "documentId": "local-patch-document",
  "name": "My Patch",
  "authoringMode": "linear",
  "modules": [],
  "connections": [],
  "pages": [],
  "starred": [],
  "colors": [],
  "source": null,
  "opaque": {},
  "sequences": { "nextModule": 0, "nextConnection": 0 },
  "extensions": {}
}
```

A binary import includes `source.binaryBase64`, its SHA-256 digest, and codec provenance. The original parsed codec structure is retained under `opaque.codecPatch`; normal authoring must use the stable document fields rather than that opaque payload.

## Data flow

```text
.bin ──Python decode──┐
                     ├── Patch Document ──browser authoring── .zoia.json
.json ────────────────┘          │
New Patch ───────────────────────┘
                                │
                                └──Python compile and reparse── .bin
```

## Module colors

`colors` stores one ZOIA color ID per Module in Module order. IDs `1`–`15` match the hardware palette (Blue through Mango). Binary imports also preserve `hardware.headerColorId`; color edits keep both representations aligned so JSON and compiled binaries show the same Module color.

## Workspace Layout

Optional canvas positions are stored under the `zoia-editor.workspaceLayout.v1` extension as a `positions` object keyed by Module ID. Workspace Layout is portable presentation metadata: it is independent of Hardware Placement, ignored by compilation, and does not invalidate exact export of an otherwise unchanged binary import. Selection, viewport zoom, and pan remain transient.

```json
{
  "extensions": {
    "zoia-editor.workspaceLayout.v1": {
      "positions": {
        "module-0": { "x": 120, "y": 240 }
      }
    }
  }
}
```

## Control Mappings

A Control Mapping is a CV Connection in an authored Free Routing Patch Document. Its target Module parameter stores the mapping minimum Raw Parameter Value. `connection.strengthRaw` uses ZOIA's connection-strength scale, where `10000` is 100%; it is not a Raw Parameter Value. For a unipolar full-scale Control Source, the editor derives the target span as `strengthRaw / 10000 × 65535`, clamps it to the target's unsigned 16-bit range, and formats the result in the target parameter's native units when trustworthy metadata exists. Two-point parameter ranges are linear; five-point ranges mirror `zoia_lib`'s curved interpolation, option-dependent scaling, default `0 dB` anchor, and infinite endpoint handling. Values between documented anchors remain estimates; Raw Parameter Values remain authoritative. The Control Source’s Module Inspector permits one newly authored mapping per target CV input. Existing Documents with mixed CV sources remain openable and exportable, but are not expanded by the mapping editor.

JSON import, visualization, Module Library access, authoring, and JSON saving do not require Python. Binary decoding and compilation still use the local codec adapter. Authored Free Routing compilation validates every endpoint against the shared Module Configuration Registry and accepts `audioOutput → audioInput` and `cvOutput → cvInput` relationships.
