## ADDED Requirements

### Requirement: Unified content index replaces per-type indexes

The system SHALL maintain a single Meilisearch index named `content` for all discoverable Unit types. The old `books`, `units`, and `readlists` indexes SHALL be removed.

#### Scenario: Content index exists after initialization

- **GIVEN** the Meilisearch instance is running
- **WHEN** the search system is initialized
- **THEN** an index named `content` SHALL exist with primary key `id`
- **AND** no indexes named `books`, `units`, or `readlists` SHALL exist

### Requirement: Only works and standalone units are indexed

The content index SHALL contain documents only for Units where `workUnitId IS NULL` and `type` is one of `BOOK`, `GAME`, `MEDIA`, `SHELF`, and `status` is `PUBLISHED`, and `visibility` is `PUBLIC`. Release units (`workUnitId != null`) SHALL NOT be indexed.

#### Scenario: Work unit is indexed

- **GIVEN** a Unit with `type = BOOK`, `workUnitId = null`, `status = PUBLISHED`, `visibility = PUBLIC`
- **WHEN** the unit is synced to Meilisearch
- **THEN** a document with `id` equal to the Unit's UUID SHALL exist in the content index

#### Scenario: Release unit is not indexed

- **GIVEN** a Unit with `type = BOOK` and `workUnitId` pointing to a work Unit
- **WHEN** a full reindex is performed
- **THEN** no document with this release Unit's UUID SHALL exist in the content index

#### Scenario: Draft unit is not indexed

- **GIVEN** a Unit with `status = DRAFT` and `workUnitId = null`
- **WHEN** a full reindex is performed
- **THEN** no document with this Unit's UUID SHALL exist in the content index

#### Scenario: Standalone shelf is indexed

- **GIVEN** a Unit with `type = SHELF`, `workUnitId = null`, `status = PUBLISHED`, `visibility = PUBLIC`
- **WHEN** the unit is synced to Meilisearch
- **THEN** a document with this Unit's UUID SHALL exist in the content index

### Requirement: Document contains denormalized translations as arrays

Each document in the content index SHALL contain all `UnitTranslation` rows for that Unit, denormalized into arrays: `titles`, `subtitles`, `summaries`, `descriptions`. Each array SHALL contain the values from all language translations.

#### Scenario: Unit with multiple translations

- **GIVEN** a published work Unit with UnitTranslation rows for "en" (title: "My Book") and "zh" (title: "我的书")
- **WHEN** the unit is synced
- **THEN** the document's `titles` field SHALL contain `["My Book", "我的书"]`
- **AND** the document's `languages` field SHALL contain `["en", "zh"]`

#### Scenario: Unit with single translation

- **GIVEN** a published work Unit with only one UnitTranslation row for "ja"
- **WHEN** the unit is synced
- **THEN** the document's `titles` field SHALL contain exactly one element
- **AND** the document's `languages` field SHALL contain `["ja"]`

### Requirement: Document contains three independent realm/tag fields

Each document SHALL contain three independent fields derived from the three junction tables:
- `tagIds`: array of tag Unit UUIDs from `UnitTag`
- `realmIds`: array of realm Unit UUIDs from `RealmUnit`
- `realmTagKeys`: array of compound strings from `RealmTagUnit`, formatted as `"{realmUnitId}:{tagUnitId}"`

#### Scenario: Unit with global tags and realm membership

- **GIVEN** a Unit associated with UnitTag rows for tag-A and tag-B, and a RealmUnit row for realm-X
- **WHEN** the unit is synced
- **THEN** the document SHALL have `tagIds` containing tag-A and tag-B UUIDs
- **AND** `realmIds` containing realm-X UUID
- **AND** `realmTagKeys` SHALL be empty (no RealmTagUnit rows exist)

#### Scenario: Unit with realm-scoped tag classification

- **GIVEN** a Unit with a RealmTagUnit row (realm-X, tag-A, this-unit)
- **WHEN** the unit is synced
- **THEN** the document's `realmTagKeys` SHALL contain `"{realm-X-uuid}:{tag-A-uuid}"`

### Requirement: Document contains denormalized attribution names

Each document SHALL include a `creditNames` array containing the `name` field from all `Person` and `Organization` entities linked via `PersonCredit` and `OrgCredit` to that Unit.

#### Scenario: Unit with person and organization credits

- **GIVEN** a Unit with PersonCredit linking to Person "Author Name" and OrgCredit linking to Organization "Publisher Name"
- **WHEN** the unit is synced
- **THEN** the document's `creditNames` SHALL contain `["Author Name", "Publisher Name"]`

### Requirement: Document contains denormalized tag labels

Each document SHALL include a `tagLabels` array containing the display titles of associated tag Units (from the tag Unit's own `UnitTranslation` rows), enabling full-text search by tag name.

#### Scenario: Search by tag name matches via tagLabels

- **GIVEN** a Unit tagged with a tag Unit whose UnitTranslation has title "fantasy" (en) and "奇幻" (zh)
- **WHEN** the unit is synced
- **THEN** the document's `tagLabels` SHALL contain `["fantasy", "奇幻"]`

### Requirement: Index searchable attributes are ordered by priority

The content index SHALL configure searchable attributes in priority order: `titles`, `subtitles`, `descriptions`, `summaries`, `creditNames`, `tagLabels`.

#### Scenario: Title match ranks higher than description match

- **GIVEN** two documents: one with "magic" in `titles`, another with "magic" only in `descriptions`
- **WHEN** searching for "magic"
- **THEN** the document with "magic" in `titles` SHALL rank higher

### Requirement: Index filterable attributes cover all filter dimensions

The content index SHALL configure the following as filterable attributes: `type`, `tagIds`, `realmIds`, `realmTagKeys`, `languages`, `nsfw`, `visibility`, `isLicensed`.

#### Scenario: Filter by type

- **WHEN** a search query includes filter `type = "BOOK"`
- **THEN** only documents with `type = "BOOK"` SHALL be returned

#### Scenario: Filter by realm and realm-scoped tag

- **WHEN** a search query includes filter `realmTagKeys = "{realmId}:{tagId}"`
- **THEN** only documents that have that exact compound key in their `realmTagKeys` array SHALL be returned

### Requirement: Index sortable attributes support temporal ordering

The content index SHALL configure `createdAt`, `updatedAt`, and `publishedAt` as sortable attributes.

#### Scenario: Sort by publishedAt descending

- **WHEN** a search query specifies sort `publishedAt:desc`
- **THEN** results SHALL be ordered by `publishedAt` in descending order

### Requirement: Users and feedbacks indexes are retained

The `users` and `feedbacks` Meilisearch indexes SHALL be retained with updated field mappings reflecting post-`unit-architecture` schema changes. They SHALL NOT be merged into the content index.

#### Scenario: Users index still functional after migration

- **GIVEN** the search system is initialized after unit-architecture migration
- **WHEN** a user search query is executed
- **THEN** the `users` index SHALL return results based on user name, slug, and bio fields
