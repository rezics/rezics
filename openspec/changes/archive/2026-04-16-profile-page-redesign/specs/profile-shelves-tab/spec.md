## ADDED Requirements

### Requirement: Shelf grid with kind filter
The Shelves tab SHALL display the user's shelves in a responsive card grid (2 columns mobile, 3-4 columns desktop). An L2 chip row SHALL allow filtering by shelf kind — an "All" chip plus one chip per distinct `kindKey` found in the user's shelves. The active kind filter SHALL be persisted in the URL search param `kindKey`.

#### Scenario: All shelves displayed by default
- **WHEN** a user navigates to the Shelves tab without a `kindKey` param
- **THEN** the "All" chip is active and all shelves belonging to the user are displayed

#### Scenario: Filter by kind
- **WHEN** a user clicks a kind chip (e.g., "reading-list")
- **THEN** only shelves with that `kindKey` are displayed and the URL updates to `?kindKey=reading-list`

### Requirement: Shelf card display
Each shelf card SHALL display: cover image (if available), shelf title (from translation), item count, and the shelf's `kindKey` as a subtle label. Clicking a shelf card navigates to the shelf detail page.

#### Scenario: Shelf card renders
- **WHEN** shelves are loaded
- **THEN** each shelf renders as a card with cover, title, item count, and kind label

### Requirement: Shelf search and sort
The Shelves tab SHALL include a search input to filter shelves by title and a sort dropdown (Newest, Oldest). These SHALL be persisted in URL search params.

#### Scenario: Search shelves by title
- **WHEN** a user types "sci-fi" in the search input
- **THEN** only shelves whose title contains "sci-fi" are displayed

### Requirement: Paginated shelf list
The Shelves tab SHALL support pagination for users with many shelves.

#### Scenario: Pagination controls
- **WHEN** the user has more shelves than fit on one page
- **THEN** pagination controls are rendered to navigate between pages

### Requirement: Empty state
When the user has no shelves (or no shelves matching the filter), an empty state message SHALL be shown.

#### Scenario: No shelves
- **WHEN** the user has zero shelves
- **THEN** a message "No shelves yet" is displayed
