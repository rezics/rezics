## ADDED Requirements

### Requirement: Full reindex syncs all qualifying units

The system SHALL provide a full reindex operation that deletes all documents from the content index and re-syncs all qualifying Units (works and standalone units that are published and public) from the database.

#### Scenario: Full reindex populates content index

- **GIVEN** the database contains 100 published public work Units and 50 release Units
- **WHEN** a full reindex is triggered
- **THEN** the content index SHALL contain exactly 100 documents
- **AND** no release Unit documents SHALL be present

#### Scenario: Full reindex handles large datasets via cursor pagination

- **GIVEN** the database contains millions of qualifying Units
- **WHEN** a full reindex is triggered
- **THEN** the sync SHALL process Units in batches using cursor-based pagination (ordered by `id`)
- **AND** the operation SHALL complete without memory exhaustion

### Requirement: Full reindex reads from post-unit-architecture schema

The full reindex operation SHALL read text from `UnitTranslation`, attribution from `PersonCredit`/`OrgCredit`, tags from `UnitTag` (including tag Unit translations for `tagLabels`), realm membership from `RealmUnit`, and realm-tag classification from `RealmTagUnit`.

#### Scenario: Synced document reflects UnitTranslation content

- **GIVEN** a work Unit with UnitTranslation rows in "en" and "zh"
- **WHEN** full reindex runs
- **THEN** the resulting document SHALL have `titles` and `descriptions` arrays populated from both translations

#### Scenario: Synced document reflects PersonCredit attribution

- **GIVEN** a work Unit with PersonCredit linking to Person "Author A" (role: author) and OrgCredit linking to Organization "Publisher B" (role: publisher)
- **WHEN** full reindex runs
- **THEN** the resulting document's `creditNames` SHALL contain `["Author A", "Publisher B"]`

### Requirement: Incremental sync updates a single unit's document on mutation

The system SHALL provide an incremental sync function that, given a Unit ID, fetches the unit's full document data and upserts it in Meilisearch. If the unit no longer qualifies for indexing (deleted, made private, or is a release), the document SHALL be removed from the index.

#### Scenario: Unit updated triggers document upsert

- **GIVEN** a published work Unit already in the content index
- **WHEN** its UnitTranslation is updated (title changed)
- **AND** incremental sync is called with this Unit's ID
- **THEN** the document in the content index SHALL reflect the new title

#### Scenario: Unit deleted triggers document removal

- **GIVEN** a published work Unit in the content index
- **WHEN** the unit's status is changed to DELETED
- **AND** incremental sync is called with this Unit's ID
- **THEN** the document SHALL be removed from the content index

#### Scenario: Unit made private triggers document removal

- **GIVEN** a published work Unit in the content index with `visibility = PUBLIC`
- **WHEN** the unit's visibility is changed to PRIVATE
- **AND** incremental sync is called with this Unit's ID
- **THEN** the document SHALL be removed from the content index

### Requirement: Incremental sync is triggered by related entity mutations

The incremental sync SHALL be invoked when any of the following entities are created, updated, or deleted for an indexed Unit: `UnitTranslation`, `UnitTag`, `RealmUnit`, `RealmTagUnit`, `PersonCredit`, `OrgCredit`. Each trigger SHALL resolve to the affected Unit's ID and re-sync that single document.

#### Scenario: Adding a tag triggers re-sync

- **GIVEN** a published work Unit in the content index
- **WHEN** a new UnitTag row is created for this unit
- **AND** the domain service triggers incremental sync
- **THEN** the document SHALL be updated with the new tag in `tagIds` and the tag's labels in `tagLabels`

#### Scenario: Adding a RealmTagUnit triggers re-sync

- **GIVEN** a published work Unit in the content index
- **WHEN** a new RealmTagUnit row is created for this unit (realm-X, tag-A)
- **AND** the domain service triggers incremental sync
- **THEN** the document's `realmTagKeys` SHALL include `"{realm-X}:{tag-A}"`

#### Scenario: Removing a RealmUnit triggers re-sync

- **GIVEN** a published work Unit in the content index, in realm-X
- **WHEN** the RealmUnit row for realm-X is deleted
- **AND** the domain service triggers incremental sync
- **THEN** realm-X UUID SHALL no longer appear in the document's `realmIds`
