# default-realm Specification

## Purpose

Owns the cross-package lifecycle of the platform's default realm
("rezics"). Defines the `DEFAULT_REALM` constant and
`DefaultRealmDefinition` type exported by `@rezics/contract` (slug,
flags, per-language translations), the realm-level publishing
license default that flows into composer prefills, the server's
boot-time `getDefaultRealmId()` / `getSeedTagId()` caches and the
companion frontend `/infra/bootstrap` localStorage cache
(schema-versioned, 404-invalidated) with synchronous accessors and
the `useInfraBootstrap` hook, and the fire-and-forget auto-join
step in `/internal/users/provision` that adds every newly
provisioned user to the default realm via the cached id.

## Contract definition

### Requirement: Default realm definition in contract

`@rezics/contract` SHALL export a `DEFAULT_REALM` constant object that serves as the single source of truth for the default realm's configuration. The object SHALL include:

- `slug`: `"rezics"` — stable identifier across environments
- `isPublic`: `true`
- `isOfficial`: `true`
- `translations`: a record keyed by language code (`en`, `zh-hant`, `ja`) where each entry contains `title` (string) and `description` (string)

The `title` SHALL be `"rezics"` in all languages. The `description` SHALL be localized per language.

All fields and the object itself SHALL be documented with JSDoc.

The object SHALL be typed with `as const` for literal type inference.

#### Scenario: Importing DEFAULT_REALM from contract

- **WHEN** any package imports `DEFAULT_REALM` from `@rezics/contract`
- **THEN** it receives a typed constant with slug, flags, and translations for en, zh-hant, and ja

#### Scenario: Type-level language key access

- **WHEN** a consumer accesses `DEFAULT_REALM.translations["ja"]`
- **THEN** TypeScript resolves the type to `{ title: string; description: string }` without assertion

### Requirement: Default realm translation content

The `DEFAULT_REALM.translations` SHALL contain the following localized descriptions:

- **en**: A concise English description of the global community purpose
- **zh-hant**: A Traditional Chinese description matching the English meaning
- **ja**: A Japanese description matching the English meaning

Titles SHALL all be `"rezics"` (the project name is language-neutral).

#### Scenario: Seed reads translations from contract

- **WHEN** the seed script creates or updates the default realm
- **THEN** it uses `DEFAULT_REALM.translations` to create `UnitTranslation` rows for all three languages

### Requirement: Exported type for default realm

`@rezics/contract` SHALL export a `DefaultRealmDefinition` type derived from `typeof DEFAULT_REALM` so consumers can type parameters that accept the definition object.

#### Scenario: Typing a function parameter

- **WHEN** a function accepts the default realm definition as input
- **THEN** it can use `DefaultRealmDefinition` as the parameter type

### Requirement: Realm may define publishing license default
Realm metadata SHALL allow a realm to define an advisory default Unit publication license slug.

#### Scenario: Realm default is valid
- **WHEN** a realm stores a valid default license slug
- **THEN** composer flows in that realm MAY use it as their license prefill

#### Scenario: Realm default is invalid
- **WHEN** a realm update attempts to store an unknown default license slug
- **THEN** the server SHALL reject the update with a client error

### Requirement: Realm default overrides user default only as prefill
Realm publishing defaults SHALL override user publishing defaults only for initial composer state.

#### Scenario: User changes composer license
- **WHEN** a realm composer preloads the realm default license
- **AND** the user selects a different valid license before publishing
- **THEN** the created Unit SHALL store the user's selected license

## Infra bootstrap

### Requirement: Server boot-time default realm cache

The server SHALL look up the default realm by `Unit.slug = DEFAULT_REALM.slug` at startup and cache the realm ID in a module-level variable. A function `getDefaultRealmId()` SHALL return the cached ID synchronously.

If no unit matches the slug (e.g., unseeded database), the server SHALL log a warning but SHALL NOT crash. `getDefaultRealmId()` SHALL return `null` in this case.

The cache module SHALL live at `package/server/src/infra/default-realm.ts`.

#### Scenario: Server starts with seeded database

- **WHEN** the server starts and a `Unit` with `slug = "rezics"` and `type = REALM` exists
- **THEN** `getDefaultRealmId()` returns the realm UUID string

#### Scenario: Server starts with empty database

- **WHEN** the server starts and no unit with the default realm slug exists
- **THEN** the server logs a warning and `getDefaultRealmId()` returns `null`

### Requirement: Server boot-time seed tags cache

The server SHALL look up the five content-type tags by `Unit.slug` (matching `SEED_TAG_SLUGS` from `@rezics/contract`) at startup and cache the resolved unitIds in a module-level map. A function `getSeedTagId(name: SeedTagName): string | null` SHALL return the cached ID synchronously.

If any tag is missing, the server SHALL log a warning for that name and the accessor SHALL return `null` for it, without crashing.

The cache module SHALL live at `package/server/src/infra/seed-tags.ts`.

#### Scenario: Server starts with all seed tags present

- **WHEN** the server starts and all five seed tag units exist with their contract slugs
- **THEN** `getSeedTagId("book")` through `getSeedTagId("link")` each return their UUID

#### Scenario: Server starts with missing seed tag

- **WHEN** the server starts and the "media" seed tag does not exist
- **THEN** the server logs a warning for "media", and `getSeedTagId("media")` returns `null` while the other four accessors return their UUIDs

### Requirement: Frontend localStorage infra persistence

The frontend app SHALL fetch the `/infra/bootstrap` endpoint during app initialization and persist the response under the localStorage key `rezics:infra:v1` with the shape:

```json
{
  "schemaVersion": 1,
  "defaultRealmId": "<uuid>",
  "seedTags": { "book": "<uuid>", "game": "<uuid>", "media": "<uuid>", "post": "<uuid>", "link": "<uuid>" },
  "fetchedAt": <epoch-ms>
}
```

On subsequent loads, the app SHALL read from localStorage first (synchronously available to non-React callers). The bootstrap fetch via TanStack Query SHALL still run in the background to keep the value fresh, updating localStorage if values change.

If the persisted `schemaVersion` does not match the current expected version, the persisted entry SHALL be discarded and refetched.

#### Scenario: First app load — no cached value

- **WHEN** the app loads and `rezics:infra:v1` is not in localStorage
- **THEN** the app fetches `/infra/bootstrap`, writes the response to localStorage under that key, and makes the resolved IDs available to all consumers

#### Scenario: Subsequent app load — cached value exists

- **WHEN** the app loads and `rezics:infra:v1` exists with matching `schemaVersion`
- **THEN** the app uses the cached values immediately; a background `/infra/bootstrap` fetch updates the cache if server values differ

#### Scenario: Schema version mismatch

- **WHEN** the app loads and `rezics:infra:v1` exists but its `schemaVersion` does not match the code-side constant
- **THEN** the app discards the persisted entry and refetches from `/infra/bootstrap`

#### Scenario: localStorage unavailable

- **WHEN** localStorage is not available (e.g., private browsing restrictions)
- **THEN** the app falls back to the TanStack Query cache of the `/infra/bootstrap` response

### Requirement: Synchronous infra accessors

Utility functions SHALL provide synchronous access to infra unitIds for use in form submissions, API calls, and other non-React contexts. These functions SHALL read from localStorage first, then fall back to any in-memory cache populated by the TanStack Query bootstrap.

Required accessors:

- `getDefaultRealmId(): string | null`
- `getSeedTagId(name: SeedTagName): string | null`

The accessors SHALL live in `@rezics/api` (or a frontend-shared location) and be importable by any frontend package.

#### Scenario: Score submission uses default realm ID

- **WHEN** a user submits a score without explicitly selecting a realm
- **THEN** the scoring form reads the default realm ID from `getDefaultRealmId()` and includes it in the `realm` field of the `UpsertScoreInput` payload

#### Scenario: Collection modal filters by seed tag

- **WHEN** the user selects a content-type filter chip (e.g., "Book") in `CollectionModal`
- **THEN** the modal reads the tag unitId via `getSeedTagId("book")` and filters shelves by matching `tags[].tagUnitId`

#### Scenario: Accessor called before bootstrap completes

- **WHEN** `getDefaultRealmId()` is called during the brief window after app mount but before the first bootstrap fetch resolves
- **AND** no prior localStorage entry exists
- **THEN** the function returns `null`

### Requirement: Infra cache invalidation on stale ID

When an API request fails with a 404 whose target was resolved from the infra cache (e.g., a realm join using `getDefaultRealmId()`), the frontend SHALL invalidate the infra cache entry, refetch `/infra/bootstrap`, and surface the retry to the caller.

An explicit `invalidateInfraCache()` function SHALL also be exposed for manual use (development reseed workflows).

#### Scenario: Cached realm ID no longer exists on server

- **WHEN** a request using `getDefaultRealmId()` returns 404
- **THEN** the app clears `rezics:infra:v1` from localStorage, triggers a `/infra/bootstrap` refetch, and the caller may retry with the new ID

#### Scenario: Developer manually invalidates infra cache

- **WHEN** `invalidateInfraCache()` is called
- **THEN** the localStorage entry is removed and the next `useInfraBootstrap` invocation refetches from the server

### Requirement: Infra bootstrap hook wraps the endpoint

The frontend SHALL expose a single hook (`useInfraBootstrap`) that:

1. Reads the initial value from localStorage synchronously at mount.
2. Kicks off a TanStack Query fetch of `GET /infra/bootstrap`.
3. Writes fresh server values to localStorage on successful response.
4. Exposes the hydrated dictionary and loading state to callers that need reactive access.

Non-React callers SHALL use the synchronous accessors (`getDefaultRealmId`, `getSeedTagId`) instead of invoking the hook.

#### Scenario: App root mounts useInfraBootstrap

- **WHEN** the app root component mounts and invokes `useInfraBootstrap()` exactly once
- **THEN** the hook loads the cached infra dictionary, triggers a background refresh, and persists any updates to localStorage

#### Scenario: Non-React code path reads infra ID

- **WHEN** a non-React module (e.g., a form-submission helper) needs the default realm ID
- **THEN** it calls `getDefaultRealmId()` directly without invoking the hook

## Auto-join

### Requirement: Auto-join default realm on user provisioning

The `/internal/users/provision` endpoint SHALL add a fire-and-forget step after user upsert that joins the new user to the default realm. The join SHALL use the cached default realm ID from the server boot-time cache.

The auto-join SHALL NOT block the provisioning response. Failures (including duplicate membership errors) SHALL be caught and logged, not propagated.

#### Scenario: New user provisioned with default realm available

- **WHEN** a new user is provisioned via `/internal/users/provision` and the default realm ID is cached
- **THEN** the user is added as a `RealmMember` with `roleKey: "member"` and the provisioning response returns `{ ok: true }` without waiting for the join to complete

#### Scenario: Existing user re-provisioned

- **WHEN** an existing user is re-provisioned (upsert hits update path) and they are already a member of the default realm
- **THEN** the join attempt throws a unique constraint error, which is caught silently, and the provisioning response returns `{ ok: true }`

#### Scenario: Default realm ID not cached

- **WHEN** a user is provisioned but `getDefaultRealmId()` returns `null`
- **THEN** the auto-join step is skipped entirely and the provisioning response returns `{ ok: true }`

#### Scenario: Auto-join fails due to database error

- **WHEN** a user is provisioned and the realm join fails for any reason (network, constraint, etc.)
- **THEN** the failure is logged and the provisioning response still returns `{ ok: true }`
