# type-extension-shelf Specification

## Purpose

Defines the `Shelf` 1:1 extension of `Unit(type=SHELF)` and the
`ShelfItem` row model. Owns the rule that shelf covers live in
`UnitTranslation.extra.coverUrl`, the FK-less `itemRef` link with a
companion `ShelfItemUnit` junction that carries `role='primary'`
and per-item tags, the composite primary key that blocks
duplicates, and the public-vs-owner visibility split for shelf
listings.

## Requirements

### Requirement: Shelf cover image stored in UnitTranslation.extra

Shelf cover images SHALL be stored in `UnitTranslation.extra.coverUrl` via the `unitTranslationExtraSchema` defined in the `unit-translation` capability. The `Shelf` extension table SHALL NOT contain a `coverUrl` column. Because Shelf display text (title / description) already lives in `UnitTranslation`, the cover uses the same language-correlated storage and resolves through the same translation fallback chain.

#### Scenario: Shelf schema excludes coverUrl column

- GIVEN the Shelf model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain a field named `coverUrl`
- AND the only fields present SHALL be `unitId`, `kindKey`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Shelf cover URL retrieved from UnitTranslation.extra

- GIVEN a Shelf with `unitId = "shelf-1"` and a `UnitTranslation` with `language = "en"` and `extra = { coverUrl: "https://example.com/shelf.jpg" }`
- WHEN a client requests the shelf's display information in English
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/shelf.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Shelf table

#### Scenario: Shelf cover URL absent is not an error

- GIVEN a Shelf with `unitId = "shelf-1"` and UnitTranslation rows that do not set `extra.coverUrl`
- WHEN a client requests the shelf's display information
- THEN the returned DTO SHALL expose `coverUrl = null` or `undefined`
- AND the response SHALL succeed normally

### Requirement: Adding items to a shelf in pure mode

A `ShelfItem` SHALL link a `Shelf` to any `Unit` via a composite primary key of (`shelfUnitId`, `itemRef`). The `itemRef` SHALL be `String @db.Uuid` without a foreign key constraint to `Unit`. Each `ShelfItem` SHALL carry exactly:

- `kind: String @db.VarChar(32)` — render discriminator, determined at write time.
- `position: String @db.VarChar(64)` — fractional-index key for manual ordering.
- `createdAt: DateTime`, `updatedAt: DateTime`.

The `itemRef` MAY reference any Unit type — reviews collected as independent units, books, games, media, links, or any other Unit. `ShelfItem` SHALL NOT carry `sortOrder`, `keywords`, `label`, `extra`, `reviewIds`, `tagIds`, or a `data: Json` field. Per-item review and tag attachments SHALL live in the `ShelfItemUnit` junction model (see capability `shelf-item-unit-junction`), not on the `ShelfItem` row itself.

Adding a unit to a shelf SHALL be a single transaction that inserts both a `ShelfItem` row and a `ShelfItemUnit` row with `role='primary'` pointing to the same `itemRef`.

#### Scenario: Add a book to a shelf

- **GIVEN** a Shelf `shelf-1` and a Unit `book-1` of type `BOOK`
- **WHEN** the user adds `book-1` to `shelf-1`
- **THEN** a `ShelfItem` SHALL be created with `shelfUnitId = "shelf-1"`, `itemRef = "book-1"`, `kind = "book"`, and a generated `position` string
- **AND** a `ShelfItemUnit` row SHALL be created with `(shelfUnitId = "shelf-1", itemRef = "book-1", unitId = "book-1", role = "primary")` in the same transaction
- **AND** no FK constraint SHALL tie `ShelfItem.itemRef` to `Unit.id`

#### Scenario: Add an item with per-item tags

- **GIVEN** a Shelf `shelf-1`, a Unit `book-1`, and Tag unit ids `[T1, T2]`
- **WHEN** the user adds `book-1` to `shelf-1` with tags `[T1, T2]`
- **THEN** one `ShelfItem` row SHALL be created as above
- **AND** three `ShelfItemUnit` rows SHALL be created: one `role='primary'` and two `role='tag'` (one per tag unit id)
- **AND** the `ShelfItem` row itself SHALL NOT contain a `tagIds` field

#### Scenario: Prevent duplicate items in a shelf

- **GIVEN** a Shelf `shelf-1` already containing `book-1`
- **WHEN** the user attempts to add `book-1` to `shelf-1` again
- **THEN** the composite primary key `@@id([shelfUnitId, itemRef])` SHALL reject the insert
- **AND** no duplicate `ShelfItem` row SHALL be created
- **AND** no duplicate `ShelfItemUnit` `role='primary'` row SHALL be created

#### Scenario: itemRef is not indexed on ShelfItem for reverse lookup

- **WHEN** the system needs to answer "which shelves contain unit X"
- **THEN** the query SHALL target the `ShelfItemUnit` junction via `WHERE unitId = X`
- **AND** SHALL NOT query `ShelfItem.itemRef` for the reverse lookup
- **AND** `ShelfItem` SHALL NOT declare `@@index([itemRef])`

### Requirement: Public shelf lists include only public published shelves
Public shelf list and discovery endpoints SHALL include only shelves whose backing Unit is `PUBLISHED` and `PUBLIC`.

#### Scenario: Public caller lists shelves
- **WHEN** a public caller requests the shelf list
- **THEN** shelves whose backing Unit visibility is `PRIVATE` SHALL NOT appear

#### Scenario: Public caller lists shelves containing a book
- **WHEN** a public caller requests shelves containing a target Unit
- **THEN** every returned shelf SHALL be public published
- **AND** every returned shelf SHALL contain the target Unit

### Requirement: Owner-scoped shelf reads may include private shelves
Owner-authorized shelf reads SHALL be the only ordinary shelf reads that can include the owner's private shelves.

#### Scenario: Owner lists own shelves
- **WHEN** an authenticated user requests their own shelf collection
- **THEN** the response MAY include private system shelves such as Favorites

#### Scenario: Public caller views another user's shelves
- **WHEN** a public caller requests shelves owned by another user
- **THEN** private shelves SHALL NOT appear
