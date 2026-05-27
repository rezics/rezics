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
