## Context

Shelf currently models a visible row as `ShelfItem` and binds units to that row through `ShelfItemUnit` roles. This works for a slot-centric model, but flat and editor surfaces now treat attached reviews/tags as rows. The schema does not give those attached rows their own `position`, so manual sorting and `sortPrimeOnly` semantics become ambiguous.

The target model separates two concepts:

- `ShelfUnit`: every unit contained by a shelf, with `position`, `kind`, timestamps, and render identity.
- `ShelfUnitRelation`: a parent-child edge between two shelf units in the same shelf, with a `role` such as `review` or `tag`.

The change spans `package/server`, `package/contract`, `package/api`, and `package/app`. It is an internal development-stage breaking cutover; all callsites should move to the new names and DTOs in one implementation pass.

## Goals / Non-Goals

**Goals:**

- Make every rendered shelf unit sortable through one field: `ShelfUnit.position`.
- Keep relation rows free of ordering semantics.
- Prevent duplicate rendering of attached children.
- Preserve efficient shelf reads with B-tree indexes on `(shelfUnitId, position)` and relation lookups by parent/child.
- Simplify frontend stream derivation by hydrating a unified shelf unit list and applying relations afterward.
- Move persisted default shelf view editing into the metadata area while keeping editor view switching local.

**Non-Goals:**

- Do not introduce `ShelfUnitRelation.position`, relation array order, or attachment-order semantics.
- Do not introduce compatibility aliases for `ShelfItem` / `ShelfItemUnit` names.
- Do not add a generic cross-domain `UnitEdge` table.
- Do not redesign the shelf visual presentation beyond necessary controls and labels.

## Decisions

### Decision: Rename the contained row to `ShelfUnit`

`ShelfUnit` will contain:

- `shelfUnitId`
- `unitId`
- `kind`
- `position`
- `createdAt`
- `updatedAt`

The primary key will be `(shelfUnitId, unitId)`. A unit can appear at most once in a shelf. The `kind` field remains a write-time render discriminator.

Alternatives considered:

- Keep `ShelfItem.itemRef`: rejected because `itemRef` still reads like a slot pointer and does not make attached rows feel first-class.
- Add position to `ShelfItemUnit`: rejected because relation rows would mix edge semantics with item ordering.

### Decision: Rename the edge table to `ShelfUnitRelation`

`ShelfUnitRelation` will contain:

- `shelfUnitId`
- `parentUnitId`
- `childUnitId`
- `role`

The parent and child will both reference `ShelfUnit(shelfUnitId, unitId)` with cascade delete. The relation primary key will be `(shelfUnitId, parentUnitId, childUnitId, role)`.

Indexes should support:

- children for a parent: `(shelfUnitId, parentUnitId, role)`
- parent lookup for duplicate-prevention/root detection: `(shelfUnitId, childUnitId)`
- reverse lookup for collection status: `(childUnitId, role)` and `(parentUnitId, role)` only if the server needs cross-shelf status queries by role

Alternatives considered:

- Keep `role='primary'`: rejected as redundant. Containment is represented by `ShelfUnit`; only parent-child relationships need relation rows.
- Generic `UnitEdge`: rejected because shelf relations are shelf-scoped and must reference shelf-contained rows, not arbitrary global units.

### Decision: DTOs return units and relations

The shelf items endpoint will return:

- `units: ShelfUnitDTO[]`
- `relations: ShelfUnitRelationDTO[]`
- pagination metadata for the unit list

`reviewIds` and `tagIds` projection arrays will be removed from `ShelfUnitDTO`. Frontend hydration will group all `ShelfUnitDTO.unitId` values by `kind`, fetch their DTOs in batches, and then derive parent-child presentation from `relations`.

Alternatives considered:

- Keep projected `reviewIds` / `tagIds`: rejected because it hides child rows from sorting and forces attachment-specific frontend logic.

### Decision: Rendering derives roots from relations

The frontend stream derivation will compute:

- `childUnitIds = Set(rel.childUnitId)`
- `roots = units.filter(unit => !childUnitIds.has(unit.unitId))`
- `childrenByParent = Map(parentUnitId, ShelfUnit[])`

Nested/grouped modes render roots once, then each root's children once. Flat all-entry mode renders all units once. A unit that appears as a child must not also appear as a root in grouped streams.

If a unit has multiple parents in the same shelf, the implementation should treat that as invalid data for grouped rendering and choose a deterministic single parent while surfacing a test-covered cleanup path. The service should prevent creating multiple parent relations for the same child and role unless a future spec explicitly allows it.

### Decision: Sorting applies to shelf units, not relations

Sort fields operate on `ShelfUnit` entries:

- `manual`: `ShelfUnit.position`
- `addedAt`: `ShelfUnit.createdAt`
- `title`: hydrated unit title with `position` fallback

`sortPrimeOnly=true` means grouped sorting: sort roots by the active sort state, then sort each root's children by the same sort state. `sortPrimeOnly=false` means all-entry sorting: sort every `ShelfUnit` as a peer and render each unit once.

### Decision: Attach flows create child shelf units

Attaching a review/tag to a parent will:

1. Upsert or create the child `ShelfUnit` in the same shelf with its own generated position and kind.
2. Insert the `ShelfUnitRelation(parentUnitId, childUnitId, role)`.

Detaching deletes only the relation by default. Whether to delete the now-unattached child shelf unit should be explicit in the API or editor operation; the first implementation should keep the child unit unless the user deletes it.

### Decision: Edit page separates preview view and default view

The items editor will keep a local `editorViewMode` for previewing nested/flat presentation. Changing it will not dirty metadata. The persisted default shelf view will be edited in the metadata form and written to `shelf.extra.viewMode`.

## Risks / Trade-offs

- Data migration may create many new `ShelfUnit` rows for currently attached review/tag ids. → Generate deterministic positions in a transaction and test migration with duplicate attachments.
- Existing `itemCount` may change semantics if attached children become units. → Define `itemCount` as total `ShelfUnit` rows and expose root counts separately only if needed later.
- Relation cycles would break grouped rendering. → Service validation must reject self-relations and cycles at write time for the current parent-child edge.
- A child with multiple parents could render ambiguously. → Enforce one parent relation per child per shelf for attachment roles.
- Removing projected arrays is a broad frontend change. → Update contract, API hydration, app stream tests, and stories in one cutover.
- Initial migrated child positions are synthetic. → Document that after migration `ShelfUnit.position` is authoritative and user reorders can refine it.

## Migration Plan

1. Add the Prisma migration that renames or recreates `ShelfItem` as `ShelfUnit` and `ShelfItemUnit` as `ShelfUnitRelation`.
2. Migrate existing primary `ShelfItem` rows to `ShelfUnit` rows.
3. Drop redundant `role='primary'` relation rows.
4. For each old `role='review' | 'tag'` row, ensure a child `ShelfUnit` exists for `unitId`, generate an initial `position`, and create a `ShelfUnitRelation` from the old slot's `itemRef` to the child unit id.
5. Update contract schemas and regenerate Prisma client.
6. Update server services, mappers, collection flows, and tests.
7. Update API package types, mutations, and hydration.
8. Update app stream derivation, edit page, shelf page, and tests.
9. Run targeted package tests and migration validation.

Rollback strategy:

- Because this is a breaking internal development-stage schema cutover, rollback should be a database rollback to the pre-migration snapshot plus reverting the code branch. Do not maintain dual-write compatibility.

## Open Questions

- Should detaching the final relation for a child leave the child as a root shelf unit, or should the UI offer a combined "detach and remove from shelf" action?
- Should `itemCount` on shelf summaries count all `ShelfUnit` rows, or should a separate root count be exposed for display?
- Should relation `role='tag'` remain for tag attachments, or should tags eventually move to the generic tag application system for shelf units?
