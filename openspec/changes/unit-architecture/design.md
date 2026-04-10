## Context

REZICS currently uses a polymorphic `Unit` table (with `UnitType` enum: BOOK, COMMENT, NOTE, REMARK, REVIEW, DOMAIN, TAG, QUOTE, READLIST, IMAGE, VIDEO, CHAPTER) as the foundation for all content. Type-specific data lives in 1:1 extension tables (`Book`, `Tag`, `ReadList`, `CommentIndex`). The `Book` model carries both language-dependent fields (`title`, `description`, `language`) and language-neutral facts (`isbn`, `textLength`) in the same table. Author/press/producer attribution is tied directly to the `User` model via M2M relations. Tags are stored both as `String[]` on Book and as a M2M relation via `Tag` units. Comments use `CommentIndex` for tree structure (adjacency list with depth).

The system needs to expand beyond books to games, anime/media, and community-driven content while supporting multiple languages and community-scoped organization. The current model cannot support this without accumulating structural contradictions.

### Current Schema (key models)

- **Unit**: `id, userId, type(enum), status, title, content, metadata(Json), nsfw, targetUnitId, publishedAt`
- **Book** (1:1 Unit): `unitId, title, author(User[]), press(User[]), producer(User[]), textLength, tags(String[]), anchorId, language, description, coverUrl, isbn, isLicensed, extra`
- **User**: `unitId, slug, type(USER|AUTHOR|PRESS|PRODUCER), name, avatar, bio, ...`
- **Tag** (1:1 Unit): `unitId, name, i18n(Json), type`
- **CommentIndex** (1:1 Unit): `unitId, rootUnitId, parentCommentId, depth`
- **ReadList** (1:1 Unit): `unitId, order(String[]), book(Book[]), review(Unit[])`
- **SeriesBook**: `seriesId, bookId, sortOrder, volumeLabel`

## Goals / Non-Goals

**Goals:**
- Establish `Unit` as the sole identity anchor with no type-specific text on extension tables
- Formalize work/release relationships (replacing `Book.anchorId`)
- Support multi-language content via `UnitTranslation` and `UnitSupportLanguage`
- Unify comments, reviews, and discussions into a single `Post` model
- Replace ReadList + Series with universal `Shelf`
- Introduce `Realm` for community organization with Reddit-style governance
- Implement scored flat tags with realm-scoped curation (realm-as-namespace)
- Decouple attribution from platform User accounts

**Non-Goals:**
- Full-text search redesign (Meilisearch sync adapts to new schema but architecture stays)
- Auth service changes (separate DB, unaffected)
- Real-time/WebSocket features
- UI/UX design for realm or shelf interfaces
- Notification system design
- Content moderation workflows beyond realm governance basics
- Person/Organization as Units (kept as standalone entities for now; promotable later)

## Decisions

### D1: Unit as Sole Identity Anchor — No Text on Unit

**Decision**: Remove `Unit.title` and `Unit.content`. All displayable text lives in `UnitTranslation` or on the type extension (e.g., `Post.body`).

**Rationale**: The current model has `Unit.title`, `Book.title`, and potentially `UnitTranslation.title` — three places for the same data. Eliminating text from Unit and extension tables (except fast-path fields like `Post.body`) creates exactly one authoritative source per language.

**Alternative considered**: Keep `Unit.title` as a denormalized default-language cache. Rejected because it reintroduces the dual-source problem and complicates writes.

### D2: No UnitRole Enum

**Decision**: The `UnitRole` enum (`work`, `release`, `content`, `interaction`, `taxonomy`, `asset`) from the original proposal is not implemented.

**Rationale**: Role is derivable:
- `workUnitId = null` + type supports work/release → standalone or work (check if any unit references it)
- `workUnitId != null` → release
- `type = TAG` → taxonomy
- `type = POST` → content/interaction
- `type = IMAGE` → asset

A `role` column would create a type×role matrix where most cells are invalid, with enforcement falling entirely on the service layer. Removing it eliminates a dimension of complexity with no loss of expressiveness.

### D3: UnitType as Prisma Enum

**Decision**: `UnitType` remains a Prisma enum, not a `String` + registry table.

**Rationale**: Each new type requires a Prisma model (extension table), service code, API endpoints, contract types, and frontend components. A row in a registry table alone doesn't make a new type functional. The enum provides compile-time exhaustive matching across the entire TypeScript stack — critical in a contract-first monorepo where types flow from `@rezics/contract` to every consumer.

**Updated enum**:
```
BOOK | GAME | MEDIA | POST | TAG | REALM | SHELF | CHAPTER | IMAGE | VIDEO | QUOTE
```

Removed: `COMMENT` (→ POST), `NOTE` (→ POST), `REMARK` (→ POST), `REVIEW` (→ POST), `DOMAIN` (→ REALM), `READLIST` (→ SHELF).

### D4: sourceReleaseUnitId on UnitTranslation — No WorkDisplayRelease Table

**Decision**: The `WorkDisplayRelease` strategy table from the original proposal is not implemented. Instead, `UnitTranslation` carries an optional `sourceReleaseUnitId` field.

**Rationale**: Language queries for a work resolve directly via `UnitTranslation(workId, language)` — one lookup, one truth. No cascade, no fallback chain. The `sourceReleaseUnitId` field serves a different purpose: when viewing a work in Chinese and clicking "read", the system knows which release has the Chinese content (chapters, etc.).

**Resolution logic** (single step):
```
UnitTranslation(unitId=workId, language=requestedLang)
  → title, description for display
  → sourceReleaseUnitId for content navigation
```

If no translation exists for the requested language, fall back to `unit.defaultLanguage`. If that doesn't exist, fall back to platform default. This is a simple 1-2 query resolution, not a 4-step cascade.

**Consistency model**: When a release is updated, the work's translation does NOT need updating. They are independent. Strong consistency between work and release translations is explicitly not required — the `sourceReleaseUnitId` pointer is the only link.

### D5: Post.body as Fast Path

**Decision**: `Post` has a `body` field directly on the extension table. Post content does not go through `UnitTranslation`.

**Rationale**: Every post (comment, review, discussion reply) would otherwise require a `Unit` row + `Post` row + `UnitTranslation` row — 3 inserts per comment. Posts are the most write-heavy entity. Multi-language comments are not a realistic use case for REZICS. Storing body on `Post` keeps it at 2 inserts (Unit + Post) while maintaining architectural consistency where it matters (books, games, media all use UnitTranslation for their multi-language metadata).

### D6: Materialized Path for Post Threading

**Decision**: Use a `sortPath` column on `Post` (materialized path format: `"0001.0003.0001"`) for Reddit-style threaded discussions. No separate `PostTreeIndex` closure table.

**Rationale**:

| Criterion         | Adjacency only | Materialized path      | Closure table    |
| ----------------- | -------------- | ---------------------- | ---------------- |
| Write cost        | O(1)           | O(1)                   | O(depth)         |
| Full subtree      | recursive CTE  | prefix scan            | join             |
| Thread ordering   | complex        | natural (sort by path) | needs extra sort |
| Pagination        | hard           | trivial (range query)  | moderate         |
| Schema complexity | low            | low                    | high (N^2 rows)  |

The materialized path gives thread-ordered pagination (`ORDER BY sortPath`) in a single index scan — the most common read pattern for threaded discussions. Combined with adjacency fields (`parentPostUnitId`, `rootPostUnitId`) for direct parent lookups, this covers both flat and threaded modes without a separate index table.

**Two modes supported**:
- **Flat mode (X-style)**: `sortPath` is null. Query: `WHERE targetUnitId = :id ORDER BY createdAt DESC`
- **Threaded mode (Reddit-style)**: `sortPath` populated. Query: `WHERE rootPostUnitId = :id ORDER BY sortPath`

**sortPath format**: Zero-padded 4-digit segments separated by dots. Max depth ~128 levels (512 chars / 5 chars per segment). Segment number is the sibling index under the parent.

### D7: Shelf Replacing ReadList and Series

**Decision**: `ReadList` and `SeriesBook` are replaced by a unified `Shelf` model with `ShelfItem` junction. "Shelf" is the official REZICS product term.

**Rationale**: Shelves are universal — books, games, anime, mixed media. Three modes, one schema:
- **Pure shelf**: ShelfItem with sortOrder only
- **Review-driven shelf**: ShelfItem with reviewPostUnitId (auto-created when adding a review)
- **Series**: ShelfItem with label ("Vol. 1") and sortOrder

**Review-driven flow**: When a user adds a review Post (targeting WorkX) to a shelf, the system auto-creates `ShelfItem(shelf, WorkX, reviewPostUnitId=review)`. The shelf always contains works, not reviews. The review is attached context. The frontend aggregates shelf items with their reviews.

### D8: Flat Tags, Realms as Namespaces

**Decision**: No tag categories, no tag namespaces, no tag hierarchy. Tags are flat Units with multilingual labels via `UnitTranslation`. Realms serve as the namespace mechanism.

**Rationale**: E-hentai uses namespaces (`female:big_breasts`, `male:sole_male`). REZICS achieves the same by creating realms: "female traits" realm + "big breasts" tag, "male traits" realm + "sole male" tag. The realm IS the namespace. This eliminates an entire layer of infrastructure (namespace management, category assignment) and replaces it with something the system already has: realms with community governance.

**Tags are language-neutral**: A tag Unit has `isLanguageNeutral = true`, meaning it matches all language filters. Its display label varies by language (via `UnitTranslation`), but the tag entity itself is universal.

### D9: RealmUnit and RealmTagUnit as Separate Tables

**Decision**: Two distinct junction tables for realm organization:
- `RealmUnit(realmUnitId, unitId)` — content feed ("this unit is IN this realm")
- `RealmTagUnit(realmUnitId, tagUnitId, unitId)` — scoped classification ("this realm CLASSIFIES this unit with this tag")

**Rationale**: They serve different query patterns. RealmUnit is the lightweight content feed (Reddit-style "what's in this subreddit"). RealmTagUnit is for fine-grained filtering ("in this realm, show me things tagged X"). Separating them avoids scale/hotspot issues — the browse query (`RealmUnit`) doesn't touch the heavier three-way junction.

A unit enters a realm via RealmUnit (like submitting to a subreddit). Realm moderators then classify it with tags via RealmTagUnit. These are independent operations.

### D10: Scored UnitTag with Add-Cascade, No-Remove-Cascade

**Decision**: `UnitTag` is a scored junction: `(unitId, tagUnitId, score, voteCount)`. Tag scores determine prominence. Individual users vote via `TagVote(userId, unitId, tagUnitId, value)`.

**Cascade semantics**:
- **Adding** a `RealmTagUnit` row automatically cascades: `UPSERT UnitTag(unitId, tagUnitId)` with score increment
- **Removing** a `RealmTagUnit` row does NOT cascade to UnitTag

**Rationale**: UnitTag is accumulative. Once any realm identifies that a unit has a certain quality, that signal persists globally even if one realm later removes it. Global tags represent aggregate community knowledge.

**Scoring model**: More aggressive than Steam, closer to e-hentai. Users vote +1/-1 on tag relevance. `UnitTag.score` is the aggregate. Tags with highest scores appear first. Tags below a threshold can be hidden. Official/Rezics-curated tags get manually higher scores — no special schema field, just a higher score value. The score IS the authority signal.

### D11: Person and Organization Decoupled from User

**Decision**: `Person` and `Organization` are standalone entities (not Units), independent of platform `User` accounts. Attribution uses flexible `roleKey` strings on credit junction tables.

**Rationale**: The current model conflates platform identity with attribution: `UserType = AUTHOR | PRESS | PRODUCER`. An author doesn't need a REZICS account to be credited. A publisher credited on a book is not a platform user. Decoupling allows attribution to be managed independently of account management.

`Person` and `Organization` have a `name` field directly (not UnitTranslation) — their multilingual name support can be added via `extra` JSON if needed or promoted to a dedicated translation table later. This keeps the initial implementation simple.

**roleKey examples**: `author`, `translator`, `illustrator`, `editor`, `director`, `designer`, `writer`, `cast`, `voice_actor`, `composer`, `publisher`, `developer`, `distributor`.

## Complete Prisma Schema

This is the authoritative schema for the new architecture. All models, fields, relations, and indexes are included.

```prisma
// ============================================================
// ENUMS
// ============================================================

enum UnitType {
  BOOK
  GAME
  MEDIA
  POST
  TAG
  REALM
  SHELF
  CHAPTER
  IMAGE
  VIDEO
  QUOTE
}

enum UnitStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  DELETED
}

enum UnitVisibility {
  PUBLIC
  UNLISTED
  PRIVATE
}

// ============================================================
// CORE: UNIT IDENTITY
// ============================================================

model Unit {
  id                String         @id @default(dbgenerated("uuidv7()")) @db.Uuid
  type              UnitType
  workUnitId        String?        @db.Uuid
  userId            String?        @db.Uuid

  defaultLanguage   String?        @db.VarChar(16)
  isLanguageNeutral Boolean        @default(false)

  status            UnitStatus     @default(DRAFT)
  visibility        UnitVisibility @default(PUBLIC)
  nsfw              Boolean        @default(false)

  extra             Json?

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  publishedAt       DateTime?

  // Self-relation: work/release
  work              Unit?          @relation("WorkRelease", fields: [workUnitId], references: [id], onDelete: SetNull)
  releases          Unit[]         @relation("WorkRelease")

  // Owner/creator
  user              User?          @relation("UnitForUser", fields: [userId], references: [unitId])

  // Translation layer
  translations      UnitTranslation[]
  supportLanguages  UnitSupportLanguage[]

  // Type extensions (1:1, optional)
  book              Book?
  game              Game?
  media             Media?
  post              Post?
  shelf             Shelf?
  realm             Realm?

  // Tag system
  unitTags          UnitTag[]      @relation("TaggedUnit")
  tagUsages         UnitTag[]      @relation("TagUnit")
  tagVotesOnUnit    TagVote[]      @relation("TagVoteUnit")
  tagVotesAsTag     TagVote[]      @relation("TagVoteTag")

  // Realm organization
  realmContent      RealmUnit[]    @relation("RealmContent")
  inRealms          RealmUnit[]    @relation("UnitInRealm")
  realmTagAsRealm   RealmTagUnit[] @relation("RealmTagRealm")
  realmTagAsTag     RealmTagUnit[] @relation("RealmTagTag")
  realmTagAsUnit    RealmTagUnit[] @relation("RealmTagUnit")

  // Attribution
  personCredits       PersonCredit[]
  organizationCredits OrgCredit[]

  // Engagement
  reactions           Reaction[]        @relation("UnitReactions")
  reactionSummaries   ReactionSummary[] @relation("UnitReactionSummaries")
  bookmarks           Bookmark[]

  // Post relations (other posts referencing this unit)
  targetedByPosts   Post[]         @relation("PostTarget")
  realmPosts        Post[]         @relation("PostRealm")
  rootPosts         Post[]         @relation("PostRoot")
  parentPosts       Post[]         @relation("PostParent")

  // Shelf item relations
  shelfItemsContaining ShelfItem[] @relation("ShelfItemUnit")
  shelfItemReviews     ShelfItem[] @relation("ShelfItemReview")

  @@index([type, status, createdAt])
  @@index([workUnitId])
  @@index([userId, createdAt])
  @@index([status, visibility])
  @@index([defaultLanguage])
}

// ============================================================
// TRANSLATION LAYER
// ============================================================

model UnitTranslation {
  unitId              String   @db.Uuid
  language            String   @db.VarChar(16)

  title               String?
  subtitle            String?
  summary             String?
  description         String?
  extra               Json?

  // For works: which release provides content in this language
  sourceReleaseUnitId String?  @db.Uuid

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  unit                Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@id([unitId, language])
  @@index([language, title])
}

model UnitSupportLanguage {
  unitId    String   @db.Uuid
  language  String   @db.VarChar(16)
  isPrimary Boolean  @default(false)
  sortOrder Int      @default(0)

  unit      Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@id([unitId, language])
  @@index([language, unitId])
}

// ============================================================
// BOOK EXTENSION
// ============================================================

model Book {
  unitId            String    @id @db.Uuid
  unit              Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  isbn13            String?   @db.VarChar(32)
  publicationDate   DateTime?
  pageCount         Int?
  textLength        Int       @default(0)
  formatKey         String?   @db.VarChar(32)
  isLicensed        Boolean   @default(false)
  coverAssetUnitId  String?   @db.Uuid

  extra             Json?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  chapterIndex      BookIndex?

  @@index([isbn13])
  @@index([publicationDate])
}

model BookIndex {
  bookUnitId String   @id @db.Uuid
  index      Json
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  book       Book     @relation(fields: [bookUnitId], references: [unitId], onDelete: Cascade)
}

// ============================================================
// GAME EXTENSION
// ============================================================

model Game {
  unitId            String    @id @db.Uuid
  unit              Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  releaseDate       DateTime?
  versionLabel      String?
  ageRatingKey      String?   @db.VarChar(32)
  isLicensed        Boolean   @default(false)
  coverAssetUnitId  String?   @db.Uuid

  extra             Json?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  platforms         GamePlatform[]
}

model GamePlatform {
  gameUnitId  String @db.Uuid
  platformKey String @db.VarChar(64)
  sortOrder   Int    @default(0)

  game        Game   @relation(fields: [gameUnitId], references: [unitId], onDelete: Cascade)

  @@id([gameUnitId, platformKey])
  @@index([platformKey, gameUnitId])
}

// ============================================================
// MEDIA EXTENSION
// ============================================================

model Media {
  unitId            String    @id @db.Uuid
  unit              Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  kindKey           String    @db.VarChar(32)   // movie | anime | tv_series | ova | documentary
  releaseDate       DateTime?
  runtimeMinutes    Int?
  episodeCount      Int?
  seasonCount       Int?
  isLicensed        Boolean   @default(false)
  coverAssetUnitId  String?   @db.Uuid

  extra             Json?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([kindKey, releaseDate])
}

// ============================================================
// POST EXTENSION (replaces Comment, Review, Note, Remark)
// ============================================================

model Post {
  unitId             String    @id @db.Uuid
  unit               Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  authorUserId       String    @db.Uuid

  // What this post is about (a book, a game, another post, etc.)
  targetUnitId       String?   @db.Uuid

  // Realm context for this post
  realmUnitId        String?   @db.Uuid

  // Content (fast path — not in UnitTranslation)
  body               String?

  // Tree structure (adjacency)
  rootPostUnitId     String?   @db.Uuid
  parentPostUnitId   String?   @db.Uuid

  // Content kind: discussion | review | reply | note
  kindKey            String?   @db.VarChar(64)

  // Tree metadata
  depth              Int       @default(0)
  sortPath           String?   @db.VarChar(512) // "0001.0003.0001" for threaded mode

  // Denormalized counts
  replyCount         Int       @default(0)
  directReplyCount   Int       @default(0)
  lastReplyAt        DateTime?
  isLocked           Boolean   @default(false)

  extra              Json?

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  targetUnit         Unit?     @relation("PostTarget", fields: [targetUnitId], references: [id], onDelete: SetNull)
  realmUnit          Unit?     @relation("PostRealm", fields: [realmUnitId], references: [id], onDelete: SetNull)
  rootPost           Unit?     @relation("PostRoot", fields: [rootPostUnitId], references: [id], onDelete: SetNull)
  parentPost         Unit?     @relation("PostParent", fields: [parentPostUnitId], references: [id], onDelete: SetNull)

  @@index([authorUserId, createdAt])
  @@index([targetUnitId, createdAt])
  @@index([targetUnitId, realmUnitId, createdAt])
  @@index([targetUnitId, sortPath])
  @@index([rootPostUnitId, sortPath])
  @@index([parentPostUnitId, createdAt])
  @@index([kindKey, createdAt])
}

// ============================================================
// SHELF EXTENSION (replaces ReadList + Series)
// ============================================================

model Shelf {
  unitId    String      @id @db.Uuid
  unit      Unit        @relation(fields: [unitId], references: [id], onDelete: Cascade)

  kindKey   String?     @db.VarChar(64) // collection | series | review-shelf | ranked
  extra     Json?

  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  items     ShelfItem[]
}

model ShelfItem {
  shelfUnitId      String   @db.Uuid
  itemUnitId       String   @db.Uuid
  sortOrder        Int      @default(0)

  // For review-driven shelves: the review post for this item
  reviewPostUnitId String?  @db.Uuid

  // For series: volume/edition label
  label            String?

  extra            Json?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  shelf            Shelf    @relation(fields: [shelfUnitId], references: [unitId], onDelete: Cascade)
  item             Unit     @relation("ShelfItemUnit", fields: [itemUnitId], references: [id], onDelete: Cascade)
  reviewPost       Unit?    @relation("ShelfItemReview", fields: [reviewPostUnitId], references: [id], onDelete: SetNull)

  @@id([shelfUnitId, itemUnitId])
  @@index([itemUnitId])
  @@index([shelfUnitId, sortOrder])
}

// ============================================================
// REALM EXTENSION
// ============================================================

model Realm {
  unitId      String   @id @db.Uuid
  unit        Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  isPublic    Boolean  @default(true)
  isOfficial  Boolean  @default(false)
  memberCount Int      @default(0)

  extra       Json?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     RealmMember[]
}

model RealmMember {
  realmUnitId String   @db.Uuid
  userId      String   @db.Uuid
  roleKey     String   @db.VarChar(32) // owner | moderator | member

  joinedAt    DateTime @default(now())
  updatedAt   DateTime @updatedAt

  realm       Realm    @relation(fields: [realmUnitId], references: [unitId], onDelete: Cascade)

  @@id([realmUnitId, userId])
  @@index([userId])
  @@index([realmUnitId, roleKey])
}

// ============================================================
// REALM ORGANIZATION
// ============================================================

// Content feed: "this unit is IN this realm"
model RealmUnit {
  realmUnitId String   @db.Uuid
  unitId      String   @db.Uuid
  createdAt   DateTime @default(now())

  realm       Unit     @relation("RealmContent", fields: [realmUnitId], references: [id], onDelete: Cascade)
  unit        Unit     @relation("UnitInRealm", fields: [unitId], references: [id], onDelete: Cascade)

  @@id([realmUnitId, unitId])
  @@index([unitId])
  @@index([realmUnitId, createdAt])
}

// Scoped classification: "this realm classifies this unit with this tag"
model RealmTagUnit {
  realmUnitId String   @db.Uuid
  tagUnitId   String   @db.Uuid
  unitId      String   @db.Uuid
  createdAt   DateTime @default(now())

  realm       Unit     @relation("RealmTagRealm", fields: [realmUnitId], references: [id], onDelete: Cascade)
  tag         Unit     @relation("RealmTagTag", fields: [tagUnitId], references: [id], onDelete: Cascade)
  unit        Unit     @relation("RealmTagUnit", fields: [unitId], references: [id], onDelete: Cascade)

  @@id([realmUnitId, tagUnitId, unitId])
  @@index([realmUnitId, unitId])
  @@index([unitId, realmUnitId])
  @@index([tagUnitId, realmUnitId])
}

// ============================================================
// TAG SCORING SYSTEM
// ============================================================

// Global scored tag junction
model UnitTag {
  unitId    String   @db.Uuid
  tagUnitId String   @db.Uuid

  score     Int      @default(0)
  voteCount Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  unit      Unit     @relation("TaggedUnit", fields: [unitId], references: [id], onDelete: Cascade)
  tag       Unit     @relation("TagUnit", fields: [tagUnitId], references: [id], onDelete: Cascade)

  @@id([unitId, tagUnitId])
  @@index([unitId, score])
  @@index([tagUnitId, score])
}

// Per-user tag votes
model TagVote {
  userId    String   @db.Uuid
  unitId    String   @db.Uuid
  tagUnitId String   @db.Uuid
  value     Int                       // +1 or -1

  createdAt DateTime @default(now())

  unit      Unit     @relation("TagVoteUnit", fields: [unitId], references: [id], onDelete: Cascade)
  tag       Unit     @relation("TagVoteTag", fields: [tagUnitId], references: [id], onDelete: Cascade)

  @@id([userId, unitId, tagUnitId])
  @@index([unitId, tagUnitId])
}

// ============================================================
// ATTRIBUTION
// ============================================================

model Person {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name      String
  extra     Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  credits   PersonCredit[]
}

model Organization {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name      String
  extra     Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  credits   OrgCredit[]
}

model PersonCredit {
  unitId    String @db.Uuid
  personId  String @db.Uuid
  roleKey   String @db.VarChar(64)  // author | translator | illustrator | editor | director | ...
  sortOrder Int    @default(0)

  unit      Unit   @relation(fields: [unitId], references: [id], onDelete: Cascade)
  person    Person @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@id([unitId, personId, roleKey])
  @@index([personId, roleKey])
  @@index([unitId, roleKey, sortOrder])
}

model OrgCredit {
  unitId         String       @db.Uuid
  organizationId String       @db.Uuid
  roleKey        String       @db.VarChar(64)  // publisher | developer | distributor | studio | ...
  sortOrder      Int          @default(0)

  unit           Unit         @relation(fields: [unitId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@id([unitId, organizationId, roleKey])
  @@index([organizationId, roleKey])
  @@index([unitId, roleKey, sortOrder])
}

// ============================================================
// USER (modified — UserType simplified)
// ============================================================

model User {
  unitId          String    @id @db.Uuid
  slug            String    @unique
  name            String
  avatar          String?
  bio             String?
  description     String?
  joinDate        DateTime?
  permission      Json?
  followersCount  Int       @default(0)
  followingsCount Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  followers       Follow[]  @relation("UserFollowers")
  followings      Follow[]  @relation("UserFollowings")
  units           Unit[]    @relation("UnitForUser")
  reactions       Reaction[] @relation("UserReactions")
  apiTokens       ApiToken[]
}

// ============================================================
// ENGAGEMENT (preserved with minor adjustments)
// ============================================================

model Reaction {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId    String   @db.Uuid
  targetId  String   @db.Uuid
  reaction  String
  createdAt DateTime @default(now())

  user       User @relation("UserReactions", fields: [userId], references: [unitId], onDelete: Cascade)
  targetUnit Unit @relation("UnitReactions", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([userId, targetId, reaction])
  @@index([targetId])
  @@index([targetId, reaction])
  @@index([userId, reaction])
}

model ReactionSummary {
  targetId String @db.Uuid
  reaction String
  count    Int    @default(0)

  targetUnit Unit @relation("UnitReactionSummaries", fields: [targetId], references: [id], onDelete: Cascade)

  @@id([targetId, reaction])
  @@index([targetId])
}

model Bookmark {
  userId    String   @db.Uuid
  targetId  String   @db.Uuid
  tags      String[] @default([])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  targetUnit Unit @relation(fields: [targetId], references: [id], onDelete: Cascade)

  @@id([userId, targetId])
  @@index([userId])
  @@index([targetId])
}

model Rating {
  unitId     String   @db.Uuid
  domain     String   @db.Uuid
  totalScore Int      @default(0)
  totalCount Int      @default(0)
  updatedAt  DateTime @updatedAt

  @@id([unitId, domain])
}

model Follow {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  followerId  String   @db.Uuid
  followingId String   @db.Uuid
  createdAt   DateTime @default(now())

  follower  User @relation("UserFollowings", fields: [followerId], references: [unitId], onDelete: Cascade)
  following User @relation("UserFollowers", fields: [followingId], references: [unitId], onDelete: Cascade)

  @@unique([followerId, followingId])
}

model ApiToken {
  id         String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId     String    @db.Uuid
  name       String
  tokenHash  String    @unique
  scopes     Json      @default("{}")
  createdAt  DateTime  @default(now())
  expiresAt  DateTime?
  lastUsedAt DateTime?
  lastIP     String?
  userAgent  String?
  revoked    Boolean   @default(false)
  revokedAt  DateTime?

  user User @relation(fields: [userId], references: [unitId], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@index([expiresAt])
}

// ============================================================
// PLATFORM MISC (preserved)
// ============================================================

model Feedback {
  id         String       @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId     String       @db.Uuid
  unitId     String?      @db.Uuid
  url        String?
  content    String
  type       FeedbackType @default(REPORT)
  resolved   Boolean      @default(false)
  resolvedAt DateTime?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  @@index([userId])
  @@index([unitId])
  @@index([type])
  @@index([resolved])
}

enum FeedbackType {
  REPORT
  BUG
  FEATURE
  OTHER
}

model JwtService {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  serviceKey    String   @unique
  issuer        String
  audience      String
  jwksUrl       String
  jwksPath      String
  isLocalIssuer Boolean  @default(false)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  jwks Jwks[]

  @@unique([issuer, audience])
  @@index([isLocalIssuer, isActive])
}

model Jwks {
  id           String    @id
  jwtServiceId String    @db.Uuid
  publicJwk    Json
  privateJwk   Json
  alg          String?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime?

  jwtService JwtService @relation(fields: [jwtServiceId], references: [id], onDelete: Cascade)

  @@index([jwtServiceId])
}

model EchoKV {
  key       String   @id
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Key Query Patterns

### Translation Resolution (Work Page)
```sql
-- Get work display in requested language
SELECT * FROM "UnitTranslation"
WHERE "unitId" = :workId AND "language" = :requestedLang;

-- Fallback to default language if not found
SELECT ut.* FROM "UnitTranslation" ut
JOIN "Unit" u ON u.id = ut."unitId"
WHERE ut."unitId" = :workId AND ut."language" = u."defaultLanguage";
```

### Realm Content Feed
```sql
-- What's in this realm, newest first
SELECT u.* FROM "Unit" u
JOIN "RealmUnit" ru ON ru."unitId" = u.id
WHERE ru."realmUnitId" = :realmId
ORDER BY ru."createdAt" DESC
LIMIT 20;
```

### Realm-Scoped Tag Filtering
```sql
-- In realm R, find all books tagged T
SELECT u.* FROM "Unit" u
JOIN "RealmTagUnit" rtu ON rtu."unitId" = u.id
WHERE rtu."realmUnitId" = :realmId
  AND rtu."tagUnitId" = :tagId
  AND u."type" = 'BOOK';
```

### Global Tag Discovery (Scored)
```sql
-- Top tags for a unit
SELECT ut.*, t_ut."title" as "tagLabel"
FROM "UnitTag" ut
JOIN "UnitTranslation" t_ut ON t_ut."unitId" = ut."tagUnitId" AND t_ut."language" = :lang
WHERE ut."unitId" = :unitId
ORDER BY ut."score" DESC;

-- Top units for a tag
SELECT u.*, ut."score"
FROM "Unit" u
JOIN "UnitTag" ut ON ut."unitId" = u.id
WHERE ut."tagUnitId" = :tagId
ORDER BY ut."score" DESC
LIMIT 20;
```

### Post: Flat Mode (X-Style)
```sql
-- Top-level posts for a unit
SELECT * FROM "Post"
WHERE "targetUnitId" = :unitId AND "depth" = 0
ORDER BY "createdAt" DESC
LIMIT 20;

-- Direct replies to a post
SELECT * FROM "Post"
WHERE "parentPostUnitId" = :postUnitId
ORDER BY "createdAt"
LIMIT 20;
```

### Post: Threaded Mode (Reddit-Style)
```sql
-- Load thread in display order with depth limit
SELECT * FROM "Post"
WHERE "rootPostUnitId" = :threadId
  AND "depth" <= :maxDepth
ORDER BY "sortPath"
LIMIT 100;

-- Load subtree under a specific comment
SELECT * FROM "Post"
WHERE "rootPostUnitId" = :threadId
  AND "sortPath" LIKE :parentSortPath || '.%'
ORDER BY "sortPath";

-- Paginate threaded comments for a target in a realm
SELECT * FROM "Post"
WHERE "targetUnitId" = :unitId
  AND "realmUnitId" = :realmId
  AND "depth" = 0
ORDER BY "sortPath"
LIMIT 20;
```

### Shelf with Reviews
```sql
-- Shelf items with their reviews
SELECT si.*, p."body" as "reviewBody", p."createdAt" as "reviewDate"
FROM "ShelfItem" si
LEFT JOIN "Post" p ON p."unitId" = si."reviewPostUnitId"
WHERE si."shelfUnitId" = :shelfId
ORDER BY si."sortOrder";
```

### Work/Release Navigation
```sql
-- Find releases for a work
SELECT * FROM "Unit"
WHERE "workUnitId" = :workId
  AND "status" = 'PUBLISHED';

-- Find the release for a specific language (via work's translation pointer)
SELECT ut."sourceReleaseUnitId"
FROM "UnitTranslation" ut
WHERE ut."unitId" = :workId
  AND ut."language" = :lang
  AND ut."sourceReleaseUnitId" IS NOT NULL;
```

## Service-Layer Invariants

These constraints MUST be enforced in the service layer (not expressible as Prisma constraints):

1. `workUnitId = null` when the unit functions as a work or standalone entity
2. `workUnitId != null` only when the unit is a release; the referenced work MUST exist and MUST have the same `type`
3. `WorkDisplayRelease` is not a table — `sourceReleaseUnitId` on `UnitTranslation` MUST reference a release that belongs to the same work as the translation's unit
4. `isLanguageNeutral = true` units (typically TAGs) do not require `UnitSupportLanguage` rows and MUST match all language filters
5. Extension tables MUST NOT contain language-dependent text fields (title, description, body) — exception: `Post.body` as an explicit fast-path decision
6. `RealmTagUnit` add operations MUST cascade to `UnitTag` (score increment); remove operations MUST NOT cascade
7. `ShelfItem.reviewPostUnitId`, when set, MUST reference a Post whose `targetUnitId` matches `ShelfItem.itemUnitId`
8. `Post.rootPostUnitId` for a top-level post equals its own `unitId`; for replies, it equals the thread root
9. `Post.depth` MUST equal the number of ancestor posts
10. `Post.sortPath` segment numbering MUST be unique among siblings under the same parent

## Risks / Trade-offs

### [R1] Migration complexity is high
The schema touches every table and every service. Even phased migration carries risk of data inconsistency during transition.
→ **Mitigation**: Phase migration with dual-read periods. Create new tables first, backfill data, switch reads, then drop old columns. Each phase is independently deployable and rollback-safe.

### [R2] Post.body bypasses UnitTranslation
If multi-language discussions ever become a real need, Post content would need to migrate to UnitTranslation.
→ **Mitigation**: `Post.body` is a pragmatic fast-path. The migration path is straightforward (add UnitTranslation rows, read from translation with Post.body as fallback, then drop Post.body). The cost of premature translation support for comments (3x write amplification) outweighs the risk.

### [R3] RealmTagUnit table scale
With many realms × tags × units, this table grows combinatorially.
→ **Mitigation**: In practice, each realm curates a subset of content. The table is append-mostly with good index coverage on all three FK columns. Postgres handles this scale well. If it becomes a bottleneck, partitioning by realmUnitId is straightforward.

### [R4] Materialized sortPath maintenance
Reordering or reparenting posts requires updating sortPath for all descendants.
→ **Mitigation**: REZICS doesn't support post reordering or reparenting. sortPath is append-only. If this changes, a bulk update script can regenerate paths for a subtree.

### [R5] Tag score manipulation
Coordinated voting (brigading) could distort tag scores.
→ **Mitigation**: Rate limiting on TagVote. Realm-contributed scores provide a counterbalance since realm-tagging requires moderator authority. Advanced: weighted votes based on user reputation. Not in initial scope.

### [R6] Person/Organization without full i18n
Person.name is a single string, not multilingual.
→ **Mitigation**: `extra` JSON can store alternate names/transliterations. If full i18n becomes necessary, either add PersonTranslation or promote Person to a Unit. Deferred intentionally to keep initial scope manageable.

## Migration Plan

### Phase 1: Schema Foundation
- Add `UnitVisibility` enum
- Add columns to `Unit`: `workUnitId`, `defaultLanguage`, `isLanguageNeutral`, `visibility`, modify `status` enum values
- Create `UnitTranslation`, `UnitSupportLanguage` tables
- Backfill: `Book.title/description` → `UnitTranslation`, `Book.language` → `UnitSupportLanguage` + `Unit.defaultLanguage`
- Backfill: `Book.anchorId` → `Unit.workUnitId`
- Remove `Unit.title`, `Unit.content` (after service migration)

### Phase 2: Type Extensions
- Create `Game`, `GamePlatform`, `Media` tables (new, no data migration)
- Create `Post` table, migrate `CommentIndex` + `Unit(type=COMMENT/REVIEW/REMARK/NOTE)` → `Post` rows
- Create `Shelf`, `ShelfItem` tables, migrate `ReadList` + `SeriesBook` → `Shelf/ShelfItem`
- Create `Realm`, `RealmMember` tables (new, no data migration)
- Update `UnitType` enum

### Phase 3: Organization Layer
- Create `RealmUnit`, `RealmTagUnit` tables (new)
- Create `UnitTag` (scored), `TagVote` tables
- Migrate existing `Unit ↔ Tag` M2M + `Book.tags String[]` → `UnitTag` rows
- Migrate `Tag.name/i18n` → `UnitTranslation`
- Remove `Tag` extension table (tags are now just Units with UnitTranslation)

### Phase 4: Attribution
- Create `Person`, `Organization`, `PersonCredit`, `OrgCredit` tables
- Migrate `Book.author/press/producer` (User M2M) → `PersonCredit/OrgCredit` + `Person/Organization` rows
- Remove `UserType.AUTHOR/PRESS/PRODUCER`, remove `Book.author/press/producer` relations

### Phase 5: Cleanup
- Drop deprecated columns: `Book.title`, `Book.description`, `Book.language`, `Book.anchorId`, `Book.tags`, `Book.coverUrl`
- Drop deprecated tables: `CommentIndex`, `ReadList`, `SeriesBook`, `Tag` (extension), `UnitLocalizations`
- Drop `Unit.title`, `Unit.content`, `Unit.metadata`
- Remove `DOMAIN` from UnitType, remove domain-related M2M

### Rollback Strategy
Each phase is independently reversible:
- Phase 1-4: New tables can be dropped, backfilled columns reverted. Old code paths remain functional until Phase 5.
- Phase 5 (destructive): Take a full backup before executing. No rollback without restore.

## Open Questions

1. **Chapter model**: Currently chapters are `Unit(type=CHAPTER)` with `BookIndex.index` (JSON table of contents). Should chapters become a tree of Unit nodes with their own tree structure, or continue as a JSON index? This design preserves `BookIndex` as-is but the chapter model may need its own redesign.

Answer: Chapters should retain the current BookIndex JSON structure, as it is the most flexible and lowest-cost solution.

2. **Search index rebuild**: Meilisearch sync needs complete rewrite. Should work/release grouping use `COALESCE(workUnitId, id)` as group key? Should realm-scoped search be a separate index or filtered within one index?

3. **EchoKV**: Temporary storage model — keep as-is or migrate to a different pattern?

Answer: EchoKV: Keep the temporary storage model as it is for now.

4. **Realm hierarchy**: Should realms support parent/child relationships (sub-realms), or remain strictly flat? Design assumes flat.

Answer: Realm hierarchy: Keep it strictly flat.

5. **Bookmark.tags**: Currently `String[]`. Should bookmarks use the new UnitTag system, or remain a simple personal tagging mechanism?
