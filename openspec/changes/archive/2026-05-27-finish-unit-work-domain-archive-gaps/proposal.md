## Why

`introduce-unit-work-domain` was archived after adding generic
`contentStructure` / `contentUnitId` terminology, but the current backend model
is still book-specific:

- Prisma stores `BookContentStructure(bookUnitId)` and
  `BookContentStructureNode(bookUnitId, chapterUnitId)`.
- Server reads/writes content structure through `book.service.ts`.
- API/query keys still expose `bookUnitId` content-structure boundaries.
- Materialization is hardwired to `BookContentStructure` paths and returns
  `chapterUnitId`.
- Structure history still has `book.contentStructure.batch` and
  `BookContentStructure*` payload names.

That means the terminology changed at the DTO edge, but the promised generic
backend abstraction does not exist. This blocks the already-active game/media
and series changes from using content structure as a shared source of truth.

The same archive also specified durable, previewable, resumable admin work
merge flows. The current implementation creates a durable operation row, but it
still performs canonical membership moves synchronously inside the request
transaction and marks the operation `COMPLETED` before queued repair runs. That
does not satisfy the async/resumable merge requirement for active work domains.

## What Changes

- Introduce a generic backend content-structure domain:
  `ContentStructure(ownerUnitId)` and
  `ContentStructureNode(ownerUnitId, contentUnitId)`.
- Migrate existing book rows from `BookContentStructure` /
  `BookContentStructureNode` to the generic tables while preserving node ids,
  ordering, timestamps, ratings, duplicate content-unit references, and
  `Book.chapterCount` behavior.
- Move generic tree read/write/path/history logic from `book.service.ts` and
  `book-content-structure.ts` into a `content-structure` server domain.
- Keep book/chapter materialization as a book-specific adapter over the generic
  content-structure storage. Book materialization may continue to create
  `Post(kind=CHAPTER)`, but its wire response must expose `contentUnitId` as
  canonical.
- Add contract/API surfaces for generic content structure and keep book-named
  endpoints/types only as documented compatibility shims.
- Update factory/seed/history code to create and report generic content
  structure, while keeping book fixtures working.
- Convert admin work merge execution into a queued/resumable operation instead
  of doing membership migration synchronously in the request path.

## Evidence From Audit

- `package/server/prisma/schema.prisma` still defines
  `BookContentStructure` and `BookContentStructureNode`, with `bookUnitId` and
  `chapterUnitId` columns.
- `package/server/src/book/book.service.ts` owns
  `getContentStructureByBookUnitId()` and `updateContentStructure()`, and writes
  history as `eventType: "book.contentStructure.batch"`.
- `package/server/src/chapter/chapter.service.ts` locks
  `"BookContentStructure"`, resolves `BookContentStructure` paths, writes
  `chapterUnitId`, and returns `ChapterMaterializationResponse.chapterUnitId`.
- `package/contract/src/book.ts`, `package/api/src/book/*`, and
  `package/contract/src/content-history.ts` still publish
  `BookContentStructure*` names as the primary content-structure contract.
- `package/server/src/admin-work-merge/admin-work-merge.service.ts` creates a
  merge operation but performs membership moves and legacy `Unit.workUnitId`
  updates synchronously before returning.

## Impact

- Affected packages:
  - `package/server`: Prisma schema/migrations, new content-structure domain,
    book/chapter adapters, history payload writing, factories/seeds, admin work
    merge job orchestration.
  - `package/contract`: generic content-structure DTOs and compatibility
    aliases; materialization response canonical `contentUnitId`.
  - `package/api`: generic content-structure client/query keys/mutations,
    compatibility book wrappers.
  - `package/app`: content-structure imports/query keys may remain book-facing
    where the UI is book-specific, but underlying DTOs should use generic
    names.
  - `package/job-runner`: queued admin work merge membership migration and
    repair continuation.
  - `package/search`: no new index field is expected, but sync enqueue paths
    must continue to receive content/search repair events after generic
    structure mutations.

## Non-Goals

- Do not redesign LexoRank ordering or the normalized one-row-per-node storage
  strategy.
- Do not make all domains materialize content nodes the same way. Books create
  chapter posts; games/media/series can attach existing Units or use their own
  adapters.
- Do not remove compatibility endpoints in the same change unless every
  callsite is migrated safely.
