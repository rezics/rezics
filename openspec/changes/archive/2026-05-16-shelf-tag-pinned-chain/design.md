## Context

The `Shelf` feature exposes the seed-tag filter chain through `CollectionModal`, which reads `shelfDTO.tags` and filters shelves by membership of a seed-tag UUID (`book` / `game` / `media` / `post` / `link`). The chain works for shelves seeded by `prisma/factory/`, because the seed installer creates `UnitTag` rows with `pinned = true` per `shelf-seed-tags`. It does not work for user-created shelves: although `createShelfSchema` already accepts a `tagIds` array, the `NewShelfPage` and `ShelfEditPage` UIs do not surface a picker, and the existing service path persists those rows with the default `pinned = false`.

Substrate already in place:

- `UnitTag.pinned: Boolean @default(false)` at `package/server/prisma/schema.prisma:614`.
- `@@index([unitId, pinned, position])` at `package/server/prisma/schema.prisma:626`.
- `shelf.mapper.ts:92` / `shelf.mapper.ts:130` already project `unit.unitTags` into `shelfDTO.tags`, currently without a `pinned` filter.
- `shelf.service.ts:249` accepts `tagIds` at create time and inserts `UnitTag` rows with `score: 0, voteCount: 0` — and no `pinned` flag.
- `CollectionModal.tsx:63`: `shelves.filter((s) => s.tags?.some((t) => t.tagUnitId === tagId))`.

The change is therefore a tightening of an existing data flow plus a small UI affordance, not a new architectural layer.

## Goals / Non-Goals

**Goals:**

- Give shelf owners a write surface to pin seed tags on their shelves (create + edit), persisted as `UnitTag(pinned = true)`.
- Tighten `shelf.mapper`'s projection so `shelfDTO.tags` reflects **owner intent** (pinned-only), not algorithmic / community-driven tag membership.
- Restrict the pinned-tag write path to the five seed tags (`book`, `game`, `media`, `post`, `link`) in v1. Generic user-driven tagging is a separate, much larger feature surface (`tag-interaction-component`, `tag-scoring`) and is explicitly out of scope.
- Ship a small SQL backfill so existing user-created shelves' rows that were persisted with `pinned = false` participate in the filter chain after deploy.
- Keep `CollectionModal` untouched. The filter implementation already does the right thing once the mapper output changes.

**Non-Goals:**

- A generic user tag picker (arbitrary tags, free-text). Out of scope; v1 is seed-tags-only.
- Re-modelling `pinned` semantics for non-seed tags. The `pinned` column is general but this change only writes it through the seed-tag pin path.
- Touching `tag-scoring`, `tag-batch-translation`, `tag-interaction-component`, or any community-tag flow.
- Backfilling `pinned = true` for non-seed-tag rows.
- Tag picker on the shelf detail / read surface — read-only chips on the shelf detail page are nice-to-have; this change owns the **edit** surface (NewShelfPage + ShelfEditPage), not the read surface.
- Pin cardinality limits, ordering, or `position` assignment for user-pinned rows. The current free-form behaviour is preserved (`position` stays NULL; the existing seed-pin `position` semantics from `shelf-seed-tags` are unchanged).

## Decisions

### D1. Multi-select chip group, not single-select

Per §6.8 of the parent plan: **multi-select**. A shelf may pin multiple seed tags (e.g., `book` + `media`) so a "book-and-companion-podcast" shelf surfaces under both filters. No upper bound, zero selection allowed. The chip group is a thin composition over the existing `@rezics/ui` chip primitive; no new component is introduced.

**Alternatives considered:**

- *Single-select with a "primary kind"*: rejected — collapses the multi-content-type case poorly and forces users to pick "the one true category" for cross-category shelves.
- *Free-text tag input*: rejected — out of scope; deferred to a future tag-interaction change.

### D2. Mapper filters to `pinned = true` only — both `Detail` and `Summary` projections

```ts
// shelf.mapper.ts (current)
tags: row.unit?.unitTags?.map((t) => ({ tagUnitId: t.tagUnitId, score: t.score })),

// shelf.mapper.ts (after)
tags: row.unit?.unitTags
  ?.filter((t) => t.pinned)
  .map((t) => ({ tagUnitId: t.tagUnitId, score: t.score })),
```

Applied identically to `mapShelfDetailToDTO` and `mapShelfSummaryToDTO`. The DTO field shape is unchanged; clients reading `shelf.tags` see a strictly smaller (or equal) set after deploy.

**Rationale:** the filter chain expresses owner intent ("this is a book shelf"). Tag scoring expresses community signal ("this shelf is much-discussed for fantasy"). Conflating them leaks community signal into the filter and surfaces unintended shelves. The DB-side `pinned` flag is the natural separator, and the existing index `(unitId, pinned, position)` is already shape-matched.

**Trade-off:** the shelf detail page can no longer rely on `shelfDTO.tags` to render a full tag panel — but no such surface exists today, so there is no regression. If a future shelf-detail spec wants a full tag listing, it can read `unitTags` directly or add a separate `allTags` field on the DTO.

**Alternatives considered:**

- *Add a new `pinnedTags` field, keep `tags` unfiltered*: rejected — doubles the DTO surface for zero current consumers and defers the breaking-rename cost. Per project policy (CLAUDE.md "Development-Stage Compatibility") prefer one clean cutover.
- *Filter client-side in `CollectionModal`*: rejected — pushes a semantic invariant to a single consumer and leaves the server's DTO ambiguous.

### D3. Pin-write endpoint: dedicated `PUT /shelf/:unitId/pinned-tags`

```
PUT /shelf/:unitId/pinned-tags
  body: { pinnedTagIds: string[] }
  resp: { tags: { tagUnitId: string; score: number }[] }
```

Semantics: full-set replacement. The body is the desired pinned-tag set; the server diffs against the current `(shelfUnitId, tagUnitId WHERE pinned = true)` rows and:

- inserts new rows (`pinned = true, score = 0, voteCount = 0, position = null`);
- for any row that was previously `pinned = true` and is no longer in the desired set: **deletes the row** (does not toggle `pinned = false`).

The "delete on un-pin" choice keeps the `UnitTag` table representing only "tags that have a relationship with this unit" without accumulating dormant `pinned = false` rows from past user edits. Community-driven tag rows (created by the future tag-vote flow) are unaffected because they carry `score > 0` and `pinned = false` independently of this write path.

**Validation:** `pinnedTagIds` must be a subset of the five seed-tag UUIDs resolved from `getSeedTagId(...)` constants. Any non-seed UUID returns a typed `400 invalid-pin-target` error.

**Authorization:** the shelf owner only — reuses the existing shelf-edit ownership check in `shelf.service.ts`.

**Alternatives considered:**

- *Embed `pinnedTagIds` in the existing `PATCH /shelf/:unitId` update path*: rejected — couples tag-mutation semantics with shelf-metadata updates and forces tag-only edits to round-trip the full metadata payload. Keeping it separate also lets the API hook layer use a smaller cache invalidation set.
- *Toggle `pinned = true ↔ false`*: rejected — leaves dormant rows in the table indefinitely; complicates the create path (which inserts rows fresh, not toggles existing).

### D4. `create` path: existing `tagIds` field persisted with `pinned = true`

The existing `createShelfSchema.tagIds` field stays in place. The service-layer change is one line:

```ts
// shelf.service.ts:252 (after)
create: tagIds.map((tagUnitId) => ({
  tagUnitId,
  score: 0,
  voteCount: 0,
  pinned: true,           // ← added
})),
```

Validation at create time mirrors D3: only seed-tag UUIDs are allowed in `tagIds`. The same `400 invalid-pin-target` typed error applies.

**Rationale:** preserves the existing single-round-trip create flow ("title + cover + pinned tags in one request") while delivering the new persistence semantics. No new endpoint is needed for the create path.

### D5. UI surface: a single `SeedTagChipGroup` composition, reused

A new UI composition (not a primitive) in `package/app/src/shelf/components/SeedTagChipGroup.tsx`:

```
SeedTagChipGroup
  props: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean }
  renders: a chip per entry in SEED_TAGS (book / game / media / post / link),
           toggled by click, multi-selectable
```

Used by both `NewShelfPage` (bound to local state, flushed via `createShelf({ tagIds })`) and `ShelfEditPage` (bound to current `shelf.tags` projection, flushed via `useSetShelfPinnedTags`).

The seed-tag list and UUIDs come from existing `@rezics/contract` seed-tag constants. Visual treatment follows `rezics-design` — chip primitive from `@rezics/ui`, no custom border/colour beyond tokens.

### D6. Cache invalidation

`useSetShelfPinnedTags` invalidates:

- `shelf(unitId)` — for the shelf detail page;
- `shelf-list` queries scoped to the same owner — so the chip filter in `CollectionModal` and the profile-shelves-tab list update immediately.

`useCreateShelf` already invalidates the relevant queries; no new key is added for the create flow.

### D7. Backfill: one-shot SQL during the migration

Since `UnitTag.pinned` is an existing column, the change ships **without a Prisma migration** but includes a one-shot SQL data step that runs once at deploy. The step is idempotent and goes into the next `prisma/migrations/<timestamp>_shelf_tag_pin_backfill/migration.sql`:

```sql
-- Pin existing seed-tag UnitTag rows on user-created shelves.
-- Idempotent: rows already pinned remain pinned.
UPDATE "UnitTag"
SET pinned = true
WHERE pinned = false
  AND "tagUnitId" IN (
    -- The five deterministic seed-tag UUIDs.
    -- Hard-coded list mirrors @rezics/contract seed-tag constants.
    '<book-uuid>', '<game-uuid>', '<media-uuid>', '<post-uuid>', '<link-uuid>'
  )
  AND "unitId" IN (SELECT id FROM "Unit" WHERE type = 'SHELF');
```

The exact UUIDs are sourced from the same constants the contract package uses at runtime; the migration generator templates them in. Verification step in §9 of `tasks.md`: row count before/after, plus a sample query confirming `CollectionModal` shows previously-invisible shelves.

**Alternatives considered:**

- *Run backfill in application code at first boot*: rejected — non-idempotent if multiple instances start concurrently and bypasses the standard migration audit trail.
- *Skip backfill, accept loss for old data*: rejected — would invisibly orphan existing user shelves from the filter chain.

## Risks / Trade-offs

- **[Mapper filter is a breaking semantic for `shelfDTO.tags`]** → Mitigation: confirmed no consumer reads `shelf.tags` expecting unfiltered data. `CollectionModal.tsx:63` is the only documented consumer and benefits from the change. Grep `shelf.tags` across `package/app`, `package/api`, `package/admin` as a `check:convention`-style verification (task in `tasks.md` §6); if future consumers want the full set, they add a separate field rather than reshape this one.

- **[Backfill mis-targets non-shelf units]** → Mitigation: the SQL backfill scopes to `Unit.type = 'SHELF'` via subquery. Non-shelf units (books, posts, etc.) that happen to have seed-tag UnitTag rows are not touched.

- **[User unpins all tags, shelf vanishes from filter view]** → This is correct behaviour: a shelf with no pinned content-type tag is intentionally "uncategorised". `CollectionModal` already handles the "no filter active" state correctly (`if (!filterTag) return shelves`).

- **[Race condition on concurrent edits]** → Two simultaneous `PUT /shelf/:unitId/pinned-tags` calls converge to the last-write-wins state because the operation is full-set replacement inside a Prisma `$transaction`. No CRDT or merge is needed.

- **[`pinned` column becomes silently overloaded by future user-tag flows]** → Out-of-scope flows (community tag voting) MUST NOT set `pinned = true` unless they intend the filter-chain semantic. Documented in the `shelf-seed-tags` spec delta. If a future flow wants its own "owner intent" channel, it adds a separate column rather than overloading `pinned`.

- **[Position field stays NULL for user-pinned rows]** → Acceptable in v1; the seed-pinned rows have a low deterministic `position`, and the existing index `(unitId, pinned, position)` orders NULL-position rows after seed-positioned rows under default Postgres NULLS LAST. If pinned-tag ordering UX surfaces matter in the future, a follow-on change adds `position` assignment on pin.

## Migration Plan

1. Land mapper filter change + service `pinned = true` write + new `PUT /shelf/:unitId/pinned-tags` endpoint together in one PR. The mapper change is the breaking step semantically.
2. The same PR ships the one-shot backfill SQL as a `migration.sql` file. It runs as part of the standard `prisma:migrate deploy` step on rollout.
3. Verification: post-deploy, run a smoke query confirming `SELECT count(*) FROM "UnitTag" WHERE pinned = true AND tagUnitId IN (<seed-tag-uuids>)` matches the count of `(SHELF unit, seed-tag) pairs` regardless of when they were created.
4. Frontend (`SeedTagChipGroup`, `NewShelfPage` wiring, `ShelfEditPage` wiring, `useSetShelfPinnedTags` hook) ships together with the backend change. No feature flag.
5. **Rollback:** mapper change and service write are pure code; revert PR rolls them back. The backfill is data-only and not destructive (no rows removed, only `pinned = false → true`); a rollback that re-emits unfiltered tags is acceptable until the next forward roll. No `pinned = true → false` reset is performed on rollback.

## Open Questions

None blocking. Sub-decisions like exact endpoint URL pattern (e.g., `PUT /shelf/:unitId/pinned-tags` vs `POST /shelf/:unitId/pin-tags`) follow existing API conventions in `shelf.api.ts` and are finalised during `tasks.md` execution.
