---
status: superseded by ADR-0003
---

# Keep Patch Drafts in the browser and compile them statelessly

Patch Authoring keeps the versioned Patch Draft and undo history in the browser, while the local Python process exposes a stateless compiler that expands verified Module configurations, encodes with `zoia_lib`, reparses, validates, and returns a binary plus findings for the requested Draft Revision. This keeps editing and undo responsive, prevents `zoia_lib` internals from becoming the frontend model, and preserves the seam for a future TypeScript compiler; it requires a versioned Patch Draft format and discarding stale asynchronous compiler results.
