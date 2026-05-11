## ADDED Requirements

### Requirement: Shelf edit page exposes an items management section

The shelf edit page SHALL render an items management section below the
existing metadata form, separated by a horizontal divider. The metadata form
layout SHALL remain unchanged. The items section SHALL contain, in order:

1. A `UnitPicker` for adding items
2. A paginated, sortable list of the current shelf items
3. A sticky footer with `Discard ops` and `Save N ops` buttons

#### Scenario: Editor renders three top-level zones

- **WHEN** an owner opens `/shelf/$shelfId/edit`
- **THEN** the page SHALL render metadata fields, a divider, the items section, and a footer in that order

#### Scenario: Metadata layout is preserved

- **WHEN** the editor renders
- **THEN** the title, description, and cover URL fields SHALL match their pre-change positions, labels, and existing Save button

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

### Requirement: Adding a unit enqueues an `add` op

Activating the action on a `UnitPicker` candidate SHALL enqueue an `add` op
in the editor's local op log. The added item SHALL appear at the end of the
items list immediately. The position SHALL be computed client-side as
`keyAfter(lastVisiblePosition)`. The op SHALL NOT be sent to the server
until the items Save button is activated.

#### Scenario: Adding via picker shows the item without a server call

- **WHEN** the owner activates `Add` on a candidate
- **THEN** an `add` op SHALL appear in the op log
- **AND** the new item SHALL be visible at the end of the current page (or at the start of the appropriate position-sorted slot)
- **AND** no network request SHALL be issued

### Requirement: Deleting an item enqueues a `delete` op

The delete control on a row SHALL enqueue a `delete` op and visually remove
the row from the list. Op coalescing SHALL collapse an `add → delete` pair on
the same `itemRef` to no op before send.

#### Scenario: Add-then-delete in one session sends nothing

- **WHEN** the owner adds a candidate and then deletes the resulting row before saving
- **THEN** the dirty count SHALL fall back to zero
- **AND** the items Save SHALL be disabled

### Requirement: Drag-reorder is page-local and position-sort-only

The items list SHALL allow drag-and-drop reorder only when the active sort
mode is `position` (manual). Drag handles SHALL only render in that mode.
Dragging SHALL be allowed only between items currently visible on the same
page; cross-page reordering SHALL go through the cross-page move modal.
Each drop SHALL enqueue a `reorder` op with a client-computed `position`
string derived from the neighbors of the drop target.

#### Scenario: Drag handle hidden under non-manual sort

- **WHEN** the user switches the sort selector to a non-`position` value
- **THEN** each row SHALL hide its drag handle
- **AND** the delete and cross-page move controls SHALL remain available

#### Scenario: Drop computes position locally

- **WHEN** the user drops an item between two visible rows whose positions are `a` and `c`
- **THEN** the editor SHALL compute the dropped item's new position as `midpoint(a, c)` via the shared `fractional-index` algorithm
- **AND** enqueue a `reorder` op with that position

### Requirement: Cross-page move targets the first slot of the destination page

Each row SHALL provide a `MoveRight` icon control that opens a modal listing
all available page numbers. Selecting page K SHALL enqueue a server-resolved
`reorder` op that lands the item at the first position of page K. Once the
user navigates to page K, a normal in-page drag SHALL refine placement.

#### Scenario: Modal shows all pages

- **WHEN** the owner activates the cross-page move control
- **THEN** the modal SHALL list every available page index for the current shelf

#### Scenario: Selecting a destination enqueues a page-targeted reorder op

- **WHEN** the owner picks page 4 in the modal
- **THEN** the editor SHALL enqueue an op whose semantics target the first slot of page 4
- **AND** the modal SHALL close without issuing a network call

### Requirement: Editor honors the shelf's `viewMode`

The items list SHALL stream entries through the same `shelfStream` model used
by the view page so that attached children render consistently. In `flat`
mode each primary item and each attached review or tag SHALL emit its own
row with a full control column. In `nested` mode primary items SHALL render
as cards whose attached children appear as in-card preview tabs without
control columns.

#### Scenario: Flat mode renders attached children as rows with controls

- **WHEN** the shelf's `viewMode` is `flat`
- **AND** an item has two attached reviews
- **THEN** the editor SHALL render three rows for that item: the primary plus two attached reviews
- **AND** each row SHALL have its own drag/MoveRight/delete controls

#### Scenario: Nested mode renders attached children as tabs without controls

- **WHEN** the shelf's `viewMode` is `nested`
- **AND** an item has two attached reviews
- **THEN** the editor SHALL render one card for that item with the reviews as tabs inside
- **AND** the tab area SHALL NOT render drag/MoveRight/delete controls

### Requirement: Items Save submits the op log as a batch

The Items Save button SHALL POST the accumulated op log to the batch endpoint
for the current shelf. Coalescing rules SHALL apply before send. The button
label SHALL show the count of net ops being submitted (e.g. `Save · 3 ops`)
and SHALL be disabled when the op log is empty.

#### Scenario: Save sends a single request for many ops

- **WHEN** the owner makes 5 reorders, 2 adds, and 1 delete, then activates Items Save
- **THEN** the editor SHALL issue exactly one batch request

#### Scenario: Per-op failure leaves successful ops applied

- **WHEN** the batch response reports `ok` for 5 ops and `failed` for 1
- **THEN** the 5 successful ops SHALL disappear from the op log
- **AND** the 1 failed op SHALL remain in the op log with its failure reason
- **AND** the editor SHALL surface a retry control that resubmits only the failed ops

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
