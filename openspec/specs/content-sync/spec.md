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

### Requirement: Chapter rating changes do not resync the Book

When a chapter Unit's `rating` is updated, the sync SHALL update the chapter's own indexed document (if the chapter is indexed as content) or post document (via the post index) but SHALL NOT trigger a resync of the Book Unit the chapter targets. The Book Unit's `rating` is an independent, maintainer-asserted field and SHALL NOT be recomputed from chapter ratings.

#### Scenario: Chapter rating update leaves Book document unchanged

- **GIVEN** a Book Unit "book-1" with `rating = R_15` in the content index
- **AND** a chapter Unit "ch-5" targeting "book-1" with `rating = R_15`
- **WHEN** "ch-5"'s rating is updated to `R_18`
- **THEN** the indexed document for "book-1" SHALL still have `rating = "R_15"`
- **AND** no partial or full sync of "book-1" SHALL be triggered by the chapter rating change

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

### Requirement: Content sync preserves public eligibility
Content index sync SHALL add or update only Unit documents that are public eligible.

#### Scenario: Full content sync runs
- **WHEN** full content sync reads Unit-backed content
- **THEN** it SHALL index only Units with `status=PUBLISHED` and `visibility=PUBLIC`

#### Scenario: Single content sync sees ineligible Unit
- **WHEN** single content sync processes a Unit that is deleted, draft, archived, private, or unlisted
- **THEN** it SHALL remove that Unit document from the content index

### Requirement: Partial content sync cannot create ineligible public documents
Partial content sync paths SHALL NOT upsert content-index documents for Units that are not public eligible.

#### Scenario: Private shelf membership changes
- **WHEN** membership changes for a private shelf
- **THEN** partial sync SHALL NOT create a public content-index document for that shelf

#### Scenario: Public eligibility may have changed
- **WHEN** a partial sync path cannot prove the target Unit is still public eligible
- **THEN** it SHALL use an eligibility-aware sync path or delete the target document

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
