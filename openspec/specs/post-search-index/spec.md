# post-search-index Specification

## Purpose

Defines the Meilisearch `posts` index that powers post listing and search across the platform: the index settings (searchable, filterable, sortable attributes), the denormalized document shape (author, target, score, realmIds), the indexing rules (only non-deleted posts), full reindex, and incremental sync triggers including realm-membership mutations.
## Requirements
### Requirement: Posts Meilisearch index exists with correct settings

The system SHALL maintain a Meilisearch index named `posts` with primary key `id`. The index SHALL be configured with searchable attributes in priority order: `body`, `targetTitles`, `authorName`. Filterable attributes SHALL include: `kind`, `targetUnitId`, `realmIds`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`, `rootTargetUnitId`, `rootTargetUnitType`. Sortable attributes SHALL include: `createdAt`, `updatedAt`, `replyCount`.

The previously-used singular filterable attribute `realmUnitId` SHALL be replaced by the multi-value `realmIds` to reflect that a post may belong to multiple realms via the `RealmUnit` junction (see `realm-post-junction` capability).

The new `rootTargetUnitId` and `rootTargetUnitType` filterable attributes SHALL enable Book/Game/Media-scoped post search to return the full reply tree (root posts and all descendants) via a single equality filter, without query-time expansion of root post id lists.

#### Scenario: Posts index initialized

- **WHEN** the posts index initialization endpoint is called
- **THEN** a Meilisearch index named `posts` SHALL exist with primary key `id`
- **AND** searchable attributes SHALL be `["body", "targetTitles", "authorName"]`
- **AND** filterable attributes SHALL include `kind`, `targetUnitId`, `realmIds`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`, `rootTargetUnitId`, `rootTargetUnitType`
- **AND** filterable attributes SHALL NOT include the legacy singular `realmUnitId`
- **AND** sortable attributes SHALL include `createdAt`, `updatedAt`, `replyCount`

### Requirement: Post document contains denormalized data for list rendering

Each post document SHALL contain: `id` (unit UUID), `body`, `kind`, `depth`, `sortPath`, `isLocked`, `replyCount`, `directReplyCount`, `lastReplyAt`, `createdAt`, `updatedAt`, `targetUnitId`, `realmIds`, `rootPostUnitId`, `parentPostUnitId`, `authorUserId`, `scoreEntryId`, `rootTargetUnitId`, `rootTargetUnitType`. Additionally, it SHALL contain denormalized fields: `authorName`, `authorSlug`, `authorAvatar` (from User), `targetTitles` (array of title strings from the target unit's translations), `targetType` (UnitType of target), `targetCoverUrl` (cover from type extension), `scoreValue` and `scoreFields` (from linked ScoreEntry if present).

The `realmIds` field SHALL be a string array sourced from `RealmUnit` rows where `RealmUnit.unitId = post.unitId`. An empty array SHALL be used when the post belongs to no realm. The previously-existing singular `realmUnitId` field SHALL be removed from the document shape.

The `rootTargetUnitId` field SHALL hold the `targetUnitId` of this post's root post (the post identified by `rootPostUnitId`). For a top-level post (where `rootPostUnitId` equals the post's own `unitId`), `rootTargetUnitId` SHALL equal the post's own `targetUnitId`. The field SHALL be null when the root post has no target. The `rootTargetUnitType` field SHALL hold the `Unit.type` of the unit referenced by `rootTargetUnitId`, or null when `rootTargetUnitId` is null.

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

#### Scenario: Top-level review document includes rootTargetUnitId equal to its own targetUnitId

- **GIVEN** a top-level REVIEW post `R` with `targetUnitId = "book-B"` and `rootPostUnitId = R.unitId`
- **WHEN** `R` is synced to Meilisearch
- **THEN** the document SHALL have `rootTargetUnitId: "book-B"` and `rootTargetUnitType: "BOOK"`

#### Scenario: Reply document inherits rootTargetUnitId from its root post

- **GIVEN** a comment `C1` whose root post is REVIEW `R` with `targetUnitId = "book-B"`
- **WHEN** `C1` is synced to Meilisearch
- **THEN** the document SHALL have `rootTargetUnitId: "book-B"` and `rootTargetUnitType: "BOOK"`
- **AND** this SHALL hold regardless of `C1`'s own `targetUnitId` (which typically points to `R`)

#### Scenario: Nested reply preserves rootTargetUnitId

- **GIVEN** a reply `C2` whose `parentPostUnitId = C1` and whose root post is REVIEW `R` targeting `"book-B"`
- **WHEN** `C2` is synced to Meilisearch
- **THEN** the document SHALL have `rootTargetUnitId: "book-B"` and `rootTargetUnitType: "BOOK"`

#### Scenario: Top-level post with no target has null rootTargetUnitId

- **GIVEN** a top-level POST kind with `targetUnitId = null` (free-form realm post)
- **WHEN** the post is synced to Meilisearch
- **THEN** the document SHALL have `rootTargetUnitId: null` and `rootTargetUnitType: null`

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

### Requirement: Posts can be filtered by rootTargetUnitId for unit-scoped search

The post search service SHALL accept an optional `rootTargetUnitId` filter and an optional `rootTargetUnitType` filter on the `posts` index. When `rootTargetUnitId` is provided, the search SHALL return posts (root posts and all descendants) whose root post's target equals the given unit id. When `rootTargetUnitType` is provided, the search SHALL return posts whose root target's unit type matches the given value.

The filter SHALL be expressed as a single equality predicate on Meilisearch (`rootTargetUnitId = "<id>"`), without expanding root post ids in the application layer.

#### Scenario: Book-scoped post search returns root posts and replies

- **GIVEN** Book `B` with REVIEW `R` (`targetUnitId = B`), comment `C1` replying to `R`, and reply `C2` replying to `C1`
- **AND** all three are indexed with `rootTargetUnitId = B`
- **WHEN** a search is performed with `rootTargetUnitId = "B"`
- **THEN** the result SHALL include `R`, `C1`, and `C2`

#### Scenario: Book-scoped search excludes posts targeting a different book

- **GIVEN** Book `B1` with REVIEW `R1` and Book `B2` with REVIEW `R2`
- **WHEN** a search is performed with `rootTargetUnitId = "B1"`
- **THEN** the result SHALL include `R1` and its descendants
- **AND** SHALL NOT include `R2` or its descendants

#### Scenario: Filter by root target unit type

- **WHEN** a search is performed with `rootTargetUnitType = "BOOK"`
- **THEN** the result SHALL include only posts whose root target is a Unit of type `BOOK`

#### Scenario: rootTargetUnitId filter combined with keyword search

- **GIVEN** Book `B` with multiple posts, some containing the keyword "spoiler"
- **WHEN** a search is performed with keyword `"spoiler"` and `rootTargetUnitId = "B"`
- **THEN** the result SHALL include only posts under Book `B` that match the keyword

### Requirement: rootTargetUnitId is backfilled and partially resynced for existing posts

The system SHALL provide an idempotent backfill process that derives `rootTargetUnitId` and `rootTargetUnitType` for every existing post and writes both fields into Postgres, then a partial Meilisearch resync that pushes only those two fields onto every existing document.

The backfill SHALL derive `rootTargetUnitId` from `Post.rootPostUnitId → Post.targetUnitId` and `rootTargetUnitType` from the `Unit.type` of that target. The backfill SHALL be safe to rerun.

The partial resync SHALL update only the two new fields on existing Meilisearch documents (analogous to the existing `syncAllPostRealmIds` partial-resync helper) and SHALL NOT trigger a full document rebuild.

#### Scenario: Backfill populates rootTargetUnitId for existing posts

- **GIVEN** a Postgres `Post` table populated before this change, where every post has null `rootTargetUnitId`
- **WHEN** the backfill script runs to completion
- **THEN** every post `P` whose root post has a non-null `targetUnitId` SHALL have `P.rootTargetUnitId` set to that value
- **AND** every such post SHALL have `P.rootTargetUnitType` set to the `Unit.type` of that target

#### Scenario: Backfill leaves orphan top-level posts null

- **GIVEN** a top-level post with `targetUnitId = null`
- **WHEN** the backfill runs
- **THEN** `rootTargetUnitId` SHALL remain null
- **AND** `rootTargetUnitType` SHALL remain null

#### Scenario: Backfill is idempotent

- **GIVEN** the backfill has already run once
- **WHEN** the backfill runs a second time
- **THEN** no row values SHALL change
- **AND** the script SHALL complete without error

#### Scenario: Partial resync updates only new fields on existing documents

- **GIVEN** existing Meilisearch post documents indexed before this change
- **AND** the Postgres backfill has completed
- **WHEN** the partial resync helper runs
- **THEN** every existing document SHALL be updated with the current `rootTargetUnitId` and `rootTargetUnitType` from Postgres
- **AND** other fields on the document SHALL remain unchanged

### Requirement: Federated path forwards kind filter from query syntax

When the federated search orchestrator dispatches a sub-query against the `posts` index for a category that may surface posts (`all`, `mixed`, `posts`, `reviews`, `excerpts`, `remarks`), it SHALL forward the `kind` value from the parsed `SearchQuery` (populated from the `kind:` token defined in `search-query-syntax`) onto the post sub-query as the existing `PostSearchOptions.kind` filter. For category values that already imply a `kind` (e.g., `category = "reviews"` ⇒ `kind = "REVIEW"`), the category-implied filter SHALL take precedence over a conflicting `query.kind`.

The `posts` index `filterableAttributes` SHALL remain unchanged by this change; this requirement only governs how the orchestrator wires existing filters together.

#### Scenario: Free `kind:` token narrows the All view

- **GIVEN** `{ scope: { kind: "global" }, category: "all", query: { keyword: "magic", kind: "REVIEW" } }`
- **WHEN** the orchestrator builds post sub-queries for the `reviews`, `excerpts`, `remarks`, and `posts` sections
- **THEN** the `reviews` section SHALL apply `kind = "REVIEW"` (matches; surfaced)
- **AND** the `excerpts`, `remarks`, and `posts` sections SHALL be empty for this query (because `query.kind = "REVIEW"` does not match those categories)

#### Scenario: Category-implied kind beats free token

- **GIVEN** `{ scope: { kind: "book", unitId: "b-1" }, category: "reviews", query: { kind: "POST" } }`
- **WHEN** the orchestrator dispatches the single-category query
- **THEN** the post sub-query SHALL apply `kind = "REVIEW" AND rootTargetUnitId = "b-1"`
- **AND** SHALL NOT apply `kind = "POST"`

#### Scenario: kind ignored on non-post categories

- **GIVEN** `{ scope: { kind: "global" }, category: "books", query: { kind: "REVIEW", keyword: "x" } }`
- **WHEN** the orchestrator dispatches the content sub-query
- **THEN** the filter expression SHALL NOT contain `kind`
- **AND** the sub-query SHALL succeed without error

### Requirement: Post search indexes only public published posts
The post search index SHALL contain only posts whose backing Unit is `PUBLISHED` and `PUBLIC`.

#### Scenario: Private post is synced
- **WHEN** post sync processes a post whose backing Unit visibility is `PRIVATE`
- **THEN** the sync SHALL remove that post document from the post index

#### Scenario: Deleted post is synced
- **WHEN** post sync processes a post whose backing Unit status is `DELETED`
- **THEN** the sync SHALL remove that post document from the post index

### Requirement: Public post search excludes non-public posts
Public post search SHALL NOT return posts whose backing Unit is not public eligible.

#### Scenario: Public search runs after visibility change
- **WHEN** a post changes from `PUBLIC` to `PRIVATE`
- **THEN** public post search SHALL stop returning the post after sync completes

### Requirement: Post Work Scope Comes From UnitWork Membership

Post and review work-domain scope SHALL be represented by `UnitWork`
membership for the post Unit. The system SHALL NOT require a post-specific
`targetWorkUnitId` projection as the canonical work-domain index. Precise
release targeting SHALL remain represented by `targetUnitId`.

#### Scenario: Release-targeted review enters work scope

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **AND** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is created or indexed for work-domain search
- **THEN** `UnitWork(post-r, work-x, role = REVIEW)` SHALL exist
- **AND** the indexed/searchable representation MAY expose work membership
  derived from `UnitWork`

#### Scenario: Exact release target remains filterable

- **GIVEN** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is indexed
- **THEN** the document SHALL keep `targetUnitId = release-a`
- **AND** exact-release filters SHALL remain possible

### Requirement: Work-Domain Feed Uses UnitWork Membership

Release pages SHALL be able to show a work-domain feed by querying content
Units that have `UnitWork(workUnitId = currentWork, role in POST/REVIEW/...)`.
Exact-release views SHALL filter by `targetUnitId`.

#### Scenario: Release page shows all work-domain reviews

- **GIVEN** releases `release-a` and `release-b` both belong to `work-x`
- **AND** each release has one review registered in `UnitWork` under `work-x`
- **WHEN** the user opens the community tab on `release-a` in default mode
- **THEN** the feed SHALL include reviews targeting both `release-a` and
  `release-b`
- **AND** each result SHALL display its precise target release context

#### Scenario: User filters to current release

- **WHEN** the user switches the community feed to exact-release mode on
  `release-a`
- **THEN** the feed SHALL include posts with `targetUnitId = release-a`
- **AND** it SHALL exclude posts targeting sibling releases unless they also
  directly target `release-a`

### Requirement: Work Merge Repairs Post Work Membership

The system SHALL repair post work-domain membership when a source work is merged
into a target work. Post work-domain membership and work-domain feed queries
SHALL converge on the target canonical work. Existing precise `targetUnitId`
values SHALL remain unchanged.

#### Scenario: Review membership moves to target work

- **GIVEN** review `post-r` has `targetUnitId = release-a`
- **AND** `release-a` belonged to source work `work-old`
- **AND** `work-old` is merged into `work-new`
- **WHEN** post work-membership repair rebuilds `post-r`
- **THEN** `targetUnitId` SHALL remain `release-a`
- **AND** `UnitWork(post-r, work-new, role = REVIEW)` SHALL exist
- **AND** stale `UnitWork(post-r, work-old, role = REVIEW)` SHALL be removed
  unless another target still justifies it

