# Shelf Completion & User Namespace Slug Plan

**Status**: Draft plan, pre-proposal
**Date**: 2026-05-14
**Scope**: Wire the Shelf feature into a fully usable state, then graduate the slug subsystem to support user / realm namespaced slugs by promoting User into the Unit graph.

---

## 1. Motivation

The Shelf feature is functionally near-complete on the API surface but blocked by three structural gaps:

1. **System shelf resolution**: Each user owns a fixed set of contract-defined shelves (`favorites`, `backlog`, `active`, `completed`). The server already maintains a `User.extra.shelves` map and auto-creates missing ones, but no frontend-facing endpoint exposes that map. `ShelfAction` cannot reliably resolve the user's `favorites` shelf for instant interaction.

2. **Broken tag chain**: `CollectionModal` filters shelves by seed tags (`book`/`game`/`media`/`post`/`link`) via `shelf.tags`, but neither `ShelfEditPage` nor `NewShelfPage` exposes a tag picker. The filter has no upstream feed. Today this only works for seed-generated demo shelves where `tagIds` were populated at creation time.

3. **Shelf has no slug**: Current `unit-slug` spec explicitly rejects slugs on `SHELF`. There is no addressable identity for `@alice/favorites`. Every URL must be UUID-based. This blocks the "Shelf cache via SlugRef" pattern that the rest of the slug system already uses for TAG/REALM/ZONE.

The third gap is the deepest — solving it surfaces a pre-existing architectural debt: **User is not a Unit**. `User.slug` and `Unit.slug` live in two parallel uniqueness universes, and `contract/public-route.ts` actively documents `/u/:slug` and `/unit/:slug` as non-overlapping namespaces. Any user-namespaced slug (`@alice/...`) cannot have a clean single-FK design while this duality stands.

This plan addresses all three, with an explicit execution order chosen so that the largest architectural lift (L3) eliminates the work needed for L1.

---

## 2. Execution Order

```
   L2 (tag chain)  →  L3 (user-as-unit + namespace slug)  →  L1 (system shelf access)
   ─────────────      ───────────────────────────────────     ───────────────────────
   Independent        The big architectural lift              Becomes a thin client
   UX cleanup;        — unlocks namespace addressing          consumer of L3's slug
   ships today        for shelves & beyond                    system, NOT its own
                                                              endpoint
```

**Why this order:**

- L2 is independent and ships value immediately. It does not touch identity / slug architecture.
- L3 is the architectural foundation. Doing it before L1 means L1's "expose system shelves to the frontend" reduces from a custom endpoint to "use the slug system; the shelf is at `@me/favorites`".
- L1 last collapses to standard `/shelf/by-slug/:owner/:slug` resolution + SlugRef caching, with zero new domain endpoints needed.

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

## 4. L3 — User-as-Unit + Namespace Slug

This is the architectural cornerstone. Two intertwined commitments:

1. **User becomes a Unit type-extension** (`User.unitId @id`, with a corresponding `Unit { type: USER }` row sharing the same UUID).
2. **Slug subsystem gains namespace structure** via a new `slugScope` column and a small `SlugScope` lookup table for named infra namespaces.

### 4.1 Scope Topology (Final)

```
SlugScope table (seed):
  ┌─────────┬────────────────────────────────────────┐
  │ slug    │ Houses                                 │
  ├─────────┼────────────────────────────────────────┤
  │ master  │ Identity: USER + REALM (shared)        │
  │ tag     │ TAG                                    │
  │ zone    │ ZONE                                   │
  │ entity  │ ENTITY (authors, characters)           │
  └─────────┴────────────────────────────────────────┘

Owner-scoped slugs (slugScope = ownerUnitId):
  ┌─────────────────────┬──────────────────────────────────────┐
  │ Under USER          │ SHELF (future: LIST, etc.)          │
  │ Under REALM         │ SHELF (future: events, themes)      │
  └─────────────────────┴──────────────────────────────────────┘

(slugScope, slug) is unique. Multiple types may live under one owner
but cannot collide on the same slug — same-name multi-type is mutually
exclusive by design.

No slug: BOOK, GAME, MEDIA, POST, IMAGE, VIDEO, QUOTE, LINK, CHAPTER.
```

### 4.2 URL Alignment

```
/@alice              → master/alice (type=USER)
/@bookclub           → master/bookclub (type=REALM)
/@alice/favorites    → master/alice → alice.id/favorites
/@bookclub/2026-q1   → master/bookclub → club.id/2026-q1
/tag/fantasy         → tag/fantasy
/zone/featured       → zone/featured
/e/mark-twain        → entity/mark-twain

Legacy (kept, redirect-canonical or alias):
/u/:slug             → master/:slug
/unit/:slug          → master/:slug
/unit/id/:unitId     → direct PK
```

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
  slugScope  String   @db.Uuid              // NOT NULL
  userId     String?  @db.Uuid              // creator (unchanged)
  // ... existing fields

  @@unique([slugScope, slug])
}

model SlugScope {                            // new
  slug    String @id                          // 'master' 'tag' 'zone' 'entity'
  unitId  String @db.Uuid @unique
}

model User {
  unitId      String  @id @db.Uuid           // renamed from userId
  authUserId  String? @unique
  email       String?
  name        String?
  avatar      String?
  bio         String?
  permission  Json?
  settings    Json?
  // slug field removed (moved to Unit.slug under slugScope=master)
  // followersCount / followingsCount: stays for now, decided
  //   alongside subscription unification (see open todos)
  // ... rest of User extension fields
}
```

**Key properties**:

- `slugScope` is **NOT NULL**, always points to a real `Unit.id` (an infra `SlugScope` row's `unitId`, or any other Unit acting as namespace owner).
- `Unit.slug` is nullable. Most units have no slug; uniqueness on `(slugScope, slug)` does not fire when `slug IS NULL` because Postgres treats `NULL ≠ NULL`. A single composite unique index is sufficient — no partial indexes required.
- `slugScope` has **no FK constraint**, consistent with the existing precedent in `ShelfUnit.unitId` / `ShelfItem.itemRef` (see `shelf-structure` spec).
- `SCOPE` placeholder units have `slug = NULL` and `slugScope = self.id` (harmless self-reference because `NULL` slugs do not participate in the unique constraint).

### 4.4 Seed Flow (Bootstrap)

```ts
for (const scopeName of ['master', 'tag', 'zone', 'entity']) {
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
  "slugScopes":  { "master": "<uuid>", "tag": "<uuid>", "zone": "<uuid>", "entity": "<uuid>" }
}
```

### 4.5 API Surface

**Typed by-slug endpoints** (scope is hidden from client):

```
GET /user/by-slug/:slug                     // implicit master, asserts type=USER
GET /realm/by-slug/:slug                    // implicit master, asserts type=REALM
GET /tag/by-slug/:slug                      // implicit tag scope
GET /zone/by-slug/:slug                     // implicit zone scope
GET /entity/by-slug/:slug                   // implicit entity scope
GET /shelf/by-slug/:ownerSlug/:slug         // master → ownerUnitId → /:slug
```

**Generic resolver** (for URL parsing utilities):

```
POST /slug/resolve
  body: { scope: 'master' | 'tag' | 'zone' | 'entity' | <ownerUnitId>, slug: string }
  resp: { unitId: string, type: UnitType }
```

**Client** never directly passes `scopeId` strings. Either uses typed endpoints (preferred) or hands a known scope name to the generic resolver.

### 4.6 Migration

**Phase 3a — User-as-Unit**:

1. Add `USER` and `SCOPE` to `UnitType` enum.
2. For each existing `User` row, create a `Unit { id = User.userId, type = USER, slug = null }`. This is back-fill: the UUIDv7 already on User becomes Unit.id.
3. Rename `User.userId` → `User.unitId` (PK rename + FK rename in Follow, ApiToken, ownership references on Unit). Where the rename would touch too many call sites in one commit, keep a transitional alias field, but no runtime dual-write.
4. Move existing `User.slug` values into the corresponding `Unit.slug` (with `slugScope = master.unitId`). Drop `User.slug`.
5. Decide bio/name migration: keep on `User` extension for now; UnitTranslation adoption can be a follow-on change.

**Phase 3b — SlugScope structure**:

1. Add `SlugScope` table and `Unit.slugScope` column.
2. Seed the four scope placeholder units.
3. Backfill `Unit.slugScope = master.unitId` for every existing slug-bearing Unit (TAG/REALM/ZONE/USER) and `master.unitId` for non-slug-bearing Units too (uniform default).
4. Apply `@@unique([slugScope, slug])`.
5. Drop the legacy global unique on `Unit.slug`.

**Phase 3c — URL & route surface**:

1. Add `/@:slug` and `/@:slug/:childSlug` routes.
2. Keep `/u/:slug` and `/unit/:slug` as legacy aliases that resolve into the same master scope.
3. Add `/tag/:slug` (already present?), `/zone/:slug`, `/e/:slug` typed routes.
4. Add `/shelf/by-slug/:owner/:slug` resolver.

### 4.7 Specs Touched

- `unit-slug` — remove SHELF/USER from rejection list; introduce scope concept.
- `slug-validation` — extend reserved-word rules to a two-layer model: global reserved (in master scope) + per-scope reserved.
- `slug-ref` — extend `SlugRef` shape: `{ scope?: string, slug: string, unitId?: string }`.
- `typed-slug-lookup` — add new endpoints; extend `/infra/bootstrap` shape (spec currently declares the shape stable — must update that requirement).
- `public-route` — replace the explicit "Unit.slug never resolves User.slug" duality with the unified master-scope rule.
- `account-identity-boundary` — reconcile User identity with Unit identity (the new invariant `User.unitId ≡ Unit.id where type=USER`).
- `attribution` — verify references still resolve under the renamed PK.
- `profile-*` — verify URLs and resolution still work; opportunistic adoption of `/@:slug`.
- `shelf-collection` — extend with namespaced slug addressability.

### 4.8 Risk & Estimate

**Risks**:

- **Userid → unitId rename surface**: hundreds of call sites. Mitigation: keep the column name `userId` on relations (it semantically still references the user), only rename the User PK field.
- **Bootstrap ordering**: SlugScope rows must exist before any other slug-bearing Unit is created. Mitigation: run as part of `prisma/seed/` infra bootstrap, not factory.
- **Legacy by-slug behaviour**: existing `GET /tag/by-slug/:slug` etc. must keep working through the cutover. The migration backfills the scope column atomically before flipping the unique index.
- **External URLs**: `/u/:userSlug` is in the wild. Keep it as an alias forever; do not break it.

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
      slugScope: user.unitId,     // user is the namespace owner
    })
    Shelf.create({ unitId: shelf.id, kindKey })
```

**Client resolution** becomes a normal SlugRef cache:

```ts
// Hypothetical hook
const { data: favoritesShelfId } = useSlugRef({
  scope: '@me',                   // resolves to current viewer's unitId
  slug: 'favorites',
});
```

Or, equivalently, through a typed endpoint:

```
GET /shelf/by-slug/@me/favorites
```

`User.extra.shelves` map becomes a server-internal cache (no longer needed by the frontend) or can be removed entirely if the slug index is sufficient. The current `getOrCreateSystemShelf` flow remains as the write-path provisioner — but its return value (a unitId) is now also addressable by slug.

**No new endpoint required.** This is what makes the L2 → L3 → L1 ordering valuable: the L1 deliverable evaporates into "use the slug system".

**Specs touched**:
- `shelf-collection` — clarify that system shelves have well-known slugs under the user namespace.

**Estimate**: 0.5–1 day (mostly: bootstrap mints slugs, frontend hook composes SlugRef, retire any custom endpoint draft).

---

## 6. Open Todos (Carried into Proposals)

These items were identified during planning but deliberately left undecided. Each must be resolved when the matching proposal is created.

### 6.1 Subscription Domain Unification

Current `Follow` model is User → User only. Most Unit types likely need subscription:
- Book → notify on new chapters
- Realm → activity feed
- Shelf → notify on owner additions
- Tag → notify on new tagged content
- Post → notify on replies

**Option A**: Keep `Follow` for users only; introduce per-domain subscription tables.
**Option B**: Generic `Subscription { subscriberUnitId, targetUnitId, kind }`, retiring `Follow` and possibly `RealmMembership`.
**Option C**: Defer until after L3 ships, then dedicated `engagement-subscription` explore.

Decision: **C**. Until then, `User.followersCount` / `User.followingsCount` stay on the User extension table, not promoted to `Unit`.

### 6.2 ENTITY Slug Activation

L3 seeds the `entity` scope but should not yet allow `ENTITY` slug creation, because the product relationship between `USER` and `ENTITY` (verified claim / authorship) is not finalised. Seed the scope; gate write access behind a feature flag or a follow-on proposal.

### 6.3 User Slug Rename Migration Strategy

When a user changes their slug:
- Old URLs break unless aliased.
- Decisions needed: alias table? Retention period? 301 vs 404 vs 410?
- SEO and outbound-link stability are at stake.

This belongs in the L3 proposal but should not block the architectural commitment.

### 6.4 Master Scope Placeholder Metadata

Should the master `SCOPE` placeholder Unit carry `UnitTranslation` rows for display purposes (e.g., admin tools showing "Master namespace")? Probably no until ops asks. Leave the column nullable and ignore.

### 6.5 Client SlugScopes Cache TTL

Once `/infra/bootstrap` returns the four scope UUIDs:
- These UUIDs never change after seed.
- Cache permanently in client (localStorage + memory).
- Invalidate only on app version bump (deploy-stamped cache key).

### 6.6 User Field Semantics on USER Units

Many `Unit` columns are not meaningful for `type=USER`: `workUnitId`, `rating`, `visibility`, `status`. Two paths:
- Leave them nullable with implicit defaults (lighter).
- Add a per-type validator in `unit-slug` style ("type-gated" rule) to reject meaningless values.

Decision: lighter path. Document the convention; do not enforce.

### 6.7 Same-Name Multi-Type under Owner

`(slugScope, slug)` is unique → under a user, `favorites` cannot be both a SHELF and a future LIST. This is the agreed constraint. If product later wants per-type same-name (e.g., a user has both a shelf "books" and a list "books"), reopen with `(slugScope, slug, type)` migration.

### 6.8 L2 Tag Picker Cardinality

Single-select vs multi-select chips on `ShelfEditPage`:
- Single: cleaner UX, but a shelf cannot mix book + game content cleanly.
- Multi: matches `CollectionModal`'s filter semantics (`tag IN seedTags`).

Decision deferred to L2 proposal. Lean: multi.

---

## 7. Cross-cutting Considerations

### 7.1 Backwards Compatibility

This project's `CLAUDE.md` states it is in active development and disallows backwards-compatible aliases unless explicitly granted. This plan grants the following exceptions, justified by external URL stability:

- `/u/:slug` and `/unit/:slug` are kept as **resolution-equivalent aliases** to `/@:slug`. They are not legacy paths to be removed.
- `User.userId` field rename (Phase 3a) follows the "one clean breaking cutover" rule; no dual-read window.

### 7.2 Performance

- `(slugScope, slug)` composite unique on `Unit` adds one B-tree index. Storage cost ~35B per entry × N rows. Negligible.
- Slug rename is O(1) under the UUID-scope model. Username changes do not cascade.
- The `slug → unitId` resolution path is the single most cacheable hop in the system and is what SlugRef was designed for.

### 7.3 Search Indexing

Meili currently indexes `userId` and `realmIds` etc. With User-as-Unit, `userId` and `unitId` are the same UUID for USER units — search documents need no rekeying. New: searchable `slug` field on Unit documents (with scope context) for `/slug/resolve`-style autocompletion.

---

## 8. Proposal Sequence

When ready to start work, create three independent OpenSpec changes in this order:

1. **`shelf-tag-pinned-chain`** (L2)
   Specs touched: `profile-shelves-tab`, `shelf-seed-tags`
   Independent of all other work.

2. **`user-namespace-slug`** (L3) — the big one
   Specs touched: `unit-slug`, `slug-validation`, `slug-ref`, `typed-slug-lookup`, `public-route`, `account-identity-boundary`, `attribution`, `profile-*`, `shelf-collection`
   Includes User-as-Unit migration, SlugScope table, namespace slug schema and routes.

3. **`shelf-system-slugs`** (L1, after L3 ships)
   Specs touched: `shelf-collection` (clarification only)
   Mints `favorites`/`backlog`/`active`/`completed` slugs under each user at bootstrap; replaces `User.extra.shelves` frontend exposure question.
