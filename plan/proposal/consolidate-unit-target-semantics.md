---
title: Consolidate Unit Target Semantics
status: active
created: 2026-06-01
completed:
supersededBy:
tags: [unit, target, post, search, governance, catalog]
---

## Why

Many domains currently mint their own `targetUnitId` or target-shaped fields.
Some mean the same thing: this Unit resolves, aggregates, or is "about" another
Unit. Others are operation endpoints, moderation event addresses, or topology
edges but still use the same generic name. `Post.targetUnitId` is the clearest
duplicate, but the same confusion shows up around chapter posts, search
documents, catalog variants, shelf/review parent resolution, subscriptions,
moderation states/cases/queues, and contract/API fields that call any endpoint a
target. Meanwhile `Unit.targetUnitId` already exists, but its comments, Prisma
relation names, and indexes narrowly describe catalog variants, so other domains
avoid using it and recreate target indexes locally.

Make `Unit.targetUnitId` the canonical weak target edge for a Unit's primary
interaction/aggregation target. Then remove generic `targetUnitId` from other
persisted models: duplicate Unit-extension targets move to `Unit.targetUnitId`,
and non-canonical row endpoints are renamed to domain-specific fields so the
schema says what the row actually owns.

## Durable constraints & decisions

- `(type)` `Unit.targetUnitId` is the canonical weak target for a Unit. It means
  the source Unit's normal interactions, aggregation, or "about" relation resolve
  to another Unit. It is no longer catalog-variant-only.
- `(schema)` `Unit.targetUnitId` is the only persisted column allowed to use the
  generic canonical name. Other tables may project it in DTO/search documents,
  but storage fields must be either the owning Unit target itself or a
  domain-named endpoint such as `commentUnitId`, `subscribedUnitId`,
  `moderatedUnitId`, `parentUnitId`, `childUnitId`, or `contentUnitId`.
- `(schema)` Prisma relation names and database index names around
  `Unit.targetUnitId` must not be catalog-specific. Rename `catalogTarget` /
  `catalogVariants` relation surfaces and replace the over-specialized
  `catalogEntryKind,targetUnitId`-only indexing story with generic
  `targetUnitId` indexes plus a catalog-specific composite only where exact
  variant discovery needs it.
- `(type)` `catalogEntryKind` remains catalog discovery metadata. `VARIANT`
  Units must still carry `Unit.targetUnitId`, but `POST` and other Unit
  extensions may carry `Unit.targetUnitId` only when they already have a
  product-backed primary aggregation target. Comments remain on comment topology
  unless a later plan proves a separate canonical Unit target is needed.
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
- `(type)` Keep existing relation/operation models, but do not keep their generic
  target naming when the row owns a specific endpoint:
  `Subscription.targetUnitId` becomes a subscription endpoint name,
  `ContentModerationState.targetUnitId` / `RealmContentModeration.targetUnitId`
  become moderation endpoint names, comment promotion API fields become
  `commentUnitId`, and shelf/content/comment topology keeps its existing
  domain-specific endpoint fields.
- `(comment)` Moderation queue/case/audit `targetKind`/`targetId` remain event
  addressing and history. Their optional Unit lookup field must be renamed or
  wrapped as an addressed/affected Unit endpoint, not treated as canonical Unit
  target ownership.
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

## Draft Schema Comment

Move this draft into `package/server/prisma/schema.prisma` during apply, trimming
only if the surrounding model context makes part of it redundant.

```prisma
  /// Canonical weak target edge for this Unit.
  ///
  /// Use this when the source Unit's normal interactions, aggregation, or
  /// "about" relation resolve to another Unit.
  ///
  /// Model-level examples:
  /// - Unit rows with `catalogEntryKind = VARIANT` point to the main catalog Unit.
  /// - Unit rows with `type = POST` use this as the owning Post extension's
  ///   aggregation target; `Post.kind` decides whether that POST behaves as a
  ///   review, remark, chapter, excerpt, wiki entry, or generic post.
  ///
  /// The target belongs to the owning Unit, not to the extension row. For
  /// example, `Post` stores post-specific fields such as `kind`, `content`,
  /// lifecycle, and score data; it must not duplicate this canonical target in
  /// `Post.targetUnitId`.
  ///
  /// This is not ownership, containment, ordering, discussion topology, realm
  /// membership, moderation state, or a generic edge table. Rows that own those
  /// domain endpoints must use domain-specific field names.
  ///
  /// Storage rule: this is the only persisted column that may use the generic
  /// `targetUnitId` name. Other models may project this value at DTO/search
  /// boundaries, but must not duplicate it as their own canonical target.
  targetUnitId String? @db.Uuid

  targetUnit   Unit?  @relation("UnitTarget", fields: [targetUnitId], references: [id], onDelete: SetNull)
  targetedUnits Unit[] @relation("UnitTarget")

  // Generic target lookup for "Units about X" across catalog variants, POST
  // extension rows, and any future Unit extension with a product-backed
  // aggregation target. Keep this independent of catalogEntryKind so target
  // scans are not accidentally catalog-only.
  @@index([targetUnitId], map: "Unit_targetUnitId_idx")

  // Catalog-specific variant lookup. This is a consumer of Unit.targetUnitId,
  // not the definition of the field's semantics.
  @@index([catalogEntryKind, targetUnitId], map: "Unit_catalogEntryKind_targetUnitId_idx")
```

## Tasks

## 1. Inventory And Invariants

- [x] 1.1 Move the draft schema comment for `Unit.targetUnitId` into
  `package/server/prisma/schema.prisma`, documenting the field from the owning
  `Unit` model's perspective and keeping catalog variants as one required use
  case rather than the definition.
- [x] 1.2 Rename Prisma relation surfaces around `Unit.targetUnitId` from
  catalog-specific names to canonical target names, and add migration/tests for
  generic target indexes before removing any extension-table target indexes.
- [x] 1.3 Update `package/contract/src/unit/unit.ts` comments/tests so
  `targetUnitId` is valid for non-variant Units, while retaining tests that
  `VARIANT` requires a target and generic content search treats variants
  specially.
- [x] 1.4 Add a focused schema/contract test matrix classifying target-like
  fields as canonical Unit target, operation edge, topology edge, structure edge,
  provenance source, or audit/event address.

## 2. Move Post Target To Unit

- [x] 2.1 Add a migration that backfills `Unit.targetUnitId` from
  `Post.targetUnitId` for existing posts whose Unit target is null, without
  overwriting existing catalog/interaction targets.
- [x] 2.2 Update `PostService.create` and chapter materialization so post,
  review, remark, excerpt, wiki, and chapter target writes set the owning
  `Unit.targetUnitId` in the same transaction as the `Post` row.
- [x] 2.3 Update post read includes, mapper, contract DTO population, and app/API
  adapters so `PostDTO.targetUnitId` is projected from `post.unit.targetUnitId`
  during the compatibility window.
- [x] 2.4 Update `PostService.list`, realm feed queries, chapter queries, shelf
  review-parent resolution, and moderation overlay request builders to filter or
  select post targets through `Unit.targetUnitId`.
- [x] 2.5 Update `package/search/src/sync.ts`, `package/contract/src/meili/post.ts`,
  and `package/server/src/meili/post` so post search documents carry target data
  from `Unit.targetUnitId`, not `Post.targetUnitId`.
- [x] 2.6 Drop `Post.targetUnitId` and its indexes after all internal callsites
  use `Unit.targetUnitId`.

## 3. Rename Non-Canonical Target Endpoints

- [x] 3.1 Rename `Subscription.targetUnitId` through Prisma, contract, API,
  notification, account-data export, and app query layers to a subscription
  endpoint name such as `subscribedUnitId`, with compatibility adapters only at
  route boundaries.
- [x] 3.2 Rename `ContentModerationState.targetUnitId` and
  `RealmContentModeration.targetUnitId` to moderation endpoint names such as
  `moderatedUnitId`, preserving existing primary keys and indexes under clearer
  names.
- [x] 3.3 Rename optional moderation queue/case Unit lookup fields away from
  generic `targetUnitId`, while keeping `targetKind`/`targetId` as immutable
  event addresses.
- [x] 3.4 Rename comment promotion request/DTO fields from `targetUnitId` to
  `commentUnitId`, matching the existing `CommentPromotion.commentUnitId`
  storage model.
- [ ] 3.5 Audit remaining contract/API/search fields named `targetUnitId` and
  mark each one as either a compatibility projection of `Unit.targetUnitId` or a
  domain endpoint that must be renamed.

## 4. Finish Removing Post Tree Residue

- [ ] 4.1 Drop `Post.rootPostUnitId`, `Post.parentPostUnitId`, `Post.depth`,
  `Post.path`, and their indexes once post target reads no longer depend on the
  legacy reply cutoff.
- [ ] 4.2 Remove root-post path writes and self-root writes from
  `PostService.create`.
- [ ] 4.3 Replace `parentPostUnitId = null` root-only guards in server/search
  code with the invariant that `Post` contains only root submissions.
- [ ] 4.4 Remove `depth` and `path` from `PostDTO` and post search/UI adapters;
  keep threaded rendering on `CommentDTO`.
- [ ] 4.5 Delete post-as-comment compatibility helpers after app thread reads
  consume comments directly.

## 5. Preserve Domain Endpoints That Should Stay Local

- [x] 5.1 Add or update comments/tests around `Comment` proving comment topology
  remains `rootUnitId + realmUnitId + parentCommentUnitId + path`, independent
  of `Unit.targetUnitId`.
- [x] 5.2 Add or update comments/tests around `ContentStructure` proving owner
  structure and reusable content occurrences are not canonical Unit targets.
- [ ] 5.3 Add regression tests for subscriptions, reactions, user tags, realm
  tags, and moderation states proving those row endpoints do not auto-follow
  `Unit.targetUnitId` after write.
- [ ] 5.4 Update naming comments in governance and notification boundaries so
  event/audit/source endpoint fields are clearly operation/event addresses, not
  canonical Unit target fields.

## 6. Search And Projection Cleanup

- [x] 6.1 Update content search projections so `ContentSearchDocument.targetUnitId`
  continues to read from `Unit.targetUnitId` and the generalized semantics are
  documented in tests.
- [x] 6.2 Update post search filters and ranking patch paths to avoid relying on
  post extension target columns.
- [ ] 6.3 Add target-query regression tests for book/game/media pages querying
  posts, reviews, excerpts, chapters, and comments through the intended split:
  posts by `Unit.targetUnitId`, comments by `Comment.rootUnitId` or content
  anchors.

## 7. Cleanup And Migration Verification

- [ ] 7.1 Add migration verification that no remaining `Post` row has target/tree
  data outside the owning `Unit` and that all target-bearing posts have a matching
  `Unit.targetUnitId`.
- [ ] 7.2 Add migration verification that no persisted non-Unit model keeps a
  generic `targetUnitId` column unless it has an explicit documented exemption.
- [ ] 7.3 Remove obsolete comments in plans/code that say only `VARIANT` Units may
  carry `targetUnitId`.
- [ ] 7.4 Run focused tests for contract unit/post/comment/subscription/governance
  schemas, post service, chapter service, search sync, content search,
  governance overlays, and shelf collection review parent resolution.

## Out of scope

- Do not introduce a generic `UnitEdge` table in this change. A single canonical
  `Unit.targetUnitId` remains enough until the product needs multiple concurrent
  weak target kinds for one Unit.
- Do not collapse comment topology, content-structure topology, shelf relations,
  subscriptions, reactions, tag applications, or moderation/audit event endpoints
  into `Unit.targetUnitId`; rename/reuse their existing models instead of
  replacing them with a new generic edge model.
- Do not redesign catalog variant discovery, Series membership, realm membership,
  or moderation state semantics beyond clarifying how their target fields differ
  from canonical Unit target resolution.
