## Why

The current shelf model uses `ShelfItem` as a sortable slot while `ShelfItemUnit` also carries primary, review, and tag membership. That makes attached content ambiguous: attached reviews/tags are rendered like shelf rows in flat mode, but they are not consistently modeled as sortable shelf entries.

This change clarifies the model by making every unit that appears in a shelf a sortable shelf unit, and using a separate relation table only to describe parent-child attachment. It also fixes rendering semantics so attached children are never rendered twice.

## Problem

The existing names and responsibilities blur two concepts:

- a shelf-contained unit with its own `position`
- a relation between two shelf-contained units

That ambiguity has leaked into sorting and editing behavior. Flat view expects attached content to participate in sorting, while current read projection treats attached review/tag ids as arrays on a parent slot. The result is unclear `sortPrimeOnly` behavior and no reliable single source of truth for attached child order.

## Goals

- Rename the shelf-contained row model from `ShelfItem` to `ShelfUnit`.
- Rename the relation/junction model from `ShelfItemUnit` to `ShelfUnitRelation`.
- Make every rendered shelf unit, including attached reviews and tags, exist as a `ShelfUnit` with its own `position`.
- Make `ShelfUnit.position` the only manual ordering source.
- Make `ShelfUnitRelation` describe attachment only; it SHALL NOT define ordering.
- Define stream derivation so attached children render at most once in every view mode.
- Split edit-page local preview view from persisted default shelf view metadata.

## Non-goals

- No backward-compatible aliases, dual-read shims, or legacy route variants for the old internal model names.
- No generic `UnitEdge` table.
- No relation-level position or attachment-order field.
- No aesthetic redesign of shelf cards beyond the controls needed for this behavior.

## What Changes

- **BREAKING** Rename Prisma/domain concepts:
  - `ShelfItem` becomes `ShelfUnit`.
  - `ShelfItemUnit` becomes `ShelfUnitRelation`.
- **BREAKING** Update shelf DTOs and frontend hydration to return shelf units plus shelf unit relations, rather than parent rows with projected `reviewIds` / `tagIds` arrays.
- **BREAKING** Update shelf add/attach/detach/batch operations so attaching a review/tag creates or reuses a child `ShelfUnit` and then writes a `ShelfUnitRelation`.
- Define root units as shelf units that do not appear as `childUnitId` in a relation for the same shelf.
- Define grouped rendering as roots plus their children, with children excluded from the root stream to prevent duplicate rendering.
- Define flat all-entry rendering as every `ShelfUnit` rendered once as a peer.
- Clarify `sortPrimeOnly=true` as grouped sorting: sort root units first, then sort each root's children by the same sort state.
- Clarify `sortPrimeOnly=false` as all-entry sorting: all shelf units participate in the same flat comparator.
- Move persisted default shelf view editing into the metadata form; the items editor view toggle becomes local preview state only.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `shelf-structure`: `ShelfItem` is replaced by `ShelfUnit`, and every shelf-contained unit has its own `position`.
- `shelf-item-unit-junction`: `ShelfItemUnit` is replaced by `ShelfUnitRelation`, which links parent and child shelf units instead of binding role membership to a parent slot.
- `shelf-display-modes`: stream derivation, `sortPrimeOnly`, and duplicate-prevention rules change to operate on shelf units plus relations.
- `shelf-batch-hydration`: hydration changes from projected attachment arrays to hydrating a unified `ShelfUnit[]` and relation graph.
- `shelf-items-editor`: edit controls and preview view behavior change because attached children are sortable shelf units, not projected rows.
- `shelf-items-batch-mutation`: batch op payloads and server handling change to operate on `ShelfUnit` records and relation operations.
- `shelf-item-kind`: the kind discriminator moves from `ShelfItem.kind` to `ShelfUnit.kind`, with renamed contract types.
- `shelf-collection`: collection and favorite flows change to write `ShelfUnit` rows and optional `ShelfUnitRelation` edges.

## Impact

Affected packages:

- `package/server`: Prisma schema, migrations, shelf mapper/service/API tests, collection service behavior, seed/factory shelf generation.
- `package/contract`: shelf DTO schemas and batch op schemas.
- `package/api`: shelf API types, mutations, query hydration, TanStack Query cache seeding.
- `package/app`: shelf stream model/tests, shelf detail page, shelf edit page, editor items section, unit-card summary mapping, stories.

Migration needs:

- Existing `ShelfItem` rows become `ShelfUnit` rows.
- Existing `ShelfItemUnit(role='primary')` rows are removed as redundant relation data.
- Existing `ShelfItemUnit(role='review' | 'tag')` rows become `ShelfUnitRelation` rows, and their child units must be represented as `ShelfUnit` rows with generated initial positions.
- Initial generated positions for migrated attached children should be deterministic and placed near their parent group, after which `ShelfUnit.position` is the sole manual order source.

Backward compatibility:

- This is an internal development-stage breaking cutover. The implementation should update all internal callsites instead of introducing compatibility aliases or dual-read/write paths.
