## Context

BookIndex is the table-of-contents aggregate for a Book. The current contract says each BookIndex node has an `id` and treats that value as the chapter Unit id. That forces every imported chapter entry to look like a materialized platform Unit, even when the platform only knows inline metadata such as a crawled title and position.

At the intended catalog scale, pre-creating a `Unit`, `Post(kind=CHAPTER)`, `UnitTranslation`, indexes, search projections, and future engagement rows for every chapter entry would turn unused metadata into a large operational cost. The target model keeps imported chapter metadata in BookIndex JSON and creates platform Units only when an interaction needs Unit identity.

Current integration points:

- `package/contract/src/book.ts` defines `bookIndexNodeSchema` and `ChapterTreeItem`.
- `package/server/prisma/schema.prisma` stores `BookIndex.index` as JSON and models materialized chapters as `Unit(type=POST)` + `Post(kind=CHAPTER)`.
- `package/server/src/book/book.service.ts` creates a BookIndex row when a Book is created and updates the JSON as opaque content.
- `package/server/src/chapter/` creates and reads materialized chapter Posts.
- `package/server/src/progress/` requires a real Unit for `UserUnitProgress(unitId)` and currently stores `lastPosition` as an opaque string.
- `package/app` reader, TOC, progress, review, and discussion flows currently assume a clickable chapter has a chapter id.

## Goals / Non-Goals

**Goals:**

- Make BookIndex node identity explicit: path locates a node occurrence; `chapterUnitId` locates a materialized platform Unit.
- Avoid pre-creating empty Chapter Units for imported/crawled chapter metadata.
- Support path-addressed empty chapter surfaces without creating database objects.
- Materialize a Chapter Unit atomically when an action requires Unit identity.
- Store book-level reading position as typed JSON on the book Unit progress row without materializing an empty chapter.
- Preserve existing materialized chapter URLs and records.
- Document dev-stage migration behavior for legacy `id`-based BookIndex JSON and string progress positions.

**Non-Goals:**

- Introduce event-sourced BookIndex history.
- Normalize every BookIndex node into a relational table.
- Change the `UserUnitProgress` primary key model.
- Change how materialized chapter body content is stored once a chapter exists.
- Guarantee that path locators remain stable after TOC edits.

## Decisions

### D1 — Remove BookIndex node `id`; use path as the occurrence locator

BookIndex nodes SHALL not carry a required local id. The locator for an unmaterialized node is its path in the current forest, e.g. `[2, 4, 0]`.

Rationale: a local id duplicates path semantics for the current JSON aggregate and creates an identity that is neither global nor durable. Removing it keeps imported BookIndex JSON smaller and avoids confusing it with Unit identity.

Alternatives considered:

- Keep `id` as a local occurrence id. Rejected because path already locates an occurrence and the id would still need migration/repair when imported data lacks stable ids.
- Keep `id` as Unit id. Rejected because it forces eager materialization and cannot represent repeated use of the same chapter Unit in dynamic-route books.

### D2 — `chapterUnitId` is optional and non-unique

`chapterUnitId` SHALL be present only when a BookIndex node has been linked to a materialized Chapter Unit. It SHALL not be required and SHALL not be globally or locally unique inside the BookIndex JSON.

Rationale: dynamic-route or reused-content structures may show the same materialized chapter in multiple paths. The occurrence and the Unit are different identities.

### D3 — Materialization is an explicit server operation

The server should expose a chapter materialization operation addressed by `bookUnitId` and `path`. The operation reads the current BookIndex, validates the path, returns the existing `chapterUnitId` if present, or creates a `Unit(type=POST)` + `Post(kind=CHAPTER)` + `UnitTranslation` and writes the new `chapterUnitId` back to that path.

The materialization transaction should lock or otherwise serialize updates to the relevant BookIndex row. Stale clients should pass an expected title and/or BookIndex `updatedAt`; if the path no longer resolves to the expected node, the operation should reject with a conflict response and return enough information for the client to refetch.

Alternatives considered:

- Let the frontend create a chapter then update BookIndex separately. Rejected because it creates orphaned chapters or duplicate materialization under retry/concurrency.
- Materialize on first click. Rejected because viewing an empty chapter page does not require Unit identity and would still create many unused rows.
- Add a relational `BookIndexNode` table immediately. Deferred because JSON parsing/writing is acceptable for the first materialization path and the table adds migration complexity.

### D4 — Empty chapter surfaces are path-addressed

The frontend should support a URL or search-param form that can address an unmaterialized BookIndex node by `bookUnitId` and path. Opening that surface shows TOC metadata and available actions. It does not create a Chapter Unit until the user performs a chapter-specific action.

Materialized chapters may continue using existing chapter-unit routes. After materialization, the client can replace the path-addressed location with the `chapterUnitId` route.

### D5 — Progress separates book-level position from chapter-level identity

`UserUnitProgress.lastPosition` SHALL be typed JSON rather than an opaque string. The progress row remains keyed by `(userId, unitId)`, but each Unit type may define its own last-position shape.

For book Unit progress, the first supported position shape is:

```json
{
  "kind": "bookIndexPath",
  "bookUnitId": "book-unit-id",
  "path": [2, 4, 0],
  "chapterUnitId": "chapter-unit-id-if-already-materialized"
}
```

This records "where the user last was in this book" without materializing a chapter. `chapterUnitId` is optional and SHALL only be included when the selected BookIndex occurrence is already materialized.

For chapter Unit progress, the first supported position shape is:

```json
{
  "kind": "chapter",
  "chapterUnitId": "chapter-unit-id",
  "offset": 0.42
}
```

Chapter-specific progress requires a chapter Unit and should trigger materialization first. The existing `UserUnitProgress(userId, unitId)` schema remains unchanged.

Rationale: string encoding is only simpler when position is fully opaque. Book, chapter, media, and future Unit types need different schemas. JSON keeps those schemas explicit and avoids ad hoc string parsing. The payload is small and not on a hot indexed query path, so the correctness and evolvability benefits outweigh the minor JSONB storage/serialization cost.

### D5a — Explicit chapter-scoped actions materialize; browsing does not

TOC display and opening a path-addressed empty chapter page SHALL NOT materialize a chapter Unit. Explicit chapter-scoped actions SHALL materialize first when the selected occurrence has no `chapterUnitId`:

- chapter-specific progress
- chapter review
- chapter discussion or reply composer
- chapter content edit

Frontend code should centralize this as a shared helper or hook that accepts `(bookUnitId, path, expectedTitle, chapterUnitId?)`, returns the existing `chapterUnitId` when present, and otherwise calls the materialization API.

Book-level reading status and last-read position SHALL NOT materialize. They update the book Unit's progress row and store the BookIndex path in JSON `lastPosition`.

### D6 — Rating behavior distinguishes inline intent from materialized cache

For unmaterialized nodes, `rating` is inline BookIndex metadata and can serve as the intended initial rating if the node is later materialized. For materialized nodes, `rating` remains a denormalized cache of the chapter Unit rating when it differs from the parent Book rating.

The TOC editor must not materialize nodes only to apply a rating override.

## Risks / Trade-offs

- Path locators are unstable after TOC edits → materialization requests include expected node data and reject stale paths with a conflict response.
- Large BookIndex JSON rows may make materialization slower for books with very large TOCs → keep materialization rare; later introduce a `BookIndexMaterialization` side table or event-sourced BookIndex if profiling shows JSON rewrite cost is too high.
- Concurrent materialization of the same path may create duplicates → serialize materialization per BookIndex row in a transaction and re-check the node after acquiring the lock.
- Allowing non-unique `chapterUnitId` can confuse UI selection state → UI state must key occurrence-specific interactions by path and Unit-specific engagement by `chapterUnitId`.
- JSON `lastPosition` is slightly heavier than a string → acceptable because positions are small, typed, and not expected to be queried as a high-cardinality hot path.
- Dev-stage migration intentionally drops legacy string `lastPosition` values and unmapped BookIndex ids → acceptable because compatibility is explicitly out of scope at this stage.

## Migration Plan

1. Update contract schemas and JSDoc to define BookIndex nodes without `id`, with optional non-unique `chapterUnitId`, path locators, and rating semantics.
2. Normalize BookIndex creation so new books start with `index = []`.
3. Add server-side helpers to parse, locate, and update BookIndex nodes by path.
4. Add the materialization service/API and make it idempotent for already-linked paths.
5. Update frontend TOC and reader flows to use path-addressed empty chapter routes before materialization.
6. Convert `UserUnitProgress.lastPosition` from `TEXT` to JSON and update the progress contract/API/server/frontend types.
7. Update book-level progress to store `{ kind: "bookIndexPath", bookUnitId, path, chapterUnitId? }` on the book Unit without materialization.
8. Add a shared frontend materialize-before-action helper and update chapter-specific progress, review, discussion, and content-edit flows to use it.
9. Migrate existing BookIndex JSON from `id` to `chapterUnitId` where the value references an existing chapter Unit, remove all legacy `id` fields, and drop unmapped ids.
10. Remove or narrow legacy compatibility paths so new code does not preserve `id` metadata.
11. Add validation/tests that reject new required node `id` assumptions and string `lastPosition` assumptions.

Rollback strategy for the dev stage: no compatibility guarantee is provided for legacy BookIndex `id` or string `lastPosition`. Existing materialized chapter Units remain valid. If a rollback is needed, `chapterUnitId` values can be used to re-link materialized chapters, but old clients should not be supported as part of this change.

## Open Questions

- Should materialization require a `kind`/intent value such as `progress`, `review`, `discussion`, or `content` for audit and analytics?
- Should very large imported books get a side-table index immediately, or should that wait for profiling after JSON-based materialization lands?
