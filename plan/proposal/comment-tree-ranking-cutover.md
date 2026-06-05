---
title: Comment Slice Ranking + Ltree Removal Cutover
status: active
created: 2026-06-05
completed:
supersededBy:
tags: [comment, ranking, reaction, tree, meili]
---

## Why

Comment reads currently depend on the `Comment.path` ltree materialized path and
whole-tree assembly. That makes ranked comment ordering expensive and brittle:
the backend has to reason about a "true tree", subtree reads depend on path
prefixes, and ranking changes imply complex tree-wide cache invalidation.

Cut comments over to a lighter Reddit-style model: comments are immutable
adjacency rows scoped to one `(rootUnitId, realmUnitId)` partition, ranking is
precomputed from upvote/downvote signals, and reads return ranked slices plus
local context. The app may render a best-effort fake tree from the slices it has,
but the backend no longer serves or caches a complete tree.
`reaction-upvote-downvote` has already landed, so this plan assumes `upvote` and
`downvote` are the canonical binary vote inputs.

## Durable constraints & decisions

### Comment topology

- `(type)` A comment belongs to exactly one discussion partition:
  `(rootUnitId, realmUnitId)`. `rootUnitId` is the post/review/remark discussion
  root; `realmUnitId` is nullable but immutable after create.
- `(test)` `UpdateCommentInput` must not include `realmUnitId`. Replies inherit
  the parent's `realmUnitId`; creating a reply with a different realm is rejected.
- `(comment)` Comment deletes are tombstones. Hard delete, reparenting, and moving
  a comment between realms are out of scope because they invalidate parent-child
  serving cursors and ranked slices.
- `(type)` Backend comment contracts use `rootCommentId` only to mean "the id of
  the comment used as a local discussion entry point." Do not introduce
  `familyRootCommentId`; that implies a heavier backend family model. If the UI
  needs to focus or scroll to a specific row, keep `anchorCommentId` as frontend
  route/local state only.
- `(comment)` `Comment.path` / ltree is not a fallback. This cutover removes
  ltree from comment serving rather than repairing its ordering bugs.

### Ranking formulas

- `(comment)` Source formulas should cite Reddit's archived `_sorts.pyx` for
  `hot`, `confidence`, and `controversy`, plus Evan Miller for Wilson lower
  bound background where useful.
- `(type)` Keep `RANKING_FORMULA_VERSION = "ranking-v1"` for this dev-stage
  replacement. There is no dual formula rollout.
- `(test)` Vote-only scores read `ups = reactionCounts.upvote ?? 0` and
  `downs = reactionCounts.downvote ?? 0`. Non-vote reaction kinds must not affect
  `best`, `top`, `rising`, or `controversial`.
- `(test)` `qualityScore` is pure Wilson lower bound with
  `z = 1.281551565545`. It is time-independent and is not the UI `Best` score.
- `(test)` `topScore = upvote - downvote`.
- `(test)` `controversyScore` follows Reddit controversy semantics:
  `0` when either side has zero votes; otherwise
  `(ups + downs) ** (min(ups, downs) / max(ups, downs))`.
- `(type)` Add `risingScore` and `bestScore` to ranking projections and serving
  documents. `risingScore` captures recent positive momentum; `bestScore` is the
  UI `Best` order key and combines durable quality with controlled rising boost.
- `(test)` `bestScore` must allow promising new comments to surface without
  turning `Best` into pure `Hot`: old high-quality comments remain strong, while
  the rising boost fades as total vote count grows.
- `(test)` `hotScore` keeps Reddit hot semantics for post/content feeds:
  `sign(s) * log10(max(abs(s), 1)) + (epoch_seconds - 1134028003) / 45000`,
  where `s = upvote - downvote`.

### Serving model

- `(type)` Comment reads are slice-based, not whole-tree based:
  `discovery`, `root`, and `children`.
- `(type)` `discovery` returns ranked comments for `(rootUnitId, realmUnitId)`
  with local parent preview/context when available. It does not promise a
  complete tree or ancestor chain.
- `(type)` `root` returns one `rootCommentId` plus a first direct-children page.
  It is the backend entry point for a local comment discussion.
- `(type)` `children` returns one direct-children page for a `parentCommentId`.
- `(comment)` Discovery pagination appends to the ranked list only. It must not
  insert loaded rows into arbitrary middle positions to complete a tree.
- `(comment)` Tree-like expansion happens only in root/children mode, where
  "load more" is attached to one parent.
- `(type)` Sort modes and order keys:
  `best -> bestScore`, `top -> topScore`, `rising -> risingScore`,
  `controversial -> controversyScore`, `new -> createdAt desc`,
  `old -> createdAt asc`.
- `(comment)` V1 serving uses the Meili `comments` index for slice queries
  because it already carries comment partition filters and ranking patches.
  A future `CommentRankServing` table is the fallback if stable cursors,
  moderation freshness, or Meili consistency become insufficient.

### Data ownership

- `(type)` Reaction DB owns source votes:
  `Reaction` and `ReactionSummary`.
- `(type)` Ranking DB owns derived rank state:
  `UnitRankProjection`, `RankingSignalBucket`, and a new reaction-bucket table
  for recent upvote/downvote windows.
- `(type)` Server DB owns comment topology and content:
  `Comment` adjacency fields and tombstone/moderation state.
- `(comment)` Comment API reads must not call the reaction service to calculate
  sort order. The ranking service materializes sort fields into the serving
  index before reads.

## 1. Ranking Formula And Projection Cutover

- [ ] 1.1 Update `package/ranking/src/ranking/types.ts` so `RankingScores` and
  `ZERO_RANKING_SCORES` include `bestScore`, `risingScore`, and
  `controversyScore`.
- [ ] 1.2 Add `bestScore`, `risingScore`, and `controversyScore` columns and
  indexes to `package/ranking/src/db/schema/ranking.ts`, then generate the
  ranking DB migration.
- [ ] 1.3 Rewrite `package/ranking/src/ranking/formulas.ts` in place:
  implement `wilsonLowerBound`, `redditHot`, `netScore`,
  `redditControversy`, `risingScore`, and `bestScore` helpers.
- [ ] 1.4 Add formula tests in `package/ranking/src/ranking/formulas.test.ts`
  for Wilson time-independence, Reddit hot constants, net top score,
  controversy edge cases, and best/rising behavior for promising new comments.
- [ ] 1.5 Update `package/ranking/src/ranking/ranking.repository.ts` and
  `package/ranking/src/ranking/service.ts` to persist and patch the new score
  fields.
- [ ] 1.6 Verify comment identity in `package/ranking/src/ranking/main-state.ts`
  against the current `Comment` schema (`Comment.id` is the comment target id);
  fix any stale `"unitId"` comment lookup before relying on comment projections.

## 2. Rising Vote Buckets

- [ ] 2.1 Add a ranking DB table such as `RankingReactionBucket` with
  `targetId`, `scopeKey`, `reaction`, `bucketStart`, `bucketEnd`, and `count`.
- [ ] 2.2 Route reaction CDC/job events from `package/job-runner` into ranking
  bucket updates for `upvote` and `downvote`.
- [ ] 2.3 Extend ranking repository reads so `computeV1RankingScores` receives
  recent vote windows, for example 1h/6h/24h upvote/downvote counts.
- [ ] 2.4 Add repository/service tests proving old total votes affect
  `qualityScore`, while recent vote buckets affect `risingScore` and the
  controlled boost inside `bestScore`.

## 3. Serving Index Fields

- [ ] 3.1 Extend `package/search/src/sync.ts` ranking patch types and document
  builders for content, posts, and comments with `bestScore`, `risingScore`, and
  `controversyScore`.
- [ ] 3.2 Extend `package/search/src/schema.ts` sortable attributes for
  `content`, `posts`, and `comments` with the new ranking fields.
- [ ] 3.3 Extend `package/contract/src/meili/comment.ts`,
  `package/contract/src/meili/post.ts`, and `package/contract/src/meili/content.ts`
  sort schemas/document schemas with the new fields.
- [ ] 3.4 Update Meili/search tests that assert default ranking fields,
  sortable attributes, and patch payloads.
- [ ] 3.5 Run a ranking full sync/backfill after the formula and schema cutover
  so existing projections and Meili documents hold the new fields.

## 4. Comment Topology Lock

- [ ] 4.1 Remove `realmUnitId` from `updateCommentSchema` in
  `package/contract/src/comment/comment.ts` and update exported types.
- [ ] 4.2 Remove realm updates from `package/server/src/comment/comment.service.ts`
  and tests. Keep `isLocked`, `state`, and content updates.
- [ ] 4.3 Strengthen create tests so a reply always inherits/validates the
  parent's `(rootUnitId, realmUnitId)` partition.
- [ ] 4.4 Keep soft-delete behavior as the only delete path and add tests that a
  deleted parent can remain as context in root/children mode while disappearing
  from discovery slices.

## 5. Slice Contract And API

- [ ] 5.1 Replace the current threaded/subtree comment list contract in
  `package/contract/src/comment/comment.ts` with slice query/response shapes for
  `discovery`, `root`, and `children`.
- [ ] 5.2 Define comment sort literals:
  `best`, `top`, `rising`, `controversial`, `new`, and `old`.
- [ ] 5.3 Add cursor types that match the selected sort key plus `id`; avoid
  offset paging for ranked comment slices.
- [ ] 5.4 Update `package/server/src/comment/comment.api.ts` to expose the new
  slice reads while preserving create/update/moderation routes.
- [ ] 5.5 Update `package/api/src/comment/` query helpers and keys for
  discovery/root/children reads.

## 6. Remove Ltree From Comment Reads

- [ ] 6.1 Remove `path` from `commentDTOSchema`, `mapCommentToDTO`, and search
  comment documents unless a transitional test proves it is still required.
- [ ] 6.2 Remove `Comment.path`, `Comment_path_gist_idx`, and ltree path writes
  from `package/server/src/db/schema/comment.ts` and
  `package/server/src/comment/comment.service.ts`, then generate the server DB
  migration.
- [ ] 6.3 Remove `attachPaths`, `sortTreeComments`, `getSubtreeAnchor`,
  `listSubtreeDescendantIds`, and all `<@` subtree SQL from the comment service.
- [ ] 6.4 Replace Postgres fallback indexes with adjacency indexes only:
  `(rootUnitId, realmUnitId, parentCommentId, createdAt, id)` for chronological
  reads and any required moderation/filter indexes.
- [ ] 6.5 Add service tests proving reads are direct-child or ranked discovery
  slices and never depend on ltree/path ordering.

## 7. Meili Slice Serving

- [ ] 7.1 Implement a comment serving helper that maps each sort mode to its
  Meili sort field and filter:
  `rootUnitId`, `realmUnitId` including null partition semantics,
  `parentCommentId` where applicable, and moderation visibility.
- [ ] 7.2 Implement discovery slice reads:
  ranked comments in a root/realm partition plus bounded direct-parent context.
- [ ] 7.3 Implement root slice reads:
  fetch `rootCommentId`, validate its partition, and return its first
  direct-children page.
- [ ] 7.4 Implement children slice reads:
  fetch direct children for `parentCommentId` with sort/cursor/limit.
- [ ] 7.5 Add a service seam or TODO comment for a future `CommentRankServing`
  table only where Meili consistency/cursor stability would be swapped out.

## 8. Frontend Slice Rendering

- [ ] 8.1 Update `package/app/src/post/sections/PostTreeSection.tsx` and related
  query usage to consume root/children slices instead of a full threaded list.
- [ ] 8.2 Remove path-prefix tree assumptions from
  `package/app/src/post/models/postTreeRails.ts` and
  `package/app/src/post/hooks/usePostTreeCollapse.ts`; compose only from
  available slice rows.
- [ ] 8.3 Add a discovery renderer for ranked comment slices that shows focused
  comments with parent preview/context and an "open thread" style action.
- [ ] 8.4 Keep `anchorCommentId` as frontend-only route/local state for highlight
  and scroll behavior; do not send it as backend topology.
- [ ] 8.5 Ensure discovery pagination appends list rows, while root/children
  pagination attaches "load more replies" to one parent.
- [ ] 8.6 Update stories/tests for discovery rows, root comment entry, direct
  child expansion, redacted parent context, and sort switching.

## 9. Verification

- [ ] 9.1 Run targeted ranking tests for formula/projection changes.
- [ ] 9.2 Run targeted reaction/job-runner tests for vote bucket routing.
- [ ] 9.3 Run targeted search/Meili tests for ranking document fields and sort
  schemas.
- [ ] 9.4 Run targeted server comment tests for realm immutability, soft delete,
  slice reads, sort mapping, and ltree removal.
- [ ] 9.5 Run targeted app tests/stories for fake-tree slice rendering.
- [ ] 9.6 Run `bun run check:convention` because this changes route-facing
  contracts and cross-package exports.

## Out of scope

- Renaming the reaction domain to vote.
- Moving comments between realms or parents.
- A backend-maintained full comment tree, subtree cache, or
  `familyRootCommentId` model.
- Using `anchorCommentId` as a backend contract field.
- Full personalized ranking. `bestScore` gets a controlled rising boost only.
- Building `CommentRankServing` in v1 unless Meili serving proves insufficient
  during implementation.
- Backward compatibility with ltree/path or threaded/subtree comment list reads.
