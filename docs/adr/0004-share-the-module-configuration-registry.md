# Share the Module Configuration Registry across authoring and compilation

Module configuration definitions will live in a versioned, repository-owned JSON registry consumed by both the browser and the Python codec adapter, replacing the Python-owned authoring catalog. Patch Documents reference stable configuration IDs while retaining resolved parameter, option, and endpoint information for portability. This lets JSON authoring and the Module Library run without Python while keeping binary-specific mapping isolated behind the replaceable codec boundary.
