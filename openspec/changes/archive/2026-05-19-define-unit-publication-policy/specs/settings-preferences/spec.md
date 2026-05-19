## ADDED Requirements

### Requirement: User settings may store publishing license default
User settings SHALL allow an authenticated user to store a default Unit publication license slug.

#### Scenario: User saves default license
- **WHEN** a user updates settings with a valid default license slug
- **THEN** the settings API SHALL persist the value

#### Scenario: User saves invalid default license
- **WHEN** a user updates settings with an unknown default license slug
- **THEN** the settings API SHALL reject the update with a client error

### Requirement: Composer reads user publishing default
Composer flows SHALL use the user's publishing license default as a prefill when no stronger context default applies.

#### Scenario: User opens composer outside a realm
- **WHEN** a user with a default license opens a composer outside a realm-specific context
- **THEN** the composer SHALL prefill the user's default license
