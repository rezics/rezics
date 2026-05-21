# meili-partial-sync Specification

## Purpose
TBD - normalized from legacy delta-marker spec. Defines partial-update Meilisearch sync primitives (`patch*` client methods and per-field-group sync helpers) so individual data changes can patch only the affected fields instead of triggering full reindex.

## Requirements

### Requirement: SearchClient provides partial update methods for all indexes

The `SearchClient` class SHALL provide `patch*` methods for each index that use `updateDocuments()` (partial merge) instead of `addDocuments()` (full replace). The methods SHALL be: `patchContent(docs)`, `patchUsers(docs)`, `patchPosts(docs)`, `patchRealms(docs)`, `patchFeedbacks(docs)`.

#### Scenario: Partial update merges only provided fields

- **WHEN** `patchPosts([{ id: "post-1", authorName: "New Name" }])` is called
- **THEN** the Meilisearch JS client's `updateDocuments()` method SHALL be invoked on the posts index
- **AND** only the `authorName` field SHALL be updated on document `post-1`
- **AND** all other fields on the document SHALL remain unchanged

#### Scenario: Partial update handles batch of documents

- **WHEN** `patchPosts([{ id: "post-1", authorName: "X" }, { id: "post-2", authorName: "X" }])` is called
- **THEN** both documents SHALL be sent in a single `updateDocuments()` call

### Requirement: Partial sync functions exist for content index field groups

The search package SHALL provide partial sync functions that fetch only the relevant data and send partial updates:

- `patchContentTags(client, unitId)` — fetches UnitTag rows with tag translations, sends `tagIds`, `tagScores`, `tagLabels`
- `patchContentCredits(client, unitId)` — fetches PersonCredit and OrgCredit rows, sends `creditNames`
- `patchContentTranslations(client, unitId)` — fetches UnitTranslation rows, sends `titles`, `subtitles`, `summaries`, `descriptions`, `languages`, `translations`
- `patchContentRealmIds(client, unitId)` — fetches RealmUnit rows, sends `realmIds`
- `patchContentRealmTagKeys(client, unitId)` — fetches RealmTagUnit rows, sends `realmTagKeys`
- `patchContentMetadata(client, unitId, fields)` — sends caller-provided metadata fields directly (no DB query)

#### Scenario: Tag attach triggers partial content sync

- **GIVEN** a content document exists in the index with `tagIds: ["tag-A"]`
- **WHEN** `patchContentTags(client, unitId)` is called after a new tag "tag-B" is attached
- **THEN** the function SHALL query only UnitTag rows (with tag translations) for that unitId
- **AND** SHALL send a partial update with `tagIds: ["tag-A", "tag-B"]`, updated `tagScores`, and updated `tagLabels`
- **AND** SHALL NOT query translations, credits, realm associations, or type extensions

#### Scenario: Credit unlink triggers partial content sync

- **GIVEN** a content document with `creditNames: ["Author A", "Publisher B"]`
- **WHEN** `patchContentCredits(client, unitId)` is called after "Publisher B" is unlinked
- **THEN** the function SHALL query only PersonCredit and OrgCredit rows for that unitId
- **AND** SHALL send a partial update with `creditNames: ["Author A"]`

#### Scenario: Translation upsert triggers partial content sync

- **GIVEN** a content document exists in the index
- **WHEN** `patchContentTranslations(client, unitId)` is called after a translation is updated
- **THEN** the function SHALL query only UnitTranslation rows for that unitId
- **AND** SHALL send a partial update with `titles`, `subtitles`, `summaries`, `descriptions`, `languages`, and `translations`

#### Scenario: Metadata update sends caller-provided values

- **WHEN** `patchContentMetadata(client, unitId, { coverUrl: "/new.jpg", rating: "R_18" })` is called
- **THEN** the function SHALL send a partial update with only `coverUrl` and `rating`
- **AND** SHALL NOT perform any database query

### Requirement: Partial sync functions exist for fan-out post updates

The search package SHALL provide:

- `patchPostsAuthor(client, userId, fields)` — queries post IDs by `authorUserId`, sends caller-provided author fields to each
- `patchPostsTarget(client, targetUnitId)` — queries post IDs and target unit data, sends `targetTitles`, `targetType`, `targetCoverUrl`
- `patchPostFields(client, unitId, fields)` — sends caller-provided post fields directly (no DB query)

#### Scenario: Author profile change patches all author's posts

- **GIVEN** user "alice-id" has 100 posts in the index
- **WHEN** `patchPostsAuthor(client, "alice-id", { authorName: "Alice W.", authorAvatar: "/new.png" })` is called
- **THEN** the function SHALL query `SELECT unitId FROM posts WHERE authorUserId = 'alice-id'`
- **AND** SHALL send 100 partial update documents each containing only `{ id, authorName, authorAvatar }`
- **AND** SHALL NOT fetch post body, target unit, score entry, or any other relations

#### Scenario: Target title change patches all targeting posts

- **GIVEN** 30 posts target unit "book-1"
- **WHEN** `patchPostsTarget(client, "book-1")` is called
- **THEN** the function SHALL query post IDs where `targetUnitId = 'book-1'` and the target unit's translations + type extension
- **AND** SHALL send 30 partial update documents each containing `{ id, targetTitles, targetType, targetCoverUrl }`

#### Scenario: Post edit sends only changed fields

- **WHEN** `patchPostFields(client, "post-1", { body: "updated text", isLocked: true })` is called
- **THEN** the function SHALL send a partial update with only `{ id: "post-1", body, isLocked }`
- **AND** SHALL NOT perform any database query

### Requirement: Partial sync functions exist for realm updates

The search package SHALL provide:

- `patchRealmMemberCount(client, unitId, memberCount)` — sends only `memberCount` (no DB query)
- `patchRealmMetadata(client, unitId, fields)` — sends caller-provided metadata fields (no DB query)
- `patchRealmTranslations(client, unitId)` — fetches UnitTranslation rows, sends `titles`, `descriptions`, `translations`

#### Scenario: Member join patches only memberCount

- **WHEN** `patchRealmMemberCount(client, "realm-1", 42)` is called
- **THEN** the function SHALL send a partial update with only `{ id: "realm-1", memberCount: 42 }`
- **AND** SHALL NOT query any database table

#### Scenario: Realm metadata update sends only changed fields

- **WHEN** `patchRealmMetadata(client, "realm-1", { isPublic: false })` is called
- **THEN** the function SHALL send a partial update with only `{ id: "realm-1", isPublic: false }`

### Requirement: Partial sync functions exist for user and feedback updates

The search package SHALL provide:

- `patchUserFields(client, unitId, fields)` — sends caller-provided user fields (no DB query)
- `patchFeedbackResolution(client, id, fields)` — sends caller-provided resolution fields (no DB query)

#### Scenario: User profile update patches only changed fields

- **WHEN** `patchUserFields(client, "user-1", { name: "New Name", avatar: "/new.png" })` is called
- **THEN** the function SHALL send a partial update with only `{ id: "user-1", name, avatar }`

#### Scenario: Feedback resolution patches only resolution fields

- **WHEN** `patchFeedbackResolution(client, "fb-1", { resolved: true, resolvedAt: "2026-04-14T00:00:00Z" })` is called
- **THEN** the function SHALL send a partial update with only `{ id: "fb-1", resolved, resolvedAt }`

### Requirement: Fan-out partial sync uses cursor-based batching

Fan-out functions (`patchPostsAuthor`, `patchPostsTarget`) SHALL process documents in batches using cursor-based pagination, consistent with existing full sync functions.

#### Scenario: Large fan-out is batched

- **GIVEN** a user has 10,000 posts
- **WHEN** `patchPostsAuthor(client, userId, fields)` is called
- **THEN** the function SHALL process posts in batches (up to BATCH_SIZE per iteration)
- **AND** SHALL use cursor-based pagination to avoid memory exhaustion

### Requirement: Factory search sync is targeted by Unit and index
The factory Meilisearch synchronization step SHALL use targeted single-unit or partial sync functions selected from manifest sync targets. It SHALL synchronize the current database projection for each listed Unit and target.

#### Scenario: Content target syncs one content document
- **WHEN** a manifest entry includes the `content` sync target
- **THEN** factory targeted sync SHALL synchronize that Unit's content search document from the current database state

#### Scenario: Post target syncs one post document
- **WHEN** a manifest entry includes the `post` sync target
- **THEN** factory targeted sync SHALL synchronize that Unit's post search document from the current database state

### Requirement: Factory sync includes required derived patches
Special scenario manifest entries SHALL include every sync target or partial patch required for the scenario's search-visible derived state.

#### Scenario: Shelf contained units are patched
- **WHEN** a complex shelf scenario creates or changes shelf membership
- **THEN** the manifest-driven sync SHALL update the shelf content document's contained Unit metadata

### Requirement: Full sync remains explicit drift repair
Full Meilisearch sync functions SHALL remain available for explicit drift repair or admin operations, but the factory seed flow SHALL NOT use full sync as the default synchronization strategy.

#### Scenario: Factory does not full-sync by default
- **WHEN** a factory run uses Meili mode `init-and-sync`
- **THEN** it SHALL synchronize the manifest targets
- **AND** it SHALL NOT run full content, post, realm, entity, or user reindex functions unless explicitly requested by a separate drift-repair mode
