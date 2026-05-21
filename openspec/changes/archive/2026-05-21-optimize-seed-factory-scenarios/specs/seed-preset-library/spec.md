## ADDED Requirements

### Requirement: Factory preset selection is one stage of a larger interactive flow
The interactive factory CLI SHALL keep preset selection backed by the preset registry, but preset selection SHALL be only the base data stage. The same interactive flow SHALL also collect Meili mode and special scenario selections before executing the factory seed.

#### Scenario: Preset menu still comes from registry
- **WHEN** the interactive factory flow asks for a base preset
- **THEN** it SHALL list presets from the preset registry
- **AND** the selected preset SHALL determine the base `SeedPlan` and mode

#### Scenario: Additional stages follow preset selection
- **WHEN** a user selects a base preset interactively
- **THEN** the flow SHALL continue to collect Meili mode and special scenario selections before seeding begins

### Requirement: Special scenarios are not presets
The factory system SHALL NOT require a special edge-case fixture to be modeled as a preset. Special scenarios SHALL compose with any compatible base preset.

#### Scenario: Scenario composes with fast preset
- **WHEN** a user selects the `fast` preset and the `complex-shelf` scenario
- **THEN** the factory flow SHALL run the `fast` base preset
- **AND** it SHALL run the `complex-shelf` scenario afterward
