## ADDED Requirements

### Requirement: Zone unit seeding

The seed system SHALL create Zone units (`Unit` with `type = ZONE` + `Zone` extension) with varied configurations. Each zone SHALL have multi-language translations (via `generateTranslations`), a `template` string, a `filters` JSON object, optional `styling` JSON, and optional temporal bounds (`startsAt`, `endsAt`).

#### Scenario: Zone templates cover all defined types

- **WHEN** the zone seed completes
- **THEN** the created zones SHALL include units with each of the following templates: `featured-carousel`, `trending-grid`, `seasonal-banner`, `topic-spotlight`, `new-releases`

#### Scenario: Zone filters reference existing content

- **WHEN** a zone is seeded with filters
- **THEN** the `filters` JSON SHALL reference valid content types (e.g., `{ "type": "BOOK" }`) or existing tag/work IDs from previously seeded data

### Requirement: Zone temporal state distribution

The zone seed SHALL produce zones across four temporal states to exercise time-based query logic:

- ~40% always-active: `startsAt = null`, `endsAt = null`
- ~30% currently-active: `startsAt` in the past, `endsAt` in the future
- ~20% scheduled: `startsAt` in the future, `endsAt` further in the future
- ~10% expired: `startsAt` in the past, `endsAt` in the past

#### Scenario: Always-active zones have no temporal bounds

- **WHEN** a zone is seeded as always-active
- **THEN** both `startsAt` and `endsAt` SHALL be `null`

#### Scenario: Currently-active zones span the present

- **WHEN** a zone is seeded as currently-active
- **THEN** `startsAt` SHALL be before the current timestamp
- **AND** `endsAt` SHALL be after the current timestamp

#### Scenario: Expired zones have past end dates

- **WHEN** a zone is seeded as expired
- **THEN** `endsAt` SHALL be before the current timestamp

### Requirement: Zone styling variety

The zone seed SHALL populate the optional `styling` JSON field on approximately 60% of zones. Styling SHALL include theme-related properties such as color schemes, layout variants, or background image URLs.

#### Scenario: Zone with styling

- **WHEN** a zone is seeded with styling
- **THEN** the `styling` JSON SHALL contain at least one property (e.g., `backgroundColor`, `layout`, `backgroundImageUrl`)

#### Scenario: Zone without styling

- **WHEN** a zone is seeded without styling
- **THEN** the `styling` field SHALL be `null`

### Requirement: Zone scale

The seed system SHALL create approximately 30–50 zones by default, configurable via `SEED_ZONES` environment variable.

#### Scenario: Default zone count

- **WHEN** the seed runs without `SEED_ZONES` env var
- **THEN** approximately 40 zones SHALL be created

#### Scenario: Custom zone count via env

- **WHEN** the seed runs with `SEED_ZONES=20`
- **THEN** approximately 20 zones SHALL be created
