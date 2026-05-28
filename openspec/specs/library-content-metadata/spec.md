# library-content-metadata Specification

## Purpose

Defines derived USWN (Universal Standard Work Number) metadata on library content DTOs. `metadata.uswn` is a server-derived field equal to the merge-resolved canonical work Unit id, never stored as a column, and frontend surfaces render it directly rather than computing it client-side.
## Requirements
### Requirement: Library DTOs Expose Derived USWN Metadata

The system SHALL expose derived USWN metadata on library content DTOs. Library
content DTOs, including book DTOs and future release-aware library
content DTOs, SHALL expose `metadata.uswn` as a derived field. USWN stands for
Universal Standard Work Number. In this change, the value SHALL be the
merge-resolved canonical work Unit id. The field SHALL NOT be stored as a
database column or as a separate backend identity record.

When a Unit has no work domain, `metadata.uswn` SHALL be `null`.

#### Scenario: Release DTO exposes current canonical work id

- **GIVEN** release `release-a` belongs to work `work-x`
- **WHEN** a library content DTO for `release-a` is returned
- **THEN** `metadata.uswn` SHALL equal `work-x`

#### Scenario: Standalone DTO exposes null USWN

- **GIVEN** Unit `unit-y` has no active work domain
- **WHEN** a library content DTO for `unit-y` is returned
- **THEN** `metadata.uswn` SHALL be `null`

#### Scenario: Merged work resolves to target

- **GIVEN** release `release-a` previously belonged to source work `work-old`
- **AND** `work-old` has been merged into target work `work-new`
- **WHEN** a library content DTO for `release-a` is returned after canonical
  merge resolution
- **THEN** `metadata.uswn` SHALL equal `work-new`
- **AND** the frontend SHALL NOT need to resolve work merges client-side

### Requirement: USWN Is Rendered From Metadata

Frontend library surfaces that display the standard work identifier SHALL render
the value from `metadata.uswn`. They SHALL NOT compute USWN by inspecting release
membership, search grouping ids, or merge records client-side.

#### Scenario: Frontend renders server-derived USWN

- **WHEN** a book detail or metadata panel receives a DTO with
  `metadata.uswn = "work-x"`
- **THEN** the UI SHALL render `work-x` as the USWN value where the design calls
  for the standard work identifier
- **AND** if `metadata.uswn` is `null`, the UI SHALL render the corresponding
  empty/none state rather than inventing a fallback id

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

