## MODIFIED Requirements

### Requirement: ContentSearchDocument type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchDocument` interface that defines the shape of a document in the Meilisearch content index. This type SHALL be shared across backend (sync, search API) and frontend (result rendering).

The `ContentSearchDocument` schema SHALL include a `rating: ContentRating` field denormalized from the source Unit's `rating`. It SHALL NOT include any `nsfw: boolean` field.

#### Scenario: Backend sync uses ContentSearchDocument

- **GIVEN** the sync function builds a document for Meilisearch
- **WHEN** the document is constructed
- **THEN** it SHALL conform to the `ContentSearchDocument` interface from `@rezics/contract`
- **AND** its `rating` field SHALL match the source Unit's `rating`

#### Scenario: Frontend receives ContentSearchDocument in results

- **GIVEN** a search query returns results
- **WHEN** the frontend processes the response
- **THEN** each item in the results array SHALL conform to `ContentSearchDocument`
- **AND** each item SHALL expose `rating` as one of `GENERAL`, `R_15`, `R_18`, or `R_18G`

#### Scenario: No nsfw field is present

- **WHEN** the `ContentSearchDocument` type is inspected
- **THEN** it SHALL NOT contain a property named `nsfw`

### Requirement: ContentSearchOptions type is defined in @rezics/contract

The `@rezics/contract` package SHALL export a `ContentSearchOptions` interface that defines the input shape for content search queries. This type SHALL be used by the server search endpoint and the frontend API client. The schema SHALL include a `tags` field of type `SlugRef[]` alongside the existing `tagIds` field. When both `tags` and `tagIds` are present in a request, `tags` SHALL take precedence.

The schema SHALL expose a `ratings?: ContentRating[]` field for set-based rating filtering and SHALL NOT expose any `nsfw?: boolean` field. When `ratings` is absent, the server SHALL apply the caller's derived allowed-rating set (see the `content-rating` capability). When `ratings` is present, the server SHALL intersect the request value with the caller's allowed set and apply the intersection; the server SHALL NOT widen the filter beyond what the caller is permitted to see.

#### Scenario: Server endpoint validates against ContentSearchOptions

- **GIVEN** a search request arrives at the server
- **WHEN** the request body is parsed
- **THEN** it SHALL be validated against the `ContentSearchOptions` schema

#### Scenario: Both tags and tagIds present

- **GIVEN** a search request with `tags: [{ slug: "a" }]` and `tagIds: ["uuid-1"]`
- **WHEN** the server processes the request
- **THEN** it SHALL use the `tags` field and ignore `tagIds`

#### Scenario: Ratings filter intersects with allowed set

- **GIVEN** an unauthenticated caller whose allowed set is `{GENERAL, R_15}`
- **WHEN** the request includes `ratings: ["GENERAL", "R_15", "R_18"]`
- **THEN** the server SHALL apply the filter `{GENERAL, R_15}` (intersection) to the search
- **AND** results SHALL NOT include any Unit with `rating = R_18` or `R_18G`

#### Scenario: Ratings omitted defaults to caller's allowed set

- **GIVEN** an authenticated caller whose derived allowed set is `{GENERAL, R_15, R_18}`
- **WHEN** the request omits `ratings`
- **THEN** the server SHALL apply `{GENERAL, R_15, R_18}` as the rating filter

#### Scenario: No nsfw field is present

- **WHEN** the `ContentSearchOptions` type is inspected
- **THEN** it SHALL NOT contain a property named `nsfw`

### Requirement: ZoneFilters type in contract

The `@rezics/contract` package SHALL export a `ZoneFilters` Typebox schema that is a strict subset of `ContentSearchOptions`. It SHALL include the following optional fields: `type` (string or string array), `tags` (SlugRef array), `realmId` (string), `ratings` (ContentRating array), `isLicensed` (boolean), `languages` (string array). `ZoneFilters` SHALL NOT include `keyword`, `sort`, `offset`, `limit`, or `nsfw` — the first four are user-controlled search parameters not appropriate as zone-defined base conditions, and the last has been replaced by `ratings`.

When a request resolves a zone, the final applied rating filter SHALL be the intersection of the zone's `ratings` (if set) and the caller's derived allowed-rating set.

#### Scenario: ZoneFilters accepts valid filter combination

- **WHEN** `{ type: ["BOOK"], tags: [{ slug: "light-novel" }], isLicensed: true, ratings: ["GENERAL", "R_15"] }` is validated against `ZoneFilters`
- **THEN** validation SHALL pass

#### Scenario: ZoneFilters rejects keyword field

- **WHEN** `{ keyword: "test" }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `keyword` is not a valid `ZoneFilters` field

#### Scenario: ZoneFilters rejects nsfw field

- **WHEN** `{ nsfw: true }` is validated against `ZoneFilters`
- **THEN** validation SHALL fail because `nsfw` is no longer a valid `ZoneFilters` field

#### Scenario: Zone ratings intersect with caller allowed set

- **GIVEN** a zone with `filters.ratings = ["GENERAL", "R_15", "R_18"]`
- **AND** an unauthenticated caller with allowed set `{GENERAL, R_15}`
- **WHEN** the zone resolution applies its filters
- **THEN** the effective rating filter SHALL be `{GENERAL, R_15}`

## REMOVED Requirements

### Requirement: ZoneFilters nsfw field

**Reason**: The boolean `nsfw` filter has been replaced by `ratings: ContentRating[]` set-based filtering aligned with the new `ContentRating` enum.

**Migration**: Zones that previously set `filters.nsfw = false` SHALL be updated to `filters.ratings = ["GENERAL", "R_15"]`. Zones that previously set `filters.nsfw = true` SHALL be updated to `filters.ratings = ["GENERAL", "R_15", "R_18", "R_18G"]` or similar, at the maintainer's discretion. No automatic backfill is applied; this is a dev-phase breaking change.
