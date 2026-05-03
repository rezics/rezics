## MODIFIED Requirements

### Requirement: Settings page top tabs on mobile

On viewports below `md`, the settings page SHALL render horizontal scrollable shadcn `Tabs` (from `@rezics/ui/shadcn`) at the top instead of a sidebar. Each tab corresponds to a settings section. The tab strip SHALL be wrapped in a horizontally scrollable container (shadcn `ScrollArea` or a UnoCSS `overflow-x-auto` container) so the strip scrolls when tabs do not fit. The active tab SHALL be auto-scrolled into view on tab change.

#### Scenario: Mobile tabs render

- **WHEN** a user navigates to settings on a mobile viewport
- **THEN** horizontal tabs are displayed at the top of the page using shadcn `Tabs`, scrollable if they overflow
- **AND** the import SHALL come from `@rezics/ui/shadcn` (not `@mui/material`)

#### Scenario: Active mobile tab into view

- **WHEN** the user switches between mobile tabs
- **THEN** the active tab SHALL be auto-scrolled into view if it was offscreen
