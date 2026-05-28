# shelf-editor Specification

## Purpose

Owns the shelf edit page item-management experience and the
server-side write path that backs it. Defines the items section
below the metadata form (Add item composition, paginated/sortable
list, sticky save/discard footer), the local op-log model that
defers mutations until the user saves, drag-reorder and cross-page
move semantics tied to manual sort, the preview-mode separation
from the persisted default view, and the
`PATCH /shelf/:shelfId/items/batch` endpoint that applies the
submitted op log atomically with per-op outcome reporting.
Previously split across `shelf-items-editor` and
`shelf-items-batch-mutation`.

## Editor UI

### Requirement: Shelf edit page exposes an items management section

The shelf edit page SHALL render an items management section below the existing
metadata form, separated by a horizontal divider. The metadata form layout
SHALL remain unchanged. The items section SHALL contain, in order:

1. An `Add item` composition for searching, URL importing, and contextual
   browsing of units
2. A paginated, sortable list of the current shelf items
3. A sticky footer with `Discard ops` and `Save N ops` buttons when item ops
   are dirty

#### Scenario: Editor renders three top-level zones

- **WHEN** an owner opens `/shelf/$shelfId/edit`
- **THEN** the page SHALL render metadata fields, a divider, the items section,
  and a footer in that order

#### Scenario: Metadata layout is preserved

- **WHEN** the editor renders
- **THEN** the title, description, and cover URL fields SHALL match their
  pre-change positions, labels, and existing Save button

#### Scenario: Add item composition replaces bare URL field

- **WHEN** the items section renders
- **THEN** the add surface SHALL be labeled as adding an item
- **AND** a bare URL field SHALL NOT be the only visible add path

### Requirement: Metadata Save stays on the page after success

The metadata Save action SHALL no longer navigate away after a successful
update. On success, the metadata area SHALL return to clean state (Save
disabled), and the user SHALL remain on the editor with the items section
still available.

#### Scenario: Successful metadata save leaves the user in the editor

- **WHEN** the owner edits the title and clicks the metadata Save
- **AND** the server responds with success
- **THEN** the editor SHALL remain mounted at `/shelf/$shelfId/edit`
- **AND** the metadata Save button SHALL become disabled until further metadata changes are made

### Requirement: Edit page separates preview view from default shelf view

The shelf edit page SHALL distinguish between the items editor preview view and the persisted default shelf view. Changing the items editor preview view SHALL NOT mark metadata dirty and SHALL NOT write `shelf.extra.viewMode`. The persisted default shelf view SHALL be edited in the metadata form.

#### Scenario: Editor preview view does not dirty metadata

- **WHEN** the owner changes the items section view from nested to flat
- **THEN** the metadata Save button SHALL remain disabled if no metadata field changed
- **AND** navigating away SHALL NOT warn because of the preview view change alone

#### Scenario: Default shelf view is saved from metadata form

- **WHEN** the owner changes the default shelf view in the metadata form and saves
- **THEN** the update request SHALL write the selected value to `shelf.extra.viewMode`
- **AND** the shelf detail page SHALL use that value as its default view

### Requirement: Adding a unit enqueues an `add` op

Activating the action on a `UnitPicker` candidate SHALL enqueue an `add` op in the editor's local op log. The added unit SHALL appear at the end of the items list immediately. The position SHALL be computed client-side as `keyAfter(lastVisiblePosition)`. The op SHALL NOT be sent to the server until the items Save button is activated.

#### Scenario: Adding via picker shows the unit without a server call

- **WHEN** the owner activates `Add` on a candidate
- **THEN** an `add` op SHALL appear in the op log
- **AND** the new unit SHALL be visible at the end of the current page or current manual sort segment
- **AND** no network request SHALL be issued

### Requirement: Deleting an item enqueues a `delete` op

The delete control on a shelf unit row SHALL enqueue a `delete` op and visually remove the unit from the list. Op coalescing SHALL collapse an `add → delete` pair on the same `unitId` to no op before send.

#### Scenario: Add-then-delete in one session sends nothing

- **WHEN** the owner adds a candidate and then deletes the resulting row before saving
- **THEN** the dirty count SHALL fall back to zero
- **AND** the items Save SHALL be disabled

### Requirement: Drag-reorder is page-local and position-sort-only

The items list SHALL allow drag-and-drop reorder only when reorder controls are enabled and the active sort field is `manual`. Dragging SHALL be allowed only between shelf units currently visible on the same page. Each drop SHALL enqueue a `reorder` op with a client-computed `position` string derived from the visual neighbors of the drop target and the active manual sort order.

#### Scenario: Drag controls hidden under non-manual sort

- **WHEN** the user switches the sort field to a value other than `manual`
- **THEN** each row SHALL hide its drag handle
- **AND** cross-page move controls SHALL also be hidden

#### Scenario: Drop computes position from visual neighbors

- **WHEN** the user drops a shelf unit between two visible rows in manual ascending order
- **THEN** the editor SHALL compute the dropped unit's new position between the previous and next visual neighbors
- **AND** enqueue a `reorder` op with that position

### Requirement: Cross-page move targets the first slot of the destination page

The editor SHALL provide a cross-page move control only when the editor is in
`unit` view with manual sort active. Selecting page K SHALL target the first
visible manual slot of page K using the same page size and manual sort order
shown by the editor.

#### Scenario: Cross-page move hidden when reorder is unavailable

- **WHEN** reorder controls are not available for the current view and sort
- **THEN** the cross-page move control SHALL NOT render

#### Scenario: Page number semantics match the editor page size

- **WHEN** the editor page size is 20 and the user chooses page 3
- **THEN** the move operation SHALL target the page that starts at the 41st
  visible item in the current manual sort order
- **AND** the server and client SHALL NOT use different page-size constants for
  the operation

#### Scenario: Manual descending cross-page move targets visual top

- **WHEN** the active sort is manual descending and the user moves an item to
  page K
- **THEN** the moved item SHALL land at the visual top of page K after save and
  reload

### Requirement: Editor honors the shelf's `viewMode`

The items editor SHALL stream entries through the same shelf stream model used by the view page, but its view selector SHALL be local preview state. In flat preview mode each emitted `ShelfUnit` row SHALL represent one sortable unit. In nested preview mode root units SHALL render as cards whose attached children appear inside the parent presentation without separate root rows.

#### Scenario: Flat preview mode renders attached child as its own row

- **WHEN** shelf unit `B` has attached review child `R`
- **AND** the editor preview view is `flat`
- **THEN** the editor SHALL render a row for `B`
- **AND** render a row for `R`
- **AND** each row SHALL correspond to a real `ShelfUnit`

#### Scenario: Nested preview mode does not duplicate children

- **WHEN** shelf unit `B` has attached review child `R`
- **AND** the editor preview view is `nested`
- **THEN** the editor SHALL render root content for `B`
- **AND** render `R` only inside `B`'s attached content area
- **AND** `R` SHALL NOT render as a second root row

### Requirement: Editor displays shelf item added time

The editor SHALL display shelf unit added time from `ShelfUnit.createdAt` in
the unit view and in any sort UI state where added-time ordering is active.

#### Scenario: Unit row shows added time

- **WHEN** a unit view row renders for a shelf unit with `createdAt`
- **THEN** the row SHALL display a localized added-time label derived from that
  value

#### Scenario: Added-time sort exposes its basis

- **WHEN** the active sort field is `addedAt`
- **THEN** the visible row metadata SHALL make the shelf unit added time
  available to the user

### Requirement: Editor drag uses fixed-height rows and lightweight overlay

When manual reorder is enabled, the editor SHALL use fixed-height rows and a
lightweight drag overlay. The drag interaction SHALL NOT move the full rich
content card subtree.

#### Scenario: Drag overlay is lightweight

- **WHEN** a user starts dragging a unit view row
- **THEN** the drag preview SHALL render a lightweight summary of the row
- **AND** it SHALL NOT render nested review tabs, full review bodies, reaction
  bars, or rich card actions

#### Scenario: Row height remains stable while dragging

- **WHEN** the user drags a row across the current page
- **THEN** the source row, placeholder space, and neighboring rows SHALL keep
  stable heights
- **AND** the list SHALL NOT expand or collapse based on unclamped text or image
  loading during the drag

### Requirement: Editor sort control supports direction

The editor SHALL allow the user to choose both sort field and sort order. The
available fields SHALL include `manual`, `addedAt`, and `title`; every field
SHALL support `asc` and `desc`.

#### Scenario: User switches added-time direction

- **WHEN** the user selects added-time sort and chooses descending order
- **THEN** newer shelf units SHALL render before older shelf units
- **AND** switching to ascending order SHALL reverse that ordering

#### Scenario: User switches manual direction

- **WHEN** the user changes manual order from descending to ascending
- **THEN** the visible order SHALL reverse according to unit position
- **AND** any subsequent drag operation SHALL compute positions for the active
  visual direction

### Requirement: Items Save submits the op log as a batch

The Items Save button SHALL POST the accumulated op log to the batch endpoint for the current shelf. Coalescing rules SHALL apply before send. The button label SHALL show the count of net ops being submitted and SHALL be disabled when the op log is empty.

#### Scenario: Save sends a single request for many ops

- **WHEN** the owner makes 5 reorders, 2 adds, and 1 delete, then activates Items Save
- **THEN** the editor SHALL issue exactly one batch request

#### Scenario: Per-op failure leaves successful ops applied

- **WHEN** the batch response reports `ok` for 5 ops and `failed` for 1
- **THEN** the 5 successful ops SHALL disappear from the op log
- **AND** the 1 failed op SHALL remain in the op log with its failure reason

### Requirement: Leave-prompt covers either dirty section

The editor SHALL block navigation away from the page when either the
metadata area is dirty or the items op log is non-empty. The prompt SHALL
allow the user to stay on the page or discard pending changes in the
affected sections.

#### Scenario: Dirty items block route exit

- **WHEN** the owner has pending item ops and triggers a route change
- **THEN** a confirmation prompt SHALL appear

#### Scenario: Clean editor allows free navigation

- **WHEN** both metadata and items are clean
- **THEN** route changes SHALL NOT prompt

## Batch mutation

### Requirement: Server exposes a batch op endpoint for shelf items

The server SHALL expose a route at `PATCH /shelf/:shelfId/items/batch`
that accepts an op log payload and applies it atomically within one
Prisma transaction. The route SHALL require the same authentication and
ownership checks as the existing per-op item routes.

#### Scenario: Endpoint requires shelf ownership

- **WHEN** a request is made by a viewer who is not the shelf owner and is not an admin
- **THEN** the server SHALL respond with HTTP 403 and SHALL NOT apply any op

#### Scenario: Endpoint validates op union shape

- **WHEN** a request body contains an op with an unknown `op` discriminator
- **THEN** the server SHALL respond with HTTP 400 and SHALL NOT apply any op

### Requirement: Batch payload is an ordered op log

The request body SHALL be a typed union of op records validated by a TypeBox schema. Supported op kinds SHALL include at minimum:

- `{ op: "add", unitId, kind, position }`
- `{ op: "reorder", unitId, position }`
- `{ op: "reorderToPage", unitId, toPage: number, edge: "first", pageSize?, order? }`
- `{ op: "delete", unitId }`
- `{ op: "attach", parentUnitId, childUnitId, childKind, role, position? }`
- `{ op: "detach", parentUnitId, childUnitId, role }`
- `{ op: "setChildren", parentUnitId, role, childUnitIds }`

Server-side handling SHALL preserve op order across the transaction. `position` strings supplied by the client SHALL be accepted as-is and persisted without recomputation except for `reorderToPage`, where the server computes the destination position.

#### Scenario: Ops are applied in submitted order

- **WHEN** a batch contains `[delete X, add X with new fields]`
- **THEN** the server SHALL apply the delete first and the add second
- **AND** the resulting `ShelfUnit` row SHALL reflect the add's fields

#### Scenario: Client-computed position is persisted verbatim

- **WHEN** an `add` op carries `position: "g5"`
- **THEN** the persisted `ShelfUnit.position` SHALL equal `"g5"`

#### Scenario: Attach op creates child unit and relation

- **WHEN** an `attach` op references parent `B` and child `R`
- **THEN** the server SHALL ensure `ShelfUnit(R)` exists in the same shelf
- **AND** it SHALL create `ShelfUnitRelation(B, R, role)`

#### Scenario: Attach op without position appends child to shelf end

- **GIVEN** the shelf's current maximum `ShelfUnit.position` is `m`
- **WHEN** an `attach` op for child `R` omits `position` and `ShelfUnit(R)` does not yet exist in the shelf
- **THEN** the server SHALL create `ShelfUnit(R)` with `position = keyAfter(m)`
- **AND** the existing positions of other shelf units SHALL NOT be modified

#### Scenario: Attach op with explicit position is persisted verbatim

- **WHEN** an `attach` op carries `position: "g5"` and `ShelfUnit(R)` does not yet exist in the shelf
- **THEN** the server SHALL create `ShelfUnit(R)` with `position = "g5"`

#### Scenario: Attach op skips ShelfUnit creation when child already in shelf

- **GIVEN** `ShelfUnit(R)` already exists in shelf `S` with `position = p`
- **WHEN** an `attach` op references child `R`
- **THEN** the server SHALL NOT modify `ShelfUnit(R).position`
- **AND** it SHALL only insert the `ShelfUnitRelation` row

#### Scenario: Attach op allows multi-parent

- **GIVEN** shelf `S` already has `ShelfUnitRelation(S, B1, T, 'tag')`
- **WHEN** an `attach` op attaches `T` to a different parent `B2` with the same role
- **THEN** the server SHALL insert `ShelfUnitRelation(S, B2, T, 'tag')`
- **AND** SHALL NOT reject the second attach as duplicate

#### Scenario: Attach op rejects self-relation

- **WHEN** an `attach` op specifies `parentUnitId === childUnitId`
- **THEN** the server SHALL record the op as `failed` with reason `self_relation_forbidden`
- **AND** no `ShelfUnitRelation` row SHALL be created

#### Scenario: setChildren auto-creates missing child shelf units

- **GIVEN** parent `B` is in shelf `S` and `S` does NOT yet contain `ShelfUnit(C1)` or `ShelfUnit(C2)`
- **WHEN** a `setChildren` op specifies `parentUnitId = B`, `role = 'tag'`, `childUnitIds = [C1, C2]`
- **THEN** the server SHALL upsert `ShelfUnit(S, C1)` and `ShelfUnit(S, C2)` using the same end-of-shelf position rule as a positionless `attach`
- **AND** it SHALL reconcile `ShelfUnitRelation(S, B, *, 'tag')` to exactly `[(B, C1, 'tag'), (B, C2, 'tag')]`
- **AND** any pre-existing relation `(S, B, X, 'tag')` for `X ∉ {C1, C2}` SHALL be deleted
- **AND** `ShelfUnit` rows that are no longer referenced by any relation SHALL remain in the shelf unless an explicit `delete` op removes them

### Requirement: Batch endpoint resolves cross-page reorders server-side

For `reorderToPage` ops, the server SHALL fetch the first shelf unit of the destination page using the same page size and manual sort order shown by the editor, then compute the moved unit's new `position`. If the destination page is out of range, the server SHALL fail just that op.

#### Scenario: Moving to a valid page lands at the first slot

- **WHEN** an op specifies `toPage: 3, edge: "first"`
- **AND** the first unit of page 3 has position `m`
- **THEN** the server SHALL compute a new position that places the moved unit at the visual top of page 3

#### Scenario: Out-of-range page targets fail per-op

- **WHEN** an op specifies `toPage: 99` on a shelf with 4 pages
- **THEN** that op SHALL be recorded as `failed` with a reason
- **AND** other ops in the same batch SHALL apply normally

### Requirement: Batch response reports per-op outcomes

The response body SHALL contain `results: Array<{ status: "ok" | "failed", op, unit?, relation?, reason? }>` in the same order as the request. Per-op failures SHALL NOT roll back the transaction; ops that succeed SHALL be persisted. Whole-transaction errors SHALL still surface as a 5xx error covering the entire batch.

#### Scenario: Mixed outcomes both persist successes and report failures

- **WHEN** a 6-op batch has 5 valid ops and 1 op targeting a deleted unit
- **THEN** the response SHALL contain 6 result entries in order
- **AND** the 5 valid ops SHALL be marked `ok` and persisted
- **AND** the 1 invalid op SHALL be marked `failed` with a reason string

#### Scenario: Database failure surfaces as 5xx

- **WHEN** the transaction fails to commit due to a database-level error
- **THEN** the server SHALL return a 5xx response
- **AND** no ops from the batch SHALL be persisted

### Requirement: Endpoint enforces a maximum op count per batch

The server SHALL enforce a configurable maximum number of ops per batch
request. Requests above the cap SHALL be rejected with HTTP 413 (Payload
Too Large) and an explanatory body. The default cap SHALL be 200 ops.

#### Scenario: Oversized batch is rejected

- **WHEN** a request contains more than the configured cap of ops
- **THEN** the server SHALL respond with HTTP 413
- **AND** no ops SHALL be applied
