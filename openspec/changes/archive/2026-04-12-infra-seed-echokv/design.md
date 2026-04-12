## Context

The system uses UUIDv7 (`dbgenerated("uuidv7()")`) for all `Unit.id` primary keys, giving time-ordered, B-tree-friendly inserts. However, content-type seed tags currently use UUIDv5 constants generated at compile time in `@rezics/contract/seed-tags.ts`. The frontend imports these IDs directly (`SEED_TAG_IDS.book`) to filter shelves by content type.

`tool/seed/cross-seed.ts` is the production-safe seed entry point — it runs in all environments. Currently it only seeds users. Infrastructure data (tags, realm) lives in the mock-only seed path (`package/server/prisma/seed/mock/`), which resets the entire database first.

Tags support multilingual titles via `UnitTranslation`, so looking them up by title is language-dependent and fragile. A stable, language-neutral resolution mechanism is needed.

## Goals / Non-Goals

**Goals:**
- All `Unit.id` values are database-generated UUIDv7 — no application-side UUID generation
- Infrastructure entities (content-type tags, default realm) are seeded via `tool/seed/cross-seed.ts` in every environment
- Frontend resolves tag contract slugs (`"book"`, `"game"`, etc.) to UUIDs at runtime via EchoKV
- Seeding is idempotent — safe to run repeatedly without duplicating data

**Non-Goals:**
- Defining content publishing policy for the default realm (which content goes there)
- Auto-joining users to the default realm on registration (registration flow change)
- Adding new content-type tags beyond the existing five
- Changing the EchoKV API or schema

## Decisions

### D1: EchoKV as infrastructure ID registry (Option A — single map key)

Store all seed tag IDs under one EchoKV key `infra:seed_tags` as a JSON map:

```json
{ "book": "019...", "game": "019...", "media": "019...", "post": "019...", "link": "019..." }
```

Store the default realm ID under `infra:default_realm`:

```json
{ "id": "019..." }
```

**Why single key over per-tag keys:** The frontend needs all tag IDs together for filter chips. One fetch, one cache entry, no batch API needed. EchoKV queries already have a 2-hour `staleTime` — this data changes only at seed time.

**Alternative considered:** Per-tag keys (`infra:tag:book`, etc.) — rejected because it requires 5 fetches or a prefix-query pattern EchoKV doesn't support.

### D2: Tag lookup by name during seeding

The seed script finds existing tags by querying `UnitTranslation` where `language = "en"` and `title` matches the canonical English title. This is only used at seed time (a controlled, English-only operation), not at runtime.

```
Unit (type=TAG) → UnitTranslation (language="en", title="Book") → found → skip
                                                                → not found → create
```

**Why not a `slug` column on Unit:** Would require a migration for a field only used by infra seeding. The English title lookup is sufficient since seed tags are created once per environment by a controlled script.

### D3: Infrastructure seed as a shared module

Create `tool/seed/lib/seed-infra.ts` containing:
- `seedContentTypeTags(prisma)` — creates tags, returns name→ID map
- `seedDefaultRealm(prisma, systemUserId)` — creates the official realm, returns ID
- `seedInfraEchoKV(prisma, tagMap, realmId)` — writes both EchoKV entries

Both `tool/seed/cross-seed.ts` and `package/server/prisma/seed/mock/seed.ts` call this module. The mock seed no longer has its own `seed-tags.ts` — it imports from the shared path.

### D4: Default realm ownership

The default realm is owned by the root seed user (`root@rezics.com`). The seed script creates the realm after users, using the root user's ID. The realm is marked `isPublic: true` and `isOfficial: true`.

### D5: Frontend resolution via EchoKV query

`CollectionModal.tsx` fetches `echoKvGetQuery("infra:seed_tags")` and extracts the ID map. The query is cached for 2 hours (existing EchoKV staleTime). `SEED_TAG_NAMES` and `SEED_TAG_TITLES` remain as compile-time constants from `@rezics/contract` for rendering chip labels — only the UUID resolution moves to runtime.

Data flow:

```
┌──────────────┐     seed time      ┌──────────┐    upsert     ┌────────┐
│ cross-seed   │───────────────────▶│  Unit     │              │ EchoKV │
│              │  create tags       │  (TAG)    │              │        │
│              │  with DB v7 IDs    └──────────┘              │        │
│              │────────────────────────────────────────────▶  │        │
│              │  write infra:seed_tags = { book: id, ... }   │        │
└──────────────┘                                               └────┬───┘
                                                                    │
┌──────────────┐     runtime         GET /echokv/infra:seed_tags    │
│ Frontend     │◀───────────────────────────────────────────────────┘
│ Collection   │  { book: "019...", game: "019...", ... }
│ Modal        │  cached 2h via TanStack Query
└──────────────┘
```

## Risks / Trade-offs

- **[Risk] EchoKV unavailable at frontend load time** → The collection modal already handles loading states. Tag filter chips render from compile-time `SEED_TAG_NAMES`/`SEED_TAG_TITLES`; only the filtering logic waits for EchoKV. If the fetch fails, "All" filter still works (no filtering applied).

- **[Risk] Seed order dependency** → Tags and realm must be seeded after users (realm needs an owner). `cross-seed.ts` already seeds users first — infrastructure seeding runs as a subsequent step.

- **[Risk] Mock seed divergence** → If mock seed stops using the shared module, tag creation could drift. Mitigated by deleting `package/server/prisma/seed/mock/seed-tags.ts` entirely and importing from `tool/seed/lib/seed-infra.ts`.

- **[Trade-off] Extra network request on frontend** → One additional EchoKV fetch per session. Acceptable: small payload, 2-hour cache, only needed when the collection modal opens.
