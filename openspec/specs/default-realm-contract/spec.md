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

### Requirement: Realm may define publishing license default
Realm metadata SHALL allow a realm to define an advisory default Unit publication license slug.

#### Scenario: Realm default is valid
- **WHEN** a realm stores a valid default license slug
- **THEN** composer flows in that realm MAY use it as their license prefill

#### Scenario: Realm default is invalid
- **WHEN** a realm update attempts to store an unknown default license slug
- **THEN** the server SHALL reject the update with a client error

### Requirement: Realm default overrides user default only as prefill
Realm publishing defaults SHALL override user publishing defaults only for initial composer state.

#### Scenario: User changes composer license
- **WHEN** a realm composer preloads the realm default license
- **AND** the user selects a different valid license before publishing
- **THEN** the created Unit SHALL store the user's selected license
