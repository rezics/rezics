# realm-taxonomy-seed-support Specification

## Purpose

Defines the seed-data invariants that demonstrate the realm-tag model:
realms are seeded as community spaces (not classifiers) with
membership, posting/joining rules, pinboard data, and
`extra.tagTree` quick-pick references that always resolve to existing
global TAG Units. Shared global tags appear across multiple realms
with per-realm `RealmTagContext` interpretations rather than
duplicated tag identities; `RealmTagApplication` rows are seeded both
inside and outside realm feeds to keep them independent from
`RealmUnit`; standard-helper seed paths preserve consistent global
`TagVote` / `UnitTag` aggregates and remain idempotent across reseed.
Seed helpers use the `RealmTagApplication` / `RealmTagApplicationVote`
vocabulary.

## Requirements

### Requirement: Seed data demonstrates realm community semantics

The seed system SHALL include development data where a realm is visibly modeled as a community space rather than a classifier. At least one seeded realm SHALL include community-facing configuration such as title/description translations, membership, posting or joining constraints where supported, pinboard/rules/about data, and `extra.tagTree` quick-pick tags.

#### Scenario: Seeded realm has community metadata

- **WHEN** the development seed is applied
- **THEN** at least one realm SHALL exist as a `Unit(type = REALM)` with a Realm extension row
- **AND** the realm SHALL include community metadata beyond tag classification data
- **AND** the realm SHALL be usable as a feed/community target through `RealmUnit`

#### Scenario: Seeded tag tree does not create local tags

- **GIVEN** a seeded realm has `extra.tagTree` entries
- **WHEN** the seed completes
- **THEN** every tag referenced by `extra.tagTree` SHALL exist as a global `Unit(type = TAG)`
- **AND** no realm-local tag identity SHALL be created

### Requirement: Seed data demonstrates shared global tags with realm-specific interpretation

The seed system SHALL create global tag Units that are reused by multiple realms, and SHALL demonstrate that the same tag can have different realm-specific meanings through `RealmTagContext` and `RealmTagApplication` data.

#### Scenario: Same global tag appears in multiple realm contexts

- **WHEN** the development seed is applied
- **THEN** at least one global tag Unit SHALL be referenced by two or more realm-tag contexts or realm-tag applications
- **AND** each reference SHALL use the same `tagUnitId`
- **AND** the seed data SHALL NOT create duplicate tags to simulate different realm meanings

#### Scenario: Realm-specific context explains a shared tag

- **GIVEN** a shared global tag is used by `realm-A` and `realm-B`
- **WHEN** the seeded context data is inspected
- **THEN** at least one realm SHALL have a `RealmTagContext` row explaining that realm's interpretation of the tag
- **AND** the context SHALL be connected through `(realmUnitId, tagUnitId)`, not through a new tag Unit

### Requirement: Seed data covers realm-tag applications inside and outside realm feeds

The seed system SHALL include `RealmTagApplication` examples for target Units that are also present in a realm feed through `RealmUnit`, and examples for target Units that are not present in that realm feed. This protects the invariant that `RealmTagApplication` is independent from `RealmUnit`.

#### Scenario: Realm tag application for feed member

- **WHEN** the seeded data is inspected
- **THEN** at least one target Unit SHALL have both `RealmUnit(realmUnitId, unitId)` and `RealmTagApplication(realmUnitId, tagUnitId, unitId)` rows for the same realm

#### Scenario: Realm tag application for non-feed target

- **WHEN** the seeded data is inspected
- **THEN** at least one target Unit SHALL have a `RealmTagApplication(realmUnitId, tagUnitId, unitId)` row
- **AND** the same `(realmUnitId, unitId)` pair SHALL NOT require a `RealmUnit` row

### Requirement: Seed data preserves global vote contribution semantics

Seed helpers that create realm-scoped tag applications through the standard backend path SHALL also create or preserve the corresponding global `TagVote` and aggregate `UnitTag` state. Seed helpers that intentionally bypass services for bulk setup SHALL explicitly create consistent `RealmTagApplicationVote`, `RealmTagApplication`, `TagVote`, and `UnitTag` rows.

#### Scenario: Seeded realm application contributes to global tag aggregate

- **GIVEN** a seeded `RealmTagApplication(realm-1, tag-1, unit-1)` was created through the standard helper
- **WHEN** the seeded database is inspected
- **THEN** a global `UnitTag(unit-1, tag-1)` aggregate SHALL exist
- **AND** the creator's global `TagVote(userId, unitId, tagUnitId)` SHALL exist at most once

#### Scenario: Re-running seed is idempotent

- **WHEN** the seed is applied repeatedly in a reset-capable development environment
- **THEN** seeded realm-tag contexts, realm-tag applications, and vote aggregates SHALL remain deterministic
- **AND** duplicate composite-key rows SHALL NOT be created

### Requirement: Seed helpers use RealmTagApplication vocabulary

Seed helpers and seed data SHALL use `RealmTagApplication` and `RealmTagApplicationVote` names when creating realm-scoped tag classifications and their votes. Seed behavior SHALL remain equivalent to the previous model: application creation also preserves or creates the corresponding global `TagVote` and `UnitTag` aggregate where the standard helper path requires it.

#### Scenario: Seeded realm tag application creates consistent rows

- **GIVEN** a seed helper creates a realm-scoped tag application for `(realm-1, tag-1, unit-1)`
- **WHEN** the seed completes
- **THEN** a `RealmTagApplication(realm-1, tag-1, unit-1)` row SHALL exist
- **AND** the creator's `RealmTagApplicationVote` SHALL exist at most once
- **AND** the expected global `UnitTag(unit-1, tag-1)` state SHALL be consistent with the standard seed path
