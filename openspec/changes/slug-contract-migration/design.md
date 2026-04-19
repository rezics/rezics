## Context

The platform currently maintains two parallel identity systems for infrastructure content:

1. **`Unit.slug`** — a globally unique, nullable, human-readable identifier. Already defined on the Unit model and type-gated (today) to `{TAG, REALM}`. `DEFAULT_REALM.slug = "rezics"` is declared in `@rezics/contract` but never written at seed time.
2. **`EchoKV` infra keys** — runtime dictionary entries (`infra:seed_tags`, `infra:default_realm`) that map well-known names (`book`, `game`, …) to database-generated UUIDs.

Both exist because seed tags receive DB-generated UUIDv7 at creation time, and the system needs a compile-time stable way to say "the book tag." EchoKV was chosen as the stable-name layer. In retrospect, `Unit.slug` already provides exactly this, with stronger guarantees (unique index, type-gated, validated).

This design consolidates the two systems onto slug, while preserving the runtime performance characteristic that unitId (a UUID primary key, used throughout foreign keys) is what actually flows through hot paths.

**Current data flow (to be replaced):**

```
seed time:   tag.create(...) → echoKV.set("infra:seed_tags", {book: uuid, ...})
server boot: echoKV.get("infra:default_realm") → cache in module var
frontend:    echoKvGetQuery("infra:seed_tags") → localStorage
business:    filter by tagUnitId (already correct)
```

**Stakeholders:** CollectionModal (currently fetches EchoKV for filtering), default-realm auto-join (reads from `getDefaultRealmId()` on server), any future surface that wants URL routing by slug for realm/zone.

## Goals / Non-Goals

**Goals:**
- Slug is the single durable identifier across the `contract → server → frontend` boundary for infra content.
- Infra seeding is owned by the `@rezics/server` package (beside the schema it writes to), not `tool/`.
- Frontend has one bootstrap round-trip on cold start; subsequent operations use unitId.
- Business-logic code paths (joins, filters, mutations) continue to use `unitId`; slug appears only at identity boundaries.
- Zone gains slug support symmetrically with tag/realm.
- Shelf is explicitly excluded from slug — its URL identity is not slug-based.

**Non-Goals:**
- Replacing EchoKV entirely. EchoKV remains for dynamic admin content (NoticeBoard, HomeCarousel, AnnouncementBar). The separate TODO to migrate EchoKV → unstorage is out of scope.
- Adding slug to shelf, user (User.slug already exists separately), or work types (book/game/media/post/link).
- Renaming or restructuring the existing `/unit/by-slug/:slug` endpoint — it stays as the generic fallback.
- Introducing a cross-session slug→unitId dictionary beyond the infra tier. Dynamic slug resolutions rely on natural react-query entity caching.

## Decisions

### D1. Slug values for seed tags = bare content-type names

The five content-type tags take slugs `book`, `game`, `media`, `post`, `link` — identical to the current `SEED_TAG_NAMES` entries.

**Rationale:** These values already appear in `RESERVED_SLUGS` precisely to reserve them from user registration. The point of reservation is to let the system claim them; honoring the contract now fulfills that reservation. Alternatives considered:

- Prefix `content-type-book` etc. — noisier and breaks reader's intuition that slugs match the reserved list.
- Symbolic prefixes like `@book` — fails slug format validation and complicates URL routing.

**Trade-off:** `Unit.slug` is globally unique across types. The tag `book` now occupies the slug `book` system-wide, which means no realm, zone, or other tag can ever claim it. This is desired behavior.

### D2. API design — typed + generic coexist (Option C)

Both endpoint families exist:

```
Typed (known type, business-logic call sites):
  GET /realm/by-slug/:slug   → RealmDTO
  GET /tag/by-slug/:slug     → TagDTO (TagUnitDTO)
  GET /zone/by-slug/:slug    → ZoneDTO

Generic (URL router, type unknown):
  GET /unit/by-slug/:slug    → { type, unit, extension } (already exists)
```

**Rationale:** URL routers receive a slug from the path without knowing which type it resolves to — the generic endpoint is essential there. But business components hitting `/realm/by-slug/rezics` already know they want a realm; forcing them through the generic endpoint means narrowing a union at every call site and degrading the TypeScript experience. Option A-only loses the URL router case; Option B-only forces unwanted type-narrowing at N call sites. Option C costs three more endpoints (thin wrappers over the same service method + type check) and buys clean ergonomics.

**Type check in typed endpoints:** each typed endpoint verifies the resolved Unit's `type` matches the endpoint's expected type, returning 404 otherwise (so `/realm/by-slug/book` returns 404 rather than an incompatible payload).

### D3. Infra bootstrap — single endpoint, only IDs

```
GET /infra/bootstrap
→ {
    seedTags: { book: string, game: string, media: string, post: string, link: string },
    defaultRealmId: string
  }
```

**Rationale:** Bootstrap's job is slug→unitId dictionary lookup — nothing more. Returning full DTOs here would:
- Duplicate data that the normal typed endpoints already serve (inconsistency risk).
- Make the endpoint grow unboundedly as more infra gets added.
- Couple bootstrap's response shape to translation/user/memberCount structures it shouldn't care about.

Consumers who need the full tag or realm object fetch it separately via `/tag/by-slug/:slug` or `/realm/:unitId` — those responses feed standard react-query cache.

**Alternative rejected:** two endpoints (`/infra/seed-tags`, `/infra/default-realm`). Saves no round-trips (both always needed at cold start) and doubles the cache invalidation surface.

### D4. Server-side infra cache — read by slug at startup, not lazy

`package/server/src/infra/default-realm.ts` retains the same public shape (`initDefaultRealmCache()`, `getDefaultRealmId(): string | null`), but `initDefaultRealmCache` now executes `prisma.unit.findUnique({ where: { slug: "rezics" } })` instead of an EchoKV fetch.

A parallel `package/server/src/infra/seed-tags.ts` caches the five tag IDs the same way:

```
initSeedTagsCache()         → reads 5 units by slug, populates in-memory map
getSeedTagId(name): string? → sync accessor, mirrors getDefaultRealmId
```

Both caches are populated from the `/infra/bootstrap` handler's service layer so the server's own lookup reuses the same slug→id path the frontend consumes.

**Rationale:** Matches the existing `default-realm.ts` pattern. Lazy resolution (fetch-on-first-call) complicates error paths (what if the tag doesn't exist at call time?) and the warm-cache cost is identical.

### D5. Frontend caching — two tiers, no unified dictionary

```
┌─ Tier 1: Infra dictionary ────────────────────────────────┐
│ Source:   GET /infra/bootstrap (once at app init)         │
│ Storage:  localStorage key "rezics:infra:v1"              │
│ Shape:    { schemaVersion, defaultRealmId, seedTags,      │
│             fetchedAt }                                   │
│ Accessors (sync):                                         │
│   getDefaultRealmId(): string | null                      │
│   getSeedTagId(name: SeedTagName): string | null          │
│ Invalidation:                                             │
│   - schemaVersion bump → drop and refetch                 │
│   - mutation hook signals "infra changed" → refetch       │
│   - Dev reseed + stale ID → API returns 404 → invalidate  │
│   - No TTL (infra IDs are stable in production)           │
└───────────────────────────────────────────────────────────┘

┌─ Tier 2: Dynamic entities ────────────────────────────────┐
│ Source:   useRealmBySlug, useTagBySlug, useZoneBySlug     │
│ Storage:  TanStack Query cache (session, in-memory)       │
│ Shape:    full DTO                                        │
│ Accessors: standard hook pattern                          │
│ Invalidation: standard react-query invalidation via       │
│               mutation hooks                              │
└───────────────────────────────────────────────────────────┘
```

**Rationale for no unified slug→unitId dictionary:** The proposed Tier 2 dictionary was considered and rejected. Every useXxxBySlug hook already returns the full DTO (which includes unitId); the dictionary would be redundant. Worse, a separate dictionary would need to handle slug rename/reassignment independently from the entity cache, creating stale-mapping bugs.

**Rationale for Tier 1 localStorage:** Sync accessors are required for non-React contexts (e.g., score submission forms that read `getDefaultRealmId()` outside hook scope). localStorage is the existing precedent (`rezics:infra:default_realm_id`). The `:v1` suffix in the key enables atomic schema migration — on version bump, the old key is orphaned (and eventually GC'd by the browser) rather than silently overwritten with incompatible shape.

### D6. Seed location and ownership

```
Before:
  tool/seed/lib/seed-infra.ts           ← logic here
  tool/seed/seed.ts                     ← orchestrator
  package/server/prisma/seed/mocks/seed.ts
    → imports nothing from infra seed   ← duplicated tag creation logic

After:
  package/server/prisma/seed/infra/
    ├── seed-tags.ts
    ├── seed-default-realm.ts
    └── index.ts                        ← exports seedInfra(prisma, rootUserId)
  tool/seed/seed.ts                     ← imports @rezics/server's seed/infra
  package/server/prisma/seed/mocks/seed.ts
    → imports same module               ← single source of truth
```

**Rationale:** Infra seed is schema-intimate (uses Unit, UnitTranslation, Realm, RealmMember models). Its home belongs next to the schema it mutates. `tool/seed` keeps its role as the cross-database orchestrator (it owns auth-db user creation) but delegates server-db work to the server package. This matches the existing `package/server/prisma/seed/mocks/` convention.

### D7. Unit.slug type gate extends to ZONE

The `unit-slug` spec's current requirement "Slug is type-gated to TAG and REALM" becomes "type-gated to TAG, REALM, and ZONE." Implementation is a single-line validator change.

**Rationale:** Zones are public, discoverable content blocks that benefit from stable URL identity. Shelf was considered but the user explicitly excluded it — shelves are personal/transient enough that slug-based URLs don't add value worth the namespace collision risk.

## Risks / Trade-offs

- **[Risk] Existing production data lacks infra slugs** → Mitigation: one-off SQL migration in the same deployment as the spec change: `UPDATE unit SET slug='rezics' WHERE type='REALM' AND "isOfficial"=true` and analogous for the five tags (matched by English translation title). Dev environments reseed.

- **[Risk] Slug `book` being claimed globally breaks a future feature that wants `book` for a different type** → Mitigation: `book` is already in `RESERVED_SLUGS`. Accepted as a deliberate trade-off; the reservation list was always intended for system use.

- **[Risk] Dev environment: reseed changes UUIDs, frontend localStorage caches stale IDs** → Mitigation: API responses include sufficient signal (404 on a cached-but-deleted realm ID) for the frontend to invalidate and refetch bootstrap. Explicit invalidation hook `invalidateInfraCache()` available for manual use. `schemaVersion` bumps are a separate mechanism for shape migrations.

- **[Risk] `getDefaultRealmId()` returns null if bootstrap fails or localStorage is unavailable** → Mitigation: existing callers (`auto-join`, `score submission`) already handle null. Preserved; no regression.

- **[Risk] EchoKV TODO (replace with unstorage) and this change conflict** → Mitigation: this change narrows EchoKV's responsibility (removes infra registry), which reduces the surface area unstorage migration must cover later. The two changes are orthogonal and non-conflicting.

- **[Trade-off] Typed + generic by-slug endpoints = more routes to maintain** → Accepted. Each typed endpoint is a ~10-line wrapper; the ergonomics win at business call sites is material.

- **[Trade-off] Tier 1 cache requires sync API** → Accepted. localStorage is the chosen mechanism; code that runs outside React (form submissions, axios interceptors) can read synchronously.

## Migration Plan

1. **Contract first** — add `SEED_TAG_SLUGS` constant and confirm `slug` presence on tag/realm/zone DTOs. Merge-able on its own.
2. **Server seed module** — add `package/server/prisma/seed/infra/`; mock-seed (`prisma/seed/mocks/seed.ts`) starts using it alongside the existing `tool/seed` path. Both produce identical results.
3. **Server API** — add `/infra/bootstrap`, `/realm/by-slug`, `/tag/by-slug`, `/zone/by-slug`; extend unit-slug validator for ZONE; rewrite `src/infra/default-realm.ts` to read by slug and add `src/infra/seed-tags.ts`.
4. **One-off DB migration** — set `slug` on the existing official realm and content-type tags. Idempotent SQL; safe to re-run.
5. **Frontend switchover** — new `useInfraBootstrap` hook (localStorage-backed), new `useXxxBySlug` hooks; `CollectionModal` and `package/api/src/infra/default-realm.ts` migrate off `echoKvGetQuery("infra:*")` calls.
6. **Remove writes** — `tool/seed/seed.ts` imports from `@rezics/server`; delete `tool/seed/lib/seed-infra.ts`. Seed no longer writes `infra:seed_tags` or `infra:default_realm` to EchoKV.
7. **Cleanup** — delete any lingering EchoKV read paths for infra keys. Confirm EchoKV is only used for NoticeBoard / HomeCarousel / AnnouncementBar.

**Rollback:** If the frontend cache proves unstable, revert step 5 only — the old `echoKvGetQuery` hooks continue to work as long as EchoKV writes are still in place. In practice, steps 2–4 are reversible via reseed; step 6 (EchoKV write removal) is the commit point.

## Open Questions

- **Should `/infra/bootstrap` be cache-busted via a version hash in the URL?** Current design relies on client-side `schemaVersion`. An alternative is a server-emitted bootstrap version (hash of infra IDs) returned in the response, letting the frontend compare and skip parsing if unchanged. Deferring until we see real cache-staleness reports.
- **Should `getSeedTagId(name)` be typed as `string` (non-null) after a guaranteed-initialized assertion, or stay `string | null`?** Leaning toward `string | null` for symmetry with `getDefaultRealmId()`, with an opt-in `requireSeedTagId()` for call sites that prefer to throw.
- **Should zone's existing URL routing adopt `/zone/:slug` immediately as part of this change, or wait for a follow-up?** Zone slug support is scoped here; zone URL routing migration can be sequenced separately to keep review scope tight.
