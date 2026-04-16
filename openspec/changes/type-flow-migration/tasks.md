## 1. Contract: Typed Json Field Schemas

- [ ] 1.1 Define `postExtraSchema` in `package/contract/src/post.ts` with `{ rating?: number, title?: string, book?: { id: string, title: string } }` and apply it to the PostDTO `extra` field
- [ ] 1.2 Define `shelfExtraSchema` in `package/contract/src/shelf.ts` with `{ viewMode?: string }` and apply it to the ShelfDTO `extra` field
- [ ] 1.3 Define `bookExtraSchema` in `package/contract/src/book.ts` with `{ publishURL?: string }` and apply it to the BookDTO `extra` field
- [ ] 1.4 Define `bookIndexNodeSchema` in `package/contract/src/book.ts` describing the chapter tree node shape, and apply it to the BookIndex `index` field
- [ ] 1.5 Define `scoreDistributionSchema` (`Record<string, number>`) and `scoreFieldsEntrySchema` (`Record<string, number>`) in `package/contract/src/score.ts` and apply to ScoreAggregate/ScoreEntry DTOs
- [ ] 1.6 Define `apiTokenScopesSchema` (`Record<string, string[]>`) in the relevant contract file and apply to ApiToken DTO
- [ ] 1.7 Ensure all unconsumed Json fields (`UnitTranslation.extra`, `Game.extra`, `Media.extra`, `Link.extra`, `ShelfItem.extra`, `Realm.extra`, `Person.extra`, `Organization.extra`) use `t.Optional(t.Any())` in their contract schemas
- [ ] 1.8 Remove `QuoteDTO` export from contract if it exists, or confirm it is already absent. Grep for `QuoteDTO` across `package/contract/src/`

## 2. Contract: Align DTO Shapes with Prisma Output

- [ ] 2.1 Audit `UnitDTO` in `package/contract/src/unit.ts`: ensure fields match Prisma `Unit` model + included relations. `language` fields keep the `Language` literal union. `extra` uses `t.Optional(t.Nullable(t.Record(t.String(), t.Any())))` unless domain-specific schema exists
- [ ] 2.2 Audit `BookDTO` in `package/contract/src/book.ts`: ensure fields match Prisma `Book` model output
- [ ] 2.3 Audit `ShelfDTO`, `ShelfItemDTO` in `package/contract/src/shelf.ts`: ensure fields match Prisma output
- [ ] 2.4 Audit `RealmDTO` in `package/contract/src/realm.ts`: ensure fields match Prisma output
- [ ] 2.5 Audit `PostDTO` in `package/contract/src/post.ts`: ensure fields match Prisma output
- [ ] 2.6 Verify contract changes compile: run `cd package/contract && bunx tsc --noEmit`

## 3. Server: Replace sanitizeUser with Prisma Select

- [ ] 3.1 Define `publicUserSelect` in `package/server/src/utils/sanitizeUser.ts` (or a shared types file) as a `Prisma.UserSelect` that selects only `PublicUser` fields: `{ unitId, name, slug, avatar, bio, description, followersCount, followingsCount }`
- [ ] 3.2 Update `unitInclude` in `package/server/src/unit/types.ts` to use `user: { select: publicUserSelect }` instead of `user: true`
- [ ] 3.3 Update all other domain `include` constants (`shelf/types.ts`, `book/types.ts`, `realm/types.ts`, `post/types.ts`, etc.) to use `user: { select: publicUserSelect }`
- [ ] 3.4 Remove `sanitizeUser()` calls from all server mappers — the Prisma select already returns the correct shape
- [ ] 3.5 Verify the returned `user` object shape matches `PublicUser` contract schema without casts

## 4. Server: Remove Domain Mappers

- [ ] 4.1 Remove or simplify `package/server/src/unit/mapper.ts` — route handlers return Prisma query results directly (with `as Language` for language fields where needed, and `as UnitDTO` only if structurally necessary)
- [ ] 4.2 Remove or simplify `package/server/src/book/mapper.ts` — same pattern
- [ ] 4.3 Remove or simplify `package/server/src/realm/realm.mapper.ts` — same pattern
- [ ] 4.4 Remove or simplify `package/server/src/link/link.mapper.ts` — same pattern
- [ ] 4.5 Remove or simplify `package/server/src/shelf/shelf.mapper.ts` — same pattern
- [ ] 4.6 Update all route handlers (`*.api.ts`) that call removed mapper functions to return Prisma results directly
- [ ] 4.7 Verify: `cd package/server && bunx tsc --noEmit` — no errors in mapper-related files

## 5. Server: Fix Elysia status() Pattern

- [ ] 5.1 In `package/server/src/user/api/user.admin.api.ts`: destructure `status` from context, change `response` to `{ 200: successSchema, 403: t.String() }` format for all handlers
- [ ] 5.2 In `package/server/src/user/api/user.core.api.ts`: same pattern
- [ ] 5.3 In `package/server/src/stats/stats.admin.api.ts`: same pattern
- [ ] 5.4 In `package/server/src/jwt/jwt.admin.api.ts`: same pattern for all 6 handlers
- [ ] 5.5 In `package/server/src/chapter/chapter.api.ts`: same pattern, also fix handlers that use explicit return type annotations — remove annotations and let Elysia infer
- [ ] 5.6 Remove `import { status } from "elysia"` from all files where `status` is now destructured from context
- [ ] 5.7 Verify: `cd package/server && bunx tsc --noEmit` — no `InlineHandler` or `ElysiaCustomStatusResponse` errors

## 6. Server: Fix Meilisearch Pagination

- [ ] 6.1 In `package/server/src/meili/content/content.service.ts`: replace `resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length` with `resp.estimatedTotalHits ?? resp.hits.length`
- [ ] 6.2 In `package/server/src/meili/post/post.service.ts`: same fix
- [ ] 6.3 In `package/server/src/meili/realm/realm.service.ts`: same fix
- [ ] 6.4 In `package/server/src/meili/user/user.api.ts`: same fix, also remove `type` property access from query (it doesn't exist on the query schema)
- [ ] 6.5 Verify: `cd package/server && bunx tsc --noEmit` — no `totalHits` errors

## 7. Server: Fix Chapter Domain

- [ ] 7.1 In `package/server/src/chapter/types.ts`: remove `Tag` import and `tags` from include (model has no `Tag` relation, uses `UnitTag`)
- [ ] 7.2 In `package/server/src/chapter/chapter.service.ts`: fix all references to `unit.title`, `unit.content`, `unit.tags` — these live in `translations[]` and `unitTags[]` in the Unit model. Update Prisma `where` clauses and `create`/`update` data accordingly
- [ ] 7.3 In `package/server/src/chapter/chapter.api.ts`: fix `metadata` property access — use `extra` instead. Fix return type annotations (remove explicit annotations, let Elysia infer)
- [ ] 7.4 In `package/server/src/chapter/mapper.ts`: update to read `title`/`content` from `translations[0]` instead of top-level unit fields
- [ ] 7.5 Verify: `cd package/server && bunx tsc --noEmit` — no errors in `chapter/` files

## 8. Server: Fix Remaining Type Errors

- [ ] 8.1 In `package/server/src/score/score.service.ts`: fix `FieldsAggregate` cast at lines 145/150 — use `(fields ?? undefined) as Prisma.InputJsonValue | undefined` pattern
- [ ] 8.2 In `package/server/src/session/session.api.test.ts`: fix mock types — use `as Record<string, unknown>` for payload mock, `as any` for provision mock return
- [ ] 8.3 In `package/server/src/tag/tag-context.service.ts`: fix Prisma include chain (tag/realm are Unit relations, not nested models), fix `joinedAt` ordering for RealmMember
- [ ] 8.4 In `package/server/src/tag/tag.api.ts`: remove `identity` from the public tag context route (it's a public endpoint, no auth guard)
- [ ] 8.5 In `package/server/src/user/service/user.service.ts`: fix `avatar`/`bio` in `create()` — use `?? null` instead of `|| undefined` for nullable Prisma fields
- [ ] 8.6 In `package/server/prisma/seed/utils/init-meili-search.ts`: fix `initBookIndex`/`initUnitIndex` — verify method names match current SearchClient API
- [ ] 8.7 Full server verification: `cd package/server && bunx tsc --noEmit` — zero errors (excluding any cross-package path alias issues from other packages)

## 9. App: Fix UnitDTO Property Access

- [ ] 9.1 In `package/app/src/unit/page/UnitPage.tsx`: access `title`, `content` via `translations[0]`, `metadata` via `extra`, `tags` via `extra.tags`
- [ ] 9.2 In `package/app/src/unit/page/UnitsPage.tsx`: access `title`, `content` via `translations[0]`
- [ ] 9.3 In `package/app/src/quote/page/QuotePage.tsx`, `QuoteEditPage.tsx`, `QuoteNewPage.tsx`: fix all `unit.title`, `unit.content`, `unit.metadata` references — use `translations[]` and `extra`
- [ ] 9.4 In `package/app/src/review/component/QuoteExcerptList.tsx`: fix `content` and `metadata` access
- [ ] 9.5 In `package/app/src/i18n/component/WorkReleaseNav.tsx`: fix `title` access
- [ ] 9.6 In `package/app/src/home/section/HomeAuthorSpotlight.tsx`: fix `author` property access
- [ ] 9.7 In `package/app/src/home/section/HomeTagExplore.tsx`: fix tag parameter type (object, not string)
- [ ] 9.8 In `package/app/src/home/section/hooks/hooks.ts`: remove `QuoteDTO` import, fix type casts, remove unused `limit` variable
- [ ] 9.9 In `package/app/src/home/section/TrendingQuoteSection.tsx`: fix error object shape

## 10. App: Fix Remaining Frontend Errors

- [ ] 10.1 In `package/app/src/user/section/ShelvesTabSection.tsx`: fix route `/shelf/$unitId` → `/shelf/$shelfId`
- [ ] 10.2 In `package/app/src/user/page/UserUnitsPage.tsx`: fix `reactionApi.summaryBatch` → `reactionApi.summary`
- [ ] 10.3 In `package/app/src/user/model/handler.test.ts`: remove tests for `establishBusinessSession` and `AUTH_CONTEXT` (exports don't exist)
- [ ] 10.4 In `package/app/src/tag/component/TagWrapper.tsx`: prefix unused params with `_`
- [ ] 10.5 In `package/app/src/tag/page/TagDomain.tsx`: fix `domainId` → `unitId` in filter
- [ ] 10.6 In `package/app/src/tag/component/Edit/TagEdit.test.tsx`, `TagListEdit.test.tsx`, `TagTest.test.tsx`: remove `TagDetailDTO` import (doesn't exist), fix mock function signatures
- [ ] 10.7 In `package/app/src/quote/component/item/QuoteCard.tsx`, `list/HorizontalQuoteCarousel.tsx`: remove `QuoteDTO` import, use `UnitDTO` or appropriate type
- [ ] 10.8 In `package/app/src/realm/component/RealmMemberList.tsx`, `RealmTagManager.tsx`: prefix unused `realmId` param with `_`
- [ ] 10.9 In `package/app/src/shelf/page/ShelfEditPage.tsx`: fix `translations` property in update schema
- [ ] 10.10 In `package/app/src/book-library/`: fix `BookLibPage.tsx` type mismatch, `BookLibSection.tsx` missing `tags`/`textLength` on filter type, `BookDetailSidebar.tsx` i18n key types, `QuoteExcerptPreview.tsx` implicit any
- [ ] 10.11 In `package/app/src/search/component/SearchFilter.tsx`: fix i18n key type
- [ ] 10.12 In `package/app/src/review/component/SingleReview.test.tsx`: fix mock object shape (remove `bookId`, use current PostDTO fields)
- [ ] 10.13 In `package/app/src/book-edit/`: fix `BookMetadataEditor.tsx` i18n key type, `BookEditInfoSection.tsx` type mismatch

## 11. App: Clean Up Type Organization

- [ ] 11.1 Remove empty/unused `model/types.ts` files in `package/app/src/` features (e.g., `home/model/types.ts`)
- [ ] 11.2 Verify all frontend domain types are imported from `@rezics/api`, not directly from `@rezics/contract`
- [ ] 11.3 Full app verification: `cd package/app && bunx tsc --noEmit 2>&1 | grep -v "^\.\.\/"` — zero errors (excluding cross-package UI path alias errors)

## 12. Final Verification

- [ ] 12.1 Run `cd package/contract && bunx tsc --noEmit` — zero errors
- [ ] 12.2 Run `cd package/server && bunx tsc --noEmit` — zero errors
- [ ] 12.3 Run `cd package/api && bunx tsc --noEmit` — zero errors
- [ ] 12.4 Run `cd package/app && bunx tsc --noEmit 2>&1 | grep -v "^\.\.\/"` — zero errors (excluding cross-package UI path alias noise)
- [ ] 12.5 Run `bun test` in `package/server` — all existing tests pass
- [ ] 12.6 Run `bun test` in `package/app` — all existing tests pass
- [ ] 12.7 Start dev server (`bun run app:dev`) and manually verify key pages load without runtime errors: home page, book library, user profile, shelf detail
