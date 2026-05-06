## ADDED Requirements

### Requirement: Alternate unique-key lookup uses explicit by-key path

API routes in `@rezics/server` SHALL keep primary single-item reads id-first
using `GET /{resource}/:unitId` when the resource is Unit-backed. Alternate
unique-key lookups SHALL use explicit by-key paths such as
`GET /{resource}/by-slug/:slug`.

This convention applies to API routes only. Browser-facing public routes MAY use
short canonical slug paths such as `/unit/:unitSlug` because they are owned by
the frontend route contract, not the server API route convention.

#### Scenario: Unit API keeps id-primary read

- **WHEN** a client requests `GET /unit/unit-1`
- **THEN** the server SHALL interpret `unit-1` as `Unit.id`
- **AND** it SHALL NOT treat the segment as a slug

#### Scenario: Unit API uses by-slug for slug lookup

- **WHEN** a client requests `GET /unit/by-slug/realm-a`
- **THEN** the server SHALL interpret `realm-a` as `Unit.slug`
- **AND** it SHALL NOT treat the segment as a Unit id

#### Scenario: Public route convention does not change API route convention

- **WHEN** the frontend exposes `/unit/realm-a` as a public browser route
- **THEN** the server API SHALL NOT be required to expose
  `GET /unit/realm-a` as a slug lookup endpoint
