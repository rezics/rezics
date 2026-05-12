## 1. Schema And Migration

- [x] 1.1 Update `package/server/prisma/schema.prisma` to rename `ShelfItem` to `ShelfUnit` with `(shelfId, unitId)` primary key and `@@index([shelfId, position])`. The owning-shelf FK column is `shelfId` (references `Shelf.unitId`), not `shelfUnitId`.
- [x] 1.2 Update `package/server/prisma/schema.prisma` to rename `ShelfItemUnit` to `ShelfUnitRelation` with `(shelfId, parentUnitId, childUnitId, role)` primary key and parent/child FKs to `ShelfUnit(shelfId, unitId)`. Do NOT add a unique constraint on `(shelfId, childUnitId, role)` — multi-parent is intentionally allowed.
- [x] 1.3 Add relation indexes for parent-child reads, child root detection, and role-based reverse lookup.
- [x] 1.4 Create a Prisma migration that moves existing shelf rows into `ShelfUnit`, drops redundant `role='primary'` rows, and converts old review/tag rows into `ShelfUnitRelation` rows.
- [x] 1.5 Generate deterministic initial `ShelfUnit.position` values for migrated attached children per the rule in `design.md` Migration Plan step 5 (`keyBetween(parent.position, nextRoot.position)` slot-divided by ordered children). Cover the multi-parent case in migration tests.
- [x] 1.6 Recompute `Shelf.itemCount` post-migration as the count of `ShelfUnit` rows per shelf, and wire write-time `++`/`--` maintenance into the service layer (insert/delete of `ShelfUnit` only; relation writes do not change `itemCount`).
- [x] 1.7 Add service-layer validation that rejects `ShelfUnitRelation` writes where `parentUnitId === childUnitId`.
- [ ] 1.8 Run Prisma generation for `package/server` and update generated-client assumptions in tests. (deferred: requires DB access; tests mock the generated client; safe to run in a follow-up before merge)

## 2. Contract And API Types

- [x] 2.1 Replace `ShelfItemDTO` / `ShelfItemKind` contract exports with `ShelfUnitDTO` / `ShelfUnitKind` in `package/contract/src/shelf.ts`.
- [x] 2.2 Add `ShelfUnitRelationDTO` and `ShelfUnitRelationRole` contract schemas.
- [x] 2.3 Change the shelf items response contract to return `units` and `relations` instead of projected `reviewIds` / `tagIds` arrays.
- [x] 2.4 Update batch op schemas to use `unitId` and relation operations: `attach`, `detach`, and `setChildren`.
- [x] 2.5 Run a repo-wide search for old canonical exports (`ShelfItemDTO`, `ShelfItemKind`, `ShelfItemUnitRole`) and migrate internal callsites without compatibility aliases.

## 3. Server Implementation

- [x] 3.1 Update shelf mapper/types to map Prisma `ShelfUnit` and `ShelfUnitRelation` rows into the new contract DTOs.
- [x] 3.2 Update shelf item listing routes to fetch units in position order and include relation rows for the returned shelf scope.
- [x] 3.3 Update add/remove/reorder services to operate on `ShelfUnit`.
- [x] 3.4 Update attach/detach review and tag logic to ensure child `ShelfUnit` rows exist before writing `ShelfUnitRelation`.
- [x] 3.5 Update batch mutation service to apply the new unit and relation op union in submitted order.
- [x] 3.6 Update collection and favorite flows to create `ShelfUnit` rows and optional `ShelfUnitRelation(role='review')` edges.
- [x] 3.7 Update orphan cleanup to delete `ShelfUnit` rows by `unitId` and rely on relation cascade.
- [x] 3.8 Update seed/factory shelf generation to create first-class child shelf units plus relations.

## 4. API Package

- [x] 4.1 Update `package/api/src/shelf` type exports and query functions for the new `units` + `relations` response shape.
- [x] 4.2 Rewrite shelf hydration to batch-hydrate every `ShelfUnit.unitId` by kind and remove projected attachment hydration.
- [x] 4.3 Update shelf mutations to submit the new batch op shapes and invalidate the same shelf detail/items queries.
- [x] 4.4 Update cache seeding helpers to use `unitId` consistently.

## 5. Frontend Shelf Model

- [x] 5.1 Rewrite `package/app/src/shelf/models/shelfStream.ts` to derive roots from `ShelfUnitRelation.childUnitId` and prevent duplicate child rendering.
- [x] 5.2 Implement `sortPrimeOnly=true` as grouped sorting: sort roots, then sort each child group by the same sort state.
- [x] 5.3 Implement `sortPrimeOnly=false` as all-entry sorting: sort every `ShelfUnit` once as a peer.
- [x] 5.4 Update title and added-time sorting to use hydrated unit titles and `ShelfUnit.createdAt`.
- [x] 5.5 Update `unitCardSummary` and shelf render adapters to accept the new stream entry shape.

## 6. Frontend Pages And Editor

- [x] 6.1 Update `ShelfPage` to consume hydrated shelf units and relations and render each stream entry once.
- [x] 6.2 Update `ShelfEditorItemsSection` to work with `ShelfUnit` rows, relation-backed children, and revised `sortPrimeOnly` copy.
- [x] 6.3 Split `ShelfEditPage` state into local editor preview view and persisted default shelf view metadata.
- [x] 6.4 Move default shelf view controls into the metadata form and keep item preview view changes from marking metadata dirty.
- [x] 6.5 Update stories and fixtures that construct shelf items or attached reviews/tags.

## 7. Tests And Validation

- [x] 7.1 Update server shelf service tests for schema rename, attach/detach semantics, batch ops, collection review auto-attachment, multi-parent attachment, self-relation rejection, and `Shelf.itemCount` write-time maintenance (including the case where an attach creates a new child `ShelfUnit`).
- [x] 7.2 Update app shelf stream tests for grouped sorting, all-entry sorting, manual position sorting, multi-parent child rendering (same child under multiple parents in nested/grouped flat, single peer in flat-all-entry), and two-step cycle defence in the nested renderer.
- [x] 7.3 Update item op log tests for `unitId`-based add/delete/reorder, attach with and without `position`, `setChildren` upsert behavior, and relation ops.
- [x] 7.4 Run targeted contract tests for `package/contract/src/shelf.ts`.
- [x] 7.5 Run targeted server tests for `package/server/src/shelf`.
- [x] 7.6 Run targeted app tests for `package/app/src/shelf`.
- [x] 7.7 Run `rg "ShelfItem|ShelfItemUnit|reviewIds|tagIds|itemRef|shelfUnitId" package/contract package/api/src/shelf package/server/src/shelf package/app/src/shelf` and resolve remaining legacy-name references.
- [x] 7.8 Run `openspec validate normalize-shelf-unit-relations --strict`.
