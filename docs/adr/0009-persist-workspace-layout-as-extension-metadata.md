# Persist Workspace Layout as extension metadata

Canvas positions are durable presentation metadata stored in a Patch Document extension, independent of ZOIA Hardware Placement and ignored by compilation. Layout operations have their own undoable workspace history, do not advance the semantic Patch Revision, and do not invalidate byte-identical export of an otherwise unchanged binary import; this preserves portable visual arrangements without confusing editor layout with hardware behavior.
