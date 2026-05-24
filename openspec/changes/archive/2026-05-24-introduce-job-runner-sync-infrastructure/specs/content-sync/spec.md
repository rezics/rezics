## MODIFIED Requirements

### Requirement: Incremental sync is triggered by related entity mutations

Runtime related-entity mutations SHALL trigger durable search sync jobs rather
than directly calling Meilisearch sync helpers from the server mutation path.
Each trigger SHALL resolve to the affected Unit's ID and enqueue a command that
syncs only the affected field group using partial updates instead of rebuilding
the entire document. Seed, factory, and explicit local repair scripts MAY still
call the direct sync helpers.

#### Scenario: Adding a tag triggers queued partial sync of tag fields only

- **GIVEN** a published work Unit in the content index
- **WHEN** a new UnitTag row is created for this unit by a runtime server
  mutation
- **THEN** the mutation or CDC router SHALL enqueue
  `search.content.patchTags(unitId)` on `search.sync.slow`
- **AND** the worker handler SHALL call `patchContentTags(unitId)` to update
  only `tagIds`, `tagScores`, and `tagLabels`
- **AND** the server mutation path SHALL NOT directly write to Meilisearch

#### Scenario: Adding a RealmTagUnit triggers queued partial sync of realm-tag keys only

- **GIVEN** a published work Unit in the content index
- **WHEN** a new RealmTagUnit or RealmTagApplication row is created for this
  unit
- **THEN** the mutation or CDC router SHALL enqueue a realm-tag-key projection
  command for the affected `unitId`
- **AND** the worker handler SHALL call `patchContentRealmTagKeys(unitId)` to
  update only `realmTagKeys`

#### Scenario: Removing a RealmUnit triggers queued partial sync of realm IDs only

- **GIVEN** a published work Unit in the content index, in realm-X
- **WHEN** the RealmUnit row for realm-X is deleted
- **THEN** the mutation or CDC router SHALL enqueue a realm-membership
  projection command for the affected `unitId`
- **AND** the worker handler SHALL call `patchContentRealmIds(unitId)` to
  update only `realmIds`

#### Scenario: Linking a person credit triggers queued partial sync of credit names only

- **GIVEN** a published work Unit in the content index
- **WHEN** a credit attribution row is created for this unit
- **THEN** the mutation or CDC router SHALL enqueue
  `search.content.patchCredits(unitId)`
- **AND** the worker handler SHALL call `patchContentCredits(unitId)` to update
  only `creditNames`

#### Scenario: Updating a translation triggers queued partial sync of translation fields only

- **GIVEN** a published work Unit in the content index
- **WHEN** a UnitTranslation row is created or updated for this unit
- **THEN** the mutation or CDC router SHALL enqueue a translation projection
  command for the affected `unitId`
- **AND** the worker handler SHALL call `patchContentTranslations(unitId)` to
  update only `titles`, `subtitles`, `summaries`, `descriptions`, `languages`,
  and `translations`

### Requirement: Author profile change triggers bulk post re-sync

The system SHALL enqueue a durable fanout job when a user's profile fields used
by post search documents are updated via runtime user services. The job SHALL
update all posts authored by that user using partial updates with only the
changed author fields. The fanout SHALL be segmented when the affected post set
exceeds the configured per-job limit.

#### Scenario: Author name change enqueues post author patch

- **GIVEN** user "Alice" has 50 posts in the posts index
- **WHEN** Alice updates her name to "Alice W."
- **THEN** the runtime service SHALL enqueue a post-author fanout command
- **AND** the worker handler SHALL call `patchPostsAuthor(userId, { authorName:
  "Alice W." })` or include all changed author fields
- **AND** the server mutation path SHALL NOT directly write to Meilisearch

#### Scenario: Author avatar change patches posts with partial update

- **GIVEN** user "Bob" has 20 posts in the posts index
- **WHEN** Bob updates his avatar
- **THEN** the runtime service SHALL enqueue a post-author fanout command
- **AND** the worker handler SHALL update each affected post document with only
  author-related fields

### Requirement: Target unit translation change triggers post re-sync

When a target unit's UnitTranslation is updated at runtime, the system SHALL
enqueue a durable fanout job that updates all posts referencing that target
using partial updates with only the target-related fields.

#### Scenario: Book title change enqueues related review patch

- **GIVEN** a book "Old Title" with 10 review posts targeting it
- **WHEN** the book's title is updated to "New Title"
- **THEN** the runtime mutation or CDC router SHALL enqueue a target-unit fanout
  command
- **AND** the worker handler SHALL call `patchPostsTarget(targetUnitId)`
- **AND** each post document SHALL be updated with only `targetTitles`,
  `targetType`, and `targetCoverUrl`

### Requirement: Book and unit metadata updates use partial sync

The system SHALL enqueue durable search sync jobs when book-specific fields
(`coverUrl`, `isLicensed`) or unit-level fields (`rating`, `visibility`,
`publishedAt`, `defaultLanguage`) are updated at runtime. Jobs SHALL be selected
by the changed fields. The worker handler SHALL use partial updates where
eligibility is unchanged and SHALL use eligibility-aware full sync or delete
paths when status, visibility, type, or work linkage may affect index inclusion.

#### Scenario: Book cover update sends only coverUrl

- **GIVEN** a book in the content index
- **WHEN** the book's cover URL is updated
- **THEN** the runtime service SHALL enqueue a content metadata projection job
- **AND** the worker handler SHALL call `patchContentMetadata(unitId, {
  coverUrl: newUrl })`
- **AND** it SHALL NOT re-query translations, tags, credits, or realm
  associations

#### Scenario: Unit visibility change uses eligibility-aware sync

- **GIVEN** a unit in the content index
- **WHEN** the unit's visibility is changed from PUBLIC to PRIVATE
- **THEN** the runtime service or CDC router SHALL enqueue an
  eligibility-aware content sync command
- **AND** if the unit no longer qualifies for indexing, the worker handler
  SHALL remove the document
- **AND** if it still qualifies, the worker handler MAY patch changed metadata

#### Scenario: Unit rating change sends only rating

- **GIVEN** a unit in the content index with `rating = GENERAL`
- **WHEN** the owner updates the rating to `R_15`
- **THEN** the runtime service SHALL enqueue a content metadata projection job
- **AND** the worker handler SHALL call `patchContentMetadata(unitId, {
  rating: "R_15" })`
- **AND** it SHALL NOT re-query translations, tags, credits, or realm
  associations

## ADDED Requirements

### Requirement: Runtime sync callsites are fully migrated

Runtime `package/server` mutation paths SHALL NOT directly call server-local
Meilisearch sync wrappers or fire-and-forget Meilisearch promises after this
change is complete. Runtime projection side effects SHALL be represented as job
commands. Search read APIs, admin explicit sync APIs, seed/factory flows, and
local scripts are excluded from this restriction.

#### Scenario: Server mutation callsite audit passes

- **WHEN** the implementation is complete
- **THEN** runtime service files in `package/server` SHALL enqueue search jobs
  for post-write projection effects
- **AND** they SHALL NOT contain direct runtime calls to `sync*ToMeili`,
  `patch*ToMeili`, or `delete*FromMeili` from mutation side-effect paths

### Requirement: Seed and factory content sync remains direct

Seed and factory synchronization SHALL continue to use direct `@rezics/search`
helpers for deterministic setup and failure behavior.

#### Scenario: Factory targeted content sync does not enqueue

- **WHEN** a factory manifest requests content target synchronization
- **THEN** the factory flow SHALL synchronize the current content projection
  directly
- **AND** it SHALL NOT require the job-runner service
