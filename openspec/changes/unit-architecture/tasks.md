## 1. Schema Foundation — Enums and Unit Core

- [ ] 1.1 Add `UnitVisibility` enum (`PUBLIC`, `UNLISTED`, `PRIVATE`) to `package/server/prisma/schema.prisma`
- [ ] 1.2 Update `UnitType` enum: add `GAME`, `MEDIA`, `REALM`, `SHELF`; remove `NOTE`, `REMARK`, `REVIEW`, `DOMAIN`, `READLIST`; rename `COMMENT` removal (handled by POST)
- [ ] 1.3 Update `UnitStatus` enum values: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `DELETED` (rename `ACTIVE` → `PUBLISHED`, add `ARCHIVED`)
- [ ] 1.4 Add new columns to `Unit` model: `workUnitId` (Uuid, optional, self-relation), `defaultLanguage` (VarChar(16), optional), `isLanguageNeutral` (Boolean, default false), `visibility` (UnitVisibility, default PUBLIC), `nsfw` (Boolean, default false if not present)
- [ ] 1.5 Add self-relation `work/releases` on Unit (`@relation("WorkRelease")`) with `onDelete: SetNull`
- [ ] 1.6 Add indexes on Unit: `[workUnitId]`, `[status, visibility]`, `[defaultLanguage]`
- [ ] 1.7 Remove `Unit.title`, `Unit.content`, `Unit.metadata` columns (defer to Phase 5 cleanup if dual-read is needed)
- [ ] 1.8 Run `bun run prisma:generate` in `package/server` to verify schema compiles
- [ ] 1.9 Create migration: `bun run prisma:migrate` with descriptive name `unit-core-foundation`

## 2. Translation Layer

- [ ] 2.1 Create `UnitTranslation` model: composite PK `[unitId, language]`, fields: `title`, `subtitle`, `summary`, `description`, `extra` (Json), `sourceReleaseUnitId` (Uuid, optional), timestamps
- [ ] 2.2 Add index `[language, title]` on UnitTranslation
- [ ] 2.3 Create `UnitSupportLanguage` model: composite PK `[unitId, language]`, fields: `isPrimary` (default false), `sortOrder` (default 0)
- [ ] 2.4 Add index `[language, unitId]` on UnitSupportLanguage
- [ ] 2.5 Add `translations` and `supportLanguages` relations on Unit model
- [ ] 2.6 Run `bun run prisma:generate` and verify schema compiles
- [ ] 2.7 Create migration: `unit-translation-layer`

## 3. Data Migration — Book to New Structure

- [ ] 3.1 Write SQL migration script: `Book.title` / `Book.description` → `UnitTranslation` rows (language from `Book.language` or default `zh-CN`)
- [ ] 3.2 Write SQL migration script: `Book.language` → `UnitSupportLanguage` row + `Unit.defaultLanguage`
- [ ] 3.3 Write SQL migration script: `Book.anchorId` → `Unit.workUnitId`
- [ ] 3.4 Validate migration: query UnitTranslation to confirm all books have corresponding translation rows
- [ ] 3.5 Validate migration: query Unit to confirm anchorId values migrated to workUnitId

## 4. Book Extension Cleanup

- [ ] 4.1 Remove from `Book` model: `title`, `description`, `language`, `anchorId`, `coverUrl`, `tags` (String[]), `author` (User M2M), `press` (User M2M), `producer` (User M2M)
- [ ] 4.2 Rename `Book.isbn` → `Book.isbn13` (VarChar(32))
- [ ] 4.3 Add to `Book` model: `publicationDate` (DateTime, optional), `pageCount` (Int, optional), `formatKey` (VarChar(32), optional), `coverAssetUnitId` (Uuid, optional)
- [ ] 4.4 Keep `Book.textLength`, `Book.isLicensed`, `Book.extra`, `Book.unitId` (PK), `BookIndex` model unchanged
- [ ] 4.5 Update Book indexes: add `[isbn13]`, `[publicationDate]`
- [ ] 4.6 Run `bun run prisma:generate` and verify schema compiles
- [ ] 4.7 Create migration: `book-extension-cleanup`

## 5. New Type Extensions — Game, Media

- [ ] 5.1 Create `Game` model: `unitId` (PK, Uuid), `releaseDate`, `versionLabel`, `ageRatingKey` (VarChar(32)), `isLicensed`, `coverAssetUnitId`, `extra`, timestamps. Add 1:1 relation to Unit
- [ ] 5.2 Create `GamePlatform` model: composite PK `[gameUnitId, platformKey]`, `sortOrder`. Add relation to Game. Add index `[platformKey, gameUnitId]`
- [ ] 5.3 Create `Media` model: `unitId` (PK, Uuid), `kindKey` (VarChar(32), required), `releaseDate`, `runtimeMinutes`, `episodeCount`, `seasonCount`, `isLicensed`, `coverAssetUnitId`, `extra`, timestamps. Add 1:1 relation to Unit. Add index `[kindKey, releaseDate]`
- [ ] 5.4 Add `game` and `media` optional relations on Unit model
- [ ] 5.5 Run `bun run prisma:generate` and verify schema compiles
- [ ] 5.6 Create migration: `game-media-extensions`

## 6. Post Extension — Unified Comments/Reviews/Discussions

- [ ] 6.1 Create `Post` model with all fields per design.md: `unitId` (PK), `authorUserId`, `targetUnitId`, `realmUnitId`, `body`, `rootPostUnitId`, `parentPostUnitId`, `kindKey` (VarChar(64)), `depth`, `sortPath` (VarChar(512)), `replyCount`, `directReplyCount`, `lastReplyAt`, `isLocked`, `extra`, timestamps
- [ ] 6.2 Add all Post relations: `targetUnit`, `realmUnit`, `rootPost`, `parentPost` (all referencing Unit with appropriate relation names)
- [ ] 6.3 Add all Post indexes per design.md: `[authorUserId, createdAt]`, `[targetUnitId, createdAt]`, `[targetUnitId, realmUnitId, createdAt]`, `[targetUnitId, sortPath]`, `[rootPostUnitId, sortPath]`, `[parentPostUnitId, createdAt]`, `[kindKey, createdAt]`
- [ ] 6.4 Add reverse relations on Unit: `targetedByPosts`, `realmPosts`, `rootPosts`, `parentPosts`
- [ ] 6.5 Run `bun run prisma:generate` and verify schema compiles
- [ ] 6.6 Create migration: `post-extension`

## 7. Data Migration — Comments and Reviews to Post

- [ ] 7.1 Write SQL migration: `Unit(type=COMMENT)` + `CommentIndex` → `Post` rows. Map: `Unit.content` → `Post.body`, `CommentIndex.rootUnitId` → `Post.rootPostUnitId`, `CommentIndex.parentCommentId` → `Post.parentPostUnitId`, `CommentIndex.depth` → `Post.depth`, `Unit.userId` → `Post.authorUserId`, `kindKey='reply'`
- [ ] 7.2 Write SQL migration: `Unit(type=REVIEW)` → `Post` rows. Map: `Unit.content` → `Post.body`, `Unit.targetUnitId` → `Post.targetUnitId`, `Unit.userId` → `Post.authorUserId`, `kindKey='review'`
- [ ] 7.3 Write SQL migration: `Unit(type=REMARK)` → `Post` rows. Map same as review but `kindKey='note'`
- [ ] 7.4 Write SQL migration: `Unit(type=NOTE)` → `Post` rows with `kindKey='note'`
- [ ] 7.5 Update migrated Unit rows: change `type` from `COMMENT`/`REVIEW`/`REMARK`/`NOTE` to `POST`
- [ ] 7.6 Validate migration: confirm Post row count matches sum of old COMMENT + REVIEW + REMARK + NOTE units

## 8. Shelf Extension — Replacing ReadList and Series

- [ ] 8.1 Create `Shelf` model: `unitId` (PK), `kindKey` (VarChar(64)), `extra`, timestamps. Add 1:1 relation to Unit
- [ ] 8.2 Create `ShelfItem` model: composite PK `[shelfUnitId, itemUnitId]`, `sortOrder`, `reviewPostUnitId` (Uuid, optional), `label` (optional), `extra`, timestamps. Add relations to Shelf, Unit (item), Unit (reviewPost)
- [ ] 8.3 Add ShelfItem indexes: `[itemUnitId]`, `[shelfUnitId, sortOrder]`
- [ ] 8.4 Add `shelf` relation on Unit, plus `shelfItemsContaining` and `shelfItemReviews` reverse relations
- [ ] 8.5 Run `bun run prisma:generate` and verify schema compiles
- [ ] 8.6 Create migration: `shelf-extension`

## 9. Data Migration — ReadList and Series to Shelf

- [ ] 9.1 Write SQL migration: `ReadList` → `Shelf` rows. Map `ReadList.unitId` → `Shelf.unitId`, set `kindKey='collection'`
- [ ] 9.2 Write SQL migration: `ReadList` book associations → `ShelfItem` rows with sortOrder from `ReadList.order` array
- [ ] 9.3 Write SQL migration: `ReadList` review associations → update corresponding `ShelfItem.reviewPostUnitId`
- [ ] 9.4 Write SQL migration: `SeriesBook` → `ShelfItem` rows. Create a new Shelf Unit per series, then map `SeriesBook.bookId` → `ShelfItem.itemUnitId`, `SeriesBook.sortOrder` → `ShelfItem.sortOrder`, `SeriesBook.volumeLabel` → `ShelfItem.label`
- [ ] 9.5 Update migrated Unit rows: change `type` from `READLIST` to `SHELF`
- [ ] 9.6 Validate migration: confirm Shelf + ShelfItem counts match ReadList + SeriesBook counts

## 10. Realm Extension

- [ ] 10.1 Create `Realm` model: `unitId` (PK), `isPublic` (default true), `isOfficial` (default false), `memberCount` (default 0), `extra`, timestamps. Add 1:1 relation to Unit
- [ ] 10.2 Create `RealmMember` model: composite PK `[realmUnitId, userId]`, `roleKey` (VarChar(32)), `joinedAt`, `updatedAt`. Add relation to Realm. Add indexes: `[userId]`, `[realmUnitId, roleKey]`
- [ ] 10.3 Create `RealmUnit` model: composite PK `[realmUnitId, unitId]`, `createdAt`. Add relations to Unit (both sides). Add indexes: `[unitId]`, `[realmUnitId, createdAt]`
- [ ] 10.4 Create `RealmTagUnit` model: composite PK `[realmUnitId, tagUnitId, unitId]`, `createdAt`. Add relations to Unit (three sides). Add indexes: `[realmUnitId, unitId]`, `[unitId, realmUnitId]`, `[tagUnitId, realmUnitId]`
- [ ] 10.5 Add `realm` relation on Unit, plus all reverse relations for RealmUnit and RealmTagUnit
- [ ] 10.6 Run `bun run prisma:generate` and verify schema compiles
- [ ] 10.7 Create migration: `realm-extension`

## 11. Tag Scoring System

- [ ] 11.1 Create `UnitTag` model: composite PK `[unitId, tagUnitId]`, `score` (Int, default 0), `voteCount` (Int, default 0), timestamps. Add relations to Unit (both sides). Add indexes: `[unitId, score]`, `[tagUnitId, score]`
- [ ] 11.2 Create `TagVote` model: composite PK `[userId, unitId, tagUnitId]`, `value` (Int), `createdAt`. Add relations to Unit (both sides). Add index: `[unitId, tagUnitId]`
- [ ] 11.3 Add `unitTags`, `tagUsages`, `tagVotesOnUnit`, `tagVotesAsTag` relations on Unit model
- [ ] 11.4 Run `bun run prisma:generate` and verify schema compiles
- [ ] 11.5 Create migration: `tag-scoring-system`

## 12. Data Migration — Tags to New System

- [ ] 12.1 Write SQL migration: `Tag.name` / `Tag.i18n` → `UnitTranslation` rows for each tag Unit. Parse i18n JSON for multilingual labels
- [ ] 12.2 Write SQL migration: existing `Unit ↔ Tag` M2M (implicit Prisma junction `_UnitTags`) → `UnitTag` rows with initial `score=1`
- [ ] 12.3 Write SQL migration: `Book.tags` (String[]) → `UnitTag` rows. For each tag string, find or create a Tag Unit, then create UnitTag
- [ ] 12.4 Set `isLanguageNeutral = true` on all `Unit(type=TAG)` rows
- [ ] 12.5 Validate migration: confirm UnitTag count matches old tag associations

## 13. Attribution System

- [ ] 13.1 Create `Person` model: `id` (Uuid, PK), `name`, `extra` (Json), timestamps
- [ ] 13.2 Create `Organization` model: `id` (Uuid, PK), `name`, `extra` (Json), timestamps
- [ ] 13.3 Create `PersonCredit` model: composite PK `[unitId, personId, roleKey]`, `sortOrder`. Add relations. Add indexes: `[personId, roleKey]`, `[unitId, roleKey, sortOrder]`
- [ ] 13.4 Create `OrgCredit` model: composite PK `[unitId, organizationId, roleKey]`, `sortOrder`. Add relations. Add indexes: `[organizationId, roleKey]`, `[unitId, roleKey, sortOrder]`
- [ ] 13.5 Add `personCredits` and `organizationCredits` relations on Unit model
- [ ] 13.6 Run `bun run prisma:generate` and verify schema compiles
- [ ] 13.7 Create migration: `attribution-system`

## 14. Data Migration — Book Attribution to Credits

- [ ] 14.1 Write SQL migration: for each `Book.author` (User M2M), create `Person` row (from User.name) + `PersonCredit(unitId=book.unitId, personId, roleKey='author')`
- [ ] 14.2 Write SQL migration: for each `Book.press` (User M2M), create `Organization` row (from User.name) + `OrgCredit(unitId=book.unitId, organizationId, roleKey='publisher')`
- [ ] 14.3 Write SQL migration: for each `Book.producer` (User M2M), create `Organization` row (from User.name) + `OrgCredit(unitId=book.unitId, organizationId, roleKey='producer')`
- [ ] 14.4 Deduplicate: ensure Person/Organization rows are reused for the same name across books
- [ ] 14.5 Validate migration: confirm PersonCredit + OrgCredit counts match old Book author/press/producer associations

## 15. User Model Simplification

- [ ] 15.1 Remove `UserType` enum (or reduce to single value) from schema
- [ ] 15.2 Remove `type` field from User model
- [ ] 15.3 Remove `authorBook`, `pressBook`, `producerBook` relations from User model
- [ ] 15.4 Run `bun run prisma:generate` and verify schema compiles
- [ ] 15.5 Create migration: `user-model-simplification`

## 16. Schema Cleanup — Drop Deprecated Models

- [ ] 16.1 Drop `CommentIndex` model
- [ ] 16.2 Drop `ReadList` model
- [ ] 16.3 Drop `SeriesBook` model
- [ ] 16.4 Drop `Tag` extension model (tags are now just Units with UnitTranslation)
- [ ] 16.5 Drop `UnitLocalizations` model
- [ ] 16.6 Drop implicit `_UnitTags` and `_UnitDomains` M2M junction tables
- [ ] 16.7 Remove deprecated columns from `Unit`: `title`, `content`, `metadata`
- [ ] 16.8 Remove deprecated columns from `Book`: any remaining old fields not yet removed
- [ ] 16.9 Remove `DOMAIN` handling from Unit domains relation
- [ ] 16.10 Run `bun run prisma:generate` and verify final schema compiles clean
- [ ] 16.11 Create migration: `schema-cleanup-deprecated`
- [ ] 16.12 Full backup before executing this migration (destructive, no rollback)

## 17. Contract Layer — `@rezics/contract`

- [ ] 17.1 Update `UnitType` enum export in `package/contract/src/unit.ts` to match new Prisma enum
- [ ] 17.2 Add `UnitVisibility` enum export
- [ ] 17.3 Rewrite `baseUnitSchema` / `unitDTOSchema`: remove `title`, `content`, `metadata`; add `workUnitId`, `defaultLanguage`, `isLanguageNeutral`, `visibility`, `nsfw`
- [ ] 17.4 Add `UnitTranslationDTO` schema: `unitId`, `language`, `title`, `subtitle`, `summary`, `description`, `extra`, `sourceReleaseUnitId`
- [ ] 17.5 Rewrite `BookDTO` schema: remove `title`, `description`, `language`, `author`, `press`, `producer`, `tags`, `coverUrl`, `anchorId`. Add `isbn13`, `publicationDate`, `pageCount`, `formatKey`, `coverAssetUnitId`. Include nested `translations` array
- [ ] 17.6 Create `GameDTO` schema with Game fields + translations
- [ ] 17.7 Create `MediaDTO` schema with Media fields + translations
- [ ] 17.8 Create `PostDTO` schema with all Post fields
- [ ] 17.9 Create `ShelfDTO` and `ShelfItemDTO` schemas
- [ ] 17.10 Create `RealmDTO` and `RealmMemberDTO` schemas
- [ ] 17.11 Create `UnitTagDTO` schema (with score), `TagVoteDTO` schema
- [ ] 17.12 Create `RealmTagUnitDTO` schema
- [ ] 17.13 Create `PersonDTO`, `OrganizationDTO`, `PersonCreditDTO`, `OrgCreditDTO` schemas
- [ ] 17.14 Remove old `ReviewDTO`, `ReadlistDTO`, `CommentTreeNode` exports
- [ ] 17.15 Run `bun run build` in `package/contract` to verify all exports compile

## 18. Server Domain — Unit Service Rewrite

- [ ] 18.1 Rewrite `package/server/src/unit/unit.service.ts`: remove `title`/`content` handling, add `workUnitId`/`visibility`/`nsfw` support, update `buildUnitWhereClause` for new filters
- [ ] 18.2 Rewrite `package/server/src/unit/unit.mapper.ts`: map Unit + UnitTranslation join to new UnitDTO
- [ ] 18.3 Rewrite `package/server/src/unit/unit.api.ts`: update routes for new query params, response shapes
- [ ] 18.4 Update `package/server/src/unit/types.ts`: `UnitWithRelations` includes `translations`, `supportLanguages`
- [ ] 18.5 Create `package/server/src/unit/translation.service.ts`: CRUD for UnitTranslation, language resolution logic (requested → defaultLanguage → platform default)

## 19. Server Domain — Book Service Rewrite

- [ ] 19.1 Rewrite `package/server/src/book/book.service.ts`: create Book via Unit + Book + UnitTranslation in transaction, remove title/description/author/press/producer handling
- [ ] 19.2 Rewrite `package/server/src/book/book.mapper.ts`: map BookWithRelations (Unit + Book + UnitTranslation + PersonCredit + OrgCredit + UnitTag) to new BookDTO
- [ ] 19.3 Rewrite `package/server/src/book/book.api.ts`: update all endpoints for new request/response shapes
- [ ] 19.4 Update `package/server/src/book/types.ts`: `BookWithRelations` type reflects new joins
- [ ] 19.5 Add work/release handling: create-release endpoint that sets `workUnitId`

## 20. Server Domain — New Post Service

- [ ] 20.1 Create `package/server/src/post/post.service.ts`: CRUD, reply creation (sets parent/root/depth), sortPath generation (zero-padded 4-digit sibling segments), denormalized count updates (replyCount, directReplyCount, lastReplyAt)
- [ ] 20.2 Create `package/server/src/post/post.mapper.ts`: map PostWithRelations to PostDTO
- [ ] 20.3 Create `package/server/src/post/post.api.ts`: create/read/update/delete posts, flat listing (by targetUnitId), threaded listing (by rootPostUnitId with sortPath ordering), realm-scoped listing
- [ ] 20.4 Create `package/server/src/post/types.ts`: `PostWithRelations` type
- [ ] 20.5 Implement `sortPath` generation logic: on reply, query max sibling sortPath under parent, increment, append to parent's sortPath

## 21. Server Domain — New Shelf Service

- [ ] 21.1 Create `package/server/src/shelf/shelf.service.ts`: CRUD, add/remove/reorder items, review-driven item creation (add review Post → auto-create ShelfItem with itemUnitId from review.targetUnitId)
- [ ] 21.2 Create `package/server/src/shelf/shelf.mapper.ts`: map ShelfWithRelations to ShelfDTO
- [ ] 21.3 Create `package/server/src/shelf/shelf.api.ts`: shelf CRUD, item management, user shelves listing
- [ ] 21.4 Create `package/server/src/shelf/types.ts`: `ShelfWithRelations` type

## 22. Server Domain — New Realm Service

- [ ] 22.1 Create `package/server/src/realm/realm.service.ts`: CRUD, membership management (join/leave/role assignment), memberCount sync, owner transfer
- [ ] 22.2 Create `package/server/src/realm/realm.mapper.ts`: map RealmWithRelations to RealmDTO
- [ ] 22.3 Create `package/server/src/realm/realm.api.ts`: realm CRUD, membership endpoints, realm content feed (RealmUnit)
- [ ] 22.4 Create `package/server/src/realm/types.ts`
- [ ] 22.5 Implement permission checks: only moderator+ can perform realm-tag operations, only owner can transfer/delete realm

## 23. Server Domain — New RealmTagUnit Service

- [ ] 23.1 Create `package/server/src/realm-tag/realm-tag.service.ts`: add/remove RealmUnit (content feed), add/remove RealmTagUnit (scoped tagging)
- [ ] 23.2 Implement add-cascade: when creating RealmTagUnit, UPSERT UnitTag with score increment in same transaction
- [ ] 23.3 Implement no-removal-cascade: when deleting RealmTagUnit, do NOT modify UnitTag
- [ ] 23.4 Create `package/server/src/realm-tag/realm-tag.api.ts`: endpoints for realm content management and scoped tagging
- [ ] 23.5 Add permission middleware: verify caller is realm moderator or owner before RealmTagUnit mutations

## 24. Server Domain — Tag Scoring Service

- [ ] 24.1 Rewrite `package/server/src/tag/tag.service.ts`: tags are Units with UnitTranslation labels, no separate Tag extension. CRUD creates Unit(type=TAG, isLanguageNeutral=true) + UnitTranslation
- [ ] 24.2 Create `package/server/src/tag/tag-vote.service.ts`: create/update/delete TagVote, recalculate UnitTag.score (SUM of TagVote.value + realm contributions)
- [ ] 24.3 Rewrite `package/server/src/tag/tag.api.ts`: tag CRUD, tag search by language, tag voting endpoints, top tags per unit (ordered by score)
- [ ] 24.4 Create `package/server/src/tag/tag.mapper.ts`: map tag Unit + UnitTranslation + UnitTag to TagDTO

## 25. Server Domain — Attribution Service

- [ ] 25.1 Create `package/server/src/attribution/attribution.service.ts`: Person/Organization CRUD, PersonCredit/OrgCredit link/unlink
- [ ] 25.2 Create `package/server/src/attribution/attribution.mapper.ts`
- [ ] 25.3 Create `package/server/src/attribution/attribution.api.ts`: CRUD endpoints for persons, organizations, and credit assignments
- [ ] 25.4 Create `package/server/src/attribution/types.ts`

## 26. Server — Remove Deprecated Domains

- [ ] 26.1 Delete `package/server/src/comment/` directory entirely (comment.service.ts, comment.api.ts, types.ts, sql.ts)
- [ ] 26.2 Delete `package/server/src/review/` directory entirely (review.service.ts, review.api.ts, review.mapper.ts, review.types.ts, sql.ts)
- [ ] 26.3 Delete `package/server/src/readlist/` directory entirely
- [ ] 26.4 Update `package/server/src/index.ts`: remove old `.use()` mounts for comment, review, readlist; add new mounts for post, shelf, realm, realm-tag, attribution

## 27. Server — Search Compatibility Stub

> **NOTE**: Full search redesign (unified content index, realm-scoped filtering, server-mediated search, new contract types) is handled by the separate `search-redesign` change. This section only ensures the existing search code compiles against the new schema so `unit-architecture` can land independently.

- [ ] 27.1 Update `package/search/src/sync.ts` `syncAllBooks`: replace `Book.title`/`Book.description` reads with `UnitTranslation` join, replace `Book.author`/`Book.press`/`Book.producer` (User M2M) reads with `PersonCredit`/`OrgCredit` joins, replace `Book.tags` (String[]) and `Tag.name` reads with `UnitTag` join. Keep the existing `BookSearchDocument` shape — map new sources to old fields for continuity.
- [ ] 27.2 Update `package/search/src/sync.ts` `syncAllUnits`: replace `Unit.title`/`Unit.content` reads with `UnitTranslation` join. Replace `domainIds` with empty array (domains removed). Update type filters to exclude removed types (`COMMENT`, `NOTE`, `REMARK`, `REVIEW`, `DOMAIN`, `READLIST`).
- [ ] 27.3 Remove `syncAllReadlists` from `package/search/src/sync.ts` and its export from `index.ts`. Remove `readlistIndex` from `SearchClient`. Remove `package/server/src/meili/readlist/` directory.
- [ ] 27.4 Verify `bun run build` passes in `package/search` and `package/server` with updated sync code.
- [ ] 27.5 Add `// TODO(search-redesign): replaced by unified content index` comments on adapted sync functions to mark them as temporary.

## 28. API Client — `@rezics/api`

- [ ] 28.1 Rewrite book query options and hooks to use new BookDTO shape (translations, credits, scored tags)
- [ ] 28.2 Remove review, readlist, comment query options and hooks
- [ ] 28.3 Create post query options and hooks (flat + threaded modes, realm-scoped)
- [ ] 28.4 Create shelf query options and hooks
- [ ] 28.5 Create realm query options and hooks (CRUD, membership, content feed)
- [ ] 28.6 Create realm-tag query options and hooks
- [ ] 28.7 Create tag-vote query options and hooks
- [ ] 28.8 Update unit query options for new Unit shape
- [ ] 28.9 Run `bun run build` in `package/api` to verify all exports compile

## 29. Frontend — `@rezics/app` Feature Updates

- [ ] 29.1 Update book feature: display translations, credits (PersonCredit/OrgCredit), scored tags, work/release navigation
- [ ] 29.2 Rewrite comment/review sections to use Post API (flat mode for simple comments, threaded mode where applicable)
- [ ] 29.3 Rewrite readlist feature as shelf feature: pure shelves, review-driven shelves, series shelves
- [ ] 29.4 Create realm feature: realm browsing, realm content feed, realm-scoped tag filtering, membership management
- [ ] 29.5 Update tag feature: scored tag display, tag voting UI, tag search by language
- [ ] 29.6 Update search feature: handle new UnitSearchDocument shape, work/release grouping
- [ ] 29.7 Update all `// MOCK:` annotations to reflect new contract shapes
- [ ] 29.8 Run `bun run format:check` and `bun run build` in `package/app`

## 30. Frontend — `@rezics/admin` Updates

- [ ] 30.1 Update admin book management: new BookDTO shape, translation editing, credit management
- [ ] 30.2 Add admin realm management: create/edit realms, manage members
- [ ] 30.3 Add admin tag management: create tags with multilingual labels, view/adjust scores
- [ ] 30.4 Add admin attribution management: Person/Organization CRUD
- [ ] 30.5 Run `bun run build` in `package/admin`

## 31. Validation and Cleanup

- [ ] 31.1 Run `bun test` across all packages — fix any failing tests
- [ ] 31.2 Run `bun run knip` at root — detect and remove unused exports/dependencies from old models
- [ ] 31.3 Grep codebase for references to removed types: `CommentIndex`, `ReadList`, `SeriesBook`, `Tag` (extension), `UserType.AUTHOR`, `UserType.PRESS`, `UserType.PRODUCER`, `UnitLocalizations`
- [ ] 31.4 Grep codebase for `Book.title`, `Book.description`, `Book.language`, `Book.author`, `Book.press`, `Book.producer`, `Book.tags`, `Book.anchorId`, `Book.coverUrl` — ensure zero references
- [ ] 31.5 Grep codebase for `Unit.title`, `Unit.content`, `Unit.metadata` — ensure zero references
- [ ] 31.6 Verify `bun run app:dev` starts without errors
- [ ] 31.7 Verify `bun run server:dev` starts without errors
- [ ] 31.8 End-to-end smoke test: create a book (work + release), add translations, tag it, add to shelf, post a review
