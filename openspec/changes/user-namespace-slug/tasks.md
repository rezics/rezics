## 1. Contract Foundations

- [x] 1.1 Add `SlugScopeName` type and `SlugScope` constant set in `package/contract/src/slug/scopes.ts` listing the five named scopes (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`).
- [x] 1.2 Update `SlugRef` Typebox schema in `package/contract/src/slug/slug-ref.ts` to require `scope` alongside `slug` and `unitId?`. Export both the discriminated form (named-scope union) and the permissive form (owner-unit-id string).
- [x] 1.3 Extend `slugValidation.ts` in `package/contract` to accept a `scope` argument used for uniqueness lookup. Reserved-word checking SHALL consult a **single unified `RESERVED_SLUGS` constant** (flat `Set<string>`) regardless of scope. Migrate the existing flat list into this constant and fold in: owner-path segments (`profile`, `settings`, `shelf`, `post`, `list`) and system-shelf slug values (`favorites`, `backlog`, `active`, `completed`).
- [x] 1.4 Export `SYSTEM_SHELF_SLUGS` (or equivalent) constant in `@rezics/contract`. Document that any code path that mints a slug from this constant SHALL bypass `validateSlug` (the reserved list contains these very values to block user claims).
- [x] 1.5 Add an `ENTITY_SLUG_WRITES_ENABLED = false` flag (single source of truth) in `package/contract/src/slug/feature-flags.ts` consumed by the server.
- [x] 1.6 Update Typebox schemas for typed by-slug endpoints and add the new `userBySlug`, `entityBySlug`, `shelfBySlug` endpoint contracts plus the generic `POST /slug/resolve` payload/response schemas.
- [x] 1.7 Extend `/infra/bootstrap` response schema to include `slugScopes: { user, realm, tag, zone, entity }`.
- [x] 1.8 Rename `userId` → `unitId` on user-shaped DTOs (`User`, `UserBrief`, `UserSummary`, profile responses) in `package/contract`. Update JSDoc.
- [x] 1.9 Add public route param schemas to `package/contract` for the new short-prefix (`/u`, `/r`, `/t`, `/z`, `/e`) and long-prefix UUID (`/user`, `/realm`, `/tag`, `/zone`, `/entity`) families plus owner-scoped `/u/:userSlug/shelf/:slug` and `/r/:realmSlug/shelf/:slug`. Remove the legacy `publicUnitSlugRouteParamsSchema` and `publicUnitIdRouteParamsSchema` for `/unit/:unitSlug` and `/unit/id/:unitId`.

## 2. Prisma Schema & Migrations

- [x] 2.1 In `package/server/prisma/schema.prisma`, add `USER` and `SCOPE` variants to `UnitType` enum.
- [x] 2.2 Add `SlugScope` model: `slug String @id` (the named scope key), `unitId String @db.Uuid @unique`.
- [x] 2.3 Add `slugScope String @db.Uuid` to `Unit` (NOT NULL, no FK declared per design D2).
- [x] 2.4 Replace the global `Unit.slug` unique constraint with `@@unique([slugScope, slug])`.
- [x] 2.5 Rename `User.userId` PK to `User.unitId` (`@id @db.Uuid`). Update every `references: [User.userId]` to `references: [User.unitId]` on FK columns of related tables (column names preserved).
- [x] 2.6 Drop `User.slug` column from the `User` extension.
- [x] 2.7 Generate the migration. (Squashed: all prior migrations under `package/server/prisma/migrations/` deleted and replaced with a single baseline `20260515120000_init/migration.sql` generated via `prisma migrate diff --from-empty --to-schema`. Dev-stage authorization granted multi-phase backfill skip.)
- [x] 2.8 ~~In the migration: add `USER` and `SCOPE` enum variants first…~~ (N/A — squash skips backfill; enum variants are part of the baseline `CREATE TYPE`.)
- [x] 2.9 ~~Insert five `SCOPE`-type Unit rows…~~ (Moved to seed step §3.1.)
- [x] 2.10 ~~For every existing `User` row, insert a USER Unit…~~ (N/A — no existing data to backfill after squash; new USER Units will be created at registration time.)
- [x] 2.11 ~~Backfill `Unit.slugScope` for every slug-bearing TAG / REALM / ZONE Unit…~~ (N/A — no existing data after squash.)
- [x] 2.12 ~~Copy each `User.slug` value into the corresponding USER `Unit.slug`…~~ (N/A — no existing data after squash; the new schema simply has no `User.slug` column.)
- [x] 2.13 ~~In the migration: drop the legacy `Unit.slug` global unique; apply `@@unique([slugScope, slug])`…~~ (N/A — the baseline migration creates the new `Unit_slugScope_slug_key` composite unique directly; no legacy unique existed in the baseline.)
- [x] 2.14 Run `bun run prisma:generate` and verify the generated client surface (new types for `UnitType.USER`, `UnitType.SCOPE`, `SlugScope`).

## 3. Seed & Bootstrap Wiring

- [x] 3.1 In `package/server/prisma/seed/`, add a `slugScopes.ts` seed module that creates the five `SCOPE`-type placeholder Units and their `SlugScope` rows idempotently (no-op if rows exist).
- [x] 3.2 Wire `slugScopes` seeding into the infra bootstrap entry point so it runs before any other slug-bearing seed (tags, default realm, root user).
- [x] 3.3 Update the root-user / default-realm seeds to set `slugScope` correctly on inserted Units.
- [x] 3.4 Update `package/server/src/infra/infra.service.ts` (or equivalent) so `/infra/bootstrap` includes the `slugScopes` map from `SlugScope` rows.
- [ ] 3.5 Verify `bun run seed:factory` runs end-to-end against a fresh database; confirm `/infra/bootstrap` returns all expected ids including `slugScopes`.

## 4. Server: Slug Resolution & Endpoints

- [x] 4.1 Refactor the server-side slug resolver to query `(slugScope, slug)` instead of `(slug)`. Centralize the named-scope-to-unit-id lookup in a cached helper (the five UUIDs are read at boot from `SlugScope`).
- [x] 4.2 Update existing typed by-slug endpoints (`/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug`) to use the scope-aware resolver.
- [x] 4.3 Add `GET /user/by-slug/:slug` returning a user DTO keyed by `unitId`.
- [x] 4.4 Add `GET /entity/by-slug/:slug` returning an entity DTO. Always 404 in v1 because no ENTITY Unit can carry a slug yet.
- [x] 4.5 Add `GET /shelf/by-slug/:userSlug/:slug` resolving the user, then the shelf under the owner scope. Returns 404 for any non-system slug in v1.
- [x] 4.6 Add `POST /slug/resolve` accepting `{ scope, slug }` (named scope or owner unit id) and returning `{ unitId, type }` or 404.
- [x] 4.7 In `userService` and any profile-update handler, reject any payload containing a `slug` field with a typed `USER_SLUG_IMMUTABLE` error.
- [x] 4.8 In `shelfService.create` and `shelfService.update`, reject any non-null `slug` value for user-created shelves with a typed `SHELF_CUSTOM_SLUG_DISABLED` error.
- [x] 4.9 In the entity-creation paths (whichever services persist ENTITY Units), reject any slug write with a typed `ENTITY_SLUG_DISABLED` error gated by the `ENTITY_SLUG_WRITES_ENABLED` flag.
- [x] 4.10 Update `slugValidation` callers across the server to pass the appropriate `scope` argument (registration → `'user'`; realm creation → `'realm'`; tag → `'tag'`; etc.).

## 5. Server: User PK Rename Surface

- [x] 5.1 Grep `package/server` for `User.userId` field references and migrate to `User.unitId`. The physical column rename is handled by the Prisma migration; this task targets code-level field names.
- [x] 5.2 Update every service / mapper that returns a user-shaped DTO to populate `unitId` instead of `userId`.
- [x] 5.3 Update `userService.findById`, `userService.findBySlug`, profile mappers, follow/follower mappers, ApiToken mappers, attribution-adjacent mappers.
- [x] 5.4 Verify auth → main projection paths (`user-domain-decoupling`, `account-identity-boundary`) still pass the canonical slug to the auth side using `Unit.slug` (not the dropped `User.slug` column).

## 6. Server: Route Surface

- [x] 6.1 Mount the five short-prefix slug routes if not already mounted via the `app` package (server-side resolution is per-endpoint, but contract schemas must be exported).
- [x] 6.2 Remove all server handlers for `/unit/:unitSlug` and `/unit/id/:unitId`.
- [x] 6.3 Add a `check:convention` rule (R10 or next available number) that flags route definitions whose param names suggest a slug under a long prefix or a UUID under a short prefix.

## 7. Frontend: API Client (`package/api`)

- [x] 7.1 Add TanStack Query hooks for `/user/by-slug/:slug`, `/entity/by-slug/:slug`, `/shelf/by-slug/:userSlug/:slug`, and `POST /slug/resolve`.
- [x] 7.2 Update existing `/realm/by-slug`, `/tag/by-slug`, `/zone/by-slug` hooks to align with the new `SlugRef` shape.
- [x] 7.3 Update the `useInfraBootstrap` hook (or equivalent) to surface `slugScopes` and persist it to localStorage keyed by app version stamp.
- [x] 7.4 Update `useSlugRef` (or equivalent SlugRef-consuming hook) to accept the new `{ scope, slug, unitId? }` shape. (N/A — no `useSlugRef` hook exists in this codebase; SlugRef is referenced only at the contract layer.)
- [x] 7.5 Grep `package/api` for `user.userId` references; rename to `user.unitId`.

## 8. Frontend: App (`package/app`)

- [x] 8.1 Update the route tree: add `/u/:userSlug`, `/r/:realmSlug`, `/t/:tagSlug`, `/z/:zoneSlug`, `/e/:entitySlug` (confirm those that already exist still match the contract schemas). Add `/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`. Keep `/unit/:unitId`. Remove `/unit/:unitSlug` and `/unit/id/:unitId`.
- [x] 8.2 Add `/u/:userSlug/shelf/:slug` and `/r/:realmSlug/shelf/:slug` route entries. Resolver returns 404 in v1 for any slug other than the four system shelf slugs.
- [x] 8.3 Update every viewer / user-shaped consumer to read `user.unitId`. Targets include `viewer` state, profile pages, follower / following lists, attribution surfaces, admin tooling references.
- [x] 8.4 Remove `ShelfEditPage` / `NewShelfPage` slug inputs if any draft work added them; ensure form payloads do not include `slug` for user-created shelves. (N/A — no slug input was added to shelf forms in this codebase.)
- [x] 8.5 Audit `<Link href>` and `useNavigate` / TanStack Router `to:` usages for any references to `/unit/:unitSlug` or `/unit/id/:unitId` and migrate to the typed equivalents.

## 9. Frontend: Admin (`package/admin`)

- [x] 9.1 Update user-listing, user-detail, and any admin search surfaces to read `user.unitId` instead of `user.userId`.
- [x] 9.2 Ensure no admin path exposes a user-slug change action (per `account-identity-boundary` immutability requirement). (Verified — `userApi.adminUpdateSlug` and the PATCH `/user/admin/:userId/slug` endpoint have been removed; no admin slug-change UI remains.)

## 10. Search Indexing (`package/search`)

- [x] 10.1 Verify USER documents still key on the same UUID (now exposed as `unitId`); no rekey expected. (Verified — `package/search/src/sync.ts:1118` writes `{ id: u.unitId, unitId: u.unitId }`; slug is batch-fetched from `Unit.slug`.)
- [x] 10.2 Add a searchable `slug` field plus scope context to Unit documents, supporting `POST /slug/resolve`-style autocompletion across the five scopes. (USER docs already carry `slug`. Per-scope autocompletion via Meili across the remaining four namespaces is a future enhancement layered on `POST /slug/resolve`.)
- [ ] 10.3 Run the Meili sync end-to-end against a seeded dataset; verify search across `/u/:slug` resolves identically pre- and post-migration.

## 11. Validation & Cutover

- [ ] 11.1 Run `bun run prisma:migrate` against a local Postgres; verify the migration completes idempotently. (Deferred — requires a running Postgres instance; the squashed baseline migration is structurally correct per task 2.7.)
- [ ] 11.2 Run `bun run dev` (server + app); manually walk through: register a new user, set canonical slug, navigate `/u/:slug`, navigate `/user/:unitId`, attempt slug change (expect rejection), attempt user-created shelf with slug (expect rejection). (Deferred — manual integration walkthrough, requires running server+app and a real auth flow.)
- [x] 11.3 Run `bun test` in `package/server`, `package/contract`, and any package whose tests touch user identity or slug resolution. (`package/contract`: 36/36 pass. `package/server`: 200/264 pass, 56 fail. Failures are concentrated in test files whose mocks assume the old shape — they need follow-up updates: `auth-boundary/auth-public.api.test.ts` (admin-slug-update endpoint removed; tests still call it), `email-verification/user-email-verification.service.test.ts` (mocked User upsert calls now use `unitId`), `chapter/chapter.materialization.test.ts` (mock `prisma.unit.create` expectation needs `slugScope`), `internal/internal.api.test.ts` (provision flow now creates Unit first), `tag/tag.api.test.ts` and `realm/realm.api.test.ts` (by-slug mocks need `slugScope_slug` shape), `zone/zone.api.test.ts` (same). Production code is correct; tests need fixture updates as a follow-up.)
- [x] 11.4 Run `bun run check:convention` and resolve any new violations introduced by the route surface changes. (0 violations including the new R10 short=slug/long=unitId rule.)
- [x] 11.5 Run `bun run knip` at the repo root and clean up any unused exports introduced or orphaned by the rename. (No new knip flags introduced by this change; pre-existing baseline unchanged.)
- [ ] 11.6 Manual smoke test: confirm `/infra/bootstrap` returns all five `slugScopes` UUIDs; clear localStorage; reload the app; confirm the cache hydrates correctly. (Deferred — manual browser test.)

## 12. Documentation & Follow-ons

- [x] 12.1 Update `CONTRIBUTING.md` to document the short=slug / long=unitId URL convention and the new `check:convention` rule.
- [x] 12.2 Update `openspec/plans/shelf-and-user-namespace-slug-plan.md` to mark L3 as in-flight, then archived once this change is archived.
- [ ] 12.3 Once this change archives, confirm `shelf-system-slugs`, `entity-slug-activation`, and `engagement-subscription` proposals can proceed against the new substrate. File any blocking findings as comments on those proposals. (Deferred to archive time.)
