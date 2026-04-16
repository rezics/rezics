## Why

The current user profile page (`UserProfilePage`) has a poor layout — all information is crammed into MUI Cards, technical details like Unit ID are exposed, navigation is a row of inline buttons, and the edit mode is a full-page swap via local state rather than proper routing. The page lacks the structure, discoverability, and content depth expected of a modern profile experience. Redesigning it to follow a GitHub-inspired layout with top-level tab navigation, responsive two-column overview, and nested content management tabs will dramatically improve usability and surface existing backend capabilities that are currently invisible to users.

## What Changes

- **Replace the current profile page layout** with a GitHub-style tabbed profile page where the L1 tab bar sits at the very top of the page, followed by a user info section (full on Overview, compact on other tabs), then tab content below.
- **Add an Overview tab** with a two-column layout (desktop) showing stats, keywords, realm memberships, pinned items, and recent activity — collapsing to a single column on mobile.
- **Add a Content tab** with L2 chip-style sub-filters (Reviews, Remarks, Quotes, Posts) plus a full filter bar (search, status, visibility, sort) powered by the existing post/content search contracts.
- **Add a Shelves tab** with L2 chip filters by shelf kind, search, and sort — using the existing shelf list and shelf items contracts.
- **Add a Realms tab** with L2 chips (Joined / Created) showing the user's realm memberships and owned realms.
- **Add a Followers tab** with L2 chips (Followers / Following) replacing the current standalone `FollowInfoPage`.
- **Add a Reactions tab** (placeholder/MOCK for now — backend history endpoint not yet available).
- **Remove `UserPage`, `UserEditPage`, `UserEditPage2`** — the edit-mode state toggle and prototype settings page are replaced by proper routing to the settings page (separate change).
- **Introduce responsive behavior**: mobile uses horizontally scrollable L1 tabs at top, compact user info bar on non-Overview tabs, full user info on Overview. Desktop uses a persistent medium-size header across all tabs.
- **Restructure routes** from flat `/user/me`, `/user/me/edit`, `/user/me/follow` to a nested tab-driven structure under `/user/:unitId/` with sub-routes per tab.

## Capabilities

### New Capabilities
- `profile-tab-layout`: Shared profile page shell with L1 tab bar, responsive user info header (full/compact), and route-driven tab content area.
- `profile-overview`: Overview tab with two-column layout — sidebar (stats, keywords, realms) and main area (pinned items, recent activity).
- `profile-content-tab`: Content management tab with L2 chip sub-filters (Reviews/Remarks/Quotes/Posts), filter bar (search, status, visibility, sort), and paginated content lists.
- `profile-shelves-tab`: Shelves tab with L2 chip filters by kind, search, sort, and paginated shelf grid.
- `profile-realms-tab`: Realms tab with L2 chips (Joined/Created) showing realm memberships and owned realms.
- `profile-followers-tab`: Followers tab with L2 chips (Followers/Following) replacing the standalone FollowInfoPage.
- `profile-reactions-tab`: Reactions tab placeholder (MOCK) for future reaction history display.

### Modified Capabilities
_(none — this change introduces new frontend pages without altering existing spec-level behavior)_

## Impact

- **Affected packages**: `package/app` (primary — all profile UI), `package/api` (no changes needed, all queries already exist), `package/contract` (no changes needed)
- **Routes replaced**: `/user/me`, `/user/me/edit`, `/user/me/follow`, `/user/me/bookmark`, `/user/me/reaction` — all consolidated under new tab-driven routes.
- **Components removed**: `UserPage.tsx`, `UserEditPage.tsx`, `UserEditPage2.tsx` (replaced by new layout + settings page change).
- **Components refactored**: `UserProfilePage.tsx` (replaced by new Overview tab), `UserUnitsPage.tsx` (functionality absorbed into Content/Shelves tabs), `FollowInfoPage.tsx` (absorbed into Followers tab).
- **No backend changes required** — all tab content is powered by existing API endpoints and query hooks (`userQueries`, `contentSearchQueryOptions`, `shelfListQuery`, `realmListQuery`, `postSearchQuery`).
- **Backward compatibility**: Old routes (`/user/me/follow`, etc.) should redirect to new tab routes during transition.
