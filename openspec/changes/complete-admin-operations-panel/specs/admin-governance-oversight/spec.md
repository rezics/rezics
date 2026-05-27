## ADDED Requirements

### Requirement: Admin provides governance oversight, not realm day-to-day moderation

The admin panel SHALL expose site-wide governance oversight, escalations, enforcement, audit, and override controls. Realm-specific day-to-day queue management SHALL remain in `package/app` realm management.

#### Scenario: Admin opens escalated case

- **WHEN** a realm queue item is escalated to site staff
- **THEN** the admin panel MAY show it in governance oversight
- **AND** the realm's ordinary queue remains managed through the realm console

### Requirement: Governance override actions are audited

Operator override actions SHALL require policy authorization, reason capture, and staff audit.

#### Scenario: Operator reverses enforcement

- **WHEN** an operator reverses an account enforcement action
- **THEN** the reversal SHALL be audited and linked to the original enforcement/case when present
