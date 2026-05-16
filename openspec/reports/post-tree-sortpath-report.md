# Post Tree `sortPath` Performance & Alternatives Report

**Status**: Exploratory report
**Date**: 2026-05-13
**Scope**: The `Post.sortPath` materialized-path column used to order threaded replies
**Report type**: Risk assessment + alternatives survey, not an OpenSpec proposal

---

## 1. Executive Summary

Threaded posts are currently ordered using a `VarChar(512)` materialized-path
column (`sortPath`) of dot-separated, zero-padded 4-digit segments —
`"0001.0002.0003"`. Generation happens application-side in
`PostService.generateSortPath` by reading the parent's max-sibling path and
appending an incremented segment. Subtree queries use `LIKE startsWith` on the
path; threaded ordering uses `ORDER BY sortPath`.

The scheme is simple, indexable, and works for the typical case (a few tens of
replies, shallow depth). It has three concrete weaknesses that will materially
affect Rezics as traffic grows:

1. **Generation race** — `generateSortPath` is a read-then-write with no
   uniqueness constraint. Concurrent replies to the same parent can produce
   duplicate paths, silently breaking thread ordering and any cursor that keys
   off `sortPath`.
2. **Silent ordering corruption at 9,999 siblings** — Beyond 4-digit padding
   the next path produced is the 5-char string `"10000"`, which sorts *before*
   `"9999"` lexically. A viral post with 10k+ direct replies degrades into
   nonsensical ordering with no error surfaced.
3. **No reparenting / reordering escape hatch** — design.md explicitly punts
   on this. The day a moderation, merge, or move feature ships, every
   descendant of the affected node needs its `sortPath` rewritten.

None of these have triggered yet; none are urgent. But all three are
foreseeable as soon as the platform sees its first viral thread or its first
"move this comment" moderation feature.

This report inventories each bottleneck, surveys six alternative approaches,
and ends with a concrete short-term fix plus two viable medium-term paths.
It is not a proposal — it is the context an OpenSpec proposal would need.

---

## 2. Scope and Non-Scope

### In Scope

- Correctness, write throughput, read throughput, and index footprint of the
  current `sortPath` scheme.
- Alternative tree-ordering strategies that fit a PostgreSQL + Prisma stack.
- Trade-offs against Rezics's specific traffic profile (threaded discussions,
  no reparenting, mostly-shallow trees with occasional viral exceptions).

### Out of Scope

- Replacing `Post.parentPostUnitId` / `Post.rootPostUnitId` adjacency
  fields — those stay regardless of which ordering scheme is chosen.
- Flat-mode (`sortPath IS NULL`) listing performance. That path uses
  `[targetUnitId, createdAt]` indexes and is unrelated.
- Front-end rendering performance. The `postTreeRails` builder is O(n²) in
  the worst case due to `findNearestVisibleAncestor` linear scans, but that
  is bounded by the page size (≤200) and out of scope here.

---

## 3. Current Scheme — Recap

### Schema

```prisma
sortPath String? @db.VarChar(512)

@@index([targetUnitId, sortPath])
@@index([rootPostUnitId, sortPath])
```

### Generation (server)

`package/server/src/post/post.service.ts:502-532`

```
1. Read parent's sortPath
2. Find the parent's last child by ORDER BY sortPath DESC
3. Parse the last segment as int, increment
4. padStart(4, "0"), append after parent's path with "."
```

### Read patterns

- **Threaded list**: `WHERE rootPostUnitId = ? ORDER BY sortPath ASC, createdAt ASC`
- **Subtree**: `WHERE rootPostUnitId = ? AND sortPath LIKE :anchor || '.%'`
- **Flat list**: `WHERE targetUnitId = ? ORDER BY createdAt DESC` (no `sortPath`)

### Format

- Each segment: zero-padded 4 ASCII digits → 4 chars per segment + 1 char dot.
- Max depth in 512 chars: ~102 levels.
- Max siblings per parent: 9,999 (then ordering breaks — see §4.2).
- Storage per row: ~5 × depth bytes (toast threshold rarely hit).

---

## 4. Bottlenecks

### 4.1 Concurrent-reply race (correctness, high probability)

`generateSortPath` is a non-transactional read-modify-write. Two concurrent
`createReply(parent=X)` calls execute the following interleaving:

```
T1: SELECT MAX(sortPath) WHERE parent=X     → "0001.0003"
T2: SELECT MAX(sortPath) WHERE parent=X     → "0001.0003"
T1: INSERT sortPath = "0001.0004"
T2: INSERT sortPath = "0001.0004"           ← duplicate, no constraint stops it
```

Consequences when this fires:
- `ORDER BY sortPath ASC, createdAt ASC` becomes non-deterministic for the
  two siblings (it falls back to `createdAt`, which can equal at ms
  resolution, then becomes truly arbitrary).
- Any cursor pagination keyed off `sortPath` may skip or duplicate rows on
  the page boundary.
- Descendants under T1 and T2 inherit the collision; their subtrees become
  intermixed under any `LIKE '0001.0004.%'` query.

There is no DB-level uniqueness on `(parentPostUnitId, sortPath_segment)` or
`(rootPostUnitId, sortPath)`, no advisory lock, no `SELECT ... FOR UPDATE`,
no retry. Postgres's default Read Committed isolation does not help: each
statement sees its own snapshot, so the second `SELECT MAX(...)` happily
returns the value visible *before* T1's still-uncommitted insert.

**Likelihood**: Rises non-linearly with thread popularity. A 100-comment
thread at 1 reply/sec sees almost no collisions. A 10k-comment thread during
a launch hour will collide many times.

**Severity**: Silent. The bug only surfaces as "the thread order looks weird
sometimes."

This is the report's single most important finding.

### 4.2 Sibling cap at 9,999 (correctness, low-probability-but-cliff)

Once `nextSegment` reaches 10,000, the code (`post.service.ts:529`) emits
`"10000"` — a 5-character string. Lex comparison vs. existing 4-char siblings
gives:

```
"0001" < "0002" < ... < "9999"        ✓ as designed
"0001" < "10000" < "9999"             ✗ "10000" sorts before "9999"
```

A new reply under the same parent will appear above older siblings, not
below. The pagination cursor breaks similarly.

**Likelihood**: Bounded — Rezics hasn't seen a 10k-reply thread yet. But
this is a single hot post away.

**Severity**: Once breached, the entire thread's ordering invariant is
permanently violated. No backfill — the only fix is migrating the whole
thread's `sortPath` representation.

### 4.3 Reparenting / reordering not supported (capability gap)

design.md explicitly states paths are append-only. The moment any of these
ship:

- Moderation "move comment to another parent"
- Merge duplicate threads
- Reply edit "actually replying to X, not Y"
- Soft-delete with subtree re-rooting

…every descendant under the affected node needs a fresh `sortPath`. For a
thread with 1,000 nested replies this is a 1,000-row UPDATE during a
moderation action — workable, but only with a transactional bulk-update
script that doesn't yet exist.

**Likelihood**: Eventual.

**Severity**: Implementation work, not data corruption. Manageable.

### 4.4 Index size grows linearly with depth (storage, low)

The B-tree on `[rootPostUnitId, sortPath]` includes the full path for every
row. A 10-deep reply stores `"0001.0002...0010"` = 49 bytes in the index
*plus* the rootPostUnitId UUID. With 1M deep replies, this is on the order
of 100 MB of index — fits in RAM comfortably. Not a current concern.

**Likelihood / Severity**: Both low.

### 4.5 String comparison cost (read perf, low)

B-tree comparison on a 50-byte VarChar is roughly 5× the cost of comparison
on a 4-byte int. Threaded list queries that return ≤200 rows do a B-tree
range scan + sort; the sort is bounded by `LIMIT`. The cost difference is
real but well under 1ms for any sane page size.

**Likelihood / Severity**: Both low.

### 4.6 Hot-parent generation cost (write perf, low)

`generateSortPath` runs `SELECT ... ORDER BY sortPath DESC LIMIT 1` on
`(parentPostUnitId)`. There is no dedicated index on `parentPostUnitId`
alone, but the existing `[rootPostUnitId, sortPath]` index gets used for the
descending scan once the planner has `rootPostUnitId`. In practice this is a
single index-seek per reply, O(log n). Not a bottleneck.

**Likelihood / Severity**: Both low.

---

## 5. Alternatives

For each alternative we evaluate: write cost, read cost, reparent support,
storage, race resistance, and Prisma/Postgres compatibility.

### 5.1 Patch the current scheme

**What changes**: Keep `VarChar` materialized path. Add (a) a unique
constraint on `(rootPostUnitId, sortPath)`, (b) an advisory lock or
`SELECT ... FOR UPDATE` around generation, and (c) a retry-on-conflict
wrapper.

- **Solves §4.1**: Yes (unique constraint + retry).
- **Solves §4.2**: No. 9,999 cliff remains.
- **Solves §4.3**: No.
- **Effort**: ~1 day. Lowest possible.
- **Risk**: Advisory locks are per-connection; pgBouncer transaction-pooled
  setups need them inside an explicit transaction.

This is the **right short-term move**. It costs little and eliminates the
report's single most serious finding.

### 5.2 Numeric array path (`int[]`)

**What changes**: Replace `sortPath VARCHAR(512)` with
`sortPath INT[] NOT NULL DEFAULT '{}'`. Path `[1, 2, 3]` instead of
`"0001.0002.0003"`. Postgres provides element-wise array comparison
(`<`, `>`, `=`) and prefix containment operators.

| Aspect | Verdict |
|---|---|
| Write cost | Same as current (read-modify-write); still needs §5.1 race fix |
| Read cost (threaded order) | `ORDER BY sortPath` works natively |
| Read cost (subtree) | `sortPath[1:N] = :anchor` or `sortPath @> :anchor` |
| Reparent | Same painful descendant rewrite |
| Storage | ~4 bytes per segment vs. 5 bytes — slightly smaller |
| Sibling cap | `INT4_MAX` (2.1B) — effectively gone |
| Depth cap | None — array is variable-length |
| Prisma support | `Int[]` is first-class; array operators need raw SQL |
| Migration | Required; one-time backfill from string paths |

**Solves §4.1**: Together with §5.1 patches, yes.
**Solves §4.2**: Yes, definitively.
**Solves §4.3**: Partially — still needs a bulk update on reparent.

This is the **best medium-term target** if the scheme stays
path-based. The migration is mechanical: parse current strings, write the
array, drop the varchar. The Prisma `Int[]` ergonomics are good for write,
slightly awkward for subtree reads (raw SQL or `Prisma.sql` template), but
the rest of the stack is unaffected.

### 5.3 PostgreSQL `ltree` extension

**What changes**: Adopt the `ltree` extension. `sortPath` becomes `LTREE`.
Native operators (`@>`, `<@`, `~`, `?`) with GiST indexing.

- **Write cost**: Same generation cost; needs §5.1 race fix.
- **Read cost**: GiST prefix lookups are faster than B-tree `LIKE` for very
  large trees, otherwise comparable.
- **Reparent**: Same descendant-rewrite problem.
- **Prisma support**: `Unsupported("ltree")` only — every read/write path
  needs raw SQL or a custom Prisma wrapper.
- **Operational**: Extension must exist in every Postgres deployment
  (managed clouds support it; some hosted Postgres-compatible services do
  not).

**Verdict**: Real wins are marginal vs. the §5.2 `int[]` route, and the
Prisma cost is high. Not recommended unless we also adopt `ltree` for
something else (e.g., realm tag hierarchies).

### 5.4 Closure table

**What changes**: A separate `PostAncestor` table:
`(ancestorUnitId, descendantUnitId, depth)` with one row per ancestor-descendant pair (including self).

- **Write cost**: O(depth) inserts per new reply (must insert one row for
  every ancestor including self). For a depth-10 reply, that's 10 INSERTs.
- **Read cost (subtree)**: Single equality join on `ancestorUnitId` — very
  fast.
- **Read cost (threaded order)**: Needs an additional sort key (closure
  tables don't natively order siblings). Falls back to `createdAt` or
  requires a separate `sortKey` column on `Post`.
- **Reparent**: Delete + reinsert the moved subtree's closure rows. Painful
  but well-understood.
- **Storage**: O(n × avg-depth) extra rows. For 10M posts at avg-depth-3,
  that's 30M rows in the closure table.

**Verdict**: Excellent for arbitrary "where am I in the tree" queries,
poor for thread ordering specifically. Closure tables shine when you need
"all my descendants regardless of order" — that's not Rezics's main read
pattern. **Not recommended** as the primary mechanism.

### 5.5 Nested sets (modified preorder tree traversal)

**What changes**: `lft`, `rgt` integer columns. Subtree = `WHERE lft BETWEEN
parent.lft AND parent.rgt`.

- **Write cost**: **O(n)** — inserting one node requires shifting roughly
  half the table's `lft`/`rgt` values. Disqualifying for any write-heavy
  thread.

**Verdict**: Disqualified.

### 5.6 Adjacency-only + recursive CTE

**What changes**: Drop `sortPath`. Use `parentPostUnitId` alone and compute
the threaded ordering at read time via a recursive CTE.

```sql
WITH RECURSIVE thread AS (
  SELECT unit_id, parent_post_unit_id, created_at,
         ARRAY[created_at, unit_id] AS path
  FROM post WHERE root_post_unit_id = :root AND parent_post_unit_id IS NULL
  UNION ALL
  SELECT p.unit_id, p.parent_post_unit_id, p.created_at,
         t.path || ARRAY[p.created_at, p.unit_id]
  FROM post p JOIN thread t ON p.parent_post_unit_id = t.unit_id
)
SELECT * FROM thread ORDER BY path;
```

- **Write cost**: Zero — no path to maintain. Race in §4.1 disappears.
- **Read cost**: Recursive CTE doesn't use indexes well past a few thousand
  nodes. For pagination, you have to materialize the whole subtree to find
  the page boundary.
- **Reparent**: Free — just rewrite `parentPostUnitId`.
- **Storage**: Smallest of any option.

**Verdict**: Beautiful for write-heavy + small subtrees. For Rezics, where
the main read pattern is "page through a 5k-comment thread in order," the
CTE cost on every read is the wrong trade. **Not recommended** as the
primary mechanism.

### 5.7 Fractional indexing / LexoRank

**What changes**: Each reply gets a string key generated *between* its
intended neighbors (LexoRank, Figma-style). Reordering = generate a new key
between two existing keys. No subtree rewrites.

- **Write cost**: O(1) generation, no race if keys are derived from
  client-supplied "before/after" neighbors. But for tree position, the key
  is between siblings — you still need a parent reference.
- **Reparent**: Free.
- **Read cost**: Same as current materialized path.
- **Catch**: Keys lengthen monotonically under churn. Needs periodic
  rebalancing.

**Verdict**: Useful complement *if* and when reordering ships. Overkill for
pure append-only reply trees.

---

## 6. Recommendation Matrix

Ranked by total fit for Rezics, given the actual problems:

| Option | Solves race? | Solves 10k cap? | Reparent ready? | Effort | Recommended? |
|---|---|---|---|---|---|
| 5.1 Patch current scheme | ✓ | ✗ | ✗ | XS | **Yes — short term** |
| 5.2 `int[]` path | ✓ (with 5.1 patches) | ✓ | partial | M | **Yes — medium term** |
| 5.3 `ltree` | ✓ | ✓ | partial | L | No (Prisma cost) |
| 5.4 Closure table | ✓ | ✓ | ✓ | L | No (poor for ordering) |
| 5.5 Nested sets | ✓ | ✓ | ✗ | XL | No (O(n) writes) |
| 5.6 Adjacency + CTE | ✓ | ✓ | ✓ | M | No (poor for pagination) |
| 5.7 LexoRank | ✓ | ✓ | ✓ | M | Future, when reordering ships |

### Suggested Path

1. **Now (XS)**: Implement §5.1. Add unique constraint on
   `(rootPostUnitId, sortPath)`, wrap `generateSortPath` in a retry loop,
   surface deterministic ordering. This fixes the only correctness bug
   currently in production.

2. **Before first viral thread (M)**: Migrate to §5.2 `int[]` path. The
   migration is a one-shot script that parses existing strings to arrays.
   This removes the 10k sibling cliff permanently and slightly shrinks
   storage. Cursor pagination needs to switch from string comparison to
   array comparison — a localized change in `post.service.ts` and the
   contract layer.

3. **When reordering / moderation ships**: Revisit. Either bolt a
   §5.7 LexoRank-style key on top of `int[]` for the *sibling* segment, or
   accept the descendant-rewrite cost as a moderation-time batch operation
   (likely fine — moderation actions are rare).

---

## 7. Open Questions

- **Is `createdAt` reliable as a tiebreaker?** Currently the threaded `ORDER
  BY` ends with `createdAt ASC`. If two siblings get the same millisecond
  (BATCH inserts in the factory; high-concurrency replies in prod), the
  order is undefined. Should the tiebreaker be `unitId` instead?

- **Does the cursor pagination layer key off `sortPath` alone or
  `(sortPath, unitId)`?** This determines whether the §5.1 race actually
  surfaces as a pagination bug or "just" an ordering glitch. (Answer
  unknown without reading the cursor contract.)

- **What is the realistic upper bound for "siblings under a single
  parent"?** The 10k cliff is qualitatively bad but quantitatively distant.
  If we never expect more than a few hundred direct replies under one
  parent, §5.1 alone may be sufficient for the foreseeable horizon, and
  §5.2 can wait.

- **Do we want subtree quoting / cross-thread linking?** If a reply can
  reference a subtree elsewhere, closure-table thinking re-enters the
  picture.

---

## 8. References

- `package/server/src/post/post.service.ts:493-532` — `generateSortPath`
- `package/server/src/post/post.service.ts:43-80` — subtree query (post-cleanup, dot-only)
- `package/server/prisma/schema.prisma:402,421-422` — column and indexes
- `package/server/prisma/factory/posts.ts:336,385,415` — factory generation
- `package/app/src/post/models/postTreeRails.ts` — front-end consumers
- `openspec/changes/archive/2026-04-12-unit-architecture/design.md:99-117,1007-1009`
  — original design decision and the explicit "no reparent" mitigation
