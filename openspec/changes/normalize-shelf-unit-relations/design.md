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
- Preserve efficient shelf reads with B-tree indexes on `(shelfId, position)` and relation lookups by parent/child.
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

- `shelfId`
- `unitId`
- `kind`
- `position`
- `createdAt`
- `updatedAt`

The primary key will be `(shelfId, unitId)`. A unit can appear at most once in a shelf. The `kind` field remains a write-time render discriminator.

The owning-shelf foreign key is named `shelfId` even though Shelf is a Unit-extension whose PK column is `Shelf.unitId`. The shorter `shelfId` name is chosen to avoid the lexical collision with the model name `ShelfUnit` (the previous `shelfUnitId` reads like a row identity, not an owning-shelf reference).

Alternatives considered:

- Keep `ShelfItem.itemRef`: rejected because `itemRef` still reads like a slot pointer and does not make attached rows feel first-class.
- Add position to `ShelfItemUnit`: rejected because relation rows would mix edge semantics with item ordering.
- Keep the column name `shelfUnitId`: rejected because after renaming the model to `ShelfUnit`, `shelfUnitId` reads ambiguously as "this row's id" rather than "owning shelf id".

### Decision: Rename the edge table to `ShelfUnitRelation`

`ShelfUnitRelation` will contain:

- `shelfId`
- `parentUnitId`
- `childUnitId`
- `role`

The parent and child will both reference `ShelfUnit(shelfId, unitId)` with cascade delete. The relation primary key will be `(shelfId, parentUnitId, childUnitId, role)`. The PK intentionally allows the same `childUnitId` to appear under multiple `parentUnitId` values within one shelf — see `Decision: Multi-parent attachment is allowed`.

Indexes should support:

- children for a parent: `(shelfId, parentUnitId, role)`
- root detection (is this unit a child of anything in this shelf?): `(shelfId, childUnitId)`
- reverse lookup for collection status: `(childUnitId, role)` and `(parentUnitId, role)` only if the server needs cross-shelf status queries by role

Alternatives considered:

- Keep `role='primary'`: rejected as redundant. Containment is represented by `ShelfUnit`; only parent-child relationships need relation rows.
- Generic `UnitEdge`: rejected because shelf relations are shelf-scoped and must reference shelf-contained rows, not arbitrary global units.

### Decision: Multi-parent attachment is allowed

The same `ShelfUnit` MAY be the child of multiple `ShelfUnitRelation` rows within the same shelf. This is intentional for tags (one tag legitimately labels many parents) and is also allowed for reviews and any future role.

Consequences:

- Nested mode and grouped flat mode (`sortPrimeOnly = true`) render the shared child once under each parent that lists it. Each rendered instance is the same `ShelfUnit` (same `unitId`, same `position`, same hydrated DTO).
- Flat all-entry mode (`sortPrimeOnly = false`) emits each `ShelfUnit` exactly once regardless of how many incoming relations it has.
- Root detection remains `roots = units.filter(u => !childUnitIds.has(u.unitId))`; a unit with any incoming relation is not a root, even if it has many incoming relations.

The service SHALL forbid only self-relation (`parentUnitId === childUnitId`) because it is semantically meaningless and would cause infinite recursion in nested rendering. Multi-step cycles (`A→B→A`) are not forbidden at this stage; the renderer must defend against rendering loops by tracking the visited set during nested expansion.

Alternatives considered:

- Forbid multi-parent at PK or unique-constraint level: rejected because tag-as-label has no natural single-parent meaning.
- Forbid all cycles at write time: deferred. Cycles are theoretically possible but not produced by current UX; rendering-side defence is cheaper than a write-time graph walk.

### Decision: `Shelf.itemCount` is a write-time materialized counter

`Shelf.itemCount` SHALL equal the count of `ShelfUnit` rows where `shelfId = shelf.unitId`, maintained at write time:

- `ShelfUnit` insert → `itemCount += 1`
- `ShelfUnit` delete → `itemCount -= 1`
- `ShelfUnitRelation` writes do not affect `itemCount`

Read paths SHALL NOT issue runtime `COUNT(*)` queries against `ShelfUnit` to populate `itemCount`. If drift is suspected, a reconciliation job MAY recompute via a single `SELECT count(*) ... GROUP BY shelfId`, but this is operational, not a normal read.

Alternatives considered:

- Runtime `COUNT(*)` on each shelf read: rejected for cost.
- DB trigger maintenance: acceptable but deferred to service-layer maintenance for testability; the requirement specifies the invariant, not the mechanism.

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
- `childrenByParent = Map(parentUnitId, ShelfUnit[])` — a `ShelfUnit` MAY appear in multiple entries of this map when its `unitId` is the `childUnitId` of multiple relations.

Nested/grouped modes render roots once, then each root's children once **per parent**. Flat all-entry mode renders each `ShelfUnit` once. A unit that appears as a child does not also appear as a root in grouped streams.

Children of a parent SHALL be ordered by their own `ShelfUnit.position` under the active sort state, not by relation insertion order.

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

- Data migration may create many new `ShelfUnit` rows for currently attached review/tag ids. → Generate deterministic positions in a transaction (see Migration Plan) and test migration with the same child attached to multiple parents.
- `itemCount` semantics widen: every attached child counts. → Define `itemCount` as the count of all `ShelfUnit` rows and maintain it as a write-time counter on insert/delete; document that root-only counts are not exposed at this stage.
- Self-relation would cause infinite recursion in nested rendering. → Reject `parentUnitId === childUnitId` at the service layer.
- Multi-step cycles (`A→B→A`) are not write-time rejected. → Nested derivation tracks a visited set per traversal so a cycle is rendered at most once and surfaces as a test fixture rather than a crash.
- Multi-parent attachment is allowed and visually duplicates the child under each parent. → Test fixtures cover the same child under multiple parents in nested and grouped flat modes.
- Removing projected arrays is a broad frontend change. → Update contract, API hydration, app stream tests, and stories in one cutover.
- Initial migrated child positions are synthetic. → Document that after migration `ShelfUnit.position` is authoritative and user reorders refine it.

## Migration Plan

1. Add the Prisma migration that renames or recreates `ShelfItem` as `ShelfUnit` (with `shelfId` PK column) and `ShelfItemUnit` as `ShelfUnitRelation` (with `shelfId` PK column).
2. Migrate existing primary `ShelfItem` rows to `ShelfUnit` rows by copying `itemRef → unitId`, preserving `position`, `kind`, and timestamps.
3. Drop redundant `role='primary'` relation rows from the old `ShelfItemUnit` data.
4. For each old `role='review' | 'tag'` row, ensure a child `ShelfUnit` exists for `unitId` and create a `ShelfUnitRelation(shelfId, parentUnitId=itemRef, childUnitId=unitId, role)`.
5. Generate deterministic initial `ShelfUnit.position` values for migrated attached children using the following rule:
   - For each migrated parent `P` with attached children `[c1, c2, …, cN]` (ordered first by `role` ascending, then by `unitId` ascending for determinism), let `pNext` be the position of the next root `ShelfUnit` in the same shelf (or `null` if `P` is the last root).
   - Compute `slots = N` evenly-spaced fractional positions strictly between `P.position` and `pNext` using `keyBetween` repeatedly. Assign in order.
   - If a migrated child is attached to multiple parents, place it once near its first encountered parent (deterministic by parent ordering above); subsequent encounters reuse the existing `ShelfUnit`.
6. Recompute `Shelf.itemCount` for every shelf as the post-migration `COUNT(*)` of `ShelfUnit` rows. After migration, `itemCount` SHALL be maintained as a write-time counter.
7. Update contract schemas and regenerate Prisma client.
8. Update server services, mappers, collection flows, and tests.
9. Update API package types, mutations, and hydration.
10. Update app stream derivation, edit page, shelf page, and tests.
11. Run targeted package tests, migration validation, and `openspec validate normalize-shelf-unit-relations --strict`.

Rollback strategy:

- Because this is a breaking internal development-stage schema cutover, rollback should be a database rollback to the pre-migration snapshot plus reverting the code branch. Do not maintain dual-write compatibility.

## Open Questions

- Should detaching the final relation for a child leave the child as a root shelf unit, or should the UI offer a combined "detach and remove from shelf" action? (Current spec keeps the child; UX may refine later.)
- Should multi-step cycles (`A→B→A`) be rejected at write time eventually, or is renderer-side defence enough long-term?
