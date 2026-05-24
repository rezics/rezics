## MODIFIED Requirements

### Requirement: Description edited as markdown

Long descriptions that support rich formatting SHALL use `ContentDoc` instead of a plain description string. This applies to both `User.description` (profile description) and `UnitTranslation.description` (per-language Unit description). Description editor surfaces SHALL use `RezicsMarkdownEditor` and SHALL save the Markdown source into the description content document's `main.source`. Canonical server write paths, seed/factory generation, and infrastructure bootstrap data SHALL persist rich descriptions as `ContentDoc` or `null`; they SHALL NOT persist JSON string values in rich-description columns. Compact `User.bio` and `UnitTranslation.summary` fields SHALL remain plain strings.

#### Scenario: User edits profile description with formatting

- **WHEN** the user opens the profile settings page
- **THEN** the description field renders as a `RezicsMarkdownEditor` with the current description content loaded from the description `ContentDoc`

#### Scenario: User saves markdown description

- **WHEN** the user writes markdown in the description editor and saves
- **THEN** the markdown source text is stored in a description `ContentDoc` at `description.main.source`
- **AND** it SHALL NOT be stored as a plain PostgreSQL `descriptionText` projection
- **AND** the column type SHALL be `Json?`, not `String?`

#### Scenario: Unit translation description uses the same shape

- **WHEN** an editor saves a long description for a book translation
- **THEN** the value SHALL be stored in `UnitTranslation.description` as a `ContentDoc`
- **AND** rendering surfaces SHALL render it via the same renderer as user profile descriptions

#### Scenario: Factory user descriptions use ContentDoc

- **WHEN** the factory seed creates a user with a generated profile description
- **THEN** `User.description` SHALL be persisted as a `ContentDoc`
- **AND** API responses that include that user SHALL validate against `userDTOSchema` and `publicUserSchema`

#### Scenario: Factory unit translation descriptions use ContentDoc

- **WHEN** the factory seed creates translations for books, games, media, tags, entities, realms, shelves, or zones
- **THEN** every non-empty `UnitTranslation.description` SHALL be persisted as a `ContentDoc`
- **AND** DTO responses that include those translations SHALL validate against `unitTranslationDTOSchema`

#### Scenario: Canonical create paths do not persist JSON strings

- **WHEN** a server create or update path writes `User.description` or `UnitTranslation.description`
- **THEN** the persisted value SHALL be a `ContentDoc` or `null`
- **AND** raw markdown strings SHALL be wrapped before persistence rather than stored directly in the JSON column

## ADDED Requirements

### Requirement: Existing JSON string descriptions are repaired

The system SHALL provide an idempotent repair path for development databases where `User.description` or `UnitTranslation.description` already contains a JSON string. The repair SHALL wrap non-empty strings into `ContentDoc.main.source` and SHALL convert empty or whitespace-only strings to null-equivalent JSON.

#### Scenario: Repair wraps user JSON string description

- **WHEN** a `User.description` JSON value is a non-empty string
- **THEN** the repair converts it to a `ContentDoc` whose `main.source` is the original string
- **AND** the repaired user validates against `userDTOSchema`

#### Scenario: Repair wraps unit translation JSON string description

- **WHEN** a `UnitTranslation.description` JSON value is a non-empty string
- **THEN** the repair converts it to a `ContentDoc` whose `main.source` is the original string
- **AND** the repaired translation validates against `unitTranslationDTOSchema`

#### Scenario: Repair is idempotent

- **WHEN** the repair runs against rows that already contain valid `ContentDoc` values or null descriptions
- **THEN** those rows are left unchanged
- **AND** running the repair multiple times produces the same stored values
