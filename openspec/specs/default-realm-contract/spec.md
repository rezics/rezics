## ADDED Requirements

### Requirement: Default realm definition in contract

`@rezics/contract` SHALL export a `DEFAULT_REALM` constant object that serves as the single source of truth for the default realm's configuration. The object SHALL include:

- `slug`: `"rezics"` — stable identifier across environments
- `isPublic`: `true`
- `isOfficial`: `true`
- `translations`: a record keyed by language code (`en`, `zh-hant`, `ja`) where each entry contains `title` (string) and `description` (string)

The `title` SHALL be `"rezics"` in all languages. The `description` SHALL be localized per language.

All fields and the object itself SHALL be documented with JSDoc.

The object SHALL be typed with `as const` for literal type inference.

#### Scenario: Importing DEFAULT_REALM from contract

- **WHEN** any package imports `DEFAULT_REALM` from `@rezics/contract`
- **THEN** it receives a typed constant with slug, flags, and translations for en, zh-hant, and ja

#### Scenario: Type-level language key access

- **WHEN** a consumer accesses `DEFAULT_REALM.translations["ja"]`
- **THEN** TypeScript resolves the type to `{ title: string; description: string }` without assertion

### Requirement: Default realm translation content

The `DEFAULT_REALM.translations` SHALL contain the following localized descriptions:

- **en**: A concise English description of the global community purpose
- **zh-hant**: A Traditional Chinese description matching the English meaning
- **ja**: A Japanese description matching the English meaning

Titles SHALL all be `"rezics"` (the project name is language-neutral).

#### Scenario: Seed reads translations from contract

- **WHEN** the seed script creates or updates the default realm
- **THEN** it uses `DEFAULT_REALM.translations` to create `UnitTranslation` rows for all three languages

### Requirement: Exported type for default realm

`@rezics/contract` SHALL export a `DefaultRealmDefinition` type derived from `typeof DEFAULT_REALM` so consumers can type parameters that accept the definition object.

#### Scenario: Typing a function parameter

- **WHEN** a function accepts the default realm definition as input
- **THEN** it can use `DefaultRealmDefinition` as the parameter type
