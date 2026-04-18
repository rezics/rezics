## ADDED Requirements

### Requirement: ShelfItem fractional-index position

Each ShelfItem SHALL have a `position` field of type `String` (max 64 characters) that encodes a fractional index. The system SHALL order items within a shelf by comparing `position` strings lexicographically. A compound index `@@index([shelfUnitId, position])` SHALL exist to support ordered reads.

#### Scenario: Append item to shelf

- **WHEN** a new item is added to a shelf with existing items
- **THEN** the system SHALL generate a new `position` string lexicographically greater than the current maximum position in that shelf
- **AND** the insert SHALL be a single-row INSERT with no modifications to other rows

#### Scenario: Prepend item to shelf

- **WHEN** a new item is added and placed at the start of the shelf
- **THEN** the system SHALL generate a `position` string lexicographically less than the current minimum position
- **AND** the insert SHALL be a single-row INSERT

#### Scenario: Insert item between two existing items

- **WHEN** an item is inserted between positions `P_a` and `P_b`
- **THEN** the system SHALL generate a `position` string `P_new` such that `P_a < P_new < P_b` lexicographically
- **AND** no existing row SHALL be modified

#### Scenario: Drag-drop reorder

- **WHEN** the author reorders an existing item to a new location between two other items
- **THEN** the system SHALL UPDATE only the moved item's `position` to a value between the new neighbors' positions
- **AND** no other rows SHALL be modified

### Requirement: Position-key density rebalancing

When a newly-generated `position` would exceed a configured length threshold (default 16 characters), the system SHALL perform an n-reorder: read a window of surrounding items, redistribute their positions evenly across the lex range, and UPDATE them in a single transaction.

#### Scenario: Rebalance triggered by key growth

- **WHEN** the system attempts to generate a new position and the candidate key length would exceed the threshold
- **THEN** the system SHALL select a window of surrounding items (default 50)
- **AND** SHALL reassign evenly-spaced positions across that window
- **AND** SHALL apply the updates in a single transaction

#### Scenario: Normal insert below threshold

- **WHEN** the candidate position key length is below the threshold
- **THEN** no rebalance SHALL be performed
- **AND** the insert SHALL complete as a single-row INSERT

### Requirement: ShelfItem itemRef without foreign key

ShelfItem SHALL use `itemRef: String @db.Uuid` as the reference to its primary unit. The column SHALL NOT declare a foreign key relation to `Unit`. An index `@@index([itemRef])` SHALL exist for "which shelves contain this item" queries.

#### Scenario: Add item references primary unit by id

- **WHEN** a unit with id `U` is added to a shelf
- **THEN** the ShelfItem row SHALL have `itemRef = U`
- **AND** no FK constraint SHALL link `itemRef` to `Unit.id`

#### Scenario: External Unit deletion does not cascade

- **WHEN** the Unit referenced by a ShelfItem's `itemRef` is deleted externally
- **THEN** the ShelfItem row SHALL remain
- **AND** the ShelfItem SHALL be treated as an orphan until cleanup

#### Scenario: Reverse lookup uses itemRef index

- **WHEN** the system queries "which ShelfItems reference unit U"
- **THEN** the query SHALL use `WHERE itemRef = U` and hit `@@index([itemRef])`
- **AND** SHALL NOT require a JOIN to the `Unit` table

### Requirement: ShelfItem composite primary key on itemRef

The ShelfItem composite primary key SHALL be `@@id([shelfUnitId, itemRef])`. A given primary unit SHALL appear at most once per shelf.

#### Scenario: Duplicate item rejected

- **GIVEN** a shelf already contains itemRef `U`
- **WHEN** the system attempts to insert another ShelfItem with the same `(shelfUnitId, U)`
- **THEN** the PK constraint SHALL reject the insert
- **AND** no second row SHALL be created

### Requirement: Pagination by position

The API SHALL return shelf items ordered by `position ASC` and SHALL support pagination with a default page size of 100.

#### Scenario: Shelf with fewer than 100 items

- **WHEN** a client requests items from a shelf with 50 items and no pagination params
- **THEN** all 50 items SHALL be returned ordered by `position` ASC

#### Scenario: Shelf larger than the page size

- **WHEN** a client requests the next page of a 200-item shelf
- **THEN** the API SHALL return the next 100 items in `position` ASC order
- **AND** the response SHALL indicate whether more items remain
