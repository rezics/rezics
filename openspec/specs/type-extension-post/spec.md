## ADDED Requirements

### Requirement: Post creation with author and optional target

A Post SHALL be created as a 1:1 extension on a Unit with `type = POST`. Every Post MUST have an `authorUserId` identifying the author. A Post MAY have a `targetUnitId` referencing the Unit that the post is about (e.g., a book being reviewed or discussed). The `unitId` field SHALL serve as the primary key and foreign key to the parent Unit.

#### Scenario: Create a post targeting a book

- GIVEN an authenticated user with userId "user-1" and an existing Unit "book-1" of type BOOK
- WHEN the user creates a Post with `targetUnitId = "book-1"`
- THEN a Unit with `type = POST` SHALL be created
- AND a Post extension record SHALL be created with `authorUserId = "user-1"`, `targetUnitId = "book-1"`, `depth = 0`, `isLocked = false`
- AND `rootPostUnitId` and `parentPostUnitId` SHALL be null for a top-level post

#### Scenario: Create a post without a target

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a Post without specifying `targetUnitId`
- THEN a Post extension record SHALL be created with `targetUnitId = null`
- AND all other default fields SHALL be applied normally

### Requirement: Post.body as fast-path content

The Post model SHALL have a `body` text field that stores the post content directly on the Post extension row. Post content MUST NOT be stored in UnitTranslation. This fast-path design avoids a join for the most common read operation.

#### Scenario: Post body is stored directly on the extension

- GIVEN a user creating a Post with body text "Great book, highly recommend"
- WHEN the Post is persisted
- THEN the `body` field on the Post record SHALL contain "Great book, highly recommend"
- AND no UnitTranslation record SHALL be created for the post body

#### Scenario: Read post content without joining UnitTranslation

- GIVEN an existing Post with `unitId = "post-1"` and `body = "Excellent read"`
- WHEN the system queries the Post by unitId
- THEN the body content SHALL be available directly from the Post row
- AND the query SHALL NOT require a join to UnitTranslation to retrieve the content

### Requirement: Flat mode for chronological listing

In flat mode, a Post's `sortPath` SHALL be null. Flat-mode queries SHALL retrieve posts by `targetUnitId` and order results by `createdAt` ascending. This mode is suitable for X-style chronological discussions.

#### Scenario: Query posts in flat mode

- GIVEN three Posts targeting "book-1" with `sortPath = null`, created at T1, T2, T3
- WHEN querying posts by `targetUnitId = "book-1"` in flat mode
- THEN the results SHALL be ordered by `createdAt` ascending: T1, T2, T3
- AND all returned posts SHALL have `sortPath = null`

#### Scenario: Flat mode post has null sortPath

- WHEN a Post is created in flat mode
- THEN the Post record SHALL have `sortPath = null`
- AND `depth` SHALL be 0 for top-level posts

### Requirement: Threaded mode with sortPath-based ordering

In threaded mode, every Post SHALL have a populated `sortPath` (VarChar 512) using a materialized path format. Each segment SHALL be a zero-padded 4-digit number (e.g., "0001.0003.0001"). Threaded-mode queries SHALL retrieve posts by `rootPostUnitId` and order results by `sortPath` ascending.

#### Scenario: Query posts in threaded mode

- GIVEN a root Post "post-root" with `sortPath = "0001"` and replies with `sortPath = "0001.0001"`, `sortPath = "0001.0002"`, `sortPath = "0001.0002.0001"`
- WHEN querying posts by `rootPostUnitId = "post-root"` in threaded mode
- THEN the results SHALL be ordered by `sortPath` ascending: "0001", "0001.0001", "0001.0002", "0001.0002.0001"

#### Scenario: sortPath segments are zero-padded 4-digit numbers

- GIVEN a Post with `sortPath = "0001.0003.0001"`
- WHEN inspecting the sortPath format
- THEN each segment separated by "." SHALL be exactly 4 digits, zero-padded

### Requirement: Reply creation sets parent and root references

When a reply is created, the Post MUST have `parentPostUnitId` set to the direct parent Post's unitId. The `rootPostUnitId` MUST be set to the top-level ancestor Post's unitId. The `depth` SHALL be the parent's depth plus one.

#### Scenario: Create a direct reply to a top-level post

- GIVEN a top-level Post "post-root" with `depth = 0` and `rootPostUnitId = null`
- WHEN a user creates a reply to "post-root"
- THEN the reply SHALL have `parentPostUnitId = "post-root"`, `rootPostUnitId = "post-root"`, and `depth = 1`

#### Scenario: Create a nested reply

- GIVEN a reply "post-reply-1" with `depth = 1`, `rootPostUnitId = "post-root"`, `parentPostUnitId = "post-root"`
- WHEN a user creates a reply to "post-reply-1"
- THEN the new reply SHALL have `parentPostUnitId = "post-reply-1"`, `rootPostUnitId = "post-root"`, and `depth = 2`

### Requirement: sortPath generation appends sibling index to parent path

When a reply is created in threaded mode, the system SHALL generate the reply's `sortPath` by appending a zero-padded 4-digit sibling index to the parent's `sortPath`, separated by ".". The sibling index SHALL be determined by the count of existing direct children of the parent plus one.

#### Scenario: First reply to a root post

- GIVEN a root Post with `sortPath = "0001"` and no existing replies
- WHEN a reply is created under this root
- THEN the reply's `sortPath` SHALL be "0001.0001"

#### Scenario: Third reply to a parent

- GIVEN a Post with `sortPath = "0001.0002"` and two existing direct children
- WHEN a third reply is created under this parent
- THEN the reply's `sortPath` SHALL be "0001.0002.0003"

### Requirement: Denormalized reply counts updated on reply creation

When a reply is created, the `directReplyCount` of the immediate parent Post MUST be incremented by 1. The `replyCount` of every ancestor Post up to and including the root Post MUST be incremented by 1.

#### Scenario: Direct reply increments parent counts

- GIVEN a root Post "post-root" with `replyCount = 0` and `directReplyCount = 0`
- WHEN a direct reply is created under "post-root"
- THEN "post-root" SHALL have `replyCount = 1` and `directReplyCount = 1`

#### Scenario: Nested reply increments ancestor counts

- GIVEN a root Post "post-root" with `replyCount = 1`, `directReplyCount = 1` and a reply "post-reply-1" with `replyCount = 0`, `directReplyCount = 0`
- WHEN a reply is created under "post-reply-1"
- THEN "post-reply-1" SHALL have `replyCount = 1` and `directReplyCount = 1`
- AND "post-root" SHALL have `replyCount = 2` and `directReplyCount = 1` (unchanged)

### Requirement: lastReplyAt updated on root post for any reply

When any reply is added anywhere in a post's thread tree, the `lastReplyAt` timestamp on the root Post MUST be updated to the current timestamp.

#### Scenario: Direct reply updates root lastReplyAt

- GIVEN a root Post "post-root" with `lastReplyAt = null`
- WHEN a direct reply is created at timestamp T1
- THEN "post-root" SHALL have `lastReplyAt = T1`

#### Scenario: Deeply nested reply updates root lastReplyAt

- GIVEN a root Post "post-root" with `lastReplyAt = T1` and a nested reply chain of depth 3
- WHEN a new reply is added at depth 4 at timestamp T2
- THEN "post-root" SHALL have `lastReplyAt = T2`

### Requirement: Realm-scoped discussions via realmUnitId

A Post MAY have a `realmUnitId` referencing a Realm Unit to scope the discussion within a community context. When `realmUnitId` is set, the post is considered part of that realm's content feed.

#### Scenario: Create a post within a realm

- GIVEN a Realm "realm-1" and a user "user-1"
- WHEN the user creates a Post with `realmUnitId = "realm-1"` and `targetUnitId = "book-1"`
- THEN the Post record SHALL have `realmUnitId = "realm-1"`
- AND the post SHALL appear in realm-1's content queries

#### Scenario: Post without realm context

- WHEN a Post is created without specifying `realmUnitId`
- THEN the Post record SHALL have `realmUnitId = null`
- AND the post SHALL exist in the global context only

### Requirement: Post locking prevents new replies

When a Post has `isLocked = true`, the system MUST reject any attempt to create a reply under that Post. The default value of `isLocked` SHALL be `false`.

#### Scenario: Reject reply to a locked post

- GIVEN a Post "post-1" with `isLocked = true`
- WHEN a user attempts to create a reply with `parentPostUnitId = "post-1"`
- THEN the system SHALL reject the request with a validation error
- AND no reply record SHALL be created

#### Scenario: Allow reply to an unlocked post

- GIVEN a Post "post-1" with `isLocked = false`
- WHEN a user creates a reply with `parentPostUnitId = "post-1"`
- THEN the reply SHALL be created normally

#### Scenario: Default lock state on creation

- WHEN a new Post is created without specifying `isLocked`
- THEN the Post SHALL be created with `isLocked = false`

### Requirement: Optional scoreEntryId FK on Post

The Post model SHALL have an optional `scoreEntryId` field (UUID) referencing a ScoreEntry. This FK SHALL use `onDelete: Restrict` to prevent accidental cascade deletion of reviews when a score is removed. Posts with `kindKey = "review"` MUST have a non-null `scoreEntryId`. Posts with other kind keys MAY have a null `scoreEntryId`.

#### Scenario: Review post has scoreEntryId set

- GIVEN a ScoreEntry "score-1" for user "user-1" on book "book-1"
- WHEN the user creates a Post with `kindKey = "review"` and `scoreEntryId = "score-1"`
- THEN the Post SHALL be created with `scoreEntryId = "score-1"`

#### Scenario: Review post without scoreEntryId is rejected

- WHEN a user attempts to create a Post with `kindKey = "review"` and `scoreEntryId = null`
- THEN the system SHALL reject the request with a validation error

#### Scenario: Discussion post without scoreEntryId is allowed

- WHEN a user creates a Post with `kindKey = "discussion"` and no `scoreEntryId`
- THEN the Post SHALL be created with `scoreEntryId = null`

#### Scenario: Restrict prevents cascade on score deletion

- GIVEN a Post "review-1" with `scoreEntryId = "score-1"`
- WHEN a non-admin attempts to delete ScoreEntry "score-1"
- THEN the database SHALL prevent the deletion due to the Restrict constraint
- AND the ScoreEntry SHALL remain intact

### Requirement: kindKey classifies post purpose

Every Post SHALL have a `kindKey` field that classifies its purpose. Valid values include `discussion`, `review`, `reply`, and `note`. The `kindKey` determines how the post is treated by the system: a Post with `kindKey = "review"` is a Review, a Post with a `parentPostUnitId` set is a Comment (typically with `kindKey = "reply"`). Posts with `kindKey = "review"` MUST have a non-null `scoreEntryId` referencing the user's score for the target unit. Posts with `kindKey = "note"` (remarks) MUST also have a non-null `scoreEntryId`.

#### Scenario: Create a review post

- GIVEN a user "user-1", a book "book-1", and an existing ScoreEntry "score-1" for the user on that book
- WHEN the user creates a Post with `kindKey = "review"`, `targetUnitId = "book-1"`, and `scoreEntryId = "score-1"`
- THEN the Post SHALL be classified as a review of "book-1" linked to the user's score

#### Scenario: Create a discussion post

- WHEN a user creates a Post with `kindKey = "discussion"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a discussion about "book-1"
- AND `scoreEntryId` SHALL be null

#### Scenario: Create a reply (comment)

- GIVEN an existing Post "post-1"
- WHEN a user creates a Post with `kindKey = "reply"` and `parentPostUnitId = "post-1"`
- THEN the Post SHALL be treated as a comment on "post-1"
- AND `scoreEntryId` SHALL be null

#### Scenario: Create a note (remark) with score

- GIVEN a user "user-1", a book "book-1", and an existing ScoreEntry "score-1" for the user on that book
- WHEN the user creates a Post with `kindKey = "note"`, `targetUnitId = "book-1"`, and `scoreEntryId = "score-1"`
- THEN the Post SHALL be classified as a remark on "book-1" linked to the user's score
