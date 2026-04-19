## ADDED Requirements

### Requirement: `/unit/:unitId` is a loader-driven resolver
The route `/unit/:unitId` SHALL be a router entry whose loader fetches the unit, applies the access-control check, and either redirects to the unit's typed page or to the generic `/unit/:unitId/view` fallback. The route component itself SHALL render nothing — the loader SHALL always either redirect or throw `notFound()`.

The loader SHALL:
1. Fetch the unit via `context.queryClient.ensureQueryData(unitQueries.detail(params.unitId))`.
2. If the unit does not exist, throw `notFound()`.
3. If `canAccessUnit(unit, viewer)` returns `false`, throw `notFound()`.
4. Compute the typed destination via `buildUrl(unit)`. If a destination exists, throw `redirect({ to: dest.path, params: dest.params })`.
5. Otherwise throw `redirect({ to: '/unit/$unitId/view', params: { unitId: params.unitId } })`.

#### Scenario: Book unit redirects to book page
- **GIVEN** a unit of type BOOK with id `book-1`
- **WHEN** a viewer navigates to `/unit/book-1`
- **THEN** the loader resolves and the browser ends up on `/book/book-1` (or whatever route `buildUrl` returns for BOOK units)

#### Scenario: Post unit with kind REVIEW redirects to review page
- **GIVEN** a unit of type POST whose post `kind` is `REVIEW` with id `review-1`
- **WHEN** a viewer navigates to `/unit/review-1`
- **THEN** the browser ends up on `/review/review-1`

#### Scenario: Unmapped unit type falls through to generic view
- **GIVEN** a unit whose type has no entry in `buildUrl`
- **WHEN** a viewer navigates to `/unit/<id>`
- **THEN** the loader redirects to `/unit/<id>/view`

#### Scenario: Missing unit returns 404
- **GIVEN** an id that does not correspond to any unit
- **WHEN** a viewer navigates to `/unit/<id>`
- **THEN** the loader throws `notFound()` and the user sees the standard 404 page

#### Scenario: Resolver page renders nothing
- **WHEN** the resolver route is mounted in tests
- **THEN** its component SHALL not produce any rendered output (the loader always throws before render)

### Requirement: `/unit/:unitId/view` renders the generic unit view
The route `/unit/:unitId/view` SHALL render the generic Unit detail page that previously lived at `/unit/:unitId`. This route SHALL be reachable directly (bookmarkable) and SHALL be the fallback target of the resolver when `buildUrl` returns no typed destination.

#### Scenario: Direct navigation to /view works
- **WHEN** a viewer navigates to `/unit/<id>/view` directly
- **THEN** the generic Unit view renders the unit's content without redirecting

#### Scenario: /view honors access control
- **WHEN** a viewer who lacks access (per `canAccessUnit`) navigates to `/unit/<id>/view`
- **THEN** the route returns 404 (the same outcome the resolver would have produced)

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
