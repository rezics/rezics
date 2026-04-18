## ADDED Requirements

### Requirement: ShelfItemKind render discriminator

Each ShelfItem SHALL have a `kind` field (String, max 32 chars) that tells the frontend which component to use for rendering. The kind SHALL be determined at write time based on the source Unit's type and subtype.

#### Scenario: Book item has kind "book"

- **WHEN** a Unit of type BOOK is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "book"`

#### Scenario: Review post has kind "review"

- **WHEN** a Unit of type POST with `Post.kind = REVIEW` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "review"`

#### Scenario: Quote post has kind "quote"

- **WHEN** a Unit of type POST with `Post.kind = QUOTE` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "quote"`

#### Scenario: Generic post has kind "post"

- **WHEN** a Unit of type POST with `Post.kind` other than REVIEW or QUOTE is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "post"`

#### Scenario: Tag item has kind "tag"

- **WHEN** a Unit of type TAG is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "tag"`

#### Scenario: Link item has kind "link"

- **WHEN** a Unit of type LINK is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "link"`

### Requirement: ShelfItemKind enum values

The system SHALL support the following kind values: `book`, `review`, `quote`, `post`, `chapter`, `tag`, `realm`, `image`, `video`, `media`, `game`, `link`. The mapping from UnitType to kind SHALL be: UnitType value lowercased, except POST which uses Post.kind subtype mapping.

#### Scenario: Kind values cover all UnitTypes

- **WHEN** a Unit of any UnitType (BOOK, GAME, MEDIA, POST, TAG, REALM, SHELF, CHAPTER, IMAGE, VIDEO, QUOTE, LINK, ENTITY, ZONE) is added to a shelf
- **THEN** the system SHALL assign a valid kind value
- **AND** unknown UnitTypes SHALL default to the lowercased UnitType string

### Requirement: ShelfItem.data for per-item structured extras

Each ShelfItem SHALL have an optional `data` Json field (default null). When present, it MAY contain `review` (array of reviewUnitIds attached to this item) and `tag` (array of tagUnitIds applied to this item within this shelf context).

#### Scenario: Item with no extras

- **WHEN** a simple book is added to a shelf without review or tag attachments
- **THEN** ShelfItem.data SHALL be null

#### Scenario: Item with attached reviews

- **WHEN** a book item has reviews "review-1" and "review-2" attached
- **THEN** ShelfItem.data SHALL be `{ review: ["review-1", "review-2"] }`

#### Scenario: Item with per-item tags

- **WHEN** a book item has tags "tag-3" and "tag-4" applied within this shelf
- **THEN** ShelfItem.data SHALL include `{ tag: ["tag-3", "tag-4"] }`

#### Scenario: Item with both reviews and tags

- **WHEN** a book item has reviews and tags attached
- **THEN** ShelfItem.data SHALL be `{ review: ["review-1"], tag: ["tag-3", "tag-4"] }`

### Requirement: ShelfItem FK decoupling

ShelfItem SHALL use `itemRef: String` instead of `itemUnitId` with a foreign key to Unit. The `itemRef` column SHALL NOT have a FK constraint. An index (`@@index([itemRef])`) SHALL exist for "which shelves contain this item" queries.

#### Scenario: Query shelves containing a specific item

- **WHEN** querying for all shelves that contain item "book-1"
- **THEN** the query SHALL use `WHERE itemRef = "book-1"` with the `@@index([itemRef])` index
- **AND** the query SHALL NOT require a join to the Unit table

#### Scenario: External Unit deletion does not cascade

- **WHEN** a Unit referenced by ShelfItem.itemRef is deleted
- **THEN** the ShelfItem row SHALL remain (no cascade)
- **AND** the ShelfItem SHALL become an orphan until frontend cleanup
