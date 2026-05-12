## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Items Save submits the op log as a batch

The Items Save button SHALL POST the accumulated op log to the batch endpoint for the current shelf. Coalescing rules SHALL apply before send. The button label SHALL show the count of net ops being submitted and SHALL be disabled when the op log is empty.

#### Scenario: Save sends a single request for many ops

- **WHEN** the owner makes 5 reorders, 2 adds, and 1 delete, then activates Items Save
- **THEN** the editor SHALL issue exactly one batch request

#### Scenario: Per-op failure leaves successful ops applied

- **WHEN** the batch response reports `ok` for 5 ops and `failed` for 1
- **THEN** the 5 successful ops SHALL disappear from the op log
- **AND** the 1 failed op SHALL remain in the op log with its failure reason
