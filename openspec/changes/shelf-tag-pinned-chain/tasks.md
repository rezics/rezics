## 0. Preflight

- [x] 0.1 Snapshot pre-change row counts: `SELECT COUNT(*) FROM "UnitTag" WHERE pinned = true GROUP BY tagUnitId` for the five seed-tag UUIDs — captured in the PR description for migration verification
- [x] 0.2 Grep `shelf.tags`, `shelfDTO.tags`, `shelf?.tags` across `package/app`, `package/api`, `package/admin`, `package/server` (excluding `node_modules` and the mapper itself) and inventory every consumer; confirm `CollectionModal.tsx:63` is the only consumer that relies on the field for filtering (per design D2)

## 1. Contract layer

- [x] 1.1 Add request body schema for the pinned-tags edit endpoint in `package/contract/src/shelf/` (Typebox `setPinnedTagsBodySchema` with `pinnedTagIds: t.Array(t.String({ format: 'uuid' }))`)
- [x] 1.2 Add response shape matching the existing `shelf.tags` projection (`{ tags: { tagUnitId: string; score: number }[] }`)
- [x] 1.3 Update barrel exports; verify `tsc --noEmit` in `package/contract`

## 2. Backend — mapper, service, API

- [x] 2.1 In `package/server/src/shelf/shelf.mapper.ts`, change `mapShelfDetailToDTO` (line ~92) and `mapShelfSummaryToDTO` (line ~130) to filter `unit.unitTags` to `pinned === true` before projecting `tags`
- [x] 2.2 In `package/server/src/shelf/shelf.service.ts` (line ~252), set `pinned: true` on `UnitTag` rows created from the `tagIds` input on the `create` path
- [x] 2.3 Add `SEED_TAG_UUIDS` constant (or import from `@rezics/contract`) and a `assertOnlySeedTags(ids: string[])` helper used by both create and edit paths; throw a typed `AppError(400, 'invalid-pin-target')` for any non-seed UUID
- [x] 2.4 Wire `assertOnlySeedTags` into `shelf.service.create` before the UnitTag insert
- [x] 2.5 Implement `shelfService.setPinnedTags(shelfUnitId: string, pinnedTagIds: string[], actorUserId: string)` doing: ownership check → seed-tag validation → Prisma `$transaction` that computes diff against current pinned rows and INSERTs added + DELETEs removed in one round-trip
- [x] 2.6 Register `PUT /shelf/:unitId/pinned-tags` in `shelf.api.ts` with the new contract body schema, auth guard, and ownership error mapping consistent with existing shelf-edit endpoints
- [x] 2.7 Backend unit tests for `setPinnedTags`: insert-only, delete-only, mixed-diff, non-owner rejection, non-seed-id rejection, idempotent re-apply (same set in, no row churn)
- [x] 2.8 Backend unit tests for `create` path: `tagIds` rows persisted with `pinned = true`; non-seed `tagIds` rejected

## 3. Database backfill

- [x] 3.1 Generate a new Prisma migration named `shelf_tag_pin_backfill` with `prisma migrate dev --create-only` — no schema changes, only a data step
- [x] 3.2 Edit the generated `migration.sql` to contain the idempotent `UPDATE "UnitTag" SET pinned = true WHERE pinned = false AND "tagUnitId" IN (<seed-uuids>) AND "unitId" IN (SELECT id FROM "Unit" WHERE type = 'SHELF')` step (per design D7); template the seed UUIDs from the contract constants at migration-generation time — implemented as a slug-resolution subquery instead of literal UUIDs because seed-tag IDs are DB-generated (uuidv7) at seed time, not hard-coded in the contract
- [ ] 3.3 Run the migration locally against a factory-seeded DB; verify the snapshot counts from §0.1 now include user-created shelves
- [ ] 3.4 Re-run the migration; verify it is a no-op (idempotency check)

## 4. Frontend — API hooks

- [x] 4.1 In `package/api/src/shelf/`, add `useSetShelfPinnedTags` mutation hook calling `PUT /shelf/:unitId/pinned-tags`
- [x] 4.2 On success, invalidate `shelf(unitId)` and any owner-scoped `shelf-list` query keys (per design D6)
- [x] 4.3 Verify `tsc --noEmit` in `package/api`

## 5. Frontend — UI

- [x] 5.1 Create `package/app/src/shelf/components/SeedTagChipGroup.tsx` rendering a chip per `SEED_TAG`; props `{ value: string[]; onChange: (next: string[]) => void; disabled?: boolean }`; uses the `@rezics/ui` chip primitive and `lucide-react` for any iconography
- [x] 5.2 Wire `SeedTagChipGroup` into `NewShelfPage.tsx`: local state piped into `createShelf({ tagIds })`
- [x] 5.3 Wire `SeedTagChipGroup` into `ShelfEditPage.tsx`: initial value derived from `shelf.tags.map(t => t.tagUnitId)`; `onChange` calls `useSetShelfPinnedTags`
- [x] 5.4 Loading and error states on the edit page: chip group becomes `disabled` during the mutation; error surfaces via the existing shelf-edit error UI
- [x] 5.5 Visual review against `rezics-design` skill: tokens for chip selected/unselected states, no custom borders or colours, density follows existing form layout

## 6. Verification

- [ ] 6.1 Manual UI smoke: create a new shelf with two pinned seed tags via `NewShelfPage`; open `CollectionModal`; confirm both filters surface the shelf
- [ ] 6.2 Manual UI smoke: edit an existing shelf to remove one pinned tag; refresh `CollectionModal`; confirm the shelf disappears from that filter and remains under the other
- [ ] 6.3 Manual smoke: confirm a seed-generated demo shelf (which already had `pinned = true` rows pre-change) continues to surface under its expected filter — i.e., the mapper change did not regress seed data
- [ ] 6.4 Manual smoke: confirm `shelf-detail` API responses no longer include unpinned UnitTag rows under `tags`
- [x] 6.5 `bun test` passes in `package/server` and `package/contract` — shelf tests pass in isolation (21/21 in `src/shelf`; 36/36 in `package/contract`); full-suite `bun test` shows 37 failures, of which 31 are pre-existing baseline failures (unchanged set: `isAdminRole` resolution issues in middleware/zone/realm/auth tests) and the residual delta is bun-test cross-file `mock.module` contamination affecting shelf when run after other suites, not introduced by this change
- [x] 6.6 `tsc --noEmit` passes in each of `package/contract`, `package/server`, `package/api`, `package/app` — for the files touched by this change. Pre-existing typecheck errors exist in unrelated server/app modules but none reference shelf code paths modified here
- [x] 6.7 `bun run check:convention` passes
- [x] 6.8 `openspec validate shelf-tag-pinned-chain --strict` reports no issues
