## Context

ENTITY is a fully-specified UnitType (`entity-unit-type` spec) with a schema-level extension table carrying `kind` and `verified` flags. The `user-namespace-slug` change seeded an `entity` slug scope and a route surface (`/e/:slug`, `/entity/:unitId`), but left the server-side service layer rejecting every ENTITY slug write with a typed error. The result is a fully prepared substrate with no live consumer.

This change builds the service layer (`EntityService` CRUD), exposes admin slug-write authority, ships the EntityPicker that book / game / media creation flows will adopt, and renders the public detail page. The wiki-vs-personal mode discipline originally specified in `wiki-content-ownership-plan.md` is **deferred** — paired with the history-infrastructure change so the lock substrate, the custodian user, and the convention land together with their first real enforcement surface. In dev stage, all v1 ENTITY units are creator-owned, matching how BOOK / GAME / MEDIA are owned today.

**Stakeholders**: end users (self-claim flow), book / game / media creators (EntityPicker consumers), readers (detail-page consumers), admins (curation).

## Goals / Non-Goals

**Goals:**

- Ship a complete CRUD service for ENTITY, transactional with Unit + UnitTranslation writes.
- Flip the ENTITY slug substrate from write-disabled to admin-only-after-verified, with no end-user slug input surface.
- Make ENTITY pickable in book / game / media creation flows via an embedded modal that searches existing entities first and falls back to inline create.
- Render the public detail page once, addressable by both slug and unitId.
- Give users a private surface to declare entities that belong to them.
- Give admins the sole surface for slug + verified mutation.

**Non-Goals:**

- Wiki-mode custodian ownership (deferred with `content-creation-mode`).
- Edit-lock substrate, owner override audit log, field-level lockedFields (deferred with `content-history-and-lock`).
- Subscribe / follow on entity pages (deferred with `engagement-subscription`).
- Paid / payment-gated verification flow (`verified` is admin-only in v1).
- Entity merge / claim flow (substrate supports admin re-pointing `Unit.userId`; no UI).
- `Awards` and `News` tab live data sources.
- Multi-language entity bio editor capability — reuse the existing UnitTranslation editor pattern.
- Cross-scope (USER × REALM × ENTITY) collision UX — per slug plan §6.9, no enforcement.

## Decisions

### Decision 1 — Single shared detail component for `/e/:slug` and `/entity/:unitId`

Both routes resolve to the same `unitId` and render through the same React component. The slug route runs a slug→unitId resolution step (cached via SlugRef) and then delegates.

**Alternatives considered:**

- Two parallel route trees with duplicated render code — rejected as a guaranteed source of UX drift.
- Server-side redirect from slug to canonical UUID URL — rejected because slug URLs are the user-facing canonical form; redirecting would invert the canonical/long-form contract from `public-short-routes`.

### Decision 2 — EntityPicker as combobox-with-inline-create

The picker renders as a Dialog containing a Command-palette-style search box. Debounced queries hit the Meili entity index. The result list renders matches; a sticky "+ Create new" affordance at the bottom opens an inline mini-form (one translation: language + title, plus kind). Submitting the mini-form calls `EntityService.create`, optimistically inserts the new entity into the result list as selected, and closes the picker with the new unitId.

**Why combined rather than tabbed:**

- Browse and create are two phases of one mental model ("find this person, or add them"), not orthogonal modes.
- Tabbed UIs train users to ignore the wrong tab.
- The Meili-empty-result case naturally pushes the user toward the create affordance with no extra click.

**Kind hint:** EntityPicker accepts an optional `kindHint` prop. When set (e.g., a book-author picker passes `kindHint="person"`), the inline-create form pre-fills `kind` and the search filter prefers (but does not exclusively show) that kind.

### Decision 3 — Admin slug-write gate conditioned on `verified = true`

Server-side check at the `EntityService.update` layer:

```ts
if (input.slug !== undefined) {
  if (!isAdmin) throw new ForbiddenError('entity_slug_admin_only');
  if (!entity.verified) throw new ForbiddenError('entity_slug_requires_verified');
}
```

The `unit-slug` spec asserts the substrate-level rule; the entity-service spec mirrors it for service-layer ergonomics (clearer error messages, no leaky abstractions).

**Verified toggle**: `verified` is independently gated to admin role. Setting `verified = false` does not clear an existing slug — the slug persists, but no further admin slug edits are allowed until `verified` is restored. (This mirrors revoke-verification semantics common to social platforms.)

### Decision 4 — `Awards` and `News` tabs ship implemented-but-commented

Both tab components are written in full, including their data-fetching skeleton, and committed in the same file as the live tabs. Each is wrapped in a block comment delimited by clear markers:

```tsx
/* AWARDS_TAB: uncomment when awards data source lands.
   Tab registration in tabList[] and the JSX block below
   must both be uncommented. See entity-detail-page spec.
*/
```

The tab registration entry is also commented so the empty tab does not appear in the tablist (per `entity-detail-page` spec: tabs whose data source is empty SHALL NOT render).

**Alternatives considered:**

- Feature flags wired to env — overkill for a "uncomment when ready" workflow.
- Separate not-yet-shipped files — creates a discoverability gap and bit-rots faster.

### Decision 5 — No owner label on entity detail in v1

The detail page renders the verified chip, kind, primary title, translations, and tabs — but **no owner card or "created by" byline**. The OwnerHint branch (per slug plan §6.2 — "Community catalog entry" for system-owned, none for user-owned) is deferred together with the wiki convention.

**Rationale:** v1 entities are creator-owned as a technical default, not as a product statement of authorship. Rendering "by Alice" would imply that Alice has a content-ownership claim that the wiki convention will later complicate. Hiding the label avoids re-rendering UX when the convention lands and clearing it preserves the option to either (a) keep it hidden, (b) re-introduce as "by Alice" for personal-mode entities, or (c) re-introduce as "Community catalog" for wiki-mode entities.

### Decision 6 — Meili entity index

A new Meili index `entities` is created at infra-init time. Indexed fields per document:

```
{ unitId, slug, kind, verified, titles: [{ language, value }] }
```

`searchableAttributes`: `titles.value`, `slug`. `filterableAttributes`: `kind`, `verified`. Index sync happens in `EntityService.create / update / delete`.

**Alternatives considered:**

- PostgreSQL trigram search — slower at scale, no relevance scoring, no cross-language matching.
- No search; force exact-name match in EntityPicker — degrades create-while-typing UX for the most common picker case.

### Decision 7 — `/me/entities` sidebar placement

Entry lives in `/me/settings` left-rail navigation, not in the main avatar dropdown. Most users will never declare an entity; promoting the link to the dropdown adds noise to the common path.

### Decision 8 — Verified visual

`lucide-react`'s `BadgeCheck` icon (rounded checkmark badge), small size, rendered next to the kind chip in the detail page Hero and in EntityPicker result rows. Final color / size lives in `design.md`-style sketches reviewed under the `rezics-design` skill.

**Alternatives considered:**

- `ShieldCheck` — more authoritative but semantically tilts toward "trust" rather than "verified" (which the entity has earned through admin confirmation, not security audit).
- `CheckCircle` — too generic; conflated with "success" toasts.

### Decision 9 — All v1 ENTITY units are creator-owned

`EntityService.create` always writes `Unit.userId = caller.unitId`. Both EntityPicker spawn (book/game/media inline create) and `/me/entities/new` (personal-mode self-claim) use the same write rule. There is no `mode` parameter and no custodian-user lookup; both concepts arrive with `content-creation-mode` later.

**Consequence:** an EntityPicker spawn during book creation produces an entity row "owned by the book's creator". This is semantically odd (the book creator now "owns" Haruki Murakami's entity row) but functionally identical to how every other catalog-shaped Unit is currently owned. When the wiki convention lands, the convention will be forward-only (no backfill of these rows, per slug plan §5.2).

### Decision 10 — Admin verified toggle decouples from slug

The admin page exposes `verified` and `slug` as two independent controls. Toggling `verified = true` enables (but does not require) a subsequent slug write. Setting a slug requires `verified = true` at submission time. This avoids forcing a single confirm-everything submit and lets admins verify in bulk without inventing slugs.

## Risks / Trade-offs

- **Creator-ownership pollution of dev data** → The §5.2 no-backfill rule already accepts this; documented in proposal. No mitigation needed beyond the accepted-tax framing.

- **EntityPicker first-create UX has no existing matches** → Mitigation: the empty-result state explicitly surfaces the "+ Create new" affordance with a "No matching entities — create one?" hint, so the empty case is the create case.

- **Cross-scope slug collisions (USER × REALM × ENTITY)** → Per slug plan §6.9, no enforcement. Admin discretion bounds practical collision because ENTITY slugs are admin-only. Risk accepted.

- **Admin sets slug, then revokes `verified`** → Slug persists; spec rule prevents further admin slug edits until `verified` is restored. Trade-off: slug remains addressable while entity is unverified. Acceptable because slug revocation is a separate concern and the slug substrate's write-once-by-non-admin rule already keeps non-admins out.

- **Meili entity index drift if create/update succeed but index sync fails** → Standard pattern: index sync runs after the DB transaction commits; failures are logged and retried by a separate reconciler. Same pattern as other Meili-indexed units; no new infrastructure needed.

- **Commented-out `Awards` / `News` tab rot** → Real risk. Mitigation: comment markers (`AWARDS_TAB:`, `NEWS_TAB:`) are grep-targets; periodic review when the source data does land; clear ownership note in the source file pointing to the spec.

- **`/me/entities/new` becomes a spam-creation vector** → API-level rate limit at the standard threshold (same as other create endpoints). Not differentiated in v1.

- **Owner display deferred — page looks "ownerless"** → Acceptable for v1 product surface. When the wiki convention lands, the conditional branch is added without UX churn (the spot stays the same; only the rendered content changes).

## Migration Plan

No schema migration. Rollout sequence:

1. Ship server changes:
   - New `entity.service.ts`, `entity.api.ts`, `entity.mapper.ts`, `entity.types.ts` in `package/server/src/entity/`.
   - Remove the service-layer ENTITY-slug rejection guard from wherever `user-namespace-slug` installed it; replace with the admin-only-after-verified check.
   - Mount the entity API in `package/server/src/index.ts`.
2. Ship contract exports (`EntityDTO`, `CreateEntityInput`, `UpdateEntityInput`, `EntityListQuery`).
3. Ship API hooks (`package/api`).
4. Ship Meili `entities` index init + sync.
5. Ship admin pages (`/admin/entities`, `/admin/entities/$unitId`).
6. Ship public detail page (`/e/$slug`, `/entity/$unitId`).
7. Ship `/me/entities`, `/me/entities/new` + `/me/settings` sidebar entry.
8. Ship `EntityPicker` composite (no consumer retrofit in this change).

**Rollback strategy:** revert the package commits; the entity scope returns to write-disabled; no data backfill needed (any created entity rows remain queryable as Unit rows but the public surfaces stop rendering). Forward-only project policy; rollback is dev-only emergency tool.

## Open Questions

- **Verified icon choice (BadgeCheck vs ShieldCheck vs custom SVG)** — defer to `rezics-design` skill review during implementation.
- **EntityPicker `kindHint` propagation** — should book creation pass `kindHint="person"` for the "author" picker, `kindHint="organization"` for the "publisher" picker? Leaning yes; final decision belongs to the consumer-side changes that adopt the picker (out of this scope).
- **Admin index page columns** — minimum: unitId / primary title / kind / verified / slug / createdAt. Sortable defaults TBD during implementation.
- **`/me/entities` empty state** — copy and CTA placement; design.md follow-up.
