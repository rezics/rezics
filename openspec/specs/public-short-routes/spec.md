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

### Requirement: Link builders prefer short-prefix slug URLs when slug is known

UI link builders that produce hrefs to slug-bearing Unit types (USER, REALM, TAG, ZONE, ENTITY, and owner-scoped SHELF) SHALL render the short-prefix slug URL whenever the target unit carries a slug, and SHALL fall back to the long-prefix unitId URL when the slug is absent. Link builders SHALL NOT render the long-prefix unitId URL when a slug is known.

This rule applies to every link-build site in the application — including profile menus, author bylines, tag chips, realm cards, entity references, hover previews, navigation tabs, search-result links, and post/comment/excerpt embeds. It does not apply to viewer-relative shorthand routes under `/user/me/*`, which are owner-bound surfaces (settings, edit-self, private bookmarks/follows/reactions) and continue to be linked by their `/user/me/...` path.

The application SHALL provide a single sanctioned helper for computing these hrefs (signature: `unitHref({ type, unitId, slug })` with a SHELF variant taking owner context). Link-building call sites SHALL route through this helper rather than constructing paths inline.

#### Scenario: Linking to a user with a slug

- **WHEN** a component builds an href to a USER unit whose DTO carries `slug = "alice"` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/u/alice`
- **AND** the rendered `<Link>` SHALL navigate to the short-prefix slug route

#### Scenario: Linking to a user without a slug

- **WHEN** a component builds an href to a USER unit whose DTO carries `slug = null` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/user/u-1`
- **AND** the rendered `<Link>` SHALL navigate to the long-prefix unitId route

#### Scenario: Header AccountMenu profile entry resolves slug-first

- **GIVEN** a viewer whose USER unit has `slug = "alice"`
- **WHEN** the header AccountMenu renders the profile menu item
- **THEN** the menu item's href SHALL be `/u/alice`
- **AND** the address bar after click SHALL show `/u/alice`, not `/user/<uuid>`

#### Scenario: Header AccountMenu profile entry falls back when no slug

- **GIVEN** a viewer whose USER unit has `slug = null` and `unitId = "u-9"`
- **WHEN** the header AccountMenu renders the profile menu item
- **THEN** the menu item's href SHALL be `/user/u-9`

#### Scenario: Linking to a system shelf under a slugged user

- **WHEN** a component builds an href to a SHELF unit with `slug = "favorites"`, `unitId = "s-7"`, owned by a USER unit with `slug = "alice"` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/u/alice/shelf/favorites`

#### Scenario: Linking to a shelf whose owner has no slug

- **WHEN** a component builds an href to a SHELF unit with `slug = null`, `unitId = "s-7"`, owned by a USER unit with `slug = null` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/shelf/s-7`

#### Scenario: Viewer-relative settings routes remain on `/user/me/*`

- **WHEN** the header AccountMenu renders the settings menu item
- **THEN** the menu item's href SHALL be `/user/me/setting/profile`
- **AND** the helper SHALL NOT be used for this destination (settings is viewer-relative, not a public profile link)

#### Scenario: Long-prefix UUID URL is never rendered when a slug is known

- **GIVEN** a TAG DTO with `slug = "sci-fi"` and `unitId = "t-3"`
- **WHEN** any link-build site references that tag
- **THEN** the rendered href SHALL be `/t/sci-fi`
- **AND** the rendered href SHALL NOT be `/tag/t-3`

### Requirement: Data queries prefer unitId-keyed endpoints

When the application has access to a unit's `unitId`, downstream data queries SHALL use unitId-keyed endpoints (`byId(unitId)`-style query options) rather than re-resolving the slug. Slug-resolution endpoints (`/slug/resolve`, `/user/by-slug`, `/realm/by-slug`, `/tag/by-slug`, `/zone/by-slug`, `/entity/by-slug`, `/shelf/by-slug`) SHALL only be invoked when the caller starts from a slug without an accompanying unitId — typically a route loader translating a URL param into a resolved DTO.

Once a slug route loader has resolved a DTO, child routes and child components SHALL read the resolved `unitId` from the loader data (or its routed query cache) and SHALL NOT redundantly call a by-slug endpoint to obtain the same unitId.

#### Scenario: Slug route loader resolves once

- **WHEN** a viewer navigates to `/u/alice`
- **THEN** the route loader SHALL call `/user/by-slug/alice` to resolve the USER DTO
- **AND** child components rendering followers, shelves, posts, or other resources SHALL consume the resolved `unitId` from the loader DTO via unitId-keyed queries
- **AND** no child SHALL re-call `/user/by-slug/alice` or `/slug/resolve` for the same user

#### Scenario: unitId route uses unitId-keyed queries directly

- **WHEN** a viewer navigates to `/user/u-1`
- **THEN** all data queries on that page SHALL use unitId-keyed endpoints
- **AND** no slug-resolution endpoint SHALL be called

#### Scenario: A page holding a resolved DTO links onward to a sub-resource

- **GIVEN** a page that has resolved the USER DTO for "alice" (`unitId = "u-1"`, `slug = "alice"`)
- **WHEN** the page renders a link to alice's favorites shelf
- **THEN** the href SHALL be built via the link helper using both the slug and the unitId already in scope
- **AND** the page SHALL NOT additionally call any slug-resolution endpoint to construct that href

### Requirement: API responses include known slugs for slug-bearing unit references

When a public API response returns a Unit DTO or embedded Unit reference for a slug-bearing type (USER, REALM, TAG, ZONE, ENTITY, or owner-scoped SHELF), the backend SHALL include the target's `slug` alongside its `unitId` whenever that slug is already available in the mapper input or can be obtained through the current query shape or a bounded batch lookup.

This is an opportunistic-but-systematic response policy, not a hard availability guarantee. Responses MAY omit `slug` or return it as null/undefined when the target has no slug, when the response starts from a bare unitId that is not otherwise hydrated, when the slug lives across a service boundary, or when hydrating it would require an expensive per-row lookup. Clients SHALL continue to treat slug as optional and SHALL fall back to the long-prefix unitId URL through the sanctioned link helper.

#### Scenario: Review author response includes known USER slug

- **GIVEN** a review/post response embeds an `author` reference with `unitId = "u-1"`
- **AND** the author USER unit has `slug = "alice"`
- **WHEN** the backend maps the review/post DTO and can load the author USER unit slug through the post query or a bounded batch lookup
- **THEN** `author.slug` SHALL be `"alice"`
- **AND** a client rendering the author byline can produce `/u/alice` without issuing a separate slug-resolution query

#### Scenario: Embedded reference falls back when slug is not reasonably available

- **GIVEN** a response contains only a bare `unitId` for a slug-bearing target
- **AND** hydrating the target slug would require an additional per-row lookup or a cross-boundary reverse lookup
- **WHEN** the backend maps the response
- **THEN** the response MAY omit `slug`
- **AND** the client SHALL use the long-prefix unitId URL fallback

#### Scenario: Full slug-bearing DTO returns its own slug when present

- **GIVEN** a full DTO for a slug-bearing Unit type has access to the backing `Unit.slug`
- **WHEN** the backend returns the DTO
- **THEN** the DTO SHALL include `slug`
