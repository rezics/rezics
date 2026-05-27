## MODIFIED Requirements

### Requirement: sourceReleaseUnitId links work translations to their source release

The system SHALL replace the `sourceReleaseUnitId` field on UnitTranslation with
`sourceUnitId`. The `sourceUnitId` field is optional and SHALL identify the
Unit that supplied or justified a translation's display/content source when
such provenance is needed. It SHALL NOT own release selection, language
switching, or same-work release navigation.

Existing `sourceReleaseUnitId` data SHALL be migrated to `sourceUnitId` without
changing the referenced Unit ids.

#### Scenario: Work translation with sourceUnitId

- GIVEN a hidden work Unit "work-1" with a release Unit "release-en" providing English display/content source data
- WHEN the UnitTranslation for `(unitId = "work-1", language = "en")` is created with `sourceUnitId = "release-en"`
- THEN a client reading the work's English translation can follow `sourceUnitId` to inspect the source Unit when needed
- AND the field SHALL NOT imply that "release-en" is the navigation target for English release selection

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

### Requirement: Translation Records Do Not Select Releases

`UnitTranslation` records SHALL store language-specific display text and
optional provenance only. They SHALL NOT select another release for language
switching, same-work release discovery, or work-domain feed presentation.

#### Scenario: Language switch ignores translation sourceUnitId

- **GIVEN** a work translation has `sourceUnitId = release-a`
- **AND** same-work release `release-b` also supports the same language
- **WHEN** the user opens the current release's language switcher
- **THEN** the switcher SHALL consider only the current release's own
  `UnitTranslation` rows
- **AND** it SHALL NOT treat `sourceUnitId = release-a` as a release selection
  default
