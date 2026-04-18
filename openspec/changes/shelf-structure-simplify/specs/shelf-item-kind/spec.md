## ADDED Requirements

### Requirement: ShelfItem kind render discriminator

Each ShelfItem SHALL have a `kind` field (`String`, max 32 characters) that tells the frontend which component to render. The system SHALL determine `kind` at write time from the source Unit's type and — for POSTs — the Post subtype.

#### Scenario: Book unit has kind "book"

- **WHEN** a Unit of type `BOOK` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "book"`

#### Scenario: Review post has kind "review"

- **WHEN** a Unit of type `POST` with `Post.kind = REVIEW` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "review"`

#### Scenario: Quote post has kind "quote"

- **WHEN** a Unit of type `POST` with `Post.kind = QUOTE` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "quote"`

#### Scenario: Generic post has kind "post"

- **WHEN** a Unit of type `POST` with `Post.kind` other than `REVIEW` or `QUOTE` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "post"`

#### Scenario: Tag unit has kind "tag"

- **WHEN** a Unit of type `TAG` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "tag"`

#### Scenario: Realm unit has kind "realm"

- **WHEN** a Unit of type `REALM` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "realm"`

#### Scenario: Link unit has kind "link"

- **WHEN** a Unit of type `LINK` is added to a shelf
- **THEN** the ShelfItem SHALL have `kind = "link"`

#### Scenario: Unknown UnitType falls back to lowercased type

- **WHEN** a Unit of any other `UnitType` (e.g. `GAME`, `MEDIA`, `IMAGE`, `VIDEO`, `CHAPTER`) is added to a shelf
- **THEN** the ShelfItem SHALL have `kind` equal to the lowercased `UnitType` string

### Requirement: ShelfItem kind value set

The system SHALL support the following `kind` values: `book`, `review`, `quote`, `post`, `chapter`, `tag`, `realm`, `image`, `video`, `media`, `game`, `link`.

#### Scenario: Contract enumerates all kinds

- **WHEN** the shared contract package exports the `ShelfItemKind` type
- **THEN** the type SHALL be a union of exactly the above string literals

### Requirement: ShelfItem.reviewIds array for attached reviews

Each ShelfItem SHALL have a `reviewIds: String[] @db.Uuid @default([])` field that stores unit ids of reviews attached to this item. A GIN index SHALL exist on `reviewIds` to support reverse lookups.

#### Scenario: Item with no reviews

- **WHEN** a book is added to a shelf without any attached reviews
- **THEN** `ShelfItem.reviewIds` SHALL equal `[]`

#### Scenario: Item with multiple attached reviews

- **WHEN** a book has two reviews attached within a shelf
- **THEN** `ShelfItem.reviewIds` SHALL contain both review unit ids

#### Scenario: Reverse lookup by review id

- **WHEN** the system queries "which ShelfItems reference review R"
- **THEN** the query SHALL use `WHERE reviewIds @> ARRAY[R]::uuid[]` and hit the GIN index on `reviewIds`

#### Scenario: Attach review updates array

- **WHEN** a review is attached to an existing ShelfItem
- **THEN** the attach SHALL APPEND the review's unit id to `reviewIds` if not already present
- **AND** SHALL NOT create any other row

#### Scenario: Detach review updates array

- **WHEN** a review is detached from a ShelfItem
- **THEN** the detach SHALL REMOVE the review's unit id from `reviewIds`
- **AND** the ShelfItem SHALL remain
- **AND** SHALL NOT delete any other row

### Requirement: ShelfItem.tagIds array for per-item tags

Each ShelfItem SHALL have a `tagIds: String[] @db.Uuid @default([])` field that stores unit ids of Tag units applied to this item within this shelf. A GIN index SHALL exist on `tagIds` to support reverse lookups. Values SHALL be unit ids — free-text strings are not accepted.

#### Scenario: Item with no tags

- **WHEN** a book is added to a shelf without any per-item tags
- **THEN** `ShelfItem.tagIds` SHALL equal `[]`

#### Scenario: Item with multiple per-item tags

- **WHEN** a book has two tag unit ids applied within a shelf
- **THEN** `ShelfItem.tagIds` SHALL contain both tag unit ids

#### Scenario: Reverse lookup by tag id

- **WHEN** the system queries "which ShelfItems carry tag T"
- **THEN** the query SHALL use `WHERE tagIds @> ARRAY[T]::uuid[]` and hit the GIN index on `tagIds`

#### Scenario: Same unit in two shelves has independent tags

- **WHEN** a unit is in Shelf A with `tagIds = [X]` and Shelf B with `tagIds = [Y]`
- **THEN** modifying one shelf's `tagIds` SHALL NOT affect the other
