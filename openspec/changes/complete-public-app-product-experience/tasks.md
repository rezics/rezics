## 1. Route Inventory And Cleanup

- [x] 1.1 Delete `routes/_mainLayout/test.tsx`, `test02.tsx`, `test03.tsx`, `test-links.tsx` and any references in `core/components/create-menu/` and sidebar/navigation config.
- [ ] 1.2 Audit remaining `routes/_mainLayout/` entries and classify as production / staff / unauthenticated; gate staff-only routes via policy hints.
- [ ] 1.3 Define a single navigation config grouping discovery, library, community, create, and personal (`u/me/dashboard`, `u/me/drafts`, settings, inbox) sections.
- [ ] 1.4 Add route-level loading, denied, not-found, unauthenticated, and error boundaries via shared helpers, so feature pages do not redefine them.
- [ ] 1.5 Align realm tabs with Feed default, About, and moderator-only Moderation per `complete-realm-community-governance`; confirm `routes/_mainLayout/realm/$realmId/index.tsx` matches.

## 2. Dashboard

- [x] 2.1 Add `package/contract/src/dashboard.ts` with `DashboardSummary` (sections: continue-reading, shelves, realms, notifications, dms, drafts, activity, safety) and per-section `{ ok } | { error: { code, retryable } }` wrapper. The continue-reading item SHALL include `bookUnitId`, `bookTitle`, `bookCoverUrl?`, `lastReadNodeId`, `lastReadNodeTitle` (server-resolved from TOC), `lastReadAnchorText?`, `chaptersCompleted`, `chaptersTotal`, and a discriminated `resumeRoute` (`{ kind: "node" | "chapter" | "book", ... }`) so the client navigates without re-deriving the URL.
- [x] 2.2 Add `package/server/src/dashboard/` (api/service/types) that fans out to existing domain services and tolerates per-section failure without failing the whole response. The continue-reading aggregator SHALL join `UserUnitProgress` with `ContentStructureNode` (for `lastReadNodeTitle`) and aggregate `UserContentNodeProgress` per book (for `chaptersCompleted`) plus a count of non-deleted nodes (for `chaptersTotal`) in a single fan-out, not per-card client roundtrips.
- [x] 2.3 Add `package/api/src/dashboard/` typed hooks + query keys; register invalidation participation in cache-coherence map.
- [x] 2.4 Add `package/app/src/dashboard/` feature (page, sections per `DashboardSummary` slot, models, hooks, components) following `package/app/docs/feature standard.md`.
- [ ] 2.5 Mount `routes/_mainLayout/u/me/dashboard.tsx`; link from `home/sections/LibraryCardsSection` and the new personal nav.
- [ ] 2.6 Add stories/tests for partial-success rendering, empty new user, active reader, active community member, and active safety/enforcement notice states.

## 3. Cache-Coherence Map

- [x] 3.1 In `package/api/src/react-query/cache-coherence.ts`, declare a typed map keyed by mutation domain (`collect`, `follow`, `reaction`, `progress`, `node-completion`, `draft`, `dm`, `realm-membership`, `report`) → set of query-key namespaces to invalidate (detail / dashboard / profile / search / realm-feed / book-node-completion-list).
- [x] 3.2 Refactor `package/api/src/{reaction,subscription,shelf,progress,realm}/*.mutations.ts` to route invalidation through the map; ensure the `useToggleNodeCompletion` hook routes through the `node-completion` domain entry and invalidates the per-book node-completion list namespace used by the TOC sidebar.
- [x] 3.3 Add a test asserting each declared mutation domain has at least one corresponding `useQuery` namespace registered, and asserting `node-completion` invalidates both the dashboard continue-reading namespace and the per-book node-completion list namespace.

## 4. Discovery, Search, Detail

- [ ] 4.1 Upgrade `home/sections/*` and `home/pages/Home.tsx` so signed-out users see discovery and signed-in users see continuation (continue reading, shelves, realms) without scattering dashboard logic.
- [ ] 4.2 In `routes/_mainLayout/search/index.tsx`, add explicit filter-chip UI (type / realm / work-grouping) backed by stable Unit/Entity/Realm ids; persist query state in the URL.
- [x] 4.3 Add local-only search-history affordance on the search route (no server contract).
- [ ] 4.4 In book/entity/tag/profile detail surfaces, expose inspect, collect, follow, discuss, contribute, report (via new `ReportAction`), share, and DM (via new `DMAction`) where policy allows.
- [ ] 4.5 Wire collect/follow/reaction/progress mutations through the cache-coherence map so detail/dashboard/profile/search cards refresh consistently.

## 5. Library And Reading

- [ ] 5.1 Confirm shelf add/remove/reorder paths persist via typed API mutations and use the cache-coherence map.
- [ ] 5.2 Surface reading progress on reader, detail, dashboard, profile/library consistently.
- [ ] 5.3 Integrate work/release browsing on detail (release picker + language/edition filters) without depending on `introduce-api-unit-store`.
- [ ] 5.4 Add tests for shelf persistence, reorder stability, progress update fan-out, continue-reading, same-work release switching, and standalone content.
- [x] 5.5 Add bookshelf contract surface: extend `ShelfView` in `package/api/src/shelf/shelf.types.ts` with `"bookshelf"`; add `bookshelfViewConfigSchema`, `DEFAULT_BOOKSHELF_CONFIG`, `LIBRARY_KINDS`, and per-kind aspect-ratio constants in `package/contract/src/`; extend `userSettingsSchema` in `package/contract/src/user.ts` with `library.bookshelf`.
- [x] 5.6 Add `package/app/src/bookshelf-view/` feature (resolveBookshelfConfig, BookshelfGrid, BookshelfHoverPanel, UseMySettingsButton); extend `BookCard` with `showTitle?` and `aspectRatio?` props; route the `bookshelf` branch in `package/app/src/shelf/components/ShelfItemRenderer.tsx` through this feature and silently skip non-library kinds.
- [ ] 5.7 Apply the readable filter (`isLicensed === true`) by default in the dashboard library section and expose it as an opt-in toggle on standalone shelf pages; ensure non-book library kinds (`game`, `media`) are unaffected.
- [ ] 5.8 Add stories/tests: bookshelf grid breakpoint resolution (URL → viewer settings → default), "use my settings" reset, desktop-only hover preview (no preview on touch, tap navigates to detail), mixed-content shelf silently filtering non-library kinds, and readable filter toggle behavior.

## 6. Creation Workflows

- [x] 6.1 Add `routes/_mainLayout/create/index.tsx` as a unified type-selection entry that routes to existing `book/new`, `shelf/new`, `review/new`, `post/...`, `remark/...`, `realm/...` flows.
- [ ] 6.2 Add `package/contract/src/draft.ts` (`DraftMetadata` for review/post/remark/wiki/shelf-description) and a server listing/recover endpoint that reuses existing per-type draft storage.
- [ ] 6.3 Add `package/app/src/drafts/` feature and `routes/_mainLayout/u/me/drafts.tsx`; link from dashboard.
- [ ] 6.4 Build a shared policy-aware form helper that reads `PolicyDecision` codes (`MISSING_CAPABILITY`/`ENFORCEMENT_ACTIVE`/`BLOCKED_ACCOUNT`/`RATE_LIMITED`) from mutation responses and renders inline denial states instead of toast errors.
- [ ] 6.5 Apply the helper to review/post/remark/shelf/realm creation forms; ensure forms use `@rezics/contract`, `@rezics/api`, UnitTranslation language controls, and editor primitives (no app-local DTO copies).
- [ ] 6.6 Add tests for draft listing/recover, validation failure, policy denial (silenced/banned), successful publish, and work matching.
- [ ] 6.7 Document the empty-node placeholder "Create chapter" CTA (`/book/:bookId/node/:nodeId`) as a recognized chapter creation entry in the unified creation menu / contributor inventory; ensure `routes/_mainLayout/create/index.tsx` does not duplicate or hide it and that the materialization-by-nodeId code path (`useEnsureChapterUnit` accepting `nodeId`) is reused without forking a separate flow.

## 7. Engagement, Notifications, DM, Report

- [ ] 7.1 Add `engagement/components/ReportAction.tsx` backed by governance/moderation report endpoints; **do not** reuse `feedback/FeedbackDialog`. Story + tests for unauthenticated, allowed, rate-limited, and submitted states.
- [ ] 7.2 Add `engagement/components/DMAction.tsx` that consults policy to disable/hide when DM is not allowed; integrate from profile and notifications.
- [ ] 7.3 Extend `package/contract/src/notification/` items with `target: { route, params, anchor? }` so notification cards can deep-link without re-deriving routes client-side. Server emitters SHALL pick `target.route` per the link-selection policy in `app-product-navigation`: `/book/:bookId/node/:nodeId` when the event has `nodeId`, `/book/:bookId/read/:chapterId` when only the chapter Unit id is known in a book context, `/chapter/:contentUnitId` for chapter-only context.
- [ ] 7.4 Update `inbox/components/NotificationCard.tsx` to route per `kindKey` (reply → thread + anchor, follow → profile, moderation outcome → authorization-appropriate detail, realm event → realm tab).
- [ ] 7.5 Extend `package/contract/src/notify/dm.ts` with read-receipts, typing-indicator, and block/unblock-peer fields; wire into `inbox/sections/ConversationThreadSection.tsx`.
- [ ] 7.6 Surface block/unblock-peer in profile DM action and in DM thread header.

## 8. Profile, Settings

- [x] 8.1 Add follower / following list sub-pages under profile (route + sections), backed by existing subscription API.
- [ ] 8.2 Surface an activity timeline on profile using existing reaction/post/shelf events; respect privacy.
- [ ] 8.3 Add settings sub-pages for blocked users, data export, and account deletion entry points.
- [ ] 8.4 Detail notification-preference UI (per-kind toggles) on `settings/preferences`; persist through typed mutation.
- [ ] 8.5 Add a library-display preference sub-page that edits `userSettings.library.bookshelf` (breakpoint columns + showTitle) with a reset-to-default action; persist through the typed userSettings mutation.

## 9. Quality, A11y, i18n, Responsive

- [ ] 9.1 Confirm each production route defines loading / empty / error / denied / not-found / unauthenticated states.
- [ ] 9.2 Apply WCAG 2.1 AA expectations across new components: keyboard navigation, visible focus, screen-reader labels, reduced-motion respect; no state communicated by color alone.
- [ ] 9.3 Define and apply responsive breakpoints across dashboard, search, detail, shelf, profile, settings, creation, inbox.
- [ ] 9.4 Add offline retry affordance to mutations that the user explicitly triggered (collect, follow, react, send DM).
- [ ] 9.5 Add missing Traditional Chinese message keys; avoid hardcoded copy where i18n is expected.
- [ ] 9.6 Verify app pages use Rezics design tokens, `SafeLink`, shared UI primitives, and app density.

## 10. Verification

- [ ] 10.1 `bun --filter=@rezics/contract test`
- [ ] 10.2 Targeted `@rezics/server` tests for dashboard, draft listing, and report endpoints.
- [ ] 10.3 Targeted `@rezics/notify` tests for DM read-receipt / typing / block flows.
- [ ] 10.4 Targeted `@rezics/api` tests for new hooks, query keys, and cache-coherence map.
- [ ] 10.5 Targeted `@rezics/app` tests / Storybook for dashboard, search, detail, shelf, creation, drafts, notification deep-link, ReportAction, DMAction, profile (follower/timeline), and settings (blocked/export/deletion) flows.
- [ ] 10.6 `bun run check:convention`, `bun run check:tokens`, `bun run format:check`, `bun run knip`.
- [ ] 10.7 `openspec validate complete-public-app-product-experience --strict`.
