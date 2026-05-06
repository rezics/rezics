## 1. Policy and Specs

- [x] 1.1 Add a development-stage no-compatibility policy to `AGENTS.md`.
- [x] 1.2 Add the same development-stage no-compatibility policy to `CLAUDE.md`.
- [x] 1.3 Run `openspec status --change rename-book-content-structure` and confirm the change is apply-ready before implementation.

## 2. Contract and Shared Types

- [x] 2.1 Update `package/contract/src/book.ts`: rename `bookIndexNodeSchema` to `bookContentStructureNodeSchema`.
- [x] 2.2 Update `package/contract/src/book.ts`: rename `BookIndexPath` to `BookContentStructurePath`.
- [x] 2.3 Update `package/contract/src/book.ts`: rename `bookIndexDTOSchema` / `BookIndexDTO` to `bookContentStructureDTOSchema` / `BookContentStructureDTO`.
- [x] 2.4 Rename response and node-facing fields from `index` to `nodes` where they represent the book content structure.
- [x] 2.5 Update comments and JSDoc in `package/contract` to use BookContentStructure/content structure terminology.

## 3. Prisma and Server Model

- [x] 3.1 Update `package/server/prisma/schema.prisma`: rename model `BookIndex` to `BookContentStructure`.
- [x] 3.2 Update `package/server/prisma/schema.prisma`: rename `Book.chapterIndex` to `Book.contentStructure`.
- [x] 3.3 Update `package/server/prisma/schema.prisma`: rename `BookContentStructure.index` to `BookContentStructure.nodes`.
- [x] 3.4 Add a dev-stage Prisma migration for the model/table/field rename or recreation.
- [x] 3.5 Update seed cleanup, factory creation, and factory update paths under `package/server/prisma/` to use `contentStructure` and `nodes`.
- [x] 3.6 Delete `package/server/scripts/migrate-book-index-chapter-unit-ids.ts`.

## 4. Server API and Services

- [x] 4.1 Rename `package/server/src/book/book-index.ts` to `book-content-structure.ts`.
- [x] 4.2 Rename helper symbols such as `BookIndexPathError`, `parseBookIndexPath`, `validateBookIndexPath`, `getBookIndexNode`, and `updateBookIndexNode` to BookContentStructure names.
- [x] 4.3 Remove `normalizeLegacyBookIndexValue`, `normalizeLegacyBookIndex`, `migrateLegacyBookIndexIds`, and `readLegacyId` behavior.
- [x] 4.4 Update `package/server/src/book/book.service.ts`: rename `getChapterIndexByBookUnitId` to `getContentStructureByBookUnitId`.
- [x] 4.5 Update `package/server/src/book/book.service.ts`: rename `updateChapterIndex` to `updateContentStructure` and persist `nodes`.
- [x] 4.6 Update `package/server/src/book/book.api.ts`: replace `GET /:unitId/chapterIndex` with `GET /:unitId/content-structure`.
- [x] 4.7 Update `package/server/src/book/book.api.ts`: replace `PUT /:unitId/chapterIndex` with `PUT /:unitId/content-structure`.
- [x] 4.8 Update chapter materialization service/API/tests to read and update BookContentStructure paths and timestamps.
- [x] 4.9 Rename server tests from BookIndex terminology to BookContentStructure terminology and remove legacy `id` normalization expectations.

## 5. API Client

- [x] 5.1 Update `package/api/src/book/book.api.ts`: rename `getChapterIndex` to `getContentStructure`.
- [x] 5.2 Update `package/api/src/book/book.api.ts`: rename `updateChapterIndex` to `updateContentStructure` and call `/content-structure`.
- [x] 5.3 Update `package/api/src/book/book.keys.ts`: rename `chapterIndex` key builder to `contentStructure`.
- [x] 5.4 Update `package/api/src/book/book.queries.ts`: rename `bookChapterIndexQuery` to `bookContentStructureQuery` and export it as `bookQueries.contentStructure`.
- [x] 5.5 Update `package/api/src/book/book.mutations.ts` and `package/api/src/chapter/chapter.mutations.ts` invalidation keys to use `bookKeys.contentStructure`.
- [x] 5.6 Update `package/api/src/book/book.ts` exports to remove old chapterIndex aliases.

## 6. Frontend App Callsite Migration

- [x] 6.1 Replace `bookQueries.chapterIndex(...)` callsites in `package/app/src/book-read`, `package/app/src/book-edit`, and `package/app/src/book-library` with `bookQueries.contentStructure(...)`.
- [x] 6.2 Replace imports of `bookChapterIndexQuery` with `bookContentStructureQuery`.
- [x] 6.3 Rename local variables that hold the content structure from `chapterIndex`/`bookIndex` to `contentStructure`.
- [x] 6.4 Update JSON export filenames and labels that currently say `chapterIndex`.
- [x] 6.5 Keep reader-local ordinal fields such as `package/folio/src/** chapterIndex: number` unchanged unless they refer to the API response.

## 7. Compatibility Cleanup

- [x] 7.1 Remove backward-compatible aliases from `package/app/src/book-library/index.ts`.
- [x] 7.2 Remove `BookDiscussionPage = BookCommunityPage` and update route imports to use `BookCommunityPage`.
- [x] 7.3 Remove `ChapterListContainer` legacy export from `package/app/src/book-library/components/Chapter/ChapterList.tsx`.
- [x] 7.4 Run `rg -n "Backward compatible|Backward-compatible|backward compatibility|legacy|deprecated|compat" package -g '!**/dist/**'` and remove remaining internal development-stage compatibility shims introduced by old project names or old internal APIs.
- [x] 7.5 Leave compatibility language that refers to external protocols, third-party packages, or historical archived OpenSpec changes unless it is an active internal shim.

## 8. Verification

- [x] 8.1 Run `rg -n "\\b(BookIndex|bookIndex|book-index|chapterIndex|ChapterIndex)\\b" package/contract package/server package/api package/app openspec/specs -g '!**/dist/**'` and confirm remaining matches are intentional reader-position or historical exceptions.
- [x] 8.2 Run targeted server tests for book content-structure helpers and chapter materialization.
- [x] 8.3 Run targeted API/app type checks or tests for changed query exports and callsites.
- [x] 8.4 Run `openspec status --change rename-book-content-structure` and confirm artifacts remain valid.
