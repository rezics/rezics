## 1. Contract and Type Model

- [ ] 1.1 Update `package/contract/src/book.ts` so BookIndex nodes no longer require `id`, add optional `chapterUnitId`, make `noContent` optional if needed, and document path locator semantics with JSDoc.
- [ ] 1.2 Add or update contract tests that accept unmaterialized nodes, materialized nodes, repeated `chapterUnitId` values, and `index = []`.
- [ ] 1.3 Search the repo for `ChapterTreeItem.id`, `bookIndexNodeSchema`, and chapter tree `idAccessor` assumptions; list every call site that must migrate to path or `chapterUnitId`.
- [ ] 1.4 Update shared API types in `package/api/src/book/` and `package/api/src/chapter/` so BookIndex responses and mutations use the new contract shape.

## 2. Server BookIndex Behavior

- [ ] 2.1 Change book creation in `package/server/src/book/book.service.ts` to create `BookIndex.index = []` instead of `{}`.
- [ ] 2.2 Add server-side BookIndex helper functions for path parsing, path validation, node lookup, and immutable node update.
- [ ] 2.3 Add BookIndex normalization for legacy nodes: map legacy `id` to `chapterUnitId` only when it references an existing materialized Chapter Unit; otherwise drop or preserve it only as non-identity compatibility metadata.
- [ ] 2.4 Update BookIndex save/update validation so new writes do not require node `id` and do not enforce uniqueness of `chapterUnitId`.
- [ ] 2.5 Add targeted server tests for empty indexes, path lookup, repeated `chapterUnitId`, legacy id normalization, and invalid/stale paths.

## 3. Chapter Materialization API

- [ ] 3.1 Add contract schemas for chapter materialization request/response, including `path`, optional expected node metadata, and returned `chapterUnitId`.
- [ ] 3.2 Add a server service method that materializes by `(bookUnitId, path)` inside a transaction, re-checks the node after locking, and returns an existing `chapterUnitId` idempotently.
- [ ] 3.3 Ensure materialization creates `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` using the BookIndex title and inline rating seed.
- [ ] 3.4 Expose the materialization endpoint from the book or chapter API with authentication, permission checks, conflict errors for stale paths, and no duplicate creation under concurrent requests.
- [ ] 3.5 Add API client mutation helpers in `package/api` and invalidate affected BookIndex/chapter queries after successful materialization.
- [ ] 3.6 Add server tests for materialization success, already-materialized return, stale path conflict, permission failure, inline rating seed, and concurrent duplicate prevention.

## 4. Frontend Reader and Engagement Flows

- [ ] 4.1 Define the empty chapter URL/search-param encoding for `(bookUnitId, path)` and update route helpers accordingly.
- [ ] 4.2 Update TOC renderers in `package/app/src/book-library/components/Chapter/` so unmaterialized nodes link to the empty chapter surface and materialized nodes link to existing chapter routes.
- [ ] 4.3 Update the reader page to render empty chapter metadata without fetching `chapterDetailQuery` when only a path locator is present.
- [ ] 4.4 Update book-level progress actions to store the current BookIndex path in the book Unit progress row's `lastPosition` without materializing a chapter.
- [ ] 4.5 Update chapter-specific progress, review, discussion, and content-edit entry points to call materialization first when the selected node has no `chapterUnitId`.
- [ ] 4.6 Update UI copy and empty states so users see chapter/review/discussion actions, not internal "create Unit" terminology.

## 5. TOC Editor Updates

- [ ] 5.1 Update `package/app/src/book-edit` chapter tree types and arborist integration so node occurrence state uses generated path/accessor state instead of persisted node `id`.
- [ ] 5.2 Update create/edit/move/delete flows to preserve nodes without `chapterUnitId` and to avoid generating persisted local ids.
- [ ] 5.3 Update rating serialization so unmaterialized nodes can store inline `rating` without triggering materialization.
- [ ] 5.4 Update resync overrides so it fetches materialized chapter ratings, skips unmaterialized nodes, and strips redundant inline ratings when safe.
- [ ] 5.5 Update batch rating edit so materialized selections update `Unit.rating`, unmaterialized selections update inline BookIndex `rating`, and no selected node is materialized only for rating.
- [ ] 5.6 Add focused frontend tests or stories for mixed TOCs containing groups, unmaterialized entries, materialized entries, and repeated `chapterUnitId` values.

## 6. Migration and Compatibility

- [ ] 6.1 Add a one-shot migration or admin script that rewrites existing BookIndex JSON from `id` to `chapterUnitId` where possible.
- [ ] 6.2 Add compatibility read normalization during rollout so existing rows with legacy `id` can still render while migration is incomplete.
- [ ] 6.3 Add compatibility write protection so legacy clients cannot reintroduce required `id` fields after the server has normalized a BookIndex.
- [ ] 6.4 Document rollback behavior: materialized chapter Units remain valid, and a compatibility adapter can expose `id = chapterUnitId` to old code if needed.

## 7. Validation

- [ ] 7.1 Run targeted contract tests for `package/contract/src/book.ts` and materialization schemas.
- [ ] 7.2 Run targeted server tests for book/chapter/materialization behavior.
- [ ] 7.3 Run targeted frontend tests or type checks for book-library and book-edit chapter flows.
- [ ] 7.4 Run `rg` checks to confirm no production code still treats BookIndex node `id` as required or as a chapter Unit id.
- [ ] 7.5 Run the appropriate package build/typecheck commands for changed packages before marking implementation complete.
