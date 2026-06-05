---
title: Comment Tree Refactor + Reddit-Style Ranking Cutover
status: active
created: 2026-06-05
completed:
supersededBy:
tags: [comment, ranking, reaction, cache, tree, meili]
---

## Why

Comment sibling ordering is currently the ltree `path` lexicographic order
(`sortTreeComments` in `comment.service.ts`), but the product wants comments
ranked by **score**, like Reddit. We already have the ranking infrastructure
(`package/ranking`: `UnitRankProjection`, per-comment scores patched into the
Meili `comments` index), but two gaps remain:

1. The ranking math in `formulas.ts` (`computeV1RankingScores`) is an ad-hoc
   weighted engagement sum that overranks low-vote items and uses one formula
   for posts and comments alike. We want Reddit's published algorithms: the
   time-biased **hot** sort for posts/content and the time-independent
   **Wilson "best"** sort for comments.
2. The comment read path assembles and sorts whole trees in Postgres by `path`.
   We want a Reddit-style **precomputed, score-ordered, progressively-served**
   comment tree that keeps backend pressure bounded to the visible page,
   exploiting the fact that the tree structure is append-only (hard deletes are
   forbidden; moderation is a tombstone).

**Dependency / sequencing:** this plan depends on
`plan/proposal/reaction-upvote-downvote.md` landing **first**. That cutover
renames the binary reaction kinds to `upvote`/`downvote`, fixes
`score = upvote − downvote`, and changes `formulas.ts` to read those keys — but
it intentionally keeps the old `ranking-v1` *math*. This plan replaces the math
(Part A) and refactors the comment tree read/cache path (Part B). Do not start
Part A until the reaction kinds are `upvote`/`downvote`, or the Wilson inputs
will read stale keys.

## Durable constraints & decisions

### Part A — ranking formula

- `(comment)` The ranking formulas are a direct port of Reddit's published
  algorithms; cite the sources at the formula site: Salihefendic, "How Reddit
  ranking algorithms work"; Evan Miller, "How Not To Sort By Average Rating"
  (Wilson lower bound).
- `(type)` Keep `RANKING_FORMULA_VERSION = "ranking-v1"`. This is a dev-stage
  in-place replacement — **no new version string, no `active`-flag gradual
  rollout, no dual formula**. The version string is unchanged on purpose so the
  cutover is a clean swap of the math behind the same identifier.
- `(comment)` The formula branches on `snapshot.rankKind` (already present on
  the snapshot — see `service.ts` building it before `computeV1RankingScores`).
  Do **not** add a separate `rankKind` parameter; read it off the snapshot.
- `(test)` `rankKind === "comment"` → `qualityScore` is the Wilson score lower
  bound with `z = 1.281551565545`, `ups = reactionCounts.upvote`,
  `downs = reactionCounts.downvote`, and is **independent of submission time**
  (two comments with identical up/down counts get identical `qualityScore`
  regardless of `createdAt`).
- `(test)` `rankKind === "post" | "content"` → `hotScore` is Reddit hot:
  `sign(s)·log10(max(|s|,1)) + (epoch_seconds − 1134028003)/45000` where
  `s = upvote − downvote`. Constant `1134028003` (Reddit's first-post epoch) and
  `45000` (seconds per order of magnitude) are part of the contract; pin them in
  the test.
- `(test)` `topScore = upvote − downvote` (net score) for all rank kinds;
  `trendingScore` keeps the existing view/read velocity computation.
- `(decision)` Hot decay style: **Reddit additive-log** (older items never decay
  to zero; new items get a fixed time bonus) — chosen over the v1 multiplicative
  decay for fidelity to "replicate Reddit". Recorded as the default; revisit only
  if post feeds feel wrong.
- `(comment)` Wilson `ups/downs` come from the binary vote surface only
  (`upvote`/`downvote`). Non-vote reaction kinds (`heart`, `funny`, `award`,
  etc., per the reaction plan) must **not** enter `ups/downs`.
- `(comment)` Changing the math invalidates every stored projection. A single
  full recompute/backfill is required after the swap (no migration of old
  scores); there is no formula-version gate to fall back on.

### Part B — comment tree

- `(type)` The tree partition key is `(rootUnitId, realmUnitId)`. Realm is a
  **hard partition** (`realmPartitionCondition`: `realmUnitId = R` or
  `IS NULL`); partitions are disjoint and reads are **always single-partition**.
  There is no cross-realm aggregate view.
- `(comment)` A comment's score is intrinsic to its own votes (Wilson is
  realm-independent); realm only determines **which comments are siblings**.
  Comment projections are `scope: { kind: "parent" }`, not realm-scoped — that is
  correct and sufficient, because all children of a parent share the parent's
  realm partition.
- `(comment)` Volatility is split into three layers, and cache invalidation has
  exactly two triggers, **neither on the read path**:
  - Layer 1 — skeleton: `(id, parentId, depth, orderKey)`, append-only
    structure.
  - Layer 2 — scores: ranking projection, **minute-level batch** recompute.
  - Layer 3 — content hydration: fetched only for the visible page
    (content/author/vote counts/redaction).
  - Trigger 1: a new comment insert → incremental patch into the parent's
    ordered children at the scored position (one entry per sort mode).
  - Trigger 2: ranking recompute (minute-level batch) → re-sort affected sibling
    groups.
- `(test)` Soft-delete / moderation is a **tombstone**: the node stays in the
  tree (as `includeRedactedAncestors` already keeps redacted ancestors),
  structure is unchanged, only Layer 3 flips to redacted. A soft-delete must
  **not** invalidate the skeleton/order cache. This is load-bearing on the
  project rule that hard deletes are forbidden.
- `(type)` Sort modes and their order keys: `best` → `qualityScore` (Wilson);
  `top` → net `upvote − downvote`; `new` → `createdAt`. `path` is **structure +
  subtree (`<@`) only**, never the default display sort.
- `(decision)` Skeleton/serve store: **reuse the Meili `comments` index for
  per-parent ordered serving, with a Postgres rebuild path as fallback**
  (recommended) over Redis or pure Postgres. Grounding: ranking already patches
  per-comment `hotScore/topScore/qualityScore` into the Meili `comments` index,
  and the index carries `(rootUnitId, realmUnitId, parentCommentId,
  moderationStatus)` filterable fields — so Meili can already filter a partition
  and sort a parent's children by score. The Reddit-style "precomputed CommentTree
  blob" is the heavier alternative and is **not** required when Meili can serve
  per-parent pages directly.
- `(comment)` Cold-cache / rebuild reads use a Postgres index
  `(rootUnitId, realmUnitId, parentCommentId, <scoreKey>, id)` so a partition's
  per-parent ordered children can be reconstructed without a full-tree scan.
- `(comment)` Serving is progressive (Reddit model): return a top chunk plus
  `MoreChildren`-style "load more / continue thread" stubs; the client expands
  stubs on demand and threads the flat slice. The backend never materializes a
  whole thread for a read.
- `(comment)` The ltree `path` base36 labels have a latent ordering bug:
  variable-width base36 breaks lexicographic order at digit-width boundaries
  (seq 35=`z` vs 36=`10` inverts) — the same bug class as the old `sortPath`
  9999-cliff in `plan/report/post-tree-sortpath-report.md`. After this refactor
  the impact is limited to the `new`-sort tiebreak, so the fix is optional/low
  priority (task 3.x).

## 1. Ranking formula cutover (Part A)

- [ ] 1.1 Rewrite the math in
  `package/ranking/src/ranking/formulas.ts:computeV1RankingScores` in place,
  branching on `snapshot.rankKind`. Keep the exported
  `RANKING_FORMULA_VERSION = "ranking-v1"`. Add the source-citing comment block.
- [ ] 1.2 Implement pure helpers: `redditHot(ups, downs, createdAt)`,
  `wilsonLowerBound(ups, downs)` (z = 1.281551565545), `netScore(ups, downs)`.
  Read `ups/downs` from `snapshot.reactionCounts.upvote / .downvote`.
- [ ] 1.3 Map outputs: comment → `qualityScore = wilson`, `topScore = net`,
  `hotScore = redditHot` (kept for an optional "hot comments" tab),
  `trendingScore` unchanged; post/content → `hotScore = redditHot`,
  `topScore = net`, `qualityScore = wilson`, `trendingScore` unchanged.
- [ ] 1.4 (Optional) Add `controversyScore = magnitude^balance` — requires
  extending `RankingScores` (`types.ts`), the `UnitRankProjection` column
  (`db/schema/ranking.ts`), the upsert/patch in `ranking.repository.ts` /
  `service.ts`, and the Meili patch payload. Skip if no controversial tab ships.
- [ ] 1.5 Update `package/ranking/src/ranking/formulas` tests (and any
  ranking-formula test referenced by `reaction-upvote-downvote` task 5.1) to lock
  the Wilson time-independence, the hot constants, and the net `topScore`.
- [ ] 1.6 Run one full recompute/backfill via the job-runner fullsync
  (`package/job-runner/scripts/enqueue-ranking-fullsync.ts` →
  `RANKING_COMMAND_KINDS.fullSync` → `recomputeUnit`) so every projection and its
  Meili patch reflect the new math.

## 2. Comment tree refactor (Part B)

- [ ] 2.1 Decide the serve path concretely (Meili per-parent, per the decision):
  confirm/extend the Meili `comments` query contract
  (`package/contract/src/meili/comment.ts`) to support
  filter `(rootUnitId, realmUnitId, parentCommentId)` + sort by the chosen
  `scoreKey` + paginate, including the `realmUnitId IS NULL` partition.
- [ ] 2.2 Refactor `package/server/src/comment/comment.service.ts` read path so
  sibling order comes from ranking `scoreKey` (best=`qualityScore`,
  top=`topScore`, new=`createdAt`) instead of `sortTreeComments` over `path`.
  `path` stays only for `mode: "subtree"` (`<@`) and as a stable `new`-sort
  tiebreak.
- [ ] 2.3 Implement progressive serving: top chunk + `MoreChildren` stubs per
  parent; an endpoint/branch that resolves a stub into the next ordered page of a
  parent's children within the partition.
- [ ] 2.4 Add the Postgres rebuild index
  `(rootUnitId, realmUnitId, parentCommentId, <scoreKey>, id)` on `Comment`
  (`package/server/src/db/schema/comment.ts`) for cold-cache/fallback reads, plus
  the migration.
- [ ] 2.5 Wire the two invalidation triggers: comment `create()` patches the
  parent's ordered children (incremental); ranking recompute (minute-level batch)
  re-sorts affected sibling groups. Confirm soft-delete/moderation does **not**
  invalidate skeleton/order (tombstone only flips Layer 3).
- [ ] 2.6 Hydrate only the visible page (Layer 3): content, author, vote counts,
  redaction overlay (`attachPaths`/`attachPinOverlays` reuse where applicable).
- [ ] 2.7 Update `@rezics/api` frontend access + app comment feature consumers to
  the new sort-mode + paginated/stub-expanding shape. Keep front-end tree
  assembly from the returned flat ordered slice.

## 3. Optional cleanups

- [ ] 3.1 (Low priority) Fixed-width zero-padded base36 in `rezics_to_base36`
  (and a one-shot path re-encode) so `new`-sort tiebreak ordering is correct at
  digit-width boundaries. Only needed if `new` sort relies on `path` rather than
  `createdAt`.
- [ ] 3.2 (Optional) Rename sequence `post_path_label_seq` →
  `comment_path_label_seq` (consumed only by `Comment`, never `Post`). Clean
  cutover: `pgSequence` in `db/schema/columns.ts`, the two `nextval(...)` sites in
  `comment.service.ts`, `schema-exports.test.ts`, `db-migration-artifacts.test.ts`
  assertion, and regenerate the baseline `CREATE SEQUENCE`.

## 4. Verification

- [ ] 4.1 Ranking formula tests (Wilson, hot constants, net topScore) pass.
- [ ] 4.2 Comment list/serve tests cover best/top/new ordering within a single
  `(root, realm)` partition, the `realmUnitId IS NULL` partition, and progressive
  stub expansion.
- [ ] 4.3 Soft-delete/moderation test confirms the node remains in the tree and
  the skeleton/order cache is not invalidated.
- [ ] 4.4 Full recompute backfill verified (projections + Meili comment docs hold
  new scores).
- [ ] 4.5 Run `bun run check:convention` if touched files include cross-package
  exports or route-facing contracts.

## Out of scope

- Renaming the `reaction` domain to `vote`, or any reaction-kind value changes
  (owned by `reaction-upvote-downvote`).
- Cross-realm aggregate comment views (single-partition is a durable decision).
- Reparenting / moving comments across parents or realms beyond the existing
  per-comment `realmUnitId` clear behavior.
- A standalone precomputed "CommentTree blob" store (Redis/dedicated table) — the
  Meili-served per-parent path is the chosen default; revisit only if Meili
  serving proves insufficient.
- Backward compatibility with the old `path`-lexicographic display ordering.
