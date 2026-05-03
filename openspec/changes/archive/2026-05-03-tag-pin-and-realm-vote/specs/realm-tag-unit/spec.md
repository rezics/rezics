## ADDED Requirements

### Requirement: RealmTagUnit has score, voteCount, pinned, and position fields

RealmTagUnit SHALL contain the following additional fields beyond its `(realmUnitId, tagUnitId, unitId)` composite primary key: `score: integer` (default `0`), `voteCount: integer` (default `0`), `pinned: boolean` (default `false`), `position: string?` (nullable), and timestamp fields `createdAt`, `updatedAt`. The `score` and `voteCount` SHALL be derived from `RealmTagVote` rows as defined by the `realm-tag-vote` capability. The `pinned` and `position` fields define editorial ordering analogous to UnitTag.

#### Scenario: New RealmTagUnit row has expected default fields

- **WHEN** a RealmTagUnit row is newly created via the standard creation flow
- **THEN** the row SHALL have `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`, and timestamps populated

#### Scenario: RealmTagUnitDTO contains the new fields

- **GIVEN** the `RealmTagUnitDTO` type
- **WHEN** a consumer reads the type
- **THEN** it SHALL contain `realmUnitId`, `unitId`, `tagUnitId`, `score`, `voteCount`, `pinned`, `position`, `createdAt`, `updatedAt`

### Requirement: Any realm member can create a RealmTagUnit

Any authenticated user who is a current member of `realmUnitId` SHALL be able to create a RealmTagUnit record by sending a `POST /realm-tag-units` request. The first creator's request creates the row and writes their `+1` RealmTagVote; subsequent calls by other members append their `+1` RealmTagVote and increment the row by `1`. Repeated calls by the same member are idempotent. Realm membership SHALL be verified at write time.

#### Scenario: Regular member creates a realm tag application

- **GIVEN** "user-1" is a regular member (not a moderator or owner) of "realm-1"
- **WHEN** "user-1" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** the system SHALL create the RealmTagUnit row
- **AND** the system SHALL create a `+1` RealmTagVote row for "user-1"
- **AND** no authorization error SHALL be returned

#### Scenario: Non-member is denied

- **GIVEN** "user-x" is NOT a member of "realm-1"
- **WHEN** "user-x" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** the system SHALL deny the operation with an authorization error

### Requirement: RealmTagUnit display ordering pins-first then by score descending

When retrieving the RealmTagUnit list for a `(realmUnitId, unitId)` pair, the system SHALL emit rows in two sections in order: first all rows where `pinned = true` sorted by `position` ascending (lexicographic string compare), then all rows where `pinned = false` sorted by `score` descending. Ties within either section SHALL maintain a stable order. This ordering rule applies to both realm-context endpoints and any list endpoint that returns realm-scoped tag rows.

#### Scenario: Pinned realm tags lead the realm-context list

- **GIVEN** RealmTagUnit rows for `(realm-1, unit-1)`: `tag-A (pinned=true, position="G")`, `tag-B (pinned=true, position="M")`, `tag-C (pinned=false, score=5)`, `tag-D (pinned=false, score=200)`
- **WHEN** a client requests realm-1's tags for unit-1
- **THEN** the order SHALL be: `tag-A`, `tag-B`, `tag-D`, `tag-C`

### Requirement: Pin and delete authority for RealmTagUnit is restricted to admin or realm owner

Setting `pinned`, mutating `position`, unpinning, and deleting a RealmTagUnit row SHALL be restricted to:
- platform administrators, OR
- the user identified as the realm's owner.

Realm moderators SHALL NOT hold pin or delete authority on RealmTagUnit in this iteration.

#### Scenario: Realm owner pins a realm tag

- **GIVEN** "user-owner" is the owner of "realm-1"
- **AND** RealmTagUnit `(realm-1, unit-1, tag-1)` exists with `pinned = false`
- **WHEN** "user-owner" requests to pin the row at position `"M"`
- **THEN** the row SHALL be updated to `pinned = true, position = "M"`

#### Scenario: Platform admin deletes a RealmTagUnit

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` exists
- **WHEN** a platform administrator sends a delete request
- **THEN** the row SHALL be removed
- **AND** all RealmTagVote rows for `(realm-1, unit-1, tag-1)` SHALL also be removed

#### Scenario: Realm moderator is denied pin authority

- **GIVEN** "user-mod" is a moderator (but not the owner) of "realm-1"
- **WHEN** "user-mod" attempts to pin or delete a RealmTagUnit row in "realm-1"
- **THEN** the system SHALL deny the operation with an authorization error

#### Scenario: Regular member is denied pin authority

- **GIVEN** "user-1" is a regular member of "realm-1"
- **WHEN** "user-1" attempts to pin or delete a RealmTagUnit row in "realm-1"
- **THEN** the system SHALL deny the operation with an authorization error

### Requirement: RealmTagUnit deletion is unconditional for authorized actors

Deletion of a RealmTagUnit row by an authorized actor (platform admin or realm owner) SHALL succeed regardless of the row's current `score`. There SHALL be no minimum-score gate or community-consensus precondition for deletion.

#### Scenario: Delete a high-score realm tag row

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` with `score = 50`
- **WHEN** an authorized actor sends a delete request
- **THEN** the row SHALL be removed

#### Scenario: Delete a low-score realm tag row

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` with `score = -3`
- **WHEN** an authorized actor sends a delete request
- **THEN** the row SHALL be removed

### Requirement: RealmTagUnit rows with score at or below -100 are hidden from regular users

When a list/search endpoint returns RealmTagUnit rows for a regular caller (any user who is not a platform administrator and not the realm's owner), rows whose `score ≤ -100` SHALL be excluded. When the same endpoint is called by a platform administrator or by the realm's owner, those rows SHALL be included with a flag (e.g. `belowVisibilityThreshold: true`) marking their suppressed status.

#### Scenario: Regular member does not see suppressed realm rows

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` has `score = -120`
- **WHEN** a regular member of "realm-1" requests the realm tag list for "unit-1"
- **THEN** the response SHALL NOT include `(realm-1, unit-1, tag-1)`

#### Scenario: Realm owner sees suppressed rows on their own realm

- **GIVEN** "user-owner" is the owner of "realm-1"
- **AND** RealmTagUnit `(realm-1, unit-1, tag-1)` has `score = -120`
- **WHEN** "user-owner" requests the realm tag list for "unit-1"
- **THEN** the response SHALL include `(realm-1, unit-1, tag-1)` with `belowVisibilityThreshold = true`

### Requirement: Admin discovery endpoint for low-score RealmTagUnit rows

The system SHALL expose an admin-only endpoint that lists RealmTagUnit rows with `score` at or below a configurable threshold (default `-100`), to support periodic moderation sweeps. The endpoint SHALL accept `threshold` and optional `realmUnitId` query parameters and SHALL return rows ordered by `score` ascending.

#### Scenario: Admin lists low-score realm rows

- **GIVEN** several RealmTagUnit rows have `score ≤ -100`
- **WHEN** a platform administrator calls the admin discovery endpoint with `threshold = -100`
- **THEN** the response SHALL include those rows ordered by `score` ascending

#### Scenario: Admin scopes discovery to a single realm

- **WHEN** a platform administrator calls the discovery endpoint with `threshold = -100` and `realmUnitId = "realm-1"`
- **THEN** the response SHALL contain only rows whose `realmUnitId` is "realm-1"

### Requirement: RealmTagUnit and UnitTag have fully independent lifecycles

A RealmTagUnit row and the corresponding UnitTag row (if any) SHALL be independent. Specifically: deleting a UnitTag SHALL NOT delete or modify any RealmTagUnit row that references the same `(unitId, tagUnitId)`; deleting a RealmTagUnit SHALL NOT delete or modify any UnitTag row that references the same `(unitId, tagUnitId)`. There SHALL be no foreign key from RealmTagUnit to UnitTag, nor any server-side cascade between the two layers in either direction.

#### Scenario: Deleting a RealmTagUnit does not affect UnitTag

- **GIVEN** RealmTagUnit `(realm-1, unit-1, tag-1)` and UnitTag `(unit-1, tag-1)` both exist
- **AND** UnitTag `(unit-1, tag-1)` has `score = 7`
- **WHEN** an authorized actor deletes RealmTagUnit `(realm-1, unit-1, tag-1)`
- **THEN** UnitTag `(unit-1, tag-1)` SHALL still exist with `score = 7`

#### Scenario: Deleting a UnitTag does not affect RealmTagUnit

- **GIVEN** UnitTag `(unit-1, tag-1)` and RealmTagUnit `(realm-1, unit-1, tag-1)` both exist
- **AND** RealmTagUnit `(realm-1, unit-1, tag-1)` has `score = 4`
- **WHEN** an authorized actor deletes UnitTag `(unit-1, tag-1)`
- **THEN** RealmTagUnit `(realm-1, unit-1, tag-1)` SHALL still exist with `score = 4`

### Requirement: Client coordinates simultaneous global and realm tag writes

When a user tags a unit inside a realm, the client SHALL issue two independent writes: `POST /realm-tag-units` for the realm-scoped relation and `POST /unit-tags` for the global relation. Each write is independently authoritative. The server SHALL NOT couple the two writes; if only one succeeds, the system SHALL accept the resulting partial state without rollback. The client is responsible for surfacing partial-success errors to the user and offering retry.

#### Scenario: Both writes succeed

- **GIVEN** "user-1" is a member of "realm-1"
- **WHEN** the client issues `POST /realm-tag-units (realm-1, unit-1, tag-1)` and `POST /unit-tags (unit-1, tag-1)` in sequence
- **AND** both succeed
- **THEN** RealmTagUnit `(realm-1, unit-1, tag-1)` and UnitTag `(unit-1, tag-1)` SHALL both exist with their respective +1 votes recorded

#### Scenario: Realm write succeeds, global write fails

- **GIVEN** the realm-scoped POST has succeeded
- **WHEN** the global `POST /unit-tags` fails (e.g. transient network or server error)
- **THEN** the RealmTagUnit row SHALL still exist with its +1 vote
- **AND** the system SHALL accept this partial state; no automatic rollback SHALL occur
- **AND** the client SHALL surface the error and offer retry of the failed global write

#### Scenario: Global write succeeds, realm write fails

- **GIVEN** the global `POST /unit-tags` has succeeded
- **WHEN** the realm-scoped `POST /realm-tag-units` fails
- **THEN** the UnitTag row SHALL still exist with its +1 vote
- **AND** the client SHALL surface the error and offer retry of the failed realm write

## MODIFIED Requirements

### Requirement: RealmUnit removal withdraws a unit from a realm

Removing a RealmUnit record SHALL remove the unit from the realm's content feed. Removal of a RealmUnit SHALL NOT affect any UnitTag records and SHALL NOT affect any RealmTagUnit records that reference the realm and unit; removal of those rows is a separate, deliberate action by an authorized actor.

#### Scenario: Remove a unit from a realm

- **GIVEN** RealmUnit `(realmUnitId = "realm-1", unitId = "unit-1")`
- **WHEN** the RealmUnit record is deleted
- **THEN** "unit-1" SHALL no longer appear in "realm-1"'s content feed

#### Scenario: Removal does not affect global tags

- **GIVEN** RealmUnit `(realm-1, unit-1)` and UnitTag rows for "unit-1" exist
- **WHEN** the RealmUnit record is deleted
- **THEN** all UnitTag records for "unit-1" SHALL retain their current scores
- **AND** no UnitTag records SHALL be removed or decremented

#### Scenario: Removal does not affect existing RealmTagUnit rows

- **GIVEN** RealmUnit `(realm-1, unit-1)` and RealmTagUnit rows like `(realm-1, unit-1, tag-1)` exist
- **WHEN** the RealmUnit record is deleted
- **THEN** RealmTagUnit rows SHALL be retained until separately deleted by an authorized actor
- **AND** their `score` and `voteCount` SHALL be unchanged

## REMOVED Requirements

### Requirement: RealmTagUnit creation MUST cascade to UnitTag

**Reason**: This server-side cascade conflated two distinct user statements (a realm-scoped endorsement and a global-scoped endorsement) into a single write, and silently coupled the global score to realm moderation activity. The replacement model treats the two layers as independent peers: the client issues two separate requests when the user intends both, and each layer maintains its own score solely from its own vote table (TagVote for UnitTag, RealmTagVote for RealmTagUnit).

**Migration**: No data migration is required for the cascade itself; existing UnitTag rows that previously received cascade contributions retain their scores, but those scores are reinterpreted as ordinary community votes (each cascade event historically wrote one notional +1; future score derivation is `Σ TagVote.value` only). Server code that performs the cascade on create SHALL be removed. Client code that issues `POST /realm-tag-units` MUST be updated to also issue `POST /unit-tags` whenever the user intends a global tag application accompanying the realm one. Server endpoints continue to accept either call independently. See the new requirement "Client coordinates simultaneous global and realm tag writes" for the new client contract.

### Requirement: RealmTagUnit removal MUST NOT cascade to UnitTag

**Reason**: This requirement is subsumed by the broader principle "RealmTagUnit and UnitTag have fully independent lifecycles", which covers both create and delete in both directions and is added in this change.

**Migration**: None. Existing behavior (no cascade on RealmTagUnit removal) is preserved by the replacement requirement.

### Requirement: Only moderators and owners can manage RealmTagUnit

**Reason**: The previous restriction conflated two operations that this change separates. Tag *creation* in a realm is now a member-driven contribution that participates in the realm's score (via the new `realm-tag-vote` capability) — restricting it to moderators/owners would prevent the score axis from reflecting member sentiment. *Pinning* and *deleting*, which are editorial/curatorial actions, remain restricted (to platform admin and realm owner per the new requirement "Pin and delete authority for RealmTagUnit is restricted to admin or realm owner").

**Migration**: API gateway / authorization middleware that enforced moderator-or-owner access on `POST /realm-tag-units` SHALL be relaxed to require only realm membership. The same gateway SHALL be tightened on the new pin/position mutation endpoints and on `DELETE /realm-tag-units` to allow only platform admin or realm owner. Realm moderators retain their existing authority on other realm capabilities; only their authority over the tag-application records is removed.
