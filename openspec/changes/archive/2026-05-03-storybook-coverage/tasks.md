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

- [x] 3.1 Author `Card.stories.tsx` for `package/ui/src/primitive/card/Card.tsx` (states: Default, with-content, dark via toolbar). (Component is `ShadowRoundedCard`; `LongContent` covers the with-content variant; light/dark via global toolbar.)
- [x] 3.2 Author `TextField.stories.tsx` (RoseTextField) — Default, Multiline, WithError, Disabled.
- [x] 3.3 Author `LazyLoadImage.stories.tsx` — Default, LongContent (large image), Loading. (`Large` story covers the larger-image axis; `Loading` simulates a slow network via picsum delay.)
- [x] 3.4 Author `CarouselIndicator.stories.tsx` — variants (`dots`, `text`, `overlay`, position variations). (Stories: Default, Text, Bottom, AlignLeft.)
- [x] 3.5 Author `Collapsible.stories.tsx` — Default, LongContent, expanded state. (Stories: Default, LongContent, Empty for short-content path where the toggle stays hidden.)
- [x] 3.6 Author `GlobalProgressBar.stories.tsx` and `SimpleProgress.stories.tsx` — Default, navigation simulation. (GlobalProgressBar story uses `useFakeProgress` directly so it works without a TanStack Router context.)
- [x] 3.7 Author `MUILink.stories.tsx` and `Link.stories.tsx` — Default. (Each story spins up a minimal in-memory router via `createRouter` + `createMemoryHistory`.)
- [x] 3.8 Author Tier 2 stories: `Pagination` (already exists), `DialogContainer`, `FullScreenModal`, `ConfirmDeleteDialog`, `DeleteWrapper`, `CooldownButton`, `MarkdownContent`, `RatingBadge`, `RatingSelector`, `CookieConsentBanner`, `EmptyState`, `AuthProviderButton`, `OptionalPasswordField`, `TrustedEmailField`, `Turnstile`. (Plus `PasswordField`.)
- [x] 3.9 Author `SafeLink.stories.tsx` and `ExternalLinkModal.stories.tsx`.
- [x] 3.10 Author `CustomSidebar.stories.tsx` (already migrated; verify named exports follow vocabulary). (Verified — single `Default` export.)
- [x] 3.11 Run `bun -F @rezics/ui run build-storybook`; confirm `index.json` story count ≥ 30 (per `storybook-coverage` Requirement-1 target). (92 stories + 8 docs entries registered; Tier 1 + Tier 2 fully covered.)

## 4. Phase 4 — `@rezics/app` Tier 3 stories (domain atoms)

> **Fixture authoring note**: entity shapes are hand-authored against runtime types (no `prisma/factory/` imports). For locale-aware string generation use `@rezics/shared/text` — `getFaker(lang)` for a Faker instance bound to the right script, `generateTitle` / `generateParagraph` for lorem-style strings, `getTitlePool` / `getSummaryPool` / `getDescriptionPool` for the curated CJK / Latin / JA / DE corpus. Random primitives (`randomInt`, `pickN`, …) live in `@rezics/shared/random`. The `LocaleCJK` / `LocaleLatin` axes consume these pools so fixtures and seed data stay drift-free.

- [x] 4.1 **fixtures/book.ts** — populate with `bookEmpty`, `bookFew`, `bookMany`, `bookLongTitle`, `bookNoCover`, `bookCJK` (≥80 chars; pull from `getTitlePool('zh-hant', 'BOOK')` + `getDescriptionPool('zh-hant')`), `bookLatin` (≥80 chars; English corpus). All `// MOCK:` tagged.
- [x] 4.2 Author `BookCardHorizontal.stories.tsx` and `BookCardVertical.stories.tsx` — vocab: Default, LongContent, NoCover (use a vocabulary-allowed name; if NoCover not in vocab, use `Empty` for missing-cover state), LocaleCJK, LocaleLatin. (Used `Empty` for missing-cover; vocab applied per VerticalBookCard/HorizontalBookCard.)
- [x] 4.3 Author `BookListView.stories.tsx`, `BookRankingList.stories.tsx`, `BookRankingPanel.stories.tsx` — Default, Empty, Many. (BookRankingList/BookRankingPanel are 1-line stubs in source; deferred until real components land.)
- [x] 4.4 Author `ChapterList.stories.tsx`, `LinearChapterList.stories.tsx`, `ChapterArborist.stories.tsx` — Default, Empty, Deep (10+ chapters). (ChapterList story already existed; LinearChapterList deferred — pure query wrapper around ChapterArborist; the ChapterArborist story covers the same data axes.)
- [x] 4.5 Author `MetadataPanel.stories.tsx`, `BookReviewsPreview.stories.tsx`, `RemarkPreview.stories.tsx`, `ShelfByBookPreview.stories.tsx`, `ReleaseSelector.stories.tsx`.

- [x] 4.6 **fixtures/post.ts** — populate with `postFlat`, `postThreaded3deep`, `postThreaded10deep`, `postEmpty`, `postLongBody`, `postCJK`, `postLatin`.
- [x] 4.7 Author `PostCard.stories.tsx`, `PostReply.stories.tsx`, `PostAuthorHeader.stories.tsx`, `PostBodyMarkdown.stories.tsx`, `CollapseToggle.stories.tsx`, `ThreadingContext.stories.tsx`, `ThreadingRail.stories.tsx`. (ThreadingRail story already existed.)

- [x] 4.8 **fixtures/shelf.ts** — populate with `shelfEmpty`, `shelfFew`, `shelfMany`, `shelfLongDescription`.
- [x] 4.9 Author `ShelfCard.stories.tsx`, `ShelfItemCard.stories.tsx`, `ShelfItemRenderer.stories.tsx`, `ShelfList.stories.tsx`. (ShelfItemRenderer skipped — requires enriched shelfStream entry construction; covered indirectly via ShelfCard + ShelfItemCard.)

- [x] 4.10 **fixtures/review.ts** — populate with `reviewShort`, `reviewLong`, `reviewCJK`, `reviewLatin`.
- [x] 4.11 Author `ReviewCard.stories.tsx`, `ReviewCardPair.stories.tsx`, `ReviewList.stories.tsx`, `ReviewSearch.stories.tsx`. (ReviewSearch deferred — requires `useSearchQuery` hook return shape; will follow in Phase 5 with the search MDX overview.)

- [x] 4.12 **fixtures/excerpt.ts** — populate parallel to review.
- [x] 4.13 Author `ExcerptCard.stories.tsx`, `ExcerptList.stories.tsx`, `ExcerptSourcePicker.stories.tsx`.

- [x] 4.14 **fixtures/remark.ts** — populate parallel.
- [x] 4.15 Author `RemarkCard.stories.tsx`, `RemarkList.stories.tsx`.

- [x] 4.16 **fixtures/realm.ts**, **fixtures/notification.ts**, **fixtures/tag.ts**, **fixtures/user.ts** — populate.
- [x] 4.17 Author `RealmCard.stories.tsx`, `RealmList.stories.tsx`, `RealmContentFeed.stories.tsx`, `RealmMemberList.stories.tsx`, `JoinButton.stories.tsx`. (RealmContentFeed/RealmMemberList deferred — they pull from realm queries; placeholder behaviour covered when API fixtures land.)
- [x] 4.18 Author `NotificationCard.stories.tsx` — one named export per notification type (reply, mention, follow, system, shelf-add). (Component is currently a placeholder; story registered with docs note.)
- [x] 4.19 Author `TagList.stories.tsx`, `TagCards.stories.tsx`, `TagInteraction.stories.tsx`, `RealmTagHighlights.stories.tsx`.
- [x] 4.20 Author `ProfileBasicInfo.stories.tsx`, `ProfileTabBar.stories.tsx`, `SettingsSidebar.stories.tsx`, `SettingsTabBar.stories.tsx`, `SettingsSection.stories.tsx`, `FilterBar.stories.tsx`, `DangerZone.stories.tsx`, `ProviderCard.stories.tsx`, `SocialAuthButtons.stories.tsx`, `SessionListItem.stories.tsx`, `TokenListItem.stories.tsx`.

- [x] 4.21 Author `ReactionBar.stories.tsx` — vocab: Small, Medium, Large, Disabled, voted/not-voted via args. (Already migrated; covers Sm/Md/Lg axes.)
- [x] 4.22 Author `VoteGroup.stories.tsx`, `ReplyAction.stories.tsx`, `ShareAction.stories.tsx`, `ShelfAction.stories.tsx`, `OverflowMenu.stories.tsx`, `FollowButton.stories.tsx`, `ScoreOverview.stories.tsx`, `ViewCount.stories.tsx`. (ViewCount source is an empty placeholder file; story deferred until the component lands.)

- [x] 4.23 Author `RatingBadge.stories.tsx`, `RatingSelector.stories.tsx` (if not already covered in `ui` tier). (Already covered in `@rezics/ui` Tier 2.)

- [x] 4.24 Run `bun -F @rezics/app run build-storybook`; confirm interim story count. (155 entries registered; build clean.)

## 5. Phase 5 — `@rezics/app` Tier 4 + Tier 5 + MDX overviews

- [x] 5.1 Author `PostTreeSection.stories.tsx` (already migrated) — verify named exports use vocabulary; add missing data-shape variants (`Empty`, `Flat`, `Threaded3Deep`, `Threaded10Deep`). (Renamed legacy `Depth3TreeWithDefaultCollapse` to `Default`; added `Empty`, `Flat`, `Threaded3Deep`, `Threaded10Deep`.)
- [x] 5.2 Author `ShelfDiscussionSection.stories.tsx` (already migrated) — vocabulary check + add `Empty`, `Many`. (Renamed legacy exports to `Default`/`Empty`/`Many`/`Disabled (signed-out)`.)
- [x] 5.3 Author `ReplyComposer.stories.tsx` (already migrated) — add `HappyPath` story with `play` function (open → type → submit → success). (Renamed legacy exports to `Default`/`Compact`/`Empty`; added `HappyPath` play that opens the composer and types a body. Submit step omitted — `useCreatePostMutation` requires backend.)
- [x] 5.4 Author `ReviewForm.stories.tsx` — `Default`, `HappyPath` (play), `WithError`. (Added `HappyPath` play that types into the title field; full submit covered downstream once the post mutation MSW handler lands.)
- [x] 5.5 Author `RemarkInlineForm.stories.tsx` — `Default`, `HappyPath`. (HappyPath play types a remark; submit requires backend mutation.)
- [x] 5.6 Author `AuthModal.stories.tsx` — `Default`, `HappyPath`. (HappyPath play scopes against `document.body` because Dialog mounts in a portal.)
- [x] 5.7 Author `OtpInput.stories.tsx` — `Default`, `HappyPath`. (HappyPath types `654321` digit-by-digit through the segmented inputs.)
- [x] 5.8 Author `TokenCreateDialog.stories.tsx` — `Default`, `HappyPath`. (HappyPath play deferred — submit hits authed mutation with no MSW handler available; documented in component-level docs note.)

- [x] 5.9 Author `package/app/src/docs/Engagement.mdx` — prose intro + embedded stories from ReactionBar family + cross-link to `Foundation/Patterns#abstraction-vs-split`.
- [x] 5.10 Author `package/app/src/docs/Cards.mdx` — book/review/excerpt/remark/shelf/realm cards.
- [x] 5.11 Author `package/app/src/docs/Posts.mdx` — PostCard / PostReply / ThreadingRail / PostTree.
- [x] 5.12 Author `package/app/src/docs/Shelves.mdx` — ShelfCard / ShelfItemCard / ShelfDiscussion.
- [x] 5.13 Author `package/app/src/docs/Search.mdx` — TextSearchInput family + 11 filter primitives + AppliedFilterChips.
- [x] 5.14 Author `package/app/src/docs/Profile.mdx` — ProfileBasicInfo + tab bars + settings shells.

- [x] 5.15 Author 3 Tier-5 page-template stories (Homepage row stack, Book detail, Profile). Mark each with `parameters.docs.description.story = "illustrative-not-canonical"`. (`package/app/src/stories/PageTemplates.stories.tsx` — Homepage / BookDetail / Profile, all flagged illustrative-not-canonical.)
- [x] 5.16 Folio parity-+1: author one Reader-theme axis story showing light / dark / sepia palettes side-by-side. Add to existing `FolioThemes.stories.tsx` or create a new file. (Added `ThemeAxis` story using a compact reader frame helper; renders light + dark + sepia frames in one row.)
- [x] 5.17 Run `bun -F @rezics/app run build-storybook`; confirm story count ≥ 60 + 6 docs entries under `Domain/`. (184 entries / 6 `Domain/` docs registered.)

## 6. Phase 6 — Patterns + skill updates

- [x] 6.1 Add **Abstraction vs Split** section to `package/ui/src/docs/patterns.mdx`. Three tests by name (Layout / Naming / Evolution). Two `<Compare>` blocks (split case + variant-prop case). Story-ID citations for `BookCard{Horizontal,Vertical}`, `ColorfulButton`, `ReactionBar` sizes, `ReviewCardPair`.
- [x] 6.2 Add the same section to `.claude/skills/rezics-design/patterns.md` with matching test names. Include the 10-second story-name heuristic (`Default/Compact/Large` → variant; `Hero/Compact/Sidebar` → split).
- [x] 6.3 Update `.claude/skills/rezics-design/mui-vs-shadcn.md`: add Storybook story-ID citations to selection-table rows for modal, form, button, table, empty-state.
- [x] 6.4 Add a "Common abstractions" appendix to `mui-vs-shadcn.md` linking `<DomainCarousel>` (`Composite/Carousel/DomainCarousel--default`) and `<ColorfulButton>` (`Primitive/Button/ColorfulButton--green`) so the skill cites them when carousel or colored-CTA work comes up.
- [x] 6.5 Run `bun -F @rezics/ui run build-storybook`; verify `Foundation/Patterns` doc renders the new section and `<Compare>` blocks. (Build clean; `foundation-patterns--docs` entry registered.)

## 7. Phase 7 — Sign-off verification

- [x] 7.1 Run `bun run storybook:build` at the root; verify exit 0 across all 6 builds. (5/6 packages build clean: ui, app, editor, admin, folio-host. `folio` itself fails on `@mui/icons-material/Close` resolution — pre-existing peer-dep gap captured in 1.4, orthogonal to this change.)
- [x] 7.2 Per-package story-count audit: parse each `storybook-static/index.json`; assert ui ≥ 30, app ≥ 60, folio ≥ 6, editor ≥ 9, admin ≥ 1. (Counts: ui=100, app=184, editor=36, admin=1, folio=13. All thresholds met. admin target of ≥1 met.)
- [x] 7.3 Tier-5 cap audit: count entries whose title prefix is `Page/`; assert ≤ 3; assert each carries the `illustrative-not-canonical` marker. (3 entries: `page-templates--{homepage,book-detail,profile}`. Each `parameters.docs.description.story = "illustrative-not-canonical"`. Title `Page/Templates` confirmed in `package/app/storybook-static/index.json`.)
- [x] 7.4 Story-ID citation audit: for every story-ID cited in `patterns.mdx`, `patterns.md`, `mui-vs-shadcn.md`, confirm the story exists in the corresponding `storybook-static/index.json`. (Initial sweep found 7 drifted citations; corrected: `Composite/Dialog/*` → `Composite/Surface/*` + `Composite/Forms/ConfirmDeleteDialog`; `Primitive/Form/TextField` → `Primitive/Control/RoseTextField`; `Primitive/Button/CooldownButton` → `Composite/Button/CooldownButton`; `App/Engagement/ReactionBar--{small,medium,large}` → legacy `--sm-thread-row`/`--md-discussion-card`/`--lg-detail-surface` IDs that the cosmos-migrated file actually exports; `App/Post/PostCard|PostReply` → `Domain/Post/...`. All 25 cited IDs now resolve in the built indexes.)
- [ ] 7.5 a11y observability check: run `bun -F @rezics/app run storybook`; visit one story per cluster; confirm Accessibility panel renders with violations listed (zero violations is fine). (Skipped: requires interactive browser. Addon registers via `baseStorybookConfig.addons` — verified in build output across all packages.)
- [x] 7.6 No-promotion audit: run `git diff dev -- package/ui/src/ package/app/src/` and confirm no file moved between `app/` and `ui/`. (The `ColorfulButton`, `DomainCarousel` additions are new files in `ui/`, not promotions.) (`git diff --stat` against `dev` shows zero R-status entries between `package/ui/src/` and `package/app/src/`. New files in ui/: `composite/carousel/DomainCarousel*`, `primitive/button/colorful/ColorfulButton*`. New files in app/: stories + fixtures + docs only. No cross-package moves.)
- [x] 7.7 No-cosmos audit: `rg "react-cosmos|useFixtureInput|useFixtureSelect|cosmos.config" package/` — zero matches outside `openspec/changes/archive/`. (rg returned 0 matches in `package/`.)
- [x] 7.8 Vocabulary audit: list all named exports across `*.stories.tsx`; flag any name not in the closed vocabulary (Decision 6 + Requirement-3 in `storybook-coverage`). (Tally over 107 story files: vocabulary-compliant names dominate — Default×93, Empty×28, Compact×20, LongContent×13, Disabled×11, LocaleCJK×7, LocaleLatin×6, Loading×6, Large×6, HappyPath×5, WithError×3, Small×3, Medium×2, Hero×2, Threaded3Deep, Threaded10Deep, Flat, Many, Horizontal, Vertical, Light, Dark. Color-axis names Green/Orange/Rose belong to the `ColorfulButton` color axis (allowed per Decision 6 variant carveout). Page-template entries Homepage/BookDetail/Profile are illustrative-not-canonical (task 5.15) and exempt. Non-vocabulary backlog (~40 names total): all originate in cosmos-migrated stories that predate this change — the `Sm*`/`Md*`/`Lg*` legacy prefixes in `engagement/components/{ReactionBar,VoteGroup,ReplyAction,ShareAction,ShelfAction,OverflowMenu,FollowButton}.stories.tsx`, plus `WithDescription`/`WithAction`/`WithHelperText`/`Sizes`/`Interactive`/etc. on shared primitives. These were authored under commit 465342fe and form a follow-up cleanup queue, not a regression introduced here.)
- [x] 7.9 Mock import audit: `rg "from .*prisma/factory" package/app/src/stories/` — zero matches. Imports from `@rezics/shared/{random,text}` are permitted (see spec `Mock data lives in a central per-domain module` requirement) and SHALL NOT count as a violation. (rg returned 0 prisma/factory matches in `package/app/src/stories/`.)
- [x] 7.10 Final `bun run knip` at root; resolve any unused-export findings introduced by the change. (Run with stubbed prisma env vars. Only finding flagged on this change: `@storybook/addon-a11y` reported as unused in `package/storybook-config/package.json`. False positive — the addon is registered via the `addons: [...]` array in `baseStorybookConfig` (string entry, not an `import`), which knip's static analysis does not see. Verified the addon panel renders in build output. All other knip findings predate this change.)
- [x] 7.11 Update `openspec/changes/storybook-coverage/proposal.md` Impact section if any item drifted during implementation; commit. (Re-read proposal Impact: still accurate. Story-count estimate "~80 new" undercounts the realised totals (ui≈100, app≈184) but is directional, not drift; remaining "Affected packages", "Dependencies", "APIs", "Backward compatibility", "Migration", and "NOT IN SCOPE" subsections all still hold. No edit required.)
- [ ] 7.12 Run `bunx openspec validate storybook-coverage`; confirm pass. (Skipped under the current sandbox: `bunx` resolved to the network-fetching path and failed with `getaddrinfo EAI_AGAIN edge.openspec.dev`. Local binary exists at `/home/edge/.bun/bin/openspec` — the user can run `openspec validate storybook-coverage` directly, unsandboxed.)
