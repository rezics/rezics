## 1. Contract: canonical labels and title helper

- [ ] 1.1 Create `package/contract/src/shelf/system-shelves.ts` exporting `SYSTEM_SHELF_LABELS: Record<SystemShelfKindKey, string>` (favorites/backlog/active/completed → "Favorites"/"Backlog"/"Active"/"Completed") and `formatSystemShelfTitle(slug, kindKey, label?)`.
- [ ] 1.2 Add a barrel re-export from `package/contract/src/index.ts` (or the shelf sub-export per file convention) so consumers import via `@rezics/contract`.
- [ ] 1.3 Add a `package/contract/src/shelf/system-shelves.test.ts` covering the helper output for all four kindKeys, the custom-label override, and the type-level shape of `SYSTEM_SHELF_LABELS`.
- [ ] 1.4 Verify build with `bun -F @rezics/contract build` (or root `bun run build`) and confirm no circular import is introduced.

## 2. Server: bootstrap signature and helper rename

- [ ] 2.1 Edit `package/server/src/shelf/system-shelves.ts`: remove the local `SYSTEM_SHELF_TITLES` record, import `SYSTEM_SHELF_LABELS` and `formatSystemShelfTitle` from `@rezics/contract`.
- [ ] 2.2 Change `bootstrapSystemShelves` signature to `(userId, userSlug, client)`. Update its body to pass `userSlug` through to `findOrCreateSystemShelf` and ultimately to `createSystemShelf`.
- [ ] 2.3 Change `createSystemShelf` signature to `(userId, userSlug, kindKey, client)`. Replace the inline `SYSTEM_SHELF_TITLES[kindKey]` write with `formatSystemShelfTitle(userSlug, kindKey)`.
- [ ] 2.4 Rename the exported function `getOrCreateSystemShelf` → `ensureSystemShelf`. Update its signature to `(userId, userSlug, kindKey, client?)`. Update the internal helper `findOrCreateSystemShelf` accordingly. Update `package/server/src/shelf/index.ts` barrel re-export.
- [ ] 2.5 Update `package/server/src/shelf/system-shelves.test.ts` to cover the new signature shape and label format `${slug}'s ${Label}`. Existing tests under names referencing `getOrCreateSystemShelf` SHALL be renamed.

## 3. Server: new ensure route

- [ ] 3.1 Add `POST /shelf/system/ensure` to `package/server/src/shelf/shelf.api.ts`. Body schema in `@rezics/contract` (Typebox) as `ensureSystemShelfBodySchema = t.Object({ kindKey: systemShelfKindKeySchema })` with `additionalProperties: false` to reject auxiliary fields.
- [ ] 3.2 Implement handler: resolve caller's slug from `userService.getById(identity.userId)` (or equivalent — verify path), call `ensureSystemShelf(userId, slug, kindKey)`, return `{ unitId, created }`. The handler SHALL track whether the helper's create branch fired to populate `created`. Adjust `ensureSystemShelf` to surface that signal (e.g., return `{ unitId, created: boolean }`).
- [ ] 3.3 Mount the route under `/shelf` with `requireLogin: true`. Add an OpenAPI `detail.summary` and `tags: ["Shelves"]`.
- [ ] 3.4 Add `EnsureSystemShelfResponse` type to `@rezics/contract` and re-export it through `@rezics/api` for the frontend hook.
- [ ] 3.5 Write integration tests in `package/server/src/shelf/shelf.api.test.ts` (or new `shelf.api.ensure.test.ts`) covering: 401 unauthenticated, 400 unknown kindKey, 400 auxiliary body field, 200 `created: false` when shelf exists, 200 `created: true` when shelf absent, idempotent second call returns `created: false`.

## 4. Server: remove silent magic from collection.service

- [ ] 4.1 In `package/server/src/shelf/collection.service.ts`, replace `private async getFavoritesShelfId(userId)` body so that it calls a read-only `findSystemShelf(userId, "favorites")` (export the existing private function from `system-shelves.ts` if needed). When the row is missing, throw `AppError(404, "system_shelf_missing", { kindKey: "favorites" })`.
- [ ] 4.2 Verify the three call sites (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`) propagate the new 404 with structured payload. Update `package/server/src/utils/errors.ts` `AppError` if it does not yet support attaching an arbitrary structured field; otherwise extend it minimally to include `{ code, kindKey }` on the JSON serialization.
- [ ] 4.3 Update or remove `collection.service.ts` test cases that assumed silent creation. Add a new test case asserting that `toggleFavorite` for a user without a favorites shelf throws 404 with code `system_shelf_missing`.
- [ ] 4.4 Run `bun -F @rezics/server test` and confirm only the new behavior surfaces.

## 5. Server: thread userSlug through every bootstrap caller

- [ ] 5.1 `package/server/src/user/service/user.service.ts:232` (`create`): pass `req.slug` as second arg to `bootstrapSystemShelves`.
- [ ] 5.2 `package/server/src/user/service/user.service.ts:307` (`completeProfileSetup`): pass `payload.slug` as second arg.
- [ ] 5.3 `package/server/src/internal/internal.api.ts:76` (`/internal/users/provision`): pass `finalSlug` (already computed at line 44) as second arg.
- [ ] 5.4 Update `package/server/src/internal/internal.api.test.ts` mock signature for `bootstrapSystemShelves` if it asserts the old shape.
- [ ] 5.5 `bun -F @rezics/server typecheck` clean.

## 6. Factory: type-safety fix and contract import

- [ ] 6.1 Edit `package/server/prisma/factory/system-shelves.ts`: import `SYSTEM_SHELF_LABELS` + `formatSystemShelfTitle` from `@rezics/contract`. Remove the local `SYSTEM_SHELF_TITLES` record.
- [ ] 6.2 Change the `PrismaClientLike` alias from `PrismaTx` to `PrismaTx | PrismaClient` to match the actual runtime usage (`ctx.prisma` is passed at `factory/users.ts:144`).
- [ ] 6.3 Update `bootstrapSystemShelves` signature in the factory copy to `(userId, userSlug, client)`. Update `createSystemShelf` and `findOrCreateSystemShelf` likewise.
- [ ] 6.4 Edit `package/server/prisma/factory/users.ts:144` to pass `plan.slug` as the second arg.

## 7. Seed bug fix: utils/seed/users.ts

- [ ] 7.1 Edit `package/utils/src/seed/users.ts`: import `bootstrapSystemShelves` from `@rezics/server/prisma/factory/system-shelves` (or the unified factory copy if a single source is preferred — confirm the import path resolves cleanly from `package/utils`).
- [ ] 7.2 At the end of `seedServerUser` (after the `prisma.user.upsert` block, line 110), add `await bootstrapSystemShelves(input.unitId, input.slug, prisma)`.
- [ ] 7.3 Verify by running `bun run seed:factory:fast` (or any preset that triggers `seedAllMainUsers`) against a fresh DB and asserting that `root@rezics.com`, `admin@rezics.com`, `user@rezics.com`, `blocked@rezics.com` each have four shelves under `Unit { type: SHELF, slugScope: <theirUnitId> }`. A targeted check: `bun run prisma:studio` and confirm visually, or a SQL count via `psql`.
- [ ] 7.4 Add a regression test in `package/utils/src/seed/users.test.ts` (or extend the nearest existing test) that seeds the four fixture users and asserts each has the four expected system shelves with titles matching `formatSystemShelfTitle(slug, kindKey)`.

## 8. Repo-wide call-site migration verification

- [ ] 8.1 Grep for the old symbol: `rg "getOrCreateSystemShelf" package/`. Expect zero hits after Tasks 2–7 land.
- [ ] 8.2 Grep for the duplicate literal: `rg "SYSTEM_SHELF_TITLES" package/`. Expect zero hits.
- [ ] 8.3 Grep for `bootstrapSystemShelves\(` — confirm every callsite passes three args (`userId, userSlug, tx|prisma`).
- [ ] 8.4 Run root `bun run typecheck` and `bun run check:convention` (R5 outbound links, etc.) clean.
- [ ] 8.5 Run `bun -F @rezics/server test` and `bun -F @rezics/utils test` clean.

## 9. Frontend: useSystemShelfRef.missing field

- [ ] 9.1 Extend `UseSystemShelfRefResult` in `package/api/src/slug/useSystemShelfRef.ts` with `missing: boolean`.
- [ ] 9.2 Compute `missing = enabled && !query.isLoading && query.data?.unitId == null` (verify the precise shape vs. the existing `query.data?.unitId` access).
- [ ] 9.3 Update `useSystemShelfIds` in `package/app/src/progress-status/hooks/useSystemShelfIds.ts` to also surface the four `missing` flags so consumers can derive recovery prompts at the group level.
- [ ] 9.4 Add a unit test under `package/api` covering the three states (loading / authenticated-missing / unauthenticated).

## 10. Frontend: useEnsureSystemShelf hook

- [ ] 10.1 Add `package/api/src/shelf/useEnsureSystemShelf.ts` that wraps a `useMutation` calling `POST /shelf/system/ensure` via the project's API client. On `onSuccess`, invalidate the relevant `slugResolveQuery` for `(scope: viewer.unitId, slug: kindKey)`.
- [ ] 10.2 Add the corresponding API client method in `package/api/src/shelf/shelf.api.ts` typed against the contract's `EnsureSystemShelfResponse`.
- [ ] 10.3 Re-export from `package/api/src/shelf/index.ts`.
- [ ] 10.4 The hook SHALL NOT carry retry-on-error logic; surface errors to the caller for the toast to render. Verify the project's mutation defaults don't enable global retry for this mutation key.

## 11. Frontend: i18n strings (en + zh starter)

- [ ] 11.1 Locate the project's i18n resource file(s) (likely under `package/app/src/i18n/` or similar — verify and document path). Add keys:
  - `shelf.system.favorites` (en: "Favorites", zh: "收藏")
  - `shelf.system.backlog` (en: "Backlog", zh: "待看")
  - `shelf.system.active` (en: "Active", zh: "在看")
  - `shelf.system.completed` (en: "Completed", zh: "已读")
  - `shelf.system.recoveryToast` (en: "Your {kind} shelf isn't ready.", zh: "{kind} 列表暂未就绪。")
  - `shelf.system.recoveryRetry` (en: "Retry", zh: "重试")
- [ ] 11.2 Verify `bun -F @rezics/app dev` renders the strings via `t()` without console missing-key warnings.

## 12. Frontend: CollectionModal filter and i18n

- [ ] 12.1 Edit `package/app/src/collection/components/CollectionModal.tsx`. Import `SYSTEM_SHELF_KIND_KEYS` from `@rezics/contract`.
- [ ] 12.2 Filter `filteredShelves` to exclude shelves whose `kindKey` is `backlog`, `active`, or `completed` (keep `favorites` and `null`/user-created kindKeys).
- [ ] 12.3 When rendering a shelf row whose `kindKey === "favorites"`, replace the displayed title with `t('shelf.system.favorites')` instead of `shelf.title`. Non-system shelves render `shelf.title` unchanged.
- [ ] 12.4 Verify in the dev server that opening the CollectionModal on any unit lists only Favorites + user-created shelves; Backlog/Active/Completed are absent. Locale switch confirms the i18n label renders for Favorites.
- [ ] 12.5 Update or extend any CollectionModal snapshot/integration tests to reflect the filter.

## 13. Frontend: profile shelves tab i18n

- [ ] 13.1 Locate the Shelves-tab rendering component (likely under `package/app/src/user/...` or `package/app/src/profile-shelves/...` — verify exact file path).
- [ ] 13.2 For each shelf card whose `kindKey ∈ SYSTEM_SHELF_KIND_KEYS`, if the viewer is the owner (compare current viewer's id with the profile owner's id), render the card title via `t('shelf.system.<kindKey>')`. Otherwise render the DB title.
- [ ] 13.3 The Profile tab labels / chips for system-kind filters (if any) SHALL also use i18n in owner-self view. Confirm the existing `ProfileTabBar.tsx` and related components reflect this.
- [ ] 13.4 Verify in dev with two browser sessions (alice as owner, bob as non-owner) that alice sees i18n labels on her own page and bob sees `alice's Favorites` etc. on alice's page.

## 14. Frontend: recovery toast wiring

- [ ] 14.1 Build a small toast helper (or extend the project's existing toast utility) that, given an `AppError` with `code === "system_shelf_missing"`, renders the message via `t('shelf.system.recoveryToast', { kind: t('shelf.system.<kindKey>') })` and exposes a `[Retry]` action labeled `t('shelf.system.recoveryRetry')`.
- [ ] 14.2 Wire the helper into the `useToggleFavorite` mutation's `onError` (and the `useCollect` mutation likewise). On retry-click, call `useEnsureSystemShelf(kindKey).mutate()` exactly once. On its success, dismiss the toast. The original mutation SHALL NOT be re-issued automatically.
- [ ] 14.3 Manually verify in the dev server: temporarily delete alice's favorites shelf row in Prisma Studio, click ♡ in the app, observe the toast, click `[Retry]`, observe the shelf created and toast dismissed. Click ♡ a second time and confirm the favorite is recorded.
- [ ] 14.4 Add a test stub or playwright/e2e case if the project has one for shelf flows; otherwise, document the manual verification steps in the change PR description.

## 15. Optional: shelf settings entry for system shelves

- [ ] 15.1 (Optional) Add a "Settings" entry on the system shelf detail page (owner-self only) that opens a sheet/modal exposing visibility toggle and per-language title editing, both backed by the existing `PUT /shelf/:unitId`. No new backend API.
- [ ] 15.2 (Optional) The sheet's "Sync username to title" button SHALL be a frontend convenience: it reads the current viewer's slug and submits a `PUT` with a new title computed via the contract `formatSystemShelfTitle` helper. The backend SHALL NOT special-case this.
- [ ] 15.3 (Optional) Skip if scope is too large; tasks 1–14 form the shippable change. Mark this section as deferred in the PR description if so.

## 16. Documentation and PR

- [ ] 16.1 Update the change log entry in the PR description noting the breaking-internal rename (`getOrCreateSystemShelf` → `ensureSystemShelf`) and the new `POST /shelf/system/ensure` route.
- [ ] 16.2 Note in the PR description that existing dev / staging DBs containing fixture users (root/admin/user/blocked) without shelves will self-heal on re-seed (`bun run seed:factory:fast`) or via the new recovery toast on first ♡ click.
- [ ] 16.3 Run `bun run check:convention` and root `bun run typecheck` clean before requesting review.
