## MODIFIED Requirements

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
