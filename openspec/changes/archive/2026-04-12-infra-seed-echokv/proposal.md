## Why

The current seed system uses UUIDv5 to generate deterministic tag IDs at compile time (`@rezics/contract/seed-tags.ts`). This breaks the indexing characteristics of UUIDv7, which all `Unit.id` columns use via `dbgenerated("uuidv7()")`. The frontend imports these hardcoded IDs directly, creating a brittle coupling — any re-seed or new environment produces different database state than the constants expect.

Additionally, `tool/seed/cross-seed.ts` (the production-safe seed) only creates users. Infrastructure data required for the system to function — content-type tags and the default realm — lives exclusively in the mock seed path, which resets the entire database first.

## What Changes

- **BREAKING**: Remove `SEED_TAG_IDS` and all UUIDv5 generation from `@rezics/contract/seed-tags.ts`. Keep `SEED_TAG_NAMES`, `SeedTagName`, `SEED_TAG_TITLES`, and `SEED_TAG_SCORE`.
- Add infrastructure seeding to `tool/seed/cross-seed.ts`: content-type tags (book, game, media, post, link) and a default official realm, all with database-generated UUIDv7 IDs.
- After creating infrastructure entities, write their IDs into EchoKV under a single key (`infra:seed_tags`) so the frontend can resolve contract slugs to UUIDs at runtime.
- Seed a default realm (public, official) and store its ID in EchoKV (`infra:default_realm`).
- Update the mock seed to reuse the same infrastructure seeding logic rather than duplicating it.
- Update `CollectionModal.tsx` to fetch tag IDs from EchoKV instead of importing compile-time constants.

## Capabilities

### New Capabilities

- `infra-seed`: Infrastructure seeding for content-type tags and default realm via `tool/seed/cross-seed.ts`, with EchoKV registry (Option A: single map key per entity class).

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **`@rezics/contract`**: `seed-tags.ts` loses `SEED_TAG_IDS`, `uuidv5()`, `buildSeedTagId()`, `SEED_TAG_NAMESPACE`. Consumers importing `SEED_TAG_IDS` will break at compile time.
- **`tool/seed`**: `cross-seed.ts` gains infrastructure seeding steps. New `lib/seed-infra.ts` for tag + realm creation and EchoKV registration.
- **`@rezics/app`**: `CollectionModal.tsx` switches from compile-time `SEED_TAG_IDS` import to runtime EchoKV fetch.
- **`@rezics/api`**: May add a typed query helper for the infra EchoKV keys.
- **`package/server/prisma/seed/mock`**: `seed-tags.ts` and `seed.ts` updated to call shared infra seed logic instead of using hardcoded IDs.
- Backward-compatibility: no migration needed — this only affects seed-time data and frontend queries, not stored user data.
