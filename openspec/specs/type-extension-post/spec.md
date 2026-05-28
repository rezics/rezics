# type-extension-post Specification

## Purpose

Defines Post kind extensions and related rendering rules, including chapter-as-post behavior, excerpt source metadata, and the removal of legacy comment/quote post kinds.

## Requirements

### Requirement: CHAPTER is a valid Post kindKey

The `Post.kindKey` field SHALL accept `"chapter"` as a valid value alongside the existing `discussion`, `review`, `remark`, `excerpt`, and `post` values. A Post with `kindKey = "chapter"` represents a chapter of a book. Its `targetUnitId` SHALL reference the parent book unit (a Unit of type `BOOK`). Its `content` SHALL hold the chapter content as a `ContentDoc` whose `main` block is Markdown by default. Its `authorUserId` SHALL be the chapter author. Chapter posts SHALL NOT carry a `body` string column or DTO field.

A chapter Post SHALL use the same threading fields as any other Post (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`) to accommodate replies, annotations, and discussion threads attached to the chapter.

#### Scenario: Create a chapter post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "chapter"`, `targetUnitId = "book-1"`, `authorUserId = "user-1"`, and `content` containing `main = { type: "markdown", source: "Chapter One..." }`
- THEN the Post SHALL be persisted as a chapter of "book-1"
- AND the underlying Unit SHALL have `type = POST`
- AND `Post.content` SHALL store the `ContentDoc`

#### Scenario: Reject chapter post with non-BOOK targetUnitId

- GIVEN a Unit "u-2" of type `POST`
- WHEN a caller attempts to create a Post with `kindKey = "chapter"` and `targetUnitId = "u-2"`
- THEN the system SHALL reject the creation with a validation error
- AND no Post record SHALL be created

#### Scenario: Chapter post content retrieved from Post.content

- GIVEN a chapter Post whose `content.main.source = "Once upon a time..."`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `content` as a `ContentDoc`
- AND `content.main.source` SHALL equal "Once upon a time..."
- AND the DTO SHALL NOT expose a `body` field
- AND the content SHALL NOT be read from `UnitTranslation.description`

#### Scenario: Chapter cover URL sourced from UnitTranslation.extra

- GIVEN a chapter Post with a `UnitTranslation` row whose `extra = { coverUrl: "https://example.com/ch-cover.jpg" }`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `coverUrl = "https://example.com/ch-cover.jpg"` via the `unitTranslationExtraSchema` accessor
- AND no chapter-specific cover column SHALL exist on `Post`
- AND the cover URL SHALL NOT be embedded inside `content.slots`

### Requirement: Chapter ordering and grouping live in BookContentStructure, not Post

A chapter Post SHALL NOT carry ordering, numbering, or parent-chapter fields on the `Post` model. Chapter order and nesting within a book SHALL remain the responsibility of the `BookContentStructure.nodes` JSON field keyed by `bookUnitId`. A content-structure node MAY reference a materialized chapter Post through `chapterUnitId`, but the Post model SHALL remain agnostic of chapter-specific position metadata.

#### Scenario: Post model has no chapter-specific ordering fields

- GIVEN the Post model in the Prisma schema
- WHEN inspecting its fields
- THEN Post SHALL NOT contain `chapterNumber`, `sortOrder`, or `parentChapterUnitId` fields
- AND chapter position SHALL be derivable only by reading `BookContentStructure.nodes` for the target book

#### Scenario: Listing chapters of a book

- GIVEN a book `"book-1"` with three chapter Posts whose `targetUnitId = "book-1"` and `kindKey = "chapter"`
- WHEN a client requests the chapter list for `"book-1"`
- THEN the system SHALL return the three chapter Posts
- AND the order SHALL be determined by `BookContentStructure.nodes`, not by any field on Post

#### Scenario: Content-structure node can exist without a chapter Post

- GIVEN a BookContentStructure node `{ "title": "Chapter One" }` with no `chapterUnitId`
- WHEN the system renders the book content structure
- THEN the node SHALL be valid table-of-contents metadata
- AND no chapter Post SHALL be required until materialization is requested

#### Scenario: Chapter Post does not imply unique content-structure occurrence

- GIVEN a chapter Post with `unitId = "chapter-1"`
- AND a BookContentStructure contains two different paths that both reference `chapterUnitId = "chapter-1"`
- WHEN the system renders or materializes those occurrences
- THEN both occurrences SHALL be valid
- AND occurrence-specific UI state SHALL be keyed by BookContentStructure path rather than by Post fields

### Requirement: chapter/ server domain is a thin wrapper over post service

The `package/server/src/chapter/` domain SHALL remain as an API surface for chapter-centric operations but SHALL delegate persistence and retrieval to the post service, filtering on `kindKey = "chapter"` and `targetUnitId = <book>`. The domain SHALL NOT read or write `Unit(type=CHAPTER)` (which no longer exists) or `UnitTranslation.description` as a chapter content source. The domain SHALL NOT read or write a `body` string column.

#### Scenario: Chapter list API returns chapter Posts

- WHEN a client calls the chapter list endpoint for a given book
- THEN the implementation SHALL query posts filtered by `kindKey = "chapter"` and `targetUnitId = <book>`
- AND SHALL NOT query by `Unit.type = "CHAPTER"`

#### Scenario: Chapter create API produces a chapter Post

- WHEN a client calls the chapter create endpoint with `{ targetUnitId, title, content, userId }` where `content` is a `ContentDoc`
- THEN the implementation SHALL create a `Unit(type=POST)` and a `Post` row with `kindKey = "chapter"`, `targetUnitId`, `authorUserId = userId`, and `Post.content` set to the provided `ContentDoc`
- AND SHALL create a `UnitTranslation` row for the chapter's title (under the unit's default language) without storing content inside `description`

### Requirement: Post carries denormalized root target identifiers

The `Post` model SHALL carry two nullable denormalized fields:

- `rootTargetUnitId` (uuid, nullable, FK to `Unit.id`) — the `targetUnitId` of this post's root post.
- `rootTargetUnitType` (varchar(32), nullable) — the `Unit.type` of the unit referenced by `rootTargetUnitId`.

For a top-level post (where `rootPostUnitId` equals the post's own `unitId`), `rootTargetUnitId` SHALL equal that post's own `targetUnitId`. For a reply, `rootTargetUnitId` SHALL equal the root post's `targetUnitId`. When the root post has no target, both fields SHALL be null.

These fields SHALL be a denormalized projection of canonical relationships, not an independent source of truth. They SHALL exist to enable single-equality filtering in the Meilisearch `posts` index for Book/Game/Media-scoped post search across full reply trees.

The Postgres `Post` table SHALL include an index on `(rootTargetUnitId, createdAt)` to support direct database queries scoped by root target.

#### Scenario: Top-level review carries its own target as rootTargetUnitId

- **GIVEN** a top-level REVIEW post `R` is created with `targetUnitId = "book-B"` and no `parentPostUnitId`
- **WHEN** the post is persisted
- **THEN** `R.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `R.rootTargetUnitType` SHALL equal `"BOOK"`
- **AND** `R.rootPostUnitId` SHALL equal `R.unitId`

#### Scenario: Top-level remark carries its own target as rootTargetUnitId

- **GIVEN** a top-level REMARK post `M` is created with `targetUnitId = "game-G"` and no `parentPostUnitId`
- **WHEN** the post is persisted
- **THEN** `M.rootTargetUnitId` SHALL equal `"game-G"`
- **AND** `M.rootTargetUnitType` SHALL equal `"GAME"`

#### Scenario: Top-level post without a target leaves both fields null

- **GIVEN** a top-level POST is created with `targetUnitId = null`
- **WHEN** the post is persisted
- **THEN** `rootTargetUnitId` SHALL be null
- **AND** `rootTargetUnitType` SHALL be null

### Requirement: Replies inherit root target identifiers from their parent

When a reply post is created with a non-null `parentPostUnitId`, the post creation flow SHALL inherit `rootTargetUnitId` and `rootTargetUnitType` from the parent post. The inheritance SHALL be performed as part of the same database read that already fetches the parent for `rootPostUnitId`, `depth`, and `sortPath` derivation, with no additional database roundtrip introduced.

The derivation SHALL NOT branch on `PostKind`. Replies of any `PostKind` (including `REVIEW`, `EXCERPT`, `REMARK`, `POST`, `CHAPTER`) SHALL inherit from their parent identically.

#### Scenario: Direct reply inherits rootTargetUnitId from parent review

- **GIVEN** a REVIEW post `R` with `rootTargetUnitId = "book-B"` and `rootTargetUnitType = "BOOK"`
- **WHEN** a comment `C1` is created with `parentPostUnitId = R.unitId`
- **THEN** `C1.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C1.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Nested reply inherits rootTargetUnitId from its parent reply

- **GIVEN** a comment `C1` with `rootTargetUnitId = "book-B"`
- **WHEN** a reply `C2` is created with `parentPostUnitId = C1.unitId`
- **THEN** `C2.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C2.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Reply derivation does not add a database roundtrip

- **WHEN** a reply is created via `PostService.create` with a non-null `parentPostUnitId`
- **THEN** the parent fetch SHALL include `rootTargetUnitId` and `rootTargetUnitType` in its select set
- **AND** no separate query SHALL be issued to read the root post or the target unit

### Requirement: Root target identifiers are immutable through Post.update

The `Post.update` API SHALL NOT accept changes to `rootTargetUnitId` or `rootTargetUnitType`. Editing post `content`, `isLocked`, or `extra` SHALL leave both fields unchanged.

The `Post.update` API SHALL NOT accept changes to `targetUnitId`. As a consequence, no human-triggerable code path in the current product can produce write amplification across descendants of a root post.

#### Scenario: Editing post content leaves rootTargetUnitId unchanged

- **GIVEN** a post `P` with `rootTargetUnitId = "book-B"`
- **WHEN** `Post.update(P.unitId, { content: <new ContentDoc> })` is called
- **THEN** `P.rootTargetUnitId` SHALL still equal `"book-B"`
- **AND** `P.rootTargetUnitType` SHALL still equal `"BOOK"`

#### Scenario: Update API rejects rootTargetUnitId in input

- **WHEN** an `UpdatePostInput` payload includes `rootTargetUnitId` or `rootTargetUnitType`
- **THEN** the field SHALL be ignored or rejected by the input contract
- **AND** the persisted post values SHALL remain unchanged

### Requirement: Root target denormalization is eventually consistent on target deletion

When the `Unit` referenced by a root post's `targetUnitId` is deleted (triggering `onDelete: SetNull` on `Post.targetUnitId`), descendant posts' denormalized `rootTargetUnitId` and `rootTargetUnitType` MAY become stale until the next manual resync. The system SHALL document this as a known eventual-consistency window. Automatic cascade is out of scope; rerunning the backfill repairs descendants.

#### Scenario: Target unit deletion leaves descendants temporarily stale

- **GIVEN** Book `B` with REVIEW `R` (`targetUnitId = B`) and reply `C1` (`rootTargetUnitId = B`)
- **WHEN** Unit `B` is deleted, causing `R.targetUnitId` to become null via `onDelete: SetNull`
- **THEN** `R.rootTargetUnitId` MAY remain `B` until repair
- **AND** `C1.rootTargetUnitId` MAY remain `B` until repair
- **AND** rerunning the backfill SHALL set both to null

### Requirement: kindKey classifies post purpose

Every Post SHALL have a `kindKey` field that classifies its purpose. Valid values are `discussion`, `review`, `remark`, `excerpt`, and `post`. The `kindKey` determines the content form of the post. A Post with `kindKey = "review"` is a Review. A Post with `kindKey = "remark"` is a short-form Remark. A Post with `kindKey = "excerpt"` is an Excerpt — a user-highlighted passage from the work named by `targetUnitId`. Structural role (top-level vs reply) is determined by threading fields (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`), not by `kindKey`. A reply is any Post with `parentPostUnitId` set, regardless of its `kindKey` value.

The value `comment` SHALL NOT be used for new posts. The value `quote` SHALL NOT be used for new posts — it is renamed to `excerpt`. The `comment` and `quote` kinds are removed from the PostKind enum.

#### Scenario: Create a review post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "review"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a review of "book-1"

#### Scenario: Create a discussion post

- WHEN a user creates a Post with `kindKey = "discussion"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a discussion about "book-1"

#### Scenario: Create an excerpt post

- WHEN a user creates a Post with `kindKey = "excerpt"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as an Excerpt of "book-1"

#### Scenario: Create a reply to an existing post

- GIVEN an existing Post "post-1"
- WHEN a user creates a Post with `kindKey = "post"` and `parentPostUnitId = "post-1"`
- THEN the Post SHALL be treated as a reply to "post-1"
- AND the reply's structural role SHALL be determined by `parentPostUnitId`, not by `kindKey`

#### Scenario: Reject post creation with kindKey "comment"

- WHEN a client attempts to create a Post with `kindKey = "comment"`
- THEN the system SHALL reject the request with a validation error
- AND no Post record SHALL be created

#### Scenario: Reject post creation with kindKey "quote"

- WHEN a client attempts to create a Post with `kindKey = "quote"`
- THEN the system SHALL reject the request with a validation error
- AND no Post record SHALL be created

#### Scenario: Valid kindKey values

- WHEN the system validates a Post's `kindKey` field
- THEN the only accepted values SHALL be `discussion`, `review`, `remark`, `excerpt`, and `post`
- AND the values `comment` and `quote` SHALL NOT be accepted

### Requirement: Excerpt source on `extra.source`

The shared `postExtraSchema` SHALL grow an optional `source` field whose value is a discriminated union over a `mode` field with two cases:

```ts
{ mode: 'unit'; unitId: string; title: string }   // 1 ≤ title.length ≤ 200
{ mode: 'url';  url:    string; title: string }   // url.length ≤ 2048
```

The field SHALL be optional on every PostKind. By convention only Excerpt posts use it; other kinds SHALL ignore it on render. The contract SHALL NOT enforce a domain restriction on `url` — any well-formed URL string SHALL pass validation. Render-time classification (rezics vs external) is a frontend concern handled by the `<Link>` primitive (see `outbound-link-protection`).

`source.unitId` (when used) MAY point at any unit. The backend SHALL NOT enforce that it descends from the post's `targetUnitId`.

`source.title` is a snapshot — what the author wrote at post time. The contract SHALL NOT auto-update or validate the title against the linked unit's display name.

#### Scenario: Excerpt with unit-mode source

- WHEN a user creates an Excerpt with `extra.source = { mode: 'unit', unitId: 'chapter-1', title: '《指環王》第三章，第一節' }`
- THEN the source SHALL pass validation and persist as-is

#### Scenario: Excerpt with url-mode rezics source

- WHEN a user creates an Excerpt with `extra.source = { mode: 'url', url: 'https://book.rezics.com/shelf/abc', title: 'My Reading List' }`
- THEN the source SHALL pass validation

#### Scenario: Excerpt with url-mode external source

- WHEN a user creates an Excerpt with `extra.source = { mode: 'url', url: 'https://example.com/article', title: 'External essay' }`
- THEN the source SHALL pass validation (no rezics-domain restriction)

#### Scenario: Excerpt without source

- WHEN a user creates an Excerpt without an `extra.source` field
- THEN the Post SHALL persist normally and SHALL render without a source link

#### Scenario: Source title length validation

- WHEN a client submits a source with `title` longer than 200 characters
- THEN the request SHALL fail schema validation

#### Scenario: Source url length validation

- WHEN a client submits a source with `url` longer than 2048 characters
- THEN the request SHALL fail schema validation

#### Scenario: Cross-work citation accepted

- GIVEN an Excerpt with `targetUnitId = 'book-A'`
- WHEN the source is `{ mode: 'unit', unitId: 'chapter-of-book-B', title: '...' }`
- THEN the source SHALL pass validation (no ancestry check)

#### Scenario: Source title is a snapshot

- GIVEN an Excerpt with `extra.source = { mode: 'unit', unitId: 'chapter-1', title: 'Original Title' }`
- WHEN the linked unit's display name is later changed
- THEN the Post's `extra.source.title` SHALL remain `'Original Title'` — the contract SHALL NOT update it

### Requirement: Source rendering routes through the Link primitive

Frontend renderers that display `extra.source` SHALL emit `<Link>` (from `@rezics/ui`, defined by the `outbound-link-protection` capability) for both modes:
- `mode: 'unit'` → `<Link href={'/unit/' + source.unitId}>{source.title}</Link>` (the unit resolver picks the typed destination at click time).
- `mode: 'url'` → `<Link href={source.url}>{source.title}</Link>` (classification + external-link modal handled by the primitive).

Renderers SHALL NOT emit raw `<a>` tags for source rendering. The R5 convention rule enforces this at the repo level.

#### Scenario: Unit-mode source renders via resolver

- GIVEN an Excerpt with `extra.source = { mode: 'unit', unitId: 'u-1', title: 'Chapter 3' }`
- WHEN the post body is rendered
- THEN the source link is `<Link href="/unit/u-1">Chapter 3</Link>` and clicking it goes through the unit resolver

#### Scenario: External url-mode source triggers modal

- GIVEN an Excerpt with `extra.source = { mode: 'url', url: 'https://example.com/article', title: 'External essay' }`
- WHEN the rendered source link is left-clicked
- THEN the global external-link modal opens (per the `outbound-link-protection` spec)

### Requirement: Comment server domain

The system SHALL NOT expose or maintain a separate Comment server domain.

**Reason**: The Comment domain (`comment.api.ts`, `comment.service.ts`, `comment.mapper.ts`, `comment.types.ts`) references the `CommentIndex` table which never existed in the database. All code in `package/server/src/comment/` is dead code. Comment/reply functionality is fully handled by the Post model's threading fields (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`).

**Migration**: All comment creation, listing, and thread retrieval operations are replaced by Post API endpoints. A reply is created as a Post with `parentPostUnitId` set. Thread queries use `rootPostUnitId` with `sortPath` ordering. No data migration is needed as the `CommentIndex` table never existed. Clients MUST switch to Post API contracts for all comment/reply functionality.

#### Scenario: Comment domain files deleted

- WHEN the system is deployed after this change
- THEN no server routes SHALL exist under the `comment/` domain
- AND no code SHALL reference `CommentIndex` as a database model

### Requirement: PostKind.COMMENT enum value

The system SHALL NOT accept `COMMENT` as a PostKind enum value for new posts.

**Reason**: The `COMMENT` value in the PostKind enum conflates structural role (reply) with content form (kind). Threading semantics are fully expressed by `parentPostUnitId`, `rootPostUnitId`, `depth`, and `sortPath`. Keeping `COMMENT` as a kind value adds no information and encourages incorrect usage patterns where `kind` is used to determine reply status instead of checking `parentPostUnitId`.

**Migration**: Remove `COMMENT` from the Prisma `PostKind` enum and the contract type definition. Existing database rows with `kind = 'COMMENT'` remain as-is; no data migration is required for this change. The application stops creating new posts with this value. Frontend code that previously created posts with `kind: 'comment'` SHALL use `kind: 'post'` with `parentPostUnitId` set. A follow-up migration MAY batch-update historical `COMMENT` rows to `POST`.

#### Scenario: COMMENT removed from PostKind enum

- WHEN inspecting the PostKind enum definition in Prisma schema and contract types
- THEN the value `COMMENT` SHALL NOT be present
- AND the valid enum values SHALL be `REVIEW`, `REMARK`, `EXCERPT`, `POST`

### Requirement: PostKind.QUOTE enum value

The system SHALL NOT accept `QUOTE` as a PostKind enum value for new posts.

**Reason**: The `QUOTE` value foregrounds attribution to a speaker, but the library uses this kind for users highlighting memorable passages from books and game dialogue. The work and its author are already linked via `targetUnitId`; the post is about the fragment itself. "Excerpt" is the intent-correct name.

**Migration**: The Prisma `PostKind` enum value `QUOTE` is renamed to `EXCERPT`. A one-shot data migration `UPDATE Post SET kind = 'EXCERPT' WHERE kind = 'QUOTE'` updates existing rows. The contract type union, `buildUrl` cases, route tree (`/quote/...` → `/excerpt/...`), app directory (`package/app/src/quote/` → `package/app/src/excerpt/`), components (`QuoteCard` → `ExcerptCard`, etc.), hybrid `QuoteExcerpt*` names (collapse to `Excerpt*`), i18n keys (`quote.*` → `excerpt.*`), Meili index filter literals, and seed/mock data all migrate in the same change. There is no `/quote/...` → `/excerpt/...` redirect alias — the rename is a clean break.

#### Scenario: QUOTE removed from PostKind enum

- WHEN inspecting the PostKind enum definition in Prisma schema and contract types
- THEN the value `QUOTE` SHALL NOT be present
- AND the valid enum values SHALL be `REVIEW`, `REMARK`, `EXCERPT`, `POST`

#### Scenario: No QUOTE rows after migration

- WHEN querying the Post table after the migration runs
- THEN no row SHALL have `kind = 'QUOTE'`
- AND every row that previously had `kind = 'QUOTE'` SHALL now have `kind = 'EXCERPT'`

#### Scenario: No `/quote/...` routes after rename

- WHEN inspecting the router source
- THEN no route paths SHALL begin with `/quote/`
- AND any prior `/quote/$unitId` route SHALL exist at `/excerpt/$unitId`

#### Scenario: No hybrid Quote* names remain

- WHEN scanning the frontend source
- THEN no exported component, hook, or directory name SHALL contain `Quote` (the prior `QuoteExcerpt*` and `Quote*` names are renamed to `Excerpt*`)

### Requirement: Posts use UnitStatus.DELETED for user deletion
The system SHALL soft-delete user-deleted posts by marking the backing Unit as `DELETED` and removing body content.

#### Scenario: User deletes a post
- **WHEN** an authorized user deletes a post
- **THEN** the server SHALL set the backing Unit status to `DELETED`
- **AND** the server SHALL remove the post body from normal reads

### Requirement: Deleted posts are excluded from ordinary reads
The system SHALL exclude deleted posts from ordinary public post lists and direct public detail reads.

#### Scenario: Deleted post is listed by target
- **WHEN** a public caller lists posts for a target Unit
- **THEN** posts whose backing Unit is `DELETED` SHALL NOT appear

#### Scenario: Deleted post is opened directly
- **WHEN** a public caller requests a deleted post by Unit ID through the ordinary detail endpoint
- **THEN** the endpoint SHALL return a not-found or gone response instead of a normal post DTO

### Requirement: Tree and reference paths may return tombstones
The system SHALL allow post tree and reference paths to return tombstone DTOs for deleted posts when the tombstone is needed to preserve structure.

#### Scenario: Deleted parent has visible replies
- **WHEN** a post tree contains a deleted parent with visible child replies
- **THEN** the tree response MAY include a tombstone for the deleted parent
- **AND** the tombstone SHALL omit body content

### Requirement: Generic posts do not expose visibility controls
The system SHALL NOT expose user-selectable Unit visibility controls for `kind=POST`.

#### Scenario: Composer creates generic post
- **WHEN** a user creates a generic `kind=POST`
- **THEN** the composer and API SHALL NOT require or expose a visibility picker for that post kind

### Requirement: Post visibility support is tree-wide when present
If non-generic post kinds support Unit visibility, the system SHALL apply visibility at the root/thread level and prevent mixed-visibility trees.

#### Scenario: Reply is created under a visible root
- **WHEN** a reply is created under a root post with Unit visibility metadata
- **THEN** the reply SHALL inherit the root visibility
- **AND** the reply SHALL NOT become more public or more private than the root through ordinary user input
