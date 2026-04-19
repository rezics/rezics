## ADDED Requirements

### Requirement: CHAPTER is a valid Post kindKey

The `Post.kindKey` field SHALL accept `"chapter"` as a valid value alongside the existing `discussion`, `review`, `remark`, `quote` / `excerpt`, and `post` values. A Post with `kindKey = "chapter"` represents a chapter of a book. Its `targetUnitId` SHALL reference the parent book unit (a Unit of type `BOOK`). Its `body` SHALL hold the chapter content as a string (markdown by default). Its `authorUserId` SHALL be the chapter author.

A chapter Post SHALL use the same threading fields as any other Post (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`) to accommodate replies, annotations, and discussion threads attached to the chapter.

#### Scenario: Create a chapter post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "chapter"`, `targetUnitId = "book-1"`, `authorUserId = "user-1"`, and `body = "Chapter One..."`
- THEN the Post SHALL be persisted as a chapter of "book-1"
- AND the underlying Unit SHALL have `type = POST`

#### Scenario: Reject chapter post with non-BOOK targetUnitId

- GIVEN a Unit "u-2" of type `POST`
- WHEN a caller attempts to create a Post with `kindKey = "chapter"` and `targetUnitId = "u-2"`
- THEN the system SHALL reject the creation with a validation error
- AND no Post record SHALL be created

#### Scenario: Chapter post body retrieved from Post.body

- GIVEN a chapter Post with `body = "Once upon a time..."`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO's `content` (or equivalent body field) SHALL return `"Once upon a time..."`
- AND the body SHALL NOT be read from `UnitTranslation.description`

#### Scenario: Chapter cover URL sourced from UnitTranslation.extra

- GIVEN a chapter Post with a `UnitTranslation` row whose `extra = { coverUrl: "https://example.com/ch-cover.jpg" }`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `coverUrl = "https://example.com/ch-cover.jpg"` via the `unitTranslationExtraSchema` accessor
- AND no chapter-specific cover column SHALL exist on `Post`

### Requirement: Chapter ordering and grouping live in BookIndex, not Post

A chapter Post SHALL NOT carry ordering, numbering, or parent-chapter fields on the `Post` model. Chapter order and nesting within a book SHALL remain the responsibility of the `BookIndex` JSON index keyed by `bookUnitId`, which references chapters by their `unitId`. The Post model SHALL remain agnostic of chapter-specific position metadata.

#### Scenario: Post model has no chapter-specific ordering fields

- GIVEN the Post model in the Prisma schema
- WHEN inspecting its fields
- THEN Post SHALL NOT contain `chapterNumber`, `sortOrder`, or `parentChapterUnitId` fields
- AND chapter position SHALL be derivable only by reading the `BookIndex` JSON index for the target book

#### Scenario: Listing chapters of a book

- GIVEN a book `"book-1"` with three chapter Posts whose `targetUnitId = "book-1"` and `kindKey = "chapter"`
- WHEN a client requests the chapter list for `"book-1"`
- THEN the system SHALL return the three chapter Posts
- AND the order SHALL be determined by the `BookIndex` JSON index, not by any field on Post

### Requirement: chapter/ server domain is a thin wrapper over post service

The `package/server/src/chapter/` domain SHALL remain as an API surface for chapter-centric operations but SHALL delegate persistence and retrieval to the post service, filtering on `kindKey = "chapter"` and `targetUnitId = <book>`. The domain SHALL NOT read or write `Unit(type=CHAPTER)` (which no longer exists) or `UnitTranslation.description` as a chapter body source.

#### Scenario: Chapter list API returns chapter Posts

- WHEN a client calls the chapter list endpoint for a given book
- THEN the implementation SHALL query posts filtered by `kindKey = "chapter"` and `targetUnitId = <book>`
- AND SHALL NOT query by `Unit.type = "CHAPTER"`

#### Scenario: Chapter create API produces a chapter Post

- WHEN a client calls the chapter create endpoint with `{ targetUnitId, title, content, userId }`
- THEN the implementation SHALL create a `Unit(type=POST)` and a `Post` row with `kindKey = "chapter"`, `targetUnitId`, `authorUserId = userId`, and `body = content`
- AND SHALL create a `UnitTranslation` row for the chapter's title (under the unit's default language) without storing `content` in `description`

## MODIFIED Requirements

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
- AND the valid enum values SHALL be `REVIEW`, `REMARK`, `EXCERPT`, `POST`

### Requirement: PostKind.QUOTE enum value

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
