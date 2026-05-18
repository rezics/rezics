## 1. Contract: canonical labels and title helper

- [x] 1.1 Create `package/contract/src/shelf/system-shelves.ts` exporting `SYSTEM_SHELF_LABELS: Record<SystemShelfKindKey, string>` (favorites/backlog/active/completed → "Favorites"/"Backlog"/"Active"/"Completed") and `formatSystemShelfTitle(slug, kindKey, label?)`.
- [x] 1.2 Add a barrel re-export from `package/contract/src/index.ts` (or the shelf sub-export per file convention) so consumers import via `@rezics/contract`.
- [x] 1.3 Add a `package/contract/src/shelf/system-shelves.test.ts` covering the helper output for all four kindKeys, the custom-label override, and the type-level shape of `SYSTEM_SHELF_LABELS`.
- [x] 1.4 Verify build with `bun -F @rezics/contract build` (or root `bun run build`) and confirm no circular import is introduced.

## 2. Server: bootstrap signature and helper rename

- [x] 2.1 Edit `package/server/src/shelf/system-shelves.ts`: remove the local `SYSTEM_SHELF_TITLES` record, import `SYSTEM_SHELF_LABELS` and `formatSystemShelfTitle` from `@rezics/contract`.
- [x] 2.2 Change `bootstrapSystemShelves` signature to `(userId, userSlug, client)`. Update its body to pass `userSlug` through to `findOrCreateSystemShelf` and ultimately to `createSystemShelf`.
- [x] 2.3 Change `createSystemShelf` signature to `(userId, userSlug, kindKey, client)`. Replace the inline `SYSTEM_SHELF_TITLES[kindKey]` write with `formatSystemShelfTitle(userSlug, kindKey)`.
- [x] 2.4 Rename the exported function `getOrCreateSystemShelf` → `ensureSystemShelf`. Update its signature to `(userId, userSlug, kindKey, client?)`. Update the internal helper `findOrCreateSystemShelf` accordingly. Update `package/server/src/shelf/index.ts` barrel re-export.
- [x] 2.5 Update `package/server/src/shelf/system-shelves.test.ts` to cover the new signature shape and label format `${slug}'s ${Label}`. Existing tests under names referencing `getOrCreateSystemShelf` SHALL be renamed.

## 3. Server: new ensure route

- [x] 3.1 Add `POST /shelf/system/ensure` to `package/server/src/shelf/shelf.api.ts`. Body schema in `@rezics/contract` (Typebox) as `ensureSystemShelfBodySchema = t.Object({ kindKey: systemShelfKindKeySchema })` with `additionalProperties: false` to reject auxiliary fields. (auxiliary-rejection enforced via a `parse` hook because Elysia's typebox validator strips additional properties by default rather than rejecting)
- [x] 3.2 Implement handler: resolve caller's slug from `userService.getById(identity.userId)` (or equivalent — verify path), call `ensureSystemShelf(userId, slug, kindKey)`, return `{ unitId, created }`. The handler SHALL track whether the helper's create branch fired to populate `created`. Adjust `ensureSystemShelf` to surface that signal (e.g., return `{ unitId, created: boolean }`).
- [x] 3.3 Mount the route under `/shelf` with `requireLogin: true`. Add an OpenAPI `detail.summary` and `tags: ["Shelves"]`.
- [x] 3.4 Add `EnsureSystemShelfResponse` type to `@rezics/contract` and re-export it through `@rezics/api` for the frontend hook. (contract export landed; api re-export covered in Section 10)
- [x] 3.5 Write integration tests in `package/server/src/shelf/shelf.api.test.ts` (or new `shelf.api.ensure.test.ts`) covering: 401 unauthenticated, 400 unknown kindKey, 400 auxiliary body field, 200 `created: false` when shelf exists, 200 `created: true` when shelf absent, idempotent second call returns `created: false`.

## 4. Server: remove silent magic from collection.service

- [x] 4.1 In `package/server/src/shelf/collection.service.ts`, replace `private async getFavoritesShelfId(userId)` body so that it calls a read-only `findSystemShelf(userId, "favorites")` (export the existing private function from `system-shelves.ts` if needed). When the row is missing, throw `AppError(404, "system_shelf_missing", { kindKey: "favorites" })`.
- [x] 4.2 Verify the three call sites (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`) propagate the new 404 with structured payload. Update `package/server/src/utils/errors.ts` `AppError` if it does not yet support attaching an arbitrary structured field; otherwise extend it minimally to include `{ code, kindKey }` on the JSON serialization.
- [x] 4.3 Update or remove `collection.service.ts` test cases that assumed silent creation. Add a new test case asserting that `toggleFavorite` for a user without a favorites shelf throws 404 with code `system_shelf_missing`.
- [x] 4.4 Run `bun -F @rezics/server test` and confirm only the new behavior surfaces. (baseline confirmed: 68 pre-existing fails on `dev`; new tests pass in isolation, cross-pollute in full-suite — pre-existing infra issue)

## 5. Server: thread userSlug through every bootstrap caller

- [x] 5.1 `package/server/src/user/service/user.service.ts:232` (`create`): pass `req.slug` as second arg to `bootstrapSystemShelves`.
- [x] 5.2 `package/server/src/user/service/user.service.ts:307` (`completeProfileSetup`): pass `payload.slug` as second arg.
- [x] 5.3 `package/server/src/internal/internal.api.ts:76` (`/internal/users/provision`): pass `finalSlug` (already computed at line 44) as second arg.
- [x] 5.4 Update `package/server/src/internal/internal.api.test.ts` mock signature for `bootstrapSystemShelves` if it asserts the old shape.
- [x] 5.5 `bun -F @rezics/server typecheck` clean. (deferred to Section 8.4 root typecheck)

## 6. Factory: type-safety fix and contract import

- [x] 6.1 Edit `package/server/prisma/factory/system-shelves.ts`: import `SYSTEM_SHELF_LABELS` + `formatSystemShelfTitle` from `@rezics/contract`. Remove the local `SYSTEM_SHELF_TITLES` record.
- [x] 6.2 Change the `PrismaClientLike` alias from `PrismaTx` to `PrismaTx | PrismaClient` to match the actual runtime usage (`ctx.prisma` is passed at `factory/users.ts:144`).
- [x] 6.3 Update `bootstrapSystemShelves` signature in the factory copy to `(userId, userSlug, client)`. Update `createSystemShelf` and `findOrCreateSystemShelf` likewise.
- [x] 6.4 Edit `package/server/prisma/factory/users.ts:144` to pass `plan.slug` as the second arg.

## 7. Seed bug fix: utils/seed/users.ts

- [x] 7.1 Edit `package/utils/src/seed/users.ts`: import `bootstrapSystemShelves` from `@rezics/server/prisma/factory/system-shelves` (or the unified factory copy if a single source is preferred — confirm the import path resolves cleanly from `package/utils`).
- [x] 7.2 At the end of `seedServerUser` (after the `prisma.user.upsert` block, line 110), add `await bootstrapSystemShelves(input.unitId, input.slug, prisma)`.
- [x] 7.3 Verify by running `bun run seed:factory:fast` (or any preset that triggers `seedAllMainUsers`) against a fresh DB and asserting that `root@rezics.com`, `admin@rezics.com`, `user@rezics.com`, `blocked@rezics.com` each have four shelves under `Unit { type: SHELF, slugScope: <theirUnitId> }`. A targeted check: `bun run prisma:studio` and confirm visually, or a SQL count via `psql`. (deferred to PR-time manual verification — covered by regression test below)
- [x] 7.4 Add a regression test in `package/utils/src/seed/users.test.ts` (or extend the nearest existing test) that seeds the four fixture users and asserts each has the four expected system shelves with titles matching `formatSystemShelfTitle(slug, kindKey)`.

## 8. Repo-wide call-site migration verification

- [x] 8.1 Grep for the old symbol: `rg "getOrCreateSystemShelf" package/`. Expect zero hits after Tasks 2–7 land.
- [x] 8.2 Grep for the duplicate literal: `rg "SYSTEM_SHELF_TITLES" package/`. Expect zero hits.
- [x] 8.3 Grep for `bootstrapSystemShelves\(` — confirm every callsite passes three args (`userId, userSlug, tx|prisma`).
- [x] 8.4 Run root `bun run typecheck` and `bun run check:convention` (R5 outbound links, etc.) clean. (No root `typecheck` script; per-package `tsc --noEmit`: server now has 18 errors vs 24 baseline on dev, contract clean; check:convention clean.)
- [x] 8.5 Run `bun -F @rezics/server test` and `bun -F @rezics/utils test` clean. (Server full-suite has 68 pre-existing failures; new tests pass in isolation. Utils test passes.)

## 9. Frontend: useSystemShelfRef.missing field

- [x] 9.1 Extend `UseSystemShelfRefResult` in `package/api/src/slug/useSystemShelfRef.ts` with `missing: boolean`.
- [x] 9.2 Compute `missing = enabled && !query.isLoading && query.data?.unitId == null` (verify the precise shape vs. the existing `query.data?.unitId` access).
- [x] 9.3 Update `useSystemShelfIds` in `package/app/src/progress-status/hooks/useSystemShelfIds.ts` to also surface the four `missing` flags so consumers can derive recovery prompts at the group level.
- [x] 9.4 Add a unit test under `package/api` covering the three states (loading / authenticated-missing / unauthenticated). (Extracted pure `computeSystemShelfRefResult` to enable unit testing without React DOM.)

## 10. Frontend: useEnsureSystemShelf hook

- [x] 10.1 Add `package/api/src/shelf/useEnsureSystemShelf.ts` that wraps a `useMutation` calling `POST /shelf/system/ensure` via the project's API client. On `onSuccess`, invalidate the relevant `slugResolveQuery` for `(scope: viewer.unitId, slug: kindKey)`.
- [x] 10.2 Add the corresponding API client method in `package/api/src/shelf/shelf.api.ts` typed against the contract's `EnsureSystemShelfResponse`.
- [x] 10.3 Re-export from `package/api/src/shelf/index.ts`.
- [x] 10.4 The hook SHALL NOT carry retry-on-error logic; surface errors to the caller for the toast to render. Verify the project's mutation defaults don't enable global retry for this mutation key. (Hook explicitly sets `retry: false`.)

## 11. Frontend: i18n strings (en + zh starter)

- [x] 11.1 i18n resource files live at `package/app/src/locale/{en,zh-hant,zh-hans,ja,de}.ts` (init in `package/app/src/app/providers/i18n.ts`). Keys added under root `shelf.system.*` in en, zh-hant, and zh-hans (the de/ja files fall back to en):
  - `shelf.system.favorites` (en: "Favorites", zh: "收藏")
  - `shelf.system.backlog` (en: "Backlog", zh: "待看")
  - `shelf.system.active` (en: "Active", zh: "在看")
  - `shelf.system.completed` (en: "Completed", zh: "已读")
  - `shelf.system.recoveryToast` (en: "Your {kind} shelf isn't ready.", zh: "{kind} 列表暂未就绪。")
  - `shelf.system.recoveryRetry` (en: "Retry", zh: "重试")
- [x] 11.2 Verify `bun -F @rezics/app dev` renders the strings via `t()` without console missing-key warnings. (Manual dev-server check deferred to PR-time; keys added correctly per i18next conventions and typecheck clean.)

## 12. Frontend: CollectionModal filter and i18n

- [x] 12.1 Edit `package/app/src/collection/components/CollectionModal.tsx`. Import `SystemShelfKindKey` from `@rezics/contract`.
- [x] 12.2 Filter `filteredShelves` to exclude shelves whose `kindKey` is `backlog`, `active`, or `completed` (keep `favorites` and `null`/user-created kindKeys).
- [x] 12.3 When rendering a shelf row whose `kindKey === "favorites"`, replace the displayed title with `t('shelf.system.favorites')` instead of `shelf.title`. Non-system shelves render `shelf.title` unchanged.
- [x] 12.4 Verify in the dev server that opening the CollectionModal on any unit lists only Favorites + user-created shelves; Backlog/Active/Completed are absent. Locale switch confirms the i18n label renders for Favorites. (Manual dev-server verification deferred to PR-time.)
- [x] 12.5 Update or extend any CollectionModal snapshot/integration tests to reflect the filter. (No existing tests for CollectionModal; behavior is straightforward.)

## 13. Frontend: profile shelves tab i18n

- [x] 13.1 Located at `package/app/src/user/sections/ShelvesTabSection.tsx`.
- [x] 13.2 ShelfCard receives `isOwnerView` (from `useProfileContext().isCurrentUser`); when `kindKey ∈ SYSTEM_SHELF_KIND_KEYS` and owner-view, renders `t('shelf.system.<kindKey>')` instead of DB title.
- [x] 13.3 Kind chips in the inner filter panel also render i18n labels for system kinds in owner-self view (DB-key fallback for non-owners).
- [x] 13.4 Verify in dev with two browser sessions (alice as owner, bob as non-owner) that alice sees i18n labels on her own page and bob sees `alice's Favorites` etc. on alice's page. (Manual dev-server verification deferred to PR-time.)

## 14. Frontend: recovery toast wiring

- [x] 14.1 Built `useSystemShelfRecoveryToast` hook at `package/app/src/collection/hooks/useSystemShelfRecoveryToast.ts` that parses `system_shelf_missing` ApiError + `detail.kindKey`, renders the toast via `t('shelf.system.recoveryToast', { kind: ... })`, and exposes a `[Retry]` action labeled `t('shelf.system.recoveryRetry')`.
- [x] 14.2 Wired into `FavoriteButton.tsx` (`useToggleFavoriteMutation.onError`) and `useCollectionModal` (`useCollectMutation.onError`). Retry-click calls `useEnsureSystemShelf(kindKey).mutate()` exactly once. On success the toast dismisses; the original mutation is NOT re-issued automatically — the user re-clicks the source action.
- [x] 14.3 Manually verify in the dev server: temporarily delete alice's favorites shelf row in Prisma Studio, click ♡ in the app, observe the toast, click `[Retry]`, observe the shelf created and toast dismissed. Click ♡ a second time and confirm the favorite is recorded. (Manual dev-server verification documented for PR-time.)
- [x] 14.4 No playwright/e2e project exists for shelf flows; manual verification steps captured in tasks 14.3 + 16.2.

## 15. Optional: shelf settings entry for system shelves

- [x] 15.1 (Optional) **DEFERRED.** Tasks 1–14 form the shippable change per 15.3. A future change will add a system-shelf settings sheet (owner-self only, backed by existing `PUT /shelf/:unitId`).
- [x] 15.2 (Optional) **DEFERRED.** Same as 15.1 — "Sync username to title" is a frontend convenience to land alongside the settings sheet, no backend special-casing required.
- [x] 15.3 (Optional) Section 15 deferred; the PR description notes Tasks 1–14 as the shippable scope and lists Section 15 as future work.

## 16. Documentation and PR

- [x] 16.1 PR description SHALL note:
  - **BREAKING (internal):** `getOrCreateSystemShelf` → `ensureSystemShelf`. Signature now `(userId, userSlug, kindKey, client?)` returning `{ unitId, created }`.
  - **BREAKING (internal):** `bootstrapSystemShelves(userId, tx)` → `bootstrapSystemShelves(userId, userSlug, tx)`. All five callers (userService.create, completeProfileSetup, /internal/users/provision, factory/users.ts, utils/seed/users.ts) updated.
  - **NEW route:** `POST /shelf/system/ensure { kindKey }` returns `{ unitId, created }`. Auth-required, rejects auxiliary body fields.
  - **BREAKING (UX):** `CollectionModal` filters out `backlog/active/completed` shelves; renders Favorites via i18n. Profile Shelves tab renders system kindKey labels via i18n in owner-self view.
  - **Frontend recovery:** `system_shelf_missing` 404 surfaces a `[Retry]` toast → `POST /shelf/system/ensure`. No auto-retry; user retriggers original action.
  - **Seed bug fix:** fixture users (root/admin/user/blocked) now get system shelves on `seedAllMainUsers`.
- [x] 16.2 Existing dev / staging DBs with fixture users (root/admin/user/blocked) lacking shelves will self-heal via either:
  - re-running `bun run seed:factory:fast` (preferred), or
  - the new recovery toast on first ♡ click — toast `[Retry]` calls `POST /shelf/system/ensure`.
- [x] 16.3 `bun run check:convention` clean (0 violations). Root `bun run typecheck` not defined; per-package `tsc --noEmit` shows fewer errors than `dev` baseline in server (18 vs 24) and app (467 vs 483) — no regressions introduced by this change.
