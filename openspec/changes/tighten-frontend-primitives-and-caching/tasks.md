## 1. Pre-implementation audit

- [ ] 1.1 Run `rg -n "ScoreInput" package/app package/ui` and confirm the only call sites are `RemarkInlineForm.tsx`, `RemarkEditDialog.tsx`, and the component's own definition. Note any unexpected site.
- [ ] 1.2 Run `rg -n "RatingWithInput|ScoreFormEdit" package` and confirm zero import sites. Record any barrel file that re-exports these symbols.
- [ ] 1.3 Run `rg -n "queryKey:\s*\[" package/app package/admin package/ui` and record every inline `queryKey` literal. Cross-check against the audit list in design.md (`ReviewsPage.tsx:80`, `UserUnitsPage.tsx:98`/`:177`, `TagByUnitPage.tsx:22`/`:86`, `TagListEdit.tsx:60`, `RealmManagePage.tsx:71`). Add any newly found site.
- [ ] 1.4 Run `rg -n "length === 0|length == 0|\.isEmpty" package/app/src --type tsx` to find potential empty-state sites beyond the ones listed in design.md. Append new findings.

## 2. Score input → MUI Rating

- [ ] 2.1 In `package/app/src/remark/forms/RemarkInlineForm.tsx`, replace the `ScoreInput` import and usage with `Rating` from `@mui/material/Rating` configured `max={SCORE_MAX}` (import `SCORE_MAX` from `@rezics/contract`) and `precision={1}`. Keep `number | null` state and `onChange: (_, v) => setScore(v)`.
- [ ] 2.2 Apply the same swap in `package/app/src/remark/forms/RemarkEditDialog.tsx`.
- [ ] 2.3 If 1.3 (audit) surfaced a custom score selector in review creation/edit pages, migrate it to MUI `<Rating>` with the same config.
- [ ] 2.4 Verify clearing the selection emits `null` and submits via the existing "score is optional" path in both remark forms.

## 3. Delete dead rating code

- [ ] 3.1 Delete `package/app/src/engagement/components/ScoreInput.tsx`.
- [ ] 3.2 Delete `package/ui/src/primitive/control/rating/Rating.tsx` (`RatingWithInput`). Remove the containing directory if empty.
- [ ] 3.3 Delete `package/ui/src/composite/forms/field/RatingField.tsx` (`ScoreFormEdit`). Remove the containing directory if empty.
- [ ] 3.4 Remove any barrel-file re-exports of the deleted symbols (identified in 1.2).

## 4. Query-key factory: post filters

- [ ] 4.1 In `package/api/src/post/post.keys.ts`, extend `postKeys.byTarget` to accept an optional `filters: PostByTargetFilters` parameter (or reuse `PostFilters` if it excludes `targetUnitId`). Embed the filters argument into the returned key as a trailing slot (`null` when absent).
- [ ] 4.2 Update `package/api/src/post/post.queries.ts` hooks that call `postKeys.byTarget` so filters flow into the key. Check `usePostsByTarget` / `usePostSearchQuery` / equivalent.
- [ ] 4.3 Grep for call sites of `postKeys.byTarget` / `usePostsByTarget` across `package/app` and update signatures to pass filters.
- [ ] 4.4 Repeat the same filter-in-key discipline check on any other per-domain factory with similar shape (e.g., if `shelfKeys.byOwner` or `tagKeys.search` accepts filter params and drops them, embed them).

## 5. Query-key factory: batch reaction summary

- [ ] 5.1 In `package/api/src/reaction/reaction.keys.ts`, add `normalizeIds` helper (sort + dedupe) and `reactionKeys.summaryBatch(targetIds)` → `[...reactionKeys.summaries(), "batch", normalizeIds(targetIds)]`.
- [ ] 5.2 In `package/api/src/reaction/reaction.queries.ts`, add `useBatchReactionSummary(targetIds, options?)` using the batch endpoint (already exists per `reaction-summary` spec). Return `Record<string, ReactionSummaryDTO>` or the shape the existing endpoint provides.
- [ ] 5.3 Migrate `package/app/src/review/pages/ReviewsPage.tsx:80` to `useBatchReactionSummary`.
- [ ] 5.4 Migrate `package/app/src/shelf/pages/UserUnitsPage.tsx:98` to `useBatchReactionSummary`.
- [ ] 5.5 Migrate `package/app/src/shelf/pages/UserUnitsPage.tsx:177` to `useBatchReactionSummary`.
- [ ] 5.6 Verify mutations invalidating `reactionKeys.summaries()` correctly invalidate both scalar and batch entries (exercise with a reaction toggle in dev-server smoke).

## 6. Query-key factory: tag + realm

- [ ] 6.1 Create or extend `package/api/src/tag/tag.keys.ts` with `tagKeys.detail(id)` and `tagKeys.search(searchTerm)`. Add `queryOptions` wrappers in `tag.queries.ts` if missing.
- [ ] 6.2 Migrate `package/app/src/tag/pages/TagByUnitPage.tsx:22` and `:86` from inline literal to `tagKeys.detail(id)`.
- [ ] 6.3 Migrate `package/app/src/tag/components/TagListEdit.tsx:60` to `tagKeys.search(searchTerm)`.
- [ ] 6.4 Create or extend `package/api/src/realm/realm.keys.ts` with `realmKeys.detail(realmId)`.
- [ ] 6.5 Migrate `package/app/src/realm/pages/RealmManagePage.tsx:71` to `realmKeys.detail(realmId)`.

## 7. Convention check: forbid inline queryKey

- [ ] 7.1 Locate the existing conventions script (`bun run check:convention`). Add a rule that matches the pattern `queryKey:\s*\[` in files under `package/{app,admin,ui}/**/*.{ts,tsx}`. Allow only under `package/api/src/**/*.{keys,queries,mutations}.ts`.
- [ ] 7.2 Ensure the rule's failure message cites the offending file and line and suggests migrating to a per-domain factory.
- [ ] 7.3 Run `bun run check:convention` after step 5/6 migrations; confirm it passes. Intentionally introduce a violation in a scratch file to verify the rule fires, then remove the scratch.

## 8. EmptyState primitive

- [ ] 8.1 Create `package/ui/src/composite/feedback/EmptyState.tsx` implementing the API in design.md (title, description?, icon?, action?). Use MUI `Stack` + `Typography`, centered alignment, responsive padding `sx={{ py: { xs: 4, sm: 6 } }}`.
- [ ] 8.2 Export `EmptyState` from the `@rezics/ui` package barrel.
- [ ] 8.3 Add a unit test (`EmptyState.test.tsx`) covering: title-only, full-slot, and verification that no icon/description/action slot renders when props are absent.

## 9. Migrate list views to EmptyState

- [ ] 9.1 `package/app/src/review/sections/ReviewListSection.tsx` — replace `<Typography>No reviews yet.</Typography>` with `<EmptyState title={t("review.list.empty.title")} />`. Add the translation key.
- [ ] 9.2 `package/app/src/review/pages/ReviewSearchPage.tsx` — replace `<Typography>No reviews found</Typography>` with `<EmptyState title={t("review.search.empty.title")} />`. Add the translation key.
- [ ] 9.3 `package/app/src/search/components/SearchResultList.tsx` — replace the inline "No results found" block with `<EmptyState title={t("search.empty.title")} />`. Add the translation key.
- [ ] 9.4 `package/app/src/remark/components/list/RemarkList.tsx` — wrap the `.map()` render in a settled-empty guard; when `posts.length === 0` and not loading/errored, render `<EmptyState title={t("remark.list.empty.title")} />`.
- [ ] 9.5 `package/app/src/excerpt/components/list/ExcerptList.tsx` — same pattern: render `<EmptyState title={t("excerpt.list.empty.title")} />` when `units.length === 0`.
- [ ] 9.6 `package/app/src/book-library/components/ExcerptPreview.tsx` — ensure the empty-state path reaches `ExcerptList` (which now handles empty internally) OR render `EmptyState` directly if `ExcerptPreview` should show a specialized preview empty copy.
- [ ] 9.7 Verify any other settled-empty sites found in 1.4 are migrated.

## 10. Card-level fallback → i18n

- [ ] 10.1 `package/app/src/excerpt/components/item/ExcerptCard.tsx` — replace the literal `"暂无摘录内容"` fallback with a localized key (e.g., `t("excerpt.card.description.fallback")`). Keep this distinct from list-level `EmptyState`.
- [ ] 10.2 Grep for other card-level literal fallbacks (mixed-language strings) and move them to i18n keys.

## 11. Validation

- [ ] 11.1 Run per-package `bun run tsc --noEmit` in `package/app`, `package/ui`, `package/api`; fix errors introduced by this change (ignore cross-package alias noise per project convention).
- [ ] 11.2 Run `bun run check:convention` at the repo root; confirm it passes (including the new rule from 7.x).
- [ ] 11.3 Run targeted tests: `bun test package/app/src/remark package/app/src/review package/app/src/excerpt package/ui/src/composite/feedback 2>/dev/null`. Update snapshots broken by the `<Rating>` swap and `EmptyState` integrations; re-run until green.
- [ ] 11.4 Run `bun run knip` at the repo root; confirm no newly reported unused exports/dependencies for deleted files linger.
- [ ] 11.5 Start `bun run app:dev` and manually verify:
  - [ ] Remark inline form renders MUI `<Rating>` (10 stars); selecting/clearing/submitting works.
  - [ ] Remark edit dialog opens with the current score shown as highlighted stars; clearing emits null.
  - [ ] Book with zero remarks shows `EmptyState` on the remark tab.
  - [ ] Book or search scope with zero excerpts shows `EmptyState`.
  - [ ] Review search with no matching reviews shows `EmptyState` (localized copy).
  - [ ] Search results with zero items show `EmptyState`.
  - [ ] Reaction toggle on a review updates the batch-reaction-summary correctly (no stale counts).
  - [ ] Tag/realm detail pages still load correctly after key-factory migration.

## 12. Documentation

- [ ] 12.1 Grep docs (`rg -n "ScoreInput|RatingWithInput|ScoreFormEdit|reaction-summary-batch" openspec docs package/*/docs 2>/dev/null`); remove or update stale references.
- [ ] 12.2 If `package/app/docs/feature standard.md` or a similar doc mentions TanStack query keys, cross-reference the `tanstack-query-keys` capability.
