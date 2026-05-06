## 1. Contract and Type Model

- [x] 1.1 Update `package/contract/src/book.ts` so BookIndex nodes no longer require `id`, add optional `chapterUnitId`, make `noContent` optional if needed, and document path locator semantics with JSDoc.
- [x] 1.2 Add or update contract tests that accept unmaterialized nodes, materialized nodes, repeated `chapterUnitId` values, and `index = []`.
- [x] 1.3 Search the repo for `ChapterTreeItem.id`, `bookIndexNodeSchema`, and chapter tree `idAccessor` assumptions; list every call site that must migrate to path or `chapterUnitId`.
- [x] 1.4 Update shared API types in `package/api/src/book/` and `package/api/src/chapter/` so BookIndex responses and mutations use the new contract shape.

## 2. Server BookIndex Behavior

- [x] 2.1 Change book creation in `package/server/src/book/book.service.ts` to create `BookIndex.index = []` instead of `{}`.
- [x] 2.2 Add server-side BookIndex helper functions for path parsing, path validation, node lookup, and immutable node update.
- [x] 2.3 Add BookIndex normalization for legacy nodes: map legacy `id` to `chapterUnitId` only when it references an existing materialized Chapter Unit. This was added during the compatibility-oriented draft; see 6.2 for the follow-up to remove or narrow legacy metadata preservation for the dev-stage model.
- [x] 2.4 Update BookIndex save/update validation so new writes do not require node `id` and do not enforce uniqueness of `chapterUnitId`.
- [x] 2.5 Add targeted server tests for empty indexes, path lookup, repeated `chapterUnitId`, legacy id normalization, and invalid/stale paths.

## 3. Chapter Materialization API

- [x] 3.1 Add contract schemas for chapter materialization request/response, including `path`, optional expected node metadata, and returned `chapterUnitId`.
- [x] 3.2 Add a server service method that materializes by `(bookUnitId, path)` inside a transaction, re-checks the node after locking, and returns an existing `chapterUnitId` idempotently.
- [x] 3.3 Ensure materialization creates `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` using the BookIndex title and inline rating seed.
- [x] 3.4 Expose the materialization endpoint from the book or chapter API with authentication, permission checks, conflict errors for stale paths, and no duplicate creation under concurrent requests.
- [x] 3.5 Add API client mutation helpers in `package/api` and invalidate affected BookIndex/chapter queries after successful materialization.
- [x] 3.6 Add server tests for materialization success, already-materialized return, stale path conflict, permission failure, inline rating seed, and concurrent duplicate prevention.

## 4. Frontend Reader and Engagement Flows

- [x] 4.1 Define the empty chapter URL/search-param encoding for `(bookUnitId, path)` and update route helpers accordingly.
- [x] 4.2 Update TOC renderers in `package/app/src/book-library/components/Chapter/` so unmaterialized nodes link to the empty chapter surface and materialized nodes link to existing chapter routes.
- [x] 4.3 Update the reader page to render empty chapter metadata without fetching `chapterDetailQuery` when only a path locator is present.
- [x] 4.4 Convert `UserUnitProgress.lastPosition` from opaque string to typed JSON in `package/server/prisma/schema.prisma`, `package/contract/src/progress.ts`, `package/server/src/progress/`, and `package/api/src/progress/`.
- [x] 4.5 Define progress last-position contract variants, starting with `{ kind: "bookIndexPath"; bookUnitId; path; chapterUnitId? }` for book-level reading position and `{ kind: "chapter"; chapterUnitId; offset? }` for chapter-scoped position.
- [x] 4.6 Add a dev-stage migration that changes `UserUnitProgress.lastPosition` from `TEXT` to `JSONB` without preserving old string values.
- [x] 4.7 Update reader/book-level progress actions to store the current BookIndex path in the book Unit progress row's JSON `lastPosition` without materializing a chapter; include `chapterUnitId` only when the selected BookIndex node already has one.
- [x] 4.8 Add a shared frontend helper/hook that resolves a selected BookIndex occurrence to a chapter Unit: return existing `chapterUnitId`, otherwise call materialization with `(bookUnitId, path, expectedTitle)`.
- [x] 4.9 Update chapter-specific progress, review, discussion, and content-edit entry points to use the shared materialize-before-action helper when the selected node has no `chapterUnitId`.
- [x] 4.10 Keep TOC display and empty chapter page load non-materializing; only explicit chapter-scoped actions may materialize.
- [x] 4.11 Update UI copy and empty states so users see chapter/review/discussion/content actions, not internal "create Unit" terminology.

## 5. TOC Editor Updates

- [x] 5.1 Update `package/app/src/book-edit` chapter tree types and arborist integration so node occurrence state uses generated path/accessor state instead of persisted node `id`.
- [x] 5.2 Update create/edit/move/delete flows to preserve nodes without `chapterUnitId` and to avoid generating persisted local ids.
- [x] 5.3 Update rating serialization so unmaterialized nodes can store inline `rating` without triggering materialization.
- [x] 5.4 Update resync overrides so it fetches materialized chapter ratings, skips unmaterialized nodes, and strips redundant inline ratings when safe.
- [x] 5.5 Update batch rating edit so materialized selections update `Unit.rating`, unmaterialized selections update inline BookIndex `rating`, and no selected node is materialized only for rating.
- [x] 5.6 Add focused frontend tests or stories for mixed TOCs containing groups, unmaterialized entries, materialized entries, and repeated `chapterUnitId` values.

## 6. Dev Migration and Compatibility Cleanup

- [x] 6.1 Add a dev-stage one-shot migration/admin script that rewrites existing BookIndex JSON from `id` to `chapterUnitId` when the value references an existing materialized Chapter Unit, removes every legacy `id`, and drops unmapped ids.
- [x] 6.2 Remove or narrow legacy compatibility paths that are no longer needed after the dev-stage migration; new code should not preserve `id` as compatibility metadata.
- [x] 6.3 Update factory/seed paths that still create BookIndex `index = {}` or legacy `id`-shaped chapter nodes so generated dev data follows the new `index = []` / `chapterUnitId?` model.
- [x] 6.4 Document dev-stage rollback behavior: no compatibility guarantee for legacy BookIndex `id` or string `lastPosition`; materialized chapter Units remain valid and can be re-linked from `chapterUnitId`.

## 7. Validation

- [x] 7.1 Run targeted contract tests for `package/contract/src/book.ts` and materialization schemas.
- [x] 7.2 Run targeted progress contract/server tests for JSON `lastPosition`.
- [x] 7.3 Run targeted server tests for book/chapter/materialization behavior.
- [x] 7.4 Run targeted frontend tests or type checks for book-library, book-read, review/discussion, and book-edit chapter flows.
- [x] 7.5 Run `rg` checks to confirm no production code still treats BookIndex node `id` as required or as a chapter Unit id.
- [x] 7.6 Run `rg` checks to confirm normal code no longer treats `UserUnitProgress.lastPosition` as a string.
- [x] 7.7 Run the appropriate package build/typecheck commands for changed packages before marking implementation complete.
