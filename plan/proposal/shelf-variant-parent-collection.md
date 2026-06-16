---
title: Shelf Variant Parent Collection
status: done
created: 2026-06-09
completed: 2026-06-09
supersededBy:
tags: [shelf, collection, variant, frontend]
---

## Why

Shelf collection currently stores selected variants as `ShelfItem.variantUnitId`
on the root item row. That keeps the shelf occurrence model simple for one
variant, but the row identity is still `(shelfId, itemType, itemId)`, so
collecting a second variant of the same main catalog Unit overwrites the first
variant context. It also makes variant collection diverge from review
collection, where the target work is the root and the review is attached as a
child.

Move variant collection onto the same parent mechanism as review collection:
collecting a variant ensures the main catalog Unit exists as the root shelf item
and attaches the selected variant as a child shelf item. Nested/root-first shelf
views can then prefer the main work, while variant-specific status and shelf
queries can look for the child occurrence directly. Keep `variantUnitId` as weak
context for posts/reviews/excerpts and compatibility, not as the identity of a
collected variant.

## Durable constraints & decisions

- `(type)` Add `"variant"` to shelf item parent roles. The shelf relation shape
  should represent attached variants the same way it represents attached
  reviews, comments, tags, and annotations.
- `(comment)` `variantUnitId` remains a weak context field. It is useful for
  review/post/excerpt/comment context and existing progress/query integrations,
  but a collected variant's identity must live in child `ShelfItem.itemId`.
- `(test)` Collecting a variant creates or keeps the main catalog Unit as the
  root shelf item and creates the variant Unit as a child with
  `parentRole = "variant"`.
- `(test)` Collecting two variants of the same main Unit into one shelf keeps one
  main root and two variant child items; neither variant overwrites the other.
- `(test)` Collection status for a variant is based on the variant child
  occurrence, while collection status for a main Unit remains based on the root
  occurrence.
- `(test)` Removing/toggling a favorite for a variant removes the variant child
  occurrence without incorrectly removing the main root when other children or a
  direct main collection still need it.
- `(test)` Shelf list filters for a variant find shelves through direct variant
  child membership and continue to tolerate legacy `variantUnitId` rows during
  rollout.
- `(test)` Nested shelf tabs never render arbitrary child titles as tab labels.
  Review and variant tabs use short stable labels; long titles remain inside the
  rendered child card, tooltip, or detail content.
- `(comment)` `independent` collection mode remains review-specific. Variant
  collection follows catalog interaction semantics: normal interactions from a
  VARIANT resolve to the main catalog Unit, with the selected variant attached as
  context/child.

## 1. Contracts and Shared Types

- [x] 1.1 Update `package/contract/src/shelf/shelf.ts` to include `"variant"`
  in `shelfItemParentRoleSchema` and exported parent-role types.
- [x] 1.2 Update `package/contract/src/shelf/shelf.test.ts` to cover variant
  parent-role DTO/input acceptance and to keep `variantUnitId` optional weak
  context behavior explicit.
- [x] 1.3 Update any shelf identity or meili contract tests that enumerate
  parent roles, especially `package/contract/src/meili/shelf-item.ts` and
  `package/contract/src/meili/shelf-item.test.ts` if they mirror role values.

## 2. Server Collection Semantics

- [x] 2.1 Extend `ResolvedTarget` and `BatchResolvedTarget` in
  `package/server/src/shelf/collection.service.ts` with optional variant child
  fields distinct from review child fields.
- [x] 2.2 Update collection target resolution so `targetId` being a catalog
  VARIANT resolves to `{ parentUnitId: targetUnitId, variantUnitId: targetId }`.
- [x] 2.3 Update collection target resolution for the existing
  `{ targetId: main, variantUnitId }` path to attach the variant child when the
  variant belongs to that main Unit; keep legacy weak-context fallback only where
  the variant cannot be resolved as a real Unit.
- [x] 2.4 Update `collectToShelves` to insert the main root first, then insert or
  upsert the variant child with `parentRole = "variant"` without overwriting
  existing variant children for the same main Unit.
- [x] 2.5 Update favorite add/remove/toggle paths so variant favorites operate on
  the variant child occurrence and preserve the main root when required by direct
  main collection, other variant children, or review children.
- [x] 2.6 Update collection status and batch status queries so variant targets
  report shelf membership from variant child rows; retain main Unit status from
  root rows.
- [x] 2.7 Add or update tests in
  `package/server/src/shelf/collection.service.test.ts` for variant resolution,
  multi-variant collection, variant favorite toggle, and status/batch-status
  behavior.

## 3. Shelf Reads and Search

- [x] 3.1 Update `package/server/src/shelf/shelf.service.ts` list filtering so
  `variantUnitId` matches both new child rows (`itemId = variantUnitId`,
  `parentRole = "variant"`) and legacy weak-context rows
  (`variantUnitId = variantUnitId`).
- [x] 3.2 Update matched-unit hydration in `shelf.service.ts` so variant-filtered
  shelf cards can show the matched variant from child membership without
  confusing the main root identity.
- [x] 3.3 Update `getShelfItems` hydration in `shelf.service.ts` if needed so
  variant children return enough Unit data for the renderer and relation
  derivation paths.
- [x] 3.4 Update shelf service tests in
  `package/server/src/shelf/shelf.service.test.ts` for variant child filtering,
  matched variant display, and legacy `variantUnitId` fallback.
- [x] 3.5 Update shelf item search projection code and tests in
  `package/search/src/shelf-item.ts`,
  `package/search/src/shelf-item.sync.test.ts`, and
  `package/contract/src/meili/shelf-item.test.ts` if parent roles or variant
  membership are serialized into Meilisearch documents.

## 4. Frontend Collection and Display

- [x] 4.1 Update `package/app/src/collection/hooks/useCollectionModal.ts` and
  callsites such as `package/app/src/engagement/hooks/useShelfTrigger.ts` so
  variant collection status opens against the variant target where appropriate
  while still submitting the main/variant pair needed by the server.
- [x] 4.2 Update
  `package/app/src/book-library/models/catalogEntryContext.ts` and
  `ShelfByBookPreview` callsites if query filters need to distinguish main
  containment from variant child membership.
- [x] 4.3 Update `package/app/src/shelf/models/shelfStream.ts` tests to cover
  `parentRole = "variant"` children under a main root.
- [x] 4.4 Update
  `package/app/src/shelf/components/ShelfItemRenderer.tsx` so nested tabs include
  variant children and use short stable labels for both review and variant tabs,
  never raw titles.
- [x] 4.5 Update shelf renderer/unit-card tests or stories where they assert
  attachment counts, tab labels, or variant context display.

## 5. Compatibility and Cleanup

- [x] 5.1 Keep `ShelfItem.variantUnitId` schema and API fields in place for weak
  context and legacy reads; do not remove the column in this change.
- [x] 5.2 Add focused comments at the collection resolver and `variantUnitId`
  contract/schema sites explaining why collected variant identity is child
  `itemId`, not `variantUnitId`.
- [x] 5.3 Run focused tests for contract shelf schemas, server shelf collection,
  shelf service filtering, shelf stream derivation, and affected app unit tests.

## Out of scope

- Backfilling existing shelf rows into variant child rows.
- Removing `ShelfItem.variantUnitId` or `Post.variantUnitId`.
- Changing progress/rating semantics; those may still target variants directly.
- Redesigning shelf cards, review cards, or the full collection modal UX beyond
  the tab-label and variant-status changes needed here.
