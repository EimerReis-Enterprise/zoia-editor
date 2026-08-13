# PatchStorage API capabilities relevant to the Patch browser

Research checked against PatchStorage's current first-party Swagger specification and live API responses.

## Sources

- [PatchStorage beta API documentation](https://patchstorage.com/docs/api/beta/)
- [Current Swagger 2.0 specification](https://patchstorage.com/docs/api/beta/swagger-20260803.json)
- [Live ZOIA patch collection](https://patchstorage.com/api/beta/patches/?platforms=3003)
- [Live ZOIA platform metadata](https://patchstorage.com/api/beta/platforms/3003/)
- Pinned Librarian client: `.vendor/zoia_lib/zoia_lib/backend/api.py`

## Anonymous browsing

`GET /api/beta/patches` provides server-side:

- Pagination using `page` and `per_page`, with a documented maximum page size of 100.
- Keyword search using `search`.
- Ascending or descending ordering using `order`.
- Ordering by `author`, `date`, `id`, `modified`, `relevance`, `slug`, `title`, `view_count`, `like_count`, or `download_count`.
- Publication and modification date ranges.
- Include/exclude filters for IDs and authors.
- Include/exclude taxonomy filters for categories, tags, licenses, platforms, targets, and states.
- Filtering by slug and UID.
- `AND` or `OR` relationships between taxonomy filters.

The collection response includes enough information for result cards: title, excerpt, artwork thumbnail, revision, author, publication/update dates, comments, views, likes, downloads, categories, tags, platform, targets, and state.

PatchStorage exposes collection totals through `X-WP-Total` and `X-WP-TotalPages`. A live ZOIA query reported 1,513 patches when checked.

Live requests confirmed that descending `download_count`, `like_count`, and `view_count` ordering produces correctly ordered ZOIA results. These are server-side sorts; the web editor does not need to download the whole catalog and sort locally.

## Patch details and downloads

`GET /api/beta/patches/{id}` adds the full description, attached files, preview URL, source-code URL, and license. Each file describes its ID, filename, size, target, and download URL.

`GET /api/beta/patches/{id}/files/{file_id}/download` downloads one attached file. ZOIA platform `3003` currently declares `bin` and `zip` as supported extensions. A live `.bin` download returned `application/octet-stream`, its filename through `Content-Disposition`, and wildcard CORS permission.

The collection response does not include attached files, so the browser must retrieve patch details before deciding whether a selected patch can be opened directly.

## Taxonomy discovery

Public collection and detail endpoints exist for licenses, categories, tags, platforms, states, and targets. These can populate later filtering controls without hard-coding taxonomy IDs. ZOIA / Euroburo is platform ID `3003`.

## Authenticated operations

The API also exposes token acquisition/validation and create, update, delete, file-upload, and file-delete operations. The pinned Librarian sends bearer tokens for upload/update operations. These operations are outside the agreed browse-and-import MVP.

## Browser access

Live GET and OPTIONS requests from the production origin `https://zoia.eimerreis.de` received CORS permission. PatchStorage also exposes pagination headers to browser JavaScript. Anonymous browsing can therefore be attempted directly from the frontend; a same-origin proxy is not inherently required for the current production origin.

CORS policy is controlled by PatchStorage and could change, so a small frontend TypeScript domain boundary should isolate the integration even though the MVP calls PatchStorage directly.

## Integration boundary

Implement PatchStorage communication entirely in framework-neutral TypeScript. The browser calls PatchStorage directly through a dedicated `src/lib/domain/patch-storage/` public interface that owns transport validation, mapping, queries, and download operations. React consumes that interface; it does not call PatchStorage ad hoc.

Do not reuse `.vendor/zoia_lib/zoia_lib/backend/api.py`, add PatchStorage routes to the Python Hosted Codec, or otherwise couple community browsing to binary conversion. This preserves the intended path toward a fully TypeScript application while keeping the existing Python service limited to the temporary codec responsibility.

## MVP recommendation

Offer keyword search, pagination, and these sort choices:

1. Newest (`date desc`)
2. Recently updated (`modified desc`)
3. Most downloaded (`download_count desc`)
4. Most liked (`like_count desc`)
5. Most viewed (`view_count desc`)

Defer taxonomy filters until usage demonstrates a need. Fetch details only when a result is selected. Enable **Open in Workbench** only when the Patch has exactly one direct `.bin`; ZIP and multiple-file entries link to PatchStorage instead.

After import, retain portable Patch Provenance in a Patch Document extension: PatchStorage ID and URL, original title, author identity, license, and import timestamp. Do not copy volatile engagement counts. Provenance is separate from the embedded binary source and does not imply synchronization or ownership.

Opening a PatchStorage Patch replaces the single current Workbench. If a Patch is already loaded, always require confirmation naming both Patches; precise dirty-state detection and multiple Workbenches are outside MVP scope.

Expose the browser as a **Browse PatchStorage** header action beside **New patch** and **Import patch**. It opens a large responsive modal rather than introducing a new route in the MVP.
