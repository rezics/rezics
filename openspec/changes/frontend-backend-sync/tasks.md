## 1. Contract Foundation (PostKind + UnitType Cleanup)

- [x] 1.1 Add `PostKind` typed const enum to `package/contract/src/post.ts` with values `REVIEW`, `REMARK`, `QUOTE`, `POST`. Export the type and the const object.
- [x] 1.2 Update `postDTOSchema.kind` from `t.Optional(t.String())` to `t.Optional(t.Nullable(t.Union([t.Literal("REVIEW"), t.Literal("REMARK"), t.Literal("QUOTE"), t.Literal("POST")])))` in `package/contract/src/post.ts`.
- [x] 1.3 Update `createPostSchema.kind` from `t.Optional(t.String())` to `t.Optional(t.Union([...PostKind literals]))` in `package/contract/src/post.ts`.
- [x] 1.3a Add `scoreEntryId: t.Optional(t.Nullable(t.String()))` to `postDTOSchema` in `package/contract/src/post.ts`.
- [x] 1.3b Add `scoreEntryId: t.Optional(t.String())` to `createPostSchema` in `package/contract/src/post.ts`.
- [x] 1.3c Update `mapPostToDTO()` in `package/server/src/post/post.mapper.ts` to include `scoreEntryId: post.scoreEntryId ?? null`.
- [x] 1.3d Update `postService.create()` in `package/server/src/post/post.service.ts` to accept and pass `scoreEntryId` in the `createData` object.
- [x] 1.3e Fix `bookApi.getRating()` in `package/api/src/book/book.api.ts` — replace stale local `Rating` type (lines 17-23) with `ScoreAggregateDTO[]` from `@rezics/contract`. Update `bookRatingQuery` return type in `book.queries.ts`.
- [x] 1.4 Remove `COMMENT` from the `PostKind` Prisma enum in `package/server/prisma/schema.prisma`. Create migration with `bun run prisma:migrate` in `package/server`.
- [x] 1.5 Delete empty contract stubs: `package/contract/src/comment.ts`, `package/contract/src/review.ts`, `package/contract/src/readlist.ts`.
- [x] 1.6 Remove re-exports of deleted stubs from `package/contract/src/index.ts` (remove `export * from "./comment"`, `export * from "./review"` — note: `readlist.ts` was not exported).
- [x] 1.7 Delete dead server domain `package/server/src/comment/` (all files: `comment.api.ts`, `comment.service.ts`, `mapper.ts`, `types.ts`, `sql.ts`, `index.ts`).
- [x] 1.8 Remove comment domain mount from `package/server/src/index.ts` (remove `.use()` for comment routes if present).
- [x] 1.9 Update `package/app/src/shared/util/build-url.ts`: remove `REVIEW` and `READLIST` cases, add `SHELF` → `/shelf/${unit.id}`, update `POST` routing to use kind-based logic.
- [x] 1.10 Fix `package/app/src/user/page/UserUnitsPage.tsx`: remove references to `UnitType.COMMENT`, `UnitType.NOTE`. Replace with PostKind-based filtering or remove dead branches.
- [x] 1.11 Fix `package/app/src/unit/page/UnitsPage.tsx`: remove references to non-existent UnitType values.
- [x] 1.12 Fix `package/app/src/review/page/ReviewsPage.tsx`: replace `UnitType.POST` kind references with `PostKind.REVIEW` / `PostKind.REMARK`.
- [x] 1.13 Grep entire `package/app/src/` for remaining references to `UnitType.COMMENT`, `UnitType.NOTE`, `"REVIEW"` (as UnitType), `"READLIST"` (as UnitType) and fix all occurrences.
- [x] 1.14 Run `bun run build` in `package/contract` and `package/server` to verify compilation. Run `bun run app:dev` to verify frontend compilation with no import errors.

## 2. User Settings Infrastructure

- [x] 2.1 Add `settings Json?` column to the `User` model in `package/server/prisma/schema.prisma`. Run `bun run prisma:migrate` in `package/server`.
- [x] 2.2 Add `UserSettings` type to `package/contract/src/user.ts` defining the settings shape: `realmTagPreferences` (per unit type: `{ realmIds: string[], maxDisplay: number }`), `preferredLanguages` (string array).
- [x] 2.3 Create `package/server/src/user/settings.service.ts` with `getSettings(userId)` and `updateSettings(userId, partial)` (deep-merge update). Validate `realmIds` arrays max length 50.
- [x] 2.4 Add `GET /users/me/settings` and `PUT /users/me/settings` endpoints in `package/server/src/user/` (new file or extend existing user API).
- [x] 2.5 Add `userSettingsQuery()` and `useUpdateSettingsMutation()` hooks in `package/api/src/user/`.
- [x] 2.6 Verify endpoints with manual test: `GET /users/me/settings` returns `{}` for existing users, `PUT` with partial body deep-merges correctly.

## 3. Shelf Migration (readlist → shelf)

- [x] 3.1 Delete `package/app/src/readlist/` directory entirely (all pages, components, index.ts).
- [x] 3.2 Delete readlist route files: `package/app/src/routes/_mainLayout/readlist/` (all 5 route files).
- [x] 3.3 Remove readlist route exports from `package/app/src/router.tsx` (`readlistEditRoute`, `readlistByBookRoute`).
- [x] 3.4 Create `package/app/src/shelf/page/ShelfListPage.tsx` — shelf landing page at `/shelf` using `shelfApi.list()` with curated/trending sections.
- [x] 3.5 Create `package/app/src/shelf/page/ShelfSearchPage.tsx` — shelf search page at `/shelf/search` using `contentSearchQueryOptions({ type: 'SHELF' })` with tag filtering, keyword search, pagination.
- [x] 3.6 Enhance existing `package/app/src/shelf/page/ShelfPage.tsx` — shelf detail with translations[], items, view mode switching (grid/list/review), keywords, ShelfItemReview display.
- [x] 3.7 Create `package/app/src/shelf/page/ShelfEditPage.tsx` — edit shelf metadata (translations), manage items (add/remove/reorder), edit keywords. Uses `shelfApi.update()`, `shelfApi.addItem()`, `shelfApi.removeItem()`, `shelfApi.reorderItems()`.
- [x] 3.8 Create `package/app/src/shelf/page/ShelfByBookPage.tsx` — shelves containing a specific book. Uses `shelfApi.list({ containsItemUnitId: bookId })`.
- [x] 3.9 Create `package/app/src/shelf/page/NewShelfPage.tsx` — create shelf form with title/description (translations), tags. Uses `useCreateShelfMutation()`.
- [x] 3.10 Create `package/app/src/shelf/component/ShelfCard.tsx` — card with title from `getTranslation()`, item count, tags.
- [x] 3.11 Create `package/app/src/shelf/component/ShelfList.tsx` — list/grid display of shelf cards.
- [x] 3.12 Create `package/app/src/shelf/component/SingleShelf.tsx` — full shelf detail view component.
- [x] 3.13 Create `package/app/src/shelf/component/HorizontalShelfCarousel.tsx` — horizontal carousel for homepage/landing use.
- [x] 3.14 Create `package/app/src/shelf/index.ts` — public exports.
- [x] 3.15 Create route files: `package/app/src/routes/_mainLayout/shelf/index.tsx` (landing), `shelf/search.tsx`, `shelf/$shelfId/index.tsx` (detail), `shelf/$shelfId/edit.tsx`, `shelf/new.tsx`, `shelf/book/$bookId.tsx`.
- [x] 3.16 Update `package/app/src/core/component/navigation/MainNavigation.tsx`: rename "Read Lists" → "Shelves", update link to `/shelf`. Add "My Shelves" item.
- [x] 3.17 Update `package/app/src/core/component/create-menu/` entries: "New Read List" → "New Shelf", link to `/shelf/new`.
- [x] 3.18 Update `package/app/src/core/component/footer/MainLayoutFooter.tsx`: rename "Readlists" → "Shelves", update link.
- [x] 3.19 Update locale files `package/app/src/locale/en-US.ts` and `package/app/src/locale/zh-SC.ts`: rename all readlist keys to shelf equivalents.
- [x] 3.20 Update `package/app/src/home/section/TrendingReadListSection.tsx` → rename to `TrendingShelfSection.tsx`, update component name and imports.
- [x] 3.21 Update `package/app/src/home/section/hooks/hooks.ts`: rename `useHomeReadlists` to `useHomeShelves`, update content search type.
- [x] 3.22 Update `package/app/src/book-library/component/ReadlistByBookPreview.tsx` → rename to `ShelfByBookPreview.tsx`, update imports and content.
- [x] 3.23 Grep `package/app/src/` for any remaining `readlist`/`Readlist`/`ReadList` references and fix all.
- [x] 3.24 Run `bun run app:dev` and verify shelf routes render. Test: landing, search, detail, edit, create, shelves-by-book.

## 4. Review & Remark UX

- [x] 4.1 Create `package/app/src/remark/component/RemarkInlineForm.tsx` — inline form with ScoreInput (1-10) + text input + submit button. On submit: if score provided, calls `useUpsertScoreMutation({ unitId: bookUnitId, realm: defaultRealmId, value })` to get `scoreEntryId`; then calls `postApi.create({ targetUnitId, kind: 'REMARK', body, scoreEntryId })`. No `extra: { rating }` pattern.
- [x] 4.2 Create `package/app/src/remark/component/RemarkCard.tsx` — compact card: author, score (if ScoreEntry linked), text, reactions, timestamp.
- [x] 4.3 Create `package/app/src/remark/component/RemarkList.tsx` — paginated list of RemarkCards. Uses `postApi.list({ targetUnitId, kind: 'REMARK' })`.
- [x] 4.4 Create `package/app/src/engagement/component/ScoreInput.tsx` — 1-10 score selector (segmented control with numbered buttons). No mock annotation. Emits selected integer value (or null) to parent form.
- [x] 4.5 Create `package/app/src/engagement/component/ScoreOverview.tsx` — displays average score (`totalScore / totalCount`), total count, and distribution histogram bar chart. Uses `scoreQueries.aggregates(unitId)`, selects the default realm aggregate. Renders real data from `ScoreAggregateDTO.distribution`. No mock data, no TODO annotations.
- [x] 4.6 Rework `package/app/src/book-library/page/BookReviewPage.tsx` — new layout: ScoreOverview at top (fed by `scoreQueries.aggregates(unitId)`), RemarkInlineForm below, sub-tab toggle (Remarks | Reviews), RemarkList and ReviewList sections, "Write a Full Review" link.
- [x] 4.7 Update `package/app/src/review/page/ReviewEditPage.tsx` — add 200-character minimum validation: character counter below body editor, submit button disabled until 200 chars, validation message (i18n key `review.validation.min_chars`). Replace `extra.rating` read/write: load existing score via `scoreQueries.userScores(userId, bookUnitId)`, on save call `useUpsertScoreMutation()` if score changed. Remove MOCK annotation.
- [x] 4.8 Update `package/app/src/review/page/ReviewNewPage.tsx` — same 200-char validation. Ensure `kind: PostKind.REVIEW` used in creation. Two-step flow: upsert score via `useUpsertScoreMutation()` first (if score provided), then create post with `scoreEntryId`. No `extra: { rating }` pattern.
- [x] 4.9 Update `package/app/src/review/page/ReviewsPage.tsx` — use `postApi.list({ kind: PostKind.REVIEW })` instead of content-search stub. Remove MOCK annotations.
- [x] 4.10 Create review search page at `package/app/src/review/page/ReviewSearchPage.tsx` — full Meilisearch search at `/review/search`.
- [x] 4.11 Create route files: `package/app/src/routes/_mainLayout/review/search.tsx`, `package/app/src/routes/_mainLayout/remark/$remarkId.tsx` (permalink), `package/app/src/routes/_mainLayout/remark/book/$bookId.tsx`.
- [x] 4.12 Update `package/app/src/review/component/SingleReview.tsx` — replace `(review.extra as any)?.rating` with score display from linked ScoreEntry (via `scoreEntryId` on PostDTO). Remove MOCK comment. Keep `post.extra.title` extraction (title is still in extra).
- [x] 4.13 Update `package/app/src/review/component/SingleRemark.tsx` — replace `(review.extra as any)?.rating` reads with score from linked ScoreEntry. Remove both MOCK comments.
- [x] 4.14 Update `package/app/src/review/component/item/ReviewCard.tsx` — replace `(review.extra as any)?.rating` with score from linked ScoreEntry. Remove MOCK comments.
- [x] 4.15 Verify: `bun run app:dev`, navigate to `/book/:id/review`, confirm score overview, inline remark form, sub-tab toggle, review list all render.
- [x] 4.16 Update `BookDetailLayout.tsx` — replace `bookQueries.rating(bookId)` usage with `scoreQueries.aggregates(bookId)`. Compute average from default realm aggregate's `totalScore / totalCount`.

## 5. Discussion Feature (replaces comment/)

- [x] 5.1 Delete `package/app/src/comment/` directory entirely.
- [x] 5.2 Create `package/app/src/discussion/component/ThreadList.tsx` — paginated list of top-level posts for a targetUnitId. Uses `postApi.list({ targetUnitId, kind: PostKind.POST })` filtering out posts with `parentPostUnitId`.
- [x] 5.3 Create `package/app/src/discussion/component/ThreadView.tsx` — single thread with nested replies. Uses `postApi.list({ rootPostUnitId, mode: 'threaded' })`.
- [x] 5.4 Create `package/app/src/discussion/component/PostCard.tsx` — single post: author, body (markdown rendered), reactions, reply count, timestamp.
- [x] 5.5 Create `package/app/src/discussion/component/ReplyDrawer.tsx` — compose reply (migrate markdown editor from old `comment/component/ReplyDrawer.tsx`, update to use `postApi.create({ parentPostUnitId, kind: PostKind.POST, body })`).
- [x] 5.6 Create `package/app/src/discussion/component/InlinePostForm.tsx` — start new thread (text input + submit). Creates `postApi.create({ targetUnitId, kind: PostKind.POST, body })`.
- [x] 5.7 Create `package/app/src/discussion/index.ts` — public exports.
- [x] 5.8 Create `package/app/src/book-library/page/BookDiscussionPage.tsx` — Discussion tab page using ThreadList + InlinePostForm for the book's unitId.
- [x] 5.9 Add discussion tab to `package/app/src/book-library/section/BookDetailSection.tsx` — add "Discussion" as 4th tab alongside Info, Content, Reviews & Ratings.
- [x] 5.10 Create route file `package/app/src/routes/_mainLayout/book/$bookId/discussion.tsx` loading BookDiscussionPage.
- [x] 5.11 Update any imports of old `comment/` components across the codebase (grep for `@/comment/` and `from '@/comment`). Replace with discussion module equivalents.
- [x] 5.12 Update `package/app/src/shared/util/comment.ts` — rename to `package/app/src/shared/util/post-helpers.ts`, update `handleSubmit`/`handleEdit`/`handleDelete` to use `PostKind.POST` instead of `kind: 'comment'`.
- [x] 5.13 Verify: `bun run app:dev`, navigate to `/book/:id/discussion`, confirm thread list, create thread, reply, nested display all work.

## 6. Realm Feature

- [x] 6.1 Add `GET /realms/me` endpoint in `package/server/src/realm/realm.api.ts` — returns realms where current user is a member. Query `RealmMember` by `userId`, join Realm + Unit for metadata.
- [x] 6.2 Add `myRealmsQuery()` hook in `package/api/src/realm/realm.queries.ts` using the new endpoint.
- [x] 6.3 Create `package/app/src/realm/page/RealmListPage.tsx` — realm landing at `/realm` showing public/official realms with editorial layout.
- [x] 6.4 Create `package/app/src/realm/page/RealmSearchPage.tsx` — realm search at `/realm/search` with filters (public, official, keyword, sort by memberCount).
- [x] 6.5 Create `package/app/src/realm/page/RealmPage.tsx` — realm detail with 3 tabs (Feed, Tags, Members). Uses `realmApi.get()`.
- [x] 6.6 Create `package/app/src/realm/component/RealmContentFeed.tsx` — paginated content feed. Uses `realmApi.listUnits()` (if available) or `postApi.list({ realmUnitId })`.
- [x] 6.7 Create `package/app/src/realm/component/RealmMemberList.tsx` — member list with role badges (owner/admin/moderator/member). Uses `realmApi.listMembers()`.
- [x] 6.8 Create `package/app/src/realm/component/RealmTagManager.tsx` — moderator+ can attach/detach tags on units within the realm. Uses `realmApi.addTagUnit()` / `realmApi.removeTagUnit()`.
- [x] 6.9 Create `package/app/src/realm/component/JoinButton.tsx` — join/leave toggle with member count. Uses `useJoinRealmMutation()` / `useLeaveRealmMutation()`.
- [x] 6.10 Create `package/app/src/realm/page/RealmManagePage.tsx` — owner/admin settings: edit metadata (translations), manage member roles, delete realm.
- [x] 6.11 Create `package/app/src/realm/page/NewRealmPage.tsx` — create realm form (name, description via translations, public/private). Uses `useCreateRealmMutation()`.
- [x] 6.12 Create `package/app/src/realm/component/RealmCard.tsx` — card: name, description, member count, public/official badges.
- [x] 6.13 Create `package/app/src/realm/component/RealmList.tsx` — list/grid of RealmCards.
- [x] 6.14 Create `package/app/src/realm/index.ts` — public exports.
- [x] 6.15 Create route files: `package/app/src/routes/_mainLayout/realm/index.tsx`, `realm/search.tsx`, `realm/$realmId/index.tsx`, `realm/$realmId/manage.tsx`, `realm/new.tsx`.
- [x] 6.16 Update navigation (`MainNavigation.tsx`): add "Realms" entry linking to `/realm`. Add "My Realms" item linking to `/realm/me` (filtered by membership).
- [x] 6.17 Update create menu: add "Realm" entry linking to `/realm/new`.
- [x] 6.18 Update locale files with realm-related strings.
- [x] 6.19 Verify: `bun run app:dev`, navigate to `/realm`, `/realm/search`, `/realm/:id` (all 3 tabs), `/realm/new`, `/realm/:id/manage`. Test join/leave.

## 7. Realm-Tag Context & Preferences

- [x] 7.1 Create `package/server/src/tag/tag-context.service.ts` — `getTagContext(unitId, userId?)`: fetches global UnitTags (by score desc) + RealmTagUnit rows for user's preferred realms. Single optimized query. Returns `{ tags, realmHighlights }`.
- [x] 7.2 Add `GET /tags/for-unit/:unitId/context` endpoint in `package/server/src/tag/tag.api.ts`. Auth optional — anonymous gets only `tags`, authenticated gets `tags` + `realmHighlights`.
- [x] 7.3 Default behavior when no preferences: query user's 5 most recently joined realms from `RealmMember`.
- [x] 7.4 Add `tagContextQuery(unitId)` hook in `package/api/src/tag/tag.queries.ts`.
- [x] 7.5 Create `package/app/src/tag/component/RealmTagHighlights.tsx` — collapsible sections below global tag list, each showing realm name and highlighted tags.
- [x] 7.6 Update `package/app/src/tag/component/TagWrapper.tsx` — integrate `tagContextQuery()` instead of plain `tagQueries.list()`. Render global tags + realm highlights.
- [x] 7.7 Create `package/app/src/realm/settings/RealmTagPreferences.tsx` — per unit type, select realms (from `myRealmsQuery()`), set rank order, max 50. Uses `useUpdateSettingsMutation()`.
- [x] 7.8 Wire RealmTagPreferences into user settings/preferences page.
- [x] 7.9 Verify: tag display on book detail shows global tags sorted by score. Authenticated user with realm memberships sees realm highlights.

## 8. Multilingual UI

- [x] 8.1 Update `package/app/src/shared/util/translation-helpers.ts`: replace hardcoded `DEFAULT_LANGUAGE_CHAIN` with function that reads `User.settings.preferredLanguages` (from user settings query), falling back to `['zh-CN', 'zh', 'en', 'ja']`.
- [x] 8.2 Create `package/app/src/i18n/component/TranslationTabs.tsx` — renders available languages from `translations[]` array as clickable tabs. Switching tab passes selected language to `getTranslation()`.
- [x] 8.3 Create `package/app/src/i18n/component/TranslationEditor.tsx` — tabbed form for editing translations per language: add language tab, edit title/subtitle/summary/description per language, set primary language.
- [x] 8.4 Create `package/app/src/i18n/component/WorkReleaseNav.tsx` — shows other releases of the same work (query units by `workUnitId`). Each entry links to its detail page.
- [x] 8.5 Integrate `TranslationTabs` into `package/app/src/book-library/section/BookHeroSection.tsx` or `BookDetailSection.tsx` — language tabs for book detail view.
- [x] 8.6 Integrate `TranslationEditor` into `package/app/src/book-edit/component/Metadata/BookMetadataEditor.tsx` — replace flat editing with multi-language editor.
- [x] 8.7 Integrate `WorkReleaseNav` into `package/app/src/book-library/page/BookBasicInfoPage.tsx` — show other editions section when `workUnitId` is set.
- [x] 8.8 Update tag display components (`TagList.tsx`, `TagCards.tsx`) to resolve tag labels using `getTranslation(tag.translations, userPreferredLanguage)` instead of raw `tagLabel`.
- [x] 8.9 Add language preference UI in user preferences page: select and order preferred languages, persisted via `PUT /users/me/settings`.
- [x] 8.10 Verify: switch language tabs on book detail, see content change. Edit translations in book editor. View work releases. Tag labels in preferred language.

## 9. Homepage Ecosystem Redesign

- [x] 9.1 Rework `package/app/src/home/page/Home.tsx` — new layout: Hero, Library Cards, Featured Books, Trending Shelves, Recent Reviews, Active Realms, Announcements.
- [x] 9.2 Create `package/app/src/home/section/LibraryCardsSection.tsx` — 3 cards: Book Library (active, with count, links to `/book`), Game Library (coming soon), Media Library (coming soon).
- [x] 9.3 Rename `TrendingReadListSection` → `TrendingShelfSection` (if not already done in Phase 3).
- [x] 9.4 Create `package/app/src/home/section/ActiveRealmsSection.tsx` — realm cards with member counts. Uses `realmApi.list({ isPublic: true, sort: { field: 'memberCount', order: 'desc' }, limit: 5 })`.
- [x] 9.5 Update `package/app/src/home/section/TrendingReviewsSection.tsx` — use `postApi.list({ kind: PostKind.REVIEW, limit: 5 })` instead of content search mock. Remove MOCK annotations.
- [x] 9.6 Move book-specific sections (Rankings, Editor Picks, Author Spotlight, Tag Explore, Wiki, Partners, Newsletter, Mobile CTA) from `Home.tsx` into `/book` landing page (`BookLibPage.tsx`).
- [x] 9.7 Create book search route: `package/app/src/routes/_mainLayout/book/search.tsx` — loads a `BookSearchPage` using the existing `SearchInput` + `BookSearchFilter` + Meilisearch.
- [x] 9.8 Refactor `package/app/src/book-library/page/BookLibPage.tsx` — split into landing (editorial sections from homepage) and search (moved to `BookSearchPage.tsx`).
- [x] 9.9 Add search route files for other types: `package/app/src/routes/_mainLayout/shelf/search.tsx`, `review/search.tsx`, `realm/search.tsx` (if not already created in prior phases).
- [x] 9.10 Update homepage hooks (`package/app/src/home/section/hooks/hooks.ts`) — replace MOCK content-search queries with real API calls where endpoints now exist. Remove MOCK annotations.
- [x] 9.11 Verify: `bun run app:dev`, navigate to `/` — confirm ecosystem layout with library cards, all sections render. Navigate to `/book` — confirm book-specific sections appear. Navigate to `/book/search` — confirm search works.

## 10. MOCK Cleanup & Final Verification

- [x] 10.1 Grep `package/app/src/` for `// MOCK:` annotations. For each: if the backend API now exists, replace the mock with the real API call. If the mock is correct behavior, change the comment from `// MOCK:` to a descriptive comment or remove it. Score-related mocks should all be replaced by Phase 4 (score data comes from ScoreEntry via `scoreEntryId`, not `post.extra.rating`).
- [x] 10.2 Remove type aliases: `type Readlist = ShelfDTO` and `type Review = PostDTO` in `UserUnitsPage.tsx` — use the real types directly.
- [x] 10.3 Update `package/app/src/user/page/UserUnitsPage.tsx` — replace content-search-based tab queries with proper API calls: `shelfApi.list({ userId })`, `postApi.list({ authorUserId, kind })`.
- [x] 10.4 Update `package/app/src/home/section/hooks/hooks.ts` — replace all `meiliContentApi.contentSearch()` hacks for shelves/reviews/quotes with dedicated API calls.
- [x] 10.5 Verify zero remaining `// MOCK:` or `// TODO:` annotations referencing backend APIs that now exist. No score/rating-related TODO annotations should remain.
- [x] 10.6 Run `bun run format:check` from repo root. Fix any formatting issues.
- [x] 10.7 Run `bun run knip` from repo root. Verify no new unused exports/dependencies introduced.
- [x] 10.8 Run full build: `bun run build` in `package/contract`, `package/api`, `package/server`. Run `bun run app:dev` and verify no compilation errors.
- [x] 10.9 Manual smoke test: navigate through all new routes (/shelf/*, /realm/*, /review/*, /book/:id/discussion, /book/:id/review with inline remark form). Verify each page renders without crashes.
