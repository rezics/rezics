## ADDED Requirements

### Requirement: Server boot-time default realm cache

The server SHALL read the `infra:default_realm` key from EchoKV at startup and cache the realm ID in a module-level variable. A function `getDefaultRealmId()` SHALL return the cached ID synchronously.

If EchoKV does not contain the key (e.g., unseeded database), the server SHALL log a warning but SHALL NOT crash. `getDefaultRealmId()` SHALL return `null` in this case.

The cache module SHALL live at `package/server/src/infra/default-realm.ts`.

#### Scenario: Server starts with seeded database

- **WHEN** the server starts and `infra:default_realm` exists in EchoKV
- **THEN** `getDefaultRealmId()` returns the realm UUID string

#### Scenario: Server starts with empty database

- **WHEN** the server starts and `infra:default_realm` does not exist in EchoKV
- **THEN** the server logs a warning and `getDefaultRealmId()` returns `null`

### Requirement: Frontend localStorage infra persistence

The frontend app SHALL fetch `infra:default_realm` from EchoKV during app initialization and persist the realm ID in `localStorage` under the key `rezics:infra:default_realm_id`.

On subsequent loads, the app SHALL read from `localStorage` first. The EchoKV fetch (via TanStack Query) SHALL still run in the background to keep the value fresh, updating `localStorage` if the value changes.

#### Scenario: First app load — no cached value

- **WHEN** the app loads and `rezics:infra:default_realm_id` is not in `localStorage`
- **THEN** the app fetches from EchoKV, writes the ID to `localStorage`, and makes it available for scoring

#### Scenario: Subsequent app load — cached value exists

- **WHEN** the app loads and `rezics:infra:default_realm_id` exists in `localStorage`
- **THEN** the app uses the cached value immediately; a background EchoKV fetch updates it if changed

#### Scenario: localStorage unavailable

- **WHEN** `localStorage` is not available (e.g., private browsing restrictions)
- **THEN** the app falls back to reading from the TanStack Query cache for the EchoKV response

### Requirement: Synchronous default realm ID accessor

A utility function SHALL provide synchronous access to the default realm ID for use in form submissions and API calls. This function SHALL read from `localStorage` first, then fall back to any in-memory cache.

The utility SHALL live in `package/api/` or `package/app/` and be importable where scoring forms are composed.

#### Scenario: Score submission uses default realm ID

- **WHEN** a user submits a score without explicitly selecting a realm
- **THEN** the scoring form reads the default realm ID from the synchronous accessor and includes it in the `realm` field of the `UpsertScoreInput` payload
