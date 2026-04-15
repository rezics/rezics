## Why

Content is currently not required to belong to a realm (the `RealmUnit` join table is many-to-many and optional), but there is no formalized default realm concept in the contract layer, no auto-join for new users, and the seed creates the official realm with only two language translations. The scoring system requires a realm ID but the frontend has no reliable way to know the default realm's ID without an extra API call.

This change formalizes the default realm as a contract-level constant, enables realm-less content as a first-class concept, and wires up the infrastructure so the frontend can score content against the default realm without extra round-trips.

## What Changes

- Add a `DEFAULT_REALM` object to `@rezics/contract` with slug, flags, and translations (en, zh-Hant, ja) documented with JSDoc
- Update the seed script to import from the contract and create all three translation rows
- EchoKV `infra:default_realm` stores only `{ id }` — the contract is the source of truth for content
- Server caches the default realm ID from EchoKV at boot time
- The provisioning endpoint (`/internal/users/provision`) adds a fire-and-forget step to join new users to the default realm (non-blocking, failure-tolerant)
- Frontend fetches and persists the default realm ID in `localStorage` as part of infra bootstrap, uses it when submitting scores
- `score.ts` contract is **unchanged** — `realm` stays required; the frontend always provides it

## Capabilities

### New Capabilities
- `default-realm-contract`: Contract-level default realm definition with i18n translations and JSDoc
- `default-realm-infra-bootstrap`: Server boot cache and frontend localStorage persistence of default realm ID
- `default-realm-auto-join`: Auto-join new users to default realm during provisioning (fire-and-forget)

### Modified Capabilities
- `infra-seed`: Seed reads default realm definition from contract; creates 3 language translations instead of 2

## Impact

- **`package/contract`**: New exports in `realm.ts` — `DEFAULT_REALM` object and its type
- **`package/server`**: Boot-time EchoKV lookup for default realm ID; provisioning endpoint adds realm join step
- **`package/app`**: Infra bootstrap fetches and caches default realm ID in `localStorage`; scoring flows read from cache
- **`package/api`**: May add a typed helper for reading infra from `localStorage`
- **`tool/seed`**: `seed-infra.ts` imports from contract, creates ja translation row
- No breaking changes — existing APIs and schemas are unchanged
- No migration needed — seed is idempotent and additive
