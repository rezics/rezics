## ADDED Requirements

### Requirement: Public Unit slug resolver is loader-driven

The route `/unit/:unitSlug` SHALL be a router entry whose loader fetches the
Unit by `Unit.slug`, applies the shared access-control check, and either
redirects to the typed destination or renders the generic Unit view according to
the Unit resolver search params.

The loader SHALL:

1. Validate params with `publicUnitSlugRouteParamsSchema`.
2. Validate search with `publicUnitResolverSearchSchema`.
3. Fetch the Unit by slug through the API client's Unit by-slug query.
4. If no Unit exists for the slug, throw `notFound()`.
5. If `canAccessUnit(unit, viewer)` returns `false`, throw `notFound()`.
6. If `view = "unit"`, render the generic Unit view.
7. Otherwise compute the typed destination via `buildUnitUrl(unit)` and redirect
   when a destination exists.
8. If no typed destination exists, render the generic Unit view.

#### Scenario: Realm slug redirects to typed route

- **GIVEN** a visible Unit with `slug = "realm-a"` and type `REALM`
- **WHEN** a viewer navigates to `/unit/realm-a`
- **THEN** the loader resolves the Unit by slug
- **AND** the browser ends up on the typed public route for that realm

#### Scenario: Slug resolver renders generic Unit view

- **GIVEN** a visible Unit with `slug = "realm-a"` and type `REALM`
- **WHEN** a viewer navigates to `/unit/realm-a?view=unit`
- **THEN** the loader resolves the Unit by slug
- **AND** the generic Unit page renders without redirecting

#### Scenario: Missing Unit slug returns 404

- **WHEN** a viewer navigates to `/unit/not-found`
- **AND** no Unit has slug `not-found`
- **THEN** the loader throws `notFound()`

### Requirement: Public Unit id resolver is loader-driven

The route `/unit/id/:unitId` SHALL be a router entry whose loader fetches the
Unit by `Unit.id`, applies the shared access-control check, and either redirects
to the typed destination or renders the generic Unit view according to the Unit
resolver search params.

The loader SHALL:

1. Validate params with `publicUnitIdRouteParamsSchema`.
2. Validate search with `publicUnitResolverSearchSchema`.
3. Fetch the Unit via `context.queryClient.ensureQueryData(unitDetailQuery(unitId))`.
4. If no Unit exists for the id, throw `notFound()`.
5. If `canAccessUnit(unit, viewer)` returns `false`, throw `notFound()`.
6. If `view = "unit"`, render the generic Unit view.
7. Otherwise compute the typed destination via `buildUnitUrl(unit)` and redirect
   when a destination exists.
8. If no typed destination exists, render the generic Unit view.

#### Scenario: Unit id redirects to typed route

- **GIVEN** a visible BOOK Unit with id `book-1`
- **WHEN** a viewer navigates to `/unit/id/book-1`
- **THEN** the loader resolves the Unit by id
- **AND** the browser ends up on the typed public route for that book

#### Scenario: Unit id resolver renders generic Unit view

- **GIVEN** a visible BOOK Unit with id `book-1`
- **WHEN** a viewer navigates to `/unit/id/book-1?view=unit`
- **THEN** the loader resolves the Unit by id
- **AND** the generic Unit page renders without redirecting

#### Scenario: Missing Unit id returns 404

- **WHEN** a viewer navigates to `/unit/id/missing-id`
- **AND** no Unit has id `missing-id`
- **THEN** the loader throws `notFound()`

### Requirement: Unit resolver never mixes id and slug namespaces

The Unit resolver SHALL NOT treat a single path segment as an id-or-slug mixed
identifier. `/unit/:unitSlug` SHALL resolve only `Unit.slug`; `/unit/id/:unitId`
SHALL resolve only `Unit.id`.

#### Scenario: Slug route does not resolve ids

- **GIVEN** a Unit with id `unit-1` and no slug
- **WHEN** a viewer navigates to `/unit/unit-1`
- **THEN** the slug resolver returns 404

#### Scenario: Id route does not resolve slugs

- **GIVEN** a Unit with slug `realm-a`
- **WHEN** a viewer navigates to `/unit/id/realm-a`
- **AND** no Unit id equals `realm-a`
- **THEN** the id resolver returns 404

## REMOVED Requirements

### Requirement: `/unit/:unitId` is a loader-driven resolver

**Reason**: The public `/unit/:segment` route is being reassigned to canonical
Unit slug resolution. Keeping id resolution at this path would create an
ambiguous id-or-slug route, which the public route contract forbids.

**Migration**: Move by-id Unit resolver navigation to `/unit/id/:unitId`.
Existing internal links to `/unit/:unitId` SHALL be updated or redirected to
`/unit/id/:unitId` during the migration window.

### Requirement: `/unit/:unitId/view` renders the generic unit view

**Reason**: Generic Unit rendering is now controlled by the resolver search
param `?view=unit` on both `/unit/:unitSlug` and `/unit/id/:unitId`. Keeping a
separate `/view` child under the old id route preserves the old route shape
instead of the new public resolver contract.

**Migration**: Replace direct generic view links with
`/unit/:unitSlug?view=unit` when a slug is available, or
`/unit/id/:unitId?view=unit` for the id fallback.
