# Shelf Completion & User Namespace Slug Plan

**Status**: Draft plan, pre-proposal
**Date**: 2026-05-14
**Scope**: Wire the Shelf feature into a fully usable state, then graduate the Unit graph by promoting User into Unit (for unitId reuse and Follow/Subscription unification) and graduate the slug subsystem to per-type scopes that keep User, Realm, Tag, Zone, and Entity in independent uniqueness universes.

---

## 1. Motivation

The Shelf feature is functionally near-complete on the API surface but blocked by three structural gaps:

1. **System shelf resolution**: Each user owns a fixed set of contract-defined shelves (`favorites`, `backlog`, `active`, `completed`). The server already maintains a `User.extra.shelves` map and auto-creates missing ones, but no frontend-facing endpoint exposes that map. `ShelfAction` cannot reliably resolve the user's `favorites` shelf for instant interaction.

2. **Broken tag chain**: `CollectionModal` filters shelves by seed tags (`book`/`game`/`media`/`post`/`link`) via `shelf.tags`, but neither `ShelfEditPage` nor `NewShelfPage` exposes a tag picker. The filter has no upstream feed. Today this only works for seed-generated demo shelves where `tagIds` were populated at creation time.

3. **User is not a Unit, and Shelf has no slug**. Two intertwined structural gaps:

   **3a. User is not part of the Unit graph.** `User.userId` and `Unit.id` are in separate identity universes. This blocks two things:
   - Any reference that wants to point "owner / subject / mention" uniformly at a Unit must still special-case User.
   - Subscription cannot be unified into a single `Subscription(subscriberUnitId, targetUnitId, kind)` shape because subscriber side (`User`) and target side (`Unit`) have asymmetric identity. Today's `Follow` is therefore user→user only and cannot extend to realm / book / tag / shelf targets without forking into multiple per-domain tables.

   **3b. Shelf and other owner-scoped units cannot carry slugs.** Current `unit-slug` spec rejects slugs on `SHELF`. There is no addressable identity for `alice/favorites`. Every URL must be UUID-based. This blocks the "Shelf cache via SlugRef" pattern that the rest of the slug system already uses for TAG / REALM / ZONE.

   Additionally, even for top-level slugs, `User.slug` and `Unit.slug` live in two parallel uniqueness universes. The current `public-short-routes` spec documents `/u/:slug` and `/unit/:slug` as non-overlapping namespaces. With User joining the Unit graph, this duality must be reconciled — by graduating the slug subsystem to **per-type scopes** so that USER, REALM, TAG, ZONE, ENTITY each get an independent uniqueness universe inside the same Unit table.

This plan addresses all three, with an explicit execution order chosen so that the largest architectural lift (L3) eliminates the work needed for L1.

---

## 2. Execution Order

```
   L2 (tag chain)  →  L3 (user-as-unit + scoped slug)  →  L1 (system shelf access)
   ─────────────      ──────────────────────────────       ───────────────────────
   Independent        Two orthogonal commitments:           Becomes a thin client
   UX cleanup;        (a) User-as-Unit                       consumer of L3's slug
   ships today        (b) per-type slug scopes               system, NOT its own
                      Bundled because both touch User        endpoint
                      identity and Unit slug topology
```

**Why this order:**

- L2 is independent and ships value immediately. It does not touch identity / slug architecture.
- L3 is the architectural foundation. Doing it before L1 means L1's "expose system shelves to the frontend" reduces from a custom endpoint to "use the slug system; the shelf is at `/u/:userSlug/shelf/favorites`".
- L1 last collapses to standard `/shelf/by-slug/:userSlug/:slug` resolution + SlugRef caching, with zero new domain endpoints needed.

---

## 3. L2 — Shelf Tag Pinned Chain

**Goal**: Make `CollectionModal`'s seed-tag filter actually usable by giving shelf owners a way to pin tags on their shelves.

**Substrate** (already in schema):
- `UnitTag.pinned: Boolean @default(false)` exists at `package/server/prisma/schema.prisma:614`.
- `shelfDTO.tags` already includes tag IDs and scores.

**Changes**:

| Area | Change |
| --- | --- |
| `ShelfEditPage` / `NewShelfPage` | Add a SEED_TAG chip selector (single or multi — TBD in proposal). Selecting a chip upserts `UnitTag(unitId=shelfId, tagUnitId=seedTagId, pinned=true)`. Deselecting deletes or sets `pinned=false`. |
| `shelfService.update` / `create` | Accept `tagIds` (already exists in `createShelfSchema`); add tag mutation API for edit path. |
| `shelf.mapper` serialization | When projecting `shelfDTO.tags`, filter to `pinned=true` only. |
| `CollectionModal` filter query | No code change — already filters by `shelf.tags`, which now reflects only pinned tags. |

**Impacted specs**:
- `profile-shelves-tab` (chip surface)
- `shelf-seed-tags` (may need extension for pinned semantics)
- `engagement-shelf-action` (downstream UX consumer)

**Risk**: low. Pure additive UI + one query filter tweak. No schema migration.

**Estimate**: 1–2 days.

---

## 4. L3 — User-as-Unit + Per-Type Slug Scopes

This is the architectural cornerstone. **Two orthogonal commitments bundled together** because both touch User identity and the Unit slug topology in the same migration window:

1. **User becomes a Unit type-extension** (`User.unitId @id`, with a corresponding `Unit { type: USER }` row sharing the same UUID).
   - **Primary motivation**: unified `unitId` for owner / reference / mention / attribution, and the architectural prerequisite for `Follow` graduating into a generic `Subscription(subscriberUnitId, targetUnitId, kind)`. This benefit is **independent of slug topology** — it would be worth doing even if slug shape didn't change.

2. **The slug subsystem gains per-type scope structure** via a new `slugScope` column on Unit and a small `SlugScope` lookup table. **Five named infra scopes**: `user`, `realm`, `tag`, `zone`, `entity`. **No `master` scope** — USER and REALM live in separate uniqueness universes; the same slug (e.g., `alice`) may in principle exist as both a user and a realm, with cross-scope policy decided independently by product (see 6.9).
   - **Why bundled with User-as-Unit**: putting USER under a `user` scope only makes sense once User is a Unit. The two changes co-modify schema atomically.

### 4.1 Scope Topology (Final)

```
SlugScope table (seed — 5 rows):
  ┌─────────┬────────────────────────────────────────┐
  │ slug    │ Houses                                 │
  ├─────────┼────────────────────────────────────────┤
  │ user    │ USER                                   │
  │ realm   │ REALM                                  │
  │ tag     │ TAG                                    │
  │ zone    │ ZONE                                   │
  │ entity  │ ENTITY (authors, characters)           │
  └─────────┴────────────────────────────────────────┘

Owner-scoped slugs (slugScope = ownerUnitId, NOT a SlugScope row):
  ┌─────────────────────┬──────────────────────────────────────┐
  │ Under USER          │ SHELF (future: LIST, etc.)          │
  │ Under REALM         │ SHELF (future: events, themes)      │
  └─────────────────────┴──────────────────────────────────────┘

(slugScope, slug) is unique. Multiple types may live under one owner
but cannot collide on the same slug — same-name multi-type is mutually
exclusive by design (see 6.7).

No slug: BOOK, GAME, MEDIA, POST, IMAGE, VIDEO, QUOTE, LINK, CHAPTER.
```

### 4.2 URL Alignment

**Convention**: **short prefix = slug, long prefix = unitId**. The two prefix families never mix purposes; a URL can be classified at a glance.

```
Slug-by-type (short prefix, slug only — never accepts UUID):
  /u/:userSlug                user profile / 专页
  /u/:userSlug/profile        explicit profile card
  /u/:userSlug/settings       user backstage (self only)
  /u/:userSlug/shelf/:slug    user-owned shelf (owner-scoped)
  /u/:userSlug/post/:slug     user-authored post
  /r/:realmSlug               realm
  /r/:realmSlug/post/:slug    realm-hosted post
  /r/:realmSlug/shelf/:slug   realm-owned shelf (future)
  /t/:tagSlug                 tag
  /z/:zoneSlug                zone
  /e/:entitySlug              entity (author / character — gated, see 6.2)

UnitId-by-type (long prefix, UUID only — never accepts slug):
  /user/:unitId               user by UUID
  /realm/:unitId              realm by UUID
  /tag/:unitId                tag by UUID
  /zone/:unitId               zone by UUID
  /entity/:unitId             entity by UUID

Universal unitId fallback:
  /unit/:unitId               any Unit by UUID; may type-redirect when type is known

System routes (root reserved):
  /login /api /settings /admin /help ...

Removed in this change:
  /@:slug                     — @ prefix not introduced
  /unit/:slug                 — /unit no longer resolves slugs
```

Rationale:

- `/u/alice` is unambiguously a slug. If `alice` is not a registered user slug → 404.
- `/user/01abc...` is unambiguously a UUID. If not a USER Unit → 404.
- `/unit/01abc...` is the generic UUID lookup that may redirect to its typed long-prefix route once the type is read.
- Owner sub-resources always use a **type prefix** segment (`shelf/`, `post/`, …) so that the owner's reserved-word table stays small and future types coexist without renaming.

### 4.3 Schema (Final Form)

```prisma
enum UnitType {
  BOOK GAME MEDIA POST TAG REALM SHELF IMAGE VIDEO QUOTE LINK
  CHAPTER ENTITY ZONE
  USER     // new — User is a Unit extension
  SCOPE    // new — namespace placeholder unit
}

model Unit {
  id         String   @id @default(uuidv7()) @db.Uuid
  type       UnitType
  slug       String?
  slugScope  String   @db.Uuid              // NOT NULL — points to a SlugScope.unitId OR another Unit (owner-scope)
  userId     String?  @db.Uuid              // creator (unchanged semantics)
  // ... existing fields

  @@unique([slugScope, slug])
}

model SlugScope {                            // new — 5 seeded rows
  slug    String @id                          // 'user' 'realm' 'tag' 'zone' 'entity'
  unitId  String @db.Uuid @unique            // the SCOPE-type Unit for this scope
}

model User {
  unitId      String  @id @db.Uuid           // renamed from userId; = Unit.id where type=USER
  authUserId  String? @unique
  email       String?
  name        String?
  avatar      String?
  bio         String?
  permission  Json?
  settings    Json?
  // slug field removed (moved to Unit.slug under slugScope = userScope.unitId)
  // followersCount / followingsCount stays for now — decided alongside
  //   subscription unification (see 6.1)
  // ... rest of User extension fields
}
```

**Key properties**:

- `slugScope` is **NOT NULL**, always points to a real `Unit.id`. For top-level identity (USER / REALM / TAG / ZONE / ENTITY), it points to one of the five `SlugScope` rows' `unitId`. For owner-scoped sub-resources (a shelf under alice), it points directly to the owner unit's id.
- `Unit.slug` is nullable. Most units have no slug; uniqueness on `(slugScope, slug)` does not fire when `slug IS NULL` because Postgres treats `NULL ≠ NULL`. A single composite unique index is sufficient — no partial indexes required.
- `slugScope` has **no FK constraint**, consistent with the existing precedent in `ShelfUnit.unitId` / `ShelfItem.itemRef` (see `shelf-structure` spec).
- `SCOPE` placeholder units have `slug = NULL` and `slugScope = self.id` (harmless self-reference because `NULL` slugs do not participate in the unique constraint).

### 4.4 Seed Flow (Bootstrap)

```ts
for (const scopeName of ['user', 'realm', 'tag', 'zone', 'entity']) {
  const unit = await prisma.unit.create({
    data: { type: 'SCOPE', slug: null, slugScope: PLACEHOLDER }
  });
  await prisma.unit.update({
    where: { id: unit.id },
    data: { slugScope: unit.id }  // self-reference after row exists
  });
  await prisma.slugScope.create({ data: { slug: scopeName, unitId: unit.id } });
}
```

`/infra/bootstrap` response gains a new `slugScopes` field:

```jsonc
{
  "seedTags":    { "book": "<uuid>", "game": "<uuid>", ... },
  "defaultRealmId": "<uuid>",
  "slugScopes": {
    "user":   "<uuid>",
    "realm":  "<uuid>",
    "tag":    "<uuid>",
    "zone":   "<uuid>",
    "entity": "<uuid>"
  }
}
```

### 4.5 API Surface

**Typed by-slug endpoints** (scope is implicit in the endpoint path; short-prefix family):

```
GET /user/by-slug/:slug                     // user scope
GET /realm/by-slug/:slug                    // realm scope
GET /tag/by-slug/:slug                      // tag scope
GET /zone/by-slug/:slug                     // zone scope
GET /entity/by-slug/:slug                   // entity scope
GET /shelf/by-slug/:userSlug/:slug          // user → ownerUnitId → /:slug
                                            // (realm variant for realm-owned shelves)
```

**Typed by-id endpoints** (long-prefix mirrors):

```
GET /user/:unitId
GET /realm/:unitId
GET /tag/:unitId
GET /zone/:unitId
GET /entity/:unitId
GET /unit/:unitId   // generic
```

**Generic slug resolver** (for URL parsing utilities):

```
POST /slug/resolve
  body: { scope: 'user' | 'realm' | 'tag' | 'zone' | 'entity' | <ownerUnitId>, slug: string }
  resp: { unitId: string, type: UnitType }
```

**Client** never directly passes raw scope UUIDs. Either uses typed endpoints (preferred) or hands a known scope name to the generic resolver.

### 4.6 Migration

**Phase 3a — User-as-Unit**:

1. Add `USER` and `SCOPE` to `UnitType` enum.
2. For each existing `User` row, create a `Unit { id = User.userId, type = USER, slug = null }`. This is back-fill: the UUIDv7 already on User becomes Unit.id.
3. Rename `User.userId` → `User.unitId` (PK rename + FK rename in Follow, ApiToken, ownership references on Unit). Where the rename would touch too many call sites in one commit, keep the FK column name `userId` on related tables (it semantically still references a user); only the User PK field is renamed. No runtime dual-write.
4. Move existing `User.slug` values into the corresponding `Unit.slug` (with `slugScope = userScope.unitId`). Drop `User.slug`. Post-migration, slugs are immutable per §6.3 — `userService.update` and any admin path SHALL reject `slug` updates with a typed error.
5. Decide bio / name migration: keep on `User` extension for now; UnitTranslation adoption can be a follow-on change.
6. Repeal `user-domain-decoupling`'s "User PK is `userId`" and "User SHALL NOT be a Unit subtype" requirements. The rest of that spec (attribution decoupling, `accountStatus` removal) is preserved.

**Phase 3b — SlugScope structure**:

1. Add `SlugScope` table and `Unit.slugScope` column.
2. Seed the five scope placeholder units (`user`, `realm`, `tag`, `zone`, `entity`).
3. Backfill `Unit.slugScope = <typeScope>.unitId` for every existing slug-bearing Unit (TAG / REALM / ZONE / USER), matching the unit's type to its scope. For non-slug-bearing Units that have an owner, backfill to owner-unit-id; otherwise default to a sensible scope placeholder. Exact backfill rule belongs in the L3 change's design.
4. Apply `@@unique([slugScope, slug])`.
5. Drop the legacy global unique on `Unit.slug`.

**Phase 3c — URL & route surface**:

1. Ensure short-prefix slug routes exist: `/u/:slug`, `/r/:slug`, `/t/:slug`, `/z/:slug`, `/e/:slug`. Some already exist; the rest are added.
2. Add long-prefix UUID routes: `/user/:unitId`, `/realm/:unitId`, `/tag/:unitId`, `/zone/:unitId`, `/entity/:unitId`.
3. Keep `/unit/:unitId` as the universal UUID fallback.
4. **Remove** `/unit/:slug` (currently described in `public-short-routes`). The spec is rewritten in this change.
5. Add `/u/:userSlug/shelf/:slug` and `/r/:realmSlug/shelf/:slug` for owner-scoped shelf access.
6. Owner sub-resource URLs always use a type-prefix segment (`shelf/`, `post/`, …) to keep the owner reserved-word set small and to allow future types to coexist.

### 4.7 Specs Touched

- `unit-slug` — remove SHELF / USER from rejection list; introduce per-type scope concept.
- `slug-validation` — extend reserved-word rules to a two-layer model: per-scope reserved (one list per `SlugScope`) + per-owner reserved (`profile`, `settings`, `shelf`, `post`, etc. under user / realm).
- `slug-ref` — extend `SlugRef` shape: `{ scope: 'user' | 'realm' | 'tag' | 'zone' | 'entity' | <ownerUnitId>, slug: string, unitId?: string }`.
- `typed-slug-lookup` — add new endpoints; extend `/infra/bootstrap` shape (spec currently declares the shape stable — must update that requirement to include `slugScopes`).
- `public-short-routes` — rewrite around the short=slug / long=unitId convention; remove `/unit/:slug`; document the five short-prefix + five long-prefix + generic `/unit/:unitId` table.
- `account-identity-boundary` — reconcile User identity with Unit identity. New invariant: `User.unitId ≡ Unit.id where type=USER`. The "User.slug is canonical" requirement migrates to "Unit.slug under userScope is canonical".
- `user-domain-decoupling` — repeal the "User PK is `userId`" and "User SHALL NOT be a Unit subtype" requirements; preserve the rest.
- `attribution` — verify references still resolve under the renamed PK.
- `profile-*` — verify URLs and resolution still work; nothing changes externally since `/u/:userSlug` was already canonical.
- `shelf-collection` — extend with owner-scoped slug addressability.

### 4.8 Risk & Estimate

**Risks**:

- **`User.userId` → `User.unitId` rename surface**: hundreds of call sites. Mitigation: keep the column name `userId` on FK columns of related tables (the column semantically still references a user); only rename the User PK field. Frontend DTO field rename (`user.userId` → `user.unitId`) is the larger user-visible side; plan a clean cutover.
- **Bootstrap ordering**: SlugScope rows must exist before any other slug-bearing Unit is created. Mitigation: run as part of `prisma/seed/` infra bootstrap, not factory.
- **Legacy by-slug behaviour**: existing `GET /tag/by-slug/:slug` etc. must keep working through the cutover. The migration backfills the scope column atomically before flipping the unique index.
- **Short/long URL split discipline**: developers may be tempted to add `/u/:unitId` "for convenience" or `/user/:slug` mistakenly. The split is the spec; needs convention enforcement (lint or `check:convention` rule).
- **External URLs**: existing `/u/:userSlug` is the canonical and stays canonical. `/unit/:slug` was internal-only — its removal is acceptable.

**Estimate**: 1.5–2 weeks of focused work + migration window.

---

## 5. L1 — System Shelf Frontend Resolution (Consumes L3)

Once L3 is in, system shelves get stable slugs at bootstrap-time:

```
At user creation (or first access):
  for kindKey in ['favorites', 'backlog', 'active', 'completed']:
    shelf = Unit.create({
      type: SHELF,
      slug: kindKey,
      slugScope: user.unitId,     // the user is the namespace owner
    })
    Shelf.create({ unitId: shelf.id, kindKey })
```

**Client resolution** becomes a normal SlugRef cache:

```ts
const { data: favoritesShelfId } = useSlugRef({
  scope: viewer.unitId,           // viewer's unitId as owner-scope value
  slug: 'favorites',
});
```

Or, equivalently, through a typed endpoint:

```
GET /shelf/by-slug/:userSlug/favorites
```

`User.extra.shelves` map becomes a server-internal cache (no longer needed by the frontend) or can be removed entirely if the slug index is sufficient. The current `getOrCreateSystemShelf` flow remains as the write-path provisioner — but its return value (a unitId) is now also addressable by slug.

**No new endpoint required.** This is what makes the L2 → L3 → L1 ordering valuable: the L1 deliverable evaporates into "use the slug system".

**Specs touched**:
- `shelf-collection` — clarify that system shelves have well-known slugs under the user owner scope.

**Estimate**: 0.5–1 day (mostly: bootstrap mints slugs, frontend hook composes SlugRef, retire any custom endpoint draft).

---

## 6. Decisions and Carried Items

Items identified during planning. Most are now **decided** (explicitly labelled below) and proposals SHALL respect those commitments. A small number remain deferred to follow-on product work and are labelled accordingly. Items not marked "Decided" are explicitly out of scope for v1.

### 6.1 Subscription Domain Unification

**Resolved.** The dedicated change `engagement-subscription` (see `openspec/changes/engagement-subscription/`) carries the full design and specs. Summary of architectural commitments captured there:

- Generic `Subscription(subscriberUnitId, targetUnitId, channels: String[])` edge replaces `Follow`.
- `RealmMember` stays as the orthogonal **permission** edge; realm join is a two-write transaction (member + subscription), leave is the inverse, mute affects subscription only.
- `channels` uses dot-namespaced strings with three wildcard tiers (`'*'`, `'<category>.*'`, `'<category>.<event>'`); JSON-shaped channels were considered and rejected on fan-out query-cost grounds.
- Notification fan-out: broadcast recipients resolved via `Subscription` query; direct-recipient path (mention, reply parent, DM peer) preserved.
- Denormalized `Unit.subscriberCount` introduced as a popularity baseline for downstream hotness work; the hotness formula itself stays out of scope.
- `User.followersCount` / `User.followingsCount` stay on the User extension and are recomputed from `Subscription` aggregates.

Hard dependency: this L3 change must ship first (`User.unitId` is the prerequisite for `subscriberUnitId`).

### 6.2 ENTITY Slug Activation — Decided

L3 seeds the `entity` scope with write access **disabled at the service layer** (any `ENTITY` slug-creation attempt is rejected with a typed error). The USER↔ENTITY product relationship (verified claim / authorship) is not finalised and SHALL NOT block L3 from shipping.

A separate follow-on change `entity-slug-activation` flips writes on shortly after L3 stabilises. That change owns:
- the entity-creation flow (admin tools and/or user-facing path);
- whatever USER↔ENTITY claim / authorship policy product wants;
- the reserved-word list (if any) for the entity scope.

It is queued as #4 in the proposal sequence (§8) and runs in parallel with #3 and #5 once L3 ships.

### 6.3 User Slug Rename Policy — Decided

User slugs are **immutable in v1**. Once a user's `Unit.slug` is set (at signup or first-time slug assignment), no rename surface is exposed:

- No `userService.update` path accepts a `slug` field.
- No admin override in v1 (kept intentionally simple; operational need would itself become its own follow-on change carrying the full alias / redirect design).
- No `UserSlugAlias` table, no 301 redirect, no 410 gone — old URLs cannot exist because the slug never changes.

**Rationale:** the project is in active development with a small user surface. Immutability eliminates the entire alias / SEO / outbound-link-stability surface area and keeps `(slugScope, slug)` strictly write-once for the USER scope. The constraint is a v1 product decision, not a substrate limit — the schema fully supports a future rename when product signals demand it.

### 6.4 SlugScope Placeholder Metadata — Decided

The five `SCOPE` placeholder Units do not carry `UnitTranslation` rows. Their slugs are infra constants (`user`, `realm`, `tag`, `zone`, `entity`), not user-facing display strings. If ops tooling later wants a friendly label, the translation can be added without a migration — the substrate stays untouched.

### 6.5 Client SlugScopes Cache TTL — Decided

`/infra/bootstrap`'s `slugScopes` map (five UUIDs) is cached permanently on the client (localStorage + in-memory mirror). Invalidation is keyed to the app version stamp; a redeploy that bumps the stamp invalidates the cache. No TTL is set — the UUIDs do not rotate after seed.

### 6.6 User Field Semantics on USER Units — Decided

Lighter path. `Unit` columns not meaningful for `type=USER` (`workUnitId`, `rating`, `visibility`, `status`) remain nullable with implicit defaults. No per-type validator is added at the schema layer. The convention is documented in `account-identity-boundary` and not enforced. Future ranking / personalization work decides whether it needs USER-typed Unit fields.

### 6.7 Same-Name Multi-Type under Owner — Decided

`(slugScope, slug)` is unique. Under a user, `favorites` cannot be both a SHELF and a future LIST. If product later wants per-type same-name (a user with both a shelf "books" and a list "books"), reopen with a `(slugScope, slug, type)` migration. The URL convention `/u/:userSlug/shelf/:slug` and `/u/:userSlug/list/:slug` keeps the surface unambiguous regardless.

### 6.8 L2 Tag Picker Cardinality — Decided

Multi-select chips on `ShelfEditPage` and `NewShelfPage`. Matches `CollectionModal`'s filter semantics (`tag IN seedTags`) and lets a shelf mix book + game content cleanly. The L2 proposal owns the picker UX (chip group component, no upper bound enforced, zero selections allowed).

### 6.9 Cross-Scope Slug Collisions Between USER and REALM — Deferred

With per-type scopes, `alice` can in principle exist both as a USER slug and a REALM slug — they live in independent uniqueness universes. The plan provides the substrate; it does **not** decide policy.

Open product questions for a follow-on:

- Are they both simultaneously addressable as `/u/alice` and `/r/alice`? Structurally: yes.
- Should registration warn or block when a same-slug counterpart already exists in another scope?
- Should there be a "claim" or "linked-identity" mechanism (e.g., a user can mark a realm with the same slug as theirs)?

Explicitly out of scope for L3. The slug substrate is policy-neutral; layering policy on top is a separate change.

### 6.10 Shelf Custom Slugs — Decided (v1)

In v1, only **contract-defined system shelf** `kindKey`s (`favorites`, `backlog`, `active`, `completed`) carry slugs. User-created shelves (via `NewShelfPage`) have `Unit.slug = NULL` and are addressed exclusively via `/unit/:unitId` (or any UUID-bearing internal route).

- L3 schema **permits** `SHELF` under the user owner-scope — the substrate is in place.
- L1 (`shelf-system-slugs`) mints only the four well-known slugs at user bootstrap.
- `NewShelfPage` / `ShelfEditPage` do **not** expose a slug input. Server-side, `shelfService.create` and `.update` reject any non-null `slug` for user-created shelves with a typed error.
- `/u/:userSlug/shelf/:slug` therefore resolves only the four system slugs in v1; user-created shelves return 404 on that surface.

**Rationale:** mirrors the user-slug immutability stance (§6.3) — constrain the slug write surface heavily in v1, defer expansion until product signal demands it. Future opening of user-chosen shelf slugs is a product decision, not a substrate change.

---

## 7. Cross-cutting Considerations

### 7.1 Backwards Compatibility

This project's `CLAUDE.md` states it is in active development and disallows backwards-compatible aliases unless explicitly granted. This plan grants the following exceptions, justified by external URL stability:

- `/u/:userSlug` and `/r/:realmSlug` are the canonical, already-current short-prefix routes. Their **internal resolution** is being upgraded (now backed by the per-type slug scope), but their **URL shape** is preserved.
- `User.userId` field rename (Phase 3a) follows the "one clean breaking cutover" rule; no dual-read window.
- User slugs are **immutable post-set** in v1 per §6.3. No alias table, no rename API, no 301/410 redirect surface.
- User-created shelves remain slug-less in v1 per §6.10; only the four contract-defined system shelves carry slugs.
- `/unit/:slug` is removed without alias. Internal callers are migrated to typed slug routes; no external URL is known to depend on it.
- `/@:slug` is not introduced and not aliased; the `@` prefix is not part of the public URL surface.

### 7.2 Performance

- `(slugScope, slug)` composite unique on `Unit` adds one B-tree index. Storage cost ~35B per entry × N rows. Negligible.
- User slugs are immutable in v1 (§6.3) so rename cost is not an active concern. The composite index is still O(1) for the eventual rename surface if/when it is opened in a follow-on.
- The `slug → unitId` resolution path is the single most cacheable hop in the system and is what SlugRef was designed for.

### 7.3 Search Indexing

Meili currently indexes `userId` and `realmIds` etc. With User-as-Unit, `userId` and `unitId` are the same UUID for USER units — search documents need no rekeying. New: searchable `slug` field on Unit documents (with scope context) for `/slug/resolve`-style autocompletion. Results surface across all five scopes uniformly.

---

## 8. Proposal Sequence

Five OpenSpec changes. L2 is independent; L3 unblocks the rest; #3, #4, #5 are all post-L3 and can run in parallel.

1. **`shelf-tag-pinned-chain`** (L2)
   Specs touched: `profile-shelves-tab`, `shelf-seed-tags`
   Independent of all other work. Tag picker is multi-select per §6.8.

2. **`user-namespace-slug`** (L3) — the big one
   Specs touched: `unit-slug`, `slug-validation`, `slug-ref`, `typed-slug-lookup`, `public-short-routes`, `account-identity-boundary`, `user-domain-decoupling`, `attribution`, `profile-*`, `shelf-collection`
   Includes: User-as-Unit migration, SlugScope table (five scopes), per-type slug scope schema, short=slug / long=unitId URL convention, removal of `/unit/:slug`. Enforces:
   - ENTITY scope **seeded write-disabled** at the service layer (§6.2).
   - User slugs **immutable** post-set; no rename API, no alias (§6.3).
   - User-created shelves remain **slug-less**; only contract-defined system slugs accepted (§6.10).

3. **`shelf-system-slugs`** (L1, after L3 ships)
   Specs touched: `shelf-collection` (clarification only)
   Mints `favorites` / `backlog` / `active` / `completed` slugs under each user at bootstrap; replaces the `User.extra.shelves` frontend exposure question. Reaffirms the §6.10 constraint that user-created shelves stay slug-less.

4. **`entity-slug-activation`** (after L3 stabilises, in parallel with #3 and #5)
   Specs touched: `unit-slug` (re-allow ENTITY writes), `slug-validation` (entity-scope reserved words if any)
   Flips the ENTITY scope from write-disabled (L3 default) to writable, and ships the entity-creation flow plus any USER↔ENTITY claim / authorship policy product wants. Resolves §6.2.

5. **`engagement-subscription`** (after L3 ships, in parallel with #3 and #4)
   Specs touched: NEW `engagement-subscription`; MODIFIED `notification-feed`, `profile-followers-tab`, `realm-membership-me`
   Replaces `Follow` with a generic `Subscription(subscriberUnitId → targetUnitId, channels[])` edge; introduces fan-out recipient resolution for notifications; dual-track with `RealmMember`; adds denormalized `Unit.subscriberCount`. Proposal already drafted at `openspec/changes/engagement-subscription/`; cannot apply until L3 lands.

**Not yet scoped:** the cross-service protocol for delivering broadcast recipients from `package/server` (where `Subscription` lives) to `package/notify` (where `Notification` rows and SSE streams live) is a separate concern from §6.1's `Subscription` model. It is queued for design discussion immediately after this plan is committed; the resulting change is expected to slot into this sequence as a prerequisite of #5.
