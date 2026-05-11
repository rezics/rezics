## MODIFIED Requirements

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

### Requirement: Drag-reorder is page-local and position-sort-only

The items list SHALL allow drag-and-drop reorder only when the active view mode
is `unit` and the active sort field is `manual`. Drag handles SHALL only render
in that state. Dragging SHALL be allowed only between items currently visible on
the same page; cross-page reordering SHALL use an explicit cross-page action if
that action is enabled. Each drop SHALL enqueue a `reorder` op with a
client-computed `position` string derived from the visual neighbors of the drop
target and the active manual sort order.

#### Scenario: Drag controls hidden under non-manual sort

- **WHEN** the user switches the sort field to a value other than `manual`
- **THEN** each row SHALL hide its drag handle
- **AND** cross-page move controls SHALL also be hidden
- **AND** delete controls MAY remain available

#### Scenario: Drag controls hidden outside unit view

- **WHEN** the active view is `nested`, `flat`, or `masonry`
- **THEN** each row SHALL hide its drag handle and cross-page move control
- **AND** this SHALL remain true even if the active sort field is `manual`

#### Scenario: Drop computes position from visual neighbors

- **WHEN** the user drops an item between two visible rows in manual ascending
  order
- **THEN** the editor SHALL compute the dropped item's new position between the
  previous and next visual neighbors via the shared fractional-index algorithm
- **AND** enqueue a `reorder` op with that position

#### Scenario: Manual descending reverses neighbor interpretation

- **WHEN** the user drops an item between two visible rows in manual descending
  order
- **THEN** the editor SHALL compute the new position so the item persists at
  the same visual slot after reload
- **AND** tests SHALL cover the descending neighbor calculation separately from
  ascending order

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

### Requirement: Editor honors the shelf's viewMode

The items list SHALL stream entries through the same shelf stream model used by
the view page so that attached children render consistently. In `flat` mode
each primary item and each attached review or tag SHALL emit its own rich row.
In `nested` mode primary items SHALL render as cards whose attached children
appear as in-card preview tabs without control columns. In `unit` mode entries
SHALL render as fixed-height unit summary rows.

#### Scenario: Flat mode renders attached children as rows without reorder controls

- **WHEN** the shelf's `viewMode` is `flat`
- **AND** an item has two attached reviews
- **THEN** the editor SHALL render three rows for that item: the primary plus
  two attached reviews
- **AND** those rich rows SHALL NOT render drag or cross-page move controls

#### Scenario: Nested mode renders attached children as tabs without controls

- **WHEN** the shelf's `viewMode` is `nested`
- **AND** an item has two attached reviews
- **THEN** the editor SHALL render one card for that item with the reviews as
  tabs inside
- **AND** the tab area SHALL NOT render drag, cross-page move, or delete
  controls for the nested child previews

#### Scenario: Unit mode renders fixed-height rows

- **WHEN** the shelf's `viewMode` is `unit`
- **THEN** the editor SHALL render entries as fixed-height unit summary rows
- **AND** those rows SHALL be eligible for reorder controls only when the sort
  field is `manual`

## ADDED Requirements

### Requirement: Editor displays shelf item added time

The editor SHALL display shelf item added time from `ShelfItem.createdAt` in
the unit view and in any sort UI state where added-time ordering is active.

#### Scenario: Unit row shows added time

- **WHEN** a unit view row renders for a shelf item with `createdAt`
- **THEN** the row SHALL display a localized added-time label derived from that
  value

#### Scenario: Added-time sort exposes its basis

- **WHEN** the active sort field is `addedAt`
- **THEN** the visible row metadata SHALL make the shelf item added time
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
- **THEN** newer shelf items SHALL render before older shelf items
- **AND** switching to ascending order SHALL reverse that ordering

#### Scenario: User switches manual direction

- **WHEN** the user changes manual order from descending to ascending
- **THEN** the visible order SHALL reverse according to item position
- **AND** any subsequent drag operation SHALL compute positions for the active
  visual direction
