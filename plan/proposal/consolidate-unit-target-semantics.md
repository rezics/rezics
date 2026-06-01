---
title: Consolidate Unit Target Semantics
status: active
created: 2026-06-01
completed:
supersededBy:
tags: [unit, target, post, search, governance, catalog]
---

## Why

Many domains currently mint their own `targetUnitId` or target-shaped fields
even when the relation means the same thing: this Unit resolves, aggregates, or
is "about" another Unit. `Post.targetUnitId` is the clearest duplicate, but the
same confusion shows up around chapter posts, search documents, catalog variants,
shelf/review parent resolution, and feature code that must know each extension
table's private target field. Meanwhile `Unit.targetUnitId` already exists, but
its comments and tests narrowly describe catalog variants, so other domains avoid
using it and recreate target indexes locally.

Make `Unit.targetUnitId` the canonical weak target edge for a Unit's primary
interaction/aggregation target. Keep domain-owned target fields only when they
represent a row-to-row operation, tree topology, moderation/audit event target,
or containment structure rather than the Unit's own canonical target.

## Durable constraints & decisions

- `(type)` `Unit.targetUnitId` is the canonical weak target for a Unit. It means
  the source Unit's normal interactions, aggregation, or "about" relation resolve
  to another Unit. It is no longer catalog-variant-only.
- `(type)` `catalogEntryKind` remains catalog discovery metadata. `VARIANT`
  Units must still carry `Unit.targetUnitId`, but `POST`, `COMMENT`, and other
  interactable Units may also carry `Unit.targetUnitId` when they have a primary
  aggregation target.
- `(type)` Remove duplicate canonical target columns from extension tables where
  the source row is already a Unit extension. `Post.targetUnitId` is the first
  cutover target; chapter/review/excerpt/remark reads must use the owning
  `Unit.targetUnitId` through the `Post.unit` relation or a projection.
- `(comment)` `Unit.targetUnitId` is a weak edge, not a tree edge. Do not use it
  for parent/child traversal, subtree membership, per-realm partitions, or
  ordered containment.
- `(type)` Keep `Comment.rootUnitId`, `Comment.realmUnitId`,
  `Comment.parentCommentUnitId`, `Comment.depth`, and `Comment.path` in the
  comment domain. Those fields are strong discussion topology and cannot be
  collapsed into a single Unit target.
- `(type)` Keep `ContentStructure.ownerUnitId`,
  `ContentStructureNode.contentUnitId`, and `ContentStructureAnchor` fields in
  the content-structure domain. They model reusable occurrences, owner-specific
  hierarchy, node identity, path, and sort order rather than canonical Unit
  target resolution.
- `(type)` Keep relation-table target fields for operation edges:
  `Subscription.targetUnitId`, `Reaction.targetId`,
  `UserTagApplication.unitId`, `RealmTagApplication.unitId`,
  `ContentModerationState.targetUnitId`, `RealmContentModeration.targetUnitId`,
  `CommentPromotion.commentUnitId`, and `ShelfUnitRelation` parent/child fields.
  These rows are edges/actions whose target is the row's other endpoint; they do
  not describe the target Unit's own canonical target.
- `(comment)` Moderation queue/case/audit `targetKind`/`targetId` plus optional
  `targetUnitId` remain event addressing and history. They may index Unit targets
  for lookup, but must not be treated as canonical Unit target ownership.
- `(test)` Post creation persists the submitted target on `Unit.targetUnitId`,
  returns it through post DTO/search projections, and does not write a duplicate
  `Post.targetUnitId`.
- `(test)` Post list/search by target filters through `Unit.targetUnitId` and
  continues to return only root posts; comment hits remain in the comment index.
- `(test)` Catalog generic search still hides variants by default and exact
  variant search still filters by `Unit.catalogEntryKind = VARIANT` plus
  `Unit.targetUnitId`, even after `Unit.targetUnitId` is generalized.
- `(test)` Tags, collections, subscriptions, reactions, and moderation states
  target the resolved interaction Unit that callers chose; they do not silently
  follow `Unit.targetUnitId` unless the specific service already resolved the
  target before writing.

## Tasks

## 1. Inventory And Invariants

- [ ] 1.1 Update `package/server/prisma/schema.prisma` comments around
  `Unit.targetUnitId` and `catalogEntryKind` so the field is documented as the
  canonical weak Unit target, with catalog variants as one required use case.
- [ ] 1.2 Update `package/contract/src/unit/unit.ts` comments/tests so
  `targetUnitId` is valid for non-variant Units, while retaining tests that
  `VARIANT` requires a target and generic content search treats variants
  specially.
- [ ] 1.3 Add a focused schema/contract test matrix classifying target-like
  fields as canonical Unit target, operation edge, topology edge, structure edge,
  provenance source, or audit/event address.

## 2. Move Post Target To Unit

- [ ] 2.1 Add a migration that backfills `Unit.targetUnitId` from
  `Post.targetUnitId` for existing posts whose Unit target is null, without
  overwriting existing catalog/interaction targets.
- [ ] 2.2 Update `PostService.create` and chapter materialization so post,
  review, remark, excerpt, wiki, and chapter target writes set the owning
  `Unit.targetUnitId` in the same transaction as the `Post` row.
- [ ] 2.3 Update post read includes, mapper, contract DTO population, and app/API
  adapters so `PostDTO.targetUnitId` is projected from `post.unit.targetUnitId`
  during the compatibility window.
- [ ] 2.4 Update `PostService.list`, realm feed queries, chapter queries, shelf
  review-parent resolution, and moderation overlay request builders to filter or
  select post targets through `Unit.targetUnitId`.
- [ ] 2.5 Update `package/search/src/sync.ts`, `package/contract/src/meili/post.ts`,
  and `package/server/src/meili/post` so post search documents carry target data
  from `Unit.targetUnitId`, not `Post.targetUnitId`.
- [ ] 2.6 Drop `Post.targetUnitId` and its indexes after all internal callsites
  use `Unit.targetUnitId`.

## 3. Finish Removing Post Tree Residue

- [ ] 3.1 Drop `Post.rootPostUnitId`, `Post.parentPostUnitId`, `Post.depth`,
  `Post.path`, and their indexes once post target reads no longer depend on the
  legacy reply cutoff.
- [ ] 3.2 Remove root-post path writes and self-root writes from
  `PostService.create`.
- [ ] 3.3 Replace `parentPostUnitId = null` root-only guards in server/search
  code with the invariant that `Post` contains only root submissions.
- [ ] 3.4 Remove `depth` and `path` from `PostDTO` and post search/UI adapters;
  keep threaded rendering on `CommentDTO`.
- [ ] 3.5 Delete post-as-comment compatibility helpers after app thread reads
  consume comments directly.

## 4. Preserve Domain Targets That Should Stay Local

- [ ] 4.1 Add or update comments/tests around `Comment` proving comment topology
  remains `rootUnitId + realmUnitId + parentCommentUnitId + path`, independent
  of `Unit.targetUnitId`.
- [ ] 4.2 Add or update comments/tests around `ContentStructure` proving owner
  structure and reusable content occurrences are not canonical Unit targets.
- [ ] 4.3 Add regression tests for `Subscription`, reactions, user tags, realm
  tags, and moderation states proving those row targets do not auto-follow
  `Unit.targetUnitId` after write.
- [ ] 4.4 Update naming comments in governance and notification boundaries so
  event/audit/source target fields are clearly operation/event addresses, not
  canonical Unit target fields.

## 5. Search And Projection Cleanup

- [ ] 5.1 Update content search projections so `ContentSearchDocument.targetUnitId`
  continues to read from `Unit.targetUnitId` and the generalized semantics are
  documented in tests.
- [ ] 5.2 Update post search filters and ranking patch paths to avoid relying on
  post extension target columns.
- [ ] 5.3 Add target-query regression tests for book/game/media pages querying
  posts, reviews, excerpts, chapters, and comments through the intended split:
  posts by `Unit.targetUnitId`, comments by `Comment.rootUnitId` or content
  anchors.

## 6. Cleanup And Migration Verification

- [ ] 6.1 Add migration verification that no remaining `Post` row has target/tree
  data outside the owning `Unit` and that all target-bearing posts have a matching
  `Unit.targetUnitId`.
- [ ] 6.2 Remove obsolete comments in plans/code that say only `VARIANT` Units may
  carry `targetUnitId`.
- [ ] 6.3 Run focused tests for contract unit/post/comment schemas, post service,
  chapter service, search sync, content search, governance overlays, and shelf
  collection review parent resolution.

## Out of scope

- Do not introduce a generic `UnitEdge` table in this change. A single canonical
  `Unit.targetUnitId` remains enough until the product needs multiple concurrent
  weak target kinds for one Unit.
- Do not collapse comment topology, content-structure topology, shelf relations,
  subscriptions, reactions, tag applications, or moderation/audit event targets
  into `Unit.targetUnitId`.
- Do not redesign catalog variant discovery, Series membership, realm membership,
  or moderation state semantics beyond clarifying how their target fields differ
  from canonical Unit target resolution.
