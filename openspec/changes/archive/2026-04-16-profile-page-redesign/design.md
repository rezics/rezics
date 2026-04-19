## Context

The current profile page (`UserProfilePage.tsx`) is a single MUI Card that displays user info, with a sibling Card for navigation links (bookmarks, follow, reactions). Editing is handled by toggling `isEditing` state in `UserPage.tsx`, which swaps the entire view to `UserEditPage.tsx`. Content is shown via `UserUnitsPage.tsx` with hardcoded tabs for SHELF, REVIEW, BOOK, REMARK, QUOTE. Follow info lives in a separate route (`/user/me/follow`). There is no unified profile experience — each sub-page is its own isolated route with no shared context.

The redesign replaces all of this with a GitHub-style tabbed profile driven by TanStack Router file-based routing, using MUI components per project conventions.

## Goals / Non-Goals

**Goals:**
- Unified profile page with L1 tab navigation at the top, user info below tabs, and route-driven content area
- Responsive design: mobile-first with compact user info on non-Overview tabs, full info on Overview
- L2 chip-based sub-filters within Content, Shelves, Realms, and Followers tabs
- Full filter bar integration (search, status, visibility, sort) leveraging existing contract query schemas
- Reusable layout components (ProfileShell, InnerFilterPanel, TwoColumnLayout)
- Absorb standalone pages (FollowInfoPage, UserUnitsPage) into profile tabs

**Non-Goals:**
- Settings/edit page (separate `settings-page` change)
- Backend API changes — all features use existing endpoints
- Activity stream / contribution graph backend (MOCK in Overview)
- Pinned items API (MOCK — use favorited shelf items or hardcoded)

## Decisions

### 1. Route structure: nested layout route with tab outlets

**Decision:** Use a TanStack Router layout route at `/user/$unitId` that renders the `ProfileShell` (tab bar + user info), with child routes for each tab.

**Rationale:** File-based routing with a layout route means the shell (tabs + user info) renders once, tab content swaps via `<Outlet />`. This matches how TanStack Router is used elsewhere in the app and enables deep-linking to specific tabs.

**Route tree:**
```
routes/_mainLayout/user/$unitId/
  route.tsx          → layout: ProfileShell
  index.tsx          → Overview tab
  content.tsx        → Content tab (with search param for inner filter)
  shelves.tsx        → Shelves tab
  realms.tsx         → Realms tab
  followers.tsx      → Followers tab
  reactions.tsx      → Reactions tab
```

The `/user/me` route becomes a redirect to `/user/<currentUserUnitId>`.

**Alternative considered:** Keep `/user/me/` as a separate route tree. Rejected because it duplicates the entire profile structure — using a single `/user/$unitId` tree with current-user detection is cleaner.

### 2. L1 tabs: MUI Tabs at page top, L2: MUI Chip group

**Decision:** L1 navigation uses `<Tabs>` with underline indicator, driven by the current route. L2 sub-filters use `<Chip>` components (filled for active, outlined for inactive), driven by URL search params.

**Rationale:** Visually distinct tab levels prevent user confusion — tabs for navigation, chips for filtering. This matches the explore-mode discussion conclusion. Chips integrate naturally with the filter bar that follows them.

**L2 search param encoding:**
- Content tab: `?kind=REVIEW` (default: REVIEW)
- Shelves tab: `?kindKey=reading-list` (default: all)
- Realms tab: `?filter=joined` (default: joined)
- Followers tab: `?filter=followers` (default: followers)

### 3. User info: adaptive rendering based on tab and viewport

**Decision:** The `ProfileShell` layout route renders user info between the tab bar and the outlet. On mobile, Overview shows `ProfileHeaderFull` (large avatar, bio, stats, actions), other tabs show `ProfileHeaderCompact` (single row: small avatar + name + slug). On desktop, all tabs show `ProfileHeaderDefault` (medium avatar, name, slug, bio, stats, actions in a horizontal layout).

**Implementation:**
```tsx
// In ProfileShell (layout route component)
<ProfileTabBar />
<div className="hidden md:block">
  <ProfileHeaderDefault user={user} isCurrentUser={isCurrentUser} />
</div>
<div className="md:hidden">
  {isOverviewTab
    ? <ProfileHeaderFull user={user} isCurrentUser={isCurrentUser} />
    : <ProfileHeaderCompact user={user} />}
</div>
<Outlet />
```

**Rationale:** Mobile needs to maximize content area — compact header on work tabs saves ~150px of vertical space. Desktop has room for a consistent medium header. The `isOverviewTab` check uses the current route match.

**Alternative considered:** Always show full header with scroll-to-collapse. Rejected — adds complexity (intersection observer / scroll state) for marginal benefit, and the compact approach is simpler and more predictable.

### 4. Overview tab: two-column layout with sidebar

**Decision:** Desktop uses a reusable `<TwoColumnLayout sidebar={...} main={...} />` component. Sidebar contains stats card, keywords cloud, realm badges. Main contains pinned items grid and recent activity list. Mobile stacks sidebar below header, then main content.

**Data sources:**
- Stats: derived from content search counts (query with `userId` + `type` filter, `limit=0` to get `total` only)
- Keywords: `userApi.getKeywords()` (GET /users/me/keywords)
- Realms: realm search with `userId` filter
- Pinned items: MOCK (use first 6 published units from content search)
- Recent activity: MOCK (use latest published units sorted by `publishedAt`)

### 5. Content tab: PostKind-based chip filters + full filter bar

**Decision:** The Content tab renders a chip group for PostKind (Reviews, Remarks, Quotes, Posts) as L2 navigation, followed by a `<FilterBar>` component with search input, status dropdown, visibility dropdown, and sort dropdown. Content is fetched via `postSearchQuery` with `authorUserId` + `kind` + user-selected filters.

**Filter bar config per inner tab:**

| Filter | Reviews                  | Remarks               | Quotes    | Posts                 |
| ------ | ------------------------ | --------------------- | --------- | --------------------- |
| Search | body text                | body text             | body text | body text             |
| Status | DRAFT/PUBLISHED/ARCHIVED | same                  | same      | same                  |
| Sort   | createdAt, replyCount    | createdAt, replyCount | createdAt | createdAt, replyCount |

**FilterBar component** is generic and reusable — it accepts a config object defining which filters to show and their options.

### 6. Shelves tab: shelf grid with kindKey filter

**Decision:** Uses `shelfListQuery` with `userId` filter. L2 chips are dynamically generated from the distinct `kindKey` values returned, plus an "All" chip. Shelf items are displayed in a responsive card grid (2 columns mobile, 3-4 desktop).

### 7. Component architecture and file structure

**Decision:** New components live under `package/app/src/user/` following the existing feature layering:

```
user/
  component/
    ProfileHeaderFull.tsx
    ProfileHeaderCompact.tsx
    ProfileHeaderDefault.tsx
    ProfileTabBar.tsx
    ProfileShell.tsx
    InnerFilterPanel.tsx     (chips + filter bar, reusable)
    FilterBar.tsx            (search + dropdowns, generic)
    TwoColumnLayout.tsx      (sidebar + main, responsive)
    OverviewSidebar.tsx
    OverviewMain.tsx
  section/
    ContentTabSection.tsx
    ShelvesTabSection.tsx
    RealmsTabSection.tsx
    FollowersTabSection.tsx
    ReactionsTabSection.tsx
  page/
    ProfileOverviewPage.tsx  (new)
    (UserProfilePage.tsx — deleted)
    (UserEditPage.tsx — deleted)
    (UserEditPage2.tsx — deleted)
    (UserPage.tsx — deleted)
    (FollowInfoPage.tsx — deleted, absorbed into FollowersTabSection)
    (UserUnitsPage.tsx — deleted, absorbed into Content/Shelves tabs)
```

## Risks / Trade-offs

**[Route migration breaks existing links]** → Add redirect routes from old paths (`/user/me/follow` → `/user/<id>/followers?filter=followers`, `/user/me/edit` → `/user/<id>/setting/profile` via settings-page change). Keep redirects for at least one release cycle.

**[Overview data requires multiple queries]** → Stats, keywords, realms, and recent activity each need a separate query. Use `React.Suspense` boundaries per section so the page loads progressively. The queries are lightweight (counts and small lists).

**[MOCK items in Overview (pinned, activity)]** → Annotate with `// MOCK:` per project convention. These are display-only — no user expectation of persistence. Replace when backend activity stream API is available.

**[L2 chip state in URL search params]** → May cause URL noise. Mitigated by using sensible defaults (omit param when default is selected) and `replaceState` navigation to avoid polluting browser history.

**[Deleting UserEditPage before settings-page is implemented]** → Keep UserEditPage temporarily; mark as deprecated. Remove only after settings-page change lands. The profile page "Edit profile" button should link to `/user/me/setting/profile` — if settings-page isn't implemented yet, link to the legacy edit route with a TODO comment.
