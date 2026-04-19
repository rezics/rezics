## 1. Contract updates

- [ ] 1.1 Add `SEED_TAG_SLUGS: Record<SeedTagName, string>` to `package/contract/src/seed-tags.ts` with values `{ book: "book", game: "game", media: "media", post: "post", link: "link" }` and export it from `package/contract/src/index.ts`
- [ ] 1.2 Verify `DEFAULT_REALM.slug` is present in `package/contract/src/realm.ts` (already exists as `"rezics"` — no change, just confirmation)
- [ ] 1.3 Confirm `realmDTOSchema` exposes `slug` (already present in `package/contract/src/realm.ts`)
- [ ] 1.4 Confirm the tag DTO schema exposes `slug`; add the field to `package/contract/src/tag.ts` if missing
- [ ] 1.5 Confirm the zone DTO schema exposes `slug`; add the field to `package/contract/src/zone.ts` if missing
- [ ] 1.6 Add `InfraBootstrapResponse` schema in `package/contract/src/` (new file `infra.ts` or inline in an existing contract file) matching `{ seedTags: Partial<Record<SeedTagName, string>>, defaultRealmId?: string }`, and export it from the barrel
- [ ] 1.7 Run `bun run tsc --noEmit` in `package/contract` to verify

## 2. Server — shared infra seed module

- [ ] 2.1 Create `package/server/prisma/seed/infra/` directory
- [ ] 2.2 Create `package/server/prisma/seed/infra/seed-tags.ts` — port logic from `tool/seed/lib/seed-infra.ts` `seedContentTypeTags`, set `Unit.slug` from `SEED_TAG_SLUGS[name]`, match existing tags by slug rather than by translation title
- [ ] 2.3 Create `package/server/prisma/seed/infra/seed-default-realm.ts` — port logic from `tool/seed/lib/seed-infra.ts` `seedDefaultRealm`, set `Unit.slug = DEFAULT_REALM.slug`, match existing realm by slug first then fall back to `isOfficial: true`
- [ ] 2.4 Create `package/server/prisma/seed/infra/index.ts` exporting `seedInfra(prisma, rootUserId)` that runs tags then realm in order; delete any EchoKV writes
- [ ] 2.5 Update `package/server/prisma/seed/mocks/seed.ts` to call `seedInfra` as the new "Step 3: Infra" between "Users + Entities" and "Random tags"; remove EchoKV writes from `seedEchoKV` that duplicate infra keys
- [ ] 2.6 Remove `seedInfraEchoKV` invocation (and the function itself) wherever it exists in the mocks seed path
- [ ] 2.7 Run mocks seed locally (`bun --cwd package/server prisma:seed` or equivalent) and verify tags have slug set and default realm has slug `rezics`

## 3. Server — slug-based infra caches

- [ ] 3.1 Rewrite `package/server/src/infra/default-realm.ts` — `initDefaultRealmCache()` performs `prisma.unit.findUnique({ where: { slug: DEFAULT_REALM.slug } })` instead of EchoKV lookup; `getDefaultRealmId()` signature unchanged
- [ ] 3.2 Create `package/server/src/infra/seed-tags.ts` — `initSeedTagsCache()` looks up all five units by `SEED_TAG_SLUGS`, populates an in-memory map; `getSeedTagId(name: SeedTagName): string | null` sync accessor
- [ ] 3.3 Wire `initSeedTagsCache()` alongside `initDefaultRealmCache()` in the server startup sequence (find the existing caller in `package/server/src/index.ts` or equivalent bootstrap location)
- [ ] 3.4 Run `bun --cwd package/server tsc --noEmit` to verify

## 4. Server — API endpoints

- [ ] 4.1 Add `GET /infra/bootstrap` — new route module `package/server/src/infra/infra.api.ts` (mount in `src/index.ts`) returning `{ seedTags, defaultRealmId }`; source values from the startup caches (not live DB) for consistency
- [ ] 4.2 Add `GET /realm/by-slug/:slug` in `package/server/src/realm/realm.api.ts` — resolve unit by slug, 404 if not found or if `unit.type !== "REALM"`, otherwise return `RealmDTO`
- [ ] 4.3 Add `GET /tag/by-slug/:slug` in `package/server/src/tag/tag.api.ts` — resolve unit by slug, 404 if not found or if `unit.type !== "TAG"`, otherwise return tag DTO
- [ ] 4.4 Add `GET /zone/by-slug/:slug` in `package/server/src/zone/zone.api.ts` — resolve unit by slug, 404 if not found or if `unit.type !== "ZONE"`, otherwise return zone DTO
- [ ] 4.5 Extend the unit-slug type-gate validator (search for the current `TAG` | `REALM` check) to include `ZONE`
- [ ] 4.6 Add tests for each new endpoint covering happy path, not-found, and wrong-type-mismatch
- [ ] 4.7 Run `bun --cwd package/server test` for affected test files

## 5. Server — DB migration for existing infra units

- [ ] 5.1 Write a one-off SQL migration (new Prisma migration) that sets `Unit.slug = 'rezics'` on the existing official realm, and sets `Unit.slug` on each of the five seed tags (match by English translation title in `UnitTranslation`)
- [ ] 5.2 Guard the migration so re-runs are idempotent (`WHERE slug IS NULL`)
- [ ] 5.3 Apply the migration in a dev database and verify affected rows

## 6. Frontend — api layer

- [ ] 6.1 Create `package/api/src/infra/bootstrap.ts` — TanStack Query options `infraBootstrapQuery()` hitting `GET /infra/bootstrap`; localStorage key constant `rezics:infra:v1`; `SCHEMA_VERSION = 1`
- [ ] 6.2 Implement `useInfraBootstrap()` hook — loads initial value from localStorage synchronously, runs the query, writes fresh values back to localStorage on success, discards stale `schemaVersion` entries
- [ ] 6.3 Implement sync accessors `getDefaultRealmId()` and `getSeedTagId(name: SeedTagName)` reading from localStorage first, falling back to an in-memory mirror maintained by `useInfraBootstrap`
- [ ] 6.4 Implement `invalidateInfraCache()` — removes the localStorage key and clears the TanStack Query cache for the bootstrap query
- [ ] 6.5 Create `package/api/src/realm/useRealmBySlug.ts` — query hook + key factory for `GET /realm/by-slug/:slug`
- [ ] 6.6 Create `package/api/src/tag/useTagBySlug.ts` — query hook for `GET /tag/by-slug/:slug`
- [ ] 6.7 Create `package/api/src/zone/useZoneBySlug.ts` — query hook for `GET /zone/by-slug/:slug`
- [ ] 6.8 Delete the old EchoKV-based `package/api/src/infra/default-realm.ts` once callers are migrated (see step 7)
- [ ] 6.9 Run `bun --cwd package/api tsc --noEmit`

## 7. Frontend — call site migrations

- [ ] 7.1 Replace `echoKvGetQuery("infra:seed_tags")` in `package/app/src/collection/components/CollectionModal.tsx` with `getSeedTagId(filterTag)`; remove the `seedTagsData`/`seedTagIds` intermediates
- [ ] 7.2 Ensure `useInfraBootstrap()` is invoked once at app init (probably in the root provider tree of `package/app`); remove any `useInfraBootstrap` from the old EchoKV-based version if it exists
- [ ] 7.3 Search the frontend for any other `echoKvGetQuery("infra:*")` or direct `rezics:infra:default_realm_id` localStorage reads and migrate them
- [ ] 7.4 Update any score-submission form that uses the old `getDefaultRealmId()` to import from the new location if the module path changed
- [ ] 7.5 Run `bun --cwd package/app tsc --noEmit`

## 8. tool/seed orchestrator

- [ ] 8.1 Update `tool/seed/seed.ts` to import `seedInfra` from `@rezics/server` (or a relative path to `package/server/prisma/seed/infra/`) instead of `./lib/seed-infra`
- [ ] 8.2 Delete `tool/seed/lib/seed-infra.ts`
- [ ] 8.3 Run the tool/seed script against a dev database and verify users + infra seed successfully and EchoKV has no `infra:*` keys after the run

## 9. Cleanup and verification

- [ ] 9.1 Grep for any remaining references to `infra:seed_tags` or `infra:default_realm` in code (not in archived openspec) and remove them
- [ ] 9.2 Confirm EchoKV is only referenced for NoticeBoard, HomeCarousel, AnnouncementBar, and admin dashboard uses (`package/admin/src/misc/pages/EchokvEdit.tsx`)
- [ ] 9.3 Run `bun run check:convention` at the repo root
- [ ] 9.4 Run `bun run knip` at the repo root and address any newly-unused exports from the migration
- [ ] 9.5 Smoke test in the browser: app loads, `/infra/bootstrap` is called once, CollectionModal filter chips work, score submission picks up the default realm ID
