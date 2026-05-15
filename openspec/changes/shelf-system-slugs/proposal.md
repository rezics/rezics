## Why

After `user-namespace-slug` (L3) lands, the slug substrate permits `SHELF` Units to carry a slug under a user owner-scope, but no slug is actually minted anywhere. `/u/:userSlug/shelf/favorites` is wired to resolve 404, the four contract-defined system shelves (`favorites`, `backlog`, `active`, `completed`) exist as plain `SHELF` Units with no addressable identity, and the only way the frontend learns about them is via the `User.extra.shelves` JSON map — a server-side cache that doubles as a frontend-exposed lookup and forces every system-shelf consumer to special-case the resolution path.

This is the L1 deliverable from `openspec/plans/shelf-and-user-namespace-slug-plan.md`. It mints the four system slugs at user bootstrap so the contract URLs become stable from day zero, and retires `User.extra.shelves` as a frontend surface so system shelves are resolved through the same `SlugRef` path as any other slug-bearing Unit.

## What Changes

- Extend `bootstrapSystemShelves` (called inside the user-create transaction) so every system `SHELF` Unit is inserted with `slug = kindKey` and `slugScope = ownerUserUnitId` in the same write. The four slugs (`favorites`, `backlog`, `active`, `completed`) become stable, addressable identities from the moment a user is provisioned.
- Keep `getOrCreateSystemShelf` as an idempotent safety net for races / seed-skipped users; when it falls through to creation, it MUST mint the slug + scope alongside the shelf, matching the eager path.
- **BREAKING** Remove the `User.extra.shelves` JSON field from the schema, all DTOs (`User`, `UserSummary`, `/user/me`), and every consumer. The Unit table itself becomes the index: any system shelf id is recovered via `(slugScope = ownerUserUnitId, slug = kindKey)`. The previously documented `systemShelves` field on the `/user/me` response is removed; clients use `useSlugRef` instead.
- Rewrite `getOrCreateSystemShelf` and `findSystemShelf` to query `(slugScope, slug)` on Unit instead of consulting `User.extra.shelves` and falling back to `(userId, type = SHELF, kindKey)`. The kindKey index on Shelf is preserved for joins.
- Activate the `GET /shelf/by-slug/:userSlug/:slug` endpoint (already mounted shell in L3, currently 404-only): for the four contract-defined `kindKey`s the resolver returns the shelf; for any other slug it still returns 404 per `shelf-collection`'s v1 stance (user-created shelves stay slug-less).
- Frontend: introduce a thin `useSystemShelfRef(viewerUnitId, kindKey)` hook (or extend the existing `useSlugRef` call site pattern) that composes `{ scope: viewerUnitId, slug: kindKey }` and resolves to a shelf unit id. Every consumer of `User.extra.shelves` (favorites toggle, progress-status hooks, profile shelves tab, etc.) migrates to this hook.
- Seed: `prisma/factory/` and any deterministic root-user / demo-user paths that previously relied on `User.extra.shelves` to find ids re-derive them through the slug index. No data migration is shipped — the project is dev-stage and a clean reseed is the cutover (per CLAUDE.md "no backwards-compatible aliases" stance).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shelf-collection`: add a requirement that system shelves SHALL be minted with `slug = kindKey` and `slugScope = ownerUserUnitId` at user creation. Document that `/shelf/by-slug/:userSlug/:slug` resolves the four system slugs and 404s on anything else. Remove the "User.extra.shelves is the system-shelf lookup surface" requirement language (and its `/user/me` `systemShelves` field) introduced by `progress-status-flow-v2`.
- `progress-status-ui` (archived behavior referenced here for completeness): the "client SHALL call the existing `getOrCreateSystemShelf` server path or refetch `/user/me`" guidance is superseded by SlugRef-based resolution. Where the spec still drives current behavior, update the resolution path requirement to read through `useSlugRef({ scope: viewerUnitId, slug: kindKey })`.

## Impact

**Affected packages**

- `package/server` — `shelf/system-shelves.ts` (rewrite lookups to use `(slugScope, slug)`; mint slug at create-time), `user/service/user.service.ts` (already calls `bootstrapSystemShelves` — no call-site change, only behavior of the bootstrap function), `shelf/shelf.api.ts` (activate the `by-slug/:userSlug/:slug` resolver), `user/user.mapper.ts` (drop `systemShelves` projection if any), `internal/internal.api.ts` (sibling caller of `bootstrapSystemShelves`).
- `package/contract` — drop `UserExtra.shelves` from the contract type and from `User`/`UserSummary` DTOs; drop `systemShelves` from any `/user/me` response shape.
- `prisma/schema` — drop or repurpose `User.extra.shelves`; if `User.extra` keeps other keys, only remove the `shelves` sub-property. (Decided in design.)
- `package/api` — add or expose a `useSystemShelfRef` hook (built on `useSlugRef`); deprecate the `viewer.extra.shelves` selector if present.
- `package/app` — every place that reads `user.extra.shelves[kindKey]` migrates to the SlugRef hook. Targets: favorites toggle (`ShelfAction`), `CollectionModal`, profile shelves tab, progress-status flow client paths.
- `package/admin` — verify no admin surface depends on `extra.shelves`.
- `prisma/factory/` — update demo-user generation to assert system shelves are slug-minted (no extra writes needed; the eager bootstrap path already covers it post-this-change).

**Data migration**

None. The project is in active development (per `CLAUDE.md`). Existing local / staging databases are reseeded; no production data exists. Seed code is the canonical migration. Specifically:

- `bootstrapSystemShelves` now mints slugs alongside the shelf rows it already creates.
- `getOrCreateSystemShelf` is rewritten to use `(slugScope, slug)` lookups; it no longer reads `User.extra.shelves`.
- The Prisma migration drops the `shelves` key from existing `extra` JSON values (or drops the field entirely if no other keys exist). Acceptable to do this destructively given dev-stage.

**Backward compatibility**

Per `CLAUDE.md`, this change runs as one breaking cutover with no dual-read / shim window. The `User.extra.shelves` removal is breaking for any in-flight client; the project's active-development stance accepts this. The `GET /shelf/by-slug/:userSlug/:slug` endpoint shape stays as drafted by L3 — only the resolver behavior tightens (now resolves the four system slugs).

**Downstream**

This change closes the L1 leg of `shelf-and-user-namespace-slug-plan.md`. It does not block or unblock `entity-slug-activation` or `engagement-subscription`; those can proceed in parallel.
