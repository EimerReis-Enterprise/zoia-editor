# Isolate the reference parser behind a local HTTP service

The MVP runs the pinned GPL-3.0 `meanmedianmoge/zoia_lib` codec in a separate local Python service. This gets real binary compatibility quickly, keeps GPL source and runtime dependencies out of the frontend bundle, and creates a replaceable boundary for a future TypeScript codec; distribution and licensing must be reviewed before packaging the two processes as a consumer application. ADR-0003 evolves the original read-only projection boundary so the service exchanges frontend-owned Patch Documents instead.
