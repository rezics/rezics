## ADDED Requirements

### Requirement: Privileged actions write staff audit logs

The system SHALL append a staff audit log for global role changes, policy overrides, moderation decisions, account enforcement, impersonation, destructive deletes, restore actions, work merges, and operational repair actions.

#### Scenario: Role change is audited

- **WHEN** an owner changes a user's global role
- **THEN** an audit log SHALL record actor, target user, previous role, new role, reason, timestamp, and request correlation id

### Requirement: Audit responses redact sensitive values

Audit APIs SHALL redact secrets, tokens, raw credentials, private notes not visible to the caller, and unsafe stack traces.

#### Scenario: Staff views audit row

- **WHEN** staff opens an audit row for session revocation
- **THEN** the response SHALL show safe target/session metadata
- **AND** it SHALL NOT expose raw session tokens
