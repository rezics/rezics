# profile-content-tab Specification

## Purpose

Defines the Content tab on the user profile: an L2 post-kind chip row
(Reviews, Remarks, Quotes, Posts) defaulting to Reviews, a filter bar
with body-text search, sort (Newest / Oldest / Most Replies), and
owner-only status / visibility dropdowns, plus a paginated post list
with empty states. All filter values live in URL search params so tabs
deep-link and reload predictably.

## Requirements

### Requirement: L2 chip sub-filters for post kinds
The Content tab SHALL render a row of chip-style filters for post kinds: Reviews, Remarks, Quotes, Posts. The active chip SHALL be visually filled; inactive chips SHALL be outlined. Selecting a chip SHALL update the URL search param `kind` and refetch content.

#### Scenario: Default to Reviews
- **WHEN** a user navigates to the Content tab without a `kind` param
- **THEN** the Reviews chip is active and review posts are displayed

#### Scenario: Switch to Quotes
- **WHEN** a user clicks the "Quotes" chip
- **THEN** the URL updates to `?kind=QUOTE`, the Quotes chip becomes active, and quote posts are fetched

### Requirement: Filter bar with search, status, visibility, and sort
The Content tab SHALL render a filter bar below the L2 chips with:
- A text search input (searches post body text)
- A status dropdown (All, Draft, Published, Archived) — visible only for current user's own profile
- A visibility dropdown (All, Public, Unlisted, Private) — visible only for current user's own profile
- A sort dropdown (Newest, Oldest, Most Replies)

All filter values SHALL be persisted in URL search params.

#### Scenario: Search filters content
- **WHEN** a user types "Dune" in the search input
- **THEN** only posts whose body contains "Dune" are displayed

#### Scenario: Status filter on own profile
- **WHEN** the current user views their own Content tab and selects "Draft" from the status dropdown
- **THEN** only draft posts are shown

#### Scenario: Status filter hidden on other profiles
- **WHEN** a user views another user's Content tab
- **THEN** the status and visibility dropdowns are not rendered (only published public content is shown)

### Requirement: Paginated content list
The Content tab SHALL display posts in a paginated list using the existing `UniversalPaginator` or equivalent. Each list item SHALL show the post body preview, target unit title (if applicable), reaction summary, reply count, and creation date.

#### Scenario: Pagination loads next page
- **WHEN** the user reaches the end of the current page
- **THEN** a pagination control allows navigating to the next page of results

### Requirement: Empty state
When no posts match the current filters, the Content tab SHALL display an empty state message appropriate to the context (e.g., "No reviews yet" or "No results match your filters").

#### Scenario: No content for kind
- **WHEN** the user has no published quotes and the Quotes chip is active
- **THEN** a message "No quotes yet" is displayed

#### Scenario: No search results
- **WHEN** a search query returns zero results
- **THEN** a message "No results match your search" is displayed
