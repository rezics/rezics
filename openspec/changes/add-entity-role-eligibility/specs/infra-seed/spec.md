## ADDED Requirements

### Requirement: Entity seed populates role eligibility

The seed system SHALL populate `eligibleCreditRoles` and `eligibleSubjectRoles` for seeded Entities using explicit role arrays derived from seed data or creation-time kind suggestions. The seed SHALL persist those arrays on Entity rows and SHALL NOT rely on backend read-time inference from `kind`.

#### Scenario: Person seed includes credit eligibility

- **WHEN** the seed creates a person Entity intended for creator credits
- **THEN** the Entity SHALL include relevant values in `eligibleCreditRoles`
- **AND** those values SHALL be persisted on the Entity row

#### Scenario: Character seed includes subject eligibility

- **WHEN** the seed creates a character Entity
- **THEN** the Entity SHALL include character subject roles in `eligibleSubjectRoles`
- **AND** it SHALL NOT include real-world credit roles such as `author` unless seed data explicitly marks the Entity eligible

### Requirement: Entity seed synchronizes Meili entity documents

When seed execution includes Meilisearch synchronization, the seed system SHALL synchronize seeded Entity documents into the `entities` index after Entity rows and translations are created. The synchronized documents SHALL include eligibility arrays.

#### Scenario: Seeded entity appears in EntityPicker search

- **WHEN** seeding completes with Meili synchronization enabled
- **AND** a seeded Entity has `eligibleCreditRoles = ["author"]`
- **THEN** an EntityPicker search for author-eligible Entities SHALL be able to return that Entity from Meilisearch
