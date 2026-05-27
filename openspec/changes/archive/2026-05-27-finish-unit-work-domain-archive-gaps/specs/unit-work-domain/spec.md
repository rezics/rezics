## MODIFIED Requirements

### Requirement: Admin Work Merge Migrates Canonical Membership

The system SHALL provide an admin-only work merge operation that migrates
canonical release/content membership from a source hidden work to a target
hidden work. The source work Unit SHALL be preserved. Merge SHALL NOT
destructively delete source work metadata such as tags, aliases, external
references, attribution, or history.

For active work domains, merge SHALL run as a durable async operation with
dry-run preview, item-level progress, resumability, and enough before-state to
support revert. The start request SHALL create or update an operation and
enqueue execution; it SHALL NOT synchronously move every membership in the
request transaction.

#### Scenario: Merge moves release membership to target

- **GIVEN** releases `release-a` and `release-b` belong to source work
  `work-old`
- **WHEN** an admin merge operation from `work-old` to `work-new` completes
- **THEN** canonical membership for `release-a` and `release-b` SHALL resolve to
  `work-new`
- **AND** source work `work-old` SHALL remain in the database
- **AND** ordinary DTOs for those releases SHALL expose
  `metadata.uswn = work-new`

#### Scenario: Active work merge is queued

- **GIVEN** source work `work-old` has many releases, posts, reviews, shelves,
  or search projections
- **WHEN** an admin starts a merge into `work-new`
- **THEN** the request SHALL create or update a durable merge operation and
  enqueue the required migration/repair jobs
- **AND** the request SHALL NOT synchronously rewrite every affected membership
  or projection before returning
- **AND** operation status SHALL reflect queued/running/completed/failed
  execution states

#### Scenario: Merge execution is resumable

- **GIVEN** a merge operation has processed some membership moves
- **WHEN** the worker is interrupted
- **THEN** the persisted item-level progress SHALL allow the next worker run to
  resume without repeating completed moves unsafely
- **AND** revert SHALL have enough before-state to restore completed moves

### Requirement: Work Metadata Copy Is Optional And Independent

Work metadata copy SHALL be an explicit operation independent from canonical
work merge. Admins MAY copy missing metadata from a source work to a target work
without moving canonical membership, and MAY run canonical membership merge
without copying metadata.

Metadata copy SHALL create only rows missing from the target, SHALL preserve
source rows, SHALL support dry-run preview, and SHALL be revertible for rows it
created. For active merge operations, requested metadata copy SHALL run through
the same durable async operation machinery as membership moves.

#### Scenario: Metadata copy runs in queued operation

- **GIVEN** an admin starts merge with `copyMissingTags` or
  `copyMissingAliases`
- **WHEN** the operation executes
- **THEN** metadata copy SHALL be processed through durable operation progress
- **AND** created tag or alias rows SHALL be recorded for revert
