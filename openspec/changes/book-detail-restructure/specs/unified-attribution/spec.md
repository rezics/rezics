## MODIFIED Requirements

### Requirement: Retrieve attributions for a unit

The server SHALL provide a method to retrieve all attributions for a given unit, including the Entity's resolved translations. Results SHALL be grouped by role and ordered by sortOrder within each role. The `bookQueries.detail()` response SHALL include attribution entities with their full `translations[]` array so that the frontend can resolve entity names and bios per language without additional API calls.

#### Scenario: Book detail response includes entity translations

- **WHEN** a client fetches book detail via `bookQueries.detail(bookId)`
- **THEN** the response `attributions[]` SHALL include each entity's `translations[]` array
- **AND** the frontend SHALL be able to resolve an entity's name for any available language from this data

#### Scenario: Author name resolved by selected language

- **GIVEN** a book has an attribution with `role = "author"` pointing to entity "entity-1"
- **AND** entity-1 has translations: `[{language: "ja", name: "村上春樹"}, {language: "en", name: "Haruki Murakami"}]`
- **WHEN** the book detail page renders with selected language `"en"`
- **THEN** the author name SHALL display as "Haruki Murakami"

#### Scenario: Author name falls back when selected language unavailable

- **GIVEN** entity-1 has translations only for `"ja"`
- **WHEN** the selected language is `"en"`
- **THEN** the system SHALL fall back through the translation resolution chain and display the Japanese name
