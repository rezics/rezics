## 1. Contract Layer — `@rezics/contract`

- [x] 1.1 Create `package/contract/src/meili/content.ts` with Typebox schemas: `ContentSearchDocumentSchema`, `ContentSearchOptionsSchema`, `ContentSearchResultSchema`. Export TypeScript types via `Static<>`.
- [x] 1.2 Remove old search types from `package/contract/src/meili/`: delete `book.ts`, `unit.ts`, `readlist.ts`. Remove their exports from `package/contract/src/meili/index.ts`.
- [x] 1.3 Remove `toBookQueryString` function and `BookQueryOptions` type from contract exports.
- [x] 1.4 Update `package/contract/src/meili/index.ts` to export new content search types. Retain `feedback.ts` and `user.ts` exports.
- [x] 1.5 Run `bun run build` in `package/contract` to verify all exports compile.

## 2. Search Client — `@rezics/search`

- [x] 2.1 Rewrite `package/search/src/client.ts`: replace 5-index `SearchClient` with new client containing `contentIndex`, `userIndex`, `feedbackIndex`. Remove `bookIndex`, `unitIndex`, `readlistIndex` and all their CRUD methods.
- [x] 2.2 Add `initContentIndex()` method: configure searchable attributes (`titles`, `subtitles`, `descriptions`, `summaries`, `creditNames`, `tagLabels`), filterable attributes (`type`, `tagIds`, `realmIds`, `realmTagKeys`, `languages`, `nsfw`, `visibility`, `isLicensed`), sortable attributes (`createdAt`, `updatedAt`, `publishedAt`).
- [x] 2.3 Update `initUserIndex()`: remove `type` filterable attribute (UserType simplified in unit-architecture).
- [x] 2.4 Add content document CRUD methods: `addOrUpdateContent(docs)`, `deleteContent(ids)`, `deleteAllContent()`.
- [x] 2.5 Remove `getSearchKey()` method (frontend no longer queries Meilisearch directly).

## 3. Content Sync — `@rezics/search`

- [x] 3.1 Rewrite `package/search/src/sync.ts`: remove `syncAllBooks`, `syncAllUnits`, `syncAllReadlists`. Add `syncAllContent(client)` function.
- [x] 3.2 Implement `syncAllContent`: cursor-paginated query on `prisma.unit.findMany` with `where: { workUnitId: null, type: { in: ['BOOK', 'GAME', 'MEDIA', 'SHELF'] }, status: 'PUBLISHED', visibility: 'PUBLIC' }`. Include `translations`, `unitTags` (with tag translations), `inRealms`, `realmTagAsUnit`, `personCredits` (with person), `organizationCredits` (with organization), `book`, `game` (with platforms), `media`, `shelf`.
- [x] 3.3 Implement `buildContentDocument(unit)` mapper function: transform Prisma unit with relations into `ContentSearchDocument`. Flatten translations into arrays (`titles`, `subtitles`, `summaries`, `descriptions`), collect `tagIds`/`tagScores`/`tagLabels` from unitTags, collect `realmIds` from inRealms, build `realmTagKeys` from realmTagAsUnit, collect `creditNames` from personCredits + organizationCredits, extract `isLicensed`/`coverAssetUnitId` from type extension.
- [x] 3.4 Add `syncSingleContent(client, unitId)` function for incremental sync: fetch unit by ID with same includes, if unit qualifies → upsert document, if not → delete document from index.
- [x] 3.5 Update `syncAllUsers` to remove references to old `UserType` enum values.
- [x] 3.6 Update `package/search/src/index.ts` exports: export `syncAllContent`, `syncSingleContent`, `syncAllUsers`, `syncAllFeedbacks`. Remove old exports.

## 4. Server Search Domain — `@rezics/server`

- [x] 4.1 Delete old per-type directories: `package/server/src/meili/book/`, `package/server/src/meili/unit/`, `package/server/src/meili/readlist/`.
- [x] 4.2 Create `package/server/src/meili/content/` directory with `content.api.ts`, `content.service.ts`, `index.ts`.
- [x] 4.3 Implement `content.service.ts`: `searchContent(opts: ContentSearchOptions)` function. Build Meilisearch filter array from options: `type` filter, `tagIds` filter, `realmIds` filter, `realmTagKeys` construction (combine `realmId` + `realmTagIds`), `languages` filter, `nsfw` filter (default false), `isLicensed` filter, `visibility = PUBLIC`. Build sort array. Call `searchClient.contentIndex.search()`.
- [x] 4.4 Implement `content.api.ts`: Elysia route `POST /search/content` accepting `ContentSearchOptions` body, returning `ContentSearchResult`. Use Typebox schema from contract for validation.
- [x] 4.5 Rewrite `package/server/src/meili/meili.service.ts`: replace `searchBooks`/`searchUnits`/`searchReadlists` with `searchContent`. Replace `initBooksIndex`/`initUnitsIndex`/`initReadlistsIndex` with `initContentIndex`. Replace `syncAllBooks`/`syncAllUnits`/`syncAllReadlists` with `syncAllContent`. Add `syncSingleContent(unitId)`.
- [x] 4.6 Update `package/server/src/meili/meili.api.ts`: expose new search endpoint via Elysia `.use()`. Remove old book/unit/readlist search routes.
- [x] 4.7 Update `package/server/src/meili/index.ts` exports.

## 5. Incremental Sync Integration — `@rezics/server`

- [x] 5.1 Add `syncSingleContent(unitId)` call in unit domain service (`package/server/src/unit/unit.service.ts`) after unit create/update/delete operations.
- [x] 5.2 Add `syncSingleContent(unitId)` call in tag domain service after `UnitTag` create/delete.
- [x] 5.3 Add `syncSingleContent(unitId)` call in realm-tag domain service after `RealmUnit` and `RealmTagUnit` create/delete.
- [x] 5.4 Add `syncSingleContent(unitId)` call in attribution domain service after `PersonCredit`/`OrgCredit` create/delete.

## 6. Server Search Client Update

- [x] 6.1 Update `package/server/src/meili/search-client.ts` import: ensure it constructs the new `SearchClient` from `@rezics/search`.
- [x] 6.2 Remove `getSearchKey` endpoint from server API (frontend no longer needs Meilisearch keys for content search).

## 7. API Client — `@rezics/api`

- [x] 7.1 Remove old search query options and hooks: book search hooks, unit search hooks, readlist search hooks.
- [x] 7.2 Create content search query options: `contentSearchQueryOptions(opts: ContentSearchOptions)` returning TanStack Query options that call the server `POST /search/content` endpoint.
- [x] 7.3 Create `useContentSearch(opts)` hook wrapping `contentSearchQueryOptions`.
- [x] 7.4 Run `bun run build` in `package/api` to verify exports compile.

## 8. Frontend — `@rezics/app` Search Feature

- [x] 8.1 Update search feature model: replace `BookSearchDocument`-based types with `ContentSearchDocument`. Add title resolution logic (pick title from `titles` array by user's preferred language, fallback to first).
- [x] 8.2 Update search feature hooks: replace old book search hooks with `useContentSearch`. Map `ContentSearchOptions` from UI state (keyword, type filter, tag filter, realm filter).
- [x] 8.3 Update search feature components: render results from `ContentSearchDocument` fields — resolved title, `creditNames`, `type` badge, `coverAssetUnitId`.
- [x] 8.4 Add type filter UI: allow filtering by BOOK, GAME, MEDIA, SHELF.
- [x] 8.5 Add realm-scoped search: when search is performed within a realm context, include `realmId` in search options.
- [x] 8.6 Update tag filter: pass tag UUIDs (from tag lookup/UI state) in `tagIds` or `realmTagIds`, not tag name strings.

## 9. Frontend — `@rezics/admin` Search Updates

- [x] 9.1 Update admin search/sync controls: replace book/unit/readlist sync buttons with unified content sync.
- [x] 9.2 Update admin search interface to use new `ContentSearchResult` shape.

## 10. Cleanup and Validation

- [x] 10.1 Grep codebase for references to removed types: `BookSearchDocument`, `BookSearchResult`, `BookQueryOptions`, `UnitSearchDocument`, `UnitSearchResult`, `UnitListQuery`, `ReadlistSearchDocument`, `ReadlistSearchResult`, `ReadlistListQuery`, `toBookQueryString` — ensure zero references.
- [x] 10.2 Grep codebase for `searchBooks`, `searchUnits`, `searchReadlists`, `syncAllBooks`, `syncAllUnits`, `syncAllReadlists`, `getSearchKey` — ensure zero references.
- [x] 10.3 Remove `package/search/src/test/bookInit.ts` or rewrite as `contentInit.ts` test script.
- [x] 10.4 Run `bun run build` across all affected packages: `contract`, `search`, `server`, `api`, `app`, `admin`.
- [x] 10.5 Run `bun test` across all packages — fix any failing tests.
- [x] 10.6 Run `bun run knip` at root — detect and remove unused exports/dependencies.
