## 1. Shared Layout Components

- [ ] 1.1 Create `TwoColumnLayout` component at `package/app/src/user/component/TwoColumnLayout.tsx` — responsive layout with sidebar (left) and main (right) on desktop, stacked on mobile. Uses CSS grid/flex with `md:` breakpoint.
- [ ] 1.2 Create `FilterBar` component at `package/app/src/user/component/FilterBar.tsx` — generic filter bar accepting a config object that defines which controls to render (search input, dropdowns for status/visibility/sort). Persists values to URL search params.
- [ ] 1.3 Create `InnerFilterPanel` component at `package/app/src/user/component/InnerFilterPanel.tsx` — renders L2 MUI Chip group (filled active, outlined inactive) + delegates to FilterBar below. Accepts chip definitions and active value, updates URL search params.

## 2. Profile Header Variants

- [ ] 2.1 Create `ProfileHeaderFull` component at `package/app/src/user/component/ProfileHeaderFull.tsx` — large centered avatar (96px), display name, @slug, bio, follower/following counts, Edit profile / Settings / Follow buttons. Used on mobile Overview.
- [ ] 2.2 Create `ProfileHeaderCompact` component at `package/app/src/user/component/ProfileHeaderCompact.tsx` — single row: small avatar (24px), name, @slug. Clickable to navigate back to Overview. Used on mobile non-Overview tabs.
- [ ] 2.3 Create `ProfileHeaderDefault` component at `package/app/src/user/component/ProfileHeaderDefault.tsx` — horizontal layout: medium avatar (64px) left, name/slug/bio/stats/actions right. Used on desktop all tabs.

## 3. Profile Shell and Route Structure

- [ ] 3.1 Create `ProfileTabBar` component at `package/app/src/user/component/ProfileTabBar.tsx` — MUI Tabs with underline indicator, route-driven active state. Tabs: Overview, Content, Shelves, Realms, Followers, Reactions. Horizontally scrollable on mobile via `variant="scrollable"`.
- [ ] 3.2 Create `ProfileShell` component at `package/app/src/user/component/ProfileShell.tsx` — composes ProfileTabBar + responsive header variants + `<Outlet />`. Fetches user data via `userQueries.detail(unitId)` or `userQueries.me()` and provides to children via route context.
- [ ] 3.3 Create layout route file `package/app/src/routes/_mainLayout/user/$unitId/route.tsx` — renders ProfileShell, loads user data in `beforeLoad` or `loader`.
- [ ] 3.4 Create index route `package/app/src/routes/_mainLayout/user/$unitId/index.tsx` — renders the Overview tab (ProfileOverviewPage).
- [ ] 3.5 Create tab routes: `content.tsx`, `shelves.tsx`, `realms.tsx`, `followers.tsx`, `reactions.tsx` under `package/app/src/routes/_mainLayout/user/$unitId/`.
- [ ] 3.6 Update `/user/me` routes to redirect to `/user/<currentUserUnitId>` — modify `package/app/src/routes/_mainLayout/user/me/index.tsx` and related files.
- [ ] 3.7 Add legacy route redirects: `/user/me/follow` → `../followers`, `/user/me/bookmark` → `../`, `/user/me/reaction` → `../reactions`.

## 4. Overview Tab

- [ ] 4.1 Create `OverviewSidebar` component at `package/app/src/user/component/OverviewSidebar.tsx` — stats card (shelf/review/book/remark/quote counts with clickable links to tabs), keywords display (chips from `userQueries.keywords`), realm memberships list.
- [ ] 4.2 Create `OverviewMain` component at `package/app/src/user/component/OverviewMain.tsx` — pinned items grid (2-col mobile, 3-col desktop) and recent activity list. MOCK: pinned = first 6 published units, activity = latest units sorted by publishedAt.
- [ ] 4.3 Create `ProfileOverviewPage` at `package/app/src/user/page/ProfileOverviewPage.tsx` — composes TwoColumnLayout with OverviewSidebar and OverviewMain.

## 5. Content Tab

- [ ] 5.1 Create `ContentTabSection` at `package/app/src/user/section/ContentTabSection.tsx` — renders InnerFilterPanel with PostKind chips (Reviews, Remarks, Quotes, Posts) + FilterBar (search, status, visibility, sort). Fetches posts via `postSearchQuery` with `authorUserId` + `kind` + filters from URL search params.
- [ ] 5.2 Integrate existing `ReviewList`, `QuoteExcerptListContainer` components or create unified post list item component for displaying posts across all kinds.
- [ ] 5.3 Add empty state rendering per kind ("No reviews yet", "No results match your search").
- [ ] 5.4 Wire up pagination using existing `UniversalPaginator` pattern.

## 6. Shelves Tab

- [ ] 6.1 Create `ShelvesTabSection` at `package/app/src/user/section/ShelvesTabSection.tsx` — renders InnerFilterPanel with dynamically generated kindKey chips + FilterBar (search, sort). Fetches shelves via `shelfListQuery` with `userId` + `kindKey` filters.
- [ ] 6.2 Create shelf card component or reuse existing `ShelfListView` for the responsive shelf grid display.
- [ ] 6.3 Add empty state and pagination.

## 7. Realms Tab

- [ ] 7.1 Create `RealmsTabSection` at `package/app/src/user/section/RealmsTabSection.tsx` — renders InnerFilterPanel with Joined/Created chips. "Joined" uses realm membership query with userId, "Created" uses realm list query with userId as owner.
- [ ] 7.2 Create realm list item display (name, description, member count, public/official badges) or reuse existing realm card components.
- [ ] 7.3 Add empty state for both filters.

## 8. Followers Tab

- [ ] 8.1 Create `FollowersTabSection` at `package/app/src/user/section/FollowersTabSection.tsx` — renders InnerFilterPanel with "Followers (N)" / "Following (N)" chips. Fetches via `userQueries.followers(unitId)` or `userQueries.followings(unitId)`.
- [ ] 8.2 Create user list item component: avatar, name, @slug, bio snippet, Follow/Unfollow button (on own profile).
- [ ] 8.3 Wire up pagination (20 per page) and empty states.

## 9. Reactions Tab

- [ ] 9.1 Create `ReactionsTabSection` at `package/app/src/user/section/ReactionsTabSection.tsx` — renders disabled L2 chips (Given / Received) and a placeholder message "Reaction history is coming soon". Annotate with `// MOCK:` comments.

## 10. Cleanup and Validation

- [ ] 10.1 Remove or deprecate old components: `UserPage.tsx`, `UserProfilePage.tsx`, `UserEditPage2.tsx`, `UserUnitsPage.tsx`, `FollowInfoPage.tsx`, `ReactionInfoPage.tsx`. Keep `UserEditPage.tsx` temporarily until settings-page change lands.
- [ ] 10.2 Update all internal links and navigations that reference old profile routes (grep for `/user/me/follow`, `/user/me/edit`, `/user/me/bookmark`, `/user/me/reaction`).
- [ ] 10.3 Verify build passes: `bun run app:dev` starts without errors.
- [ ] 10.4 Test responsive behavior: verify mobile Overview (full header), mobile Content tab (compact header), and desktop (default header) all render correctly.
- [ ] 10.5 Verify all L1 tab navigations work and L2 chip filters correctly update URL search params and refetch data.
