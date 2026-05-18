## ADDED Requirements

### Requirement: Realm may define publishing license default
Realm metadata SHALL allow a realm to define an advisory default Unit publication license slug.

#### Scenario: Realm default is valid
- **WHEN** a realm stores a valid default license slug
- **THEN** composer flows in that realm MAY use it as their license prefill

#### Scenario: Realm default is invalid
- **WHEN** a realm update attempts to store an unknown default license slug
- **THEN** the server SHALL reject the update with a client error

### Requirement: Realm default overrides user default only as prefill
Realm publishing defaults SHALL override user publishing defaults only for initial composer state.

#### Scenario: User changes composer license
- **WHEN** a realm composer preloads the realm default license
- **AND** the user selects a different valid license before publishing
- **THEN** the created Unit SHALL store the user's selected license
