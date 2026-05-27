## ADDED Requirements

### Requirement: Creation flows are guided and recoverable

The app SHALL provide guided creation flows with type selection, existing-work/entity search, draft save, validation, preview, publish/submit, and post-submit next actions.

#### Scenario: User creates review draft

- **WHEN** a user starts a review and leaves before publishing
- **THEN** the draft SHALL be recoverable from the dashboard or relevant create surface

### Requirement: Creation uses shared contracts and editor infrastructure

Creation flows SHALL use `@rezics/contract`, `@rezics/api`, existing editor primitives, UnitTranslation language controls, Unit attribution, tags, and work-domain matching where applicable.

#### Scenario: App does not duplicate DTO

- **WHEN** a creation form needs book metadata
- **THEN** it SHALL consume typed API/contract schemas rather than defining app-local DTO copies

#### Scenario: User creates localized metadata

- **WHEN** a user creates or edits display metadata for a Unit-backed object
- **THEN** the form SHALL write the selected UnitTranslation language
- **AND** it SHALL NOT store localized title/summary/description in feature-local fields

### Requirement: Policy-aware publish states are visible

When policy requires review, rule acknowledgement, or account remediation, creation flows SHALL show the relevant blocking state and next action.

#### Scenario: Silenced user attempts publish

- **WHEN** a silenced user attempts to publish a post
- **THEN** the UI SHALL show a safe denial state returned by the server
- **AND** no optimistic publish success SHALL be shown
