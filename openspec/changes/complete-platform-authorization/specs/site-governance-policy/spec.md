## ADDED Requirements

### Requirement: Server policy decisions are authoritative

The server SHALL evaluate privileged actions through named policy decisions that include actor, action, resource, context, allow/deny state, denial reason, and audit code. Client capability hints SHALL NOT grant authorization.

#### Scenario: Route denies by policy

- **WHEN** a non-staff user calls a global case decision endpoint
- **THEN** the server SHALL return an authorization failure produced by the policy layer
- **AND** the response SHALL include a safe denial code without exposing internal policy details

### Requirement: Policy evaluates resource and community context

Policy checks SHALL consider global role, account enforcement state, resource ownership, Unit status/visibility, realm membership role, target user state, and action kind when those fields are relevant.

#### Scenario: Realm moderator cannot act outside their realm

- **GIVEN** a user is moderator of realm A but not realm B
- **WHEN** they attempt to moderate content scoped only to realm B
- **THEN** the policy SHALL deny the action even if they have moderator role in realm A

### Requirement: Policy decisions are testable by action family

Each policy action family SHALL have focused tests covering allow, deny, blocked-account, missing-resource, and cross-realm cases.

#### Scenario: Blocked account cannot create content

- **GIVEN** a user has an active silence enforcement
- **WHEN** the user attempts to create a post
- **THEN** the create policy SHALL deny the action with a silence-related denial code
