## MODIFIED Requirements

### Requirement: sourceReleaseUnitId links work translations to their source release

The system SHALL replace the `sourceReleaseUnitId` field on UnitTranslation with
`sourceUnitId`. The `sourceUnitId` field is optional and SHALL identify the
Unit that supplied or justified a translation's display/content source when
such provenance is needed. It SHALL NOT own work-language default release
selection; primary release selection for a work and language SHALL be stored in
the `UnitWorkLanguageDefault` model.

Existing `sourceReleaseUnitId` data SHALL be migrated to `sourceUnitId` without
changing the referenced Unit ids.

#### Scenario: Work translation with sourceUnitId

- GIVEN a hidden work Unit "work-1" with a release Unit "release-en" providing English display/content source data
- WHEN the UnitTranslation for `(unitId = "work-1", language = "en")` is created with `sourceUnitId = "release-en"`
- THEN a client reading the work's English translation can follow `sourceUnitId` to inspect the source Unit when needed
- AND the primary English release for user navigation SHALL still be resolved through `UnitWorkLanguageDefault`

#### Scenario: Release unit translation has no sourceUnitId by default

- GIVEN a release Unit "release-en"
- WHEN inspecting its UnitTranslation records
- THEN `sourceUnitId` SHALL be null by default because releases are themselves the display/content source

#### Scenario: Standalone unit has no sourceUnitId

- GIVEN a standalone Unit (neither hidden work nor release member) of type `POST`
- WHEN inspecting its UnitTranslation records
- THEN `sourceUnitId` SHALL be null unless explicit provenance is recorded by a feature-specific rule

#### Scenario: Existing sourceReleaseUnitId data is migrated

- GIVEN an existing UnitTranslation row with `sourceReleaseUnitId = "release-ja"`
- WHEN the migration runs
- THEN the resulting row SHALL expose `sourceUnitId = "release-ja"`
- AND `sourceReleaseUnitId` SHALL no longer be part of the contract DTO

## ADDED Requirements

### Requirement: Translation Records Do Not Select Language Default Releases

`UnitTranslation` records SHALL store language-specific display text and
optional provenance only. They SHALL NOT be used as the canonical source of the
primary release for a work/language pair.

#### Scenario: Language switch ignores translation sourceUnitId

- **GIVEN** a work translation has `sourceUnitId = release-a`
- **AND** `UnitWorkLanguageDefault(work-x, ja) = release-b`
- **WHEN** the user switches to Japanese on a release in `work-x`
- **THEN** the system SHALL navigate or select `release-b`
- **AND** it SHALL NOT treat `sourceUnitId = release-a` as the language-switch default
