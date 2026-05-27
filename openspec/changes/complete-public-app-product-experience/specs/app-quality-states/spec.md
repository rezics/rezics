## ADDED Requirements

### Requirement: Production routes define complete UI states

Each production route SHALL define loading, empty, error, denied, not-found, unauthenticated, and success states appropriate to its data and permissions.

#### Scenario: Search has no results

- **WHEN** search returns no results
- **THEN** the page SHALL render a helpful empty state with next actions instead of a blank area

### Requirement: Public app UI follows Rezics design rules

Public app UI SHALL use Rezics design tokens, app density, shared UI primitives, `SafeLink`, accessible status text, and Traditional Chinese localization coverage.

#### Scenario: Error state is accessible

- **WHEN** a mutation fails
- **THEN** the UI SHALL show text describing the failure and recovery action
- **AND** it SHALL not communicate state by color alone
