## Why

The current data model suffers from four structural problems that compound as the platform scales beyond books into games, media, and community-driven content:

1. **Dual truth sources**: `Book.title` and `Unit.title` coexist with no clear authority. Adding multi-language support on top of this creates three potential sources for the same field.
2. **Flat content model**: Books, comments, reviews, tags, and reading lists all hang off a single `Unit` table with a type enum, but type-specific facts (ISBN, page count) are split across extension tables inconsistently — Book has its own table, but reviews are just Unit metadata.
3. **No work/release distinction**: `Book.anchorId` is an opaque link between editions with no enforced semantics. There is no formal model for "this work exists in multiple editions/translations."
4. **Monolithic tagging**: `Book.tags String[]` duplicates the `Unit ↔ Tag` M2M. Tags have no scoring, no community-scoped curation, and no mechanism for different user groups to classify the same content differently.

These problems block three strategic goals: multi-language content support, expansion beyond books (games, anime, media), and community-driven organization (realms). Solving them requires a unified architectural foundation — not incremental patches.

## What Changes

### Identity Layer
- **BREAKING**: `Unit` becomes the sole identity anchor. All type-specific text fields (`Book.title`, `Book.description`) move to `UnitTranslation`. `Unit.title` and `Unit.content` are removed.
- **BREAKING**: `UnitType` enum is updated: `COMMENT` removed (unified into `POST`), `READLIST` renamed to `SHELF`, `NOTE`/`REMARK` subsumed by `Post.kindKey`, `DOMAIN` removed (replaced by `REALM`). New types added: `GAME`, `MEDIA`, `REALM`, `SHELF`.
- **BREAKING**: `UnitRole` enum from the original proposal is **not implemented**. Role is derived from `workUnitId` and `type`.
- `Unit` gains: `workUnitId` (replacing `Book.anchorId`), `defaultLanguage`, `isLanguageNeutral`, `visibility` enum, `nsfw` flag.

### Translation Layer
- New `UnitTranslation` table: `(unitId, language)` composite key with `title`, `subtitle`, `summary`, `description`, `extra`, and `sourceReleaseUnitId` (for work→release content navigation).
- New `UnitSupportLanguage` table: tracks which languages a unit's content actually supports, distinct from which languages have display translations.

### Work/Release Model
- `Unit.workUnitId` formalizes the work/release relationship. A release points to its parent work. A standalone unit has `workUnitId = null`.
- `Book.anchorId` is removed and migrated to `Unit.workUnitId`.
- `SeriesBook` is removed — series are modeled as Shelves.

### Type Extensions
- **Book**: stripped to language-neutral facts (`isbn13`, `pageCount`, `textLength`, `formatKey`, `publicationDate`, `isLicensed`, `coverAssetUnitId`).
- **Game** (new): `releaseDate`, `versionLabel`, `ageRatingKey`, `isLicensed`, `coverAssetUnitId` + `GamePlatform` junction.
- **Media** (new): `kindKey` (movie/anime/tv_series/ova/documentary), `releaseDate`, `runtimeMinutes`, `episodeCount`, `seasonCount`, `isLicensed`, `coverAssetUnitId`.
- **Post**: unified model for reviews, comments, discussions. Has `body` directly (fast path, no UnitTranslation required). Tree support via `parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath` (materialized path for Reddit-style threading). `realmUnitId` for realm-scoped discussions.
- **Shelf** (replacing ReadList): universal ordered collections for books, games, media, mixed content. `ShelfItem` junction with `reviewPostUnitId` (review-driven shelves), `label` (series volume labels), `sortOrder`.
- **Realm** (new, replacing Domain): community organization with `isPublic`, `isOfficial`, `memberCount`. `RealmMember` for governance (owner/moderator/member roles).

### Tag System
- **BREAKING**: `Book.tags String[]` removed. Tags are exclusively Units with multilingual labels via `UnitTranslation`.
- **BREAKING**: Tag domains concept removed entirely.
- `UnitTag` becomes a **scored junction**: `(unitId, tagUnitId, score, voteCount)`. Score determines tag prominence.
- New `TagVote` table: per-user votes on tag accuracy `(userId, unitId, tagUnitId, value)`.
- Scoring mechanism: more aggressive than Steam, closer to e-hentai. Users vote up/down on tag relevance. Official/Rezics-curated tags are maintained with manually higher scores.
- Flat tags only — no categories, no namespaces. Realms serve as the namespace mechanism.

### Realm-Tag-Unit System
- New `RealmTagUnit` three-way junction: `(realmUnitId, tagUnitId, unitId)`. A realm classifies a unit with a specific tag.
- **Cascade semantics**: adding a realm-tag automatically cascades to global `UnitTag` (score increment). Removing a realm-tag does NOT cascade — global tags are accumulative.
- New `RealmUnit` junction: `(realmUnitId, unitId)`. Tracks which units are published within a realm (the content feed). Separate from tagging.
- Realms-as-namespaces: creating realms like "male traits" or "female traits" provides the equivalent of e-hentai's tag namespace system without any namespace infrastructure.

### Attribution
- **BREAKING**: `UserType` enum values `AUTHOR`, `PRESS`, `PRODUCER` decoupled from platform `User`. Book author/press/producer M2M relations to User removed.
- New `Person` and `Organization` entities (independent of User accounts).
- New `PersonCredit` and `OrgCredit` junction tables with flexible `roleKey` (author, translator, illustrator, director, publisher, etc.).

### Engagement (preserved, minor changes)
- `Reaction`, `ReactionSummary`, `Bookmark` continue to reference `Unit.id` — no structural changes needed.
- `Rating` model unchanged.

## Capabilities

### New Capabilities
- `unit-identity`: Core Unit model, UnitType enum, UnitStatus, UnitVisibility, workUnitId, lifecycle fields
- `unit-translation`: UnitTranslation, UnitSupportLanguage, sourceReleaseUnitId, language resolution logic
- `work-release`: Work/Release relationship model, invariants, query patterns
- `type-extension-book`: Book extension table (migrated from current), language-neutral facts only
- `type-extension-game`: Game extension table and GamePlatform junction
- `type-extension-media`: Media extension table with kindKey
- `type-extension-post`: Unified Post model (reviews, comments, discussions), body fast path, tree support (flat mode + threaded mode with sortPath), realm-scoped discussions
- `type-extension-shelf`: Shelf model replacing ReadList+Series, ShelfItem with review and label support, universal media collections
- `type-extension-realm`: Realm extension, RealmMember governance, RealmUnit content feed
- `tag-scoring`: Flat scored UnitTag, TagVote voting mechanism, score aggregation, official tag boosting
- `realm-tag-unit`: Three-way RealmTagUnit junction, add-cascade to UnitTag, no-removal-cascade semantics, realms-as-namespaces
- `attribution`: Person, Organization, PersonCredit, OrgCredit with flexible roleKey

### Modified Capabilities
- `server-route-cleanup`: All existing Book/Comment/ReadList/Tag API routes require rewrite to new domain structure
- `user-domain-decoupling`: UserType enum simplified (AUTHOR/PRESS/PRODUCER removed), User model stripped of book-specific relations

## Impact

### Affected Packages
- **`@rezics/server`**: Complete domain restructure — all services, APIs, mappers, types rewritten. Prisma schema is the primary change target.
- **`@rezics/contract`**: All DTOs rebuilt around new Unit/Translation/Extension structure. BookDTO, ReviewDTO, ReadlistDTO, CommentDTO, TagDTO all replaced.
- **`@rezics/api`**: All TanStack Query hooks and query options regenerated from new contracts.
- **`@rezics/app`**: All features consuming book/review/readlist/comment/tag data must be updated.
- **`@rezics/admin`**: Admin interfaces for content management updated.
- **`@rezics/search`**: Meilisearch sync and indexing completely rebuilt — work/release grouping, realm-scoped search, tag-scored filtering.

### Database Migration
- Multi-step migration required (not big-bang). Phases:
  1. Create new tables (Unit changes, UnitTranslation, UnitSupportLanguage)
  2. Migrate Book data to new structure (title/description → UnitTranslation, anchorId → workUnitId)
  3. Create extension tables (Game, Media, Post, Shelf, Realm)
  4. Migrate CommentIndex → Post tree, ReadList → Shelf
  5. Deploy tag scoring + realm system
  6. Drop deprecated columns and tables

### Backward Compatibility
- This is a **breaking change** across the entire stack. No backward-compatible API surface is maintained — the old and new models are structurally incompatible.
- Frontend mock data (`// MOCK:` annotations) must be updated to reflect new contract shapes.
- The migration is designed to be executed in phases to reduce risk, but each phase requires coordinated frontend+backend changes.
