# moderation-case-workflow Specification

## Purpose
TBD - created by archiving change complete-platform-authorization. Update Purpose after archive.
## Requirements
### Requirement: Reports create moderation cases

The system SHALL create or link a `ModerationCase` when a user reports content, a user, a realm, or a system abuse event. Existing feedback reports SHALL be backfilled as case sources.

#### Scenario: Content report opens a case

- **WHEN** a user reports a post
- **THEN** the system SHALL create a moderation case targeting that post
- **AND** the case SHALL include reporter, target, reason, source evidence, state `new`, and realm context when available

### Requirement: Cases support queue workflow

Moderation cases SHALL support queue states `new`, `triaged`, `assigned`, `actioned`, `resolved`, `duplicate`, `rejected`, and `escalated`.

#### Scenario: Staff assigns a case

- **WHEN** site staff assigns a `new` case to a reviewer
- **THEN** the case SHALL transition to `assigned`
- **AND** a case event and staff audit log SHALL be written

### Requirement: Case decisions are auditable and reversible where possible

Case decisions SHALL record action, actor, reason, target, before/after summary, and reversal eligibility. Content hide/restore and account enforcement decisions SHALL expose follow-up actions according to policy.

#### Scenario: Staff restores hidden content

- **GIVEN** a case decision hid a post
- **WHEN** authorized staff reverses the decision
- **THEN** the post SHALL be restored when still valid
- **AND** the reversal SHALL be appended to the case event history

