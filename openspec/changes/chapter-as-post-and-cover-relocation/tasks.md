## 1. Contract layer (`package/contract`)

- [ ] 1.1 Add `unitTranslationExtraSchema` (Typebox) in a new module (e.g., `package/contract/src/unit-translation.ts`) exporting the schema and its inferred TS type with `coverUrl: t.Optional(t.String({ format: 'uri' }))`; re-export from `package/contract/src/index.ts`.
- [ ] 1.2 Update `PostKind` Typebox/enum export to include `CHAPTER` alongside `REVIEW`, `EXCERPT`, `REMARK`, `POST`.
- [ ] 1.3 Update `postDTOSchema` / `createPostInputSchema` to allow `kind = "CHAPTER"`.
- [ ] 1.4 Update `chapter.ts` contract to source `content` from `Post.body` semantics and `coverUrl` from the new extras schema; drop any reference to `UnitTranslation.description` as the body source in type docs or helper comments.
- [ ] 1.5 Remove `coverUrl` from `Book` / `Game` / `Media` / `Shelf` input schemas (create/update) if it existed as a direct field; add a cover-setter path that writes to the translation's `extra`.
- [ ] 1.6 Ensure DTO outputs (`BookDTO`, `GameDTO`, `MediaDTO`, `ShelfDTO`, `ChapterDTO`) still expose a flat `coverUrl` field — the contract layer just points at the new source.
- [ ] 1.7 Run `bun tsc --noEmit` inside `package/contract` to verify.

## 2. Prisma schema (`package/server/prisma/schema.prisma`)

- [ ] 2.1 Remove `CHAPTER` from the `UnitType` enum.
- [ ] 2.2 Add `CHAPTER` to the `PostKind` enum.
- [ ] 2.3 Remove `coverUrl` column from `Book`, `Game`, `Media`, and `Shelf` models.
- [ ] 2.4 Run `bun run prisma:generate` (in `package/server`) and verify the generated client reflects the changes.

## 3. Data migration (Prisma migration + SQL)

- [ ] 3.1 Create a new Prisma migration directory (`bun run prisma:migrate` with the intended migration name) and edit its SQL so ordering matches `design.md` migration plan.
- [ ] 3.2 Migration step A: `INSERT INTO "Post" (unitId, authorUserId, targetUnitId, kind, kindKey, body, ...)` for every `Unit` where `type = 'CHAPTER'`, resolving body from the fallback-chain translation's `description`.
- [ ] 3.3 Migration step B: `UPDATE "Unit" SET type = 'POST', workUnitId = NULL WHERE type = 'CHAPTER'`.
- [ ] 3.4 Migration step C: `UPDATE "UnitTranslation" SET description = NULL` for migrated chapter units (optional but recommended — retain comment in SQL if kept).
- [ ] 3.5 Migration step D: for each of Book / Game / Media / Shelf, copy `coverUrl` into `UnitTranslation.extra` (`jsonb_set(coalesce(extra, '{}'::jsonb), '{coverUrl}', to_jsonb(coverUrl))`) for every translation of the unit. Create a translation row (using `defaultLanguage`, falling back to `'en'`) if none exists.
- [ ] 3.6 Migration step E: `ALTER TABLE ... DROP COLUMN "coverUrl"` for Book, Game, Media, Shelf.
- [ ] 3.7 Migration step F: alter the `UnitType` enum to remove `CHAPTER` (Postgres requires creating a new enum type, casting, and renaming — include the full SQL).
- [ ] 3.8 Add a verification block to the migration (as a transaction that raises if counts don't match) covering the checklist in `design.md`.

## 4. Server — chapter domain (`package/server/src/chapter/`)

- [ ] 4.1 Rewrite `chapter.service.ts` to delegate list/get/create/update/delete to the post service with `kind = 'CHAPTER'`, `targetUnitId = <book>` filters; do not read/write `Unit.type = 'CHAPTER'` anywhere.
- [ ] 4.2 Update `chapter/types.ts` to remove the `Unit(type=CHAPTER)` assumption; use Post include shape.
- [ ] 4.3 Update `chapter/mapper.ts` to map from a Post row + UnitTranslation (title) + UnitTranslation.extra (coverUrl) to `ChapterListItemDTO` / `ChapterDetailDTO`.
- [ ] 4.4 Update `chapter.api.ts` request handlers to use the rewritten service; keep route shapes unchanged.
- [ ] 4.5 Add input validation: `targetUnitId` on chapter create MUST resolve to a `Unit(type=BOOK)` — reject otherwise.

## 5. Server — book / media / game / shelf mappers

- [ ] 5.1 Update `book.service.ts` / `book.mapper.ts` (or equivalent) to resolve `coverUrl` via `UnitTranslation.extra` using the translation resolution chain.
- [ ] 5.2 Update `media` service + mapper analogously.
- [ ] 5.3 Update `game` service + mapper analogously.
- [ ] 5.4 Update `shelf.service.ts` to resolve `coverUrl` from translation extras.
- [ ] 5.5 Ensure create / update APIs accept a `coverUrl` on the DTO and persist it via `UnitTranslation.extra` (writing to the appropriate translation row — default language if only one is being written).
- [ ] 5.6 Grep for `book.coverUrl`, `media.coverUrl`, `shelf.coverUrl`, `game.coverUrl` references in `package/server/src` and eliminate any that read the now-removed column.

## 6. Server — BookIndex compatibility

- [ ] 6.1 Verify `book.service.ts` `getChapterIndexByBookUnitId` and `/:unitId/chapterIndex` PUT still function when referenced chapters are `Post(kind=CHAPTER)` (no code change expected, but confirm that JSON references to `chapterUnitId` are still satisfied by the migrated unit IDs).
- [ ] 6.2 If `BookIndex.index` emitter stores denormalized chapter titles, update it to read from the new source.

## 7. Server — post domain (`package/server/src/post/`)

- [ ] 7.1 Teach `post.service` create / update flows to accept `kind = 'CHAPTER'` and validate that `targetUnitId` points at a `Unit(type=BOOK)`.
- [ ] 7.2 Ensure post list endpoints filterable by kind correctly handle `CHAPTER`.

## 8. Server — seed (`package/server/prisma/seed/mocks/`)

- [ ] 8.1 Update `books.ts` (and friends) so every book mock emits `UnitTranslation.extra.coverUrl` instead of `Book.coverUrl`.
- [ ] 8.2 Update media / game / shelf seed mocks likewise.
- [ ] 8.3 Update chapter seed mocks to create `Unit(type=POST)` + `Post(kind=CHAPTER)` rows with `targetUnitId = <book>`; drop the `Unit(type=CHAPTER)` creation path.
- [ ] 8.4 Verify `seed.ts`, `engagement.ts`, `posts.ts`, `config.ts`, `types.ts` reflect the new shapes and that `// MOCK:` comments remain where placeholder logic persists.
- [ ] 8.5 Run `bun run seed` against a clean dev DB and verify no errors and counts are sensible.

## 9. API client (`package/api`)

- [ ] 9.1 Update `book.queries.ts`, `book.keys.ts`, `book.mutations.ts`, `book.api.ts` to match new DTO surface (the flat `coverUrl` field is unchanged from the client's perspective, but input shapes for create/update may have shifted).
- [ ] 9.2 Update chapter query/mutation hooks to match the refactored chapter endpoints.
- [ ] 9.3 Update media / game / shelf query hooks if their cover-setter surface shifted.
- [ ] 9.4 Run `bun tsc --noEmit` inside `package/api`.

## 10. Frontend — `package/app`

- [ ] 10.1 Grep `package/app` for `UnitType.CHAPTER` / `type === 'CHAPTER'` references and replace with `PostKind.CHAPTER` / `kind === 'CHAPTER'` filters.
- [ ] 10.2 Update chapter components (`ChapterList`, `LinearChapterList`, `ChapterTreeJsonEditor`, `ChapterListPage`, `ChapterPage`) to consume the new Post-backed DTO shape.
- [ ] 10.3 Verify book / media / shelf / game card + cover components still render `coverUrl` correctly after the backend move.
- [ ] 10.4 Run `bun tsc --noEmit` inside `package/app`.

## 11. Frontend — `package/admin`

- [ ] 11.1 Grep for `CHAPTER` unit-type references and convert to post/kind-based filters.
- [ ] 11.2 If admin surface has cover-editing forms for book / media / shelf / game, update them to write cover via translation extras rather than the extension column.
- [ ] 11.3 Run `bun tsc --noEmit` inside `package/admin`.

## 12. URL routing

- [ ] 12.1 Decide the chapter URL pattern (`/chapter/:id` vs `/book/:bookId/chapter/:id`) and update `buildUrl` accordingly to route `PostKind.CHAPTER` there.
- [ ] 12.2 Update any TanStack Router route tree entries that previously routed by `UnitType.CHAPTER`.

## 13. Search index (`@rezics/search`)

- [ ] 13.1 Update indexer code if it hard-coded `type === 'CHAPTER'` as a document type discriminator; shift to `type === 'POST' && kind === 'CHAPTER'`.
- [ ] 13.2 Add a reindex step to the deploy runbook (or to `bun run seed` where applicable) that drops and rebuilds chapter-bearing indices.

## 14. Validation

- [ ] 14.1 `bun tsc --noEmit` per package (`package/contract`, `package/server`, `package/api`, `package/app`, `package/admin`, `package/ui` if touched) and resolve any cross-package alias residue per project conventions.
- [ ] 14.2 `bun test` in `package/server` (spot-check chapter, book, post domain tests).
- [ ] 14.3 Start the dev server (`bun run dev`), create a book, add a chapter with cover, verify list + detail + BookIndex TOC all render.
- [ ] 14.4 Edit a book's cover URL via the new translation-extras path and verify it renders on the book card and detail view.
- [ ] 14.5 `bun run check:convention` and fix any route/folder drift surfaced by the pre-commit gate.
- [ ] 14.6 `bun run knip` at the repo root to catch dangling exports after the chapter-domain trim.

## 15. OpenSpec bookkeeping

- [ ] 15.1 Verify `openspec status --change chapter-as-post-and-cover-relocation` is green before opening a PR.
- [ ] 15.2 After merge + successful deploy, run `/opsx:archive chapter-as-post-and-cover-relocation` to retire the change.
