## Context

The platform already supports realm-less content structurally — `RealmUnit` is a many-to-many join table, and content can exist without any realm association. However, the default realm concept is ad-hoc: the seed creates an official realm with hardcoded strings, stores its ID in EchoKV, and there's no contract-level definition. The frontend has no standard way to know the default realm ID for scoring.

Current state:
- `tool/seed/lib/seed-infra.ts` creates the official realm with zh-Hant and en translations
- EchoKV stores `infra:default_realm: { id }` — but only after seeding
- `ScoreEntry.realm` is required (UUID) — the frontend must provide it
- `/internal/users/provision` creates the user but does not join them to any realm
- The frontend has no infra bootstrap layer for caching infrastructure IDs

## Goals / Non-Goals

**Goals:**
- Define the default realm as a typed, JSDoc-documented object in `@rezics/contract` with translations for en, zh-Hant, and ja
- Seed reads from the contract as the single source of truth
- Server caches the default realm ID at boot from EchoKV
- New users auto-join the default realm during provisioning (non-blocking)
- Frontend persists the default realm ID in `localStorage` and uses it for scoring

**Non-Goals:**
- Changing the scoring contract — `realm` stays required in `UpsertScoreInput`
- Building a realm-subscription/preference system (future work)
- Rendering realm-specific scores on book pages (future work)
- Forcing existing content into the default realm via `RealmUnit`

## Decisions

### 1. Contract-level `DEFAULT_REALM` object

**Decision:** Define `DEFAULT_REALM` as a `const` object in `package/contract/src/realm.ts` with slug, flags, and a `translations` record keyed by language code. Each translation has `title` and `description`. All documented with JSDoc.

**Why:** The contract is already the shared type layer across all packages. Placing the definition here means the seed, server, and frontend all import from the same source. No risk of drift between what's seeded and what the frontend expects.

**Alternative considered:** Define in the seed only, query from DB at runtime. Rejected because it adds unnecessary DB dependency for static data that changes only at deploy time.

### 2. EchoKV stores only `{ id }`, not content

**Decision:** The `infra:default_realm` EchoKV entry stores only `{ id: string }`. The contract holds the canonical translations and config.

**Why:** EchoKV is an ID registry, not a content store. Storing content creates a stale-cache problem — if translations change in the contract, the EchoKV copy would be out of date until re-seeded. Keeping it to just the ID means the contract is always authoritative.

### 3. Server boot-time cache

**Decision:** At server startup, read `infra:default_realm` from EchoKV and cache the ID in a module-level variable. The provisioning endpoint reads from this cache.

**Why:** The provisioning endpoint is called on every new user registration. Querying EchoKV each time is unnecessary since the default realm ID never changes at runtime. A single boot-time read is sufficient.

**Integration:** Create a small module (e.g., `package/server/src/infra/default-realm.ts`) that exports `getDefaultRealmId(): string` and an `initDefaultRealmCache(): Promise<void>` called at server startup.

### 4. Fire-and-forget auto-join

**Decision:** After `prisma.user.upsert` succeeds in the provisioning endpoint, call `realmService.joinRealm(defaultRealmId, unitId)` wrapped in `.catch(() => {})`. This is non-blocking and failure-tolerant.

**Why:** Realm membership is not critical to user creation. If it fails (e.g., user already a member from a previous partial provision), the user can still use the platform. The join can be retried or fixed later.

**Edge case:** The `upsert` may hit the `update: {}` path for an existing user. In that case, `joinRealm` will throw a unique constraint error (already a member), which is safely caught and ignored.

### 5. Frontend `localStorage` infra cache

**Decision:** Add an infra bootstrap step in the app initialization that fetches `infra:default_realm` from EchoKV, extracts the ID, and writes it to `localStorage`. A utility function reads it back synchronously when needed (e.g., when submitting a score).

**Why:** The frontend needs the default realm ID synchronously in form submissions. `localStorage` provides synchronous reads. The EchoKV query already has a 2-hour `staleTime`, and `localStorage` persistence means it survives page reloads without re-fetching.

**Integration:** Extend `package/app/src/app/provider/useAppInit.ts` or create a dedicated `useInfraBootstrap` hook. Store under a namespaced key like `rezics:infra:default_realm_id`.

## Risks / Trade-offs

- **[Boot-time EchoKV dependency]** If EchoKV is empty (fresh DB, no seed), the server has no default realm ID. → Mitigation: Log a warning at boot but don't crash. The provisioning auto-join gracefully skips if no ID is cached.
- **[localStorage unavailable]** Some browsers in private mode may restrict `localStorage`. → Mitigation: The scoring UI can fall back to fetching from the EchoKV query cache (TanStack Query already caches it). This is a degraded path, not a blocker.
- **[Seed idempotency with new language]** Adding ja translation to an existing realm requires checking if the translation row already exists. → Mitigation: The seed already uses `findFirst` + skip pattern; extend it to upsert translations.
