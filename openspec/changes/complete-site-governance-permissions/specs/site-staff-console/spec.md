## ADDED Requirements

### Requirement: Product-side staff console is separate from package/admin

`package/app` SHALL provide staff-only community operations routes for moderation queues, case detail, account safety, and staff audit timelines. These routes SHALL NOT replace `package/admin` operational panels.

#### Scenario: Staff opens moderation queue

- **WHEN** a global staff user opens the staff moderation route in `package/app`
- **THEN** the page SHALL show assigned and unassigned moderation cases with filters for target type, realm, state, severity, and assignment

### Requirement: Staff console uses safe typed APIs

The staff console SHALL use `@rezics/api` hooks backed by `@rezics/contract` DTOs and SHALL render loading, empty, denied, and error states.

#### Scenario: Non-staff user is denied

- **WHEN** a non-staff user opens a staff console route
- **THEN** the app SHALL render a forbidden state or redirect according to route policy
- **AND** no privileged data SHALL be displayed
