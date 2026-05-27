## ADDED Requirements

### Requirement: GAME and MEDIA library DTOs expose typed metadata

Library content DTOs for GAME and MEDIA releases SHALL expose typed metadata
from the appropriate backend systems. GAME metadata SHALL include release
metadata, platform Entity ids, external rating tag ids, system-requirement
summary data, and derived `metadata.uswn` when the release belongs to a work
domain. MEDIA metadata SHALL include kind key, release metadata, runtime
summary, external rating tag ids, content-structure availability, and derived
`metadata.uswn` when applicable.

#### Scenario: Game DTO exposes derived work id

- **GIVEN** a GAME release belongs to hidden work `work-game-1`
- **WHEN** the server returns a library DTO for that release
- **THEN** `metadata.uswn` SHALL equal `work-game-1`
- **AND** platform values SHALL be exposed as Entity ids and age-rating values as rating tag ids

#### Scenario: Media DTO exposes kind and content structure availability

- **WHEN** the server returns a MEDIA library DTO
- **THEN** the DTO SHALL expose the media `kindKey`
- **AND** it SHALL indicate content-structure availability when the release has modeled parts

### Requirement: Library DTOs do not expose legacy platform or age-rating keys

New GAME and MEDIA library DTO fields SHALL use Entity-backed platform
identifiers and external rating tag identifiers. DTOs SHALL NOT expose
`GamePlatform.platformKey` or `Game.ageRatingKey` as canonical metadata.

#### Scenario: Game platform metadata uses Entity ids

- **WHEN** a GAME DTO includes supported platforms
- **THEN** the values SHALL identify platform Entities
- **AND** clients SHALL resolve labels through normal Unit translation fallback

#### Scenario: Age rating metadata uses rating tags

- **WHEN** a GAME or MEDIA DTO includes age ratings
- **THEN** the values SHALL identify external rating tags
- **AND** no canonical `ageRatingKey` field SHALL be required by clients
