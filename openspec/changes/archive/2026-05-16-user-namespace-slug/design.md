## Context

This change bundles two orthogonal architectural commitments because both touch the User PK and the Unit slug topology in the same migration window:

1. **User-as-Unit** — `User.userId` is renamed to `User.unitId` and a sibling `Unit { type: USER, id = User.unitId }` row is created. The primary motivation is unification of owner / reference / mention / attribution identity, and the prerequisite for `engagement-subscription` (`subscriberUnitId` and `targetUnitId` both being Unit ids).
2. **Per-type slug scopes** — the global `Unit.slug` unique constraint becomes `(slugScope, slug)`. Five named infrastructure scopes (`user`, `realm`, `tag`, `zone`, `entity`) carry top-level identities; owner-scoped slugs (e.g., shelves under a user) point `slugScope` directly at the owner unit's id. The slug subsystem stops fighting itself: `User.slug` and `Unit.slug` no longer live in two parallel universes.

The change also rewrites the public URL surface around a single convention — **short prefix = slug, long prefix = unitId** — and removes `/unit/:slug` without alias.

**Current state**

- `Unit.slug` is globally unique; only `TAG`, `REALM`, and `ZONE` may carry a slug (`openspec/specs/unit-slug/spec.md`).
- `User.slug` is canonical Rezics product identity (`openspec/specs/account-identity-boundary/spec.md`); it lives on the `User` table, not on a Unit row.
- `User` is an independent root with PK `userId` and is explicitly NOT a Unit subtype (`openspec/specs/user-domain-decoupling/spec.md` requirement "User table primary key is `userId`").
- `/u/:userSlug` resolves the user slug namespace; `/unit/:unitSlug` resolves the Unit slug namespace; `/unit/id/:unitId` resolves Unit ids (`openspec/specs/public-short-routes/spec.md`).
- Five typed `by-slug` endpoints exist for realm, tag, zone (`openspec/specs/typed-slug-lookup/spec.md`); `/infra/bootstrap` returns `seedTags` and `defaultRealmId`.
- Slug validation reserves a platform-wide flat list (`openspec/specs/slug-validation/spec.md`).
- `SlugRef` is a `{ slug, unitId? }` pair (`openspec/specs/slug-ref/spec.md`).

**Stakeholders**: `package/server`, `package/contract`, `package/api`, `package/app`, `package/admin`, `package/search`, `prisma/seed/`.

## Goals / Non-Goals

**Goals:**

- Land User-as-Unit in one breaking cutover: rename `User.userId` → `User.unitId`, backfill `Unit { type: USER }` rows, add `USER` and `SCOPE` enum variants.
- Introduce the `SlugScope` table, the `Unit.slugScope` column, and the composite `(slugScope, slug)` unique. Seed five infrastructure scope rows.
- Migrate `User.slug` values into `Unit.slug` under the user scope and drop `User.slug`. User slugs become immutable in v1.
- Rewrite the public URL surface: short=slug / long=unitId; remove `/unit/:slug`; add the long-prefix UUID family; add `/u/:userSlug/shelf/:slug` for user-owned shelves. `/r/:realmSlug/shelf/:slug` remains the documented future extension shape, but is not opened by this change.
- Add typed by-slug endpoints for `user`, `entity`, and owner-scoped shelf; add a generic `POST /slug/resolve` resolver; extend `/infra/bootstrap` with `slugScopes`.
- Extend `SlugRef` to carry `scope` (named scope or owner unit id).
- Gate ENTITY slug writes at the service layer (typed-error rejection) so the substrate is in place but no entity can be slug-created until `entity-slug-activation` ships.
- Permit `SHELF` slugs under user owner-scope (substrate only — actual minting is owned by `shelf-system-slugs`).

**Non-Goals:**

- Mint system shelf slugs — owned by the follow-on `shelf-system-slugs` (L1).
- Enable entity slug writes or ship the entity-creation flow — owned by `entity-slug-activation`.
- Introduce `Subscription` or retire `Follow` — owned by `engagement-subscription`.
- Add any protective cross-scope claim / warning / ownership policy when `alice` exists as both a user and a realm slug. This change decides the baseline resolution semantics only: cross-scope same-name slugs are allowed and imply no relationship.
- User slug rename / alias / 301 / 410 surface — explicitly out of scope for v1 (§6.3).
- User-created shelf custom slugs — substrate permits, write surface stays closed (§6.10).
- Cross-service protocol for delivering broadcast recipients from `package/server` to `package/notify` — separate design discussion (§8 footnote).

## Decisions

### D1: Five named SlugScope rows backed by SCOPE-type Units, no `master` scope

**Decision**: `SlugScope` is a lookup table seeded with exactly five rows: `user`, `realm`, `tag`, `zone`, `entity`. Each row references a placeholder `Unit { type: SCOPE, slug: null }` whose id is the value of `Unit.slugScope` for every top-level slug under that scope. There is no `master`/global scope.

**Why**: The plan explicitly chose per-type scopes over a single master scope so that USER and REALM live in independent uniqueness universes — `alice` can in principle exist as both a USER slug and a REALM slug. A master scope would re-create the very collision pressure the change exists to eliminate.

**Alternatives considered**:

- *Single global namespace* (status quo). Rejected: the asymmetry between `User.slug` and `Unit.slug` already proves it doesn't compose.
- *Enum-backed scopes (no `SlugScope` table)*. Rejected: owner-scoped slugs (shelves under a user) need `slugScope` to point at any Unit id, not a fixed enum value. A unified `slugScope @db.Uuid` column subsumes both cases.
- *Self-referencing `Unit.slugScope` defaulting to `id`*. Rejected: indexes on a column that can equal `id` for some rows and another Unit id for others get harder to reason about during query planning; the explicit `SlugScope` table makes the intent legible.

### D2: `slugScope` is NOT NULL, but has no FK constraint

**Decision**: `Unit.slugScope String @db.Uuid` is NOT NULL and always points to a valid `Unit.id` — either a `SlugScope` row's placeholder unit (for top-level slugs) or an owner unit (for owner-scoped sub-resources). No FK constraint is declared.

**Why**: Consistent with the existing precedent in `ShelfUnit.unitId` and `ShelfItem.itemRef` (see `openspec/specs/shelf-structure/spec.md`). Avoiding the FK lets us seed the five `SCOPE` units with a self-reference (`slugScope = self.id`) in a single transaction without intermediate constraint violations, and matches the codebase's existing reference-but-don't-FK convention for polymorphic-shaped columns.

### D3: Composite unique `(slugScope, slug)` with nullable `slug`

**Decision**: A single `@@unique([slugScope, slug])` index replaces the existing global unique on `Unit.slug`. `Unit.slug` stays nullable; Postgres treats `NULL ≠ NULL`, so multiple slug-less units coexist without partial indexes.

**Why**: Simplest possible substrate that satisfies the uniqueness requirements. `(slugScope, NULL)` does not fire the unique check, so no special handling is needed for the bulk of Units that never get a slug.

**Alternatives considered**:

- *Partial unique index `WHERE slug IS NOT NULL`*. Rejected: redundant — Postgres already excludes NULL from the composite unique by default — and adds a Prisma-vs-raw-SQL surface that Prisma 7 does not directly model.
- *Empty string instead of NULL*. Rejected: `''` would collide on `(slugScope, '')` for every slug-less unit under the same scope; would need workarounds.

### D4: Owner-scoped slugs use the owner's `Unit.id` as `slugScope`

**Decision**: For sub-resources whose namespace is "owned by another Unit" (currently SHELF under USER, plus the planned future SHELF under REALM), `slugScope = owner.id`. The owner is itself a Unit, so the same column carries both top-level scope ids and owner ids.

**Why**: One column, two cases — the discriminator is whether the referenced unit is `type = SCOPE` or any other type. Routes can be built without knowing in advance whether a sub-resource is owner-scoped or scope-scoped.

### D5: Slugs are unique per `(slugScope, slug)` regardless of type — same-name multi-type is mutually exclusive under one owner

**Decision**: Under a user, `favorites` cannot be both a SHELF and a future LIST. The URL prefix segment (`/u/:userSlug/shelf/:slug` vs `/u/:userSlug/list/:slug`) keeps the public surface unambiguous, but the underlying slug ownership is exclusive.

**Why**: Confirmed in plan §6.7. If product later wants per-type same-name (`books` shelf + `books` list), this is reopened as a `(slugScope, slug, type)` migration. v1 prioritizes substrate simplicity.

### D6: Short prefix = slug, long prefix = unitId — no mixing, no fallback

**Decision**: `/u/:slug` and `/user/:unitId` are two distinct, non-overlapping route families. Short-prefix routes accept only slugs (404 on UUID-shaped input); long-prefix routes accept only UUIDs (404 on slug-shaped input). `/unit/:unitId` is the universal UUID fallback. `/unit/:slug` is removed without alias.

**Why**: The current `/unit/:unitSlug` and `/unit/id/:unitId` split is harder to scan visually — both start with `/unit/`. A single rule ("short means slug, long means unitId") makes every URL classifiable at a glance.

**Alternatives considered**:

- *Keep `/unit/:unitSlug`*. Rejected: the route is internal-only; no external URL is known to depend on it; the dual `/unit/...` family is the exact ambiguity this change eliminates.
- *Use `/@:slug` for users*. Rejected in plan §4.2 — already not part of the public URL surface; introducing it doubles the slug-prefix vocabulary for no gain.

### D7: User slugs are immutable in v1

**Decision**: Once `Unit.slug` is set on a USER unit, no rename surface is exposed. `userService.update` rejects `slug` fields with a typed error. No admin override, no `UserSlugAlias` table, no 301 redirect, no 410 gone.

**Why**: §6.3 of the plan. Immutability eliminates the entire alias / SEO / outbound-link-stability surface area and keeps `(slugScope, slug)` strictly write-once for the USER scope. The constraint is a v1 product decision, not a substrate limit — the schema fully supports a future rename when product signals demand it.

### D8: ENTITY scope is seeded write-disabled at the service layer

**Decision**: The `entity` `SlugScope` row exists from L3 day one, but every ENTITY slug creation attempt (POST / PUT / PATCH paths) returns a typed error. The follow-on `entity-slug-activation` change flips the gate.

**Why**: §6.2. The USER↔ENTITY product relationship is not finalized; gating writes (rather than omitting the scope) keeps the substrate symmetric with the other four scopes and lets the follow-on change focus on policy rather than substrate.

### D9: Client never passes raw scope UUIDs

**Decision**: The client interacts with scopes through either (a) typed endpoints whose path encodes the scope (`/user/by-slug/:slug`, `/shelf/by-slug/:userSlug/:slug`, etc.), or (b) the generic `POST /slug/resolve` which accepts a named scope (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`) or an owner unit id.

**Why**: The five scope UUIDs are bootstrap-time constants; exposing them as raw URL segments would make every client URL fragile to a re-seed. Named scopes are stable; owner unit ids are already-known values the client carries.

### D10: `/infra/bootstrap` shape changes — accepted breaking change

**Decision**: Add a `slugScopes: { user, realm, tag, zone, entity }` map. Override the existing `typed-slug-lookup`'s "Bootstrap response shape is stable" requirement (which currently says adding fields constitutes a breaking change requiring a new path).

**Why**: The existing stability clause was written before per-type scopes were planned. Bumping the shape once with full rename of the requirement is preferable to versioning the endpoint. The five UUIDs are cached permanently on the client, invalidated by app version stamp bump (plan §6.5).

### D11: FK column names on related tables stay `userId`

**Decision**: Only the `User` PK field is renamed (`userId` → `unitId`). FK columns on related tables (`Unit.userId`, `WorkLinkClaim.claimerUserId`, `Follow.followerId`, `ApiToken.userId`, etc.) keep their current names; the `references: [...]` target is updated to `User.unitId`.

**Why**: Minimizes the call-site rename surface. The columns semantically still reference a user — the new PK name is the only place the unit-as-user-identity becomes visible. The user-facing DTO field (`user.userId` → `user.unitId`) is the visible cutover; the rest is FK plumbing.

### D12: Bio / name stay on User extension

**Decision**: Do not migrate `User.name`, `User.bio`, `User.avatar` into `UnitTranslation` as part of this change. They stay on the User type-extension row.

**Why**: Scope discipline. The L3 architectural lift is User-as-Unit identity plus per-type slug scopes; broadening it to also adopt UnitTranslation for user-facing strings doubles the migration surface. A follow-on change can adopt UnitTranslation once the identity cutover is stable.

### D13: Reserved words are a single unified flat list

**Decision**: `slug-validation` uses **one** reserved-word list, exported from `@rezics/contract`, applied uniformly to every scope (`user`, `realm`, `tag`, `zone`, `entity`, and owner-scopes). The list folds in three categories of reservation that were once modeled separately:

1. **Global platform terms** — admin, login, api, profile, settings, etc.
2. **Owner-path segments** — `profile`, `settings`, `shelf`, `post`, `list` (the type-prefix segments under owner-scope URLs).
3. **System-minted slug values** — `favorites`, `backlog`, `active`, `completed` and any future contract-defined system slug.

`validateSlug` consults this single list regardless of which `scope` is passed. The `scope` argument still drives **uniqueness lookup** against `(slugScope, slug)`, but it does NOT drive reserved-word selection.

System-slug minting paths (e.g., bootstrap-time shelf creation) bypass `validateSlug` entirely and read the slug value from the contract constant. The reserved list would otherwise reject the slug it is itself installing; bypassing also matches the fact that these inputs are not user-supplied and need neither format nor reservation checks.

**Why**: An earlier draft used a two-layer model (per-scope + per-owner). The motivating example was "`shelf` should be reserved under a user but allowed as a tag slug." In practice, that flexibility is not worth the policy complexity: confusing UI and unsafe slug shapes both get worse when the same string is meaningful in one scope and meaningless in another. A single flat list keeps the implementation tiny (one `Set` lookup), keeps the contract surface predictable, and the small loss of expressiveness (a few extra strings being globally reserved) is acceptable.

System-slug bypass is its own subtle correctness rule: the slug `favorites` MUST be unmintable by users (so it stays on the reserved list) AND mintable by the platform's bootstrap path (so the path skips `validateSlug`). This is "by construction" rather than a special case in the validator.

### D14: USER, REALM, and ENTITY same-name slugs are allowed but unrelated

**Decision**: The L3 baseline allows the same normalized slug to exist independently in the USER, REALM, and (once `entity-slug-activation` ships) ENTITY named scopes. For example, `alice` MAY resolve as `/u/alice`, `/r/alice`, and `/e/alice` simultaneously. None of these records are linked by slug equality: there is no ownership, affiliation, claim, redirect, fallback, or verification semantics implied by the shared text.

Routes SHALL resolve exactly one scope. `/u/alice` queries only the USER scope; `/r/alice` queries only the REALM scope; `/e/alice` queries only the ENTITY scope. A 404 in one scope SHALL NOT fall back to another.

ENTITY scope tightens this further on the write side, not on the substrate side: ENTITY slugs are admin-only (see `entity-slug-activation`), so a same-text ENTITY can only appear after admin discretion. The substrate, however, places no cross-scope constraint.

Protective product policy is explicitly deferred. A follow-on change MAY add warnings, creation-time checks, claim flows, or same-slug linking across scopes, but that policy SHALL layer above this substrate and SHALL NOT require changing the `(slugScope, slug)` model.

**Why**: This is the point of per-type scopes — distinct public prefixes carry distinct identity namespaces. Reintroducing hard mutual exclusion across scopes would partially recreate the global namespace pressure this change removes. The short-prefix route table gives enough context for users and systems to distinguish resources, while leaving product free to add softer protection later.

### D15: Owner soft-delete keeps owner-scoped slug namespaces reserved

**Decision**: Owner-scoped slugs use the owner's `Unit.id` as `slugScope`. In the current product stage, USER and REALM hard deletion is not supported; deletion is a marker/state change only. Therefore owner-scoped namespaces are not released by this change, and no cascading cleanup or slug reuse path is introduced for user-owned shelves.

If a future change supports hard deletion or slug release, it MUST define the release policy explicitly: whether owner-scoped child slugs are tombstoned, reassigned, anonymized, deleted, or made available for reuse.

**Why**: The absence of an FK on `Unit.slugScope` does not create an orphaning problem while owners are never physically deleted. Treating deletion as a soft marker preserves URL stability and matches the v1 stance that user slugs are immutable and not released.

## Risks / Trade-offs

- **`User.userId` → `User.unitId` rename surface** → Mitigation: column-name preservation on FK tables (D11) cuts the rename to the User PK field plus the user-facing DTO. Frontend cutover is the largest user-visible side; planned as one breaking commit, no dual-read window.
- **Bootstrap ordering: SlugScope rows must exist before any other slug-bearing Unit** → Mitigation: run as part of `prisma/seed/` infra bootstrap (idempotent), not in factory. Order: (a) create five `SCOPE` units with placeholder `slugScope`, (b) self-reference `slugScope = self.id`, (c) insert `SlugScope` rows.
- **Backfill of existing slug-bearing Units** → Mitigation: deterministic mapping `Unit.type → scope` for TAG / REALM / ZONE / USER. Non-slug-bearing Units with an owner get owner-id backfill; otherwise default to a sensible scope placeholder. Backfill runs atomically with the unique-index swap so no row exists outside its new scope window.
- **Short/long URL split discipline** — developers may be tempted to add `/u/:unitId` "for convenience" or `/user/:slug` mistakenly → Mitigation: convention enforcement via `bun run check:convention` (new rule R-N catching mixed-identifier route params). Document in `CONTRIBUTING.md` once the spec lands.
- **`/unit/:slug` removal breaks any caller that uses it** → Mitigation: grep the monorepo for `/unit/${` and `/unit/:unitSlug` references during implementation; migrate internal callers to typed by-slug routes. The plan explicitly accepts this as an internal-only break.
- **Same-name USER/REALM collisions (§6.9)** — substrate allows `alice` to exist in both scopes and treats the two identities as unrelated → Mitigation: D14 makes exact-scope resolution mandatory; any warning / claim / linked-identity policy is a separate product change without substrate work.
- **Meili search rekey** — USER documents already key on `userId` (a UUID); since `unitId == userId` post-migration, no rekey is required → Mitigation: verify by running the Meili sync end-to-end on a staging dataset before flip.
- **`/infra/bootstrap` shape break** — existing clients that cache the response on disk will see new keys → Mitigation: D10 — the client invalidates on app version stamp bump. Older clients tolerate unknown keys (Typebox parses additional fields without rejecting).

## Migration Plan

The migration runs in three phases inside a single deploy window. All steps are idempotent except the column rename (which is one-shot).

**Phase 3a — User-as-Unit**

1. Extend `UnitType` enum: add `USER`, `SCOPE`.
2. For each existing `User` row, create `Unit { id = User.userId, type = USER, slug = null, slugScope = TBD }` (slugScope filled in Phase 3b). This is back-fill; the UUIDv7 already on User becomes Unit.id verbatim.
3. Rename `User.userId` → `User.unitId` (Prisma `@map` on the column if needed to preserve the physical column name during the cutover; the field name is what call sites read). FK column names on related tables are preserved (D11); only `references: [User.unitId]` is updated.
4. Update `userService` and all consumers to read `user.unitId`. Update `@rezics/contract` user-shaped DTOs (`User`, `UserBrief`, `UserSummary`, profile responses) to expose `unitId` instead of `userId`.
5. Repeal the `user-domain-decoupling` requirements "User table primary key is `userId`" and "User DTOs expose `userId`, never `unitId`". Preserve the attribution-decoupling and `accountStatus`-removal requirements.

**Phase 3b — SlugScope structure**

1. Create the `SlugScope` table.
2. Seed the five scope placeholder Units (`user`, `realm`, `tag`, `zone`, `entity`) with the bootstrap snippet from plan §4.4. Each gets a `Unit { type: SCOPE, slug: null }` row followed by a self-reference `slugScope = self.id` update, followed by a `SlugScope` row.
3. Add `Unit.slugScope @db.Uuid` column. Backfill:
   - TAG / REALM / ZONE / USER units → `slugScope = <typeScope>.unitId`.
   - Units owned by another Unit (e.g., shelves) → `slugScope = ownerUnit.id`. For the L3 boundary, shelves remain slug-less, so they get a deterministic default (e.g., owner-user-id when an owner user is set; otherwise the user scope placeholder).
   - All other slug-less Units → a sensible scope placeholder (the entity scope or the tag scope, decided during implementation; the choice doesn't affect uniqueness because their slug is NULL).
4. Move existing `User.slug` values into `Unit.slug` for the matching USER Unit, with `slugScope = userScope.unitId`. Drop `User.slug` column.
5. Apply `@@unique([slugScope, slug])`; drop the legacy global unique on `Unit.slug`.
6. Update `/infra/bootstrap` to include the `slugScopes` map.

**Phase 3c — URL & route surface**

1. Add short-prefix slug routes that don't yet exist: confirm `/u/:userSlug`, `/r/:realmSlug`, `/t/:tagSlug`, `/z/:zoneSlug` are present; add `/e/:entitySlug` (404 until `entity-slug-activation` flips entity creation on, but the route shape exists).
2. Add long-prefix UUID routes: `/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`. Each rejects slug-shaped input.
3. Keep `/unit/:unitId` as the universal UUID fallback.
4. **Remove** `/unit/:slug` (currently `/unit/:unitSlug`). Internal callers grep'd and migrated to typed by-slug routes during implementation.
5. Add `/u/:userSlug/shelf/:slug`. The route exists, but the resolver returns 404 for any non-system-shelf slug in v1 (system shelves don't exist until `shelf-system-slugs` ships, so initially this is a 404-only route). Do not open `/r/:realmSlug/shelf/:slug` in this change; it remains the future extension shape for realm-owned shelves.
6. Add the generic `POST /slug/resolve` endpoint.
7. Add typed by-slug endpoints `/user/by-slug/:slug`, `/entity/by-slug/:slug`, and `/shelf/by-slug/:userSlug/:slug`. Confirm the existing `/realm/by-slug/:slug`, `/tag/by-slug/:slug`, `/zone/by-slug/:slug` still work post-migration; their backing query now goes through `(slugScope, slug)` with the scope inferred from the endpoint path.

**Rollback strategy**

The change is one breaking cutover with no dual-read window. Rollback within the deploy window is by restoring the pre-migration database snapshot and reverting the deploy. Once post-migration writes have happened (new users registering, new slugs being claimed), rollback is not supported — forward fix only. This matches the project's "one clean breaking cutover" stance per `CLAUDE.md`.

## Open Questions

1. **Backfill default for slug-less, owner-less Units** — should it be the entity scope placeholder, or a dedicated `default` scope row? Decision belongs in the implementation phase; doesn't affect uniqueness because slug is NULL.
2. **Whether `Unit.slug @map("slug")`-style Prisma renames are needed** to keep physical column stable during the rename, or whether a clean physical rename is acceptable. Decision: prefer clean physical rename unless prod-data export tooling depends on the column name.
3. **R-N convention rule** — exact lint shape for the "short prefix accepts only slug, long prefix accepts only UUID" rule. Owned by the implementation phase; the spec just states the rule.
