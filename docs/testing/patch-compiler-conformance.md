# Patch compiler conformance

The first writing tracer proves that an imported binary can be decoded, encoded, reparsed, and changed at exactly one Raw Parameter Value before authoring features depend on the compiler.

## Generate hardware-test artifacts

```bash
pnpm conformance:compiler
```

This creates the ignored `conformance-out/` directory:

- `roundtrip-unchanged.bin` — parsed and encoded without edits
- `roundtrip-parameter-edit.bin` — Module 0 `value` changed from raw `16930` to `20000`
- `report.json` — source/compiler revision, hashes, semantic result, and pending hardware status

Both outputs are generated from the pinned `zoia_lib` Juniper test fixture. The automated gate checks complete semantic preservation after reparsing; it does not claim hardware compatibility.

## Hardware gate

1. Back up the ZOIA SD card.
2. Copy each artifact into an unused patch slot using a ZOIA-compatible slot filename.
3. Import and open each Patch on the hardware.
4. Confirm the unchanged Patch loads and behaves like its source fixture.
5. Confirm the edited Patch loads without corruption.
6. Record firmware version, artifact SHA-256, result, and observations separately from `report.json`.

Do not mark a Module configuration verified from parser success alone.

## Scratch Patch authoring gate

Until hardware is available, exercise the structural path through the workbench:

1. Create a new mono Patch Draft.
2. Insert every curated Module configuration at least once.
3. Edit at least one Raw Parameter Value per Module.
4. Wait for revision validation and export the experimental binary.
5. Re-import the export and confirm Module order, Connections, and Raw Parameter Values.

The automated suite compiles all curated configurations into one chain and reparses the 32,768-byte result. This proves structural encoder conformance only; the UI and exported filename deliberately retain the **Experimental** label.
