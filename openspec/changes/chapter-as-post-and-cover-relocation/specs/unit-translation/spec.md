## ADDED Requirements

### Requirement: UnitTranslation.extra carries typed presentation-layer JSON

`UnitTranslation.extra` (Json, nullable) SHALL carry language-correlated presentation-layer metadata whose shape is governed by a contract-level schema, `unitTranslationExtraSchema`, exported from `@rezics/contract`. The schema SHALL start with `coverUrl` (optional string) as its only codified field and MAY be extended over time (e.g., `coverAlt`, `blurhash`, `dominantColor`) without Prisma schema migration. Server mappers, API consumers, and frontend code SHALL access these fields through the contract-typed accessor rather than reading `extra` as an untyped Json blob.

#### Scenario: Store a cover URL in translation extra

- GIVEN a Unit "unit-1" of type `BOOK` with a UnitTranslation for `language = "en"`
- WHEN a caller sets `translation.extra = { coverUrl: "https://example.com/cover.jpg" }`
- THEN the UnitTranslation record SHALL persist the JSON value with `coverUrl = "https://example.com/cover.jpg"`
- AND subsequent reads via the typed accessor SHALL return `coverUrl = "https://example.com/cover.jpg"`

#### Scenario: Language-divergent covers per translation

- GIVEN a Unit "unit-1" of type `BOOK` with UnitTranslation rows for `"en"` and `"ja"`
- WHEN the `"en"` translation is saved with `extra.coverUrl = "https://example.com/en.jpg"`
- AND the `"ja"` translation is saved with `extra.coverUrl = "https://example.com/ja.jpg"`
- THEN each translation SHALL return its own `coverUrl` independently
- AND a client requesting the Japanese view SHALL see the Japanese cover URL

#### Scenario: Missing coverUrl yields null on the typed accessor

- GIVEN a UnitTranslation whose `extra` field is null or omits `coverUrl`
- WHEN a caller reads the cover via the contract-typed accessor
- THEN the accessor SHALL return `undefined` / null for `coverUrl`
- AND the read SHALL NOT throw

#### Scenario: Extra fields outside the contract schema are tolerated

- GIVEN a UnitTranslation with `extra = { coverUrl: "...", unrecognizedField: 42 }`
- WHEN the record is read via the typed accessor
- THEN the accessor SHALL return the recognized `coverUrl` field
- AND unrecognized fields SHALL be ignored without error (forward-compatible JSON)

### Requirement: Resolution of cover URL follows the same translation fallback chain as title

When resolving a unit's cover URL for a requested language, the system SHALL reuse the existing translation resolution chain (direct match → unit default language → platform fallback `"en"` → first available translation) and read `coverUrl` from the `extra` field of the resolved translation. The system SHALL NOT maintain a separate fallback policy for cover specifically.

#### Scenario: Cover URL falls back to unit default language

- GIVEN a Unit "unit-1" with `defaultLanguage = "zh-hant"` and a UnitTranslation for `"zh-hant"` with `extra.coverUrl = "https://example.com/zh.jpg"`, and no translation for `"de"`
- WHEN a client requests the cover for language `"de"`
- THEN the system SHALL resolve the `"zh-hant"` translation via the default-language fallback
- AND return `coverUrl = "https://example.com/zh.jpg"`

#### Scenario: No translation has a cover URL

- GIVEN a Unit "unit-1" with UnitTranslation rows that all have `extra.coverUrl` unset
- WHEN a client requests the cover for any language
- THEN the system SHALL return null / undefined for the cover URL
- AND the unit SHALL remain valid (no cover is not an error state)
