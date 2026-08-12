# Version Patches as portable snapshots with local history

Each explicit Save Version creates a complete Patch Document snapshot with an automatically assigned sequence number, required summary, timestamp, and stable series identity in extension metadata. The editor also retains these snapshots in IndexedDB and downloads each as `patch-name.vNNN.zoia.json`; this keeps every version portable and allows Patch History to be reconstructed from files without coupling the format to browser storage.

The Version Inspector presents semantic changes from each Patch Version to its predecessor. Restoring a version creates a working copy without deleting later history, and the next save receives the next highest sequence number; explicit branches, arbitrary comparisons, and diff-based storage remain outside the first release.
