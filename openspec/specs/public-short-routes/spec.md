# public-short-routes Specification

## Purpose

The public-short-routes capability defines the canonical browser-facing route
namespaces for users and Units. It establishes short, slug-first URLs as the
public foundation of the platform while keeping the user slug namespace and the
Unit slug namespace cleanly separated, and preserves an explicit Unit id
fallback for technical id navigation. Public route param and search shapes are
shared TypeBox schemas so the frontend, API client, and tests agree on the
contract.

## Requirements

### Requirement: Public route contracts are shared schemas

The `@rezics/contract` package SHALL export TypeBox schemas for browser-facing public route params, organized by the short=slug / long=unitId convention. Each schema SHALL include JSDoc that states the canonical path, the backing identity namespace, and any namespace that the route explicitly does not resolve.

The public route contract set SHALL include schemas for:

- Short-prefix slug routes per scope: `/u/:userSlug`, `/r/:realmSlug`, `/t/:tagSlug`, `/z/:zoneSlug`, `/e/:entitySlug`
- Long-prefix UUID routes per scope: `/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`
- Generic UUID fallback: `/unit/:unitId`
- Owner-scoped sub-resources: `/u/:userSlug/shelf/:slug`, `/r/:realmSlug/shelf/:slug`, and similar for future type-prefix segments
- Unit resolver search params: `publicUnitResolverSearchSchema` for `/unit/*` resolver search params

#### Scenario: Public route schemas are exported

- **WHEN** a frontend route imports public route schemas from `@rezics/contract`
- **THEN** schemas for each short-prefix slug route, each long-prefix UUID route, the generic `/unit/:unitId` resolver, and owner-scoped sub-resources SHALL be available

#### Scenario: JSDoc documents route ownership

- **WHEN** the user short-prefix route schema is inspected
- **THEN** its JSDoc SHALL document that `/u/:userSlug` resolves only the user-scope slug namespace and never resolves `Unit.id`

### Requirement: User public route resolves only user slugs

The public user route `/u/:userSlug` SHALL be the canonical browser-facing user profile route. It SHALL resolve `(slugScope = <user-scope-unit-id>, slug = :userSlug)` on `Unit` and SHALL NOT query any other scope.

#### Scenario: User slug route resolves user

- **WHEN** a viewer navigates to `/u/alice01`
- **THEN** the app SHALL resolve `alice01` as a USER-scope slug
- **AND** it SHALL render the matching public user profile when found

#### Scenario: User slug route does not fall back to other scopes

- **WHEN** a viewer navigates to `/u/rezics`
- **AND** no USER-scope Unit has slug `rezics`
- **AND** a REALM-scope Unit has slug `rezics`
- **THEN** the route SHALL return 404 instead of falling back to the realm scope

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

The public short route contract SHALL define the canonical route table organized by the short=slug / long=unitId convention. The canonical table SHALL include:

| Route | Resolves | Notes |
| --- | --- | --- |
| `/u/:userSlug` | `(user-scope, slug)` | User profile namespace |
| `/r/:realmSlug` | `(realm-scope, slug)` | Realm namespace |
| `/t/:tagSlug` | `(tag-scope, slug)` | Tag namespace |
| `/z/:zoneSlug` | `(zone-scope, slug)` | Zone namespace |
| `/e/:entitySlug` | `(entity-scope, slug)` | Entity namespace (returns 404 until `entity-slug-activation` enables ENTITY slugs) |
| `/user/:unitId` | `Unit.id` (type USER) | Typed UUID route |
| `/realm/:unitId` | `Unit.id` (type REALM) | Typed UUID route |
| `/tag/:unitId` | `Unit.id` (type TAG) | Typed UUID route |
| `/zone/:unitId` | `Unit.id` (type ZONE) | Typed UUID route |
| `/entity/:unitId` | `Unit.id` (type ENTITY) | Typed UUID route |
| `/unit/:unitId` | `Unit.id` (any type) | Universal UUID fallback; MAY redirect to typed long-prefix route by `?view` |
| `/u/:userSlug/shelf/:slug` | owner-scoped SHELF | Resolves only system shelves in v1 |
| `/r/:realmSlug/shelf/:slug` | owner-scoped SHELF | Substrate only in v1 |

The legacy `/unit/:unitSlug` slug route SHALL be removed. The `/@:slug` prefix SHALL NOT be introduced.

#### Scenario: Canonical table separates namespaces

- **WHEN** the public route contract table is read
- **THEN** each route SHALL name exactly one backing identity namespace
- **AND** no route SHALL accept an id-or-slug mixed identifier

#### Scenario: Convention can be lint-enforced

- **WHEN** the convention check (`bun run check:convention`) runs
- **THEN** any route definition whose param name suggests a UUID under a short prefix (or a slug under a long prefix) SHALL be flagged as a violation

### Requirement: Short prefix means slug, long prefix means unitId

The public route surface SHALL follow a single classification rule: routes that begin with a short single-character prefix (`/u/`, `/r/`, `/t/`, `/z/`, `/e/`) accept only slug-shaped values. Routes that begin with a long word prefix (`/user/`, `/realm/`, `/tag/`, `/zone/`, `/entity/`, `/unit/`) accept only UUID-shaped values. A URL SHALL be classifiable at a glance by its prefix family.

Short-prefix routes that receive a UUID-shaped input SHALL return 404 (or be normalized by route validation to a documented safe failure). Long-prefix routes that receive a slug-shaped input SHALL return 404. No route SHALL accept an id-or-slug mixed identifier.

#### Scenario: Short prefix rejects UUID-shaped input

- **WHEN** a viewer navigates to `/u/01h8e5g6t...` (a UUID-shaped value)
- **THEN** the route SHALL return 404 rather than resolving the value as a UUID

#### Scenario: Long prefix rejects slug-shaped input

- **WHEN** a viewer navigates to `/user/alice`
- **THEN** the route SHALL return 404 rather than resolving the value as a slug

### Requirement: Long-prefix typed UUID routes

The public URL surface SHALL expose long-prefix UUID routes for each of the five named slug scopes:

- `/user/:unitId` — resolves only `Unit.id` where `type = USER`
- `/realm/:unitId` — resolves only `Unit.id` where `type = REALM`
- `/tag/:unitId` — resolves only `Unit.id` where `type = TAG`
- `/zone/:unitId` — resolves only `Unit.id` where `type = ZONE`
- `/entity/:unitId` — resolves only `Unit.id` where `type = ENTITY`

Each route SHALL return 404 when the resolved Unit does not match the expected type.

`/unit/:unitId` SHALL remain the universal UUID fallback resolving any Unit by id; when the resolved Unit's type has a typed long-prefix route, the generic resolver MAY redirect to that typed route (matching the existing `?view` search-param convention).

#### Scenario: Typed long-prefix route resolves matching type

- **WHEN** a viewer navigates to `/user/<uuid>` and a USER Unit with that id exists
- **THEN** the route SHALL resolve that user

#### Scenario: Typed long-prefix route returns 404 for type mismatch

- **WHEN** a viewer navigates to `/user/<uuid>` and the Unit with that id has `type = TAG`
- **THEN** the route SHALL return 404

### Requirement: Owner-scoped sub-resource short-prefix routes

The public URL surface SHALL expose owner-scoped sub-resource short-prefix routes that combine an owner slug with a type-prefix segment and a sub-resource slug:

- `/u/:userSlug/profile` — explicit user profile card
- `/u/:userSlug/settings` — user backstage (self only)
- `/u/:userSlug/shelf/:slug` — user-owned shelf (system shelves only in v1)
- `/u/:userSlug/post/:slug` — user-authored post
- `/r/:realmSlug/post/:slug` — realm-hosted post
- `/r/:realmSlug/shelf/:slug` — realm-owned shelf (substrate only in v1; no shelves resolvable until a future change opens realm-owned shelf creation)

The type-prefix segment (`shelf/`, `post/`, …) SHALL always be present for owner sub-resources, so that the owner's reserved-word table stays small and future sub-resource types coexist without renaming.

#### Scenario: System shelf resolves under user owner

- **WHEN** a viewer navigates to `/u/alice/shelf/favorites`
- **AND** a SHELF Unit with `slug = "favorites"` and `slugScope = <alice-user-unit-id>` exists
- **THEN** the route SHALL resolve and render that shelf

#### Scenario: User-created shelf returns 404 in v1

- **WHEN** a viewer navigates to `/u/alice/shelf/my-custom-list`
- **AND** the user `alice` exists but no system shelf carries that slug
- **THEN** the route SHALL return 404 (user-created shelf slugs are not enabled in v1)
