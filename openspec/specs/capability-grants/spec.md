# capability-grants Specification

## Purpose
TBD - created by archiving change complete-platform-authorization. Update Purpose after archive.
## Requirements
### Requirement: Roles stay coarse; capabilities express granularity

The authorization model SHALL keep the global role enum flat (a fast-path identity tier) and SHALL express finer-grained privilege through capability grants evaluated by the policy layer. A role SHALL NOT be the sole determinant of a privileged action when a capability is defined for that action.

#### Scenario: Admin role does not imply every staff capability

- **GIVEN** a user has global role `ADMIN`
- **AND** the action `account.ban` requires the `account.ban` capability
- **WHEN** the user attempts `account.ban` without that capability granted
- **THEN** the policy SHALL deny the action
- **AND** the denial SHALL carry a capability-related audit code

### Requirement: Staff capability grants are explicit, scoped, and audited

The system SHALL support `StaffGrant` records with target user, capability key, optional scope, granting actor, and optional expiry. `ROOT` SHALL implicitly hold all staff capabilities. Creating or revoking a grant SHALL itself be a privileged action that writes a staff audit entry.

#### Scenario: Granting a capability is audited

- **WHEN** an authorized actor grants `moderation.decide` to a staff user
- **THEN** the grant SHALL be persisted with the granting actor and time
- **AND** a staff audit entry SHALL record the grant

#### Scenario: Expired grant stops authorizing

- **GIVEN** a staff grant for `audit.read` expired one minute ago
- **WHEN** the grantee attempts to read audit records
- **THEN** the policy SHALL not authorize the action on the basis of that expired grant

### Requirement: Realm roles carry granular capabilities, not only a tier

Realm moderation privilege SHALL be expressible as a capability set, not solely as a single role tier, so a moderator MAY hold a subset such as queue-only or tag-only. The realm member representation SHALL NOT foreclose per-member capability subsets; a single fixed-width `roleKey` string alone is insufficient as the long-term contract.

#### Scenario: Queue-only moderator cannot curate tags

- **GIVEN** a realm moderator holds only the realm `queue.decide` capability
- **WHEN** they attempt a realm tag curation action requiring `tag.curate`
- **THEN** realm policy SHALL deny the tag action
- **AND** allow the queue action

### Requirement: Both planes use one capability mechanism

Staff (global) and realm (scoped) capabilities SHALL share the same grant-and-evaluate shape, differing only by scope. The policy engine SHALL resolve capabilities as an input alongside role, account state, resource, and context.

#### Scenario: Scope distinguishes otherwise identical capabilities

- **GIVEN** a user holds a realm-scoped `content.takedown` capability for realm A
- **WHEN** they attempt a global content takedown
- **THEN** the policy SHALL deny the global action because the capability scope is realm A, not global

