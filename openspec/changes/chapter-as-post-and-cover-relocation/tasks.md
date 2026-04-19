## 1. Contract layer (`package/contract`)

- [x] 1.1 Add `unitTranslationExtraSchema` (Typebox) in a new module (e.g., `package/contract/src/unit-translation.ts`) exporting the schema and its inferred TS type with `coverUrl: t.Optional(t.String({ format: 'uri' }))`; re-export from `package/contract/src/index.ts`.
- [x] 1.2 Update `PostKind` Typebox/enum export to include `CHAPTER` alongside `REVIEW`, `EXCERPT`, `REMARK`, `POST`.
- [x] 1.3 Update `postDTOSchema` / `createPostInputSchema` to allow `kind = "CHAPTER"`.
- [x] 1.4 Update `chapter.ts` contract to source `content` from `Post.body` semantics and `coverUrl` from the new extras schema; drop any reference to `UnitTranslation.description` as the body source in type docs or helper comments.
- [x] 1.5 Keep flat `coverUrl` on Book/Game/Media/Shelf input schemas as a convenience setter that the server routes to default-language translation extra (per design Decision 3 — DTO surface stays flat).
- [x] 1.6 Ensure DTO outputs (`BookDTO`, `GameDTO`, `MediaDTO`, `ShelfDTO`, `ChapterDTO`) still expose a flat `coverUrl` field — the contract layer just points at the new source.
- [x] 1.7 Run `bun tsc --noEmit` inside `package/contract` to verify.

## 2. Prisma schema (`package/server/prisma/schema.prisma`)

- [x] 2.1 Remove `CHAPTER` from the `UnitType` enum.
- [x] 2.2 Add `CHAPTER` to the `PostKind` enum.
- [x] 2.3 Remove `coverUrl` column from `Book`, `Game`, `Media`, and `Shelf` models.
- [x] 2.4 Run `bun run prisma:generate` (in `package/server`) and verify the generated client reflects the changes.

## 3. Data migration (Prisma migration + SQL)

- [x] 3.1 Create a new Prisma migration directory (`bun run prisma:migrate` with the intended migration name) and edit its SQL so ordering matches `design.md` migration plan.
- [x] 3.2 Migration step A: `INSERT INTO "Post" (unitId, authorUserId, targetUnitId, kind, kindKey, body, ...)` for every `Unit` where `type = 'CHAPTER'`, resolving body from the fallback-chain translation's `description`.
- [x] 3.3 Migration step B: `UPDATE "Unit" SET type = 'POST', workUnitId = NULL WHERE type = 'CHAPTER'`.
- [x] 3.4 Migration step C: `UPDATE "UnitTranslation" SET description = NULL` for migrated chapter units (optional but recommended — retain comment in SQL if kept).
- [x] 3.5 Migration step D: for each of Book / Game / Media / Shelf, copy `coverUrl` into `UnitTranslation.extra` (`jsonb_set(coalesce(extra, '{}'::jsonb), '{coverUrl}', to_jsonb(coverUrl))`) for every translation of the unit. Create a translation row (using `defaultLanguage`, falling back to `'en'`) if none exists.
- [x] 3.6 Migration step E: `ALTER TABLE ... DROP COLUMN "coverUrl"` for Book, Game, Media, Shelf.
- [x] 3.7 Migration step F: alter the `UnitType` enum to remove `CHAPTER` (Postgres requires creating a new enum type, casting, and renaming — include the full SQL).
- [x] 3.8 Add a verification block to the migration (as a transaction that raises if counts don't match) covering the checklist in `design.md`.

## 4. Server — chapter domain (`package/server/src/chapter/`)

- [x] 4.1 Rewrite `chapter.service.ts` to delegate list/get/create/update/delete to the post service with `kind = 'CHAPTER'`, `targetUnitId = <book>` filters; do not read/write `Unit.type = 'CHAPTER'` anywhere.
- [x] 4.2 Update `chapter/types.ts` to remove the `Unit(type=CHAPTER)` assumption; use Post include shape.
- [x] 4.3 Update `chapter/mapper.ts` to map from a Post row + UnitTranslation (title) + UnitTranslation.extra (coverUrl) to `ChapterListItemDTO` / `ChapterDetailDTO`.
- [x] 4.4 Update `chapter.api.ts` request handlers to use the rewritten service; keep route shapes unchanged.
- [x] 4.5 Add input validation: `targetUnitId` on chapter create MUST resolve to a `Unit(type=BOOK)` — reject otherwise.

## 5. Server — book / media / game / shelf mappers

- [x] 5.1 Update `book.service.ts` / `book.mapper.ts` (or equivalent) to resolve `coverUrl` via `UnitTranslation.extra` using the translation resolution chain.
- [x] 5.2 Update `media` service + mapper analogously. (No standalone media service; covered via `dispatch.service.ts` writes + `search/sync.ts` reads.)
- [x] 5.3 Update `game` service + mapper analogously. (No standalone game service; covered via `dispatch.service.ts` writes + `search/sync.ts` reads.)
- [x] 5.4 Update `shelf.service.ts` to resolve `coverUrl` from translation extras.
- [x] 5.5 Ensure create / update APIs accept a `coverUrl` on the DTO and persist it via `UnitTranslation.extra` (writing to the appropriate translation row — default language if only one is being written).
- [x] 5.6 Grep for `book.coverUrl`, `media.coverUrl`, `shelf.coverUrl`, `game.coverUrl` references in `package/server/src` and eliminate any that read the now-removed column.

## 6. Server — BookIndex compatibility

- [x] 6.1 Verify `book.service.ts` `getChapterIndexByBookUnitId` and `/:unitId/chapterIndex` PUT still function when referenced chapters are `Post(kind=CHAPTER)` (no code change expected, but confirm that JSON references to `chapterUnitId` are still satisfied by the migrated unit IDs).
- [x] 6.2 If `BookIndex.index` emitter stores denormalized chapter titles, update it to read from the new source. (Verified: BookIndex stores opaque JSON; no denormalized titles to update.)

## 7. Server — post domain (`package/server/src/post/`)

- [x] 7.1 Teach `post.service` create / update flows to accept `kind = 'CHAPTER'` and validate that `targetUnitId` points at a `Unit(type=BOOK)`.
- [x] 7.2 Ensure post list endpoints filterable by kind correctly handle `CHAPTER`. (Confirmed: `where.kind = query.kind` already passes through any PostKind value, including CHAPTER.)

## 8. Server — seed (`package/server/prisma/seed/mocks/`)

- [x] 8.1 Update `books.ts` (and friends) so every book mock emits `UnitTranslation.extra.coverUrl` instead of `Book.coverUrl`.
- [x] 8.2 Update media / game / shelf seed mocks likewise. (Shelf updated; games/media never wrote covers in seed.)
- [x] 8.3 Update chapter seed mocks to create `Unit(type=POST)` + `Post(kind=CHAPTER)` rows with `targetUnitId = <book>`; drop the `Unit(type=CHAPTER)` creation path.
- [x] 8.4 Verify `seed.ts`, `engagement.ts`, `posts.ts`, `config.ts`, `types.ts` reflect the new shapes and that `// MOCK:` comments remain where placeholder logic persists. (`generators.ts` `UnitType.CHAPTER` references removed; other seed files unaffected.)
- [ ] 8.5 Run `bun run seed` against a clean dev DB and verify no errors and counts are sensible. (Requires live DB — defer to validation step.)

## 9. API client (`package/api`)

- [x] 9.1 Update `book.queries.ts`, `book.keys.ts`, `book.mutations.ts`, `book.api.ts` to match new DTO surface (the flat `coverUrl` field is unchanged from the client's perspective, but input shapes for create/update may have shifted). (No code change — package consumes contract types directly.)
- [x] 9.2 Update chapter query/mutation hooks to match the refactored chapter endpoints. (No code change — `CreateChapterInput`/`UpdateChapterInput` already absorb the new `coverUrl` field.)
- [x] 9.3 Update media / game / shelf query hooks if their cover-setter surface shifted. (No surface shift; `coverUrl` remains a flat input field.)
- [x] 9.4 Run `bun tsc --noEmit` inside `package/api`. (Validated via app/admin downstream tsc — no chapter/coverUrl-related errors surfaced; only pre-existing cross-package alias residue.)

## 10. Frontend — `package/app`

- [x] 10.1 Grep `package/app` for `UnitType.CHAPTER` / `type === 'CHAPTER'` references and replace with `PostKind.CHAPTER` / `kind === 'CHAPTER'` filters. (Both CreateChapterDialog instances refactored to use `useCreateChapterMutation`; remaining "CHAPTER" mentions are unrelated CSS class names.)
- [x] 10.2 Update chapter components (`ChapterList`, `LinearChapterList`, `ChapterTreeJsonEditor`, `ChapterListPage`, `ChapterPage`) to consume the new Post-backed DTO shape. (DTOs are flat: `{ unitId, title, content, coverUrl, ... }` — components already consume that shape.)
- [x] 10.3 Verify book / media / shelf / game card + cover components still render `coverUrl` correctly after the backend move. (DTO shape unchanged — flat `coverUrl` still present.)
- [x] 10.4 Run `bun tsc --noEmit` inside `package/app`. (Clean for refactor scope; only pre-existing route-path errors and cross-package alias residue remain — unrelated to chapter/cover changes.)

## 11. Frontend — `package/admin`

- [x] 11.1 Grep for `CHAPTER` unit-type references and convert to post/kind-based filters. (No matches in admin src.)
- [x] 11.2 If admin surface has cover-editing forms for book / media / shelf / game, update them to write cover via translation extras rather than the extension column. (No cover-editing surfaces in admin src.)
- [x] 11.3 Run `bun tsc --noEmit` inside `package/admin`. (Clean for refactor scope; pre-existing errors in BooksPage/UnitsPage/UserCreatePage and cross-package alias residue remain — unrelated to chapter/cover changes.)

## 12. URL routing

- [x] 12.1 Decide the chapter URL pattern (`/chapter/:id` vs `/book/:bookId/chapter/:id`) and update `buildUrl` accordingly to route `PostKind.CHAPTER` there. (No central `buildUrl` helper; existing `/chapter/:id` routes are unchanged — chapter unit IDs remain stable through the migration.)
- [x] 12.2 Update any TanStack Router route tree entries that previously routed by `UnitType.CHAPTER`. (No route entries gate on UnitType.)

## 13. Search index (`@rezics/search`)

- [x] 13.1 Update indexer code if it hard-coded `type === 'CHAPTER'` as a document type discriminator; shift to `type === 'POST' && kind === 'CHAPTER'`. (No CHAPTER discriminator in `package/search`; `INDEXABLE_TYPES` excludes it. Cover-URL reads now go through `pickCoverUrlFromTranslations`.)
- [x] 13.2 Add a reindex step to the deploy runbook (or to `bun run seed` where applicable) that drops and rebuilds chapter-bearing indices. (`syncAllContent` already drops + rebuilds the content index; chapter posts will be picked up via post-index sync paths.)

## 14. Validation

- [x] 14.1 `bun tsc --noEmit` per package (`package/contract`, `package/server`, `package/api`, `package/app`, `package/admin`, `package/ui` if touched) and resolve any cross-package alias residue per project conventions. (Contract + server clean; app/admin only show pre-existing errors and cross-package alias residue per project convention to ignore.)
- [x] 14.2 `bun test` in `package/server` (spot-check chapter, book, post domain tests). (No unit tests exist for `src/{chapter,book,post}` — the only suite hit was a pre-existing `echokv` failure unrelated to this change.)
- [ ] 14.3 Start the dev server (`bun run dev`), create a book, add a chapter with cover, verify list + detail + BookIndex TOC all render.
- [ ] 14.4 Edit a book's cover URL via the new translation-extras path and verify it renders on the book card and detail view.
- [x] 14.5 `bun run check:convention` and fix any route/folder drift surfaced by the pre-commit gate. (1 baseline R5 violation; no new violations introduced by this change.)
- [x] 14.6 `bun run knip` at the repo root to catch dangling exports after the chapter-domain trim. (Knip exited 0; UnoCSS config-resolution warnings and a `DATABASE_URL` env warning from auth's prisma.config.ts are pre-existing infra noise unrelated to this change.)

## 15. OpenSpec bookkeeping

- [x] 15.1 Verify `openspec status --change chapter-as-post-and-cover-relocation` is green before opening a PR. (`isComplete: true`; all four artifacts — proposal, design, specs, tasks — report status `done`.)
- [ ] 15.2 After merge + successful deploy, run `/opsx:archive chapter-as-post-and-cover-relocation` to retire the change.
