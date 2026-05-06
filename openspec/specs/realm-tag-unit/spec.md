# realm-tag-unit Specification

## Purpose

Defines `RealmUnit` and `RealmTagUnit` — the junction tables that record which content units belong to a realm and which tags a realm has applied to a unit. Covers the schema, query paths (units in a realm, units with a tag, tags applied by a realm, realms that tagged a unit), display ordering (pins-first then score-desc), authorization (any member can tag; pin/delete restricted to admin or owner), visibility thresholds, and the independence between `RealmTagUnit` and the global `UnitTag`/`extra.tagTree` layers.

## Requirements

### Requirement: RealmUnit adds a unit to a realm's content feed

RealmUnit SHALL be a junction table with fields `realmUnitId` (the realm's Unit id) and `unitId` (the content Unit id). Creating a RealmUnit record signifies that the unit is submitted to and visible within the realm's content feed.

#### Scenario: Add a unit to a realm

- GIVEN a realm with Unit id "realm-1" and a content Unit "unit-1"
- WHEN a RealmUnit record is created with `(realmUnitId = "realm-1", unitId = "unit-1")`
- THEN the unit "unit-1" SHALL appear in the content feed of realm "realm-1"

#### Scenario: Unit appears in multiple realms

- GIVEN Unit "unit-1" with RealmUnit records for "realm-1" and "realm-2"
- WHEN querying each realm's content feed
- THEN "unit-1" SHALL appear in both realm feeds independently

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

### Requirement: Query all units in a realm

The system SHALL support querying all units belonging to a realm by selecting RealmUnit records matching a given `realmUnitId`.

#### Scenario: List all units in a realm

- GIVEN RealmUnit records: `(realm-1, unit-1)`, `(realm-1, unit-2)`, `(realm-1, unit-3)`
- WHEN a client queries all units in "realm-1"
- THEN the response SHALL include "unit-1", "unit-2", and "unit-3"

#### Scenario: Empty realm returns no units

- GIVEN no RealmUnit records for "realm-empty"
- WHEN a client queries all units in "realm-empty"
- THEN the response SHALL return an empty list

### Requirement: Query all units in a realm with a specific tag

The system SHALL support querying units in a realm that have been classified with a specific tag, by joining RealmTagUnit on `realmUnitId` and `tagUnitId`.

#### Scenario: Filter realm units by tag

- GIVEN RealmTagUnit records: `(realm-1, tag-action, unit-1)`, `(realm-1, tag-action, unit-2)`, `(realm-1, tag-comedy, unit-3)`
- WHEN a client queries "realm-1" filtered by "tag-action"
- THEN the response SHALL include "unit-1" and "unit-2"
- AND "unit-3" SHALL NOT be included

#### Scenario: No units match the tag filter

- GIVEN RealmTagUnit records for "realm-1" that do not include "tag-horror"
- WHEN a client queries "realm-1" filtered by "tag-horror"
- THEN the response SHALL return an empty list

### Requirement: Query all tags a realm has applied to a unit

The system SHALL support querying all tags that a specific realm has applied to a specific unit by selecting RealmTagUnit records matching both `realmUnitId` and `unitId`.

#### Scenario: List realm-specific tags for a unit

- GIVEN RealmTagUnit records: `(realm-1, tag-action, unit-1)`, `(realm-1, tag-sci-fi, unit-1)`, `(realm-2, tag-drama, unit-1)`
- WHEN a client queries tags applied by "realm-1" to "unit-1"
- THEN the response SHALL include "tag-action" and "tag-sci-fi"
- AND "tag-drama" SHALL NOT be included (it belongs to "realm-2")

### Requirement: Query all realms that have tagged a unit

The system SHALL support querying all realms that have applied at least one tag to a given unit by selecting distinct `realmUnitId` values from RealmTagUnit records matching `unitId`.

#### Scenario: List realms that tagged a unit

- GIVEN RealmTagUnit records: `(realm-1, tag-action, unit-1)`, `(realm-2, tag-drama, unit-1)`, `(realm-3, tag-comedy, unit-2)`
- WHEN a client queries all realms that have tagged "unit-1"
- THEN the response SHALL include "realm-1" and "realm-2"
- AND "realm-3" SHALL NOT be included (it tagged a different unit)

#### Scenario: Unit with no realm tags

- GIVEN no RealmTagUnit records for "unit-orphan"
- WHEN a client queries all realms that have tagged "unit-orphan"
- THEN the response SHALL return an empty list

### Requirement: Realms as namespaces for tag classification

Realms SHALL provide a community context for applying and interpreting existing global tags. This behavior is namespace-like only for query, display, ranking, and interpretation purposes; it SHALL NOT make `Realm` itself a tag/classifier, SHALL NOT create realm-local tag identities, and SHALL NOT introduce a separate realm-owned tag vocabulary. Different realms SHALL be able to apply the same global tag to the same target Unit independently, and those realm-scoped applications SHALL remain separate from realm feed membership.

#### Scenario: Same tag applied by different realms

- GIVEN tag "long-hair" exists as a global TAG Unit
- AND "realm-female-traits" applies "long-hair" to "unit-1" via RealmTagUnit
- AND "realm-male-traits" applies "long-hair" to "unit-1" via RealmTagUnit
- WHEN querying RealmTagUnit for "unit-1"
- THEN both realm applications SHALL exist as separate records
- AND both records SHALL reference the same global tag Unit
- AND neither realm SHALL have created a local replacement tag

#### Scenario: Different realms classify the same unit differently

- GIVEN "realm-genre" applies tags "action" and "sci-fi" to "unit-1"
- AND "realm-mood" applies tags "dark" and "intense" to "unit-1"
- WHEN querying tags by "realm-genre" for "unit-1"
- THEN only "action" and "sci-fi" SHALL be returned
- AND when querying tags by "realm-mood" for "unit-1", only "dark" and "intense" SHALL be returned
- AND the global UnitTag list for "unit-1" SHALL include all four tags when global tag votes have been contributed through the standard write path

#### Scenario: Realm-scoped classification is not feed membership

- GIVEN "realm-critics" applies tag "slow-burn" to "unit-1" via RealmTagUnit
- AND no `RealmUnit(realm-critics, unit-1)` row exists
- WHEN querying "realm-critics" content feed
- THEN "unit-1" SHALL NOT appear only because it has a RealmTagUnit row
- AND when filtering by `RealmTagUnit(realm-critics, slow-burn, *)`
- THEN "unit-1" SHALL be eligible for the realm-tag filtered result

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

Any authenticated user who is a current member of `realmUnitId` SHALL be able to create a RealmTagUnit record by sending a `POST /realm-tag-units` request. The request SHALL validate that `realmUnitId` references a REALM Unit and `tagUnitId` references an existing global TAG Unit. The first creator's request creates the row, writes their `+1` RealmTagVote, and idempotently contributes their ordinary global `TagVote` for `(unitId, tagUnitId)`. Subsequent calls by other members append their `+1` RealmTagVote and idempotently contribute their global `TagVote`. Repeated calls by the same member are idempotent. Realm membership SHALL be verified at write time.

#### Scenario: Regular member creates a realm tag application

- **GIVEN** "user-1" is a regular member (not a moderator or owner) of "realm-1"
- **AND** "realm-1" is a REALM Unit
- **AND** "tag-1" is a TAG Unit
- **WHEN** "user-1" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** the system SHALL create the RealmTagUnit row
- **AND** the system SHALL create a `+1` RealmTagVote row for "user-1"
- **AND** the system SHALL create or preserve the user's global `TagVote(user-1, unit-1, tag-1, +1)`
- **AND** no authorization error SHALL be returned

#### Scenario: Non-member is denied

- **GIVEN** "user-x" is NOT a member of "realm-1"
- **WHEN** "user-x" sends `POST /realm-tag-units` for `(realm-1, unit-1, tag-1)`
- **THEN** the system SHALL deny the operation with an authorization error
- **AND** no RealmTagUnit, RealmTagVote, or global TagVote row SHALL be created for this request

#### Scenario: Non-tag target is rejected as applied tag

- **GIVEN** "user-1" is a member of "realm-1"
- **AND** `book-1` exists as a BOOK Unit
- **WHEN** "user-1" sends `POST /realm-tag-units` with `tagUnitId = "book-1"`
- **THEN** the system SHALL reject the operation with a validation error
- **AND** no RealmTagUnit row SHALL be created

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

A RealmTagUnit row and the corresponding UnitTag row (if any) SHALL remain independently deletable and independently authoritative for their own score layer. Deleting a UnitTag SHALL NOT delete or modify any RealmTagUnit row that references the same `(unitId, tagUnitId)`. Deleting a RealmTagUnit SHALL NOT delete or modify any UnitTag row that references the same `(unitId, tagUnitId)`. There SHALL be no foreign key from RealmTagUnit to UnitTag. However, the standard `POST /realm-tag-units` write path SHALL idempotently contribute the caller's ordinary global `TagVote` and update or create the corresponding UnitTag aggregate according to global tag vote rules.

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

#### Scenario: Realm tag creation contributes to global tag layer

- **GIVEN** no UnitTag exists for `(unit-1, tag-1)`
- **AND** "user-1" is a member of "realm-1"
- **WHEN** "user-1" creates `RealmTagUnit(realm-1, tag-1, unit-1)` through the standard endpoint
- **THEN** the system SHALL create or update the global `UnitTag(unit-1, tag-1)` aggregate according to the existing global vote rules
- **AND** the global layer SHALL remain independently deletable after creation

### Requirement: RealmTagUnit and extra.tagTree have independent purposes

`RealmTagUnit` and `Realm.extra.tagTree` SHALL serve distinct purposes that do not constrain each other:

- `RealmTagUnit(realmUnitId, unitId, tagUnitId)` SHALL track which tags have been applied to which units within a realm, with score, voteCount, pinned, and position fields. It is the data layer of realm-scoped tagging.
- `Realm.extra.tagTree` SHALL be a curation hint surfaced in the post-composer tag picker. It is purely a UX affordance for quick selection.

A tag id appearing in `extra.tagTree` SHALL NOT imply any `RealmTagUnit` row exists. A tag id NOT in `extra.tagTree` SHALL NOT be prevented from being applied via `RealmTagUnit`. The two layers SHALL evolve independently.

#### Scenario: tagTree advertises a tag with no RealmTagUnit rows yet

- **GIVEN** realm-1 with `extra.tagTree = [{ tagId: "action" }]`
- **AND** no `RealmTagUnit` rows exist for `(realm-1, *, action)`
- **WHEN** a member opens the composer in realm-post mode for realm-1
- **THEN** the picker SHALL show "action" as a quick-pick chip
- **AND** the absence of RealmTagUnit rows SHALL NOT prevent rendering or selection

#### Scenario: RealmTagUnit exists for a tag not in tagTree

- **GIVEN** realm-1 with `extra.tagTree = []`
- **AND** `RealmTagUnit(realm-1, post-A, "fantasy")` exists from a previous tagging
- **WHEN** the realm's tag-filter is rendered on the Feed tab
- **THEN** the filter SHALL NOT show "fantasy" as a chip (it sources from tagTree only)
- **AND** the existing RealmTagUnit row SHALL remain unaffected
- **AND** post-A SHALL still appear in the realm's feed

#### Scenario: User picks a tag outside tagTree at post time

- **GIVEN** realm-1 with `extra.tagTree = [{ tagId: "action" }]`
- **WHEN** a user composes a post in realm-1 and uses search to pick `tag-romance`
- **THEN** the post SHALL be created with `tagIds: ["tag-romance"]`
- **AND** a `UnitTag(postUnitId, "tag-romance")` row SHALL be written
- **AND** no validation SHALL reject the post for using a tag outside tagTree

### Requirement: Realm cannot create new tags

The system SHALL NOT permit a realm to create new tag Units. Tag creation SHALL be a global, realm-independent operation governed by whichever capability owns global tag lifecycle. Realm management endpoints (`PUT /realms/:realmId/extra/tagTree`, etc.) SHALL accept only tag ids referencing already-existing tag Units; references to nonexistent tag ids SHALL be rejected with 400.

This invariant ensures the global tag pool remains the single source of truth and prevents proliferation of duplicate or realm-specific tags.

#### Scenario: tagTree edit rejects nonexistent tagId

- **GIVEN** "tag-fictional" does not exist as a Unit
- **WHEN** a moderator submits `PUT /realms/realm-1/extra/tagTree` body `{ value: [{ tagId: "tag-fictional" }] }`
- **THEN** the request SHALL be rejected with `400 Bad Request`
- **AND** the realm SHALL NOT have created any new Unit

#### Scenario: No realm-side tag creation endpoint exists

- **WHEN** a developer audits the realm API surface
- **THEN** no endpoint SHALL allow creating a new tag Unit scoped to a realm
- **AND** all tag-creation paths SHALL go through the global tag system

### Requirement: RealmTagUnit is independent from RealmUnit

`RealmTagUnit(realmUnitId, tagUnitId, unitId)` SHALL record that a realm applied an existing global tag to a target Unit. It SHALL NOT require `RealmUnit(realmUnitId, unitId)` to exist, SHALL NOT create `RealmUnit` as a side effect, and SHALL NOT be deleted merely because a related `RealmUnit` row is deleted.

#### Scenario: Realm classifies a unit outside its feed

- **GIVEN** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **AND** target Unit `unit-1` exists
- **AND** no `RealmUnit(realm-1, unit-1)` row exists
- **WHEN** a current member creates `RealmTagUnit(realm-1, tag-1, unit-1)`
- **THEN** the operation SHALL succeed
- **AND** no `RealmUnit(realm-1, unit-1)` row SHALL be created automatically

#### Scenario: Realm feed removal does not remove realm tag application

- **GIVEN** `RealmUnit(realm-1, unit-1)` exists
- **AND** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **WHEN** `RealmUnit(realm-1, unit-1)` is deleted
- **THEN** `RealmTagUnit(realm-1, tag-1, unit-1)` SHALL remain until explicitly removed by an authorized actor

### Requirement: RealmTagUnit relation roles are explicit and documented

The Prisma schema and schema-facing service/contract types SHALL name realm-tag application relations by product role rather than by generic Unit role. The realm side SHOULD be exposed through the Realm extension model where practical, the tag side SHALL be named as the applied global tag, and the target side SHALL be named as the target Unit. JSDoc or equivalent source comments SHALL explain that RealmTagUnit is not a local tag and not a Unit identity.

#### Scenario: Prisma relation names expose business roles

- **WHEN** a developer inspects the schema after the change
- **THEN** the old reverse relation names `realmTagAsRealm`, `realmTagAsTag`, `realmTagAsUnit`, `realmTagVoteAsRealm`, `realmTagVoteAsTag`, and `realmTagVoteAsUnit` SHALL NOT appear
- **AND** replacement relation names SHALL distinguish realm, applied tag, target Unit, and application vote roles

#### Scenario: Service docs prevent local tag interpretation

- **WHEN** a developer inspects the create or query service for `RealmTagUnit`
- **THEN** source documentation SHALL state that realms apply existing global tags
- **AND** source documentation SHALL state that a realm cannot mint a realm-local tag through this relation
