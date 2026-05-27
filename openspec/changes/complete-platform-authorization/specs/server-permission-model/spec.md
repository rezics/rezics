## MODIFIED Requirements

### Requirement: Permission remains canonical but policy owns authorization

`Permission` SHALL remain the canonical global role representation, but privileged server authorization SHALL be expressed as policy actions that use `Permission` as one input rather than as the complete authorization model.

#### Scenario: Admin role alone is not sufficient

- **WHEN** an admin attempts an action blocked by a higher-priority account enforcement or resource invariant
- **THEN** the policy SHALL deny the action even though `permission.role` is `ADMIN`

### Requirement: Blocked status derives from enforcement, not a role literal

A user's blocked status SHALL be determined by the account-safety enforcement layer rather than by a distinct `BLOCKED` role literal carrying independent authority. Policy decisions SHALL read active enforcement as the source of truth for whether an account is blocked, so there is a single source of truth for that state. The role enum MAY retain a blocked-derived projection for transport compatibility, but it SHALL NOT be a second authority that can disagree with enforcement.

#### Scenario: Enforcement is the source of truth for blocked status

- **GIVEN** a user has an active ban enforcement record
- **WHEN** the policy evaluates whether the account is blocked
- **THEN** the decision SHALL be derived from the active enforcement
- **AND** SHALL NOT depend on a separate `BLOCKED` role literal disagreeing with enforcement
