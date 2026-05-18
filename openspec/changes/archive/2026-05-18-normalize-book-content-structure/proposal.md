## Why

`BookContentStructure` currently stores the full table-of-contents tree as a single JSONB blob per book. Any chapter add, rename, move, rating override, or per-node `updatedAt` bump rewrites the entire JSON — paying the full Postgres write-amplification cost (TOAST re-write, no HOT optimization, MVCC dead tuple) on every edit, regardless of how small the change.

Two upcoming requirements break the original "TOC rarely changes; one-shot read" trade-off:

1. We want **per-chapter `updatedAt` surfaced in the TOC** so readers/authors can see what changed recently. With the JSON blob, every chapter content edit would have to rewrite the whole book's JSON to bump a node-level timestamp.
2. The long-tail of works (5k–10k nodes, ~500 KB–2 MB JSON) makes individual edits proportionally expensive: a single chapter rename rewrites 1–2 MB plus its TOAST chunks.

The original "JSON-as-index" pattern was correct for "TOC rarely changes; reads ≫ writes." The new requirements invalidate the first half of that assumption without invalidating the second — we still need very fast reads, but writes must become cheap.

A normalized table with one row per node and LexoRank ordering keys gives us O(1)-per-edit writes while preserving the read cost (a single indexed range scan + server-side tree assembly is the same order of magnitude as fetching a TOAST'd JSON row).

## What Changes

- Replace `BookContentStructure.nodes` JSONB column with a normalized `BookContentStructureNode` table — one row per TOC node. Each row carries `parentId` (self-FK, NULL = root), LexoRank `sortKey`, denormalized `title`, `noContent`, optional `rating`, optional `chapterUnitId`, and per-row `createdAt`/`updatedAt`.
- Sibling ordering uses **LexoRank** fractional sortKey: insert / move / reorder are always 1-row writes.
- Server assembles rows into the same nested `ChapterTreeItem[]` wire shape returned today — **API contract unchanged**.
- Add two optional fields on `ChapterTreeItem` (additive, non-breaking): `id?: string` (the `BookContentStructureNode.id`, for clean per-node identity on batch saves) and `updatedAt?: Date | string` (so clients can render per-node "last updated" metadata).
- When a `Chapter` (Post) is edited, the corresponding `BookContentStructureNode.updatedAt` is bumped via a single-row update.
- Materialization API continues to accept `BookContentStructurePath` (number array) on the wire; the server resolves path → node id internally each call. Stale-path rejection semantics preserved.
- `BookContentStructure` row remains as a per-book container holding only `bookUnitId`, `createdAt`, and `updatedAt` (structure-shape changes only — TOC reorder/insert/delete; **not** per-chapter content edits).
- One-time migration: every existing `BookContentStructure.nodes` JSON is flattened into `BookContentStructureNode` rows, sibling order preserved via LexoRank generation; `nodes` JSON column dropped at the end of the migration.
- **BREAKING (internal/server only)**: All server code reading `bookContentStructure.nodes` switches to row queries. Affected files: `book.service.ts`, `chapter.service.ts`, `book-content-structure.ts`, `factory/books.ts`, `seed/database.ts`. No public API breaks.

## Capabilities

### New Capabilities

<!-- None — this is a re-implementation of an existing capability surface. -->

### Modified Capabilities

- `type-extension-book`: Replace the JSON-storage requirements for `BookContentStructure` with normalized-row requirements; preserve frontend write/resync semantics; add per-row `updatedAt` and LexoRank ordering rules; update materialization addressing to be path-resolved server-side.

## Impact

**Affected packages**

- `package/server` — Prisma schema (new `BookContentStructureNode` model, drop `BookContentStructure.nodes` column), `book/book-content-structure.ts` rewrite, `book/book.service.ts` (content-structure reads), `chapter/chapter.service.ts` (materialization + denorm sync), `prisma/factory/books.ts`, `prisma/seed/database.ts`, new migration scripts, new LexoRank utility.
- `package/contract` — `ChapterTreeItem` gains optional `updatedAt: Date | string`; `BookContentStructureResponse` shape unchanged.
- `package/app` — no contract breakage; TOC editor (`ChapterTreeEditor`, `ContentChapterVirtualTree`) and chapter list page may opt-in to render `updatedAt` per node.
- `package/api` — query and mutation client surfaces unchanged.

**Data**

- One-time migration: each `BookContentStructure` row produces N `BookContentStructureNode` rows. Migration is non-destructive until validated; the legacy `nodes` column is dropped in a follow-up Prisma migration after parity is verified.

**Backward compatibility**

- Wire format unchanged for clients. Path-based addressing preserved for materialization. Optional new `updatedAt` per node is additive.

**Risks**

- Migration correctness for 5k–10k-node books — covered by a verification script that round-trips JSON → rows → assembled tree and compares to original.
- Tree-assembly latency for the 10k-node tail must be benchmarked under realistic LRU-cache conditions.
- LexoRank rebalancing (long-tail "insert-between-same-pair" pattern) — accepted as out-of-scope for v1; rebalance logic deferred until measured.
