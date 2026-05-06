## ADDED Requirements

### Requirement: Public route contracts are shared schemas

The `@rezics/contract` package SHALL export TypeBox schemas for browser-facing
public route params and Unit resolver search params. These schemas SHALL include
JSDoc that states the canonical path, the backing identity namespace, and any
namespace that the route explicitly does not resolve.

The first public route contract set SHALL include:

- `publicUserSlugRouteParamsSchema` for `/u/:userSlug`
- `publicUnitSlugRouteParamsSchema` for `/unit/:unitSlug`
- `publicUnitIdRouteParamsSchema` for `/unit/id/:unitId`
- `publicUnitResolverSearchSchema` for `/unit/*` resolver search params

#### Scenario: Public route schemas are exported

- **WHEN** a frontend route imports public route schemas from `@rezics/contract`
- **THEN** schemas for user slug params, Unit slug params, Unit id params, and
  Unit resolver search params SHALL be available

#### Scenario: JSDoc documents route ownership

- **WHEN** `publicUnitSlugRouteParamsSchema` is inspected
- **THEN** its JSDoc SHALL document that `/unit/:unitSlug` resolves only
  `Unit.slug` and never resolves `User.slug` or `Unit.id`

### Requirement: User public route resolves only user slugs

The public user route `/u/:userSlug` SHALL be the canonical browser-facing user
profile route. It SHALL resolve only the user slug namespace and SHALL NOT query
`Unit.slug`.

#### Scenario: User slug route resolves user

- **WHEN** a viewer navigates to `/u/alice01`
- **THEN** the app SHALL resolve `alice01` as a user slug
- **AND** it SHALL render the matching public user profile when found

#### Scenario: User slug route does not fall back to Unit slug

- **WHEN** a viewer navigates to `/u/rezics`
- **AND** no user has slug `rezics`
- **AND** a Unit has slug `rezics`
- **THEN** the route SHALL return 404 instead of resolving the Unit

### Requirement: Unit public slug route resolves only Unit slugs

The public Unit route `/unit/:unitSlug` SHALL be the canonical browser-facing
Unit slug resolver. It SHALL resolve only `Unit.slug` and SHALL NOT query
`User.slug` or `Unit.id`. Units without a slug SHALL NOT be reachable through
this route.

#### Scenario: Unit slug route resolves Unit slug

- **WHEN** a viewer navigates to `/unit/realm-a`
- **AND** a Unit exists with `slug = "realm-a"`
- **THEN** the route SHALL resolve that Unit

#### Scenario: Unit slug route returns 404 for missing slug

- **WHEN** a viewer navigates to `/unit/missing-slug`
- **AND** no Unit exists with `slug = "missing-slug"`
- **THEN** the route SHALL return 404

#### Scenario: Unit slug route does not fall back to id

- **WHEN** a viewer navigates to `/unit/018f-valid-looking-id`
- **AND** no Unit exists with `slug = "018f-valid-looking-id"`
- **AND** a Unit id happens to match the path segment
- **THEN** the route SHALL return 404 instead of resolving by id

### Requirement: Unit public id route resolves only Unit ids

The public Unit id route `/unit/id/:unitId` SHALL be the technical id fallback
for Unit resolver navigation. It SHALL resolve only `Unit.id` and SHALL NOT
query `Unit.slug` or `User.slug`.

#### Scenario: Unit id route resolves Unit id

- **WHEN** a viewer navigates to `/unit/id/unit-1`
- **AND** a Unit exists with id `unit-1`
- **THEN** the route SHALL resolve that Unit

#### Scenario: Unit id route does not fall back to slug

- **WHEN** a viewer navigates to `/unit/id/realm-a`
- **AND** no Unit exists with id `realm-a`
- **AND** a Unit exists with slug `realm-a`
- **THEN** the route SHALL return 404 instead of resolving by slug

### Requirement: Unit resolver search controls typed redirects

The Unit public resolver SHALL default to automatic typed-route redirection.
Supplying `?view=unit` SHALL suppress typed redirection and render the generic
Unit page for the resolved Unit. Supplying no `view` search param SHALL be
equivalent to `view=auto`.

The `publicUnitResolverSearchSchema` SHALL accept only omitted `view`,
`view=auto`, or `view=unit`.

#### Scenario: Unit slug route redirects by default

- **WHEN** a viewer navigates to `/unit/realm-a`
- **AND** the resolved Unit has type `REALM`
- **AND** a typed public realm route exists
- **THEN** the app SHALL redirect to that typed public realm route

#### Scenario: Unit slug route renders generic page with view unit

- **WHEN** a viewer navigates to `/unit/realm-a?view=unit`
- **AND** the resolved Unit exists and is visible to the viewer
- **THEN** the app SHALL render the generic Unit page without redirecting to the
  typed realm route

#### Scenario: Invalid Unit resolver search is rejected

- **WHEN** a viewer navigates to `/unit/realm-a?view=raw`
- **THEN** route search validation SHALL reject the search params or normalize
  them to a documented safe default

### Requirement: Public short route table is canonical

The public short route contract SHALL define user and Unit route namespaces as a
canonical table. The initial canonical table SHALL include:

| Route | Resolves | Notes |
| --- | --- | --- |
| `/u/:userSlug` | `User.slug` | User profile namespace |
| `/unit/:unitSlug` | `Unit.slug` | Unit slug resolver |
| `/unit/id/:unitId` | `Unit.id` | Technical Unit id fallback |

Future short aliases such as `/r/:realmSlug`, `/z/:zoneSlug`, and
`/t/:tagSlug` SHALL resolve typed Unit slugs and SHALL NOT replace the generic
`/unit/:unitSlug` resolver.

#### Scenario: Canonical table separates namespaces

- **WHEN** the public route contract table is read
- **THEN** each route SHALL name exactly one backing identity namespace
- **AND** no route SHALL accept an id-or-slug mixed identifier
