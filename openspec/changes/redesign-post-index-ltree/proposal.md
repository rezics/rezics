## Why

The Post threading index encodes a node's position with a hand-rolled
materialized path string (`Post.sortPath`, `VARCHAR(512)`, zero-padded
4-digit dot segments). That single column conflates three orthogonal
concerns — tree topology, sibling ordering, and render order — which blocks
re-sortable threads (by score/best) and any future promotion (pin / accepted
answer). The path generator (`generateSortPath`) also has a
read-max-then-write race with no row lock, so concurrent replies to the same
parent can collide on a segment, and the fixed 4-digit width caps a parent at
9 999 direct children. We have no production data debt yet, so this is the
moment to move to the optimal base layer rather than patch the string scheme.

## What Changes

- **BREAKING (internal):** Replace `Post.sortPath` (`VARCHAR(512)`) with a
  Postgres-native `ltree` column `Post.path` indexed by GiST. Subtree
  containment uses `path <@ anchor.path` / ancestor `@>`; depth uses
  `nlevel()` (the denormalized `Post.depth` column is retained for cheap
  `maxDepth` filtering and visual depth).
- **ltree label scheme:** each label is a global `BIGSERIAL` rendered as
  base36 — stable, unique within and across parents, append-only. A reply's
  `path` is `parent.path || <newLabel>`; **no ancestor row is ever
  rewritten** (tree moves are unsupported, matching Reddit/HN/Lemmy).
- **Race fix:** `generateSortPath` is replaced by append-only label
  generation that does not depend on read-max-then-write atomicity, removing
  the sibling-collision race.
- **Subtree query strategy (two indexes, belt-and-suspenders):** whole-thread
  retrieval stays on the `rootPostUnitId` btree index (the common path, with
  stable plans); partial-subtree retrieval (`subtreeRootPostUnitId`) uses
  `path <@ anchor.path` over the GiST index. We do NOT rely on GiST `<@`
  alone for the whole-thread case to avoid selectivity-estimation misfires.
- **Ordering model (School B):** `path` no longer encodes render order. It
  only bounds the subtree and contributes depth. The base ordering MUST be
  expressible DB-side (`createdAt` is already indexable; a future indexable
  score column is reserved for top/best). The contract MUST NOT mandate
  "sort happens in app".
- **Removals:** drop `Post.sortPath`, its indexes, and the contract exposure
  of `sortPath`. No new `siblingRank` column is introduced (YAGNI until
  manual drag-reorder of ordinary replies is needed).
- **Migration:** one-shot backfill that reconstructs every `Post.path` from
  the existing `parentPostUnitId` / `rootPostUnitId` adjacency in creation
  order; assigns labels via the new sequence.
- **Prisma posture:** model the column as `Unsupported("ltree")`; create the
  extension and the GiST index via a specially named manual raw SQL
  migration; perform path generation and subtree filtering with `$queryRaw` /
  `$executeRaw`. Prisma 7.8.0 still has no native `ltree` scalar, so the GiST
  index is not Prisma-schema-managed.
- **Development database posture:** this project is pre-deploy. Do not design
  around managed-Postgres extension allowlists or compatibility fallbacks.
  The local source Postgres runtime must include the `ltree` extension files;
  the migration enables `ltree` per database with `CREATE EXTENSION IF NOT
  EXISTS ltree`.

## Capabilities

### New Capabilities
- `post-tree-index`: the authoritative storage-and-algorithm spec for the
  post threading tree — `ltree` path column + GiST index, the base36
  `BIGSERIAL` label scheme, retained adjacency (`parentPostUnitId`,
  `rootPostUnitId`) and denormalized `depth`/counters, append-only race-free
  path generation, the two-index subtree retrieval strategy, the School-B
  decoupling of ordering from path, the Prisma `Unsupported("ltree")` +
  raw-SQL posture, and the one-shot backfill migration.

### Modified Capabilities
- `work-discussion`: the threaded reply view changes from "displayed in
  `sortPath` order" to "subtree loaded via `rootPostUnitId` (or `path <@`
  for continue-thread anchors), ordered DB-side / at render time"; the
  `maxDepth` truncation and continue-thread anchoring semantics are preserved
  but re-expressed against `path`/`depth` instead of `sortPath`.
- `type-extension-post`: the enumerations of Post threading fields that name
  `sortPath` are updated to name `path`; the parent-read that derives
  `rootPostUnitId`/`depth`/(path) keeps its single-roundtrip guarantee.

## Impact

- **package/server**: `prisma/schema.prisma` (Post model: drop `sortPath`,
  add `path`, adjust indexes), a manual raw-SQL migration (enable `ltree`,
  GiST index, backfill, drift verification), source Postgres container config
  if the base image ever lacks the extension files, `src/post/post.service.ts`
  (`generateSortPath` →
  append-only `generatePath`, `list`/`byRealm`/`subtreeRootPostUnitId`
  queries, create flow), `src/post/post.mapper.ts`, `src/post/types.ts`, and
  associated tests.
- **package/contract**: `src/post.ts` — remove `sortPath` from `PostDTO` and
  any query schema field that ordered by it; ensure ordering fields are
  DB-expressible.
- **package/app**: `src/post/models/postTreeRails.ts` and any thread view
  that consumes `sortPath` for ancestor/descendant computation switch to
  `path`/`depth`-derived helpers (or server-provided structure).
- **Search**: `Post.sortPath` is not a Meili projection; no search index
  change is expected, but `post-search-index` is reviewed for incidental
  references.
- **Backward compatibility:** internal clean cutover per AGENTS.md — all
  internal callsites of `sortPath` migrate in this change. Data is migrated
  by the one-shot backfill; no dual-read period.
