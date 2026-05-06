## ADDED Requirements

### Requirement: RealmTagVote records per-member votes on realm tag applications

RealmTagVote SHALL be a vote table keyed by the realm-tag application and voter. Its composite primary key SHALL be `(realmUnitId, tagUnitId, unitId, userId)`. It SHALL contain a `value` field constrained to `+1` or `-1` and a `createdAt` timestamp. Each realm member MAY hold at most one RealmTagVote per `RealmTagUnit(realmUnitId, tagUnitId, unitId)` application, indicating whether they agree (+1) or disagree (-1) that the global tag applies to the target Unit within that realm.

RealmTagVote SHALL relate to `RealmTagUnit` as its application target rather than exposing separate reverse relations from Unit for realm, tag, and target roles.

#### Scenario: Member upvotes a realm tag application

- **GIVEN** user "user-1" is a member of "realm-1"
- **AND** RealmTagUnit `(realm-1, tag-1, unit-1)` exists
- **WHEN** "user-1" submits a +1 RealmTagVote on `(realm-1, tag-1, unit-1)`
- **THEN** a RealmTagVote record SHALL be persisted with `(realmUnitId = "realm-1", tagUnitId = "tag-1", unitId = "unit-1", userId = "user-1", value = +1)`

#### Scenario: Member downvotes a realm tag application

- **GIVEN** user "user-2" is a member of "realm-1"
- **AND** RealmTagUnit `(realm-1, tag-1, unit-1)` exists
- **WHEN** "user-2" submits a -1 RealmTagVote on `(realm-1, tag-1, unit-1)`
- **THEN** a RealmTagVote record SHALL be persisted with `value = -1`

#### Scenario: Member cannot hold two votes on the same realm tag application

- **GIVEN** user "user-1" already has a +1 RealmTagVote on `(realm-1, tag-1, unit-1)`
- **WHEN** "user-1" submits another vote on the same application
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

`RealmTagUnit.score` SHALL equal the sum of `value` across all RealmTagVote rows matching the application `(realmUnitId, tagUnitId, unitId)`. `RealmTagUnit.voteCount` SHALL equal the count of those rows. The denormalized values on RealmTagUnit are maintained for read performance, but the RealmTagVote table is authoritative; any divergence is treated as a recovery scenario, not a feature.

#### Scenario: Score reflects sum of vote values

- **GIVEN** RealmTagVote rows for `(realm-1, tag-1, unit-1)`: `(user-A, +1)`, `(user-B, +1)`, `(user-C, -1)`
- **WHEN** the system computes the canonical score
- **THEN** RealmTagUnit `(realm-1, tag-1, unit-1)` SHALL have `score = +1` and `voteCount = 3`

#### Scenario: Recovery from drift

- **GIVEN** RealmTagUnit `(realm-1, tag-1, unit-1)` has `score = 7` but RealmTagVote rows sum to `5`
- **WHEN** an integrity recovery is run
- **THEN** the RealmTagUnit row SHALL be updated to `score = 5` and `voteCount = count(RealmTagVote rows)`

### Requirement: Creating a RealmTagUnit row writes the creator's first +1 RealmTagVote

When a `POST /realm-tag-units` request creates a RealmTagUnit row that did not previously exist, the system MUST atomically insert a `RealmTagVote` row of `(realmUnitId, tagUnitId, unitId, userId = caller, value = +1)`. The newly created RealmTagUnit row SHALL therefore have `score = 1` and `voteCount = 1`.

#### Scenario: First-time create initializes vote and score

- **GIVEN** no RealmTagUnit exists for `(realm-1, tag-1, unit-1)`
- **AND** caller "user-1" is a member of "realm-1"
- **WHEN** "user-1" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagUnit row SHALL be created with `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`
- **AND** a RealmTagVote row SHALL be created with `(realm-1, tag-1, unit-1, user-1, +1)`

### Requirement: A subsequent create by another member behaves as a +1 vote on the existing row

When a `POST /realm-tag-units` request targets a `(realmUnitId, tagUnitId, unitId)` application for which a RealmTagUnit already exists, and the caller has not previously cast a vote on that application, the system MUST insert a RealmTagVote row of value `+1` from the caller and increment the existing RealmTagUnit's `score` and `voteCount` by 1.

#### Scenario: Second member tags the same triple

- **GIVEN** RealmTagUnit `(realm-1, tag-1, unit-1)` exists with `score = 1`, `voteCount = 1`
- **AND** caller "user-2" is a member of "realm-1" and has no prior RealmTagVote on this application
- **WHEN** "user-2" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagVote row SHALL be created with `(realm-1, tag-1, unit-1, user-2, +1)`
- **AND** the RealmTagUnit row SHALL be updated to `score = 2`, `voteCount = 2`
- **AND** no duplicate RealmTagUnit SHALL be created

### Requirement: Repeated create by the same member is idempotent

When a `POST /realm-tag-units` request targets an application on which the caller already holds a RealmTagVote, the system MUST treat the request as a no-op for vote insertion: it SHALL NOT create a duplicate vote row and SHALL NOT increment `score` or `voteCount`. The endpoint SHALL return success with the current RealmTagUnit state. The global TagVote contribution owned by the same request path SHALL also remain idempotent.

#### Scenario: Member retries a create they already performed

- **GIVEN** "user-1" previously created RealmTagUnit `(realm-1, tag-1, unit-1)`, producing a RealmTagVote row
- **WHEN** "user-1" sends `POST /realm-tag-units` for the same application again
- **THEN** the system SHALL return success
- **AND** no additional RealmTagVote row SHALL be inserted
- **AND** RealmTagUnit `score` and `voteCount` SHALL be unchanged
- **AND** no duplicate global TagVote SHALL be inserted for `(user-1, unit-1, tag-1)`

### Requirement: RealmTagVote cascades from the realm tag application

RealmTagVote rows SHALL be modeled as votes on a specific `RealmTagUnit` application. Deleting a `RealmTagUnit(realmUnitId, tagUnitId, unitId)` row SHALL delete all `RealmTagVote` rows for that application through the application relation or an equivalent transactional cascade.

#### Scenario: Application delete removes its votes

- **GIVEN** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **AND** RealmTagVote rows exist for users "user-1" and "user-2" on that application
- **WHEN** an authorized actor deletes `RealmTagUnit(realm-1, tag-1, unit-1)`
- **THEN** all RealmTagVote rows for `(realm-1, tag-1, unit-1)` SHALL be deleted
- **AND** votes for other realm-tag applications SHALL remain unchanged
