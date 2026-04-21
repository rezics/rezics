## MODIFIED Requirements

### Requirement: Full reindex reads from post-unit-architecture schema

The full reindex operation SHALL read text from `UnitTranslation`, attribution from `PersonCredit`/`OrgCredit`, tags from `UnitTag` (including tag Unit translations for `tagLabels`), realm membership from `RealmUnit`, and realm-tag classification from `RealmTagUnit`. The operation SHALL read the Unit's `rating: ContentRating` field and write it to `ContentSearchDocument.rating`. The sync SHALL NOT read or write any `nsfw` field.

#### Scenario: Synced document reflects UnitTranslation content

- **GIVEN** a work Unit with UnitTranslation rows in "en" and "zh"
- **WHEN** full reindex runs
- **THEN** the resulting document SHALL have `titles` and `descriptions` arrays populated from both translations

#### Scenario: Synced document reflects PersonCredit attribution

- **GIVEN** a work Unit with PersonCredit linking to Person "Author A" (role: author) and OrgCredit linking to Organization "Publisher B" (role: publisher)
- **WHEN** full reindex runs
- **THEN** the resulting document's `creditNames` SHALL contain `["Author A", "Publisher B"]`

#### Scenario: Synced document reflects Unit rating

- **GIVEN** a work Unit with `rating = R_18`
- **WHEN** full reindex runs
- **THEN** the resulting document's `rating` field SHALL equal `"R_18"`

### Requirement: Book and unit metadata updates use partial sync

When book-specific fields (`coverUrl`, `isLicensed`) or unit-level fields (`rating`, `visibility`, `publishedAt`, `defaultLanguage`) are updated, the system SHALL use partial updates to send only the changed fields.

#### Scenario: Book cover update sends only coverUrl

- **GIVEN** a book in the content index
- **WHEN** the book's cover URL is updated
- **THEN** the service SHALL call `patchContentMetadata(unitId, { coverUrl: newUrl })`
- **AND** SHALL NOT re-query translations, tags, credits, or realm associations

#### Scenario: Unit visibility change sends only visibility

- **GIVEN** a unit in the content index
- **WHEN** the unit's visibility is changed from PUBLIC to PRIVATE
- **THEN** if the unit no longer qualifies for indexing, the document SHALL be removed
- **AND** if it still qualifies, the service SHALL call `patchContentMetadata(unitId, { visibility: newValue })`

#### Scenario: Unit rating change sends only rating

- **GIVEN** a unit in the content index with `rating = GENERAL`
- **WHEN** the owner updates the rating to `R_15`
- **THEN** the service SHALL call `patchContentMetadata(unitId, { rating: "R_15" })`
- **AND** SHALL NOT re-query translations, tags, credits, or realm associations

## ADDED Requirements

### Requirement: Chapter rating changes do not resync the Book

When a chapter Unit's `rating` is updated, the sync SHALL update the chapter's own indexed document (if the chapter is indexed as content) or post document (via the post index) but SHALL NOT trigger a resync of the Book Unit the chapter targets. The Book Unit's `rating` is an independent, maintainer-asserted field and SHALL NOT be recomputed from chapter ratings.

#### Scenario: Chapter rating update leaves Book document unchanged

- **GIVEN** a Book Unit "book-1" with `rating = R_15` in the content index
- **AND** a chapter Unit "ch-5" targeting "book-1" with `rating = R_15`
- **WHEN** "ch-5"'s rating is updated to `R_18`
- **THEN** the indexed document for "book-1" SHALL still have `rating = "R_15"`
- **AND** no partial or full sync of "book-1" SHALL be triggered by the chapter rating change
