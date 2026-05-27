# editorial-moderation-boundary Specification

## Purpose
TBD - created by archiving change complete-platform-authorization. Update Purpose after archive.
## Requirements
### Requirement: Moderation changes state; it does not rewrite content

Moderation actions SHALL be limited to state changes such as hide, remove, lock, archive, restore, and account enforcement. The policy layer SHALL NOT expose a moderation action that rewrites a content body. Changing a content body SHALL flow exclusively through the editorial/authority system, and this SHALL hold for every actor including `ROOT`.

#### Scenario: No moderation action edits a body

- **WHEN** authorized staff act on a rule-violating post
- **THEN** the available moderation actions SHALL include hide, remove, lock, and restore
- **AND** SHALL NOT include rewriting the post body as a moderation action

#### Scenario: Privileged body edit uses the editorial path

- **GIVEN** staff must redact doxxing from within an otherwise-valid post
- **WHEN** the edit is performed
- **THEN** it SHALL be performed through the editorial/authority system
- **AND** SHALL NOT be performed as a silent moderation override

### Requirement: History scope follows ownership, not a blanket rule

Content revision history SHALL remain a per-content-type concern and SHALL NOT be forced onto all content, and ordinary self-edits by a content owner SHALL follow that content type's normal behavior without additional governance recording. An edit by a non-owner privileged actor SHALL always write a staff audit entry capturing before/after, and SHALL additionally create a content revision only when that content type already maintains revision history.

#### Scenario: Owner self-edit is not governance-recorded

- **WHEN** a user edits their own comment whose type keeps no revision history
- **THEN** the edit SHALL apply without creating a staff audit entry
- **AND** the system SHALL NOT force revision history onto that content type

#### Scenario: Cross-owner edit is always audited

- **GIVEN** a privileged actor edits another user's content
- **WHEN** the edit is applied
- **THEN** a staff audit entry SHALL record the actor, target, reason, and before/after summary
- **AND** a content revision SHALL also be created when the content type maintains revision history

