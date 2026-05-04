## ADDED Requirements

### Requirement: Settings page sidebar navigation on desktop
The settings page SHALL render a persistent sidebar on the left at viewports `md` and above. The sidebar SHALL list all settings sections as navigation links: Profile, Account, Security, Connected Accounts, API Tokens, Preferences. The active section link SHALL be visually highlighted. Clicking a link navigates to the corresponding child route.

#### Scenario: Sidebar renders on desktop
- **WHEN** a user navigates to `/user/me/setting/profile` on a desktop viewport
- **THEN** a sidebar is visible on the left with all section links, and "Profile" is highlighted as active

#### Scenario: Navigate between sections
- **WHEN** a user clicks "Security" in the sidebar
- **THEN** the URL changes to `/user/me/setting/security` and the Security section content loads

### Requirement: Settings page top tabs on mobile
On viewports below `md`, the settings page SHALL render horizontal scrollable MUI Tabs at the top instead of a sidebar. Each tab corresponds to a settings section.

#### Scenario: Mobile tabs render
- **WHEN** a user navigates to settings on a mobile viewport
- **THEN** horizontal tabs are displayed at the top of the page, scrollable if they overflow

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
## Requirements
### Requirement: Settings page top tabs on mobile

On viewports below `md`, the settings page SHALL render horizontal scrollable shadcn `Tabs` (from `@rezics/ui/shadcn`) at the top instead of a sidebar. Each tab corresponds to a settings section. The tab strip SHALL be wrapped in a horizontally scrollable container (shadcn `ScrollArea` or a UnoCSS `overflow-x-auto` container) so the strip scrolls when tabs do not fit. The active tab SHALL be auto-scrolled into view on tab change.

#### Scenario: Mobile tabs render

- **WHEN** a user navigates to settings on a mobile viewport
- **THEN** horizontal tabs are displayed at the top of the page using shadcn `Tabs`, scrollable if they overflow
- **AND** the import SHALL come from `@rezics/ui/shadcn` (not `@mui/material`)

#### Scenario: Active mobile tab into view

- **WHEN** the user switches between mobile tabs
- **THEN** the active tab SHALL be auto-scrolled into view if it was offscreen

