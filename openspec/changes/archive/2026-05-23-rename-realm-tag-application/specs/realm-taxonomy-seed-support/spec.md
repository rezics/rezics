## ADDED Requirements

### Requirement: Seed helpers use RealmTagApplication vocabulary
Seed helpers and seed data SHALL use `RealmTagApplication` and `RealmTagApplicationVote` names when creating realm-scoped tag classifications and their votes. Seed behavior SHALL remain equivalent to the previous model: application creation also preserves or creates the corresponding global `TagVote` and `UnitTag` aggregate where the standard helper path requires it.

#### Scenario: Seeded realm tag application creates consistent rows
- **GIVEN** a seed helper creates a realm-scoped tag application for `(realm-1, tag-1, unit-1)`
- **WHEN** the seed completes
- **THEN** a `RealmTagApplication(realm-1, tag-1, unit-1)` row SHALL exist
- **AND** the creator's `RealmTagApplicationVote` SHALL exist at most once
- **AND** the expected global `UnitTag(unit-1, tag-1)` state SHALL be consistent with the standard seed path
