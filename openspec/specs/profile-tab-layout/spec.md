## ADDED Requirements

### Requirement: L1 tab bar at page top
The profile page SHALL render a horizontal tab bar as the topmost element of the page. The tab bar SHALL include tabs for: Overview, Content, Shelves, Realms, Followers, Reactions. Each tab SHALL be driven by a route — clicking a tab navigates to the corresponding child route under `/user/$unitId/`.

#### Scenario: Tab bar renders on profile visit
- **WHEN** a user navigates to `/user/:unitId`
- **THEN** the L1 tab bar is rendered at the top of the page with all tabs visible, and the Overview tab is active by default

#### Scenario: Tab navigation updates route
- **WHEN** a user clicks the "Content" tab
- **THEN** the URL changes to `/user/:unitId/content` and the Content tab content renders below the user info section

#### Scenario: Direct URL navigation activates correct tab
- **WHEN** a user navigates directly to `/user/:unitId/shelves`
- **THEN** the Shelves tab is active in the tab bar and its content is rendered

### Requirement: Mobile tab bar horizontal scroll
On viewports below the `md` breakpoint, the tab bar SHALL be horizontally scrollable when tabs overflow the viewport width. The active tab SHALL be visible without manual scrolling.

#### Scenario: Narrow viewport scrolls tabs
- **WHEN** the viewport is narrower than the total tab width
- **THEN** the tab bar is horizontally scrollable with no wrapping, and the currently active tab is scrolled into view

### Requirement: User info section below tab bar
The profile page SHALL render a user info section between the tab bar and the tab content area. This section displays the profile user's avatar, display name, slug, bio, follower/following counts, and action buttons (Edit profile / Follow).

#### Scenario: Current user sees edit button
- **WHEN** the authenticated user views their own profile
- **THEN** the user info section displays an "Edit profile" button and a settings gear icon

#### Scenario: Other user sees follow button
- **WHEN** a user views another user's profile
- **THEN** the user info section displays a Follow/Unfollow button

### Requirement: Responsive user info variants
On desktop (`md` and above), the user info section SHALL render in a horizontal layout (avatar left, info right) across all tabs. On mobile (below `md`), the Overview tab SHALL show a full user info layout (large centered avatar, name, slug, bio, stats, actions). On mobile, all other tabs SHALL show a compact single-row user info (small avatar, name, slug) to maximize content area.

#### Scenario: Desktop shows consistent header
- **WHEN** the viewport is `md` or larger
- **THEN** all tabs render the same medium-size horizontal user info header

#### Scenario: Mobile Overview shows full header
- **WHEN** the viewport is below `md` and the Overview tab is active
- **THEN** user info renders with a large centered avatar, full bio, stats, and action buttons

#### Scenario: Mobile Content tab shows compact header
- **WHEN** the viewport is below `md` and the Content tab is active
- **THEN** user info renders as a single compact row (24px avatar, name, slug)

### Requirement: Profile shell as layout route
The ProfileShell component SHALL be implemented as a TanStack Router layout route at `routes/_mainLayout/user/$unitId/route.tsx`. It SHALL fetch the user data and provide it to child routes via route context or props. Child routes SHALL render inside an `<Outlet />`.

#### Scenario: Layout route provides user context
- **WHEN** any profile tab route mounts
- **THEN** the user data is available from the parent layout route without re-fetching

### Requirement: Legacy route redirects
The following legacy routes SHALL redirect to their new equivalents:
- `/user/me` → `/user/<currentUserUnitId>`
- `/user/me/follow` → `/user/<currentUserUnitId>/followers`
- `/user/me/bookmark` → `/user/<currentUserUnitId>`
- `/user/me/reaction` → `/user/<currentUserUnitId>/reactions`

#### Scenario: Legacy follow route redirects
- **WHEN** a user navigates to `/user/me/follow`
- **THEN** they are redirected to `/user/<their unitId>/followers`
