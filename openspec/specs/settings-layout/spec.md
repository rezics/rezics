# settings-layout Specification

## Purpose

Defines the settings page layout in `@rezics/app`: a persistent sidebar on desktop (viewports `md` and above) listing every settings section, horizontal scrollable shadcn `Tabs` on mobile, an authentication guard, a default route redirect, and a legacy `/user/me/edit` redirect.

## Requirements

### Requirement: Settings page sidebar navigation on desktop
The settings page SHALL render a persistent sidebar on the left at viewports `md` and above. The sidebar SHALL list all settings sections as navigation links: Profile, Account, Security, Connected Accounts, API Tokens, Preferences. The active section link SHALL be visually highlighted. Clicking a link navigates to the corresponding child route.

#### Scenario: Sidebar renders on desktop
- **WHEN** a user navigates to `/user/me/setting/profile` on a desktop viewport
- **THEN** a sidebar is visible on the left with all section links, and "Profile" is highlighted as active

#### Scenario: Navigate between sections
- **WHEN** a user clicks "Security" in the sidebar
- **THEN** the URL changes to `/user/me/setting/security` and the Security section content loads

### Requirement: Authentication guard
All settings routes SHALL require authentication. If the user is not authenticated, they SHALL be redirected to the login page.

#### Scenario: Unauthenticated access
- **WHEN** an unauthenticated user navigates to `/user/me/setting/profile`
- **THEN** they are redirected to the login page

### Requirement: Default route redirect
Navigating to `/user/me/setting` (no section) SHALL redirect to `/user/me/setting/profile`.

#### Scenario: Base settings URL redirects
- **WHEN** a user navigates to `/user/me/setting`
- **THEN** they are redirected to `/user/me/setting/profile`

### Requirement: Legacy edit route redirect
The legacy route `/user/me/edit` SHALL redirect to `/user/me/setting/profile`.

#### Scenario: Legacy edit redirects
- **WHEN** a user navigates to `/user/me/edit`
- **THEN** they are redirected to `/user/me/setting/profile`

### Requirement: Settings page top tabs on mobile

On viewports below `md`, the settings page SHALL render horizontal scrollable shadcn `Tabs` (from `@rezics/ui/shadcn`) at the top instead of a sidebar. Each tab corresponds to a settings section. The tab strip SHALL be wrapped in a horizontally scrollable container (shadcn `ScrollArea` or a UnoCSS `overflow-x-auto` container) so the strip scrolls when tabs do not fit. The active tab SHALL be auto-scrolled into view on tab change.

#### Scenario: Mobile tabs render

- **WHEN** a user navigates to settings on a mobile viewport
- **THEN** horizontal tabs are displayed at the top of the page using shadcn `Tabs`, scrollable if they overflow
- **AND** the import SHALL come from `@rezics/ui/shadcn`

#### Scenario: Active mobile tab into view

- **WHEN** the user switches between mobile tabs
- **THEN** the active tab SHALL be auto-scrolled into view if it was offscreen

### Requirement: Notification preference UI is per-kind

Notification settings SHALL expose per-kind toggles (reply, follow, DM, moderation outcome, realm event, system notice) so the user can opt in or out of each notification category independently. Preferences SHALL be enforced in the notification dispatch pipeline (feed and push), not merely at read time.

#### Scenario: User disables follow notifications

- **WHEN** a user disables the follow-notification toggle
- **THEN** new follow notifications SHALL NOT appear in the user's feed or push channels
- **AND** other categories SHALL continue to deliver

### Requirement: Settings exposes blocked-users management

Settings SHALL provide a blocked-users sub-page where a user can view, add, and remove blocked users. Blocking SHALL hide content and prevent DM from the blocked user, scoped by the foundation's policy engine.

#### Scenario: User unblocks a peer

- **WHEN** a user removes a peer from the blocked list
- **THEN** the change SHALL persist through typed API mutation
- **AND** the peer's content SHALL become visible to the user on next fetch

### Requirement: Settings exposes data export and account deletion

Settings SHALL provide entry points for user data export and account deletion, each backed by typed API endpoints with explicit confirmation. Deletion SHALL describe what is removed, anonymized, or retained for safety/audit reasons before the user confirms.

#### Scenario: User initiates account deletion

- **WHEN** a user activates account deletion
- **THEN** the UI SHALL present a confirmation step describing data handling
- **AND** SHALL NOT proceed without explicit confirmation

