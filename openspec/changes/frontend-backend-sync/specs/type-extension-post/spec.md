## MODIFIED Requirements

### Requirement: kindKey classifies post purpose

Every Post SHALL have a `kindKey` field that classifies its purpose. Valid values are `discussion`, `review`, `remark`, `quote`, and `post`. The `kindKey` determines the content form of the post. A Post with `kindKey = "review"` is a Review. A Post with `kindKey = "remark"` is a short-form Remark. Structural role (top-level vs reply) is determined by threading fields (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`), not by `kindKey`. A reply is any Post with `parentPostUnitId` set, regardless of its `kindKey` value.

The value `comment` SHALL NOT be used for new posts. The `comment` kind is removed from the PostKind enum. Existing database rows with `kind = 'COMMENT'` remain as historical data but the application SHALL NOT create new posts with this value.

#### Scenario: Create a review post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "review"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a review of "book-1"

#### Scenario: Create a discussion post

- WHEN a user creates a Post with `kindKey = "discussion"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a discussion about "book-1"

#### Scenario: Create a reply to an existing post

- GIVEN an existing Post "post-1"
- WHEN a user creates a Post with `kindKey = "post"` and `parentPostUnitId = "post-1"`
- THEN the Post SHALL be treated as a reply to "post-1"
- AND the reply's structural role SHALL be determined by `parentPostUnitId`, not by `kindKey`

#### Scenario: Reject post creation with kindKey "comment"

- WHEN a client attempts to create a Post with `kindKey = "comment"`
- THEN the system SHALL reject the request with a validation error
- AND no Post record SHALL be created

#### Scenario: Valid kindKey values

- WHEN the system validates a Post's `kindKey` field
- THEN the only accepted values SHALL be `discussion`, `review`, `remark`, `quote`, and `post`
- AND the value `comment` SHALL NOT be accepted

## REMOVED Requirements

### Requirement: Comment server domain

**Reason**: The Comment domain (`comment.api.ts`, `comment.service.ts`, `comment.mapper.ts`, `comment.types.ts`) references the `CommentIndex` table which never existed in the database. All code in `package/server/src/comment/` is dead code. Comment/reply functionality is fully handled by the Post model's threading fields (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`).

**Migration**: All comment creation, listing, and thread retrieval operations are replaced by Post API endpoints. A reply is created as a Post with `parentPostUnitId` set. Thread queries use `rootPostUnitId` with `sortPath` ordering. No data migration is needed as the `CommentIndex` table never existed. Clients MUST switch to Post API contracts for all comment/reply functionality.

#### Scenario: Comment domain files deleted

- WHEN the system is deployed after this change
- THEN no server routes SHALL exist under the `comment/` domain
- AND no code SHALL reference `CommentIndex` as a database model

### Requirement: PostKind.COMMENT enum value

**Reason**: The `COMMENT` value in the PostKind enum conflates structural role (reply) with content form (kind). Threading semantics are fully expressed by `parentPostUnitId`, `rootPostUnitId`, `depth`, and `sortPath`. Keeping `COMMENT` as a kind value adds no information and encourages incorrect usage patterns where `kind` is used to determine reply status instead of checking `parentPostUnitId`.

**Migration**: Remove `COMMENT` from the Prisma `PostKind` enum and the contract type definition. Existing database rows with `kind = 'COMMENT'` remain as-is; no data migration is required for this change. The application stops creating new posts with this value. Frontend code that previously created posts with `kind: 'comment'` SHALL use `kind: 'post'` with `parentPostUnitId` set. A follow-up migration MAY batch-update historical `COMMENT` rows to `POST`.

#### Scenario: COMMENT removed from PostKind enum

- WHEN inspecting the PostKind enum definition in Prisma schema and contract types
- THEN the value `COMMENT` SHALL NOT be present
- AND the valid enum values SHALL be `REVIEW`, `REMARK`, `QUOTE`, `POST`
