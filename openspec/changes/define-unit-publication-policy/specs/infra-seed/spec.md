## ADDED Requirements

### Requirement: Seeded publishable units carry publication defaults
The seed system SHALL write the platform default publication license slug onto seeded publishable Unit rows instead of relying on nullable fallback behavior.

#### Scenario: Factory seed creates publishable content
- **WHEN** the factory seed creates a `BOOK`, `GAME`, `MEDIA`, `POST`, or `SHELF` Unit
- **THEN** the Unit SHALL store `licenseSlug = "all-rights-reserved"`

#### Scenario: Seeded publishing defaults are available for composer flows
- **WHEN** infra and user seeds create default demo records
- **THEN** at least one seeded user and the default official realm SHALL expose a valid publishing default license slug
