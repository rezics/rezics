## ADDED Requirements

### Requirement: Poll is a guided creation flow

The unified creation surface SHALL offer poll as a creation flow: a tile linking
to `/poll/new`, which mounts the poll composer. The flow SHALL use the shared
poll contract and `@rezics/api` client (no duplicated DTOs), consistent with the
other creation flows.

#### Scenario: User starts a poll from the creation surface

- **WHEN** a user selects the poll tile on the unified creation surface
- **THEN** the app SHALL navigate to `/poll/new`
- **AND** the poll composer SHALL be mounted there

#### Scenario: Poll creation uses shared contracts

- **WHEN** the poll composer submits
- **THEN** it SHALL call the shared `@rezics/api` poll create hook with a `CreatePollInput`
- **AND** it SHALL NOT define its own copy of the poll DTOs
