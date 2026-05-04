## MODIFIED Requirements

### Requirement: Tab bar uses shadcn Tabs with overflow scrolling

The tab bar SHALL use shadcn `Tabs` from `@rezics/ui/shadcn` (with `TabsList` and `TabsTrigger` composed within the rezics layout). On screens where all tabs do not fit, the `TabsList` SHALL be wrapped in a horizontally scrollable container (shadcn `ScrollArea` or a UnoCSS `overflow-x-auto` container) so tabs scroll horizontally. The language dropdown (defined in `book-detail-language-switcher`) SHALL remain fixed at the right end and SHALL NOT scroll with the tabs.

#### Scenario: Tabs overflow on small screen

- **WHEN** the viewport width is too narrow to display all four tab labels
- **THEN** the tab area SHALL become horizontally scrollable
- **AND** the active tab SHALL be auto-scrolled into view on tab change
- **AND** the language dropdown SHALL remain visible and fixed at the right end

#### Scenario: Active tab into view on URL change

- **WHEN** the active tab changes via URL navigation (e.g. user opens a deep link)
- **THEN** the scroll container SHALL bring the active tab into view
- **AND** the visible portion of the tab strip SHALL include the active tab without requiring a manual scroll

#### Scenario: Tabs imported from rezics-ui shadcn surface

- **WHEN** the book-detail tab bar component is inspected
- **THEN** the `Tabs`, `TabsList`, and `TabsTrigger` imports SHALL come from `@rezics/ui/shadcn`

## REMOVED Requirements

### Requirement: Tab bar is horizontally scrollable with scroll buttons on small screens

**Reason**: Superseded by "Tab bar uses shadcn Tabs with overflow scrolling" (preserved above as a MODIFIED requirement). The obsolete version specified MUI `Tabs` with `variant="scrollable"` and `scrollButtons="auto"`; the active version uses shadcn `Tabs` with a wrapped scroll container. MUI is permanently removed from the project, so the prior specification cannot be implemented.

**Migration**: None at the codebase level — the book-detail tab bar already uses shadcn `Tabs`. The active "shadcn Tabs with overflow scrolling" requirement is the sole authority going forward.
