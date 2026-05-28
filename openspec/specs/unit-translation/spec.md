# unit-translation Specification

## Purpose

Defines per-language UnitTranslation display text, extra metadata, uniqueness,
fallback behavior, and translation provenance for Unit-backed content.

## Requirements

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

### Requirement: UnitSupportLanguage tracks actual content availability

UnitSupportLanguage records SHALL indicate which languages a unit's content
actually supports and SHALL be identified by composite key `(unitId, language)`.
Each record has `isPrimary` (boolean) and `sortOrder` (integer) fields. This is
distinct from having a UnitTranslation: a unit may have a translation label in
many languages but only support content in a subset.

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

### Requirement: Language fields in translation DTOs use canonical codes

All `language` fields in `unitTranslationDTOSchema`, `unitSupportLanguageDTOSchema`, `createTranslationSchema`, and `translationParamsSchema` SHALL be validated against `languageSchema` (the canonical 6-code union). Non-canonical codes SHALL be rejected.

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

### Requirement: UnitTranslation.sourceReleaseUnitId points to the canonical release for a language

For a Unit that participates in the work/release pattern as a work, each `UnitTranslation` row MAY carry a `sourceReleaseUnitId` referencing one of the work's release Units. This pointer SHALL identify the canonical release whose body content represents the work in that language. The pointer is curatorial: setting or changing it does not move or copy any content; it only changes which release the system considers canonical for that language.

#### Scenario: Set sourceReleaseUnitId on a work's translation

- GIVEN a Work Unit "work-x" with releases "rel-zh" and "rel-zh-revised", both with `defaultLanguage = "zh-hant"`
- AND a `UnitTranslation` exists for `(unitId = "work-x", language = "zh-hant")`
- WHEN the caller invokes `PATCH /units/work-x/translations/zh-hant/source` with body `{ sourceReleaseUnitId: "rel-zh-revised" }`
- THEN the `UnitTranslation` row's `sourceReleaseUnitId` SHALL be updated to `"rel-zh-revised"`
- AND no `Post.body` or other content field SHALL be modified

#### Scenario: Reading the canonical release for a language

- GIVEN a Work Unit "work-x" with `UnitTranslation` for `("work-x", "en")` whose `sourceReleaseUnitId = "rel-en"`
- WHEN a reader requests the work's content in `"en"`
- THEN the system SHALL resolve to the body of release "rel-en"

### Requirement: UnitTranslation cache fields MAY drift from sourceRelease.body

The `title`, `subtitle`, `summary`, and `description` fields of a `UnitTranslation` row SHALL be writable independently of the body of the unit identified by `sourceReleaseUnitId`. The system SHALL NOT auto-recompute these fields when the source release's body changes. Drift between the cached fields and the source body is a permitted state; reconciliation, when desired, is performed by an explicit client action.

#### Scenario: Edit cached title without touching release body

- GIVEN a Work Unit's `UnitTranslation` for `("work-x", "en")` with `title = "Old"` and `sourceReleaseUnitId = "rel-en"`
- AND release "rel-en" has body `Post.body` whose first line is "Old"
- WHEN the caller invokes the standard UnitTranslation update with body `{ title: "New" }`
- THEN the `UnitTranslation.title` SHALL be `"New"`
- AND `Post.body` of "rel-en" SHALL remain unchanged
- AND no validation error SHALL be raised for divergence

#### Scenario: Source release body changes do not propagate to cache

- GIVEN a Work Unit's `UnitTranslation` for `("work-x", "en")` with cached `title = "Old"` and `sourceReleaseUnitId = "rel-en"`
- WHEN the body of "rel-en" is updated
- THEN the `UnitTranslation` row SHALL remain unchanged
- AND retrieval of `("work-x", "en")` SHALL still return `title = "Old"`

### Requirement: PATCH /units/:workId/translations/:lang/source endpoint sets sourceReleaseUnitId

The unit API SHALL expose `PATCH /units/:workId/translations/:lang/source` accepting `{ sourceReleaseUnitId: string | null }`. The endpoint SHALL validate that:

- `:workId` references a Unit with `workUnitId = null` (a work, not a release).
- `sourceReleaseUnitId`, when non-null, references a Unit whose `workUnitId === :workId`.
- The caller has authority over the work via `hasAuthorityOver`.

If validation passes, the system SHALL upsert the `UnitTranslation` row for `(:workId, :lang)` with the new `sourceReleaseUnitId`, leaving any other fields untouched. If the row does not exist, it is created with only `sourceReleaseUnitId` set.

#### Scenario: Source release does not belong to the work

- GIVEN a Work Unit "work-x"
- AND a release "rel-foreign" with `workUnitId = "work-other"` (different work)
- WHEN the caller invokes `PATCH /units/work-x/translations/en/source` with body `{ sourceReleaseUnitId: "rel-foreign" }`
- THEN the request SHALL be rejected with a `400` validation error
- AND no `UnitTranslation` row SHALL be created or modified

#### Scenario: Caller lacks authority over the work

- GIVEN a Work Unit "work-x" owned by user A, with no realm-mod or admin involvement
- WHEN user B invokes `PATCH /units/work-x/translations/en/source` with body `{ sourceReleaseUnitId: "rel-en" }`
- THEN the request SHALL be rejected with `403 Forbidden`

### Requirement: Metadata translation editors use Select for language selection

Frontend editing surfaces that mutate UnitTranslation metadata SHALL render the
current translation language with a Select control. Chip, badge, tab, or
segmented-control language choices SHALL NOT be used for in-place mutation of
the selected UnitTranslation language.

This requirement applies to unit-backed metadata editors such as book, realm,
entity, and future game-like catalog units. It SHALL NOT apply to chapter,
review, excerpt, or post body translation workflows, which use different domain
semantics.

#### Scenario: Editor switches metadata language

- **GIVEN** an entity, realm, or book has UnitTranslation rows for `["en", "ja"]`
- **WHEN** the user opens its metadata editor
- **THEN** the selected UnitTranslation language SHALL render through Select
- **AND** choosing another Select item SHALL change the active translation row
  being edited

#### Scenario: Chip language choices are not used for mutation

- **WHEN** an editor changes the active UnitTranslation language in-place
- **THEN** the control SHALL NOT render language choices as chips, badges, tabs,
  or segmented buttons

### Requirement: Metadata translation editors expose add-language as a separate action

Frontend metadata translation editors SHALL expose adding a new UnitTranslation
language as a distinct action next to the selected-language Select. The add
action MAY open a domain-specific dialog when creating the translation requires
additional fields.

#### Scenario: Add language from metadata editor

- **GIVEN** a realm has only an English UnitTranslation
- **WHEN** the editor opens the add-language action
- **THEN** the user SHALL be able to choose a missing supported language
- **AND** creation SHALL target a new UnitTranslation row for that language

#### Scenario: Domain-specific add fields remain outside the language control

- **GIVEN** a book work translation can optionally choose a source release
- **WHEN** the user adds a book translation language
- **THEN** the source-release picker MAY be rendered in the book-specific add
  dialog
- **AND** the shared language control SHALL NOT own source-release mutation
  behavior

### Requirement: UnitTranslation remains primary display text when aliases exist
UnitTranslation SHALL remain the authoritative language-specific display text for a Unit. UnitAlias rows SHALL be supplemental search metadata and SHALL NOT replace translation resolution, translation fallback, or display title selection.

#### Scenario: Alias match displays translation title
- **GIVEN** Unit `unit-1` has `UnitTranslation(en).title = "The Three-Body Problem"`
- **AND** UnitAlias value `"3 Body Problem"` exists for `unit-1`
- **WHEN** a search query matches `unit-1` through the alias
- **THEN** the search result display title SHALL still be resolved from UnitTranslation
- **AND** the alias SHALL NOT replace the title unless a UI explicitly renders matched alias context

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

### Requirement: System requirement text is not UnitTranslation extra

`UnitTranslation.extra` SHALL remain scoped to translation-correlated
presentation metadata such as cover URLs. Game system requirement raw text SHALL
NOT be stored in `UnitTranslation.extra`, because requirements are
platform/tier/source-specific facts and do not follow the UnitTranslation
display fallback chain.

#### Scenario: Requirement text stored outside UnitTranslation

- **WHEN** a GAME release records recommended system requirements as raw text
- **THEN** the raw text SHALL be stored in the game system requirements backend
- **AND** `UnitTranslation.extra` SHALL NOT receive a requirements field

#### Scenario: Cover remains translation extra

- **WHEN** a GAME or MEDIA release has localized cover art
- **THEN** the cover URL MAY remain in `UnitTranslation.extra.coverUrl`
- **AND** this SHALL NOT imply that source-specific requirement text belongs in
  the same JSON object
