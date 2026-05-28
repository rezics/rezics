## ADDED Requirements

### Requirement: Admin shell defines operator navigation

`package/admin` SHALL provide a coherent admin shell with navigation groups for dashboard, content, accounts, governance, search/sync, and system operations.

#### Scenario: Operator sees grouped navigation

- **WHEN** an authorized admin opens the admin app
- **THEN** the sidebar SHALL show grouped operations navigation rather than unrelated flat page links

### Requirement: Admin dashboard summarizes operational state

The admin dashboard SHALL summarize system status, queue health, search drift, moderation/enforcement counts, recent audit, and repair warnings where data is available.

#### Scenario: Search drift warning appears

- **WHEN** the backend reports search projection drift
- **THEN** the dashboard SHALL show a warning with navigation to the relevant repair surface

### Requirement: Admin actions use reasoned confirmations

Destructive or privileged admin actions SHALL require explicit confirmation and reason capture when policy requires audit.

#### Scenario: Admin starts repair job

- **WHEN** an admin starts a bulk repair job
- **THEN** the UI SHALL show impact preview and require confirmation before submitting
