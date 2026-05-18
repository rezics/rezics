## Context

`BookContentStructure` today is a 1:1 extension of `Book` with the entire table-of-contents tree serialized into a single `nodes: JSONB` column. Every TOC mutation — chapter add, rename, move, rating override, materialized chapter-id assignment — runs as:

```ts
prisma.bookContentStructure.update({
  where: { bookUnitId },
  data: { nodes: rewrittenJson },
});
```

This rewrites the entire JSON for any change. At 5k–10k nodes (`~500 KB–2 MB` serialized) this incurs:

- Full TOAST re-write on every update (no in-place edit for JSONB > 2 KB)
- No HOT optimization (JSONB indexes don't benefit from heap-only-tuple updates)
- MVCC dead tuple proportional to row size
- WAL volume proportional to row size

Two new requirements break the original "TOC rarely changes; one-shot read" assumption that justified the JSON design:

1. We want per-chapter `updatedAt` surfaced in the TOC UI. With JSON storage, every chapter content edit would force a JSON rewrite to bump a node-level timestamp.
2. The product is expanding toward serialized works (manhua, web novels, textbooks) where the 5k–10k-node tail is no longer rare.

Reads remain ≫ writes and `ChapterTreeItem[]` remains the right shape on the wire. The fix is at the storage layer only.

## Goals / Non-Goals

**Goals**

- Make TOC writes O(1) per logical edit (1 row, not 1 blob).
- Preserve current full-tree read shape (`ChapterTreeItem[]`) and read latency on the order of the current JSON path.
- Make per-node `updatedAt` cheap to maintain so we can surface "last updated chapter" in the UI.
- Keep the public wire contract backward-compatible (additive fields only).
- Cover the 5k–10k-node tail without architectural change.

**Non-Goals**

- Multi-tenant collaborative concurrent editing with CRDTs / OT (out of scope; positional addressing remains single-writer-friendly).
- Server-enforced rating cache rule (still frontend-owned, per existing requirement).
- Sortkey rebalancing automation (deferred; will design when first measured to be needed).
- Materialized-path / closure-table style storage (rejected; see Decisions).
- Per-language node copies (book i18n at node level remains via `chapterUnitId` → `UnitTranslation`).

## Decisions

### D1. Normalized one-row-per-node storage (replaces JSON blob)

```
BookContentStructureNode
─────────────────────────────────────────────────────────────
  id              uuid   PK
  bookUnitId      uuid   FK Book.unitId   (NOT NULL)
  parentId        uuid?  FK self.id       (NULL = root node)
  sortKey         text   NOT NULL          (LexoRank, base36)
  chapterUnitId   uuid?  FK Chapter Unit  (NULL until materialized; non-unique)
  title           text   NOT NULL          (denormalized cache; written by frontend)
  noContent       bool   NOT NULL DEFAULT false
  rating          enum?  (ContentRating override, frontend-managed)
  createdAt       ts     NOT NULL DEFAULT now()
  updatedAt       ts     NOT NULL @updatedAt

  INDEX (bookUnitId, parentId, sortKey)   -- ordered child fetch
  INDEX (chapterUnitId)                   -- reverse lookup chapter → node
  INDEX (bookUnitId, updatedAt DESC)      -- "recently updated" queries
  CASCADE DELETE on bookUnitId
```

`BookContentStructure` row is retained as the per-book container, holding only `bookUnitId` (PK), `createdAt`, `updatedAt`. Its `updatedAt` reflects structure-shape changes (TOC reorder / insert / delete / rename) **only** — not chapter content edits. The `nodes: Json` column is dropped at the end of the migration.

**Rationale.** The JSON blob's "single I/O read" advantage is largely imaginary: a TOAST'd JSONB row is already fetched in many chunks, and a single indexed range scan over N continuous rows costs the same order of magnitude. Normalizing exposes per-node identity, gives us free per-row `updatedAt`, eliminates write amplification, and enables SQL-level filtering (e.g., "20 most recently updated chapters" becomes an `ORDER BY updatedAt DESC LIMIT 20`).

### D2. LexoRank fractional `sortKey` for sibling ordering

Each node has a base36 lexicographic `sortKey`. Sibling order is determined by `ORDER BY sortKey` within a `parentId` group.

Operations:

- **Insert at end of siblings**: `sortKey = between(maxSibling.sortKey, '|')`
- **Insert between A and B**: `sortKey = between(A.sortKey, B.sortKey)`
- **Move single node**: update `parentId` + new `sortKey` (1 row)
- **Move subtree**: update root node's `parentId` + `sortKey` (1 row; descendants follow because the tree is parentId-walked)
- **Reorder one sibling**: update that node's `sortKey` (1 row)

**Why LexoRank over alternatives** (decision recorded after explore):

| | LexoRank (chosen) | Materialized path (PostTree style) | Hybrid |
|---|---|---|---|
| Insert mid | 1 row | O(N siblings) renumber | O(M) recompute path |
| Move subtree | 1 row | O(K descendants) rewrite | O(K) recompute path |
| Reorder | 1 row | O(N) renumber | O(N) recompute |
| Read DFS in SQL | needs server walk | `ORDER BY sortPath` direct | direct (cached) |
| Complexity | medium | medium | high (1.7×) |

The read penalty from server-side walk (~5–10 ms at 10k nodes) is negligible against the request lifecycle (~100–150 ms) and disappears with LRU cache. The write penalty difference at 5k–10k nodes (1 row vs O(N) rows) is material. PostTree's materialized path works there because forum posts are append-dominant; book TOCs see real mid-tree edits and moves.

Hybrid was rejected because the write cost is dominated by the path-recompute step, not the sortKey assignment — it costs almost as much as pure materialized path while doubling implementation complexity.

LexoRank implementation: a small in-repo utility (~100 LoC) generating base36 strings with `between(a, b)`. No external dependency. Bucket-based rebalancing is deferred — the "repeatedly insert between the same pair" pathology that grows sortKey strings is extremely rare in book editing (authors don't insert 50 nodes between the same two siblings).

### D3. Wire contract: `ChapterTreeItem` gains optional `id` and `updatedAt` (additive)

```ts
interface ChapterTreeItem {
  title: string;
  chapterUnitId?: string;
  noContent?: boolean;
  rating?: ContentRating;
  children?: ChapterTreeItem[];
  // NEW:
  id?: string;        // BookContentStructureNode.id — stable node identity
  updatedAt?: string; // per-node last-updated timestamp (ISO 8601)
}
```

- `id` is set on every node returned by reads. On writes, the server uses it to identify existing nodes. Nodes submitted without `id` are treated as new.
- `updatedAt` is set on every node returned by reads. Clients render "last updated" UI from it. On writes the field is ignored (server manages it).
- Both fields are optional in the schema to preserve backward compatibility with any caller that constructs `ChapterTreeItem` without them.

**Rationale for `id` on the wire**: the "save whole TOC tree" UX needs a way to identify which submitted node corresponds to which row. Three alternatives were considered:

1. **Wire id (chosen)** — clean, explicit, additive.
2. **Operation-based API** — frontend issues `{op: 'move', nodeId, ...}` ops. More invasive: frontend logic and API surface both change.
3. **Positional reconciliation** — server diffs old vs new tree by position/chapterUnitId. Heuristic, fragile under concurrent edits.

### D4. Server-side tree assembly preserves the wire shape

```ts
async function getBookContentStructure(bookUnitId): Promise<ChapterTreeItem[]> {
  const rows = await prisma.bookContentStructureNode.findMany({
    where: { bookUnitId },
    orderBy: [{ parentId: 'asc' }, { sortKey: 'asc' }],
  });
  return buildTree(rows); // O(n) Map<parentId, children[]> walk
}
```

`buildTree` runs in O(n) with one pass to bucket children by `parentId` and one recursive walk from roots. For 10k nodes: ~10–15 ms in V8/Bun. LRU cache (keyed by `bookUnitId` + `BookContentStructure.updatedAt`) collapses this to microseconds on hot reads.

### D5. Denormalized `title` / `rating` / `noContent` stay on the node row

These are read on every TOC render. Keeping them on the node row avoids per-render joins on `UnitTranslation` and `Unit.rating`. They are kept in sync by:

- **`title`** — frontend submits updated titles via the TOC save endpoint. Chapter-rename in a chapter-editor UI also bumps `BookContentStructureNode.title` for the matching `chapterUnitId` via the chapter service.
- **`rating`** — frontend-managed per existing requirement (see `type-extension-book` spec, "BookContentStructure cache write rule is frontend-owned"). The cache rule is unchanged; only the storage shape changes.
- **`noContent`** — frontend-managed flag distinguishing pure structural nodes from chapter slots.

### D6. Per-row `updatedAt` propagation from chapter content edits

When a `Chapter` (Post) is edited, its service-layer mutation also runs:

```ts
await prisma.bookContentStructureNode.updateMany({
  where: { chapterUnitId },
  data: { updatedAt: new Date() },
});
```

Cost: one indexed lookup (via `chapterUnitId` index) + N row updates where N is the number of nodes referencing this chapter (almost always 1). The `updateMany` form is required, not optional, because `chapterUnitId` is intentionally non-unique — see D9.

The container `BookContentStructure.updatedAt` is **not** bumped by this — that timestamp tracks structure-shape changes only.

The same `updateMany` pattern applies to chapter **title rename** (when `UnitTranslation.title` for a chapter is updated): the denormalized `title` on every node referencing that chapter is updated in the same transaction. Title rename IS a structure-shape change, so the container `updatedAt` DOES bump (one bump per affected book).

### D9. Multiple nodes may reference the same chapter (first-class)

The previous JSON design technically allowed multiple nodes carrying the same `chapterUnitId` (the field was intentionally non-unique), but the editor flows didn't really exercise it and the propagation paths were implicit. Under the normalized model this becomes a first-class supported pattern, with these guarantees:

- **No DB-level UNIQUE on `chapterUnitId`** — multiple `BookContentStructureNode` rows may share it within or across books.
- **Foreign key behavior**: `ON DELETE SET NULL` on `chapterUnitId`. If a chapter Unit is hard-deleted, every referencing node row's `chapterUnitId` becomes NULL but the row itself survives, becoming an empty placeholder in the TOC (the editor surfaces this as a `noContent`-style entry; recovery is by re-materialization or by manual delete).
- **Diff-based save accepts duplicates**: the TOC editor MAY submit a tree where two nodes carry the same `chapterUnitId`, including the case where one matches an existing row and the other is new. The diff applies all of them.
- **Title and updatedAt propagation use `updateMany`**: any chapter mutation reaches every referencing node in a single indexed query.
- **Materialization does not unlink**: materialization only creates a new chapter if the target node has `chapterUnitId = NULL`. It never removes a `chapterUnitId` from any other node.

Use cases enabled: same preface visible both at top level and inside an appendix; cross-collection TOCs that re-organize a published book; factory/test fixtures that need to verify multi-link semantics without manual SQL.

**Out of scope for this change**: a UI-level "link existing chapter to this path" materialization variant. The current materialization API stays create-only. If product wants the link operation later it becomes an additive endpoint, no schema change required.

### D7. Materialization keeps path-based addressing on the wire

`POST /books/:bookUnitId/chapters/materialize` continues to accept `{ path: number[], expectedTitle?, expectedBookContentStructureUpdatedAt? }`. The server resolves `path` → `nodeId` by walking child rows in `sortKey` order at each level, then operates on the row. Stale-path semantics preserved: if the resolved node's title doesn't match `expectedTitle` or the container `updatedAt` doesn't match, reject with conflict and no Unit/Post is created.

This keeps every existing client and stored progress record working. Future iterations may add a direct `{ nodeId }` form alongside.

### D8. Single-transaction batch save for the TOC editor

The TOC editor's "save whole tree" operation (the current frontend UX) is preserved:

```
PUT /books/:bookUnitId/content-structure
body: { nodes: ChapterTreeItem[] }   // tree, with id on existing nodes
```

Server implementation:

1. Walk the submitted tree, collect `(id, parentId, sortKey, title, ...)` triples.
2. Diff against current rows:
   - Submitted node with `id` → UPDATE if any field changed.
   - Submitted node without `id` → INSERT (new node).
   - Existing row whose id is not in the submission → DELETE.
3. Run all mutations in a single Prisma transaction.
4. Bump `BookContentStructure.updatedAt`.

For a no-op save (no changes), zero row mutations are issued. For a single chapter rename, exactly one UPDATE.

## Risks / Trade-offs

**Migration correctness for the long-tail 5k–10k books** → Mitigation: a non-destructive migration that writes the new rows first, then runs a verification pass (re-read rows → assemble tree → compare against the original JSON node-for-node) before dropping the legacy `nodes` column.

**Tree-assembly latency at the 10k tail** → Mitigation: benchmark with realistic data before merging the read path; add LRU cache keyed by `(bookUnitId, BookContentStructure.updatedAt)` if the uncached cost exceeds the JSON path's cost.

**LexoRank string drift** (insert-between-same-pair pathology) → Accepted as theoretical for v1. Real book editing patterns don't trigger it. Monitoring tip: if any `sortKey` exceeds 32 chars, alert and schedule rebalance.

**Wire id added to `ChapterTreeItem`** → Additive only, fully backward compatible. Existing clients that ignore it continue to work; existing clients that omit it on write create new nodes — same as today's behavior when a node is "new."

**Concurrent TOC edits from two windows** → Single-writer assumption holds; second save will see a `BookContentStructure.updatedAt` mismatch and the client should reload. Existing materialization stale-path logic already handles this pattern.

**Denormalized `title` drift** → Chapter-rename code path must update both `UnitTranslation.title` and `BookContentStructureNode.title`. A simple service-layer helper enforces both writes in one transaction. Verification: a periodic check job (not built in this change) can detect drift if it occurs.

**Increased wire size** (per-row `id` adds ~40 bytes/node) → For a 10k-node book, ~400 KB extra. Tolerable; can be omitted from reads where clients don't need write capability (selectable via query param if it becomes an issue).

## Migration Plan

**Phase 1 — schema additive (no breakage)**

1. Prisma migration: create `BookContentStructureNode` table with all indexes.
2. Keep `BookContentStructure.nodes` column in place.

**Phase 2 — backfill**

3. Write a one-off script (`package/server/prisma/migrations-runtime/normalize-book-content-structure.ts`):
   - For each `BookContentStructure` row, parse `nodes` JSON.
   - Walk the tree depth-first; for each node generate a UUID, allocate a LexoRank `sortKey`, insert a `BookContentStructureNode` row with the right `parentId`.
   - Preserve `chapterUnitId`, `noContent`, `rating`, `title` as-is.
4. Verification pass: for each book, fetch rows, assemble tree, compare structurally against the source JSON. Log any divergence; abort the migration if any book fails.

**Phase 3 — switch reads**

5. Replace `getBookContentStructure` implementation to read from rows. Behind a feature flag if desired; default-on once dev environment is green.
6. Update `chapter.service.ts` materialization to resolve path → row, then mutate row.
7. Update `factory/books.ts` and `seed/database.ts` to create rows directly.

**Phase 4 — switch writes**

8. Replace the TOC-editor save path with the diff-based row mutation flow.
9. Remove all reads of `BookContentStructure.nodes` from server code.

**Phase 5 — cleanup**

10. Prisma migration: drop `BookContentStructure.nodes` column.
11. Remove the legacy normalization utilities in `book-content-structure.ts`; replace with the new tree-assembly + sortKey utilities.

**Rollback strategy**

Until Phase 5, the legacy `nodes` column is intact. Reverting reads/writes to the JSON path is a code-only rollback. After Phase 5, rollback requires re-running an inverse "rows → JSON" script — kept on file but not exercised under normal flow.

## Open Questions

- **Should reads support a `?with=node-id` query toggle** to drop `id`/`updatedAt` from the wire response for read-only clients (book reader app) that don't need them? Defer until wire-size impact is measured.
- **Do we need a periodic title-drift check job** to detect denormalization desync? Recommended but not built in this change; track as a follow-up.
- **Future:** expose direct `{ nodeId }` addressing on materialization once a client wants to bypass path resolution. Additive, can land later without spec change.
