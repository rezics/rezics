## ADDED Requirements

### Requirement: POLL is a valid UnitType

The `UnitType` enum SHALL include a `POLL` value. A `Unit(type=POLL)` represents
a poll; only the act of polling is a unit, while its options and votes are
plain rows (not units).

#### Scenario: Create a unit with type POLL

- **WHEN** a Unit is created with `type = POLL`
- **THEN** the Unit record SHALL be persisted with `type = "POLL"`
- **AND** it SHALL support status and visibility like any other Unit type

### Requirement: A poll is a Unit with lightweight options and per-user votes

A poll SHALL be represented as a `Unit(type=POLL)` (the `Poll` type extension)
together with `PollOption` rows and `PollVote` rows. Options SHALL NOT be
modeled as separate `Unit` rows. Each `PollOption` SHALL belong to exactly one
poll and SHALL carry a `position` for display ordering and a denormalized
`voteCount`.

#### Scenario: Creating a poll with options

- **WHEN** a user creates a poll with two or more options
- **THEN** a `Unit(type=POLL)` SHALL be created with a `Poll` extension row
- **AND** one `PollOption` row SHALL be created per option, each with a
  `position` and `voteCount = 0`

#### Scenario: Options are not units

- **WHEN** a poll's options are created
- **THEN** no `Unit` row SHALL be created for any option

### Requirement: Each option is either an ad-hoc label or a unit reference

A `PollOption` SHALL carry an optional `label` and an optional `unitId` foreign
key to an existing `Unit`. Exactly one of `label` and `unitId` SHALL be set. The
client SHALL render whichever is present.

#### Scenario: Text option

- **WHEN** an option is created with a `label` and no `unitId`
- **THEN** the option SHALL be stored with that `label` and a null `unitId`

#### Scenario: Unit-reference option

- **WHEN** an option is created with a `unitId` referencing an existing unit
- **THEN** the option SHALL reference that unit and SHALL NOT create a new unit

#### Scenario: Rejecting an option with neither or both forms

- **WHEN** an option is created with neither `label` nor `unitId`, or with both
- **THEN** the request SHALL be rejected with a validation error

### Requirement: Single-choice exclusivity is enforced by the database

A poll SHALL declare a `voteMode` of `SINGLE` or `MULTI`. For a `SINGLE` poll,
the database SHALL guarantee at most one vote per user per poll via a primary
key (or unique constraint) of `(pollUnitId, userId)`. Casting a different option
by the same user on a `SINGLE` poll SHALL update the existing vote rather than
create a second row.

#### Scenario: Single-choice user changes their vote

- **GIVEN** a `SINGLE` poll where user U has voted for option A
- **WHEN** U casts a vote for option B
- **THEN** U's vote SHALL now be option B
- **AND** there SHALL be exactly one `PollVote` row for U in that poll
- **AND** option A's `voteCount` SHALL decrease by 1 and option B's SHALL
  increase by 1

#### Scenario: Single-choice second concurrent vote cannot duplicate

- **GIVEN** a `SINGLE` poll
- **WHEN** the same user attempts to hold votes for two options at once
- **THEN** the database constraint SHALL prevent more than one `PollVote` row for
  that user in that poll

#### Scenario: Multi-choice user selects several options

- **GIVEN** a `MULTI` poll
- **WHEN** user U votes for options A and C
- **THEN** two `PollVote` rows SHALL exist for U keyed by `(pollUnitId, userId,
  optionId)`

### Requirement: Tallies are denormalized and maintained on vote changes

`PollOption.voteCount` SHALL reflect the number of `PollVote` rows for that
option and SHALL be maintained when a vote is cast, changed, or withdrawn.
Result reads SHALL use the denormalized counts.

#### Scenario: Withdrawing a vote decrements the tally

- **GIVEN** option A with `voteCount = 5`
- **WHEN** a user who voted for A withdraws their vote
- **THEN** A's `voteCount` SHALL become 4
- **AND** the user's `PollVote` row SHALL be removed

### Requirement: A vote always records the voter, even when anonymous

Every `PollVote` SHALL store the `userId` of the voter regardless of the poll's
anonymity setting, to guarantee one-vote-per-user and allow vote changes.

#### Scenario: Anonymous poll still records the voter

- **GIVEN** an anonymous poll
- **WHEN** a user votes
- **THEN** the `PollVote` SHALL store that user's `userId`
- **AND** the one-vote-per-user guarantee SHALL still hold

### Requirement: Anonymity is a read-path guarantee

When `Poll.anonymous` is true, no read path SHALL expose the mapping between a
`userId` and the option they chose; only aggregate tallies (and the caller's own
vote) SHALL be returned. When `Poll.anonymous` is false, read paths MAY expose
who voted for what subject to normal authorization.

#### Scenario: Anonymous poll hides voter-to-option mapping

- **GIVEN** an anonymous poll with votes
- **WHEN** any caller reads results
- **THEN** the response SHALL contain aggregate tallies but SHALL NOT reveal
  which user chose which option
- **AND** the caller MAY see only their own vote

### Requirement: Result visibility may be deferred until close

A poll SHALL declare `resultVisibility` of `LIVE` or `AFTER_CLOSE`, and MAY
declare a `closesAt` time. For `AFTER_CLOSE`, tallies SHALL be withheld from
non-privileged callers until the poll is closed or `closesAt` has passed. Votes
SHALL be rejected after the poll is closed.

#### Scenario: After-close results hidden before close

- **GIVEN** an `AFTER_CLOSE` poll that is still open
- **WHEN** a non-privileged caller reads results
- **THEN** the response SHALL NOT include tallies

#### Scenario: After-close results revealed after close

- **GIVEN** an `AFTER_CLOSE` poll whose `closesAt` has passed
- **WHEN** any caller reads results
- **THEN** the response SHALL include the tallies

#### Scenario: Voting rejected after close

- **GIVEN** a closed poll
- **WHEN** a user attempts to vote
- **THEN** the request SHALL be rejected
