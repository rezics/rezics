## 1. Contract Foundations

- [ ] 1.1 Add `SlugScopeName` type and `SlugScope` constant set in `package/contract/src/slug/scopes.ts` listing the five named scopes (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`).
- [ ] 1.2 Update `SlugRef` Typebox schema in `package/contract/src/slug/slug-ref.ts` to require `scope` alongside `slug` and `unitId?`. Export both the discriminated form (named-scope union) and the permissive form (owner-unit-id string).
- [ ] 1.3 Extend `slugValidation.ts` in `package/contract` to accept a `scope` argument used for uniqueness lookup. Reserved-word checking SHALL consult a **single unified `RESERVED_SLUGS` constant** (flat `Set<string>`) regardless of scope. Migrate the existing flat list into this constant and fold in: owner-path segments (`profile`, `settings`, `shelf`, `post`, `list`) and system-shelf slug values (`favorites`, `backlog`, `active`, `completed`).
- [ ] 1.4 Export `SYSTEM_SHELF_SLUGS` (or equivalent) constant in `@rezics/contract`. Document that any code path that mints a slug from this constant SHALL bypass `validateSlug` (the reserved list contains these very values to block user claims).
- [ ] 1.5 Add an `ENTITY_SLUG_WRITES_ENABLED = false` flag (single source of truth) in `package/contract/src/slug/feature-flags.ts` consumed by the server.
- [ ] 1.6 Update Typebox schemas for typed by-slug endpoints and add the new `userBySlug`, `entityBySlug`, `shelfBySlug` endpoint contracts plus the generic `POST /slug/resolve` payload/response schemas.
- [ ] 1.7 Extend `/infra/bootstrap` response schema to include `slugScopes: { user, realm, tag, zone, entity }`.
- [ ] 1.8 Rename `userId` → `unitId` on user-shaped DTOs (`User`, `UserBrief`, `UserSummary`, profile responses) in `package/contract`. Update JSDoc.
- [ ] 1.9 Add public route param schemas to `package/contract` for the new short-prefix (`/u`, `/r`, `/t`, `/z`, `/e`) and long-prefix UUID (`/user`, `/realm`, `/tag`, `/zone`, `/entity`) families plus owner-scoped `/u/:userSlug/shelf/:slug` and `/r/:realmSlug/shelf/:slug`. Remove the legacy `publicUnitSlugRouteParamsSchema` and `publicUnitIdRouteParamsSchema` for `/unit/:unitSlug` and `/unit/id/:unitId`.

## 2. Prisma Schema & Migrations

- [ ] 2.1 In `package/server/prisma/schema.prisma`, add `USER` and `SCOPE` variants to `UnitType` enum.
- [ ] 2.2 Add `SlugScope` model: `slug String @id` (the named scope key), `unitId String @db.Uuid @unique`.
- [ ] 2.3 Add `slugScope String @db.Uuid` to `Unit` (NOT NULL, no FK declared per design D2).
- [ ] 2.4 Replace the global `Unit.slug` unique constraint with `@@unique([slugScope, slug])`.
- [ ] 2.5 Rename `User.userId` PK to `User.unitId` (`@id @db.Uuid`). Update every `references: [User.userId]` to `references: [User.unitId]` on FK columns of related tables (column names preserved).
- [ ] 2.6 Drop `User.slug` column from the `User` extension.
- [ ] 2.7 Generate the migration. Author the migration body manually for the multi-phase backfill (see tasks 2.8–2.13).
- [ ] 2.8 In the migration: add `USER` and `SCOPE` enum variants first; defer constraint changes until backfill completes.
- [ ] 2.9 In the migration: insert five `SCOPE`-type Unit rows (`user`, `realm`, `tag`, `zone`, `entity`) with placeholder `slugScope`, then self-reference each with `slugScope = self.id`, then insert the five `SlugScope` rows.
- [ ] 2.10 In the migration: for every existing `User` row, insert a `Unit { id = User.userId, type = 'USER', slug = null, slugScope = <user-scope-unit-id> }`.
- [ ] 2.11 In the migration: backfill `Unit.slugScope` for every slug-bearing TAG / REALM / ZONE Unit to the matching scope unit id. For slug-less Units, backfill `slugScope` to a deterministic default (owner unit id when an owner exists, otherwise the user scope or entity scope placeholder).
- [ ] 2.12 In the migration: copy each `User.slug` value into the corresponding USER `Unit.slug`. Drop the `User.slug` column.
- [ ] 2.13 In the migration: drop the legacy `Unit.slug` global unique; apply `@@unique([slugScope, slug])`.
- [ ] 2.14 Run `bun run prisma:generate` and verify the generated client surface (new types for `UnitType.USER`, `UnitType.SCOPE`, `SlugScope`).

## 3. Seed & Bootstrap Wiring

- [ ] 3.1 In `package/server/prisma/seed/`, add a `slugScopes.ts` seed module that creates the five `SCOPE`-type placeholder Units and their `SlugScope` rows idempotently (no-op if rows exist).
- [ ] 3.2 Wire `slugScopes` seeding into the infra bootstrap entry point so it runs before any other slug-bearing seed (tags, default realm, root user).
- [ ] 3.3 Update the root-user / default-realm seeds to set `slugScope` correctly on inserted Units.
- [ ] 3.4 Update `package/server/src/infra/infra.service.ts` (or equivalent) so `/infra/bootstrap` includes the `slugScopes` map from `SlugScope` rows.
- [ ] 3.5 Verify `bun run seed:factory` runs end-to-end against a fresh database; confirm `/infra/bootstrap` returns all expected ids including `slugScopes`.

## 4. Server: Slug Resolution & Endpoints

- [ ] 4.1 Refactor the server-side slug resolver to query `(slugScope, slug)` instead of `(slug)`. Centralize the named-scope-to-unit-id lookup in a cached helper (the five UUIDs are read at boot from `SlugScope`).
- [ ] 4.2 Update existing typed by-slug endpoints (`/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug`) to use the scope-aware resolver.
- [ ] 4.3 Add `GET /user/by-slug/:slug` returning a user DTO keyed by `unitId`.
- [ ] 4.4 Add `GET /entity/by-slug/:slug` returning an entity DTO. Always 404 in v1 because no ENTITY Unit can carry a slug yet.
- [ ] 4.5 Add `GET /shelf/by-slug/:userSlug/:slug` resolving the user, then the shelf under the owner scope. Returns 404 for any non-system slug in v1.
- [ ] 4.6 Add `POST /slug/resolve` accepting `{ scope, slug }` (named scope or owner unit id) and returning `{ unitId, type }` or 404.
- [ ] 4.7 In `userService` and any profile-update handler, reject any payload containing a `slug` field with a typed `USER_SLUG_IMMUTABLE` error.
- [ ] 4.8 In `shelfService.create` and `shelfService.update`, reject any non-null `slug` value for user-created shelves with a typed `SHELF_CUSTOM_SLUG_DISABLED` error.
- [ ] 4.9 In the entity-creation paths (whichever services persist ENTITY Units), reject any slug write with a typed `ENTITY_SLUG_DISABLED` error gated by the `ENTITY_SLUG_WRITES_ENABLED` flag.
- [ ] 4.10 Update `slugValidation` callers across the server to pass the appropriate `scope` argument (registration → `'user'`; realm creation → `'realm'`; tag → `'tag'`; etc.).

## 5. Server: User PK Rename Surface

- [ ] 5.1 Grep `package/server` for `User.userId` field references and migrate to `User.unitId`. The physical column rename is handled by the Prisma migration; this task targets code-level field names.
- [ ] 5.2 Update every service / mapper that returns a user-shaped DTO to populate `unitId` instead of `userId`.
- [ ] 5.3 Update `userService.findById`, `userService.findBySlug`, profile mappers, follow/follower mappers, ApiToken mappers, attribution-adjacent mappers.
- [ ] 5.4 Verify auth → main projection paths (`user-domain-decoupling`, `account-identity-boundary`) still pass the canonical slug to the auth side using `Unit.slug` (not the dropped `User.slug` column).

## 6. Server: Route Surface

- [ ] 6.1 Mount the five short-prefix slug routes if not already mounted via the `app` package (server-side resolution is per-endpoint, but contract schemas must be exported).
- [ ] 6.2 Remove all server handlers for `/unit/:unitSlug` and `/unit/id/:unitId`.
- [ ] 6.3 Add a `check:convention` rule (R10 or next available number) that flags route definitions whose param names suggest a slug under a long prefix or a UUID under a short prefix.

## 7. Frontend: API Client (`package/api`)

- [ ] 7.1 Add TanStack Query hooks for `/user/by-slug/:slug`, `/entity/by-slug/:slug`, `/shelf/by-slug/:userSlug/:slug`, and `POST /slug/resolve`.
- [ ] 7.2 Update existing `/realm/by-slug`, `/tag/by-slug`, `/zone/by-slug` hooks to align with the new `SlugRef` shape.
- [ ] 7.3 Update the `useInfraBootstrap` hook (or equivalent) to surface `slugScopes` and persist it to localStorage keyed by app version stamp.
- [ ] 7.4 Update `useSlugRef` (or equivalent SlugRef-consuming hook) to accept the new `{ scope, slug, unitId? }` shape.
- [ ] 7.5 Grep `package/api` for `user.userId` references; rename to `user.unitId`.

## 8. Frontend: App (`package/app`)

- [ ] 8.1 Update the route tree: add `/u/:userSlug`, `/r/:realmSlug`, `/t/:tagSlug`, `/z/:zoneSlug`, `/e/:entitySlug` (confirm those that already exist still match the contract schemas). Add `/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`. Keep `/unit/:unitId`. Remove `/unit/:unitSlug` and `/unit/id/:unitId`.
- [ ] 8.2 Add `/u/:userSlug/shelf/:slug` and `/r/:realmSlug/shelf/:slug` route entries. Resolver returns 404 in v1 for any slug other than the four system shelf slugs.
- [ ] 8.3 Update every viewer / user-shaped consumer to read `user.unitId`. Targets include `viewer` state, profile pages, follower / following lists, attribution surfaces, admin tooling references.
- [ ] 8.4 Remove `ShelfEditPage` / `NewShelfPage` slug inputs if any draft work added them; ensure form payloads do not include `slug` for user-created shelves.
- [ ] 8.5 Audit `<Link href>` and `useNavigate` / TanStack Router `to:` usages for any references to `/unit/:unitSlug` or `/unit/id/:unitId` and migrate to the typed equivalents.

## 9. Frontend: Admin (`package/admin`)

- [ ] 9.1 Update user-listing, user-detail, and any admin search surfaces to read `user.unitId` instead of `user.userId`.
- [ ] 9.2 Ensure no admin path exposes a user-slug change action (per `account-identity-boundary` immutability requirement).

## 10. Search Indexing (`package/search`)

- [ ] 10.1 Verify USER documents still key on the same UUID (now exposed as `unitId`); no rekey expected.
- [ ] 10.2 Add a searchable `slug` field plus scope context to Unit documents, supporting `POST /slug/resolve`-style autocompletion across the five scopes.
- [ ] 10.3 Run the Meili sync end-to-end against a seeded dataset; verify search across `/u/:slug` resolves identically pre- and post-migration.

## 11. Validation & Cutover

- [ ] 11.1 Run `bun run prisma:migrate` against a local Postgres; verify the migration completes idempotently.
- [ ] 11.2 Run `bun run dev` (server + app); manually walk through: register a new user, set canonical slug, navigate `/u/:slug`, navigate `/user/:unitId`, attempt slug change (expect rejection), attempt user-created shelf with slug (expect rejection).
- [ ] 11.3 Run `bun test` in `package/server`, `package/contract`, and any package whose tests touch user identity or slug resolution.
- [ ] 11.4 Run `bun run check:convention` and resolve any new violations introduced by the route surface changes.
- [ ] 11.5 Run `bun run knip` at the repo root and clean up any unused exports introduced or orphaned by the rename.
- [ ] 11.6 Manual smoke test: confirm `/infra/bootstrap` returns all five `slugScopes` UUIDs; clear localStorage; reload the app; confirm the cache hydrates correctly.

## 12. Documentation & Follow-ons

- [ ] 12.1 Update `CONTRIBUTING.md` to document the short=slug / long=unitId URL convention and the new `check:convention` rule.
- [ ] 12.2 Update `openspec/plans/shelf-and-user-namespace-slug-plan.md` to mark L3 as in-flight, then archived once this change is archived.
- [ ] 12.3 Once this change archives, confirm `shelf-system-slugs`, `entity-slug-activation`, and `engagement-subscription` proposals can proceed against the new substrate. File any blocking findings as comments on those proposals.
