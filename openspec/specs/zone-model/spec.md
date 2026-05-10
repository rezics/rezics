## ADDED Requirements

### Requirement: ZONE is a UnitType

The `UnitType` enum SHALL include `ZONE`. A zone unit follows the same creation, slug assignment, translation, and visibility patterns as all other unit types.

#### Scenario: Zone unit is created with type ZONE

- **WHEN** a new zone is created via the admin API
- **THEN** a `Unit` record SHALL be created with `type = ZONE`
- **AND** the unit SHALL have a unique, non-null `slug`

#### Scenario: Zone unit supports translations

- **WHEN** a zone unit exists
- **THEN** it SHALL support `UnitTranslation` records for multilingual name and description

### Requirement: Zone extension model

A `Zone` model SHALL exist as a 1:1 extension of `Unit` (keyed by `unitId`), following the same pattern as `Book`, `Realm`, and `Game`. The `Zone` model SHALL include the following fields:

| Field      | Type       | Nullable | Description                                      |
|------------|------------|----------|--------------------------------------------------|
| `unitId`   | UUID (PK)  | No       | References `Unit.id`, cascade delete              |
| `filters`  | Json       | No       | `ZoneFilters` — pre-applied search filter criteria|
| `template` | String     | No       | Slug identifying the frontend template to render  |
| `styling`  | Json       | Yes      | Visual customization (bgImage, accentColor, etc.) |
| `startsAt` | DateTime   | Yes      | Lifecycle start — null means no start constraint  |
| `endsAt`   | DateTime   | Yes      | Lifecycle end — null means no end constraint      |

#### Scenario: Zone model stores filter criteria

- **WHEN** a zone is created with `filters: { type: ["BOOK"], tagIds: ["uuid-1"] }`
- **THEN** the `Zone.filters` JSON column SHALL persist the filter criteria exactly as provided

#### Scenario: Zone model references Unit via unitId

- **WHEN** the parent `Unit` is deleted
- **THEN** the corresponding `Zone` record SHALL be cascade-deleted

### Requirement: Zone lifecycle access control

The zone resolution endpoint SHALL enforce lifecycle constraints independently of `Unit.visibility`. When `startsAt` is set and the current time is before `startsAt`, the zone SHALL NOT be accessible. When `endsAt` is set and the current time is after `endsAt`, the zone SHALL NOT be accessible. Both fields being null means the zone is permanently accessible (no temporal constraint).

#### Scenario: Zone before startsAt

- **GIVEN** a zone with `startsAt = 2026-05-01T00:00:00Z` and current time is `2026-04-15`
- **WHEN** a client requests the zone
- **THEN** the server SHALL respond with a 404 or a lifecycle-specific status indicating the zone has not started

#### Scenario: Zone after endsAt

- **GIVEN** a zone with `endsAt = 2026-04-30T23:59:59Z` and current time is `2026-05-02`
- **WHEN** a client requests the zone
- **THEN** the server SHALL respond with a 404 or a lifecycle-specific status indicating the zone has ended

#### Scenario: Permanent zone with no lifecycle constraints

- **GIVEN** a zone with `startsAt = null` and `endsAt = null`
- **WHEN** a client requests the zone at any time
- **THEN** the zone SHALL be accessible (lifecycle check passes)

#### Scenario: Lifecycle is independent of visibility

- **GIVEN** a zone with `visibility = PUBLIC` and `endsAt` in the past
- **WHEN** a client requests the zone
- **THEN** the zone SHALL NOT be accessible despite being public

### Requirement: Zone admin CRUD API

The server SHALL provide admin-only CRUD endpoints for zones. These endpoints SHALL be protected by admin permission guards. The create and update endpoints SHALL validate `filters` against the `ZoneFilters` schema and `template` against a known set of valid template slugs.

#### Scenario: Admin creates a zone

- **WHEN** an admin sends a POST request with zone data (slug, translations, filters, template)
- **THEN** the server SHALL create a `Unit` (type=ZONE) and a `Zone` extension record
- **AND** return the created zone DTO

#### Scenario: Admin updates zone filters

- **WHEN** an admin sends a PATCH request updating `filters` for an existing zone
- **THEN** the server SHALL validate the new filters against `ZoneFilters` schema
- **AND** persist the updated filters

#### Scenario: Non-admin cannot create zone

- **WHEN** a non-admin user sends a POST request to create a zone
- **THEN** the server SHALL respond with 403

### Requirement: Zone resolution endpoint

The server SHALL provide a public endpoint to fetch a zone by slug. The response SHALL include the zone's filters, template, styling, and translated name/description. The endpoint SHALL enforce both visibility and lifecycle checks before returning data.

#### Scenario: Fetch zone by slug

- **WHEN** a client requests `GET /zone/:slug`
- **THEN** the server SHALL return a `ZoneDTO` containing `slug`, `filters`, `template`, `styling`, `name`, `description`, `startsAt`, `endsAt`

#### Scenario: Fetch non-existent zone

- **WHEN** a client requests a zone slug that does not exist
- **THEN** the server SHALL respond with 404

### Requirement: ZoneFilters schema is a subset of ContentSearchOptions

The `ZoneFilters` type SHALL be a strict subset of `ContentSearchOptions` fields. It SHALL support: `type` (string or string array), `tags` (SlugRef array), `realmId` (string), `ratings` (ContentRating array), `isLicensed` (boolean), and `languages` (string array). The `ZoneFilters` type SHALL be defined as a Typebox schema in `@rezics/contract`.

#### Scenario: ZoneFilters validates correctly

- **WHEN** a zone is created with `filters: { type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **THEN** the filters SHALL pass `ZoneFilters` schema validation

#### Scenario: ZoneFilters rejects unknown fields

- **WHEN** a zone is created with `filters: { unknownField: true }`
- **THEN** the filters SHALL fail `ZoneFilters` schema validation
