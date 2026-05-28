## ADDED Requirements

### Requirement: Signed-in dashboard aggregates user continuity

The app SHALL provide a signed-in dashboard showing continue reading, shelves, joined realms, notifications, DMs, drafts, recent activity, and safety/moderation status when relevant.

#### Scenario: User resumes reading

- **GIVEN** a user has reading progress on a book release
- **WHEN** they open their dashboard
- **THEN** the continue reading section SHALL show the book and last position

### Requirement: Dashboard uses typed aggregate data

Dashboard data SHALL be loaded through typed `@rezics/api` hooks and SHALL not duplicate DTO definitions in app code. Where dashboard sections combine multiple domains, the server SHOULD expose dashboard-specific summary DTOs instead of requiring the page to scatter unrelated domain requests and rebuild business rules client-side.

#### Scenario: Dashboard API partially fails

- **WHEN** notifications fail but progress loads
- **THEN** the dashboard SHALL render available sections
- **AND** show a safe retry/error state for the failed section

### Requirement: Dashboard library section reuses bookshelf view with readable filter

The dashboard library section SHALL be a composition of the user's existing shelves rendered through the shared `bookshelf` shelf view defined by `shelf-collection`, not a new shelf abstraction. It SHALL default to filtering books to those whose `isLicensed` is true, so the dashboard reflects content the user can actually open and read; standalone shelf pages SHALL keep showing all items unless the user opts in to the same filter.

Layout config (breakpoints, showTitle) SHALL follow the resolution order defined by `shelf-collection`: URL override → viewer's `userSettings.library.bookshelf` → contract default. The dashboard SHALL expose the same "use my settings" reset affordance.

#### Scenario: Dashboard hides unlicensed books

- **GIVEN** a user has shelved both licensed and unlicensed books
- **WHEN** the dashboard library section renders
- **THEN** only books with `isLicensed === true` SHALL appear
- **AND** the unlicensed books SHALL still be visible on the standalone shelf page when the readable filter is off

#### Scenario: Dashboard respects viewer layout preference

- **GIVEN** a viewer with a stored `userSettings.library.bookshelf` preference
- **WHEN** the dashboard library section renders with no URL override
- **THEN** the bookshelf grid SHALL use that preference's breakpoints and showTitle
