# Persist Source Calibration as extension metadata

Source Calibration records the observed point where a Control Source reaches full effective CV output, allowing the editor to render mappings in the controller’s native domain (for example MIDI CC 0–127). Store it in Patch Document `extensions`, keyed by source Module and endpoint, rather than changing binary compilation or multiplying Module Configuration variants. The compiler continues to use only the derived hardware-backed CV Connections; the metadata preserves the graphical editing context after save and reopen.
