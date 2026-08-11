# Preset checklist

Before handoff, confirm:

- The Patch Document is new authored Free Routing content (`source: null`), not a structurally modified binary import.
- Every Module configuration exists in `shared/module-configurations.v1.json`.
- Audio and CV endpoints are compatible, all connection IDs are unique, and each new Control Mapping has a unique target CV input.
- Module names are at most 16 characters and describe the musical role.
- The compiler produced a binary; warnings are reported as warnings, never hidden.
- The generated preset is described as Experimental until it passes the relevant real-hardware test procedure.
- The handoff lists expected audio I/O, controls, MIDI/clock assumptions, CPU risks, and the exact binary to load.
