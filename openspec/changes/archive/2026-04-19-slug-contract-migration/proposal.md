## Why

Infrastructure identifiers (seed tags, default realm) are currently resolved at runtime via EchoKV — a generic key-value store whose keys (`infra:seed_tags`, `infra:default_realm`) carry semantic meaning that rightfully belongs to the type system. Meanwhile, `Unit.slug` already exists as a globally unique, human-readable identifier, and `DEFAULT_REALM.slug = "rezics"` is defined in `@rezics/contract` but never actually written to the database. This creates three problems:

1. EchoKV is serving as an ad-hoc dictionary layer that slug already provides natively — an extra indirection with no durability benefit.
2. Seed tags cannot be referenced by slug in any context (search, URL routing, debugging) because they were created without slugs.
3. Several types (zone, realm) would benefit from stable by-slug lookup endpoints for URL routing and cross-boundary identification, but only a generic `/unit/by-slug` endpoint exists today.

Making slug a first-class identifier across `contract → server → frontend` removes the EchoKV indirection for infra, unlocks slug-based routing for tag/realm/zone, and collapses two overlapping identity systems into one.

## What Changes

- **Seed tags are created with slugs** (`book`, `game`, `media`, `post`, `link`) — the same values currently used as EchoKV dictionary keys, promoted to `Unit.slug`.
- **Default realm is created with slug `rezics`** as already defined in `DEFAULT_REALM.slug` (fixes the current silent gap where the contract value is ignored by the seed).
- **BREAKING**: EchoKV keys `infra:seed_tags` and `infra:default_realm` are removed — the infra seed no longer writes them. EchoKV remains for its legitimate uses (NoticeBoard, HomeCarousel, AnnouncementBar).
- **Infra seed logic moves** from `tool/seed/lib/seed-infra.ts` to `package/server/prisma/seed/infra/`. `tool/seed/seed.ts` continues as the cross-database orchestrator but imports the server-side infra module.
- **New `/infra/bootstrap` endpoint** — replaces two EchoKV fetches with one call returning `{ seedTags: Record<SeedTagName, string>, defaultRealmId: string }`.
- **New typed by-slug endpoints**: `/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug` — coexist with the generic `/unit/by-slug/:slug` (Option C: typed for known-type call sites, generic for URL routers).
- **Shelf is explicitly excluded** from slug support — shelves remain unitId-only.
- **Zone gains slug support** — extends `unit-slug`'s type gate from `{TAG, REALM}` to `{TAG, REALM, ZONE}`.
- **Frontend caching strategy formalized** — two tiers:
  - Tier 1: `/infra/bootstrap` → localStorage (`rezics:infra:v1`) with `schemaVersion`-based invalidation; sync accessors `getDefaultRealmId()` / `getSeedTagId(name)`.
  - Tier 2: ad-hoc slug lookups (realm/tag/zone) → standard TanStack Query entity cache; no independent slug→unitId dictionary.
- **CollectionModal migrates** from `echoKvGetQuery("infra:seed_tags")` to the Tier 1 infra cache.
- **Server-side `getDefaultRealmId()` source changes** from EchoKV lookup to slug lookup (`findBySlug("rezics")`) at startup; callers are unaffected.

## Capabilities

### New Capabilities

- `typed-slug-lookup`: Type-specific by-slug REST endpoints for realm, tag, and zone, plus the `/infra/bootstrap` endpoint that returns the pre-resolved infra slug→unitId dictionary.

### Modified Capabilities

- `infra-seed`: Tags and default realm are seeded with `Unit.slug` set from contract values; EchoKV registry writes are removed; seed logic relocates to `package/server/prisma/seed/infra/`.
- `default-realm-infra-bootstrap`: Server cache reads by slug instead of EchoKV; frontend bootstrap uses the new `/infra/bootstrap` endpoint and stores a versioned infra dictionary in localStorage covering both default realm and seed tags.
- `unit-slug`: Type gate expands from `{TAG, REALM}` to `{TAG, REALM, ZONE}`.

## Impact

**Affected packages**
- `package/contract` — add `SEED_TAG_SLUGS` constant; confirm tag/realm/zone DTOs expose `slug`.
- `package/server` — new `/infra/bootstrap`, `/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug` endpoints; rewrite `src/infra/default-realm.ts` to read by slug; move infra seed into `prisma/seed/infra/`; extend slug type-gate validation for ZONE.
- `package/api` — new `useInfraBootstrap` hook (replaces EchoKV-based version); new `useRealmBySlug`, `useTagBySlug`, `useZoneBySlug`, `useUnitBySlug` hooks; localStorage utilities with `schemaVersion`.
- `package/app` — `CollectionModal` switches to infra cache; any component using `echoKvGetQuery("infra:*")` is migrated.
- `tool/seed` — `seed.ts` imports from `@rezics/server` instead of local `lib/seed-infra.ts`; `lib/seed-infra.ts` is deleted.

**Database / data**
- One-off migration: `UPDATE unit SET slug='rezics' WHERE type='REALM' AND isOfficial=true`; update existing seed tag units to set `slug` from their English title. Dev environments can simply reseed.
- Prisma schema unchanged (`Unit.slug` already exists).

**Backward compatibility**
- **BREAKING** for any external consumer reading `infra:seed_tags` or `infra:default_realm` from EchoKV directly — these keys stop being written. Within the monorepo, all known consumers are migrated in this change.
- Existing `/unit/by-slug/:slug` endpoint and `useInfra*` hooks (localStorage-backed) continue to work during the migration window.

**Dependencies**
- No new external dependencies. The EchoKV TODO to migrate to unstorage is orthogonal and not addressed here.
