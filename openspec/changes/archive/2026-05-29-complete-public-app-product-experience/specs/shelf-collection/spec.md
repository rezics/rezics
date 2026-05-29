## MODIFIED Requirements

### Requirement: Shelf collection supports complete library workflows

Shelf collection behavior SHALL support add, remove, reorder, status/progress context, work/release-aware display, and dashboard/profile integration. For book items, the per-card progress hint SHALL surface the user's `UserUnitProgress.status`, the `chaptersCompleted/chaptersTotal` count derived from `UserContentNodeProgress`, and the `lastReadNodeId`-resolved chapter title when present. These values SHALL come from server-aggregated DTOs (e.g. `DashboardSummary`, shelf list responses) so cards do not need to fetch per-book TOC and node-completion rows separately.

#### Scenario: User reorders shelf item

- **WHEN** a user reorders items on their shelf
- **THEN** the order SHALL persist and remain stable after reload

#### Scenario: Bookshelf hover preview shows reading progress

- **GIVEN** a book card in `bookshelf` view on a pointer device
- **WHEN** the viewer hovers the card
- **THEN** the side preview panel SHALL display the `chaptersCompleted/chaptersTotal` count and the last-read chapter title for the viewer when progress data exists
- **AND** when the viewer has no progress for that book the panel SHALL omit the progress line rather than render a zero/empty placeholder

## ADDED Requirements

### Requirement: Shelf supports a bookshelf view for library content

Shelf rendering SHALL support a `bookshelf` view mode that renders only library-content kinds (`book`, `game`, `media`) as fixed aspect-ratio covers in a responsive grid, and SHALL silently skip other kinds. Aspect ratios SHALL be fixed per kind via constants exported from `@rezics/contract`; the values are independent so each kind can change without affecting the others.

The bookshelf view SHALL be selectable on any shelf surface that already exposes view modes (user shelf pages, realm shelf pages, dashboard library sections). Bookshelf view is a presentation layer over the existing shelf model; it SHALL NOT introduce a parallel "dashboard widget" abstraction or duplicate shelf item DTOs.

#### Scenario: Bookshelf view filters non-library items

- **GIVEN** a shelf containing books, reviews, posts, and tags
- **WHEN** the viewer switches the shelf to bookshelf view
- **THEN** only `book`, `game`, and `media` items SHALL render in the grid
- **AND** the other kinds SHALL be omitted without an error

### Requirement: Bookshelf view uses a per-viewer responsive layout config

Bookshelf layout SHALL be controlled by a `BookshelfViewConfig` exported from `@rezics/contract`, consisting of `breakpoints: Array<{ minWidthPx: number; columns: number }>` and `showTitle: boolean`. The contract SHALL export `DEFAULT_BOOKSHELF_CONFIG` used when no viewer preference exists.

The active config SHALL be resolved in this order: URL query override → the viewing user's `userSettings.library.bookshelf` → contract default. Resolution is per-viewer, not per-shelf-owner: whoever is looking at the shelf decides how it renders. The view SHALL expose a "use my settings" affordance that clears URL overrides so the viewer's stored preference (or default) takes effect.

#### Scenario: URL override beats viewer preference

- **GIVEN** a viewer whose stored preference is 4 columns at the largest breakpoint
- **WHEN** they open a shelf link with a bookshelf URL override of 8 columns
- **THEN** the shelf SHALL render at 8 columns at that breakpoint
- **AND** activating "use my settings" SHALL re-render at 4 columns

#### Scenario: No preference falls back to contract default

- **WHEN** a viewer with no stored bookshelf preference opens a bookshelf view without URL override
- **THEN** the layout SHALL use `DEFAULT_BOOKSHELF_CONFIG`

### Requirement: Bookshelf card hover preview is desktop-only

Bookshelf card hover previews SHALL open a side info panel only on devices that support hover. On devices without hover (touch), tapping a bookshelf card SHALL navigate directly to the item's detail page without opening a preview.

#### Scenario: Pointer device hover opens preview

- **WHEN** a pointer device hovers a bookshelf card
- **THEN** a side preview panel SHALL open
- **AND** the page SHALL NOT navigate

#### Scenario: Touch device tap navigates

- **WHEN** a touch device taps a bookshelf card
- **THEN** the app SHALL navigate to the item detail page
- **AND** no hover preview SHALL appear
