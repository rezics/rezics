## ADDED Requirements

### Requirement: System-shelf-missing recovery toast

When any client-side mutation that depends on a system shelf returns an error with `code === "system_shelf_missing"`, the frontend SHALL surface a toast that:

- Names the affected shelf using the application's i18n table keyed on the `kindKey` reported by the error payload (e.g., `t('shelf.system.favorites')` → "Favorites" / "收藏").
- Exposes a `[Retry]` action that, when clicked, issues exactly one `POST /shelf/system/ensure { kindKey }` request.
- On a successful ensure response, invalidates the relevant `slugResolveQuery({ scope: viewer.unitId, slug: kindKey })` so subsequent reads pick up the new shelf id.
- Does NOT automatically re-issue the original mutation. The user is responsible for retriggering the original action (e.g., re-clicking ♡).

The toast SHALL NOT perform automatic retry, polling, or exponential backoff. The recovery flow is user-driven and observable.

#### Scenario: Toggle favorite on missing shelf surfaces retry toast

- **GIVEN** alice has no `favorites` system shelf (the orphan seed-fixture state)
- **WHEN** alice clicks the ♡ heart button on any unit
- **THEN** the `toggleFavorite` mutation SHALL reject with a 404 carrying `code: "system_shelf_missing"` and `kindKey: "favorites"`
- **AND** the UI SHALL display a toast naming the Favorites shelf with a `[Retry]` action
- **AND** the toast SHALL NOT automatically reissue the toggle-favorite request

#### Scenario: Retry action calls ensure exactly once and invalidates the slug cache

- **GIVEN** the recovery toast for the favorites shelf is visible
- **WHEN** alice clicks the `[Retry]` button in the toast
- **THEN** the client SHALL issue exactly one `POST /shelf/system/ensure { kindKey: "favorites" }` request
- **AND** on a 2xx response, the client SHALL invalidate `slugResolveQuery({ scope: alice.unitId, slug: "favorites" })`
- **AND** the toast SHALL close on success
- **AND** the client SHALL NOT automatically reissue the original toggle-favorite request

#### Scenario: Ensure failure surfaces a second toast, never auto-retries

- **WHEN** the `[Retry]` button is clicked and `POST /shelf/system/ensure` itself fails (e.g., network error)
- **THEN** the client SHALL surface a second toast with the same `[Retry]` action
- **AND** the client SHALL NOT enter an automatic retry loop, polling cycle, or exponential backoff

### Requirement: useSystemShelfRef exposes missing field

The client-side `useSystemShelfRef(kindKey)` hook SHALL expose a `missing: boolean` field in its return value, defined as `!isLoading && enabled && unitId === null`. UI code SHALL use this field (not raw `unitId === null`) to differentiate "viewer not logged in or still loading" from "viewer is authenticated and the system shelf is confirmed missing".

#### Scenario: Loading state is not flagged as missing

- **GIVEN** alice is logged in and the slug resolution query for `favorites` is in flight
- **WHEN** a component reads `useSystemShelfRef("favorites")`
- **THEN** the return SHALL be `{ isLoading: true, missing: false, unitId: null, ... }`

#### Scenario: Authenticated user without favorites shelf is flagged as missing

- **GIVEN** alice is logged in and her `favorites` shelf has been confirmed absent (slug resolution returned no row)
- **WHEN** a component reads `useSystemShelfRef("favorites")`
- **THEN** the return SHALL be `{ isLoading: false, missing: true, unitId: null, ... }`

#### Scenario: Unauthenticated viewer is not flagged as missing

- **GIVEN** the viewer is unauthenticated
- **WHEN** a component reads `useSystemShelfRef("favorites")`
- **THEN** the return SHALL be `{ isLoading: false, missing: false, unitId: null, ... }`

## MODIFIED Requirements

### Requirement: System shelf id resolution on the client

The client SHALL resolve the four system shelf unit ids (`favorites`, `backlog`, `active`, `completed`) for the current user through the standard SlugRef path provided by `slug-ref` and `typed-slug-lookup`. For each system `kindKey`, the resolution SHALL be expressed as `useSlugRef({ scope: viewer.unitId, slug: kindKey })` (or an equivalent `GET /shelf/by-slug/:userSlug/:slug` typed call), returning the `Unit.id` of the corresponding `SHELF` Unit. The user DTO (`/user/me` and related responses) SHALL NOT carry a `systemShelves` map; the SlugRef cache is the canonical client-side resolution store.

When a slug resolution returns no row for an authenticated user (the orphan state observable as `useSystemShelfRef(kindKey).missing === true`, or surfaced indirectly via a mutation 404 with `code: "system_shelf_missing"`), the client SHALL NOT silently lazy-create the shelf in the background. Recovery SHALL flow through `POST /shelf/system/ensure` only, and only on explicit user action (e.g., a `[Retry]` button in a toast). The client SHALL NOT carry an automatic ensure-on-missing branch.

#### Scenario: Client resolves a system shelf id via SlugRef

- **WHEN** the client needs the unit id of the viewer's `backlog` shelf
- **THEN** the client SHALL issue `useSlugRef({ scope: viewer.unitId, slug: 'backlog' })`
- **AND** the resolved id SHALL come from the standard SlugRef query cache shared with every other slug-bearing Unit

#### Scenario: System shelf id resolution survives across the session

- **WHEN** the client resolves a system shelf id once during a session
- **THEN** subsequent reads SHALL be served from the SlugRef cache without re-issuing a network request
- **AND** invalidation SHALL follow the SlugRef cache's own rules, not a system-shelf-specific TTL

#### Scenario: Missing system shelf is observable but never auto-healed

- **WHEN** the client attempts to resolve a system shelf for a user whose corresponding shelf row is missing (orphan state)
- **THEN** `useSystemShelfRef(kindKey)` SHALL return `missing: true` with `unitId: null`
- **AND** the client SHALL NOT issue an ensure request in the background
- **AND** recovery SHALL be initiated only by user action (the `[Retry]` button in a `system_shelf_missing` toast or an equivalent explicit affordance)
