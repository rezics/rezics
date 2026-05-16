## Why

The `user-namespace-slug` change seeded the `entity` slug scope with writes disabled at the service layer — every ENTITY slug-creation attempt is currently rejected with a typed error. ENTITY units have a schema definition (`Entity` extension on `Unit` with `kind` and `verified`) and a documented CRUD contract in `entity-unit-type`, but no service implementation, no API surface, and no UI exist. As a result, ENTITY-shaped concepts (authors, characters, studios, publishers) are unreachable from the product today: a book cannot credit an author through a UI, a user cannot declare themselves as a creator, and the `/e/:slug` route resolves to nothing.

The originally planned wiki-vs-personal mode discipline (per `wiki-content-ownership-plan.md`) and its custodian-user substrate are **deferred until paired with the history-infrastructure change** (decision 2026-05-16). In dev stage, every ENTITY created by either path is creator-owned, matching how BOOK / GAME / MEDIA are owned today. The `content-creation-mode` change is no longer a prerequisite for this work.

## What Changes

- Flip the `unit-slug` ENTITY gate from "rejected" to **admin-only**, conditioned on `verified = true`. Neither creation mode exposes a slug field to end users.
- Build the EntityService CRUD surface (create, get, update, delete, list) backed by a single transaction that mints a Unit (`type = ENTITY`) plus an Entity extension row, with translations and optional kind.
- Add the **EntityPicker** modal embedded in book / game / media creation surfaces. Minimum required fields for inline create: one translation (language + title) plus kind. Bio not required.
- Add `/me/entities` index and `/me/entities/new` for users to declare entities that belong to them (e.g., "I am an author"). The entry lives in `/me/settings` sidebar (not the main avatar dropdown — most users never declare an entity).
- Add `/e/:slug` and `/entity/:unitId` detail pages as a **single shared component** with an IMDb-style skeleton (Hero + tab strip). Tabs whose data source is empty SHALL NOT render in the tablist. `Overview`, `Works`, `About` ship live in v1. `Awards` and `News` ship **implemented-but-commented-out**, with English block comments explaining "no data source wired up yet" — uncommenting is the activation path when their backing data lands.
- Add `/admin/entities` index and `/admin/entities/:unitId` edit page — the sole surface for setting an ENTITY slug and toggling `verified`.
- All ENTITY units created in v1 are creator-owned (`Unit.userId = currentUser.unitId` for both EntityPicker spawn and `/me/entities/new`). Wiki-mode ownership is deferred — when `content-creation-mode` lands paired with history-infrastructure, the convention will be forward-only (no backfill, per slug plan §5.2).
- OwnerHint on the detail page: render no owner label for entities in v1. The "Community catalog entry" branch is deferred together with the wiki convention.
- Subscribe button is **NOT** shipped in v1; wired in once `engagement-subscription` lands.
- Verified visual: a `lucide-react` icon next to the kind chip; specific icon choice belongs to `design.md`.
- **BREAKING**: The ENTITY slug substrate gate flips from "service-layer rejection" to "admin-only acceptance". No production caller relied on the old reject behavior; the gate was introduced in the same chain as this activation.

## Capabilities

### New Capabilities

- `entity-service`: EntityService CRUD operations (create / get / update / delete / list), transactional Unit + Entity write, translation handling, admin-only slug write gated on `verified = true`, search-index sync.
- `entity-picker`: Modal composite embedded in book / game / media creation surfaces. Search-existing-first UX with inline create fallback; selection callback returns entity unitId for the host form. Spawn-mode is implicitly creator-owned in v1.
- `entity-detail-page`: Single component serving both `/e/:slug` and `/entity/:unitId`. IMDb-style skeleton with conditional tabs (Overview / Works / About live; Awards / News commented). Verified chip; no owner label in v1; no subscribe button in v1.
- `entity-self-claim`: `/me/entities` index and `/me/entities/new` flow for users to declare entities that belong to them. Entry surfaces in `/me/settings` sidebar.
- `entity-admin-page`: `/admin/entities` index and `/admin/entities/:unitId` edit page. Toggle `verified`; set / update slug only when `verified = true`.

### Modified Capabilities

- `unit-slug`: Flip the ENTITY slug-write gate from rejected to admin-only-after-verified. The substrate (composite `(slugScope, slug)` unique on Unit, entity scope placeholder Unit) already permits ENTITY slugs; this opens the write surface and adds the verified-gate clause.
- `entity-unit-type`: The documented EntityService CRUD requirement moves from "specified" to "implemented". Add a clarifying requirement that v1 ENTITY units are creator-owned (no custodian semantics), and that admin-write surfaces are responsible for slug + verified mutations.

## Impact

**Affected packages**:

- `package/server` — NEW `src/entity/{entity.api.ts, entity.service.ts, entity.mapper.ts, entity.types.ts}`, mounted in `src/index.ts`. Remove the service-layer ENTITY-slug rejection guard introduced by `user-namespace-slug`; replace with the admin-only-after-verified gate.
- `package/contract` — Concrete typebox export of `EntityDTO`, `CreateEntityInput`, `UpdateEntityInput`, `EntityListQuery` (already declared in `entity-unit-type` requirements).
- `package/api` — New TanStack Query options + hooks for entity CRUD, `byId`, `bySlug`, search/autocomplete.
- `package/app` — NEW `EntityPicker` composite consumed by book / game / media creation flows; NEW routes `/e/$slug` and `/entity/$unitId` rendering the shared detail component; NEW `/me/entities` and `/me/entities/new` routes; sidebar entry in `/me/settings`.
- `package/admin` — NEW `/entities` index and `/entities/$unitId` edit page.
- `package/search` — ENTITY documents indexed in Meili under the entity scope, powering EntityPicker's "find existing first" UX and slug autocompletion.
- `package/ui` — Likely reuse of existing shadcn primitives (Dialog, Command, Input, Tabs) plus rezics-side icon usage; no new shared primitive expected. (Confirmed in `design.md`.)

**Non-goals (v1)**:

- Wiki-mode custodian semantics — deferred with `content-creation-mode`, paired with history-infrastructure.
- Entity edit lock substrate — deferred with `content-history-and-lock`.
- Subscribe button on entity pages — deferred with `engagement-subscription`.
- Paid / payment-gated verification flow — `verified` is admin-only in v1.
- Entity merge / claim-flow (e.g., a wiki ENTITY later claimed by a registering user) — substrate supports it (admin can re-point `Unit.userId`), UI is out of scope.
- `Awards` and `News` tabs as live surfaces — code shipped commented; uncommenting is the activation path.
- Multi-language entity bio editor — bio is rendered (from `UnitTranslation.summary` / `.description`); editor UX uses the existing translation editor patterns, no new editor capability is introduced.

**Backward compatibility**:

This is a dev-stage change. The ENTITY slug-write rejection guard introduced by `user-namespace-slug` was forward-only and had no production callers. No backfill of existing rows; no compatibility shims. The new EntityService is purely additive — no existing endpoints change shape.

**Migration**:

None. No schema changes (the `Entity` extension table and `ENTITY` UnitType already exist). The only DB-visible change is new Unit + Entity rows created by the new surfaces, and (post-activation) new ENTITY rows carrying non-null `slug` values under `slugScope = <entity-scope-unit-id>`.

**Dependencies**:

- Hard prerequisite: `user-namespace-slug` (entity scope, USER-as-Unit, slug-scope substrate, route surface). Currently 63/69 tasks — effectively done.
- No dependency on `content-creation-mode` (originally declared hard in slug plan §6.2; relaxed 2026-05-16 — wiki convention deferred until history-infrastructure).
- No dependency on `engagement-subscription` (Subscribe button is deferred until that ships).
- Soft consumer-side coordination: book / game / media creation flows that adopt EntityPicker will follow this change; this proposal ships the picker but does not retrofit every consumer.
