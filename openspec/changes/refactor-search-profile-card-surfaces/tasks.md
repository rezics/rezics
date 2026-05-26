## 1. Search Card Mapping

- [x] 1.1 Audit `package/app/src/search/components/FederatedResultList.tsx` result fields and define adapter helpers for content, post, realm, user, and entity documents.
- [x] 1.2 Refactor grouped federated result items to render `SearchLibraryUnitCard` or `SearchContentResultCard` instead of local row components.
- [x] 1.3 Refactor ranked federated result hits to render card-backed preview surfaces while preserving origin/category metadata.
- [x] 1.4 Refactor single-category federated results to share the same card rendering path as grouped results.
- [x] 1.5 Refactor `package/app/src/search/components/SearchResultList.tsx` default item rendering to use the canonical search card surface while preserving localized title resolution.

## 2. Search Card Behavior

- [x] 2.1 Preserve preview-only behavior for post-like search results by excluding reply, reaction, and composer controls.
- [x] 2.2 Verify long title, body, summary, and metadata strings clamp or truncate inside search cards without layout shifts.
- [x] 2.3 Verify covers, thumbnails, avatars, and fallback media have correct accessible text or decorative hiding.
- [x] 2.4 Update `package/app/src/components/card/SearchResultCards.stories.tsx` and related docs for all rendered search result categories.

## 3. Profile Card Surfaces

- [x] 3.1 Refactor `package/app/src/user/pages/ProfileOverviewPage.tsx` pinned item previews to use Card/token-aligned surfaces.
- [x] 3.2 Refactor `ProfileOverviewPage` recent activity previews to use Rezics tokens and remove raw gray/border styling.
- [x] 3.3 Refactor mobile overview stats and desktop/sidebar stat links to a shared Card/token-aligned profile stat pattern.
- [x] 3.4 Clean touched `ProfileBasicInfo` styles so follow/edit actions and follower counts use Rezics tokens instead of raw gray utilities.
- [x] 3.5 Preserve current profile navigation targets, current-user detection, follow/edit behavior, and mock overview data semantics.

## 4. Documentation and Validation

- [x] 4.1 Add or update app Storybook stories for profile stat, pinned item, and recent activity card states.
- [x] 4.2 Run `bun run format:check` and fix formatting issues in touched files.
- [x] 4.3 Run focused app tests for search/profile code paths, including existing search component tests where applicable.
- [x] 4.4 Run `bun run check:convention` to verify repo conventions and import boundaries.
- [x] 4.5 Review the final diff for accidental `package/ui` Card API changes, route changes, API contract changes, or new third-party dependencies.
