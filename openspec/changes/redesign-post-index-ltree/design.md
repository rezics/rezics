## Context

`Post` is the anchor extension for all discussion/reply content
(`package/server/prisma/schema.prisma`). Its tree is a hybrid: adjacency
(`parentPostUnitId`, `rootPostUnitId`), a hand-rolled materialized path
(`sortPath VARCHAR(512)`, zero-padded 4-digit dot segments), and
denormalized shape (`depth`, `replyCount`, `directReplyCount`, `lastReplyAt`).
`PostService.generateSortPath` derives a child path by reading the max sibling
`sortPath` and incrementing the last segment; threaded reads use
`ORDER BY sortPath` and subtree reads use `sortPath startsWith "<anchor>."`.

This is the same family Reddit/HN/Lemmy use. The problems are local, not
architectural: (1) `sortPath` welds topology to render order, blocking
re-sortable threads and future promotion; (2) `generateSortPath` is a
read-max-then-write with no row lock — concurrent siblings can collide;
(3) fixed 4-digit width caps a parent at 9 999 children and burns path width.
We have no production data, so a clean cutover to the optimal base layer is
preferable to patching the string scheme.

Scale was assessed before this design: ltree + GiST is proven at ~12M rows
with scope-limited subtree search; writes are O(1) append-only; the only real
ceiling is single-thread render-window size, which has an industry-standard
escape hatch (DB-side ordering + caching) that this design keeps open.

## Goals / Non-Goals

**Goals:**
- Replace `sortPath` with a Postgres-native `ltree` column + GiST index.
- Make path generation append-only and race-free.
- Decouple ordering from the path (School B): path bounds the subtree and
  yields depth; base ordering stays DB-expressible.
- Preserve the existing thread features: `maxDepth` truncation, continue-thread
  subtree anchoring, reply counters, tombstone-in-tree behavior.
- Provide a one-shot backfill from existing adjacency + creation order.

**Non-Goals:**
- Pinning, accepted answers, Q&A tags — owned by the follow-on change
  `add-post-pinning-and-accepted-answer`.
- Manual drag-reorder of ordinary replies (no `siblingRank` column now).
- Tree moves / re-parenting (explicitly unsupported, matching Reddit/HN).
- New score/Wilson ranking implementation (only reserve a DB-expressible
  ordering seam; `top/best` wiring is out of scope here).

## Decisions

### D1: `ltree` + GiST over keeping `VARCHAR` materialized path
`Post.path` becomes `ltree` with a GiST index. Subtree containment uses
`path <@ anchor.path`; `nlevel(path)` gives depth. **Why over VARCHAR + LIKE:**
native descendant/ancestor operators, index-backed containment without
`LIKE 'prefix.%'`, and no fixed-width segment ceiling. Lemmy validates this
choice in production. **Alternatives:** closure table (better for moves, but
O(depth) write rows and O(N·depth) storage — moves don't happen here);
nested set (re-indexes half the tree per insert — fails write-heavy leaves).

### D2: ltree label = global `BIGSERIAL` → base36
Each node owns one label minted from a dedicated Postgres sequence, rendered
base36. A reply's `path = parent.path || <label>`. **Why:** labels must be
valid ltree tokens (`[A-Za-z0-9_]`), so raw UUIDs (with `-`) cannot be labels;
a global sequence is unique, stable, append-only, and short (~6 chars at 10⁹
nodes → depth-50 path ≈ 350 chars, well under ltree limits). Because ordering
is decoupled (D4), the label carries no order meaning — it only needs
uniqueness and stability. **Alternatives:** sanitized UUID (32 chars/level —
long); per-parent counter (reintroduces the read-max-then-write race).

### D3: Two indexes for two retrieval shapes (guardrail 1)
Whole-thread retrieval keeps using the `rootPostUnitId` btree index — it is
the common path and produces stable plans. Partial-subtree retrieval
(continue-thread anchors, `subtreeRootPostUnitId`) uses `path <@ anchor.path`
over GiST. **Why both:** GiST `<@` selectivity estimation can misfire on the
hot whole-thread case; equality on `rootPostUnitId` avoids that. The two
indexes are complementary, not redundant.

### D4: School B — path does not encode render order (guardrail 2)
`path` bounds the subtree and yields depth; it MUST NOT be the `ORDER BY` key
for presentation. The base ordering MUST be expressible DB-side: `createdAt`
is already indexable (covers `new`); a future indexable score column is the
seam for `top/best`. The contract MUST NOT mandate "ordering happens in the
app". **Why:** this keeps re-sortable threads possible and leaves room for the
follow-on promotion overlay to be composed onto a DB-ordered base without
rewriting paths. **Alternative (School A, current):** `ORDER BY sortPath` —
simple but locks the thread to a single creation-order sort and makes any
promotion require path rewrites.

### D5: Prisma posture — `Unsupported("ltree")` + raw SQL
Prisma 7.8.0 still has no native ltree scalar. Model `path` as
`Unsupported("ltree")`; enable the extension, create the GiST index, and run
the backfill via a manually authored raw SQL migration; mint labels and
perform `<@` filtering through `$queryRaw`/`$executeRaw` in `PostService`.
**Why:** keeps the column visible in Prisma's schema while using SQL where
Prisma's typed API cannot express ltree. GiST indexes are supported by Prisma
for supported field types, but this `ltree` GiST index remains raw-SQL-owned
and MUST NOT be represented as a normal Prisma-managed `@@index([path], type:
Gist)`. **Trade-off:** a few service methods drop to raw SQL; contained to
path generation and subtree filtering.

### D6: Keep `depth` denormalized despite `nlevel(path)`
`nlevel(path)` can compute depth, but `Post.depth` stays as a stored column.
**Why:** cheap `WHERE depth <= maxDepth` filtering and visual-depth capping
without evaluating `nlevel` per row; it is already written on insert.

## Risks / Trade-offs

- **GiST `<@` plan instability on the hot path** → Mitigated by D3: whole-thread
  reads use `rootPostUnitId` btree; `<@` is reserved for partial subtrees.
- **Prisma migrate drift on a raw `ltree`/GiST object** → Author the extension,
  column type, and index in an explicitly named manual SQL migration; verify
  `prisma migrate` + `prisma:generate` accept the `Unsupported` column and do
  not attempt to drop the index, extension, or sequence on subsequent diffs.
- **Backfill correctness for deep/old threads** → Backfill walks the existing
  tree in BFS by `(parentPostUnitId, createdAt)`, minting labels parent-before-
  child so every `path` is `parent.path || label`; validate post-migration that
  `nlevel(path) == depth` and that subtree counts match `replyCount`.
- **Label sequence as a hot singleton on bursty writes** → A single sequence is
  fine (sequences are not transactional bottlenecks); if ever needed, cache
  ranges. No correctness risk.
- **Path width at extreme depth** → base36 labels keep depth-50 ≈ 350 chars;
  combined with the existing `maxDepth` truncation, pathological depth is not
  reachable through the API.

## Migration Plan

1. Manual SQL migration: create it with Prisma's `--create-only` flow, but name
   it with a `manual_` prefix (for example
   `manual_redesign_post_ltree_index`) so it is visibly distinct from
   mechanical Prisma-generated migrations. The migration runs `CREATE
   EXTENSION IF NOT EXISTS ltree`; adds `Post.path ltree` (nullable during
   backfill); creates the label sequence; creates the raw-owned `GIST (path)`
   index; and keeps `rootPostUnitId` btree.
2. Backfill: BFS over existing posts ordered by `(parentPostUnitId, createdAt)`,
   minting a base36 label per node and writing `path = parent.path || label`
   (roots get a single-label path). Run inside the migration or a one-shot
   script invoked by it.
3. Validate: assert `nlevel(path) == depth + 1` (root depth 0 ↔ 1-label path),
   no duplicate paths, subtree counts consistent.
4. Cutover code: `generateSortPath` → append-only `generatePath`; rewrite
   `list`/`byRealm`/subtree queries to `rootPostUnitId` (whole) and `path <@`
   (partial); drop `sortPath` reads/writes; remove `sortPath` from contract and
   app helpers in the same change (clean cutover per AGENTS.md).
5. Drop column: final migration removes `Post.sortPath` and its indexes after
   code no longer references it.
- **Rollback:** before the drop-column step, `path` is additive and `sortPath`
  still exists, so reverting code restores prior behavior. After drop-column,
  rollback requires restoring `sortPath` from a re-derivation script.

## Development Database / Docker

This project is still in development and has no deployed managed-Postgres
compatibility constraint. The migration may assume it can run `CREATE
EXTENSION IF NOT EXISTS ltree` on the source database.

The current local source database is `postgres:18.4-trixie` in
`tool/external-services/compose.yml`, not an app service Dockerfile. The
official Postgres image normally carries contrib extensions such as `ltree`;
if that stops being true, adjust the local source Postgres image/build so the
extension files are installed. Do not add an alternate non-ltree storage path.
Activation remains in the migration because Postgres extensions are enabled
per database.

## Open Questions

- Whether the `top/best` score column is introduced here as a reserved
  nullable seam or deferred entirely to a later ranking change (current plan:
  reserve only the ordering seam, no new column unless trivial).
