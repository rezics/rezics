## ADDED Requirements

### Requirement: UnitTranslation stores language-specific display text per unit

A UnitTranslation record SHALL be identified by the composite key `(unitId, language)`. Each record MAY contain `title`, `subtitle`, `summary`, `description`, and `extra` (Json) fields. A Unit MAY have zero or more UnitTranslation records, one per language.

#### Scenario: Create a translation for a unit

- GIVEN a Unit with `id = "unit-1"` and `defaultLanguage = "en"`
- WHEN a UnitTranslation is created with `unitId = "unit-1"`, `language = "en"`, `title = "My Book"`, `summary = "A great book"`
- THEN the record SHALL be persisted with the composite key `("unit-1", "en")`
- AND subsequent queries for `(unitId = "unit-1", language = "en")` SHALL return the translation

#### Scenario: Multiple translations for the same unit

- GIVEN a Unit with `id = "unit-1"`
- WHEN UnitTranslation records are created for `language = "en"` and `language = "ja"`
- THEN both records SHALL coexist
- AND each SHALL be independently retrievable by its composite key

#### Scenario: Reject duplicate translation for the same unit and language

- GIVEN a UnitTranslation already exists for `(unitId = "unit-1", language = "en")`
- WHEN a caller attempts to insert another record with `(unitId = "unit-1", language = "en")`
- THEN the system SHALL reject the insertion with a unique constraint violation

### Requirement: Translation resolution falls back through a defined chain

When resolving display text for a Unit, the system SHALL attempt lookup in this order: (1) direct match on `(unitId, requestedLanguage)`, (2) fallback to `(unitId, unit.defaultLanguage)`, (3) fallback to `(unitId, platformDefaultLanguage)`. The first match found SHALL be returned. If no translation exists at any level, the system SHALL return null or empty text fields.

#### Scenario: Direct language match

- GIVEN a Unit with `id = "unit-1"` and UnitTranslation records for "en" and "ja"
- WHEN the client requests the translation for language "ja"
- THEN the system SHALL return the "ja" UnitTranslation

#### Scenario: Fallback to unit default language

- GIVEN a Unit with `id = "unit-1"`, `defaultLanguage = "en"`, and UnitTranslation records for "en" only
- WHEN the client requests the translation for language "de"
- THEN the system SHALL return the "en" UnitTranslation as the fallback

#### Scenario: Fallback to platform default language

- GIVEN a Unit with `id = "unit-1"`, `defaultLanguage = "ja"`, and a UnitTranslation record for "en" only (no "ja" translation)
- AND the platform default language is "en"
- WHEN the client requests the translation for language "de"
- THEN the system SHALL skip the unit default "ja" (not found), fall back to platform default "en", and return the "en" UnitTranslation

#### Scenario: No translation exists at any level

- GIVEN a Unit with `id = "unit-1"` and no UnitTranslation records
- WHEN the client requests the translation for any language
- THEN the system SHALL return null or empty text fields

### Requirement: sourceReleaseUnitId links work translations to their source release

The `sourceReleaseUnitId` field on UnitTranslation is optional and SHALL only be meaningful for work unit translations. When set, it indicates which release unit provides the content for that language, enabling navigation from a work's translation to the release that supplies it.

#### Scenario: Work translation with sourceReleaseUnitId

- GIVEN a work Unit "work-1" with a release Unit "release-en" providing English content
- WHEN the UnitTranslation for `(unitId = "work-1", language = "en")` is created with `sourceReleaseUnitId = "release-en"`
- THEN a client reading the work's English translation can follow `sourceReleaseUnitId` to navigate to the release unit "release-en"

#### Scenario: Release unit translation has no sourceReleaseUnitId

- GIVEN a release Unit "release-en"
- WHEN inspecting its UnitTranslation records
- THEN `sourceReleaseUnitId` SHALL be null because releases are themselves the content source

#### Scenario: Standalone unit has no sourceReleaseUnitId

- GIVEN a standalone Unit (neither work nor release) of type `POST`
- WHEN inspecting its UnitTranslation records
- THEN `sourceReleaseUnitId` SHALL be null

### Requirement: UnitSupportLanguage tracks actual content availability

UnitSupportLanguage records, identified by composite key `(unitId, language)`, indicate which languages a unit's content actually supports. Each record has `isPrimary` (boolean) and `sortOrder` (integer) fields. This is distinct from having a UnitTranslation: a unit may have a translation label in many languages but only support content in a subset.

#### Scenario: Release unit declares supported languages

- GIVEN a release Unit "release-1" that contains content in English and Japanese
- WHEN UnitSupportLanguage records are created for `("release-1", "en", isPrimary = true, sortOrder = 0)` and `("release-1", "ja", isPrimary = false, sortOrder = 1)`
- THEN queries for supported languages of "release-1" SHALL return "en" and "ja"
- AND "en" SHALL be identified as the primary language

#### Scenario: One primary language per unit

- GIVEN a Unit with UnitSupportLanguage entries for "en", "ja", and "ko"
- WHEN `isPrimary = true` is set for "en"
- THEN exactly one UnitSupportLanguage record for that Unit SHALL have `isPrimary = true`

### Requirement: For release units, UnitSupportLanguage is the source of truth for content language availability

When determining which languages a release unit's content is available in, the system SHALL query UnitSupportLanguage records for that release. UnitTranslation records alone do not imply content availability for releases.

#### Scenario: Release with translations but limited content support

- GIVEN a release Unit "release-1" with UnitTranslation records for "en", "ja", and "de"
- AND UnitSupportLanguage records only for "en" and "ja"
- WHEN the system queries which languages "release-1" has content in
- THEN the result SHALL be "en" and "ja" only
- AND "de" SHALL NOT be listed as a supported content language despite having a translation

#### Scenario: Filter releases by language availability

- GIVEN release Units "release-en" (supports "en") and "release-ja" (supports "ja")
- WHEN a client queries for releases with content in "en"
- THEN the result SHALL include "release-en" and exclude "release-ja"

### Requirement: Language-neutral units match all language filters

Units with `isLanguageNeutral = true` (such as tags) SHALL match any language filter query without requiring UnitSupportLanguage rows. These units are considered universally applicable regardless of language context.

#### Scenario: Language-neutral tag matches any language filter

- GIVEN a Unit of type `TAG` with `isLanguageNeutral = true` and no UnitSupportLanguage records
- WHEN a client queries for units filtered by language "ja"
- THEN the tag Unit SHALL be included in the results

#### Scenario: Language-neutral unit requires no UnitSupportLanguage rows

- GIVEN a Unit with `isLanguageNeutral = true`
- WHEN the system checks content language availability
- THEN it SHALL NOT require UnitSupportLanguage records for this unit
- AND the unit SHALL be treated as available in all languages
