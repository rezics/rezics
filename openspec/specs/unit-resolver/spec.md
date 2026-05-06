# unit-resolver Specification

## Purpose

The unit-resolver capability defines how the router behaves when the viewer navigates to `/unit/:unitSlug` (canonical slug entry) or `/unit/id/:unitId` (technical id fallback): it resolves the unit, applies access control, and either redirects to the typed destination (book, post, shelf, etc.) computed via `buildUnitUrl` or renders the generic unit view when `?view=unit` is supplied or no typed destination exists. The resolver is the single entry point for Unit navigation, keeping routing logic centralized and ensuring typed pages and the resolver agree on visibility.

## Requirements

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

### Requirement: `canAccessUnit` is the single source of truth for visibility
A shared helper `canAccessUnit(unit, viewer): boolean` SHALL be implemented and used by both the resolver and every typed destination page (book, post, shelf, etc.). The rules SHALL be:
- `unit.status === 'DELETED'` → returns `false` for all viewers (including the owner).
- `unit.status === 'DRAFT'` or `unit.visibility === 'PRIVATE'` or `unit.visibility === 'UNLISTED'` → returns `true` only if `viewer.id === unit.userId` (owner-only access).
- All other states → returns `true`.

#### Scenario: Deleted unit is invisible to owner
- **GIVEN** a unit with `status = 'DELETED'` whose `userId` matches the viewer
- **WHEN** `canAccessUnit(unit, viewer)` is called
- **THEN** the result SHALL be `false`

#### Scenario: Draft unit visible to owner only
- **GIVEN** a unit with `status = 'DRAFT'` whose `userId` matches the viewer
- **WHEN** `canAccessUnit(unit, viewer)` is called
- **THEN** the result SHALL be `true`

#### Scenario: Draft unit hidden from non-owner
- **GIVEN** a unit with `status = 'DRAFT'` whose `userId` does not match the viewer
- **WHEN** `canAccessUnit(unit, viewer)` is called
- **THEN** the result SHALL be `false`

#### Scenario: Resolver and typed page agree
- **GIVEN** a unit and a viewer for which `canAccessUnit` returns `false`
- **WHEN** the viewer navigates to `/unit/<id>` and (separately) to the typed destination URL
- **THEN** both routes return 404; the viewer never sees a flash of redirect followed by a 404

### Requirement: Resolver uses `buildUrl` as the single source of truth
The resolver loader SHALL NOT contain its own switch on `UnitType` or `PostKind`. The mapping from a unit to its typed destination SHALL go through the existing `buildUrl(unit)` utility. Any future addition (new UnitType, new PostKind) SHALL be added to `buildUrl` once and inherited by the resolver.

#### Scenario: New unit type added to buildUrl
- **GIVEN** a future change adds a new branch to `buildUrl` for a newly introduced UnitType
- **WHEN** the resolver is invoked for a unit of that type
- **THEN** the resolver redirects to the newly added typed page without modification to the resolver itself

#### Scenario: Resolver source contains no UnitType switch
- **WHEN** the resolver loader source is inspected
- **THEN** it SHALL contain no `switch` or chained `if` block over `UnitType` or `PostKind` values; routing decisions SHALL go through `buildUrl`

### Requirement: Resolution terminates in a single redirect
The resolver SHALL produce at most one redirect per request. No typed destination SHALL ever redirect back to `/unit/:unitId`. An integration test SHALL assert this for every UnitType.

#### Scenario: Redirect-loop test
- **WHEN** the integration test enumerates every UnitType, creates a representative unit of each, and follows the redirect chain starting from `/unit/<id>`
- **THEN** every chain terminates within one redirect (or directly at the resolver throwing `notFound()`)

#### Scenario: New typed page introduces a loop
- **GIVEN** a future change introduces a typed page that redirects back to `/unit/:unitId`
- **WHEN** the redirect-loop integration test runs
- **THEN** the test SHALL fail and block the change from merging

### Requirement: Resolver pre-warms unit query cache
The resolver loader SHALL use `ensureQueryData` (not `fetchQuery`) when fetching the unit, so the destination route mounts with the unit data already in the TanStack Query cache.

#### Scenario: Destination page reads cached unit
- **GIVEN** a viewer navigates to `/unit/<id>` and is redirected to a typed page that consumes `unitQueries.detail(<id>)`
- **WHEN** the typed page mounts
- **THEN** it reads the cached unit data without issuing a second fetch
