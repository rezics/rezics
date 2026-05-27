## ADDED Requirements

### Requirement: Work domain provides wiki realm context
Release-aware wiki discovery SHALL resolve work realm context through UnitWork. Visible release pages SHALL remain the entry point, while hidden work Units provide the context used to find official/community wiki realms.

#### Scenario: Release finds work wiki realm
- **GIVEN** release `release-a` belongs to hidden work `work-a` through UnitWork
- **AND** `work-a` has an official work realm context
- **WHEN** a viewer opens `release-a` wiki discovery
- **THEN** the release page SHALL use the official realm context from `work-a`

### Requirement: Work domain does not own wiki pages
UnitWork SHALL NOT make hidden work Units the owner of wiki pages. Wiki pages SHALL remain Units that may target precise subjects and belong to realms through UnitRealm. Work domain membership MAY be used for discovery, aggregation, and section queries.

#### Scenario: Wiki page remains realm/entity scoped
- **GIVEN** wiki Unit `wiki-artoria` belongs to realm `realm-fate` and describes Entity `entity-artoria`
- **WHEN** it appears on a release wiki surface through work context
- **THEN** the page SHALL remain associated with its realm and subject Entity
- **AND** the hidden work Unit SHALL only provide discovery context
