## ADDED Requirements

### Requirement: Multilingual translation generation

The `generateTranslations(type: UnitType)` function SHALL return an array of translation objects, each with a canonical `language` code from `@rezics/contract`. Every call SHALL include a `zh-hant` translation. Additional languages SHALL be included probabilistically: `en` at ~70%, `zh-hans` at ~40%, `ja` at ~20%, `de` at ~10%.

#### Scenario: Every unit gets a zh-hant translation

- **WHEN** `generateTranslations(UnitType.BOOK)` is called 100 times
- **THEN** every result array SHALL contain an entry with `language: 'zh-hant'`

#### Scenario: Probabilistic language distribution

- **WHEN** `generateTranslations(UnitType.BOOK)` is called 1000 times
- **THEN** approximately 70% of results SHALL contain an `en` translation
- **AND** approximately 40% SHALL contain a `zh-hans` translation
- **AND** approximately 20% SHALL contain a `ja` translation
- **AND** approximately 10% SHALL contain a `de` translation

#### Scenario: Result uses canonical language codes

- **WHEN** `generateTranslations(UnitType.BOOK)` is called
- **THEN** every translation object's `language` field SHALL be one of `'zh-hant'`, `'zh-hans'`, `'en'`, `'ja'`, `'de'`
- **AND** no legacy codes (`zh-CN`, `zh-SC`, `en-US`) SHALL appear

### Requirement: Curated text corpus for titles and summaries

Titles and summaries for each language SHALL be drawn from curated text pools stored in `seed/mock/data/text/<lang>.ts`. Each pool SHALL contain realistic text in the target language's script (Chinese characters for zh-hant/zh-hans, Japanese for ja, German for de, English for en). The generator SHALL pick randomly from the pool.

#### Scenario: zh-hant title uses Chinese characters

- **WHEN** a `zh-hant` translation is generated for a book
- **THEN** the title SHALL contain Traditional Chinese characters (not Latin lorem ipsum)

#### Scenario: ja title uses Japanese characters

- **WHEN** a `ja` translation is generated for a book
- **THEN** the title SHALL contain Japanese characters (kanji/hiragana/katakana)

#### Scenario: en title uses English words

- **WHEN** an `en` translation is generated for a book
- **THEN** the title SHALL contain English words

#### Scenario: Corpus provides type-appropriate text

- **WHEN** translations are generated for `UnitType.REALM`
- **THEN** titles SHALL be drawn from a realm-appropriate pool (community/group names), not book titles

### Requirement: Faker locale instances for structured data

The seed system SHALL maintain per-language faker instances using `@faker-js/faker` locale support. Person names (`faker.person.fullName()`), company names (`faker.company.name()`), and other structured data SHALL be generated using the locale-appropriate faker instance.

#### Scenario: Chinese person name from zh-hant faker

- **WHEN** a person is generated for a `zh-hant` context
- **THEN** the name SHALL be generated via `fakerZH_TW.person.fullName()` producing a Chinese name

#### Scenario: Japanese person name from ja faker

- **WHEN** a person is generated for a `ja` context
- **THEN** the name SHALL be generated via `fakerJA.person.fullName()` producing a Japanese name

#### Scenario: Faker fallback for unlocalised modules

- **WHEN** a faker module without locale-specific data is called (e.g., `lorem.words()`)
- **THEN** the faker instance SHALL fall back to English base locale without errors

### Requirement: Entity seeders produce multilingual translations

All entity seeders (books, games, media, shelves, realms, tags, posts, chapters) SHALL call `generateTranslations(type)` and create multiple `UnitTranslation` records per unit. The `UnitSupportLanguage` records SHALL be created for each language, with the first translation (`zh-hant`) marked as `isPrimary: true`.

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

### Requirement: Attribution uses locale-appropriate names

Person and organization seeds SHALL use faker locale instances to generate names appropriate to the unit's primary language context. The attribution seed SHALL produce a mix of names across locales for realistic diversity.

#### Scenario: Person names reflect locale diversity

- **WHEN** 300 persons are seeded
- **THEN** the name pool SHALL include names from multiple locales (Chinese, Japanese, English, German)
- **AND** names SHALL be generated using the locale-appropriate faker instance
