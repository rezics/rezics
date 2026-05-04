## ADDED Requirements

### Requirement: Book detail page has four tabs — Overview, Review & Shelf, Content, Community

The book detail shell SHALL render exactly four tabs in this order: **Overview**, **Review & Shelf**, **Content**, **Community**. Each tab SHALL map to a route under `/book/$bookId/`: `info` (Overview), `review` (Review & Shelf), `content` (Content), `discussion` (Community). The default redirect from `/book/$bookId/` SHALL navigate to the Overview tab (`/book/$bookId/info`).

#### Scenario: Tab bar renders all four tabs

- **WHEN** a user navigates to `/book/$bookId/info`
- **THEN** the tab bar SHALL display tabs labeled "Overview", "Review & Shelf", "Content", "Community"
- **AND** the "Overview" tab SHALL be visually active

#### Scenario: Tab navigation changes route

- **WHEN** a user clicks the "Content" tab
- **THEN** the browser SHALL navigate to `/book/$bookId/content`
- **AND** the "Content" tab SHALL become visually active

#### Scenario: Default route redirects to Overview

- **WHEN** a user navigates to `/book/$bookId/` (no sub-path)
- **THEN** the router SHALL redirect to `/book/$bookId/info`

### Requirement: Tab bar is horizontally scrollable with scroll buttons on small screens

The tab bar SHALL use MUI `Tabs` with `variant="scrollable"` and `scrollButtons="auto"`. On screens where all tabs do not fit, horizontal scroll buttons SHALL appear. The language dropdown (defined in `book-detail-language-switcher`) SHALL remain fixed at the right end and SHALL NOT scroll with the tabs.

#### Scenario: Tabs overflow on small screen

- **WHEN** the viewport width is too narrow to display all four tab labels
- **THEN** the tab area SHALL become horizontally scrollable
- **AND** scroll indicator buttons SHALL appear at the edges
- **AND** the language dropdown SHALL remain visible and fixed at the right end

#### Scenario: All tabs fit on large screen

- **WHEN** the viewport width is sufficient to display all four tab labels
- **THEN** no scroll buttons SHALL appear
- **AND** the language dropdown SHALL remain at the right end of the tab bar

### Requirement: Overview tab displays basic info with lightweight interactions

The Overview tab SHALL render the following sections in order: (1) book description (translated per selected language), (2) quote excerpts preview (2-3 items with a "view all" link to `/quote/book/$bookId`), (3) rating widget allowing the user to submit a score, (4) remark preview (3-5 short reviews with a quick-submit form and a "view all" link to `/remark/book/$bookId`).

#### Scenario: Overview tab renders all sections

- **WHEN** the Overview tab is active
- **THEN** the page SHALL display description, quote preview, rating widget, and remark preview in order

#### Scenario: Quote preview links to full page

- **WHEN** the user clicks "view all" under quote excerpts
- **THEN** the browser SHALL navigate to `/quote/book/$bookId`

#### Scenario: Remark preview links to full page

- **WHEN** the user clicks "view all" under remarks
- **THEN** the browser SHALL navigate to `/remark/book/$bookId`

### Requirement: Review & Shelf tab displays preview lists with links to dedicated pages

The Review & Shelf tab SHALL render two sections: (1) a reviews preview showing 3-5 full review cards with per-card unit-level actions and a "view all" link to `/review/book/$bookId`, (2) a shelves preview showing 3-5 shelf cards containing this book with a "view all" link to `/shelf/book/$bookId`. The tab SHALL NOT include any "add to shelf" functionality — that action belongs at the unit level (hero action bar, individual cards).

#### Scenario: Review preview renders with actions

- **WHEN** the Review & Shelf tab is active
- **THEN** the page SHALL display up to 5 review cards
- **AND** each review card SHALL have unit-level actions (reactions, add to readlist)
- **AND** a "view all reviews" link SHALL navigate to `/review/book/$bookId`

#### Scenario: Shelf preview renders

- **WHEN** the Review & Shelf tab is active
- **THEN** the page SHALL display up to 5 shelf cards containing this book
- **AND** a "view all shelves" link SHALL navigate to `/shelf/book/$bookId`

#### Scenario: No "add to shelf" button in tab

- **WHEN** the Review & Shelf tab is rendered
- **THEN** there SHALL be no "add to shelf" button or form at the tab level

### Requirement: Content tab displays chapter index with release selection

The Content tab SHALL render a release selector dropdown above the chapter tree. The chapter tree loads data from `bookQueries.chapterIndex(releaseUnitId)` where `releaseUnitId` is determined by the selected release. See `book-detail-release-selector` spec for selector behavior.

#### Scenario: Content tab renders chapter tree

- **WHEN** the Content tab is active
- **THEN** a release selector SHALL appear above the chapter tree
- **AND** the chapter tree SHALL display the chapter index for the selected release

### Requirement: Community tab displays discussion threads

The Community tab SHALL render a thread creation form and a list of discussion threads for the book. This is functionally equivalent to the current Discussion tab.

#### Scenario: Community tab renders threads

- **WHEN** the Community tab is active
- **THEN** the page SHALL display a thread creation form and a list of discussion threads

### Requirement: Sidebar is contextual per tab and redistributes on mobile

Each tab page SHALL define its own sidebar sections. On desktop viewports (lg breakpoint and above), sidebar sections SHALL render in the right column of a 9+3 grid layout. On mobile/tablet viewports (below lg), sidebar sections SHALL NOT render in a separate column — instead they SHALL be redistributed inline within the tab content at semantically relevant positions.

#### Scenario: Desktop renders sidebar in right column

- **WHEN** the viewport is at or above the lg breakpoint
- **THEN** the tab's sidebar sections SHALL render in a right column alongside the main content

#### Scenario: Mobile redistributes sidebar sections inline

- **WHEN** the viewport is below the lg breakpoint
- **THEN** no separate sidebar column SHALL be rendered
- **AND** sidebar sections SHALL appear inline within the tab content at positions defined by the tab page

#### Scenario: Sidebar content differs per tab

- **WHEN** the user switches from the Overview tab to the Content tab
- **THEN** the sidebar sections SHALL change to reflect content relevant to the Content tab
## Requirements
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

#### Scenario: No MUI imports

- **WHEN** the book-detail tab bar component is inspected
- **THEN** there SHALL be no import from `@mui/material`
- **AND** the `Tabs` import SHALL come from `@rezics/ui/shadcn`

