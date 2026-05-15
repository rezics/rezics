## Context

This change is the L1 deliverable of `openspec/plans/shelf-and-user-namespace-slug-plan.md`. It depends on the L3 change `user-namespace-slug` having shipped first: that change provides the `Unit.slugScope` column, the composite `(slugScope, slug)` unique, the `SHELF`-permitted-under-owner-scope substrate rule, the `User.unitId` rename, and the `GET /shelf/by-slug/:userSlug/:slug` endpoint shell that currently returns 404 for every slug.

**Current state**

- `package/server/src/shelf/system-shelves.ts` exposes `bootstrapSystemShelves(userId, tx)`, which is called inside the user-create transaction at `user.service.ts:155` and `:230`. It iterates the four `SYSTEM_SHELF_KIND_KEYS` and creates one `SHELF` Unit + `Shelf { kindKey }` row each, then patches `User.extra.shelves[kindKey] = unit.id`.
- `getOrCreateSystemShelf(userId, kindKey)` consults `User.extra.shelves` first, falls back to a `Shelf.findFirst({ kindKey, unit.userId })` lookup, and finally creates if missing. Used as a write-path safety net (`collection.service.ts:36` for the favorites toggle).
- The frontend reads system shelf ids through the `extra.shelves` JSON projected onto `/user/me` (and `progress-status-flow-v2` exposed a `systemShelves` field on the user DTO).
- The L3 `unit-slug` spec scenario "Setting a system shelf slug under a user owner-scope" formally permits `slug = kindKey, slugScope = ownerUserUnitId`. The L3 `shelf-collection` spec explicitly carves out actual minting for this change.
- The project is in active development (`CLAUDE.md`); existing local / staging data is disposable and can be reseeded.

**Stakeholders**: `package/server` (shelf + user services), `package/contract` (DTO trim), `package/api` (SlugRef hook surface), `package/app` (every consumer of `extra.shelves`), `prisma/factory/` (seed paths).

## Goals / Non-Goals

**Goals:**

- Mint a slug for every system shelf at user-creation time, inside the same transaction as the existing shelf row insert. No new code path, no separate migration step at runtime — the slug is just two additional fields on the same `Unit.create`.
- Activate `GET /shelf/by-slug/:userSlug/:slug` to resolve the four contract-defined system slugs (`favorites`, `backlog`, `active`, `completed`) and 404 on every other slug.
- Make the frontend's resolution path uniform with every other slug-bearing Unit: client uses `useSlugRef({ scope: viewerUnitId, slug: kindKey })`; no system-shelf-specific endpoint or DTO field.
- Remove `User.extra.shelves` and the `/user/me` `systemShelves` field. The Unit table's `(slugScope, slug)` index is the canonical lookup; the JSON cache is redundant.
- Keep `getOrCreateSystemShelf` as an idempotent safety net so that any user who somehow lacks one of the four shelves (race, partial-failed seed, ad-hoc admin tool) self-heals on first write, minting the slug alongside the shelf.

**Non-Goals:**

- Open user-created shelf custom slugs. Per L3 §6.10, `shelfService.create` / `.update` reject non-null `slug` on non-system shelves with a typed error. This change preserves that policy unchanged.
- Mint slugs for realm-owned shelves. The `/r/:realmSlug/shelf/:slug` shape stays the documented future extension but no realm-side bootstrap is added here.
- Migrate `User.bio` / `User.name` into Unit translations, or change `User.extra`'s other keys (if any). Only the `shelves` sub-property of `extra` is targeted.
- Ship a data backfill / migration for existing production data. The project is dev-stage; a clean reseed is the cutover.
- Introduce a system-shelf rename surface. The four `kindKey`s are contract constants; their slug values are their `kindKey` strings. No rename API.

## Decisions

### D1: Eager mint at user creation, lazy as safety net only

**Decision**: Slug minting happens inside `bootstrapSystemShelves`, which is already invoked inside the user-creation transaction (`user.service.ts:155, :230` plus the internal materialization path). Every new user gets four slug-bearing shelves before any other code observes them. `getOrCreateSystemShelf` is retained, but its creation branch is now expected to be cold-path: a fallback for users provisioned outside the standard `userService.create` flow (e.g., factory-bypassed test fixtures, races, schema-skipped fixtures).

**Why**: The four `kindKey`s are contract resources, not user-action-conditional ones. Every user is entitled to all four from the moment they exist; the URL `/u/alice/shelf/favorites` is a stable contract URL, not a "depends on whether alice has interacted with it" URL. Lazy minting would force every consumer (profile tabs, navigation, SlugRef hook) to handle "this URL might 404 for new users" as a special case. Eager removes the special case entirely. The current codebase is already eager for the shelf rows themselves; adding `slug` and `slugScope` to that existing insert is the minimum-surface change.

**Alternatives considered**:

- *Lazy mint on first slug resolution*: rejected for the reasons above. Would require either a write-side endpoint (`POST /shelf/system/:userSlug/:slug/ensure`) or client-side awareness of which slugs are "potentially uninitialized" — both leak the lazy boundary into the public contract.
- *Mint at first write (favorites toggle) only*: rejected. The favorites toggle is the most common write, but `/u/alice/shelf/backlog` would 404 for a brand-new user until they explicitly add something to backlog. Same fragility as full lazy.

### D2: `slugScope = ownerUserUnitId`, not the `user` SlugScope placeholder

**Decision**: The four system shelf Units carry `slugScope = user.unitId` (the owner-USER-unit id), not the `user` SlugScope row's `unitId`. The discriminator is "owner-scoped sub-resource" vs "top-level scope-scoped slug", and shelves are owner-scoped.

**Why**: L3 §4.3 / D4 already established that owner-scoped slugs (shelves under a user) point `slugScope` at the owner unit id directly. This change just consumes that substrate. The `(slugScope, slug)` unique then enforces "one `favorites` shelf per user" naturally: two users may both have `favorites`, but a single user cannot have two.

### D3: Drop `User.extra.shelves` completely; do not retain a server-side cache

**Decision**: `User.extra.shelves` is removed from the Prisma schema (the `shelves` sub-key of the JSON column), from the `UserExtra` contract type, from every DTO, and from every consumer. `readUserSystemShelves`, `patchUserSystemShelf`, and `normalizeUserExtra`'s `shelves` handling are deleted. `findSystemShelf` and `getOrCreateSystemShelfWithClient` are rewritten to query `Unit` directly:

```ts
const existing = await client.unit.findFirst({
  where: { type: 'SHELF', slug: kindKey, slugScope: userUnitId },
  select: { id: true },
});
```

**Why**: Once `(slugScope, slug)` is unique on Unit, a single index lookup is as fast as a JSON read on `User.extra`, and the index is already going to exist for every other slug consumer. Keeping `extra.shelves` as a "server-internal cache" buys nothing measurable, costs a synchronization invariant ("the JSON map must agree with the Unit table"), and risks drift the first time any code path adds a system shelf without going through `patchUserSystemShelf`. The plan §5 explicitly contemplates this removal. No write-path performance regression is expected — the favorites toggle's existing call to `getOrCreateSystemShelf` becomes one Unit-table query instead of one JSON-read-and-maybe-fallback.

**Alternatives considered**:

- *Retain `extra.shelves` as a server-only cache (B in the explore discussion)*: rejected per above — invariant cost without a payoff. If profiling later identifies the `(slugScope, slug)` lookup as a hot spot, an in-memory cache scoped to the request lifecycle is cheaper than a persisted JSON cache.

### D4: No data migration; seed is the migration

**Decision**: No Prisma data backfill for existing users. The migration drops `extra.shelves` content (or whole-`extra` shape change, see D5) at the schema level; existing dev / staging databases are reseeded. `prisma/factory/` and `prisma/seed/` produce slug-minted system shelves the moment this change merges because they go through the rewritten `bootstrapSystemShelves`.

**Why**: Per `CLAUDE.md` "active development, no backwards-compatible aliases unless explicitly granted". No production data exists. A seed-driven cutover is simpler and removes a class of migration-bug risk (split-brain users with shelves but no slug). The cost is a one-time `bun run seed:factory` for each developer; the project already runs reseed-heavy workflows.

**Alternatives considered**:

- *Per-row backfill SQL in the migration*: rejected — unnecessary complexity for zero production benefit.
- *Lazy slug mint for pre-existing shelves on first read*: rejected — would leak a "legacy unslugged shelf" state through the type system indefinitely.

### D5: `User.extra` shape — keep the JSON column, drop the `shelves` key only

**Decision**: The `extra` JSON column itself stays on `User` (other product features may use it). Only the `shelves` sub-property is removed. The `UserExtra` TypeScript type drops `shelves`; runtime normalization no longer accepts it. If at this change's land time `extra` carries only `shelves`, follow-on work may drop the column entirely — but this change does not take that scope.

**Why**: Minimum-surface change. `User.extra` is the documented escape hatch for ad-hoc per-user state; pulling the whole column would expand the blast radius beyond system shelves. Leaving the column in place lets future features add keys without re-opening a migration.

### D6: Endpoint resolver behavior — strict allow-list of system `kindKey`s

**Decision**: `GET /shelf/by-slug/:userSlug/:slug` resolves the four contract-defined `kindKey`s and 404s for every other slug, even if a `(slugScope, slug)` row were somehow to exist for a user-created shelf. The allow-list is enforced at the resolver layer (`slug IN SYSTEM_SHELF_KIND_KEYS`) in addition to the service-layer write rejection from L3 §6.10.

**Why**: Defense in depth. The L3 service layer already rejects custom shelf slugs on write, but a future migration or admin tool could in principle insert one. The resolver allow-list keeps `/u/:userSlug/shelf/:slug` semantically locked to "system shelves only in v1", matching the spec stance. If a future change opens user-created shelf slugs, the allow-list is the one line that flips.

### D7: Frontend hook surface — extend `useSlugRef`, do not introduce a parallel API

**Decision**: System shelf resolution on the client uses the same `useSlugRef` hook (or its query-options equivalent) that resolves every other slug. A thin convenience wrapper `useSystemShelfRef(kindKey)` MAY be added in `package/api` that pre-fills `scope: viewer.unitId`, but it is purely ergonomic — it does not introduce a separate query key, separate endpoint, or separate cache.

**Why**: Uniformity. The whole point of L3's slug system is that every slug-bearing Unit resolves through one path; system shelves are not architecturally special, only operationally pre-minted.

### D8: `getOrCreateSystemShelf` is preserved unchanged in signature, rewritten internally

**Decision**: The exported function signature stays `(userId, kindKey, client?) => Promise<string>`. Internal implementation queries Unit by `(slugScope, slug)` instead of `extra.shelves`; the create branch sets `slug` and `slugScope` in the same Unit insert. Callers (`collection.service.ts` favorites toggle, internal admin paths) do not change.

**Why**: Avoids a churn pass through every caller and preserves the safety-net role. The function becomes "look up the slug-indexed system shelf; create one (with slug) if missing". Idempotent on repeated calls.

### D9: `bootstrapSystemShelves` is the only seed-time entry point

**Decision**: `prisma/factory/` and `prisma/seed/` user-creation paths go through `userService.create` (which already calls `bootstrapSystemShelves`), or call `bootstrapSystemShelves` directly inside their own tx. No factory adds slugs out-of-band. The `internal.api.ts` caller of `bootstrapSystemShelves` is preserved.

**Why**: One canonical mint path. Eliminates the risk of a factory-minted shelf having a row but no slug, which would silently violate the substrate's invariants.

## Risks / Trade-offs

- **Removing `User.extra.shelves` breaks every in-flight client** → Mitigation: per `CLAUDE.md`, one clean breaking cutover. Frontend ships in lock-step with backend; no dual-read shim. Pre-merge grep for `extra.shelves` and `systemShelves` confirms all call sites are migrated.
- **`getOrCreateSystemShelf` safety net might silently hide a missing-bootstrap bug** → Mitigation: log a warning at `WARN` level when the create branch fires in non-test environments. If the eager path is correct, this branch is cold; firing it indicates either a fixture bypass or a race worth investigating.
- **Resolver allow-list and write-side rejection are two enforcement points that could drift** → Mitigation: both consume the same `SYSTEM_SHELF_KIND_KEYS` constant from `@rezics/contract`. The allow-list is a one-liner against the constant; future expansion (e.g., opening custom slugs) is a single coordinated change.
- **`bootstrapSystemShelves` runs inside the user-create tx; failure rolls back user creation** → Existing behavior, no change. The new behavior just adds two columns to the Unit insert.
- **Race: two concurrent calls to `getOrCreateSystemShelf` for the same `(userId, kindKey)`** → The composite unique `(slugScope, slug)` on Unit catches the second insert with a constraint error. Wrap the create branch in a try-catch that, on unique-violation, retries the read once. Existing `getOrCreateSystemShelfWithClient` does not currently handle this; the rewrite adds it.

## Migration Plan

**Pre-requisite**: `user-namespace-slug` (L3) is archived. `Unit.slugScope` and `(slugScope, slug)` are in place. `/shelf/by-slug/:userSlug/:slug` exists as a 404-shell.

**Phase 1 — Server / contract cutover (single deploy window)**

1. Drop `UserExtra.shelves` from `@rezics/contract`; rebuild contract package.
2. Remove `systemShelves` from any `/user/me` response shape (if still present from `progress-status-flow-v2`).
3. Rewrite `package/server/src/shelf/system-shelves.ts`:
   - `findSystemShelf` queries `Unit` by `(type=SHELF, slug=kindKey, slugScope=userUnitId)`.
   - `createSystemShelf` sets `slug = kindKey, slugScope = userUnitId` in the same `Unit.create`.
   - Delete `readUserSystemShelves`, `patchUserSystemShelf`, `normalizeUserExtra` (or trim normalizer to ignore `shelves`).
4. Activate `GET /shelf/by-slug/:userSlug/:slug` resolver in `shelf.api.ts`: enforce the `kindKey IN SYSTEM_SHELF_KIND_KEYS` allow-list, return 404 otherwise.
5. Run `bun run prisma:migrate` to author the Prisma migration that strips `shelves` from any existing `extra` JSON values (or no-op if the column is empty across all rows post-reseed).

**Phase 2 — Client cutover (same deploy)**

1. Add `useSystemShelfRef(kindKey)` wrapper in `package/api` over the existing SlugRef hook with `scope: viewer.unitId`.
2. Migrate every reader of `user.extra.shelves[kindKey]` or `user.systemShelves[kindKey]` to `useSystemShelfRef`. Targets: `ShelfAction` (favorites toggle), `CollectionModal`, profile shelves tab, progress-status hooks.
3. Drop the `extra.shelves` reader / selector from any viewer state module.

**Phase 3 — Validation**

1. `bun run seed:factory` against a fresh database. Confirm every seeded user has four `Unit { type=SHELF, slug=kindKey, slugScope=user.unitId }` rows.
2. `bun test` in `package/server` (covers `system-shelves.test.ts` and shelf service tests; update assertions to reflect slug fields and the new lookup path).
3. Manual smoke: register a brand-new user; navigate `/u/<slug>/shelf/favorites`; expect 200. Navigate `/u/<slug>/shelf/non-system-slug`; expect 404.
4. `bun run check:convention` and `bun run knip` for orphans.

**Rollback strategy**

One breaking cutover with no dual-read window. Rollback within the deploy window is by restoring the pre-deploy database snapshot and reverting the deploy. Post-cutover writes (any new user registered) cannot be rolled back; forward-fix only. Matches the project's `CLAUDE.md` stance.

## Open Questions

1. **Whether to log the `getOrCreateSystemShelf` cold-path fire at WARN or INFO** — telemetry preference, not a substrate concern. Decided during implementation; default to WARN since the eager path is expected to dominate.
2. **Whether `useSystemShelfRef` lives in `package/api` or `package/app`** — depends on whether it has any non-trivial composition logic. If it is a one-line wrapper, `package/api` keeps the surface clean; if it grows (e.g., to also surface a "create if missing" affordance for admin flows), `package/app` is the right home. Defer to implementation.
3. **Whether to drop `User.extra` entirely** if `shelves` was its only key at change-land time — strictly optional, captured here as a follow-on consideration. Not in scope for this change.
