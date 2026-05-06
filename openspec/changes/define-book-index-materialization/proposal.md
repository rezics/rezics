## Why

BookIndex currently conflates a table-of-contents node with a materialized Chapter Unit by treating node `id` as the chapter Unit id. That model does not scale for an infrastructure-sized catalog where imported books may have millions or billions of chapter entries, most of which will never receive content, progress, reviews, or discussion.

We need to make the BookIndex schema explicit before further chapter, review, and progress work builds on the wrong identity model.

## What Changes

- **BREAKING**: BookIndex nodes no longer use or require an `id` field.
- BookIndex node location is represented by its path within the BookIndex forest, such as `[2, 4, 0]`. The path is a locator for an occurrence, not a permanent global identity.
- BookIndex nodes may carry an optional `chapterUnitId` field when a real Chapter Unit has been materialized.
- `chapterUnitId` is not unique within a single BookIndex. Multiple BookIndex node occurrences may reference the same materialized chapter Unit for dynamic-route or reused-content cases.
- Imported or crawled chapter entries remain inline BookIndex metadata by default. The system does not pre-create empty Unit/Post/UnitTranslation rows for every chapter entry.
- Chapter Units are materialized on demand when an action requires Unit identity, such as chapter-specific progress, review, discussion, or storing licensed chapter body content.
- Plain TOC display and empty chapter viewing do not require materialization.
- Book-level reading progress may store the selected chapter path in `UserUnitProgress.lastPosition` on the book Unit without creating a chapter Unit.
- The contract schemas, JSDoc comments, server validation, and frontend chapter flows will be updated to reflect these identity rules.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `type-extension-book`: Clarify BookIndex node schema, remove node `id`, add optional non-unique `chapterUnitId`, define path-based node locators, and specify on-demand chapter materialization behavior.
- `type-extension-post`: Clarify that chapter Posts remain materialized chapter content/discussion units, while BookIndex may contain unmaterialized chapter entries that do not yet have a Post/Unit.

## Impact

### Affected Packages

- `package/contract` — Update BookIndex node schemas and TypeScript interfaces in `book.ts`, including JSDoc comments that define path locator semantics and `chapterUnitId` behavior.
- `package/server` — Update BookIndex defaults, read/write validation, chapter materialization API/service behavior, and any BookIndex update path that currently assumes every node has a chapter Unit id.
- `package/api` — Add or adjust client functions and query/mutation helpers for chapter materialization if the server exposes a dedicated endpoint.
- `package/app` — Update book content, reader, progress, review, discussion, and chapter editor flows so they can operate on path-located empty chapter nodes and materialize only when needed.
- `openspec` — Update the BookIndex requirements so future work does not reintroduce required per-node Unit ids.

### Backward Compatibility

- Existing BookIndex JSON that uses `id` as a chapter Unit id needs migration or compatibility normalization. The migration should map `id` to `chapterUnitId` when it references an existing Chapter Unit, then remove `id` from persisted nodes.
- Existing URLs of the form `/book/:bookId/read/:chapterId` continue to work for materialized chapters. Empty BookIndex nodes need a path-addressed URL or search parameter form until materialized.
- Existing chapter Unit, review, discussion, and progress records remain valid. This change only prevents pre-creating unused chapter Units and clarifies how new empty nodes become materialized.

### Migration Needs

- Convert BookIndex rows whose nodes contain `id` to the new schema.
- Normalize empty or missing BookIndex rows to `index = []`.
- Add compatibility handling during rollout so old frontend clients do not corrupt BookIndex JSON by writing required `id` fields back into the new schema.
