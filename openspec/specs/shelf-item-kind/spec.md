## ADDED Requirements

### Requirement: ShelfItem kind render discriminator

Each `ShelfItem` SHALL have a `kind` field (`String`, max 32 characters) that tells the frontend which component to render without first hydrating the referenced `Unit`. The system SHALL determine `kind` at write time from the source Unit's type and — for POSTs — the `Post.kind` subtype.

#### Scenario: Book unit has kind "book"

- **WHEN** a Unit of type `BOOK` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "book"`

#### Scenario: Review post has kind "review"

- **WHEN** a Unit of type `POST` with `Post.kind = REVIEW` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "review"`

#### Scenario: Quote post has kind "quote"

- **WHEN** a Unit of type `POST` with `Post.kind = QUOTE` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "quote"`

#### Scenario: Generic post has kind "post"

- **WHEN** a Unit of type `POST` with `Post.kind` other than `REVIEW` or `QUOTE` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "post"`

#### Scenario: Tag unit has kind "tag"

- **WHEN** a Unit of type `TAG` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "tag"`

#### Scenario: Realm unit has kind "realm"

- **WHEN** a Unit of type `REALM` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "realm"`

#### Scenario: Link unit has kind "link"

- **WHEN** a Unit of type `LINK` is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind = "link"`

#### Scenario: Unknown UnitType falls back to lowercased type

- **WHEN** a Unit of any other `UnitType` (e.g. `GAME`, `MEDIA`, `IMAGE`, `VIDEO`, `CHAPTER`) is added to a shelf
- **THEN** the `ShelfItem` SHALL have `kind` equal to the lowercased `UnitType` string

### Requirement: ShelfItem kind value set

The system SHALL support the following `kind` values: `book`, `review`, `quote`, `post`, `chapter`, `tag`, `realm`, `image`, `video`, `media`, `game`, `link`.

#### Scenario: Contract enumerates all kinds

- **WHEN** the shared contract package exports the `ShelfItemKind` type
- **THEN** the type SHALL be a union of exactly the above string literals

### Requirement: Kind is denormalized at write time

The `kind` value SHALL be computed at the moment a slot is created and stored directly on `ShelfItem.kind`. The render path SHALL NOT re-derive `kind` from joined `Unit`/`Post` data at read time.

#### Scenario: Kind is resolved during add-to-shelf

- **WHEN** a unit is added to a shelf via `ShelfService.addItem`
- **THEN** the service SHALL read the source `Unit.type` (and `Post.kind` for POST) to compute `kind`
- **AND** SHALL persist that value on the inserted `ShelfItem` row

#### Scenario: Read path does not join Unit for kind

- **WHEN** the shelf items endpoint returns a page of slots
- **THEN** each returned DTO's `kind` SHALL come from the stored `ShelfItem.kind` column
- **AND** the query SHALL NOT JOIN `Unit` or `Post` to re-derive `kind`
