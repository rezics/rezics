## ADDED Requirements

### Requirement: Work realm context links works to realms
The system SHALL provide a work realm context relationship that links a hidden work Unit to a realm Unit. Each context row SHALL include `workUnitId`, `realmUnitId`, `role`, `priority`, optional `locale`, optional `releaseUnitId` override, and audit timestamps. Supported roles SHALL include `official`, `community`, `language`, and `archive`.

#### Scenario: Work has official realm
- **GIVEN** hidden work Unit `work-fate` and realm Unit `realm-fate` exist
- **WHEN** an authorized actor creates a work realm context with `role = "official"`
- **THEN** the system SHALL persist the relationship from `work-fate` to `realm-fate`

#### Scenario: Non-realm target rejected
- **WHEN** a caller creates a work realm context whose `realmUnitId` references a non-REALM Unit
- **THEN** the system SHALL reject the write

### Requirement: Work realm context is distinct from realm official status
The system SHALL treat work realm context as a work-domain relationship. It SHALL NOT infer work official context solely from the realm's platform-level official flag, and it SHALL NOT require every work-context realm to be globally official.

#### Scenario: Community realm can be work context
- **GIVEN** realm `realm-fan` is public but not platform-official
- **WHEN** it is linked to `work-fate` with `role = "community"`
- **THEN** release wiki discovery MAY offer it as a community realm for that work
- **AND** the realm's platform official flag SHALL remain unchanged

### Requirement: Release wiki context resolves from UnitWork
Release detail wiki surfaces SHALL resolve default realm context by reading the release Unit's `UnitWork(role = RELEASE)` membership, resolving the canonical hidden work, and then selecting matching work realm context rows.

#### Scenario: Release resolves official wiki realm
- **GIVEN** release `release-fsn` has `UnitWork(release-fsn, work-fate, role = RELEASE)`
- **AND** `work-fate` has a work realm context `role = "official"` pointing at `realm-fate`
- **WHEN** a viewer opens the release wiki surface
- **THEN** the surface SHALL use `realm-fate` as the default official wiki realm

#### Scenario: Standalone release has no context
- **GIVEN** release `release-x` has no work-domain membership
- **WHEN** a viewer opens the release wiki surface
- **THEN** the system SHALL render a no-context state or a generic realm selection state

### Requirement: Work realm context selection is deterministic
When multiple context rows match the same work and role, the system SHALL sort by explicit priority, then locale match, then stable creation or id order. Conflicting equal-priority official contexts SHALL be reported to management surfaces.

#### Scenario: Multiple community realms sorted
- **GIVEN** work `work-fate` has three community realm contexts with priorities 10, 20, and 30
- **WHEN** the app lists community wiki realms for the work
- **THEN** the realms SHALL appear in deterministic priority order

### Requirement: Work realm context management is permissioned
Creating, updating, or deleting work realm context rows SHALL require an explicit management permission. In v1, public user flows SHALL NOT silently mark a realm as an official work realm.

#### Scenario: Ordinary user cannot set official realm
- **WHEN** an ordinary user attempts to set `realm-fate` as the official realm for `work-fate`
- **THEN** the server SHALL reject the request with a forbidden error
