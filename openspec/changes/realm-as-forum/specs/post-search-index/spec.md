## MODIFIED Requirements

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

## ADDED Requirements

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
