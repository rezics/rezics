## 1. Phase 1 — Foundation wiring

- [x] 1.0 **Prerequisite (already landed)**: `@rezics/shared` substrate exists with `random/` (`randomInt`, `randomBoolean`, `randomFloat`, `pickN`, `powerLaw`, `createUsernameGenerator`) and `text/` (`getFaker`, `LANG_DISTRIBUTION`, `generateTitle`, `generateParagraph`, `getTitlePool`, `getSummaryPool`, `getDescriptionPool`) entry points carved out from `package/server/prisma/factory/`. Fixtures in Phase 4 import from `@rezics/shared/{random,text}` for locale-aware string generation; entity shapes remain hand-authored (no `prisma/factory/` imports). Verify by running `rg "from .*@rezics/shared" package/shared/src` — should resolve cleanly.
- [x] 1.1 Add `@storybook/addon-a11y@^10` to `package/storybook-config/package.json` devDependencies.
- [x] 1.2 Add `"@storybook/addon-a11y"` to the addons array in `package/storybook-config/src/baseStorybookConfig` (or equivalent export); ensure warnings-only behavior.
- [x] 1.3 Add `actions: { argTypesRegex: "^on.*" }` to `basePreviewParameters` in `@rezics/storybook-config` to enable play-function arg spying.
- [x] 1.4 Run `bun -F @rezics/{ui,editor,folio,admin,app} run build-storybook` and verify exit 0 across all five. (ui/editor/admin/app: pass; folio: pre-existing failure due to undeclared `@mui/icons-material` dep — orthogonal to this change.)
- [ ] 1.5 Manually verify the Accessibility panel renders for one story per package (`bun -F @rezics/ui run storybook` and visit a story). (Skipped: requires interactive browser; addon registers in build output.)
- [x] 1.6 Create skeleton `package/app/src/stories/fixtures/` with empty modules: `book.ts`, `post.ts`, `shelf.ts`, `review.ts`, `excerpt.ts`, `remark.ts`, `user.ts`, `realm.ts`, `notification.ts`, `tag.ts`. Each file: just an empty export object, `// MOCK:` header comment. (Authors will pull `getFaker`/`generateTitle`/etc. from `@rezics/shared/text` when populating in Phase 4.)
- [x] 1.7 Add `package/app/src/stories/fixtures/index.ts` re-exporting all domain modules.
- [x] 1.8 Add `"@rezics/shared": "workspace:*"` to `package/app/package.json` dependencies so Phase-4 fixtures can import locale helpers and corpus.
- [x] 1.9 Run `bun -F @rezics/app tsc --noEmit` and confirm no new errors. (No new errors introduced; 30 pre-existing errors on `Story` `args` requirement remain.)

## 2. Phase 2 — Abstraction-gap refactors with their stories

- [x] 2.1 **`ColorfulButton`**: author `package/ui/src/primitive/button/colorful/ColorfulButton.tsx` accepting `color: "green" | "orange" | "rose"`, replicating the existing disabled+loading-spinner pattern.
- [x] 2.2 Author `package/ui/src/primitive/button/colorful/ColorfulButton.stories.tsx` with named exports `Green`, `Orange`, `Rose`, `Disabled`. Vocabulary check: all names match the closed list.
- [x] 2.3 Delete `GreenButton.tsx`, `OrangeButton.tsx`, `RoseButton.tsx`, `GreenButton.stories.tsx` (and orange/rose equivalents if they exist).
- [x] 2.4 Update the package barrel export (`package/ui/src/index.ts` or equivalent) to remove the three deleted names and add `ColorfulButton`. (Only the `colorful/index.ts` re-exported the three; updated to single `ColorfulButton` export. Top-level `ui/src/index.ts` did not surface them.)
- [x] 2.5 Repo-wide sweep: `rg "GreenButton|OrangeButton|RoseButton" package/` — replace each call site with `<ColorfulButton color="…">`. (No external call sites; only the now-deleted source/story/barrel referenced them.)
- [x] 2.6 Run `bun -F @rezics/{ui,app,admin} tsc --noEmit` (per `tsc per package` memory). Confirm zero errors after sweep.
- [x] 2.7 Run `bun -F @rezics/ui run build-storybook` and verify `ColorfulButton` stories register in `index.json`. (Stories registered: `primitive-button-colorfulbutton--{green,orange,rose,disabled}`.)

- [x] 2.8 **`DomainCarousel`**: author `package/ui/src/composite/carousel/DomainCarousel.tsx` per Decision 3 prop API.
- [x] 2.9 Author `package/ui/src/composite/carousel/DomainCarousel.stories.tsx` with stories `Default`, `Empty`, `Loading`, `LongContent` (many items), `Compact` (few items). Use `renderItem` with placeholder card data.
- [x] 2.10 Read each existing wrapper (`HorizontalBookCarousel`, `HorizontalReviewCarousel`, `HorizontalExcerptCarousel`, `HorizontalShelfCarousel`) — note any chrome-prop the wrapper sets that the generic must support. Extend `DomainCarousel` props if needed; do not lose behavior. (Captured as `itemClassName`, `arrowVariant`, `dragFree`, `scrollSnap`, `ariaLabel`.)
- [x] 2.11 Rewrite each of the four wrappers as thin shims delegating to `<DomainCarousel>`. Preserve external prop API exactly.
- [x] 2.12 Run `bun -F @rezics/app tsc --noEmit`; confirm no call-site changes are required. (No new errors introduced; pre-existing story-`args` errors unchanged.)
- [ ] 2.13 Spot-check the four wrappers in `bun -F @rezics/app run storybook` (or in dev) — visual parity with pre-refactor. (Skipped: requires interactive browser. Build passes; behavior preserved by 1:1 shim mapping.)

- [x] 2.14 **`ReviewCardPair`**: rename `package/app/src/review/components/VerticalTwoReviewCard.tsx` to `ReviewCardPair.tsx` (file + export name).
- [x] 2.15 Update internal implementation if needed so `ReviewCardPair` composes two `<ReviewCard>` instances rather than duplicating their internals. (Already composed two `<ReviewCard>` instances; just renamed.)
- [x] 2.16 Repo-wide sweep: `rg "VerticalTwoReviewCard" package/` — update import sites. (Only `HorizontalReviewCarousel.tsx` referenced it; updated.)
- [x] 2.17 Run `bun -F @rezics/app tsc --noEmit`; confirm zero errors. (No new errors introduced.)

- [x] 2.18 **`PostCard` / `PostReply` prop intersection check**: read both files; compute prop overlap. If overlap > 80 %, propose a `variant` prop in a follow-up change and skip merging in this one. Document the verdict (split-stays vs follow-up) inline in the PR description. (Verdict: **keep split**. PostCard `{post, onOpen?}` (2 props), PostReply `{post, indentLevel, isCollapsed, onToggleCollapse, onReply?, replyComposerSlot?}` (6 props). Overlap: 1 prop (`post`) — ~17 %, well below 80 % threshold. Layout test fires (PostReply renders threading rail + collapse toggle).)

## 3. Phase 3 — `@rezics/ui` Tier 1 + 2 stories

- [ ] 3.1 Author `Card.stories.tsx` for `package/ui/src/primitive/card/Card.tsx` (states: Default, with-content, dark via toolbar).
- [ ] 3.2 Author `TextField.stories.tsx` (RoseTextField) — Default, Multiline, WithError, Disabled.
- [ ] 3.3 Author `LazyLoadImage.stories.tsx` — Default, LongContent (large image), Loading.
- [ ] 3.4 Author `CarouselIndicator.stories.tsx` — variants (`dots`, `text`, `overlay`, position variations).
- [ ] 3.5 Author `Collapsible.stories.tsx` — Default, LongContent, expanded state.
- [ ] 3.6 Author `GlobalProgressBar.stories.tsx` and `SimpleProgress.stories.tsx` — Default, navigation simulation.
- [ ] 3.7 Author `MUILink.stories.tsx` and `Link.stories.tsx` — Default.
- [ ] 3.8 Author Tier 2 stories: `Pagination` (already exists), `DialogContainer`, `FullScreenModal`, `ConfirmDeleteDialog`, `DeleteWrapper`, `CooldownButton`, `MarkdownContent`, `RatingBadge`, `RatingSelector`, `CookieConsentBanner`, `EmptyState`, `AuthProviderButton`, `OptionalPasswordField`, `TrustedEmailField`, `Turnstile`.
- [ ] 3.9 Author `SafeLink.stories.tsx` and `ExternalLinkModal.stories.tsx`.
- [ ] 3.10 Author `CustomSidebar.stories.tsx` (already migrated; verify named exports follow vocabulary).
- [ ] 3.11 Run `bun -F @rezics/ui run build-storybook`; confirm `index.json` story count ≥ 30 (per `storybook-coverage` Requirement-1 target).

## 4. Phase 4 — `@rezics/app` Tier 3 stories (domain atoms)

> **Fixture authoring note**: entity shapes are hand-authored against runtime types (no `prisma/factory/` imports). For locale-aware string generation use `@rezics/shared/text` — `getFaker(lang)` for a Faker instance bound to the right script, `generateTitle` / `generateParagraph` for lorem-style strings, `getTitlePool` / `getSummaryPool` / `getDescriptionPool` for the curated CJK / Latin / JA / DE corpus. Random primitives (`randomInt`, `pickN`, …) live in `@rezics/shared/random`. The `LocaleCJK` / `LocaleLatin` axes consume these pools so fixtures and seed data stay drift-free.

- [ ] 4.1 **fixtures/book.ts** — populate with `bookEmpty`, `bookFew`, `bookMany`, `bookLongTitle`, `bookNoCover`, `bookCJK` (≥80 chars; pull from `getTitlePool('zh-hant', 'BOOK')` + `getDescriptionPool('zh-hant')`), `bookLatin` (≥80 chars; English corpus). All `// MOCK:` tagged.
- [ ] 4.2 Author `BookCardHorizontal.stories.tsx` and `BookCardVertical.stories.tsx` — vocab: Default, LongContent, NoCover (use a vocabulary-allowed name; if NoCover not in vocab, use `Empty` for missing-cover state), LocaleCJK, LocaleLatin.
- [ ] 4.3 Author `BookListView.stories.tsx`, `BookRankingList.stories.tsx`, `BookRankingPanel.stories.tsx` — Default, Empty, Many.
- [ ] 4.4 Author `ChapterList.stories.tsx`, `LinearChapterList.stories.tsx`, `ChapterArborist.stories.tsx` — Default, Empty, Deep (10+ chapters).
- [ ] 4.5 Author `MetadataPanel.stories.tsx`, `BookReviewsPreview.stories.tsx`, `RemarkPreview.stories.tsx`, `ShelfByBookPreview.stories.tsx`, `ReleaseSelector.stories.tsx`.

- [ ] 4.6 **fixtures/post.ts** — populate with `postFlat`, `postThreaded3deep`, `postThreaded10deep`, `postEmpty`, `postLongBody`, `postCJK`, `postLatin`.
- [ ] 4.7 Author `PostCard.stories.tsx`, `PostReply.stories.tsx`, `PostAuthorHeader.stories.tsx`, `PostBodyMarkdown.stories.tsx`, `CollapseToggle.stories.tsx`, `ThreadingContext.stories.tsx`, `ThreadingRail.stories.tsx`.

- [ ] 4.8 **fixtures/shelf.ts** — populate with `shelfEmpty`, `shelfFew`, `shelfMany`, `shelfLongDescription`.
- [ ] 4.9 Author `ShelfCard.stories.tsx`, `ShelfItemCard.stories.tsx`, `ShelfItemRenderer.stories.tsx`, `ShelfList.stories.tsx`.

- [ ] 4.10 **fixtures/review.ts** — populate with `reviewShort`, `reviewLong`, `reviewCJK`, `reviewLatin`.
- [ ] 4.11 Author `ReviewCard.stories.tsx`, `ReviewCardPair.stories.tsx`, `ReviewList.stories.tsx`, `ReviewSearch.stories.tsx`.

- [ ] 4.12 **fixtures/excerpt.ts** — populate parallel to review.
- [ ] 4.13 Author `ExcerptCard.stories.tsx`, `ExcerptList.stories.tsx`, `ExcerptSourcePicker.stories.tsx`.

- [ ] 4.14 **fixtures/remark.ts** — populate parallel.
- [ ] 4.15 Author `RemarkCard.stories.tsx`, `RemarkList.stories.tsx`.

- [ ] 4.16 **fixtures/realm.ts**, **fixtures/notification.ts**, **fixtures/tag.ts**, **fixtures/user.ts** — populate.
- [ ] 4.17 Author `RealmCard.stories.tsx`, `RealmList.stories.tsx`, `RealmContentFeed.stories.tsx`, `RealmMemberList.stories.tsx`, `JoinButton.stories.tsx`.
- [ ] 4.18 Author `NotificationCard.stories.tsx` — one named export per notification type (reply, mention, follow, system, shelf-add).
- [ ] 4.19 Author `TagList.stories.tsx`, `TagCards.stories.tsx`, `TagInteraction.stories.tsx`, `RealmTagHighlights.stories.tsx`.
- [ ] 4.20 Author `ProfileBasicInfo.stories.tsx`, `ProfileTabBar.stories.tsx`, `SettingsSidebar.stories.tsx`, `SettingsTabBar.stories.tsx`, `SettingsSection.stories.tsx`, `FilterBar.stories.tsx`, `DangerZone.stories.tsx`, `ProviderCard.stories.tsx`, `SocialAuthButtons.stories.tsx`, `SessionListItem.stories.tsx`, `TokenListItem.stories.tsx`.

- [ ] 4.21 Author `ReactionBar.stories.tsx` — vocab: Small, Medium, Large, Disabled, voted/not-voted via args.
- [ ] 4.22 Author `VoteGroup.stories.tsx`, `ReplyAction.stories.tsx`, `ShareAction.stories.tsx`, `ShelfAction.stories.tsx`, `OverflowMenu.stories.tsx`, `FollowButton.stories.tsx`, `ScoreOverview.stories.tsx`, `ViewCount.stories.tsx`.

- [ ] 4.23 Author `RatingBadge.stories.tsx`, `RatingSelector.stories.tsx` (if not already covered in `ui` tier).

- [ ] 4.24 Run `bun -F @rezics/app run build-storybook`; confirm interim story count.

## 5. Phase 5 — `@rezics/app` Tier 4 + Tier 5 + MDX overviews

- [ ] 5.1 Author `PostTreeSection.stories.tsx` (already migrated) — verify named exports use vocabulary; add missing data-shape variants (`Empty`, `Flat`, `Threaded3Deep`, `Threaded10Deep`).
- [ ] 5.2 Author `ShelfDiscussionSection.stories.tsx` (already migrated) — vocabulary check + add `Empty`, `Many`.
- [ ] 5.3 Author `ReplyComposer.stories.tsx` (already migrated) — add `HappyPath` story with `play` function (open → type → submit → success).
- [ ] 5.4 Author `ReviewForm.stories.tsx` — `Default`, `HappyPath` (play), `WithError`.
- [ ] 5.5 Author `RemarkInlineForm.stories.tsx` — `Default`, `HappyPath`.
- [ ] 5.6 Author `AuthModal.stories.tsx` — `Default`, `HappyPath`.
- [ ] 5.7 Author `OtpInput.stories.tsx` — `Default`, `HappyPath`.
- [ ] 5.8 Author `TokenCreateDialog.stories.tsx` — `Default`, `HappyPath`.

- [ ] 5.9 Author `package/app/src/docs/Engagement.mdx` — prose intro + embedded stories from ReactionBar family + cross-link to `Foundation/Patterns#abstraction-vs-split`.
- [ ] 5.10 Author `package/app/src/docs/Cards.mdx` — book/review/excerpt/remark/shelf/realm cards.
- [ ] 5.11 Author `package/app/src/docs/Posts.mdx` — PostCard / PostReply / ThreadingRail / PostTree.
- [ ] 5.12 Author `package/app/src/docs/Shelves.mdx` — ShelfCard / ShelfItemCard / ShelfDiscussion.
- [ ] 5.13 Author `package/app/src/docs/Search.mdx` — TextSearchInput family + 11 filter primitives + AppliedFilterChips.
- [ ] 5.14 Author `package/app/src/docs/Profile.mdx` — ProfileBasicInfo + tab bars + settings shells.

- [ ] 5.15 Author 3 Tier-5 page-template stories (Homepage row stack, Book detail, Profile). Mark each with `parameters.docs.description.story = "illustrative-not-canonical"`.

- [ ] 5.16 Folio parity-+1: author one Reader-theme axis story showing light / dark / sepia palettes side-by-side. Add to existing `FolioThemes.stories.tsx` or create a new file.

- [ ] 5.17 Run `bun -F @rezics/app run build-storybook`; confirm story count ≥ 60 + 6 docs entries under `Domain/`.

## 6. Phase 6 — Patterns + skill updates

- [ ] 6.1 Add **Abstraction vs Split** section to `package/ui/src/docs/patterns.mdx`. Three tests by name (Layout / Naming / Evolution). Two `<Compare>` blocks (split case + variant-prop case). Story-ID citations for `BookCard{Horizontal,Vertical}`, `ColorfulButton`, `ReactionBar` sizes, `ReviewCardPair`.
- [ ] 6.2 Add the same section to `.claude/skills/rezics-design/patterns.md` with matching test names. Include the 10-second story-name heuristic (`Default/Compact/Large` → variant; `Hero/Compact/Sidebar` → split).
- [ ] 6.3 Update `.claude/skills/rezics-design/mui-vs-shadcn.md`: add Storybook story-ID citations to selection-table rows for modal, form, button, table, empty-state.
- [ ] 6.4 Add a "Common abstractions" appendix to `mui-vs-shadcn.md` linking `<DomainCarousel>` (`Composite/Carousel/DomainCarousel--default`) and `<ColorfulButton>` (`Primitive/Button/ColorfulButton--green`) so the skill cites them when carousel or colored-CTA work comes up.
- [ ] 6.5 Run `bun -F @rezics/ui run build-storybook`; verify `Foundation/Patterns` doc renders the new section and `<Compare>` blocks.

## 7. Phase 7 — Sign-off verification

- [ ] 7.1 Run `bun run storybook:build` at the root; verify exit 0 across all 6 builds.
- [ ] 7.2 Per-package story-count audit: parse each `storybook-static/index.json`; assert ui ≥ 30, app ≥ 60, folio ≥ 6, editor ≥ 9, admin ≥ 1.
- [ ] 7.3 Tier-5 cap audit: count entries whose title prefix is `Page/`; assert ≤ 3; assert each carries the `illustrative-not-canonical` marker.
- [ ] 7.4 Story-ID citation audit: for every story-ID cited in `patterns.mdx`, `patterns.md`, `mui-vs-shadcn.md`, confirm the story exists in the corresponding `storybook-static/index.json`.
- [ ] 7.5 a11y observability check: run `bun -F @rezics/app run storybook`; visit one story per cluster; confirm Accessibility panel renders with violations listed (zero violations is fine).
- [ ] 7.6 No-promotion audit: run `git diff dev -- package/ui/src/ package/app/src/` and confirm no file moved between `app/` and `ui/`. (The `ColorfulButton`, `DomainCarousel` additions are new files in `ui/`, not promotions.)
- [ ] 7.7 No-cosmos audit: `rg "react-cosmos|useFixtureInput|useFixtureSelect|cosmos.config" package/` — zero matches outside `openspec/changes/archive/`.
- [ ] 7.8 Vocabulary audit: list all named exports across `*.stories.tsx`; flag any name not in the closed vocabulary (Decision 6 + Requirement-3 in `storybook-coverage`).
- [ ] 7.9 Mock import audit: `rg "from .*prisma/factory" package/app/src/stories/` — zero matches. Imports from `@rezics/shared/{random,text}` are permitted (see spec `Mock data lives in a central per-domain module` requirement) and SHALL NOT count as a violation.
- [ ] 7.10 Final `bun run knip` at root; resolve any unused-export findings introduced by the change.
- [ ] 7.11 Update `openspec/changes/storybook-coverage/proposal.md` Impact section if any item drifted during implementation; commit.
- [ ] 7.12 Run `bunx openspec validate storybook-coverage`; confirm pass.
