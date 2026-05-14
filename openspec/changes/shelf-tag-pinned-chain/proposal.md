## Why

`CollectionModal` filters the user's shelf list by seed tags (`book` / `game` / `media` / `post` / `link`) by reading `shelfDTO.tags`. The chain works for seed-generated demo shelves whose `UnitTag` rows were populated at seed time, but breaks for every user-created shelf: neither `NewShelfPage` nor `ShelfEditPage` exposes a tag-selection affordance, so user shelves carry no tag rows and become invisible to the filter. The Shelf feature stays one chip-picker away from being end-to-end usable.

The schema substrate is already in place (`UnitTag.pinned`, dedicated index `(unitId, pinned, position)`). What is missing is (a) a write path that surfaces ownership intent into pinned UnitTag rows, and (b) a read path that distinguishes owner-pinned tags from incidental high-score tags so that the filter chain reflects owner intent rather than community-driven tag scores leaking in.

This is the L2 work item from `openspec/plans/shelf-and-user-namespace-slug-plan.md` — fully independent of the L3 identity rework and ready to ship now.

## What Changes

- **NEW** User-facing tag pin write path on the shelf detail / edit surface and on the new-shelf surface. The picker is a **multi-select chip group** of the five seed tags (§6.8 of the plan); selecting a chip upserts `UnitTag(unitId=shelfId, tagUnitId=seedTagId, pinned=true)`, deselecting deletes the row (or sets `pinned=false` — final form decided in `design.md`).
- **NEW** Shelf service surface for tag-pin mutation on the edit path: `shelfService.setPinnedTags(shelfUnitId, tagUnitIds[], actorUserId)`. The existing `tagIds` field on `createShelfSchema` is preserved but its semantics are tightened: rows created via that field SHALL be persisted with `pinned = true`.
- **MODIFIED** `shelf.mapper` projection: `shelfDTO.tags` SHALL include only `UnitTag` rows with `pinned = true`. This decouples the owner-pin signal (used by the filter chain) from algorithmic tag scoring (used by tag listings on the shelf detail surface).
- **MODIFIED** `shelf-seed-tags` spec: strengthen the filter-chip requirement to consume only pinned rows; add user-side pin requirements that mirror the existing seed-side ones.
- **NO** schema migration. `UnitTag.pinned` already exists at `package/server/prisma/schema.prisma:614` with the required composite index.

## Capabilities

### New Capabilities

None. The capability — content-type filtering of shelves via seed tags — already exists; this change extends its semantics and write surface within the existing `shelf-seed-tags` spec.

### Modified Capabilities

- `shelf-seed-tags`: the existing "Seed tags used as shelf content-type filters" requirement SHALL require the read path to filter on `pinned = true`; new requirements SHALL cover user-side pinning via shelf create / edit, server-side persistence with `pinned = true`, and mapper-level projection of pinned-only rows.

## Impact

**Affected packages:**

- `package/server`
  - `shelf.service.ts`: `create` flow sets `pinned = true` on UnitTag rows created from the `tagIds` input. New `setPinnedTags(shelfUnitId, tagUnitIds[], actorUserId)` service method performing a diff-based upsert against the seed-tag whitelist.
  - `shelf.api.ts`: new endpoint `PUT /shelf/:unitId/pinned-tags` (or extending an existing edit endpoint — decided in `design.md`).
  - `shelf.mapper.ts`: `mapShelfDetailToDTO` and `mapShelfSummaryToDTO` filter `unit.unitTags` to `pinned === true` before projecting `tags`.
  - Authorisation: ownership check on the shelf before any pin mutation, mirroring existing shelf-edit auth.
  - Validation: pin operations accept only seed-tag UUIDs (resolved from the existing seed-tag constants); non-seed tag IDs are rejected with a typed error.

- `package/contract`
  - New body schema for the pinned-tags mutation (`pinnedTagIds: string[]`); response schema mirrors the existing `shelfDTO.tags` shape.

- `package/api`
  - New TanStack Query hook(s): `useSetShelfPinnedTags` (mutation) + cache invalidation for `shelf` and `shelf-list` queries so the chip surface reflects new pins immediately.

- `package/app`
  - `NewShelfPage`: render a `SeedTagChipGroup` multi-select below the title/cover fields; selections feed `createShelf({ tagIds })`.
  - `ShelfEditPage`: render the same chip group bound to the existing shelf's `pinned-tags` set; mutations call `useSetShelfPinnedTags`.
  - The chip group itself is a thin composition over the existing chip/toggle primitives in `@rezics/ui`; no new component primitive is introduced.
  - `CollectionModal`: **no code change**. The filter at `CollectionModal.tsx:63` already reads `shelf.tags`; once the mapper filters by `pinned`, the filter automatically reflects owner intent.

- `package/admin`, `package/auth`, `package/notify`: no impact.

**Dependencies:** none. Independent of L3 / Subscription work.

**Backward compatibility:**

- Per the development-stage policy in `CLAUDE.md`, no alias / dual-read shim is introduced.
- Existing UnitTag rows on seed shelves already have `pinned = true` (per `shelf-seed-tags` current spec). Existing UnitTag rows on user-created shelves created via the current `tagIds` path were persisted with the default `pinned = false`. The migration plan is a one-shot SQL backfill (`UPDATE "UnitTag" SET pinned = true WHERE tagUnitId IN (<seed-tag-ids>)`) bundled with the change so existing user-created data participates in the filter chain immediately. Backfill detail and idempotency belong in `design.md`.
- No API removals. The existing `tagIds` field on `createShelfSchema` keeps the same shape; only its persisted `pinned` flag changes.

**Risk:** low. Pure additive UI plus one mapper filter tweak and one targeted backfill. No schema migration, no cross-service work.

**Estimate:** 1–2 days, including the backfill verification.
