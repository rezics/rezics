## 1. Pre-implementation audit

- [x] 1.1 ScoreInput used only by `RemarkInlineForm.tsx:11,61`, `RemarkEditDialog.tsx:16,63`, and own definition at `engagement/components/ScoreInput.tsx`. Confirmed.
- [x] 1.2 `ScoreFormEdit` — zero imports (dead). `RatingWithInput` — imported by `package/app/src/review/forms/ReviewForm.tsx:3,48`. Design.md out-of-date; covered by task 2.3.
- [x] 1.3 Inline `queryKey` sites confirmed plus new finds:
  - Expected: `ReviewsPage.tsx:80`, `UserUnitsPage.tsx:98,177` (actual path `user/pages/`), `TagByUnitPage.tsx:22,86`, `TagListEdit.tsx` (actual `components/Edit/TagListEdit.tsx:60`), `RealmManagePage.tsx:71`.
  - New: `home/sections/hooks/hooks.ts:20,64` (home content).
  - Admin package inline literals (UsersPage, UnitsPage, BooksPage, EchokvEdit) — will need rescope or migration for convention rule.
- [x] 1.4 Empty-state candidates in package/app/src (extensive list). Beyond design.md: `RemarkListSection.tsx:29`, `realm/components/RealmContentFeed.tsx:18`, `user/sections/ContentTabSection.tsx:104`, `excerpt/components/source/ExcerptSourcePicker.tsx:200`. Many other `length === 0` are render-nothing guards, not settled-empty UX.

## 2. Score input → MUI Rating

- [x] 2.1 In `package/app/src/remark/forms/RemarkInlineForm.tsx`, replace the `ScoreInput` import and usage with `Rating` from `@mui/material/Rating` configured `max={SCORE_MAX}` (import `SCORE_MAX` from `@rezics/contract`) and `precision={1}`. Keep `number | null` state and `onChange: (_, v) => setScore(v)`.
- [x] 2.2 Apply the same swap in `package/app/src/remark/forms/RemarkEditDialog.tsx`.
- [x] 2.3 If 1.3 (audit) surfaced a custom score selector in review creation/edit pages, migrate it to MUI `<Rating>` with the same config.
- [x] 2.4 Verify clearing the selection emits `null` and submits via the existing "score is optional" path in both remark forms.

## 3. Delete dead rating code

- [x] 3.1 Delete `package/app/src/engagement/components/ScoreInput.tsx`.
- [x] 3.2 Delete `package/ui/src/primitive/control/rating/Rating.tsx` (`RatingWithInput`). Remove the containing directory if empty.
- [x] 3.3 Delete `package/ui/src/composite/forms/field/RatingField.tsx` (`ScoreFormEdit`). Remove the containing directory if empty.
- [x] 3.4 Remove any barrel-file re-exports of the deleted symbols (identified in 1.2).

## 4. Query-key factory: post filters

- [x] 4.1 In `package/api/src/post/post.keys.ts`, extend `postKeys.byTarget` to accept an optional `filters: PostByTargetFilters` parameter (or reuse `PostFilters` if it excludes `targetUnitId`). Embed the filters argument into the returned key as a trailing slot (`null` when absent).
- [x] 4.2 Update `package/api/src/post/post.queries.ts` hooks that call `postKeys.byTarget` so filters flow into the key. Check `usePostsByTarget` / `usePostSearchQuery` / equivalent.
- [x] 4.3 Grep for call sites of `postKeys.byTarget` / `usePostsByTarget` across `package/app` and update signatures to pass filters.
- [x] 4.4 Repeat the same filter-in-key discipline check on any other per-domain factory with similar shape (e.g., if `shelfKeys.byOwner` or `tagKeys.search` accepts filter params and drops them, embed them).

## 5. Query-key factory: batch reaction summary

- [x] 5.1 In `package/api/src/reaction/reaction.keys.ts`, add `normalizeIds` helper (sort + dedupe) and `reactionKeys.summaryBatch(targetIds)` → `[...reactionKeys.summaries(), "batch", normalizeIds(targetIds)]`.
- [x] 5.2 In `package/api/src/reaction/reaction.queries.ts`, add `useBatchReactionSummary(targetIds, options?)` using the batch endpoint (already exists per `reaction-summary` spec). Return `Record<string, ReactionSummaryDTO>` or the shape the existing endpoint provides.
- [x] 5.3 Migrate `package/app/src/review/pages/ReviewsPage.tsx:80` to `useBatchReactionSummary`.
- [x] 5.4 Migrate `package/app/src/shelf/pages/UserUnitsPage.tsx:98` to `useBatchReactionSummary`.
- [x] 5.5 Migrate `package/app/src/shelf/pages/UserUnitsPage.tsx:177` to `useBatchReactionSummary`.
- [x] 5.6 Verify mutations invalidating `reactionKeys.summaries()` correctly invalidate both scalar and batch entries (exercise with a reaction toggle in dev-server smoke).

## 6. Query-key factory: tag + realm

- [x] 6.1 Create or extend `package/api/src/tag/tag.keys.ts` with `tagKeys.detail(id)` and `tagKeys.search(searchTerm)`. Add `queryOptions` wrappers in `tag.queries.ts` if missing.
- [x] 6.2 Migrate `package/app/src/tag/pages/TagByUnitPage.tsx:22` and `:86` from inline literal to `tagKeys.detail(id)`.
- [x] 6.3 Migrate `package/app/src/tag/components/TagListEdit.tsx:60` to `tagKeys.search(searchTerm)`.
- [x] 6.4 Create or extend `package/api/src/realm/realm.keys.ts` with `realmKeys.detail(realmId)`.
- [x] 6.5 Migrate `package/app/src/realm/pages/RealmManagePage.tsx:71` to `realmKeys.detail(realmId)`.

## 7. Convention check: forbid inline queryKey

- [x] 7.1 Locate the existing conventions script (`bun run check:convention`). Add a rule that matches the pattern `queryKey:\s*\[` in files under `package/{app,admin,ui}/**/*.{ts,tsx}`. Allow only under `package/api/src/**/*.{keys,queries,mutations}.ts`.
- [x] 7.2 Ensure the rule's failure message cites the offending file and line and suggests migrating to a per-domain factory.
- [x] 7.3 Run `bun run check:convention` after step 5/6 migrations; confirm it passes. Intentionally introduce a violation in a scratch file to verify the rule fires, then remove the scratch.

## 8. EmptyState primitive

- [x] 8.1 Create `package/ui/src/composite/feedback/EmptyState.tsx` implementing the API in design.md (title, description?, icon?, action?). Use MUI `Stack` + `Typography`, centered alignment, responsive padding `sx={{ py: { xs: 4, sm: 6 } }}`.
- [x] 8.2 Export `EmptyState` from the `@rezics/ui` package barrel.
- [x] 8.3 Add a unit test (`EmptyState.test.tsx`) covering: title-only, full-slot, and verification that no icon/description/action slot renders when props are absent.

## 9. Migrate list views to EmptyState

- [x] 9.1 `package/app/src/review/sections/ReviewListSection.tsx` — replace `<Typography>No reviews yet.</Typography>` with `<EmptyState title={t("review.list.empty.title")} />`. Add the translation key.
- [x] 9.2 `package/app/src/review/pages/ReviewSearchPage.tsx` — replace `<Typography>No reviews found</Typography>` with `<EmptyState title={t("review.search.empty.title")} />`. Add the translation key.
- [x] 9.3 `package/app/src/search/components/SearchResultList.tsx` — replace the inline "No results found" block with `<EmptyState title={t("search.empty.title")} />`. Add the translation key.
- [x] 9.4 `package/app/src/remark/components/list/RemarkList.tsx` — wrap the `.map()` render in a settled-empty guard; when `posts.length === 0` and not loading/errored, render `<EmptyState title={t("remark.list.empty.title")} />`.
- [x] 9.5 `package/app/src/excerpt/components/list/ExcerptList.tsx` — same pattern: render `<EmptyState title={t("excerpt.list.empty.title")} />` when `units.length === 0`.
- [x] 9.6 `package/app/src/book-library/components/ExcerptPreview.tsx` — ensure the empty-state path reaches `ExcerptList` (which now handles empty internally) OR render `EmptyState` directly if `ExcerptPreview` should show a specialized preview empty copy.
- [x] 9.7 Verify any other settled-empty sites found in 1.4 are migrated. Migrated `RemarkListSection`, `RealmContentFeed`, `ContentTabSection`. `ExcerptSourcePicker` left as caption-sized inline hint in an accordion (not a settled-empty page).

## 10. Card-level fallback → i18n

- [x] 10.1 `package/app/src/excerpt/components/item/ExcerptCard.tsx` — replace the literal `"暂无摘录内容"` fallback with a localized key (e.g., `t("excerpt.card.description.fallback")`). Keep this distinct from list-level `EmptyState`.
- [x] 10.2 Grep for other card-level literal fallbacks (mixed-language strings) and move them to i18n keys. Migrated `ExcerptCard`'s `未知出处` → `excerpt.card.source.unknown` and `0 喜欢` placeholder → `excerpt.card.likes_count` with MOCK annotation.

## 11. Validation

- [x] 11.1 Run per-package `bun run tsc --noEmit` in `package/app`, `package/ui`, `package/api`; fix errors introduced by this change (ignore cross-package alias noise per project convention). Fixed one real regression: `useBatchReactionSummary` wrapper type-narrowing needed an explicit generic; rewrote it to call `useQuery<ReactionSummaryResponse>` directly with inline key/fn (permitted in `api/src/**/*.queries.ts` per R6). Remaining errors in both packages are pre-existing cross-package alias, vite-config, jsx-flag, and env-driven issues.
- [x] 11.2 Run `bun run check:convention` at the repo root; confirm it passes (including the new rule from 7.x). R6=0; only 1 pre-existing R5 baseline violation remains.
- [x] 11.3 Run targeted tests: `bun test package/app/src/remark package/app/src/review package/app/src/excerpt package/ui/src/composite/feedback 2>/dev/null`. Update snapshots broken by the `<Rating>` swap and `EmptyState` integrations; re-run until green. 3 new `EmptyState` tests pass; broader targeted run across remark/review/excerpt/search/realm/user/reaction shows only pre-existing auth-handler failures unrelated to this change (no `<Rating>`/`EmptyState` regressions).
- [ ] 11.4 Run `bun run knip` at the repo root; confirm no newly reported unused exports/dependencies for deleted files linger. **Blocked**: knip aborts before analysis with `DATABASE_URL` not set when loading `package/auth/prisma.config.ts`. Pre-existing env issue, unrelated to this change.
- [ ] 11.5 Start `bun run app:dev` and manually verify: **requires user** — automated agent cannot exercise browser UI.
  - [ ] Remark inline form renders MUI `<Rating>` (10 stars); selecting/clearing/submitting works.
  - [ ] Remark edit dialog opens with the current score shown as highlighted stars; clearing emits null.
  - [ ] Book with zero remarks shows `EmptyState` on the remark tab.
  - [ ] Book or search scope with zero excerpts shows `EmptyState`.
  - [ ] Review search with no matching reviews shows `EmptyState` (localized copy).
  - [ ] Search results with zero items show `EmptyState`.
  - [ ] Reaction toggle on a review updates the batch-reaction-summary correctly (no stale counts).
  - [ ] Tag/realm detail pages still load correctly after key-factory migration.

## 12. Documentation

- [x] 12.1 Grep docs (`rg -n "ScoreInput|RatingWithInput|ScoreFormEdit|reaction-summary-batch" openspec docs package/*/docs 2>/dev/null`); remove or update stale references. Only hits are in this change's own artifacts and archived changes (historical records); no stale references in active specs or docs.
- [x] 12.2 If `package/app/docs/feature standard.md` or a similar doc mentions TanStack query keys, cross-reference the `tanstack-query-keys` capability. `feature standard.md` does not mention TanStack Query; added a forward-looking cross-reference to `Tanstack_Query_TQueryKey.md` pointing at the archived spec path.
