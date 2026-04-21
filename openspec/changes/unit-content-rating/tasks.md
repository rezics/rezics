## 1. Schema & Prisma

- [ ] 1.1 In `package/server/prisma/schema.prisma`, add `enum ContentRating { GENERAL R_15 R_18 R_18G }`.
- [ ] 1.2 Replace `Unit.nsfw Boolean @default(false)` with `rating ContentRating @default(GENERAL)`.
- [ ] 1.3 Remove any `nsfw` references or index declarations on Unit; add `@@index([rating])` if and only if searches outside the Meili index need it (otherwise skip).
- [ ] 1.4 Run `bun run prisma:migrate` in `package/server` to create the migration. Confirm the migration drops `nsfw` and adds `rating` with the enum.
- [ ] 1.5 Regenerate Prisma client via `bun run prisma:generate`; verify `package/server/prisma/generated/` no longer references `nsfw`.

## 2. Contract types (`@rezics/contract`)

- [ ] 2.1 In `package/contract/src/unit.ts`, export `ContentRating` constant object and `contentRatingSchema` Typebox union (`t.Union([t.Literal("GENERAL"), t.Literal("R_15"), t.Literal("R_18"), t.Literal("R_18G")])`).
- [ ] 2.2 Remove `nsfw` from `baseUnitSchema`, `unitListQuerySchema`, `unitListBodySchema`, `createUnitSchema`, `updateUnitSchema`.
- [ ] 2.3 Add `rating: t.Optional(contentRatingSchema)` to the same schemas where `nsfw` was present; update `BaseUnit` / `UnitDTO` / `CreateUnitInput` / `UpdateUnitInput` types accordingly.
- [ ] 2.4 In `package/contract/src/book.ts`, remove `nsfw` from `createBookSchema` and `updateBookSchema`; add `rating`.
- [ ] 2.5 In `package/contract/src/book.ts`, extend `bookIndexNodeSchema` with `rating: t.Optional(contentRatingSchema)` (optional field on each node). Update `ChapterTreeItem` TS interface.
- [ ] 2.6 In `package/contract/src/meili/content.ts`, replace `nsfw: t.Boolean()` in `ContentSearchDocumentSchema` with `rating: contentRatingSchema`.
- [ ] 2.7 In `package/contract/src/meili/content.ts`, replace `nsfw: t.Optional(t.Boolean())` in `ContentSearchOptionsSchema` with `ratings: t.Optional(t.Array(contentRatingSchema))`.
- [ ] 2.8 In `package/contract/src/zone.ts`, replace `nsfw` in `ZoneFilters` with `ratings: t.Optional(t.Array(contentRatingSchema))`. Ensure `keyword`, `sort`, `offset`, `limit`, and `nsfw` remain absent.
- [ ] 2.9 In `package/contract/src/search.ts`, update any `SearchQuery` or serializer references from `nsfw` to `ratings`.
- [ ] 2.10 `bun run tsc --noEmit` in `package/contract` passes with zero errors.

## 3. Server domain layer

- [ ] 3.1 In `package/server/src/unit/unit.service.ts`, rename all `nsfw` references to `rating`; accept `rating` in create/update payloads; default to `GENERAL` when omitted on create.
- [ ] 3.2 In `package/server/src/unit/mapper.ts`, update DTO mapping to emit `rating` instead of `nsfw`.
- [ ] 3.3 In `package/server/src/book/book.service.ts` and `package/server/src/book/mapper.ts`, replace `nsfw` with `rating` in create/update/mapping.
- [ ] 3.4 In `package/server/src/chapter/chapter.service.ts` and related mappers, ensure chapter Unit `rating` is readable and writable; no cross-validation against the Book Unit's rating.
- [ ] 3.5 Search filtering: anywhere the server derives a caller's allowed rating set (to intersect with `ContentSearchOptions.ratings`), implement the rule `allowed = {GENERAL, R_15} ∪ (authenticated ? user.settings.content.optedInRatings : [])`. Add helper in `package/server/src/auth/` or `package/server/src/user/` as appropriate (name suggestion: `deriveAllowedRatings(session)`).
- [ ] 3.6 Update content-search endpoint (`package/server/src/meili/content/content.service.ts` or sibling api/route file) to intersect `request.ratings` with the derived allowed set before calling Meilisearch.
- [ ] 3.7 User settings validator: reject updates whose `content.optedInRatings` contains `GENERAL` or `R_15`, or any value outside `{R_18, R_18G}`.
- [ ] 3.8 `bun run tsc --noEmit` in `package/server` passes.
- [ ] 3.9 Targeted tests for unit/book create with `rating`, unit update changing only `rating`, chapter rating independent of book rating.

## 4. Search package (`@rezics/search`)

- [ ] 4.1 In `package/search/src/sync.ts` `buildContentDocument`, replace `nsfw: unit.nsfw ?? false` with `rating: unit.rating ?? "GENERAL"`.
- [ ] 4.2 Ensure `patchContentMetadata(unitId, { rating })` works for partial rating updates; update any sync trigger that previously patched `nsfw` to patch `rating`.
- [ ] 4.3 In `package/search/src/client.ts`, update Meilisearch filterable-attributes configuration: remove `nsfw`, add `rating`. Update any settings init payload.
- [ ] 4.4 Reindex-verification test: seed a Unit with `rating = R_18`, run single sync, assert the indexed document has `rating: "R_18"`.
- [ ] 4.5 `bun run tsc --noEmit` in `package/search` passes.

## 5. Frontend API layer (`@rezics/api`)

- [ ] 5.1 Grep `package/api/**` for `nsfw`; update any request/response shapes that explicitly list fields.
- [ ] 5.2 Export any rating-related type helpers needed by the app.
- [ ] 5.3 `bun run tsc --noEmit` in `package/api` passes.

## 6. Frontend shared UI (`@rezics/ui`)

- [ ] 6.1 Add a `RatingBadge` component that takes a `ContentRating` value and renders a tier label (MUI-themed; uses locale strings).
- [ ] 6.2 Add a `RatingSelector` component (single-select, controlled: `value`, `onChange`) for book/chapter metadata editors.
- [ ] 6.3 Remove any `NsfwToggle` export from `@rezics/ui` (if present there).
- [ ] 6.4 `bun run tsc --noEmit` in `package/ui` passes.

## 7. App search feature (`package/app/src/search/`)

- [ ] 7.1 Remove `NsfwToggle.tsx` from `package/app/src/search/components/primitive/`.
- [ ] 7.2 Create `RatingFilterChips.tsx` primitive (four checkboxes, controlled `value: ContentRating[]`, `onChange`). Respect an `allowed: ContentRating[]` prop that locks disallowed tiers as disabled.
- [ ] 7.3 Update `AdvancedSearch.tsx` to render `RatingFilterChips` in place of `NsfwToggle`; wire via `bind('ratings')`.
- [ ] 7.4 Update `package/app/src/search/hooks/useSearchQuery.ts`: `SearchQuery` gains `ratings?: ContentRating[]`, drops `nsfw`. Update `toContentSearchOptions` to emit `ratings` and intersect with the caller's allowed set.
- [ ] 7.5 Update `package/app/src/search/utils/searchQuery.ts` URL parser/serializer: drop `nsfw`, add `ratings` (comma-separated). Silently ignore legacy `nsfw` URL params on parse.
- [ ] 7.6 Update `package/app/src/search/models/toContentSearchOptions.ts` accordingly.
- [ ] 7.7 Update `AppliedFilterChips.tsx` to show rating chips when rating is narrowed and not rendered by a sibling.
- [ ] 7.8 Update `package/app/src/search/hooks/useSearchQuery.test.ts` and `AppliedFilterChips.test.ts` to use `ratings` instead of `nsfw`.
- [ ] 7.9 Grep `package/app/src/**` for remaining `nsfw` references (including `BookSearch`, `ZoneSearchPage`, `BookLibPage`, `hooks.ts`) and migrate each to `ratings`.
- [ ] 7.10 `bun run tsc --noEmit` in `package/app` passes.

## 8. Book metadata editor

- [ ] 8.1 In `package/app/src/book-edit/components/Metadata/BookMetadataEditor.tsx`, replace any NSFW boolean field with a `RatingSelector` bound to `book.rating` / `unit.rating`.
- [ ] 8.2 In `package/app/src/book-edit/sections/BookEditInfoSection.tsx`, wire the rating field through to the update payload.
- [ ] 8.3 Verify the save path sends `rating` (not `nsfw`) to the update API.

## 9. Chapter editor

- [ ] 9.1 Add a `RatingSelector` to the chapter editor metadata panel.
- [ ] 9.2 On create mode, prefill the selector with the parent Book Unit's `rating`; leave editable.
- [ ] 9.3 Persist `rating` on save; the chapter save path SHALL NOT trigger any book-level resync.

## 10. TOC editor — BookIndex cache & tools

- [ ] 10.1 Implement the write rule in the TOC serializer: when producing each node, include `rating` only if `chapter.rating !== book.rating`.
- [ ] 10.2 Render per-node rating badges in the TOC reader view based on `node.rating` (or its absence, meaning "same as book").
- [ ] 10.3 Add a "Resync index overrides" button to the TOC editor. On click: fetch all chapter Units' current `rating` values, recompute overrides, write the new BookIndex JSON in a single save. Do NOT mutate chapter Units.
- [ ] 10.4 Add multi-select support to the TOC editor chapter list (checkbox per chapter entry).
- [ ] 10.5 Add a "Set rating for selected" bulk-edit action: opens a rating selector, updates each selected chapter Unit's `rating` via the chapter update API, then recomputes the index overrides and saves the BookIndex.
- [ ] 10.6 Verify: after a batch edit, only the selected chapters' ratings changed; unselected chapters are untouched.

## 11. Settings — Preferences page

- [ ] 11.1 In `package/app/src/settings/` (or wherever `settings-preferences` lives), add a "Content rating" section.
- [ ] 11.2 Render four rows: `GENERAL` and `R_15` as locked on; `R_18` and `R_18G` as interactive checkboxes bound to `userSettings.content.optedInRatings`.
- [ ] 11.3 On ticking `R_18` or `R_18G`, open a confirmation modal. Only on explicit confirm, PATCH `userApi.updateSettings()` with the updated `content.optedInRatings` array.
- [ ] 11.4 On unticking, PATCH directly with no modal.
- [ ] 11.5 Locale strings (`zh-hant`, `en`) for the section title, row labels, modal title/body/buttons.

## 12. Derived allowed set in the app

- [ ] 12.1 Add a single source-of-truth selector/hook (e.g., `useAllowedRatings()`) that computes `{GENERAL, R_15} ∪ optedInRatings` (empty opt-ins for unauthenticated).
- [ ] 12.2 Search pages (`/search`, `/book/search`, zone/realm/shelf search) pass the allowed set to `useSearchQuery` as part of `implicitInitial.ratings` default.
- [ ] 12.3 `RatingFilterChips` receives `allowed` prop from the same selector and disables out-of-allowed checkboxes.
- [ ] 12.4 For unauthenticated users, the disabled `R_18` / `R_18G` checkboxes SHALL show a hint prompting sign-in (tooltip or adjacent helper text).

## 13. Zone & admin surface

- [ ] 13.1 Update any zone seed data or admin zone editor to emit `ratings` instead of `nsfw` in `ZoneFilters`.
- [ ] 13.2 Grep `package/admin/**` for `nsfw`; migrate or remove.
- [ ] 13.3 `bun run tsc --noEmit` in `package/admin` passes.

## 14. Locale strings

- [ ] 14.1 In `package/app/src/locale/zh-hant.ts` and `en.ts`, remove `nsfw` keys; add keys for rating tiers (`GENERAL` / `R_15` / `R_18` / `R_18G` labels), rating filter section, rating badge, resync action, batch-edit action, opt-in confirmation modal copy.
- [ ] 14.2 Verify no orphan `nsfw` keys remain.

## 15. Cross-repo cleanup & verification

- [ ] 15.1 `rg -n "nsfw|isNsfw|NSFW"` across the repo returns zero matches outside of archived openspec changes and legacy migration folders.
- [ ] 15.2 `bun run check:convention` passes.
- [ ] 15.3 `bun run knip` shows no new unused exports attributable to this change.
- [ ] 15.4 Run all package tests (`bun test` in each of `package/contract`, `package/server`, `package/search`, `package/app`). All pass.
- [ ] 15.5 Manual smoke test in the dev app: create a Book with `R_15`, create three chapters (one `R_15`, one `R_18`, one `R_18G`), view the TOC (expect badges only on `R_18` and `R_18G`), change book rating to `GENERAL`, click resync (expect badges on all three), multi-select two chapters and batch-edit to `R_15`, sign in and flip R_18 opt-in (expect modal), sign out and confirm default filter masks R_18+ content.
- [ ] 15.6 Search-index verification: trigger full reindex in dev; confirm the Meilisearch content index documents contain `rating` field and no `nsfw` field; `ratings` filter returns correct subsets.
