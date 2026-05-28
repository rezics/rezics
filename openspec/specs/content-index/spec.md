# content-index Specification

## Purpose

Defines the unified Meilisearch `content` index that replaces the
per-type `books` / `units` / `readlists` indexes. Owns the rules for
which Units are indexed (work units and standalone Shelves where
published + public), the document shape (denormalized translation
arrays, independent realm/tag fields, full searchable surface), and
the lifecycle/sync invariants that keep the index consistent with
Unit state changes.

## Requirements

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

Each document SHALL contain three independent fields derived from three distinct relation families:
- `tagIds`: array of tag Unit UUIDs from `UnitTag`
- `realmIds`: array of realm Unit UUIDs from `RealmUnit`
- `realmTagKeys`: array of compound machine keys from `RealmTagApplication`, formatted as `"{realmUnitId}:{tagUnitId}"`

`realmTagKeys` SHALL be a machine-facing search/filter representation of realm-scoped tag application. It SHALL NOT imply that the target Unit is present in the realm feed, and it SHALL NOT be used as a human-readable display label. Display surfaces that need readable realm/tag text SHALL resolve the realm and tag Units separately.

#### Scenario: Unit with global tags and realm membership

- **GIVEN** a Unit associated with UnitTag rows for tag-A and tag-B, and a RealmUnit row for realm-X
- **WHEN** the unit is synced
- **THEN** the document SHALL have `tagIds` containing tag-A and tag-B UUIDs
- **AND** `realmIds` containing realm-X UUID
- **AND** `realmTagKeys` SHALL be empty (no RealmTagApplication rows exist)

#### Scenario: Unit with realm-scoped tag classification

- **GIVEN** a Unit with a RealmTagApplication row (realm-X, tag-A, this-unit)
- **WHEN** the unit is synced
- **THEN** the document's `realmTagKeys` SHALL contain `"{realm-X-uuid}:{tag-A-uuid}"`

#### Scenario: Realm tag key can exist without realm membership

- **GIVEN** a Unit has `RealmTagApplication(realm-X, tag-A, this-unit)`
- **AND** no `RealmUnit(realm-X, this-unit)` row exists
- **WHEN** the unit is synced
- **THEN** the document's `realmTagKeys` SHALL contain `"{realm-X-uuid}:{tag-A-uuid}"`
- **AND** the document's `realmIds` SHALL NOT contain `realm-X` unless a separate RealmUnit row exists

#### Scenario: Realm tag key is not a display label

- **WHEN** a search response contains `realmTagKeys = ["realm-X:tag-A"]`
- **THEN** the frontend-facing response layer SHALL treat the key as a filter value
- **AND** any user-visible badge or section title SHALL be built from resolved realm and tag display data rather than the raw compound key

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

The content index SHALL configure searchable attributes in priority order: `titles`, `subtitles`, `contentText`, `descriptionText`, `descriptions`, `summaries`, `creditNames`, `tagLabels`, and `subjectNames`.

#### Scenario: Title match ranks higher than description match

- **GIVEN** two documents: one with "magic" in `titles`, another with "magic" only in `descriptionText`
- **WHEN** searching for "magic"
- **THEN** the document with "magic" in `titles` SHALL rank higher

#### Scenario: Content text is searchable

- **GIVEN** a document with "dragon treaty" only in `contentText`
- **WHEN** searching for "dragon treaty"
- **THEN** the document SHALL be eligible to match through the content index

### Requirement: ContentDoc text projection is indexed

The content index SHALL include a `contentText` field for indexable Units whose canonical content is stored as `ContentDoc`. Runtime v1 SHALL derive `contentText` during sync or full reindex from supported `content.main.source` Markdown only. `contentText` SHALL NOT be read from any PostgreSQL `contentText` column.

#### Scenario: Markdown main text is projected

- **WHEN** a published post or chapter has `content.main.type = "markdown"`
- **THEN** Meilisearch sync SHALL derive `contentText` from `content.main.source`
- **AND** the derived text SHALL include `content.main.source` verbatim

#### Scenario: PostgreSQL projection is not required

- **WHEN** a content document is indexed
- **THEN** the sync process SHALL derive text from canonical content JSON
- **AND** it SHALL NOT require a PostgreSQL `contentText` field

### Requirement: Slot-bearing content is not indexed in runtime v1

When a content document includes slots whose types contribute text (e.g. `infobox` row labels, infobox markdown values, `entity-list` titles), runtime v1 SHALL preserve those slots in stored JSON but SHALL NOT include slot text in `contentText`. New slot types added in the future MUST update the contract-level `extractText` helper, but wiring slot text into Meilisearch is deferred until structured slot support is implemented.

#### Scenario: Infobox text is searchable

- **GIVEN** a wiki post whose `content.slots.infobox` contains a row with label "Author" and a markdown value referencing a character
- **WHEN** the post is synced to Meilisearch
- **THEN** runtime v1 `contentText` SHALL NOT include the "Author" label or markdown value source solely from that slot

### Requirement: Description text projection is indexed

The content index SHALL include `descriptionText` for rich descriptions stored as `ContentDoc` (`User.description`, `UnitTranslation.description`, and any future rich-description field). Runtime v1 SHALL derive `descriptionText` during sync or full reindex from supported `description.main.source` Markdown only and SHALL NOT read from a PostgreSQL `descriptionText` column.

#### Scenario: Rich description is projected

- **WHEN** a Unit has a Markdown description content document
- **THEN** Meilisearch sync SHALL derive `descriptionText` from `description.main.source`

### Requirement: Index filterable attributes cover all filter dimensions

The content index SHALL configure the following as filterable attributes: `type`, `tagIds`, `realmIds`, `realmTagKeys`, `languages`, `rating`, `visibility`, `isLicensed`, `userId`, `containedUnitIds`.

#### Scenario: Filter by type

- **WHEN** a search query includes filter `type = "BOOK"`
- **THEN** only documents with `type = "BOOK"` SHALL be returned

#### Scenario: Filter by realm and realm-scoped tag

- **WHEN** a search query includes filter `realmTagKeys = "{realmId}:{tagId}"`
- **THEN** only documents that have that exact compound key in their `realmTagKeys` array SHALL be returned

#### Scenario: Filter shelves by contained unit id

- **GIVEN** the federated `book` scope querying for shelves containing book `b-9`
- **WHEN** the orchestrator builds the content sub-query
- **THEN** the filter SHALL include `type = "SHELF" AND containedUnitIds = "b-9"`
- **AND** Meilisearch SHALL accept this filter against the configured `filterableAttributes`

#### Scenario: Filter content by author userId

- **WHEN** a search query includes filter `userId = "u-3"`
- **THEN** only documents authored by that user SHALL be returned

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

### Requirement: Shelf documents include containedUnitIds

Every content document with `type = "SHELF"` SHALL contain a `containedUnitIds: string[]` field listing the unit ids of every item the shelf currently holds. Documents whose `type` is not `SHELF` SHALL omit the field or carry an empty array. The field SHALL be sourced from `ShelfItem` rows where `ShelfItem.shelfUnitId = <document.id>`.

#### Scenario: Shelf with three items has the three ids

- **GIVEN** a published shelf `s-1` with `ShelfItem` rows pointing to `b-1`, `b-2`, `b-3`
- **WHEN** the shelf is synced to Meilisearch
- **THEN** the shelf document SHALL have `containedUnitIds: ["b-1", "b-2", "b-3"]` (order is implementation-defined)

#### Scenario: Empty shelf has empty array

- **GIVEN** a published shelf with no items
- **WHEN** the shelf is synced
- **THEN** the document SHALL have `containedUnitIds: []`

#### Scenario: Non-shelf documents are unaffected

- **GIVEN** a published BOOK document
- **WHEN** the document is read
- **THEN** the `containedUnitIds` field SHALL be absent or `[]`
- **AND** SHALL NOT be populated with anything related to the BOOK's own contents

### Requirement: ShelfItem mutations trigger partial resync

The system SHALL trigger a Meilisearch partial-update of the parent shelf document whenever a `ShelfItem` row is inserted or deleted. The update SHALL touch only the `containedUnitIds` field on the document; the rest of the document SHALL NOT be re-queried. The sync SHALL be fire-and-forget and SHALL mirror the structure of the existing `RealmUnit` → post `realmIds` sync triggers.

When a shelf is mutated by a batched operation (e.g., adding N items at once), the orchestrator SHOULD coalesce the multi-row writes into a single partial-update by computing the post-state `containedUnitIds` once, rather than emitting N partial-updates.

#### Scenario: Adding an item resyncs the shelf

- **GIVEN** shelf `s-1` is indexed with `containedUnitIds: ["b-1"]`
- **WHEN** a `ShelfItem(s-1, b-2)` row is inserted via `ShelfService.addItem`
- **THEN** the system SHALL push a partial-update for shelf `s-1`
- **AND** the resulting document SHALL have `containedUnitIds: ["b-1", "b-2"]`

#### Scenario: Removing an item resyncs the shelf

- **GIVEN** shelf `s-1` is indexed with `containedUnitIds: ["b-1", "b-2"]`
- **WHEN** the `ShelfItem(s-1, b-1)` row is deleted via `ShelfService.removeItem`
- **THEN** the system SHALL push a partial-update for shelf `s-1`
- **AND** the resulting document SHALL have `containedUnitIds: ["b-2"]`

#### Scenario: Batched bulk-add coalesces

- **GIVEN** an empty shelf `s-1`
- **WHEN** `ShelfService` adds three items in a single batch
- **THEN** the system SHALL emit at most a small constant number of partial-update tasks (one per batch boundary), not three
- **AND** the final document SHALL have all three ids in `containedUnitIds`

### Requirement: Full resync helper for containedUnitIds

The `@rezics/search` package SHALL expose a `syncAllContainedUnitIds(client: SearchClient)` helper that cursor-paginates over `Unit` rows where `type = "SHELF"` and pushes a partial update with the freshly computed `containedUnitIds` for each shelf. The helper SHALL be invocable via a CLI script analogous to `package/server/src/script/resync-post-root-targets.ts` and SHALL be idempotent.

#### Scenario: Helper updates only containedUnitIds

- **WHEN** `syncAllContainedUnitIds(client)` is invoked
- **THEN** the helper SHALL emit partial-updates that contain only `{ id, containedUnitIds }`
- **AND** SHALL NOT touch any other field on the shelf documents

#### Scenario: Helper is safe to re-run

- **GIVEN** a clean run of `syncAllContainedUnitIds` has completed
- **WHEN** the helper is run again with no source changes
- **THEN** the resulting documents SHALL be unchanged
- **AND** the helper SHALL complete without error

### Requirement: Content index includes subject fields

The content search document SHALL include subject-specific fields derived from SubjectAttribution rows: `subjectEntityIds`, `subjectNames`, `subjectKinds`, and `subjectRoles`. These fields SHALL be independent from credit fields.

#### Scenario: Indexed fan fiction includes character subject fields

- **GIVEN** published Unit "fanfic-1" has SubjectAttribution to Entity "character-1" with `role = "primary_character"`
- **WHEN** the Unit is synced to the content index
- **THEN** the document SHALL include `"character-1"` in `subjectEntityIds`
- **AND** it SHALL include the character's translated titles in `subjectNames`
- **AND** it SHALL include `"character"` in `subjectKinds`
- **AND** it SHALL include `"primary_character"` in `subjectRoles`

### Requirement: Credit names and subject names remain separate

The content index SHALL NOT add SubjectAttribution Entity names to `creditNames`. CreditAttribution mutations SHALL update credit fields, and SubjectAttribution mutations SHALL update subject fields.

#### Scenario: Character subject does not pollute credit search

- **GIVEN** Unit "fanfic-1" has no author credit but has a primary character SubjectAttribution
- **WHEN** the Unit is synced to the content index
- **THEN** the character name SHALL appear in `subjectNames`
- **AND** the character name SHALL NOT appear in `creditNames`

### Requirement: SubjectAttribution mutations trigger content partial sync

Creating, updating, or deleting a SubjectAttribution row SHALL trigger a Meilisearch partial update for the affected target Unit's subject fields.

#### Scenario: Link subject patches content document

- **WHEN** a SubjectAttribution row is created for target Unit "fanfic-1"
- **THEN** the system SHALL patch the "fanfic-1" content document's subject fields
- **AND** it SHALL NOT rebuild unrelated credit fields as part of the subject-only patch

### Requirement: Content index sources realm tag keys from RealmTagApplication

The content index SHALL source realm-scoped tag machine filter keys from `RealmTagApplication` rows. The field values SHALL preserve the existing compound format `"{realmUnitId}:{tagUnitId}"` unless a separate search contract change renames the field.

#### Scenario: Application produces realm tag key

- **GIVEN** `RealmTagApplication(realm-X, tag-A, unit-1)` exists
- **WHEN** `unit-1` is synced to the content index
- **THEN** the document's realm tag key field SHALL contain `"realm-X:tag-A"`

#### Scenario: Old model name is not used in search code

- **WHEN** a developer audits content indexing code
- **THEN** search sync code SHALL refer to realm tag applications rather than `RealmTagUnit`

### Requirement: Content index includes searchable Unit aliases
The content index SHALL include alias-derived searchable text for indexed Units. Alias-derived searchable fields SHALL be separate from translation-derived fields such as `titles`, `subtitles`, `summaries`, and `descriptions`.

#### Scenario: Content document includes accepted alias values
- **GIVEN** an indexed BOOK Unit has alias values `"3 Body Problem"` and `"TBF"`
- **WHEN** the Unit is synced to the content index
- **THEN** the document SHALL contain those values in alias-derived searchable fields
- **AND** the document's `titles` array SHALL continue to contain only UnitTranslation title values

### Requirement: Content index includes aliases by score threshold or pin
When building alias-derived searchable fields for content documents, the system SHALL include aliases where `score > visibilityThreshold OR pinned = true`. It SHALL exclude unpinned aliases at or below the visibility threshold.

#### Scenario: Pinned alias below threshold is indexed
- **GIVEN** an alias has `score = -120` and `pinned = true`
- **WHEN** the owning Unit is synced to the content index
- **THEN** the alias value SHALL be indexed as searchable text

#### Scenario: Unpinned alias below threshold is not indexed
- **GIVEN** an alias has `score = -120` and `pinned = false`
- **WHEN** the owning Unit is synced to the content index
- **THEN** the alias value SHALL NOT be indexed as searchable text

### Requirement: Content index includes pinned UnitTags below threshold
When building tag-derived searchable fields for content documents, the system SHALL include a UnitTag row if `score > visibilityThreshold OR pinned = true`. Pinned UnitTags SHALL preserve their raw score in `tagScores` and SHALL NOT receive an indexed ranking boost solely because they are pinned.

#### Scenario: Pinned low-score UnitTag remains filterable
- **GIVEN** `UnitTag(unit-1, tag-1)` has `score = -120`
- **AND** `pinned = true`
- **WHEN** `unit-1` is synced to the content index
- **THEN** `tag-1` SHALL be included in the document's `tagIds`
- **AND** `tagScores["tag-1"]` SHALL equal `-120`

#### Scenario: Unpinned low-score UnitTag is excluded from search fields
- **GIVEN** `UnitTag(unit-1, tag-2)` has `score = -120`
- **AND** `pinned = false`
- **WHEN** `unit-1` is synced to the content index
- **THEN** `tag-2` SHALL NOT be included in the document's `tagIds`

### Requirement: Content documents include ranking fields

Each `content` Meilisearch document SHALL include numeric ranking fields for list serving: `hotScore`, `topScore`, `trendingScore`, `qualityScore`, and a `rankUpdatedAt` timestamp or null. These fields SHALL be populated from the ranking service projection and SHALL default to numeric zero values when no projection exists.

#### Scenario: Content document has default ranking fields
- **WHEN** a content document is built before ranking has computed a projection
- **THEN** the document SHALL include `hotScore = 0`, `topScore = 0`, `trendingScore = 0`, and `qualityScore = 0`

#### Scenario: Ranking patch updates content fields
- **WHEN** the ranking service patches the `content` document for `book-1`
- **THEN** the document SHALL store the latest ranking scores from the ranking projection

### Requirement: Content index supports ranking sorts

The `content` Meilisearch index SHALL configure `hotScore`, `topScore`, `trendingScore`, and `qualityScore` as sortable attributes in addition to existing temporal sortable attributes.

#### Scenario: Content hot sort is accepted
- **WHEN** a content search query requests sort `hotScore:desc`
- **THEN** Meilisearch SHALL accept the sort because `hotScore` is configured as sortable

#### Scenario: Existing temporal sort remains accepted
- **WHEN** a content search query requests sort `publishedAt:desc`
- **THEN** Meilisearch SHALL continue to accept the sort

### Requirement: Content search options expose ranking sorts

Content search APIs SHALL allow clients to request ranking sort fields for content discovery. Ranking sort fields SHALL be additive and SHALL NOT remove existing relevance or temporal sort options.

#### Scenario: Client requests trending content
- **WHEN** a client calls the content search endpoint with sort field `trendingScore` and order `desc`
- **THEN** the server SHALL forward `trendingScore:desc` to Meilisearch

#### Scenario: Relevance remains available
- **WHEN** a client calls the content search endpoint with sort field `relevance`
- **THEN** the server SHALL preserve the existing relevance behavior
