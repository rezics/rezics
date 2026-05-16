## 1. Helper module in `@rezics/ui`

- [x] 1.1 Add `package/ui/src/primitive/link/unitHref.ts` exporting the pure `unitHref(input)` function. Accept the discriminated input shape from `design.md` Decision 1 (five top-level slug-bearing types plus the SHELF variant with owner context). Return the route path as a plain string.
- [x] 1.2 Add `package/ui/src/primitive/link/useUnitHref.ts` as a thin hook wrapper that forwards a unit object to `unitHref`. The hook is sugar; the function is the contract.
- [x] 1.3 Export both from `package/ui/src/primitive/link/index.ts` and from `package/ui/src/index.ts` so consumers import via `@rezics/ui/primitive/link` and the package root.
- [x] 1.4 Add `package/ui/src/primitive/link/unitHref.test.ts` covering every type variant: USER with slug, USER without slug, REALM with/without slug, TAG with/without slug, ZONE with/without slug, ENTITY with/without slug, SHELF with owner slug + shelf slug, SHELF with owner slug + null shelf slug, SHELF with null owner slug, SHELF with null owner slug and null shelf slug.
- [x] 1.5 Add JSDoc to `unitHref` referencing `openspec/specs/public-short-routes/spec.md` and explaining that the helper is the single sanctioned link-building path for slug-bearing units.

## 2. AccountMenu headline fix

- [x] 2.1 Verify `useUserProfileStore`'s `user` shape carries `slug`. If absent, add `slug` to the store's type and to the bootstrap path (`useSyncUserProfile` or equivalent) that hydrates it from the viewer DTO. Confirm no other consumers break.
- [x] 2.2 Refactor `package/app/src/core/sections/header/AccountMenu.tsx` profile menu item (currently `to={\`/user/me\`}`) to compute its href via `unitHref({ type: 'USER', unitId: user.unitId, slug: user.slug })`. The settings menu item (`to={\`/user/me/setting/profile\`}`) is unchanged.
- [ ] 2.3 Manually verify in browser: log in as a user with a slug, click Profile in the header — address bar lands on `/u/<slug>`. Log in as a user without a slug, click Profile — address bar lands on `/user/<unitId>`.

## 3. Migrate existing inline link builders

- [x] 3.1 Replace the inline ternary in `package/app/src/excerpt/components/detail/ExcerptDetail.tsx:49` (`excerpt.user.slug ? "/u/$userSlug" : "/user/$userId"`) with `unitHref({ type: 'USER', unitId: excerpt.user.unitId, slug: excerpt.user.slug })`. Adjust the `<Link>` to use the `to` string form rather than the params object form.
- [x] 3.2 Migrate `package/app/src/user/components/UserHoverPreview.tsx` — every internal link to the previewed user routes through `unitHref`.
- [x] 3.3 Migrate `package/app/src/user/components/ProfileBasicInfo.tsx`, `ProfileTabBar.tsx`, `SettingsTabBar.tsx` — overview-tab navigation lands on `unitHref(...)`; sub-tab navigation continues to use long-prefix routes per design Decision 3 (sub-routes have no slug-side counterpart yet; documented as known asymmetry).
- [x] 3.4 Migrate `package/app/src/user/pages/UserProfilePage.tsx`, `ProfileOverviewPage.tsx`, `FollowInfoPage.tsx`, `ReactionInfoPage.tsx`, `FollowersTabSection.tsx`, `RealmsTabSection.tsx` — every link to another user routes through `unitHref`.
- [x] 3.5 Migrate `package/app/src/post/components/parts/PostAuthorHeader.tsx`, `package/app/src/book-library/components/AuthorInfo.tsx` — author bylines route through `unitHref`.
- [x] 3.6 Migrate `package/app/src/realm/components/RealmCard.tsx`, `package/app/src/realm/pages/RealmPage.tsx` — realm references route through `unitHref({ type: 'REALM', ... })`.
- [x] 3.7 Migrate `package/app/src/tag/components/TagList.tsx`, `TagCards.tsx`, `package/app/src/tag/pages/TagByUnitPage.tsx` — tag references route through `unitHref({ type: 'TAG', ... })`.
- [x] 3.8 Migrate `package/app/src/entity-self-claim/pages/MyEntitiesPage.tsx`, `NewEntityPage.tsx`, `package/app/src/routes/_mainLayout/entity/$unitId/index.tsx` — entity references route through `unitHref({ type: 'ENTITY', ... })`. Note: ENTITY slugs are inactive in v1 per `entity-slug-activation`; the helper correctly falls back to `/entity/<unitId>` until that change ships, so no behavior change today.
- [x] 3.9 Migrate `package/app/src/unit/pages/UnitPage.tsx` and `package/app/src/shared/utils/build-url.ts` — `buildUnitUrl` either delegates to `unitHref` for slug-bearing types (and falls through to its current behavior for BOOK/POST/QUOTE) or is deprecated and removed in favor of direct `unitHref` calls. Pick whichever produces fewer touchpoints; document the choice in the PR description.
- [x] 3.10 Audit `package/app/src/core/components/header/HeaderSearch.tsx`, `buildHeaderSubmitPath.ts`, and `package/app/src/search/utils/searchQuery.ts` — these build search URLs scoped to a user. The scope-search URL form (`/u/<slug>/search` vs `/user/<unitId>/search`) follows the same rule; route through `unitHref` or document a sibling helper if the search URL surface diverges.
- [x] 3.11 Sweep the remaining files reported by grep (`/user/$userId` references in `package/app/src`): `routes/_mainLayout/user/$userId/{realms,search,shelves,index,reactions,edit,followers,content}.tsx` — these are route definitions, leave untouched. `user/pages/UserEditPage.tsx` — link-build sites within edit page route through `unitHref` for any onward navigation to another public profile.

## 4. Spec delta to `public-short-routes`

- [x] 4.1 The spec delta is already authored at `openspec/changes/slug-first-unit-links/specs/public-short-routes/spec.md`. Verify scenarios match implementation: profile menu lands on `/u/<slug>` when slug known, on `/user/<unitId>` when not; long-prefix never rendered when slug is known; viewer-relative `/user/me/*` settings routes untouched.
- [x] 4.2 Cross-check that no scenario in the delta conflicts with existing requirements in `openspec/specs/public-short-routes/spec.md`. The delta is purely **ADDED Requirements**, no MODIFIED/REMOVED operations.

## 5. Query-rule audit

- [x] 5.1 Walk every slug-route loader (`_mainLayout/u/$userSlug.tsx`, `_mainLayout/t/$tagSlug.tsx`, `_mainLayout/r/$realmSlug.tsx`, `_mainLayout/e/$entitySlug.tsx`, `_mainLayout/z/$slug/...` if present) and confirm the loader resolves the slug to a DTO exactly once via the appropriate by-slug query (`userBySlugQuery`, `tagBySlugQuery`, etc.).
- [x] 5.2 For each child route or component under a slug route, confirm it reads `unitId` from the loader DTO and uses unitId-keyed queries downstream. If any child redundantly calls `/slug/resolve` or a by-slug endpoint for the same unit, fix it to read from the loader cache.
- [x] 5.3 Add a one-line note in `openspec/specs/public-short-routes/spec.md` (post-archive, when the delta merges) confirming the audit was performed — actually, this lives in the delta scenario already (`Slug route loader resolves once`). Skip if the scenario passes verification.

## 6. Validation

- [x] 6.1 Run `bun -F @rezics/ui test` — new `unitHref.test.ts` passes; no other ui tests regress.
- [x] 6.2 Run `bun -F @rezics/app test` — existing app tests pass; snapshot updates expected for any test that asserted a `/user/<uuid>` URL where a slug is now used.
- [x] 6.3 Run `bun run check:convention` from the repo root — passes with no new R-rule violations.
- [ ] 6.4 Run `bun -F @rezics/ui storybook` (port 6007) — visual smoke test on stories that render unit links (`PostAuthorHeader` story exists; check `UserHoverPreview` if it has one).
- [ ] 6.5 `bun run dev` (or `bun run app:dev` + `bun run server:dev`) — smoke test in browser: AccountMenu profile click, post author byline click, tag chip click, realm card click. Each lands on the slug URL when the target has a slug, on the unitId URL when it does not.
- [x] 6.6 `openspec validate slug-first-unit-links --strict` — passes.

## 7. Out-of-scope cleanup (do NOT do in this change)

- [x] 7.1 **Do not** introduce a client-side slug↔unitId cache (IndexedDB or otherwise). That is the follow-on `slug-client-resolver` change.
- [x] 7.2 **Do not** add slug-side counterparts for `/user/$userId/followers`, `/realms`, `/reactions`, `/content`, `/shelves`, `/edit`. The asymmetry is documented and is a separate route-table change.
- [x] 7.3 **Do not** add a `check:convention` R-rule for raw `<Link to="/user/$userId">` outside of helpers. The lint rule needs a route-folder allowlist and is a separate small follow-on.
- [x] 7.4 **Do not** add a `<UnitLink unit={…}>` component on top of `unitHref`. The helper is sufficient for v1; a wrapper component can come later if call sites prove repetitive.
