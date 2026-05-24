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

Fan-out functions and job-runner fanout handlers SHALL process documents in
batches using cursor-based pagination, consistent with existing full sync
functions. Runtime fanout handlers SHALL process a bounded segment per job and
SHALL re-enqueue a continuation command with the next cursor when more targets
remain.

#### Scenario: Large fan-out is segmented

- **GIVEN** a user has 10,000 posts
- **WHEN** a runtime post-author fanout command is processed
- **THEN** the handler SHALL process posts in cursor-based batches
- **AND** it SHALL stop at the configured per-job segment limit
- **AND** it SHALL re-enqueue a continuation command when more posts remain

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

### Requirement: Job runner invokes partial sync primitives

Runtime search projection jobs SHALL invoke the existing `@rezics/search`
partial sync primitives instead of duplicating projection logic inside
`@rezics/job-runner`.

#### Scenario: Content tag job reuses search package helper

- **WHEN** the job-runner handles `search.content.patchTags`
- **THEN** it SHALL call the `@rezics/search` content tag patch helper with the
  configured SearchClient and server Prisma client
- **AND** it SHALL NOT rebuild tag projection logic inside the handler

### Requirement: Partial sync commands are idempotent current-state operations

Partial sync commands SHALL be safe to retry. A retried command SHALL compute
the desired projection from current database state and SHALL NOT depend on the
original CDC event ordering or before/after values.

#### Scenario: Retried translation patch reflects latest database state

- **WHEN** a `search.content.patchTranslations` job fails and later retries
- **THEN** the retry SHALL read current `UnitTranslation` rows
- **AND** the resulting document fields SHALL reflect the latest committed
  translations, not the stale CDC payload

### Requirement: Progress search sync is queued at runtime

Runtime changes to `UserUnitProgress` SHALL enqueue progress search sync or
remove jobs. The worker handler SHALL call the existing progress projection
helpers and SHALL keep progress document ids deterministic by `(userId, unitId)`.

#### Scenario: Progress upsert enqueues sync job

- **WHEN** a runtime progress upsert commits
- **THEN** the system SHALL enqueue `search.progress.sync(userId, unitId)`
- **AND** the worker handler SHALL write the `user_unit_progress` document using
  the current database row

#### Scenario: Progress soft delete enqueues remove job

- **WHEN** a runtime progress row is deleted or marked deleted
- **THEN** the system SHALL enqueue `search.progress.remove(userId, unitId)`
- **AND** the worker handler SHALL remove the deterministic progress document

### Requirement: Search sync jobs distinguish full, partial, delete, and fanout effects

Search command kinds SHALL explicitly identify whether the job performs a full
current-state sync, a partial field-group patch, a delete/remove, or a fanout
segment. Lane names alone SHALL NOT be used to infer handler behavior.

#### Scenario: Command kind selects handler

- **WHEN** the worker receives a job on `search.sync.slow`
- **THEN** it SHALL dispatch by command kind such as
  `search.content.patchTags`, `search.content.patchTranslations`, or
  `search.post.patchTarget`
- **AND** it SHALL NOT infer the operation solely from the lane name

### Requirement: Meilisearch task failures remain observable through job failures

Search jobs SHALL keep Meilisearch write failures observable through job
failure or retry state. When a handler error occurs before successful task
enqueue, the job SHALL fail or retry. If the Meilisearch client returns a task
uid successfully, the job SHALL record enough output metadata to correlate the
job with the Meilisearch task where practical.

#### Scenario: Meili request failure retries job

- **WHEN** the Meilisearch write request fails before returning a task
- **THEN** the search job SHALL fail or retry according to lane retry policy
- **AND** the failure SHALL be visible in job-runner admin inspection

#### Scenario: Meili task uid is recorded

- **WHEN** a handler receives a Meilisearch task uid from a write operation
- **THEN** the job output or logs SHALL include the task uid and index name
  where practical
