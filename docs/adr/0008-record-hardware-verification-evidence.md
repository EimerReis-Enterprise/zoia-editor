---
status: superseded by ADR-0014
---

# Record hardware verification evidence separately from compilation

Experimental Authoring will store Hardware Verification Records in versioned shared data, keyed to a Module Configuration and optionally one parameter. Every record captures the tested hardware target, firmware, verifier, date, and optional notes. This keeps compiler success distinct from evidence that a particular pedal or Euroburo actually ran the configuration, while allowing the UI to expose that evidence without treating untested library capabilities as safe.
