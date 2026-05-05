# post-search-index Specification

## Purpose

Defines the Meilisearch `posts` index that powers post listing and search across the platform: the index settings (searchable, filterable, sortable attributes), the denormalized document shape (author, target, score, realmIds), the indexing rules (only non-deleted posts), full reindex, and incremental sync triggers including realm-membership mutations.

## Requirements

### Requirement: Posts Meilisearch index exists with correct settings

The system SHALL maintain a Meilisearch index named `posts` with primary key `id`. The index SHALL be configured with searchable attributes in priority order: `body`, `targetTitles`, `authorName`. Filterable attributes SHALL include: `kind`, `targetUnitId`, `realmIds`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`. Sortable attributes SHALL include: `createdAt`, `updatedAt`, `replyCount`.

The previously-used singular filterable attribute `realmUnitId` SHALL be replaced by the multi-value `realmIds` to reflect that a post may belong to multiple realms via the `RealmUnit` junction (see `realm-post-junction` capability).

#### Scenario: Posts index initialized

- **WHEN** the posts index initialization endpoint is called
- **THEN** a Meilisearch index named `posts` SHALL exist with primary key `id`
- **AND** searchable attributes SHALL be `["body", "targetTitles", "authorName"]`
- **AND** filterable attributes SHALL include `kind`, `targetUnitId`, `realmIds`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`
- **AND** filterable attributes SHALL NOT include the legacy singular `realmUnitId`
- **AND** sortable attributes SHALL include `createdAt`, `updatedAt`, `replyCount`

### Requirement: Post document contains denormalized data for list rendering

Each post document SHALL contain: `id` (unit UUID), `body`, `kind`, `depth`, `sortPath`, `isLocked`, `replyCount`, `directReplyCount`, `lastReplyAt`, `createdAt`, `updatedAt`, `targetUnitId`, `realmIds`, `rootPostUnitId`, `parentPostUnitId`, `authorUserId`, `scoreEntryId`. Additionally, it SHALL contain denormalized fields: `authorName`, `authorSlug`, `authorAvatar` (from User), `targetTitles` (array of title strings from the target unit's translations), `targetType` (UnitType of target), `targetCoverUrl` (cover from type extension), `scoreValue` and `scoreFields` (from linked ScoreEntry if present).

The `realmIds` field SHALL be a string array sourced from `RealmUnit` rows where `RealmUnit.unitId = post.unitId`. An empty array SHALL be used when the post belongs to no realm. The previously-existing singular `realmUnitId` field SHALL be removed from the document shape.

#### Scenario: Post document includes author info

- **GIVEN** a post authored by a user with name "Alice", slug "alice", avatar "/img/alice.png"
- **WHEN** the post is synced to Meilisearch
- **THEN** the document SHALL have `authorName: "Alice"`, `authorSlug: "alice"`, `authorAvatar: "/img/alice.png"`

#### Scenario: Post document includes target unit info

- **GIVEN** a review post targeting a book with translations "My Book" (en) and "我的书" (zh), coverUrl "/covers/book.jpg"
- **WHEN** the post is synced to Meilisearch
- **THEN** the document SHALL have `targetTitles: ["My Book", "我的书"]`, `targetType: "BOOK"`, `targetCoverUrl: "/covers/book.jpg"`

#### Scenario: Post document includes score data

- **GIVEN** a review post linked to a ScoreEntry with value 8 and fields `{ story: 9, art: 7 }`
- **WHEN** the post is synced to Meilisearch
- **THEN** the document SHALL have `scoreValue: 8`, `scoreFields: { story: 9, art: 7 }`

#### Scenario: Post without target or score

- **GIVEN** a remark post with no targetUnitId and no scoreEntryId
- **WHEN** the post is synced to Meilisearch
- **THEN** `targetTitles`, `targetType`, `targetCoverUrl`, `scoreValue`, `scoreFields` SHALL be null or absent

#### Scenario: Cross-posted post has multiple realm IDs

- **GIVEN** a post `p1` with `RealmUnit` rows for `realm-A`, `realm-B`, `realm-C`
- **WHEN** `p1` is synced to Meilisearch
- **THEN** the document SHALL have `realmIds: ["realm-A", "realm-B", "realm-C"]` (order is implementation-defined)

#### Scenario: Post in no realm has empty realmIds

- **GIVEN** a post with no `RealmUnit` rows
- **WHEN** the post is synced
- **THEN** the document SHALL have `realmIds: []`

### Requirement: RealmUnit mutations trigger post resync

The system SHALL trigger a Meilisearch sync of the affected post document whenever a `RealmUnit` row is inserted or deleted. The sync SHALL update only the `realmIds` field on the document (partial update); the rest of the document SHALL NOT be re-queried. The sync SHALL be fire-and-forget.

This requirement is in addition to the existing post-create/update/delete sync triggers.

#### Scenario: Adding a post to a realm resyncs its document

- **GIVEN** post `p1` is indexed with `realmIds: ["realm-A"]`
- **WHEN** a `RealmUnit("realm-B", p1)` row is inserted
- **THEN** `patchPostFields(p1.unitId, { realmIds: ["realm-A", "realm-B"] })` SHALL be called
- **AND** the resulting document SHALL have `realmIds: ["realm-A", "realm-B"]`

#### Scenario: Removing a post from a realm resyncs its document

- **GIVEN** post `p1` is indexed with `realmIds: ["realm-A", "realm-B"]`
- **WHEN** the `RealmUnit("realm-A", p1)` row is deleted
- **THEN** `patchPostFields(p1.unitId, { realmIds: ["realm-B"] })` SHALL be called
- **AND** the resulting document SHALL have `realmIds: ["realm-B"]`

#### Scenario: Sync is fire-and-forget

- **WHEN** a `RealmUnit` mutation triggers the post resync
- **THEN** the mutation request SHALL NOT block on the Meilisearch call
- **AND** errors from Meilisearch SHALL be logged but SHALL NOT fail the originating mutation

### Requirement: Only non-deleted posts are indexed

The posts index SHALL contain documents only for posts whose parent unit has `status != DELETED`. Deleted posts SHALL be removed from the index.

#### Scenario: Published post is indexed
- **GIVEN** a post with unit status `PUBLISHED`
- **WHEN** the post is synced
- **THEN** a document SHALL exist in the posts index

#### Scenario: Deleted post is removed from index
- **GIVEN** a post that was previously indexed
- **WHEN** the post's unit status is changed to `DELETED` and sync is triggered
- **THEN** the document SHALL be removed from the posts index

### Requirement: Full reindex syncs all qualifying posts

The system SHALL provide a full reindex operation that processes all non-deleted posts from the database in batches using cursor-based pagination and upserts them into the posts index.

#### Scenario: Full reindex populates posts index
- **GIVEN** the database contains 500 non-deleted posts and 10 deleted posts
- **WHEN** a full posts reindex is triggered
- **THEN** the posts index SHALL contain exactly 500 documents

### Requirement: Incremental post sync on mutations

The post service SHALL trigger an incremental sync to Meilisearch when a post is created, updated, or deleted. Post creation and deletion SHALL use full document sync. Post updates (body, isLocked, extra) SHALL use partial updates with only the changed fields. All syncs SHALL be fire-and-forget.

#### Scenario: Post creation triggers full sync

- **WHEN** a new post is created via `post.service.create()`
- **THEN** `syncPostToMeili(unitId)` SHALL be called with a full document rebuild (all fields including denormalized author, target, score data)

#### Scenario: Post update triggers partial sync

- **WHEN** a post is updated via `post.service.update()` with changed fields (e.g., body, isLocked)
- **THEN** `patchPostFields(unitId, { body, isLocked })` SHALL be called with only the changed fields
- **AND** SHALL NOT re-query author, target unit, or score entry data

#### Scenario: Post deletion triggers full sync (removal)

- **WHEN** a post is soft-deleted via `post.service.delete()`
- **THEN** `syncPostToMeili(unitId)` SHALL be called, which SHALL remove the document from the index
