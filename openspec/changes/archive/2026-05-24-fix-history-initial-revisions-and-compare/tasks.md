## 1. Editorial Path Scope and Payload Semantics

- [x] 1.1 Define `editorialPathScope` per content type (Book, Entity, wiki post) as a shared module referenced by create writers, edit writers, and chip derivation.
- [x] 1.2 Add focused tests asserting that the same content state, reached either by creation or by edits from empty, produces identical editorial leaf path sets.
- [x] 1.3 Add focused tests for Book translation title-only edits proving the history outbox payload contains only `translations.<language>.title`.
- [x] 1.4 Update `package/server/src/unit/translation.service.ts` to build an effective translation history patch from actual changed fields instead of storing the submitted patch body unchanged. Reuse `mapActualTranslationPatchPaths` to drive payload construction.
- [x] 1.5 Add tests for unchanged translation submissions proving no `HistoryOutbox` row is written.
- [x] 1.6 Audit Book metadata (`book.service.ts:409`) and Entity metadata (`entity.service.ts:235`) update writers for the same raw-submission vs effective-patch issue and add focused tests for any affected path.

## 2. Initial Creation Revisions

- [x] 2.1 Add Book create service tests proving wiki and personal creation write one initial editorial `HistoryOutbox` row in the create transaction, with the creating user as actor (even when ownership goes to `rezicsWikiUser.unitId`).
- [x] 2.2 Refactor `book.service.ts` `create()` to run inside `prisma.$transaction` and implement initial history payload construction covering the Book `editorialPathScope` projection of the create input.
- [x] 2.3 Add Entity create service tests proving wiki and personal creation write one initial editorial `HistoryOutbox` row with the creator as actor.
- [x] 2.4 Implement Entity initial history payload construction in `entity.service.ts` covering the Entity `editorialPathScope` projection.
- [x] 2.5 Add a regression test proving existing wiki post creation still writes its initial history revision and that its emitted paths fit the wiki-post `editorialPathScope`.
- [x] 2.6 Confirm normal replies, tag-governance writes, reactions, user creation, and generic Unit creation remain outside editorial content history.

## 3. History Service Path Snapshot Index

- [x] 3.1 Add a `UnitRevisionPath` table in `package/history` with columns `(unit_id, sequence, path, value, revision_id)`, primary key `(unit_id, sequence, path)`, and composite index `(unit_id, path, sequence DESC)`.
- [x] 3.2 Implement a shared leaf-explosion helper that walks an editorial PATCH payload and emits one entry per leaf path, following the rule: explode nested objects, terminate at scalars and at arrays (arrays kept as whole values).
- [x] 3.3 Wire outbox ingest to upsert `UnitRevisionPath` rows for every editorial revision in the same DB transaction as `UnitRevision` insert.
- [x] 3.4 Add idempotency / re-ingest tests covering duplicate outbox delivery.
- [x] 3.5 Implement a backfill migration that walks every existing `UnitRevision` (pre-cutover slot-shaped and post-cutover PATCH-shaped) and populates `UnitRevisionPath` using the same leaf-explosion helper.
- [x] 3.6 Add focused tests covering legacy slots-shaped revision projection into the path index.
- [x] 3.7 Update `changedFieldKeys` derivation to read from `UnitRevisionPath` instead of re-walking the payload at read time. Pre-cutover revisions keep using `legacyChangedKeys` as already specified.

## 4. Path-Snapshot Compare Reconstruction

- [x] 4.1 Add a history service API that, given `(unitId, baseSequence, targetSequence)`, returns the candidate path set and the latest-value-at-or-before each endpoint per path (Approach A: range-union).
- [x] 4.2 Implement the API with two queries: a range-union `SELECT DISTINCT path` over `(base, target]`, then per-endpoint `SELECT DISTINCT ON (path)` filtered by the candidate set.
- [x] 4.3 Add API tests for adjacent compare, non-adjacent compare with range-internal changes, missing initial revision (null base value), and same-revision compare (empty result).
- [x] 4.4 Add performance tests asserting the API stays sub-50ms for synthetic histories with thousands of revisions per unit.
- [x] 4.5 Add types for the API in `@rezics/contract` and a typed accessor in `@rezics/api`.

## 5. App Compare Integration

- [x] 5.1 Update `package/app/src/book-library/models/historyCompare.ts` to consume the new path-snapshot compare response instead of folding payloads locally. Delete the array-only `compareTranslations` path; the API delivers normalized per-path values.
- [x] 5.2 Add model tests for the new compare entry point covering title-only edit, non-adjacent compare, additive (null base) rendering, and no-changes empty state.
- [x] 5.3 Update `BookRevisionComparePage` to call the path-snapshot compare API and feed its response into the compare model.
- [x] 5.4 Ensure the changed-field nav renders no unchanged translation chips for title-only edits.
- [x] 5.5 Keep the no-changes empty state only when the API returns no differing paths.
- [x] 5.6 Preserve existing unified/split compare mode behavior and accessibility labels.

## 6. Verification

- [x] 6.1 Run targeted server tests for translation history, Book creation, Entity creation, and wiki post creation.
- [x] 6.2 Run targeted history service tests for ingest, backfill, and the compare API.
- [x] 6.3 Run targeted app model tests for history compare.
- [x] 6.4 Run `bun run check:convention`.
- [ ] 6.5 Manually verify a new Book shows an initial history revision after ingestion.
- [ ] 6.6 Manually verify a Book title-only edit shows one timeline chip and one compare diff for the title.
- [ ] 6.7 Manually verify a non-adjacent Book compare correctly reports range-internal changes.
