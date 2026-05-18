## ADDED Requirements

### Requirement: Favorites shelf is private collection state
The Favorites system shelf SHALL be treated as private collection state, not public shelf discovery content.

#### Scenario: Book review page loads shelf preview
- **WHEN** a book review page requests shelf previews for the book
- **THEN** another user's Favorites shelf SHALL NOT appear in the preview

#### Scenario: Owner collection status checks favorites
- **WHEN** an authenticated owner checks whether a Unit is in Favorites
- **THEN** the collection status API MAY use the owner's private Favorites shelf

### Requirement: Book shelf preview uses containsUnitId
Book shelf preview clients SHALL query shelf lists with the `containsUnitId` filter.

#### Scenario: Shelf preview requests shelves for a book
- **WHEN** the app requests shelves for a book detail or review surface
- **THEN** the request SHALL send `containsUnitId` equal to the book Unit ID
- **AND** it SHALL NOT use an unsupported `containsItemRef` filter
