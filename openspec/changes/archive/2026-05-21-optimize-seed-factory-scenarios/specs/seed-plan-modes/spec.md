## ADDED Requirements

### Requirement: SeedPlan remains the broad population model
The seed system SHALL keep `SeedPlan` focused on broad population counts and distribution choices. Named edge-case fixture topology SHALL be modeled as special factory scenario configuration rather than as new `SeedPlan` count fields.

#### Scenario: Edge-case topology is outside SeedPlan
- **WHEN** a special fixture needs domain-specific topology such as a large post tree, large history timeline, or complex shelf relation graph
- **THEN** that topology SHALL be configured by the scenario
- **AND** it SHALL NOT require adding scenario-specific count fields to `SeedPlan`

#### Scenario: Base plan validation remains compatible
- **WHEN** an existing plan file validates against `SeedPlanSchema`
- **THEN** it SHALL remain valid without requiring special scenario fields
