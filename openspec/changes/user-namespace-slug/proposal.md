## Why

User identity (`User.userId`) and Unit identity (`Unit.id`) live in separate universes today. This blocks two things at once: any reference that wants to point uniformly at an owner / subject / mention must special-case User, and a generic `Subscription(subscriberUnitId → targetUnitId)` edge cannot exist while the subscriber side has asymmetric identity. At the same time, the slug subsystem has reached the end of its single global namespace — `User.slug` and `Unit.slug` already live in two parallel uniqueness universes, `SHELF` is rejected from slugging so there is no addressable identity for `alice/favorites`, and the existing `/unit/:slug` route blurs the line between UUID and slug surfaces. Both problems touch User identity and Unit slug topology in the same migration window, so we bundle them into one architectural cutover.

This is the L3 deliverable in `openspec/plans/shelf-and-user-namespace-slug-plan.md`. It unblocks L1 (system shelf slugs) and the queued `engagement-subscription` change, both of which are post-L3 and parallelizable.

## What Changes

- **BREAKING** Promote `User` into the Unit graph. `User.userId` is renamed to `User.unitId` and a sibling `Unit { type: USER, id = User.unitId }` row is created for every existing user. `UnitType` gains `USER` and `SCOPE` variants.
- **BREAKING** Replace the global unique on `Unit.slug` with a composite unique on `(slugScope, slug)`. Add a NOT NULL `Unit.slugScope @db.Uuid` column and a new `SlugScope` lookup table seeded with five rows: `user`, `realm`, `tag`, `zone`, `entity`. Owner-scoped slugs (e.g., shelves under a user) point `slugScope` directly at the owner unit's id.
- **BREAKING** Move `User.slug` into `Unit.slug` under the `user` scope. Drop `User.slug`. User slugs are immutable in v1 — no rename surface, no alias table, no redirect.
- **BREAKING** Rewrite the public URL surface around the **short prefix = slug, long prefix = unitId** convention. Add short-prefix slug routes for every scope (`/u/:userSlug`, `/r/:realmSlug`, `/t/:tagSlug`, `/z/:zoneSlug`, `/e/:entitySlug`) and long-prefix UUID routes (`/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`). Keep `/unit/:unitId` as the universal UUID fallback. **Remove `/unit/:slug`** without alias. The `/@:slug` prefix is not introduced.
- **BREAKING** Permit `SHELF` slugs under the user owner scope (substrate only — user-created shelves stay slug-less; only contract-defined system shelves get slugs, owned by the follow-on L1 change `shelf-system-slugs`).
- **BREAKING** Seed the `entity` scope **write-disabled** at the service layer. Any `ENTITY` slug creation is rejected with a typed error until the follow-on `entity-slug-activation` change flips it on.
- Extend `SlugRef` shape to `{ scope: 'user' | 'realm' | 'tag' | 'zone' | 'entity' | <ownerUnitId>, slug, unitId? }`.
- Extend `/infra/bootstrap` with a `slugScopes` map of the five named scope unit ids. Cached permanently on the client, invalidated on app version stamp bump.
- Add typed by-slug endpoints (`GET /user/by-slug/:slug`, `/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug`, `/entity/by-slug/:slug`, `/shelf/by-slug/:userSlug/:slug`) and a generic `POST /slug/resolve` resolver that accepts either a named scope or an owner unit id.
- Repeal the "User PK is `userId`" and "User SHALL NOT be a Unit subtype" requirements in `user-domain-decoupling`. The rest of that spec (attribution decoupling, `accountStatus` removal) stays.

## Capabilities

### New Capabilities

_None._ All touched capabilities already exist; this change modifies their requirements rather than introducing a new capability.

### Modified Capabilities

- `unit-slug`: remove `SHELF` and `USER` from the rejection list; introduce per-type scope semantics; add `slugScope` to the slug uniqueness key.
- `slug-validation`: unify reserved-word rules into a **single flat list** in `@rezics/contract` applied uniformly to every scope. The list folds in owner-path segments (`profile`, `settings`, `shelf`, `post`, `list`) and system-shelf slug values (`favorites`, `backlog`, `active`, `completed`) so users cannot manually claim them in any scope. System-slug minting paths (e.g., bootstrap-time shelf creation) read from the contract constant directly and SHALL bypass `validateSlug` — the reserved list would otherwise reject the slug it is itself installing. Add typed-error rejection for `ENTITY` slug writes (gated until `entity-slug-activation`).
- `slug-ref`: extend `SlugRef` to carry `scope` (named scope or owner unit id) alongside `slug`.
- `typed-slug-lookup`: add `/user/by-slug/:slug`, `/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug`, `/entity/by-slug/:slug`, `/shelf/by-slug/:userSlug/:slug`, and generic `POST /slug/resolve`. Update `/infra/bootstrap` shape to include `slugScopes`.
- `public-short-routes`: rewrite around the short=slug / long=unitId convention; document the five short-prefix routes, the five long-prefix UUID routes, and `/unit/:unitId` as the universal fallback. **Remove `/unit/:slug`**.
- `account-identity-boundary`: new invariant `User.unitId ≡ Unit.id where type=USER`. Migrate the "User.slug is canonical" requirement to "Unit.slug under user scope is canonical". Document v1 immutability of user slugs.
- `user-domain-decoupling`: repeal the "User PK is `userId`" and "User SHALL NOT be a Unit subtype" requirements; preserve everything else.
- `attribution`: verify all `userId` references resolve correctly under the renamed `User.unitId` PK; clarify that attribution-bearing references continue to use `userId` semantically even where the column name is preserved on related tables.
- `shelf-collection`: permit `SHELF` slugs under the user owner scope (substrate) and document that v1 owner-scoped slugs are reserved for contract-defined system shelves; user-created shelves remain slug-less and resolved by `unitId`.

## Impact

**Affected packages**

- `package/server` — Prisma schema (`UnitType` enum, `SlugScope` table, `Unit.slugScope` column, `User.unitId` rename), seed bootstrap (five scope placeholder units), shelf / user / slug / tag / realm / zone / entity services, slug resolver, infra-bootstrap endpoint, all `*.api.ts` modules that mount typed `by-slug` routes.
- `package/contract` — `SlugRef` shape, `/infra/bootstrap` response, new `by-slug` and `/slug/resolve` endpoint schemas, `User` DTO (`userId` → `unitId`).
- `package/api` — TanStack Query hooks for new endpoints; rename `user.userId` → `user.unitId` across query options.
- `package/app` — Route table (add `/u/:slug`, `/r/:slug`, `/t/:slug`, `/z/:slug`, `/e/:slug`, long-prefix UUID routes, `/u/:userSlug/shelf/:slug`; remove `/unit/:slug`). Update SlugRef hook usage. Update `viewer` consumers to read `unitId`.
- `package/admin` — Update user-listing / user-detail surfaces to use `unitId`.
- `package/search` — Meili documents: USER documents now key on `unitId` (same UUID, no rekey required); add searchable `slug` + scope context for `/slug/resolve` autocompletion.
- `prisma/seed/` (server) — Seed the five `SlugScope` rows and their placeholder `Unit { type: SCOPE }` rows before any other slug-bearing unit is created.

**Data migration**

- Backfill `Unit { type: USER, id = User.userId, slug = null }` for every existing user.
- Backfill `Unit.slugScope` for every existing slug-bearing Unit (TAG / REALM / ZONE / USER → matching type-scope unit id).
- Move `User.slug` values into `Unit.slug` under the user scope; drop `User.slug`.
- Rename `User.userId` PK to `User.unitId`; preserve FK column names on related tables (`userId` semantically still references a user — only the User PK field is renamed).
- Drop the legacy global unique on `Unit.slug`; apply `@@unique([slugScope, slug])`.

**Backward compatibility**

The project's `CLAUDE.md` disallows backward-compatible aliases unless explicitly granted. This change grants the following narrow exceptions, all justified by external URL stability:

- `/u/:userSlug` and `/r/:realmSlug` keep their canonical URL shape; only internal resolution is upgraded.
- `User.userId` rename follows the "one clean breaking cutover" rule — no dual-read window.
- `/unit/:slug` is removed without alias (internal-only; no known external dependency).
- `/@:slug` is not introduced and not aliased.
- User slugs are immutable post-set in v1 — no alias / 301 / 410 surface area.
- User-created shelves remain slug-less in v1.

**Downstream unblock**

- L1 `shelf-system-slugs` (mints `favorites` / `backlog` / `active` / `completed` under each user).
- `entity-slug-activation` (flips the ENTITY scope writable).
- `engagement-subscription` (depends on `User.unitId` as the prerequisite for `subscriberUnitId`).
