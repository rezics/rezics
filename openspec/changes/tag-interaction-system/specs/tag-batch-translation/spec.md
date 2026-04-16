## ADDED Requirements

### Requirement: Batch-resolve tag unit translations by tagUnitIds and language

The server SHALL provide an endpoint that accepts an array of tag `unitId` values and a `language` parameter, and returns the translated name, slug, and description for each tag unit. Translation resolution SHALL follow the standard chain: exact language match → unit default language → platform fallback (`"en"`) → first available.

#### Scenario: Resolve translations for multiple tags in Japanese

- **GIVEN** tag units `["tag-1", "tag-2"]` with translations for `"ja"` and `"en"`
- **WHEN** the client calls `GET /api/tags/batch-translations?unitIds=tag-1,tag-2&lang=ja`
- **THEN** the response SHALL return `{ "tag-1": { name: "異世界", slug: "isekai", description: "..." }, "tag-2": { name: "冒險", slug: "adventure", description: "..." } }`

#### Scenario: Fallback when requested language is unavailable

- **GIVEN** tag unit `"tag-1"` has translations only for `"en"` (no `"ja"`)
- **WHEN** the client requests `lang=ja`
- **THEN** the response SHALL return the `"en"` translation for `"tag-1"` (fallback)

#### Scenario: Tag unit does not exist

- **GIVEN** `unitIds` includes `"tag-nonexistent"`
- **WHEN** the client calls the batch translation endpoint
- **THEN** the response SHALL omit `"tag-nonexistent"` from the result (no error, partial success)

### Requirement: Frontend query hook for batch tag translations

The `@rezics/api` package SHALL provide a `tagQueries.batchTranslations(tagUnitIds, lang)` query option that calls the batch translation endpoint. The query key SHALL include the sorted tag unit IDs and language so that multiple components requesting the same tags in the same language share a single cached query.

#### Scenario: Hero and Overview share the same query

- **GIVEN** both the hero section and Overview tab request translations for `["tag-1", "tag-2"]` in `"ja"`
- **WHEN** both components mount
- **THEN** only one API call SHALL be made (React Query deduplication)
- **AND** both components SHALL receive the same cached result

#### Scenario: Language change triggers refetch

- **GIVEN** translations are cached for `"ja"`
- **WHEN** the user switches the page language to `"en"`
- **THEN** a new query SHALL be issued for `"en"` (different query key)
