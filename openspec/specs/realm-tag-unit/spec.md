## ADDED Requirements

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

Removing a RealmUnit record SHALL remove the unit from the realm's content feed. Removal of a RealmUnit SHALL NOT affect any UnitTag records that were contributed by the realm's RealmTagUnit entries -- those global tags are retained.

#### Scenario: Remove a unit from a realm

- GIVEN RealmUnit `(realmUnitId = "realm-1", unitId = "unit-1")`
- WHEN the RealmUnit record is deleted
- THEN "unit-1" SHALL no longer appear in "realm-1"'s content feed

#### Scenario: Removal does not affect global tags

- GIVEN RealmUnit `(realm-1, unit-1)` and RealmTagUnit entries that previously cascaded score to UnitTag
- WHEN the RealmUnit record is deleted
- THEN all UnitTag records for "unit-1" SHALL retain their current scores
- AND no UnitTag records SHALL be removed or decremented

### Requirement: RealmTagUnit creation MUST cascade to UnitTag

RealmTagUnit SHALL have a three-way composite primary key of `(realmUnitId, tagUnitId, unitId)`. When a RealmTagUnit record is created, the system MUST perform an upsert on UnitTag `(unitId, tagUnitId)` -- creating the record if it does not exist or incrementing its score if it does. This is a one-way additive cascade: realm classification feeds into the global tag score.

#### Scenario: First realm tags a unit with a new tag

- GIVEN Unit "unit-1" has no existing UnitTag for tag "tag-action"
- WHEN a moderator of "realm-1" creates RealmTagUnit `(realmUnitId = "realm-1", tagUnitId = "tag-action", unitId = "unit-1")`
- THEN a UnitTag record SHALL be upserted with `(unitId = "unit-1", tagUnitId = "tag-action")`
- AND the UnitTag `score` SHALL be incremented

#### Scenario: Second realm tags the same unit with the same tag

- GIVEN UnitTag `(unit-1, tag-action)` already exists with a score reflecting one realm contribution
- WHEN a moderator of "realm-2" creates RealmTagUnit `(realmUnitId = "realm-2", tagUnitId = "tag-action", unitId = "unit-1")`
- THEN the existing UnitTag record's `score` SHALL be further incremented
- AND no duplicate UnitTag record SHALL be created

### Requirement: RealmTagUnit removal MUST NOT cascade to UnitTag

When a RealmTagUnit record is removed, the system MUST NOT decrement, remove, or otherwise modify the corresponding UnitTag record. Global tag scores are accumulative -- once a realm contributes to a tag's score, that contribution persists even after the realm's classification is removed.

#### Scenario: Remove a realm tag without affecting global score

- GIVEN RealmTagUnit `(realm-1, tag-action, unit-1)` and UnitTag `(unit-1, tag-action)` with score 15
- WHEN the RealmTagUnit record is deleted
- THEN the UnitTag `(unit-1, tag-action)` record SHALL still exist
- AND the UnitTag `score` SHALL remain 15
- AND the UnitTag record SHALL NOT be deleted or modified

#### Scenario: All realm tags removed but global tag persists

- GIVEN UnitTag `(unit-1, tag-action)` that received contributions from "realm-1" and "realm-2"
- WHEN both RealmTagUnit records are deleted
- THEN the UnitTag `(unit-1, tag-action)` record SHALL still exist with its accumulated score intact

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

### Requirement: Only moderators and owners can manage RealmTagUnit

Creating or removing RealmTagUnit entries SHALL be restricted to users who hold moderator or owner roles within the realm. Regular users and unauthenticated users MUST NOT be able to create or delete RealmTagUnit records.

#### Scenario: Moderator creates a realm tag

- GIVEN user "mod-1" is a moderator of "realm-1"
- WHEN "mod-1" creates RealmTagUnit `(realm-1, tag-action, unit-1)`
- THEN the record SHALL be created successfully

#### Scenario: Owner creates a realm tag

- GIVEN user "owner-1" is the owner of "realm-1"
- WHEN "owner-1" creates RealmTagUnit `(realm-1, tag-drama, unit-1)`
- THEN the record SHALL be created successfully

#### Scenario: Regular user is denied

- GIVEN user "user-1" has no moderator or owner role in "realm-1"
- WHEN "user-1" attempts to create RealmTagUnit `(realm-1, tag-action, unit-1)`
- THEN the system SHALL deny the operation with an authorization error
- AND no RealmTagUnit record SHALL be created

#### Scenario: Unauthenticated user is denied

- WHEN an unauthenticated caller attempts to create a RealmTagUnit record
- THEN the system SHALL deny the operation with an authentication error

### Requirement: Realms as namespaces for tag classification

Different realms SHALL be able to classify the same content unit with different sets of tags from the shared global tag vocabulary. This provides namespace-like functionality (similar to e-hentai's tag namespaces) without introducing hierarchy or categories into the tag system itself. For example, a "female traits" realm and a "male traits" realm can both apply the tag "long hair" to the same unit independently.

#### Scenario: Same tag applied by different realms

- GIVEN tag "long-hair" exists as a global tag Unit
- AND "realm-female-traits" applies "long-hair" to "unit-1" via RealmTagUnit
- AND "realm-male-traits" applies "long-hair" to "unit-1" via RealmTagUnit
- WHEN querying RealmTagUnit for "unit-1"
- THEN both realm applications SHALL exist as separate records
- AND the UnitTag `(unit-1, long-hair)` score SHALL reflect contributions from both realms

#### Scenario: Different realms classify the same unit differently

- GIVEN "realm-genre" applies tags "action" and "sci-fi" to "unit-1"
- AND "realm-mood" applies tags "dark" and "intense" to "unit-1"
- WHEN querying tags by "realm-genre" for "unit-1"
- THEN only "action" and "sci-fi" SHALL be returned
- AND when querying tags by "realm-mood" for "unit-1", only "dark" and "intense" SHALL be returned
- AND the global UnitTag list for "unit-1" SHALL include all four tags
