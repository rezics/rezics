## 1. Prerequisites

- [x] 1.1 Confirm `user-namespace-slug` (L3) has archived. The Prisma schema MUST already carry `Unit.slugScope`, the composite `(slugScope, slug)` unique, the `USER` and `SCOPE` `UnitType` variants, and `User.unitId` as the PK. The `GET /shelf/by-slug/:userSlug/:slug` endpoint shell MUST be mounted (404-only).

## 2. Contract Trim

- [x] 2.1 Remove the `shelves` sub-property from the `UserExtra` type in `package/contract/src/user.ts` (or wherever `UserExtra` lives). Keep `UserExtra` itself as an open object if other keys are used; otherwise narrow it.
- [x] 2.2 Remove the `systemShelves` field from any user-shaped DTO (`User`, `UserBrief`, `UserSummary`, `/user/me` response) defined in `@rezics/contract`. Search `package/contract/src` for `systemShelves` and remove every occurrence.
- [x] 2.3 Re-export the `SYSTEM_SHELF_KIND_KEYS` constant under a stable path consumed by both the server allow-list and the client SlugRef hook. Confirm `package/contract/src/progress.ts` already exports it; no rename needed.
- [x] 2.4 Run `bun -F @rezics/contract build` (or the package's build command) and verify the build passes.

## 3. Prisma Schema

- [x] 3.1 In `package/server/prisma/schema.prisma`, drop the `shelves` key from any documented JSON shape of `User.extra` (the column type stays as `Json?`; only the in-app schema understanding changes). No schema migration is required for the column itself.
- [x] 3.2 Author a Prisma migration that strips `extra.shelves` from any existing rows (`UPDATE "User" SET extra = extra - 'shelves' WHERE extra ? 'shelves'`). Acceptable to ship as a destructive single-statement migration given dev-stage.
- [ ] 3.3 Run `bun run prisma:migrate` and confirm the migration applies cleanly against a freshly reseeded database.

## 4. Server: Shelf System Helpers Rewrite

- [x] 4.1 In `package/server/src/shelf/system-shelves.ts`, delete `readUserSystemShelves`, `patchUserSystemShelf`, and the `shelves` handling inside `normalizeUserExtra` (or remove the helper entirely if it has no remaining callers).
- [x] 4.2 Rewrite `findSystemShelf(userId, kindKey, client)` to query the `Unit` table: `client.unit.findFirst({ where: { type: 'SHELF', slug: kindKey, slugScope: userId }, select: { id: true } })`. Drop the `Shelf.findFirst({ kindKey, unit.userId })` path.
- [x] 4.3 Rewrite `createSystemShelf(userId, kindKey, client)` so the `Unit.create` call sets `slug: kindKey` and `slugScope: userId` in addition to the existing fields. Keep the translation insert and the paired `Shelf` row insert.
- [x] 4.4 Rewrite `getOrCreateSystemShelfWithClient` to: (a) call `findSystemShelf`; (b) return the id if found; (c) call `createSystemShelf`. Remove the `extra.shelves` short-circuit and the `patchUserSystemShelf` call.
- [x] 4.5 Wrap the `createSystemShelf` call in a try-catch that, on a Prisma `P2002` (unique violation on `(slugScope, slug)`), re-issues `findSystemShelf` once and returns its result — defends against a concurrent insert.
- [x] 4.6 In `bootstrapSystemShelves`, confirm the loop still iterates `SYSTEM_KIND_KEYS` and calls the rewritten `getOrCreateSystemShelfWithClient`. No call-site change at `user.service.ts:155, :230` or `internal.api.ts`.
- [x] 4.7 Add a `console.warn` (or the project's logger equivalent) in the create branch of `getOrCreateSystemShelfWithClient` when invoked outside test context, logging `{ userId, kindKey }`. The eager path means this branch should not fire in steady state.
- [x] 4.8 Update `package/server/src/shelf/system-shelves.test.ts` to assert the new behavior: created shelves carry `slug = kindKey` and `slugScope = userId`; lookup is via the Unit slug index; no `extra.shelves` writes are observable.

## 5. Server: Endpoint Activation

- [x] 5.1 In `package/server/src/shelf/shelf.api.ts` (or the file mounting the L3 endpoint shell), implement the `GET /shelf/by-slug/:userSlug/:slug` resolver. Steps: resolve user by `userSlug` (via the user-by-slug service); reject with 404 if user not found; check `params.slug` is in `SYSTEM_SHELF_KIND_KEYS`, reject with 404 otherwise; query `Unit.findFirst({ where: { type: 'SHELF', slug: params.slug, slugScope: user.unitId } })`; project through the standard shelf mapper.
- [x] 5.2 Add a test in `package/server/src/shelf/shelf.api.test.ts` (or the closest existing file) covering: (a) `GET /shelf/by-slug/<existing-user>/favorites` → 200 with shelf payload; (b) `GET /shelf/by-slug/<existing-user>/my-custom` → 404; (c) `GET /shelf/by-slug/no-such-user/favorites` → 404.

## 6. Server: User Surface Trim

- [x] 6.1 In `package/server/src/user/user.mapper.ts` (and any other user-DTO mapper), drop the `systemShelves` projection if present. Confirm `/user/me` response no longer carries this field.
- [x] 6.2 Grep `package/server/src` for `extra.shelves` and `systemShelves`. Remove every read site. Targets likely include user mappers, profile mappers, any `materializeFromVerifiedAuth` projection, and the `internal.api.ts` provisioning response.
- [x] 6.3 Update `package/server/src/user/service/user.service.ts` if it explicitly populates `extra: { shelves: ... }` anywhere — remove that. The bootstrap path already calls `bootstrapSystemShelves`; nothing else is needed.

## 7. Frontend: API Client (`package/api`)

- [x] 7.1 Add a `useSystemShelfRef(kindKey)` hook (or query-options equivalent) in the appropriate `package/api` module. Implementation: thin wrapper over the existing SlugRef hook, pre-filling `scope: viewer.unitId` and accepting a `SystemShelfKindKey` argument. Export it from the package's public surface.
- [x] 7.2 Grep `package/api/src` for `user.extra.shelves` and `systemShelves` references. Migrate every read site to either `useSystemShelfRef` or the underlying `useSlugRef`.
- [x] 7.3 If `package/api` exposes a `viewer` selector that surfaces `extra.shelves`, drop that selector. Compile errors in `package/app` are expected and addressed in section 8.

## 8. Frontend: App (`package/app`)

- [x] 8.1 Migrate `ShelfAction` (the heart / favorites toggle component) to resolve the favorites shelf id via `useSystemShelfRef('favorites')`. Remove any `viewer.extra.shelves.favorites` access.
- [x] 8.2 Migrate `CollectionModal` to resolve any system shelf ids it needs (e.g., for default-checked state) via `useSystemShelfRef`.
- [x] 8.3 Migrate the profile shelves tab (and any other place that lists or links to the four system shelves) to resolve through `useSystemShelfRef` and link to `/u/:userSlug/shelf/:kindKey`.
- [x] 8.4 Migrate the progress-status flow's client paths: every transition that adds/removes from `backlog` / `active` SHALL resolve the shelf id through `useSystemShelfRef`. The "lazy create on missing id" branch from `progress-status-flow-v2` is deleted — system shelves are guaranteed to exist for any logged-in viewer.
- [x] 8.5 Run a final grep for `extra.shelves` and `systemShelves` in `package/app/src`. Should be empty.

## 9. Frontend: Admin (`package/admin`)

- [x] 9.1 Grep `package/admin/src` for `extra.shelves` and `systemShelves`. Migrate any reader to the SlugRef path or remove the surface if it was only for debug.

## 10. Seed & Factory

- [x] 10.1 Verify `prisma/seed/` and `package/server/prisma/factory/` produce slug-minted system shelves the moment this change merges. Spot-check via `bun run seed:factory` and an SQL query against `Unit` filtering `type = 'SHELF' AND slug IS NOT NULL`.
- [x] 10.2 If any factory or seed module manually writes `User.extra = { shelves: ... }`, remove that write — `bootstrapSystemShelves` is the canonical entry point.

## 11. Validation & Cutover

- [ ] 11.1 Run `bun run prisma:migrate` against a freshly reseeded local Postgres. Confirm `Unit` table contains four `(slugScope = user.unitId, slug = kindKey)` rows per seeded user.
- [x] 11.2 Run `bun test` in `package/server` and `package/contract`. Update any assertion that previously expected `extra.shelves` or `systemShelves` on a user DTO.
- [ ] 11.3 Run `bun run dev` and manually verify: (a) register a new user via the UI; (b) navigate `/u/<slug>/shelf/favorites` → expect 200 and a rendered shelf; (c) navigate `/u/<slug>/shelf/some-other-slug` → expect 404; (d) favorites toggle on a unit still works end-to-end; (e) progress-status backlog / active transitions still write to the correct shelf.
- [x] 11.4 Run `bun run check:convention`. Fix any new violations introduced by the route or hook changes.
- [x] 11.5 Run `bun run knip` at the repo root and clean up orphans introduced by the contract trim or hook migration.
- [x] 11.6 Final repo-wide grep for `extra.shelves`, `systemShelves`, `readUserSystemShelves`, `patchUserSystemShelf`. Every hit should be intentional (e.g., the migration SQL, archived spec history). No active code paths should remain.

## 12. Documentation & Follow-on

- [x] 12.1 If `CONTRIBUTING.md` or any in-repo doc references the `User.extra.shelves` resolution pattern, update it to point at `useSystemShelfRef` / SlugRef.
