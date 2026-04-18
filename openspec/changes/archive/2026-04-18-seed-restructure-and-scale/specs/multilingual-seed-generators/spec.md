## MODIFIED Requirements

### Requirement: Entity seeders produce multilingual translations

All entity seeders (books, games, media, shelves, realms, tags, posts, chapters) SHALL call `generateTranslations(type)` and create multiple `UnitTranslation` records per unit. The `UnitSupportLanguage` records SHALL be created for each language, with the first translation (`zh-hant`) marked as `isPrimary: true`.

Person and organization entity seeders SHALL also call `generateTranslations(UnitType.ENTITY)` to produce multi-language translations. Each translation SHALL include a locale-appropriate `title` (name) generated via the faker instance for that language, and a `description` field drawn from the summary text corpus.

#### Scenario: Book seeded with multiple translations

- **WHEN** a book is seeded
- **THEN** it SHALL have at minimum 1 `UnitTranslation` record (zh-hant) and potentially up to 5
- **AND** corresponding `UnitSupportLanguage` records SHALL exist for each translation language
- **AND** `defaultLanguage` SHALL be set to `'zh-hant'`

#### Scenario: Shelf seeded with multilingual title

- **WHEN** a shelf is seeded with translations in `zh-hant` and `en`
- **THEN** both `UnitTranslation` records SHALL be persisted
- **AND** the `zh-hant` `UnitSupportLanguage` SHALL have `isPrimary: true`
- **AND** the `en` `UnitSupportLanguage` SHALL have `isPrimary: false`

#### Scenario: Person entity seeded with multilingual translations

- **WHEN** a person entity is seeded
- **THEN** it SHALL have at minimum 1 `UnitTranslation` (in its primary locale) and potentially up to 5
- **AND** each translation SHALL include a `title` (locale-appropriate name) and a `description`
- **AND** corresponding `UnitSupportLanguage` records SHALL exist

#### Scenario: Organization entity seeded with multilingual translations

- **WHEN** an organization entity is seeded
- **THEN** it SHALL have at minimum 1 `UnitTranslation` and potentially up to 5
- **AND** each translation SHALL include a `title` (locale-appropriate company name) and a `description`

## ADDED Requirements

### Requirement: Tag description generation

The `generateTranslations(UnitType.TAG)` path SHALL produce a `description` field for each language translation. Tag descriptions SHALL be drawn from the summary text corpus (`getSummaryPool`) for each language.

#### Scenario: Tag seeded with descriptions

- **WHEN** a tag is seeded
- **THEN** each `UnitTranslation` record for the tag SHALL include a non-null `description` field

#### Scenario: Tag descriptions are multilingual

- **WHEN** a tag has translations in `zh-hant` and `en`
- **THEN** the `zh-hant` description SHALL be drawn from the zh-hant summary corpus
- **AND** the `en` description SHALL be drawn from the en summary corpus

### Requirement: Entity description generation

The `pickFromCorpus` function SHALL handle `UnitType.ENTITY` by returning both a `title` (name) and a `description` (bio/company description). For person entities, the description SHALL read as a short biographical summary. For organization entities, the description SHALL read as a company or publisher description.

#### Scenario: ENTITY type handled in pickFromCorpus

- **WHEN** `pickFromCorpus(UnitType.ENTITY, lang)` is called
- **THEN** the result SHALL include both a `title` and a `description` field

#### Scenario: Entity description uses summary corpus

- **WHEN** an entity translation is generated for language `ja`
- **THEN** the `description` SHALL be drawn from the Japanese summary text pool
