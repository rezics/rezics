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

The incremental sync SHALL be invoked when any of the following entities are created, updated, or deleted for an indexed Unit: `UnitTranslation`, `UnitTag`, `RealmUnit`, `RealmTagUnit`, `PersonCredit`, `OrgCredit`. Each trigger SHALL resolve to the affected Unit's ID and sync only the affected field group using partial updates instead of rebuilding the entire document.

#### Scenario: Adding a tag triggers partial sync of tag fields only

- **GIVEN** a published work Unit in the content index
- **WHEN** a new UnitTag row is created for this unit
- **AND** the domain service triggers incremental sync
- **THEN** the sync SHALL call `patchContentTags(unitId)` to update only `tagIds`, `tagScores`, and `tagLabels`
- **AND** SHALL NOT re-query translations, credits, realm associations, or type extensions

#### Scenario: Adding a RealmTagUnit triggers partial sync of realm-tag keys only

- **GIVEN** a published work Unit in the content index
- **WHEN** a new RealmTagUnit row is created for this unit (realm-X, tag-A)
- **AND** the domain service triggers incremental sync
- **THEN** the sync SHALL call `patchContentRealmTagKeys(unitId)` to update only `realmTagKeys`

#### Scenario: Removing a RealmUnit triggers partial sync of realm IDs only

- **GIVEN** a published work Unit in the content index, in realm-X
- **WHEN** the RealmUnit row for realm-X is deleted
- **AND** the domain service triggers incremental sync
- **THEN** the sync SHALL call `patchContentRealmIds(unitId)` to update only `realmIds`

#### Scenario: Linking a person credit triggers partial sync of credit names only

- **GIVEN** a published work Unit in the content index
- **WHEN** a PersonCredit row is created for this unit
- **AND** the domain service triggers incremental sync
- **THEN** the sync SHALL call `patchContentCredits(unitId)` to update only `creditNames`

#### Scenario: Updating a translation triggers partial sync of translation fields only

- **GIVEN** a published work Unit in the content index
- **WHEN** a UnitTranslation row is created or updated for this unit
- **AND** the domain service triggers incremental sync
- **THEN** the sync SHALL call `patchContentTranslations(unitId)` to update only `titles`, `subtitles`, `summaries`, `descriptions`, `languages`, and `translations`

### Requirement: Author profile change triggers bulk post re-sync

When a user's profile (name, slug, avatar) is updated via `user.service`, the system SHALL update all posts authored by that user using partial updates with only the changed author fields, instead of rebuilding entire post documents.

#### Scenario: Author name change patches posts with partial update

- **GIVEN** user "Alice" has 50 posts in the posts index
- **WHEN** Alice updates her name to "Alice W."
- **THEN** the service SHALL call `patchPostsAuthor(userId, { authorName: "Alice W." })` or include all changed author fields
- **AND** SHALL NOT fetch post body, target unit, score entry, or other post relations

#### Scenario: Author avatar change patches posts with partial update

- **GIVEN** user "Bob" has 20 posts in the posts index
- **WHEN** Bob updates his avatar
- **THEN** the service SHALL call `patchPostsAuthor(userId, { authorAvatar: newAvatar })` or include all changed author fields
- **AND** the update payload per post SHALL contain only author-related fields

### Requirement: Target unit translation change triggers post re-sync

When a target unit's UnitTranslation is updated, the system SHALL update all posts referencing that target using partial updates with only the target-related fields.

#### Scenario: Book title change patches related reviews with partial update

- **GIVEN** a book "Old Title" with 10 review posts targeting it
- **WHEN** the book's title is updated to "New Title"
- **THEN** the service SHALL call `patchPostsTarget(targetUnitId)` which fetches target data and post IDs
- **AND** each post document SHALL be updated with only `targetTitles`, `targetType`, `targetCoverUrl`

### Requirement: Book and unit metadata updates use partial sync

When book-specific fields (`coverUrl`, `isLicensed`) or unit-level fields (`nsfw`, `visibility`, `publishedAt`, `defaultLanguage`) are updated, the system SHALL use partial updates to send only the changed fields.

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

### Requirement: Admin init/sync/delete endpoints for posts and realms indexes
The server SHALL expose admin-only (root role) endpoints for the posts and realms indexes following the same pattern as the existing content index admin endpoints:
- `POST /meili/posts/init` — initialize index settings
- `POST /meili/posts/sync` — full reindex from database
- `DELETE /meili/posts/deleteAll` — delete all documents
- `POST /meili/realms/init` — initialize index settings
- `POST /meili/realms/sync` — full reindex from database
- `DELETE /meili/realms/deleteAll` — delete all documents

#### Scenario: Root user initializes posts index
- **GIVEN** an authenticated user with role `ROOT`
- **WHEN** they call `POST /meili/posts/init`
- **THEN** the posts index SHALL be created/updated with the correct settings

#### Scenario: Root user triggers full realm reindex
- **GIVEN** an authenticated user with role `ROOT`
- **WHEN** they call `POST /meili/realms/sync`
- **THEN** all qualifying realms SHALL be synced to the realms index

#### Scenario: Non-root user denied admin endpoints
- **GIVEN** an authenticated user with role `USER`
- **WHEN** they call any posts or realms admin endpoint
- **THEN** they SHALL receive a 403 response
