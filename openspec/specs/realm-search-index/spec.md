## ADDED Requirements

### Requirement: Realms Meilisearch index exists with correct settings

The system SHALL maintain a Meilisearch index named `realms` with primary key `id`. Searchable attributes SHALL be in priority order: `titles`, `descriptions`. Filterable attributes SHALL include: `isPublic`, `isOfficial`. Sortable attributes SHALL include: `memberCount`, `createdAt`, `updatedAt`.

#### Scenario: Realms index initialized
- **WHEN** the realms index initialization endpoint is called
- **THEN** a Meilisearch index named `realms` SHALL exist with primary key `id`
- **AND** searchable attributes SHALL be `["titles", "descriptions"]`
- **AND** filterable attributes SHALL include `isPublic`, `isOfficial`
- **AND** sortable attributes SHALL include `memberCount`, `createdAt`, `updatedAt`

### Requirement: Realm document contains multilingual titles and descriptions

Each realm document SHALL contain: `id` (unit UUID), `isPublic`, `isOfficial`, `memberCount`, `createdAt`, `updatedAt`, `userId` (realm creator), `extra`. Additionally, it SHALL contain `titles` (array of title strings from all UnitTranslation rows), `descriptions` (array of description strings), and `translations` (structured array with `{ language, title, description }` for each translation, used for display rendering).

#### Scenario: Realm with multiple translations
- **GIVEN** a realm with translations in "en" (title: "Fantasy Hub", description: "A place for fantasy lovers") and "zh-hant" (title: "奇幻中心", description: "奇幻愛好者的天地")
- **WHEN** the realm is synced to Meilisearch
- **THEN** `titles` SHALL contain `["Fantasy Hub", "奇幻中心"]`
- **AND** `descriptions` SHALL contain `["A place for fantasy lovers", "奇幻愛好者的天地"]`
- **AND** `translations` SHALL contain both structured translation objects

#### Scenario: Realm with single translation
- **GIVEN** a realm with only one translation in "zh-hant"
- **WHEN** the realm is synced
- **THEN** `titles` SHALL contain exactly one element
- **AND** `translations` SHALL contain one structured object

### Requirement: Only non-deleted realms are indexed

The realms index SHALL contain documents only for realm units whose status is not `DELETED`.

#### Scenario: Active realm is indexed
- **GIVEN** a realm unit with status `PUBLISHED`
- **WHEN** the realm is synced
- **THEN** a document SHALL exist in the realms index

#### Scenario: Deleted realm is removed
- **GIVEN** a previously indexed realm
- **WHEN** the realm unit status is changed to `DELETED` and sync is triggered
- **THEN** the document SHALL be removed from the realms index

### Requirement: Full reindex syncs all qualifying realms

The system SHALL provide a full reindex operation for realms using cursor-based pagination.

#### Scenario: Full reindex populates realms index
- **GIVEN** the database contains 50 non-deleted realms
- **WHEN** a full realms reindex is triggered
- **THEN** the realms index SHALL contain exactly 50 documents

### Requirement: Incremental realm sync on mutations

The realm service SHALL trigger an incremental sync when a realm is created or updated. Realm creation SHALL use full document sync. Realm metadata updates, member count changes, and translation updates SHALL use partial updates with only the affected fields. Sync SHALL be fire-and-forget.

#### Scenario: Realm creation triggers full sync

- **WHEN** a new realm is created via `realm.service.create()`
- **THEN** `syncRealmToMeili(unitId)` SHALL be called with a full document rebuild

#### Scenario: Realm metadata update triggers partial sync

- **WHEN** a realm is updated with metadata changes (isPublic, isOfficial, extra)
- **THEN** `patchRealmMetadata(unitId, { isPublic, isOfficial, extra })` SHALL be called with only the changed fields
- **AND** SHALL NOT re-query unit translations

#### Scenario: Member join triggers partial member count sync

- **WHEN** a user joins a realm via `realm.service.joinRealm()`
- **THEN** `patchRealmMemberCount(unitId, newCount)` SHALL be called with only the updated count
- **AND** SHALL NOT rebuild the entire realm document

#### Scenario: Member leave triggers partial member count sync

- **WHEN** a user leaves a realm via `realm.service.removeMember()`
- **THEN** `patchRealmMemberCount(unitId, newCount)` SHALL be called with only the updated count

#### Scenario: Realm translation update triggers partial translation sync

- **WHEN** a realm unit's translation is created or updated via the translation service
- **THEN** `patchRealmTranslations(unitId)` SHALL be called to update only `titles`, `descriptions`, and `translations`
- **AND** SHALL NOT re-query realm metadata (isPublic, isOfficial, memberCount)

### Requirement: Realm search index includes Unit aliases
The realm search index SHALL include alias-derived searchable text for Realm Units. Alias text SHALL be indexed separately from translated realm titles and SHALL follow the same `score > visibilityThreshold OR pinned = true` inclusion rule.

#### Scenario: Realm search matches alias

- **GIVEN** a Realm Unit has translated title `"rezics"`
- **AND** it has alias value `"Library.Book"`
- **WHEN** a user searches realms for `"Library.Book"`
- **THEN** the Realm Unit SHALL be eligible to appear in results
- **AND** the displayed realm name SHALL still resolve from UnitTranslation
