## ADDED Requirements

### Requirement: RealmTagVote records per-member votes on realm tag applications

RealmTagVote SHALL be a junction table with a composite primary key of `(realmUnitId, userId, unitId, tagUnitId)`. It SHALL contain a `value` field constrained to `+1` or `-1` and a `createdAt` timestamp. Each realm member MAY hold at most one RealmTagVote per `(realmUnitId, unitId, tagUnitId)` triple, indicating whether they agree (+1) or disagree (-1) that the tag applies to the unit within that realm.

#### Scenario: Member upvotes a realm tag application

- **GIVEN** user "user-1" is a member of "realm-1"
- **AND** RealmTagUnit `(realm-1, unit-1, tag-1)` exists
- **WHEN** "user-1" submits a +1 RealmTagVote on `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagVote record SHALL be persisted with `(realmUnitId = "realm-1", userId = "user-1", unitId = "unit-1", tagUnitId = "tag-1", value = +1)`

#### Scenario: Member downvotes a realm tag application

- **GIVEN** user "user-2" is a member of "realm-1"
- **AND** RealmTagUnit `(realm-1, unit-1, tag-1)` exists
- **WHEN** "user-2" submits a -1 RealmTagVote on `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagVote record SHALL be persisted with `value = -1`

#### Scenario: Member cannot hold two votes on the same realm-unit-tag triple

- **GIVEN** user "user-1" already has a +1 RealmTagVote on `(realm-1, unit-1, tag-1)`
- **WHEN** "user-1" submits another vote on the same triple
- **THEN** the system SHALL update the existing record rather than creating a duplicate
- **AND** the composite primary key constraint SHALL enforce uniqueness

### Requirement: RealmTagVote write requires realm membership at write time

The system SHALL verify that the voter is a current member of the target realm at the moment a RealmTagVote is created or updated. Non-members and unauthenticated callers SHALL be rejected with an authorization error.

#### Scenario: Non-member is rejected

- **GIVEN** user "user-3" is NOT a member of "realm-1"
- **WHEN** "user-3" attempts to cast a RealmTagVote on a triple in "realm-1"
- **THEN** the system SHALL deny the operation with an authorization error
- **AND** no RealmTagVote record SHALL be created

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated caller attempts to write a RealmTagVote
- **THEN** the system SHALL deny the operation with an authentication error

#### Scenario: Member submits a vote successfully

- **GIVEN** user "user-1" is a current member of "realm-1"
- **WHEN** "user-1" submits a +1 RealmTagVote on `(realm-1, unit-1, tag-1)`
- **THEN** the operation SHALL succeed and persist the vote

### Requirement: RealmTagVote retention is permanent across membership changes

Once a RealmTagVote record has been created, it SHALL persist regardless of whether the voter remains a member of the realm. Removal of a RealmMember record SHALL NOT delete or modify any RealmTagVote rows previously written by that user. The denormalized `RealmTagUnit.score` SHALL continue to reflect retained historical votes.

#### Scenario: Member leaves the realm; their vote remains

- **GIVEN** user "user-1" cast a +1 RealmTagVote on `(realm-1, unit-1, tag-1)`
- **AND** the corresponding RealmTagUnit row reflects that vote in `score` and `voteCount`
- **WHEN** "user-1" leaves "realm-1" (RealmMember record removed)
- **THEN** the RealmTagVote record SHALL still exist
- **AND** the RealmTagUnit row's `score` and `voteCount` SHALL be unchanged

#### Scenario: Former member cannot cast a new vote

- **GIVEN** user "user-1" is no longer a member of "realm-1"
- **WHEN** "user-1" attempts to write a new RealmTagVote in "realm-1"
- **THEN** the system SHALL reject the write with an authorization error
- **AND** any prior RealmTagVote rows by "user-1" SHALL remain unchanged

### Requirement: RealmTagVote rows are the sole source of RealmTagUnit score

`RealmTagUnit.score` SHALL equal the sum of `value` across all RealmTagVote rows matching `(realmUnitId, unitId, tagUnitId)`. `RealmTagUnit.voteCount` SHALL equal the count of those rows. The denormalized values on RealmTagUnit are maintained for read performance, but the RealmTagVote table is authoritative; any divergence is treated as a recovery scenario, not a feature.

#### Scenario: Score reflects sum of vote values

- **GIVEN** RealmTagVote rows for `(realm-1, unit-1, tag-1)`: `(user-A, +1)`, `(user-B, +1)`, `(user-C, -1)`
- **WHEN** the system computes the canonical score
- **THEN** RealmTagUnit `(realm-1, unit-1, tag-1)` SHALL have `score = +1` and `voteCount = 3`

#### Scenario: Recovery from drift

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` has `score = 7` but RealmTagVote rows sum to `5`
- **WHEN** an integrity recovery is run
- **THEN** the RealmTagUnit row SHALL be updated to `score = 5` and `voteCount = count(RealmTagVote rows)`

### Requirement: Creating a RealmTagUnit row writes the creator's first +1 RealmTagVote

When a `POST /realm-tag-units` request creates a RealmTagUnit row that did not previously exist, the system MUST atomically insert a `RealmTagVote` row of `(realmUnitId, userId = caller, unitId, tagUnitId, value = +1)`. The newly created RealmTagUnit row SHALL therefore have `score = 1` and `voteCount = 1`.

#### Scenario: First-time create initializes vote and score

- **GIVEN** no RealmTagUnit exists for `(realm-1, unit-1, tag-1)`
- **AND** caller "user-1" is a member of "realm-1"
- **WHEN** "user-1" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagUnit row SHALL be created with `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`
- **AND** a RealmTagVote row SHALL be created with `(realm-1, user-1, unit-1, tag-1, +1)`

### Requirement: A subsequent create by another member behaves as a +1 vote on the existing row

When a `POST /realm-tag-units` request targets a `(realmUnitId, unitId, tagUnitId)` triple for which a RealmTagUnit already exists, and the caller has not previously cast a vote on that triple, the system MUST insert a `RealmTagVote` row of value `+1` from the caller and increment the existing RealmTagUnit's `score` and `voteCount` by 1.

#### Scenario: Second member tags the same triple

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` exists with `score = 1`, `voteCount = 1`
- **AND** caller "user-2" is a member of "realm-1" and has no prior RealmTagVote on this triple
- **WHEN** "user-2" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagVote row SHALL be created with `(realm-1, user-2, unit-1, tag-1, +1)`
- **AND** the RealmTagUnit row SHALL be updated to `score = 2`, `voteCount = 2`
- **AND** no duplicate RealmTagUnit SHALL be created

### Requirement: Repeated create by the same member is idempotent

When a `POST /realm-tag-units` request targets a triple on which the caller already holds a RealmTagVote, the system MUST treat the request as a no-op for vote insertion: it SHALL NOT create a duplicate vote row and SHALL NOT increment `score` or `voteCount`. The endpoint SHALL return success with the current RealmTagUnit state.

#### Scenario: Member retries a create they already performed

- **GIVEN** "user-1" previously created RealmTagUnit `(realm-1, unit-1, tag-1)`, producing a RealmTagVote row
- **WHEN** "user-1" sends `POST /realm-tag-units` for the same triple again
- **THEN** the system SHALL return success
- **AND** no additional RealmTagVote row SHALL be inserted
- **AND** RealmTagUnit `score` and `voteCount` SHALL be unchanged
