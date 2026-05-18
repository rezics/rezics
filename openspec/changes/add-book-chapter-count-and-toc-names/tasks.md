## 1. Schema and Migration

- [ ] 1.1 In `package/server/prisma/schema.prisma`, add `chapterCount Int @default(0)` to `Book` near `textLength` / `pageCount`.
- [ ] 1.2 Rename the live Prisma inverse relation `Unit.chapterIndexNodes` to a `contentStructureNodes`-style name without changing table/column semantics.
- [ ] 1.3 Create a Prisma migration that adds `Book.chapterCount` with default `0`.
- [ ] 1.4 Add migration SQL/backfill logic that sets `Book.chapterCount` from `BookContentStructureNode` rows where `noContent = false`, grouped by `bookUnitId`.
- [ ] 1.5 Run `bun --filter=@rezics/server run prisma:generate` and confirm generated client types expose `Book.chapterCount` and the renamed inverse relation.

## 2. Server Synchronization

- [ ] 2.1 Update book creation in `package/server/src/book/book.service.ts` so new books start with `chapterCount = 0`.
- [ ] 2.2 Add a small server helper for counting readable `ChapterTreeItem` / submitted content-structure nodes using `noContent !== true`.
- [ ] 2.3 Update `updateBookContentStructure` to write the recomputed `Book.chapterCount` inside the same transaction as node mutations and container `updatedAt`.
- [ ] 2.4 Confirm materialization paths in `package/server/src/chapter/chapter.service.ts` do not update `chapterCount` when they only assign `chapterUnitId`.
- [ ] 2.5 Update factory and seed paths in `package/server/prisma/factory/books.ts` so generated books have accurate `chapterCount` after node rows are inserted.
- [ ] 2.6 Add/update server tests for new book default `0`, TOC save recomputation, `noContent` toggles, repeated `chapterUnitId` rows, and materialization not changing count.

## 3. Contract and API

- [ ] 3.1 Add optional `chapterCount` to `bookDTOSchema` / `BookDTO` in `package/contract/src/book.ts`.
- [ ] 3.2 Add `chapterCount` to create/update schemas only if editing the cache directly is intentionally supported; otherwise keep it read-only in DTO output.
- [ ] 3.3 Rename the shared tree item type from `ChapterTreeItem` to `BookContentStructureItem`, keeping a temporary type alias only if needed for a clear internal cutover.
- [ ] 3.4 Update `BookContentStructureResponse.nodes`, API client types, mutation types, and imports in `package/api` to use the new content-structure item name.
- [ ] 3.5 Run a repo-wide grep for `ChapterTreeItem`, `BookIndex`, `chapterIndex`, and `chapterIndexNodes`; update live source references that fall under this change and leave archived docs untouched.

## 4. Frontend Naming and Display

- [ ] 4.1 Rename app-side content-structure UI/editor concepts from `ChapterTree*` to `BookToc*` / `Toc*` where they represent the whole table of contents.
- [ ] 4.2 Keep model/API helpers using `BookContentStructure` names, including path encode/decode and occurrence helpers.
- [ ] 4.3 Update book detail hero brief text in `package/app/src/book-library/sections/BookHeroSection.tsx` to include localized chapter count when available.
- [ ] 4.4 Update `package/app/src/book-library/components/BookDetail/MetadataPanel.tsx` to show localized chapter count as metadata.
- [ ] 4.5 Do not add chapter count to `BookHeroStatCards`; keep it out of linked social/association stat cards.
- [ ] 4.6 Update stories/tests/imports affected by TOC component renames.

## 5. Validation

- [ ] 5.1 Run targeted server tests for book content structure and chapter materialization.
- [ ] 5.2 Run targeted app/component type checks or package checks covering renamed frontend imports.
- [ ] 5.3 Run `bun run check:convention`.
- [ ] 5.4 Run `bun run format:check`.
- [ ] 5.5 Run `openspec validate add-book-chapter-count-and-toc-names --strict`.
