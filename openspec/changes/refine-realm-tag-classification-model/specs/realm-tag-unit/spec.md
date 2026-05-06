## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Client coordinates simultaneous global and realm tag writes

**Reason**: The product semantics require a realm-scoped tag application to contribute to global tag discovery, but coordinating this through two frontend writes causes partial success, hides backend invariants in UI code, and makes retries ambiguous.

**Migration**: Replace client-coordinated double-write behavior with a server-owned standard write path. `POST /realm-tag-units` SHALL create or update the realm-scoped application and SHALL idempotently create or preserve the caller's global `TagVote(userId, unitId, tagUnitId, +1)`. Existing frontend helpers that issue both `POST /realm-tag-units` and `POST /unit-tags` SHALL be audited after the backend contract lands and changed to rely on the backend-owned operation.
