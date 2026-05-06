## 1. Policy and Specs

- [ ] 1.1 Add a development-stage no-compatibility policy to `AGENTS.md`.
- [ ] 1.2 Add the same development-stage no-compatibility policy to `CLAUDE.md`.
- [ ] 1.3 Run `openspec status --change rename-book-content-structure` and confirm the change is apply-ready before implementation.

## 2. Contract and Shared Types

- [ ] 2.1 Update `package/contract/src/book.ts`: rename `bookIndexNodeSchema` to `bookContentStructureNodeSchema`.
- [ ] 2.2 Update `package/contract/src/book.ts`: rename `BookIndexPath` to `BookContentStructurePath`.
- [ ] 2.3 Update `package/contract/src/book.ts`: rename `bookIndexDTOSchema` / `BookIndexDTO` to `bookContentStructureDTOSchema` / `BookContentStructureDTO`.
- [ ] 2.4 Rename response and node-facing fields from `index` to `nodes` where they represent the book content structure.
- [ ] 2.5 Update comments and JSDoc in `package/contract` to use BookContentStructure/content structure terminology.

## 3. Prisma and Server Model

- [ ] 3.1 Update `package/server/prisma/schema.prisma`: rename model `BookIndex` to `BookContentStructure`.
- [ ] 3.2 Update `package/server/prisma/schema.prisma`: rename `Book.chapterIndex` to `Book.contentStructure`.
- [ ] 3.3 Update `package/server/prisma/schema.prisma`: rename `BookContentStructure.index` to `BookContentStructure.nodes`.
- [ ] 3.4 Add a dev-stage Prisma migration for the model/table/field rename or recreation.
- [ ] 3.5 Update seed cleanup, factory creation, and factory update paths under `package/server/prisma/` to use `contentStructure` and `nodes`.
- [ ] 3.6 Delete `package/server/scripts/migrate-book-index-chapter-unit-ids.ts`.

## 4. Server API and Services

- [ ] 4.1 Rename `package/server/src/book/book-index.ts` to `book-content-structure.ts`.
- [ ] 4.2 Rename helper symbols such as `BookIndexPathError`, `parseBookIndexPath`, `validateBookIndexPath`, `getBookIndexNode`, and `updateBookIndexNode` to BookContentStructure names.
- [ ] 4.3 Remove `normalizeLegacyBookIndexValue`, `normalizeLegacyBookIndex`, `migrateLegacyBookIndexIds`, and `readLegacyId` behavior.
- [ ] 4.4 Update `package/server/src/book/book.service.ts`: rename `getChapterIndexByBookUnitId` to `getContentStructureByBookUnitId`.
- [ ] 4.5 Update `package/server/src/book/book.service.ts`: rename `updateChapterIndex` to `updateContentStructure` and persist `nodes`.
- [ ] 4.6 Update `package/server/src/book/book.api.ts`: replace `GET /:unitId/chapterIndex` with `GET /:unitId/content-structure`.
- [ ] 4.7 Update `package/server/src/book/book.api.ts`: replace `PUT /:unitId/chapterIndex` with `PUT /:unitId/content-structure`.
- [ ] 4.8 Update chapter materialization service/API/tests to read and update BookContentStructure paths and timestamps.
- [ ] 4.9 Rename server tests from BookIndex terminology to BookContentStructure terminology and remove legacy `id` normalization expectations.

## 5. API Client

- [ ] 5.1 Update `package/api/src/book/book.api.ts`: rename `getChapterIndex` to `getContentStructure`.
- [ ] 5.2 Update `package/api/src/book/book.api.ts`: rename `updateChapterIndex` to `updateContentStructure` and call `/content-structure`.
- [ ] 5.3 Update `package/api/src/book/book.keys.ts`: rename `chapterIndex` key builder to `contentStructure`.
- [ ] 5.4 Update `package/api/src/book/book.queries.ts`: rename `bookChapterIndexQuery` to `bookContentStructureQuery` and export it as `bookQueries.contentStructure`.
- [ ] 5.5 Update `package/api/src/book/book.mutations.ts` and `package/api/src/chapter/chapter.mutations.ts` invalidation keys to use `bookKeys.contentStructure`.
- [ ] 5.6 Update `package/api/src/book/book.ts` exports to remove old chapterIndex aliases.

## 6. Frontend App Callsite Migration

- [ ] 6.1 Replace `bookQueries.chapterIndex(...)` callsites in `package/app/src/book-read`, `package/app/src/book-edit`, and `package/app/src/book-library` with `bookQueries.contentStructure(...)`.
- [ ] 6.2 Replace imports of `bookChapterIndexQuery` with `bookContentStructureQuery`.
- [ ] 6.3 Rename local variables that hold the content structure from `chapterIndex`/`bookIndex` to `contentStructure`.
- [ ] 6.4 Update JSON export filenames and labels that currently say `chapterIndex`.
- [ ] 6.5 Keep reader-local ordinal fields such as `package/folio/src/** chapterIndex: number` unchanged unless they refer to the API response.

## 7. Compatibility Cleanup

- [ ] 7.1 Remove backward-compatible aliases from `package/app/src/book-library/index.ts`.
- [ ] 7.2 Remove `BookDiscussionPage = BookCommunityPage` and update route imports to use `BookCommunityPage`.
- [ ] 7.3 Remove `ChapterListContainer` legacy export from `package/app/src/book-library/components/Chapter/ChapterList.tsx`.
- [ ] 7.4 Run `rg -n "Backward compatible|Backward-compatible|backward compatibility|legacy|deprecated|compat" package -g '!**/dist/**'` and remove remaining internal development-stage compatibility shims introduced by old project names or old internal APIs.
- [ ] 7.5 Leave compatibility language that refers to external protocols, third-party packages, or historical archived OpenSpec changes unless it is an active internal shim.

## 8. Verification

- [ ] 8.1 Run `rg -n "\\b(BookIndex|bookIndex|book-index|chapterIndex|ChapterIndex)\\b" package/contract package/server package/api package/app openspec/specs -g '!**/dist/**'` and confirm remaining matches are intentional reader-position or historical exceptions.
- [ ] 8.2 Run targeted server tests for book content-structure helpers and chapter materialization.
- [ ] 8.3 Run targeted API/app type checks or tests for changed query exports and callsites.
- [ ] 8.4 Run `openspec status --change rename-book-content-structure` and confirm artifacts remain valid.
