## MODIFIED Requirements

### Requirement: Translation resolution falls back through a defined chain

When resolving display text for a Unit, the system SHALL attempt lookup in this order: (1) direct match on `(unitId, requestedLanguage)`, (2) fallback to `(unitId, unit.defaultLanguage)`, (3) fallback to `(unitId, 'en')` (platform fallback language), (4) first available translation. The first match found SHALL be returned. If no translation exists at any level, the system SHALL return null or empty text fields.

#### Scenario: Direct language match

- GIVEN a Unit with `id = "unit-1"` and UnitTranslation records for `"zh-hant"` and `"en"`
- WHEN the client requests the translation for language `"zh-hant"`
- THEN the system SHALL return the `"zh-hant"` UnitTranslation

#### Scenario: Fallback to unit default language

- GIVEN a Unit with `id = "unit-1"`, `defaultLanguage = "zh-hant"`, and UnitTranslation records for `"zh-hant"` only
- WHEN the client requests the translation for language `"de"`
- THEN the system SHALL return the `"zh-hant"` UnitTranslation as the unit default fallback

#### Scenario: Fallback to platform fallback language

- GIVEN a Unit with `id = "unit-1"`, `defaultLanguage = "ja"`, and UnitTranslation records for `"en"` only (no `"ja"` translation)
- WHEN the client requests the translation for language `"de"`
- THEN the system SHALL skip the unit default `"ja"` (not found), fall back to platform fallback `"en"`, and return the `"en"` UnitTranslation

#### Scenario: Fallback to first available translation

- GIVEN a Unit with `id = "unit-1"`, `defaultLanguage = "ja"`, and a UnitTranslation record for `"zh-hans"` only
- WHEN the client requests the translation for language `"de"`
- THEN the system SHALL skip the unit default `"ja"` (not found), skip `"en"` (not found), and return the `"zh-hans"` UnitTranslation as the first available

#### Scenario: No translation exists at any level

- GIVEN a Unit with `id = "unit-1"` and no UnitTranslation records
- WHEN the client requests the translation for any language
- THEN the system SHALL return null or empty text fields

#### Scenario: No cross-script Chinese fallback

- GIVEN a Unit with `id = "unit-1"` and UnitTranslation records for `"zh-hans"` and `"en"`
- WHEN the client requests the translation for language `"zh-hant"`
- THEN the system SHALL NOT automatically try `"zh-hans"` as a script-affinity fallback
- AND the system SHALL fall back to the unit default, then `"en"`, then first available

## ADDED Requirements

### Requirement: Language fields in translation DTOs use canonical codes

All `language` fields in `unitTranslationDTOSchema`, `unitSupportLanguageDTOSchema`, `createTranslationSchema`, and `translationParamsSchema` SHALL be validated against `languageSchema` (the canonical 5-code union). Non-canonical codes SHALL be rejected.

#### Scenario: Create translation with canonical code

- WHEN a client sends a `createTranslation` request with `language: "zh-hant"`
- THEN the request SHALL pass validation and the translation SHALL be persisted

#### Scenario: Create translation with legacy code rejected

- WHEN a client sends a `createTranslation` request with `language: "zh-CN"`
- THEN the request SHALL fail validation with a type error

#### Scenario: Translation route parameter validated

- WHEN a client requests `GET /units/:unitId/translations/zh-hant`
- THEN the `:language` parameter SHALL pass validation
- AND when a client requests `GET /units/:unitId/translations/zh-SC`
- THEN the `:language` parameter SHALL fail validation

### Requirement: Default language field uses canonical codes

The `defaultLanguage` field in `createUnitSchema`, `updateUnitSchema`, and `baseUnitSchema` SHALL be validated against `languageSchema`. Units SHALL only be created or updated with canonical language codes as their default language.

#### Scenario: Create unit with canonical default language

- WHEN a client creates a unit with `defaultLanguage: "zh-hant"`
- THEN the request SHALL pass validation

#### Scenario: Create unit with legacy default language rejected

- WHEN a client creates a unit with `defaultLanguage: "zh-CN"`
- THEN the request SHALL fail validation

### Requirement: Language query filter uses canonical codes

The `language` field in `unitListQuerySchema` SHALL be validated against `languageSchema`. List queries filtered by language SHALL only accept canonical codes.

#### Scenario: Filter units by canonical language

- WHEN a client queries `GET /units?language=zh-hant`
- THEN the filter SHALL apply correctly and return units with `zh-hant` translations

#### Scenario: Filter units by legacy language rejected

- WHEN a client queries `GET /units?language=zh-CN`
- THEN the query SHALL fail validation
