---
title: Remove ShelfItem variantUnitId
status: done
created: 2026-06-09
completed: 2026-06-09
supersededBy:
tags: [shelf, collection, variant, database]
---

## Why

`ShelfItem.variantUnitId` survived the variant-parent collection cutover as a
weak context and legacy fallback field. During development there is no legacy
production data to protect, and the current shelf occurrence model already has a
clean identity for collected variants: the variant is its own child
`ShelfItem.itemId` under the main catalog Unit with `parentRole = "variant"`.

Remove the row-level weak context field and all shelf fallbacks that read or
write it. Keep the API-level `variantUnitId` request parameter where it means
"perform this collect/status/list operation for this variant Unit"; that value
should resolve to real child shelf-item membership, not be stored as weak context
on a root shelf item.

## Durable constraints & decisions

- `(type)` `ShelfItem` row shape no longer includes `variantUnitId`; the shelf
  item primary identity remains `(shelfId, itemType, itemId)`, and variant
  collection identity is `itemId` on a child row with `parentRole = "variant"`.
- `(type)` Remove `variantUnitId` and `variantContext` from `ShelfItemDTO`; shelf
  items do not carry variant context independently of their actual item identity.
- `(type)` Remove `variantUnitId` from direct shelf-item write inputs:
  `AddShelfItemInput` and the batch add op. Keep `CollectInput.variantUnitId`,
  shelf list query `variantUnitId`, and shelf items query `variantUnitId` because
  those are request filters/targets, not row fields.
- `(test)` Collecting `{ targetId: mainUnitId, variantUnitId }` must create or
  find the variant child row when the variant exists and points back to the main
  Unit.
- `(test)` Collecting `{ targetId: mainUnitId, variantUnitId }` with a missing
  variant or a variant that does not point back to the main Unit must fail rather
  than write an arbitrary weak context.
- `(test)` Shelf list and shelf item reads filtered by `variantUnitId` must match
  only child rows with `itemId = variantUnitId` and `parentRole = "variant"`.
- `(test)` Progress shelf links must derive variant shelf membership from direct
  child `ShelfItem.itemId` matches, not from a separate weak-context column.
- `(comment)` Collection target resolution should explain why API
  `variantUnitId` is a request target that resolves to a child shelf item, not a
  persisted weak context on the parent row.

## 1. Contracts and Shared Types

- [x] 1.1 Update `package/contract/src/shelf/shelf.ts` to remove
  `variantUnitId` and `variantContext` from `shelfItemDTOSchema`.
- [x] 1.2 Update `package/contract/src/shelf/shelf.ts` to remove
  `variantUnitId` from `addShelfItemSchema` and `shelfItemBatchAddOpSchema`.
- [x] 1.3 Keep `variantUnitId` in `collectInputSchema`,
  `shelfListQuerySchema`, `shelfListBodySchema`, and `shelfItemsQuerySchema`.
- [x] 1.4 Update `package/contract/src/shelf/shelf.test.ts` to assert the new
  boundary: shelf row DTO/write inputs do not accept row-level variant context,
  while collect and query schemas still accept `variantUnitId`.

## 2. Database Shape

- [x] 2.1 Update `package/server/src/db/schema/shelf.ts` to remove
  `ShelfItem.variantUnitId` and `ShelfItem_variantUnitId_idx`.
- [x] 2.2 Generate the Drizzle migration artifacts for dropping the column and
  index; do not hand-author ordinary migration SQL.
- [x] 2.3 Update schema snapshots and any schema exports/types that assume
  `ShelfItemRow` has `variantUnitId`.

## 3. Server Collection Semantics

- [x] 3.1 Update `package/server/src/shelf/collection.service.ts` to remove
  `legacyVariantUnitId` from `ResolvedTarget` and collection repository inputs.
- [x] 3.2 Change selected-variant target resolution so a supplied
  `variantUnitId` must resolve to a VARIANT whose `targetUnitId` equals the
  main target; otherwise throw a 400 error.
- [x] 3.3 Remove all weak-context writes from `collectToShelves`, `addItem`,
  `applyBatch`, and helper insert/upsert paths.
- [x] 3.4 Keep favorite, status, and batch-status behavior based on
  `ShelfItem.itemId` plus `parentRole = "variant"`.
- [x] 3.5 Update `package/server/src/shelf/collection.service.test.ts` to cover
  valid selected-variant collection, invalid selected-variant failure, favorite
  toggles, and status lookups without weak-context expectations.

## 4. Shelf Reads and Progress Links

- [x] 4.1 Update `package/server/src/shelf/shelf.service.ts` list filters so
  `variantUnitId` matches only child rows with `itemId = variantUnitId` and
  `parentRole = "variant"`.
- [x] 4.2 Update `package/server/src/shelf/shelf.service.ts` shelf-item paging
  so `query.variantUnitId` finds roots through variant child membership only.
- [x] 4.3 Update matched-unit hydration in `shelf.service.ts` to use child row
  `itemId` directly, with no `row.variantUnitId ?? row.unitId` fallback.
- [x] 4.4 Update `package/server/src/shelf/shelf.mapper.ts` to stop producing
  `ShelfItemDTO.variantUnitId` and `ShelfItemDTO.variantContext`.
- [x] 4.5 Keep `package/server/src/unit/variant-context.ts` for post/feed
  variant context, but remove shelf-specific imports and calls.
- [x] 4.6 Update `package/server/src/progress/progress.service.ts` so shelf
  links only match `ShelfItem.itemId` and no longer project
  `ShelfItem.variantUnitId`.
- [x] 4.7 Update `package/server/src/shelf/shelf.service.test.ts` and
  `package/server/src/progress/progress.service.test.ts` for child-only variant
  membership and remove weak-context fallback tests.

## 5. API and App Cleanup

- [x] 5.1 Update `package/api/src/shelf` types/usages to remove direct
  shelf-item `variantUnitId` write support while preserving query keys and list
  helpers for variant-targeted reads.
- [x] 5.2 Update `package/app/src/shelf`, `package/app/src/unit`, and affected
  shelf renderer/card tests so shelf items no longer expose
  `unit.variantContext`; review/post cards should rely on `Post.variantContext`
  where applicable.
- [x] 5.3 Keep `package/app/src/collection/hooks/useCollectionModal.ts`,
  `package/app/src/book-library/models/catalogEntryContext.ts`, and related
  engagement callsites passing API-level `variantUnitId` for variant-targeted
  collect/status/list behavior.

## 6. Verification

- [x] 6.1 Run focused contract tests for shelf schemas.
- [x] 6.2 Run focused server tests for shelf collection, shelf service reads,
  and progress library shelf links.
- [x] 6.3 Run focused app/API tests covering shelf query helpers,
  shelf stream/rendering, and unit-card summary behavior.
- [x] 6.4 Run repo formatting/type checks relevant to changed packages.

Verification note: focused shelf/collection/progress/app/API tests passed, as
did `task app:build`, `task server:build`, `task check:convention`, and
`task check:tokens`. Global `task format:check`, `task check:runtime-env`,
`task contract:test`, and `task api:test` still have unrelated pre-existing
failures outside this shelf cleanup.

## Out of scope

- Removing `Post.variantUnitId`, `Post.variantContext`, or feed/post variant
  filtering.
- Renaming API-level `variantUnitId` request parameters.
- Redesigning shelf cards, nested shelf tabs, or collection modal UX.
- Backfilling or preserving legacy shelf rows that stored variants only in
  `ShelfItem.variantUnitId`.
