## ADDED Requirements

### Requirement: ContentSearchOptions supports SlugRef tags

The `ContentSearchOptions` schema SHALL add a `tags` field of type `SlugRef[]` (array of `{ slug: string; unitId?: string }` objects). Each entry represents an independent tag filter. The backend SHALL resolve each `SlugRef` independently — using `unitId` directly when present, falling back to slug lookup otherwise.

#### Scenario: Search with SlugRef tags containing unitId

- **WHEN** a search request includes `tags: [{ slug: "light-novel", unitId: "uuid-1" }]`
- **THEN** the backend SHALL use `unitId: "uuid-1"` directly in the MeiliSearch filter
- **AND** SHALL NOT perform a slug lookup

#### Scenario: Search with SlugRef tags containing slug only

- **WHEN** a search request includes `tags: [{ slug: "light-novel" }]`
- **THEN** the backend SHALL resolve `slug: "light-novel"` to its `unitId` via database lookup
- **AND** use the resolved `unitId` in the MeiliSearch filter

#### Scenario: Search with mixed SlugRef entries

- **WHEN** a search request includes `tags: [{ slug: "a", unitId: "uuid-1" }, { slug: "b" }]`
- **THEN** the backend SHALL use `uuid-1` directly for the first tag and resolve `"b"` by slug for the second

### Requirement: ZoneFilters type in contract

The `@rezics/contract` package SHALL export a `ZoneFilters` Typebox schema that is a strict subset of `ContentSearchOptions`. It SHALL include the following optional fields: `type` (string or string array), `tags` (SlugRef array), `realmId` (string), `nsfw` (boolean), `isLicensed` (boolean), `languages` (string array). `ZoneFilters` SHALL NOT include `keyword`, `sort`, `offset`, or `limit` — those are user-controlled search parameters, not zone-defined base conditions.

#### Scenario: ZoneFilters accepts valid filter combination

- **WHEN** `{ type: ["BOOK"], tags: [{ slug: "light-novel" }], isLicensed: true }` is validated against `ZoneFilters`
- **THEN** validation SHALL pass

#### Scenario: ZoneFilters rejects keyword field

- **WHEN** `{ keyword: "test" }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `keyword` is not a valid `ZoneFilters` field

### Requirement: ZoneDTO type in contract

The `@rezics/contract` package SHALL export a `ZoneDTO` Typebox schema representing the public-facing zone data. It SHALL include: `slug` (string), `name` (string — resolved translation), `description` (string? — resolved translation), `filters` (ZoneFilters), `template` (string), `styling` (Json?), `startsAt` (string? — ISO datetime), `endsAt` (string? — ISO datetime).

#### Scenario: ZoneDTO is returned by zone resolution endpoint

- **WHEN** a client fetches a zone by slug
- **THEN** the response body SHALL conform to `ZoneDTO`

## MODIFIED Requirements

### Requirement: ContentSearchOptions type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchOptions` interface that defines the input shape for content search queries. This type SHALL be used by the server search endpoint and the frontend API client. The schema SHALL include a `tags` field of type `SlugRef[]` alongside the existing `tagIds` field. When both `tags` and `tagIds` are present in a request, `tags` SHALL take precedence.

#### Scenario: Server endpoint validates against ContentSearchOptions

- **GIVEN** a search request arrives at the server
- **WHEN** the request body is parsed
- **THEN** it SHALL be validated against the `ContentSearchOptions` schema

#### Scenario: Both tags and tagIds present

- **GIVEN** a search request with `tags: [{ slug: "a" }]` and `tagIds: ["uuid-1"]`
- **WHEN** the server processes the request
- **THEN** it SHALL use the `tags` field and ignore `tagIds`
