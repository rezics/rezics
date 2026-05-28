# profile-shelves-tab Specification

## Purpose

Defines the Shelves tab on the user profile: a responsive card grid
with `kindKey` L2 filter chips (All plus one per distinct kind),
title search, sort, and pagination — all persisted to URL search
params. Cards show cover, title, item count, and kind label. System
shelves (`favorites`, `backlog`, `active`, `completed`) resolve their
label by viewer role — i18n key for the owner's own view, DB-stored
translated title for non-owners — while user-created shelves always
use the DB title.

## Requirements

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

### Requirement: System shelf labels render by viewer role

When the Shelves tab renders cards or tab labels for shelves whose `kindKey` ∈ `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`), the displayed label SHALL be selected according to viewer role:

- **Owner-self view** (the authenticated viewer is the profile owner): the label SHALL be resolved via the application's i18n table keyed on `kindKey` (e.g., `t('shelf.system.favorites')`). The DB-stored shelf title (typically `${slug}'s ${Label}`) SHALL NOT be displayed in this view.
- **Non-owner view** (the viewer is a different user or unauthenticated): the label SHALL be the DB-stored `Unit.translations[viewerLang].title` if present, falling back to the `en` translation (e.g., `alice's Favorites`).

User-created (non-system) shelves SHALL render their DB-stored title regardless of viewer role and SHALL NOT consult the i18n table.

#### Scenario: Owner viewing their own profile sees i18n system shelf labels

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **AND** alice's app locale is `zh`
- **WHEN** alice navigates to her own profile's Shelves tab
- **THEN** the four system shelf cards SHALL display the zh i18n results for `shelf.system.favorites`, `shelf.system.backlog`, `shelf.system.active`, and `shelf.system.completed`
- **AND** the literal string `alice's Favorites` (and the three siblings) SHALL NOT appear on the cards

#### Scenario: Non-owner viewing alice's profile sees DB titles

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **WHEN** bob navigates to alice's profile's Shelves tab
- **THEN** the visible system shelf cards (subject to shelf visibility filters) SHALL display the DB-stored titles
- **AND** bob's locale-specific i18n keys for `shelf.system.*` SHALL NOT be applied

#### Scenario: User-created shelves render DB title in both views

- **GIVEN** alice has a user-created shelf with DB title `Vintage Sci-Fi`
- **WHEN** alice (owner) or bob (non-owner) navigates to alice's Shelves tab
- **THEN** the shelf card SHALL display `Vintage Sci-Fi`
- **AND** no i18n lookup SHALL apply
