## Why

The four system shelves (`favorites`, `backlog`, `active`, `completed`) currently rely on a silent backend safety-net (`getOrCreateSystemShelf`) embedded inside hot-path mutations — when a user's shelf is missing, the server creates it on the fly without surfacing the failure. This hides three real problems:

1. **The seed fixture path is broken.** `package/utils/src/seed/users.ts:71` (`seedServerUser`) upserts the 4 fixture users (`root`, `admin`, `user`, `blocked`) but never calls `bootstrapSystemShelves`. Those test accounts never have system shelves — the silent safety-net masks the bug.
2. **Backend "magic" couples normal logic with recovery.** Every system-shelf mutation has to thread `getOrCreateSystemShelf` because callers cannot trust the row exists. This is the wrong shape: recovery should be explicit and user-driven, not invisible.
3. **Frontend renders system shelves identically to user shelves.** `CollectionModal` lists `Backlog`/`Active`/`Completed` as collectable targets (semantic nonsense — nobody "backlogs" a post) and displays the DB-stored `${slug}'s Favorites` title even for the owner, which looks broken under i18n.

We solve all three with one change: move the canonical title knowledge to `@rezics/contract`, fix the seed gap, replace the silent helper with an explicit `POST /shelf/system/ensure` route that is **only** invoked when a user clicks a `[Retry]` button in a toast, and refine the frontend to render system shelves correctly for owner-self vs. non-owner audiences.

## What Changes

### Module A — Backend + Contract (zero specialization)

- Add `SYSTEM_SHELF_LABELS` and `formatSystemShelfTitle(slug, kindKey)` to `@rezics/contract`. The canonical title format is `${userSlug}'s ${LABEL[kindKey]}`, always English at bootstrap time, always using the URL-safe slug (not display name).
- Extend `bootstrapSystemShelves(userId, userSlug, tx)` to take a slug and use the contract helper. Thread `userSlug` through all call sites.
- **BREAKING (internal)**: Rename `getOrCreateSystemShelf` → `ensureSystemShelf`. Semantics unchanged — the rename is honesty: this is rare init-recovery, not a normal-flow helper.
- Add `POST /shelf/system/ensure` route. Body `{ kindKey }`. Auth-required. Resolves the viewer's slug from identity, calls `ensureSystemShelf`, returns `{ unitId, created }`. Visibility is **always PRIVATE**; no `visibility`/`title` body parameters; no auto-retry on the server.
- **BREAKING (internal)**: Remove the silent `getOrCreateSystemShelf` calls from `collection.service.ts` (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`). When the favorites shelf is missing, throw `AppError(404, "system_shelf_missing", { kindKey })` instead of silently creating it.
- **Fix seed bug**: add `bootstrapSystemShelves(input.unitId, input.slug, prisma)` to `seedServerUser` in `package/utils/src/seed/users.ts`.
- Fix the type-safety lie in `package/server/prisma/factory/system-shelves.ts:24` where `PrismaClientLike = PrismaTx` while runtime accepts a `PrismaClient`. Change to `PrismaTx | PrismaClient`.

### Module B — Frontend rendering + user-driven retry

- `useSystemShelfRef` gains a `missing: boolean` field (`!isLoading && enabled && unitId === null`). This lets UI decide when to surface a recovery affordance.
- Add `useEnsureSystemShelf(kindKey)` mutation hook. Calls `POST /shelf/system/ensure`. On success, invalidates the relevant `slugResolveQuery`. **No auto-retry, no polling**.
- Add i18n strings for `shelf.system.{favorites,backlog,active,completed}` plus `shelf.system.recoveryToast` (English + Chinese starter set).
- `CollectionModal`:
  - **BREAKING (UX)**: Filter out shelves with `kindKey ∈ {backlog, active, completed}` entirely. They are not collectable targets — they are reached via progress-status side-effects only.
  - For the `favorites` shelf, render the title via i18n (`t('shelf.system.favorites')`) instead of the DB-stored `${slug}'s Favorites`.
  - Non-system (user-created) shelves render unchanged.
- Profile shelf tabs (`profile-shelves-tab` UI):
  - **Owner-self view**: render system-shelf tab labels via i18n keyed on `kindKey`.
  - **Non-owner view**: render the DB-stored title (`alice's Favorites`) as-is.
- Wire a recovery toast into mutations that depend on system shelves (`toggleFavorite`, `collect`). On `system_shelf_missing` 404, display a toast with a `[Retry]` action that triggers `useEnsureSystemShelf` and invalidates queries. The user re-clicks the original action themselves.

### Out of scope (explicit non-goals)

- Auto-syncing shelf titles when a user renames their slug. Backend stores the title at bootstrap time and never rewrites it. If the user wants their renamed slug to appear, they edit the shelf manually via existing `PUT /shelf/:unitId`.
- A dedicated "system shelf settings" editor (language switcher, sync-username button). Task T15 is listed as optional and may be deferred.
- Redesigning Backlog as a non-shelf "wishlist / series" feature. Today, `progress → BACKLOG` side-effect-adds to the backlog shelf, and this remains acceptable.
- Calling `bootstrapSystemShelves` from `materializeFromVerifiedAuth`. The happy-path assumption is that `completeProfileSetup` follows; `/shelf/system/ensure` is the safety net for orphan-state users.

## Capabilities

### New Capabilities

None. All changes are delta updates to existing specs.

### Modified Capabilities

- `shelf-collection`: rename `getOrCreateSystemShelf` → `ensureSystemShelf`; introduce `POST /shelf/system/ensure` requirement; specify that `collection.service.ts` lookups are read-only and return 404 on missing system shelf; specify the canonical `${slug}'s ${label}` bootstrap title format and that `SYSTEM_SHELF_LABELS` lives in `@rezics/contract`; specify the `CollectionModal` filter rule (only `favorites` among system shelves) and the owner-self i18n rendering rule.
- `user-unit-progress`: update references from `getOrCreateSystemShelf` to `ensureSystemShelf`. No behavioral change.
- `progress-status-ui`: specify the client-side recovery flow — on `system_shelf_missing` 404, surface a toast with a `[Retry]` action that calls `POST /shelf/system/ensure`; user retries the original mutation manually. No auto-retry.
- `profile-shelves-tab`: specify that the shelf tab label rendering uses i18n keys for system shelves in owner-self view, and the DB-stored title in non-owner view.

## Impact

### Affected packages

- `package/contract` — new `SYSTEM_SHELF_LABELS`, `formatSystemShelfTitle` exports.
- `package/server` — `shelf/system-shelves.ts` (rename, signature extension), `shelf/shelf.api.ts` (new `/shelf/system/ensure` route), `shelf/collection.service.ts` (remove silent helper calls, surface 404), `user/service/user.service.ts` (slug threading on 2 callsites), `internal/internal.api.ts` (slug already available at `finalSlug`).
- `package/server/prisma/factory` — `system-shelves.ts` (type-safety fix, contract import, signature), `users.ts` (slug already at `plan.slug`).
- `package/utils/src/seed/users.ts` — **seed bug fix**: add `bootstrapSystemShelves` call.
- `package/api` — `shelf/` new `useEnsureSystemShelf`; `slug/useSystemShelfRef.ts` add `missing` field.
- `package/app` — `collection/components/CollectionModal.tsx` filtering + i18n; profile shelf tabs i18n; recovery toast component; i18n strings (en + zh seed).

### Backward compatibility

This is internal-development-stage refactoring. Per CLAUDE.md "Development-Stage Compatibility", no backward-compatible aliases are added:

- `getOrCreateSystemShelf` export is removed in favor of `ensureSystemShelf` (rename, not deprecation).
- `bootstrapSystemShelves` signature is breaking: `(userId, tx)` → `(userId, userSlug, tx)`. All call sites are updated atomically in this change.
- Existing dev/staging databases produced by the broken seed path (fixture users without shelves) will self-heal: an admin/user logging in and clicking `♡` on any content will get the `system_shelf_missing` toast, click `[Retry]`, and the ensure path will create the missing shelves. Alternatively, re-running `bun run seed` after this change merges will create them eagerly.

### Migration

No Prisma migration. Title format changes from server-local `"Favorites"` to contract-derived `"${slug}'s Favorites"` only at bootstrap time; pre-existing rows keep their current titles unless manually re-bootstrapped. No data backfill is mandated — the seed fix re-seeds fixture users with correct titles on the next run.

### Risk

- **The seed fix is the highest-value piece**. If only Module A's seed task ships, the immediate bug disappears.
- **Removing silent magic could expose latent bugs** elsewhere (other code paths that assumed favorites always exists). Mitigation: the contract `system_shelf_missing` error code is greppable and the recovery toast is user-friendly. Any code path that catches the error can be reviewed.
- **Frontend filter risks user confusion** ("where did Backlog go in CollectionModal?"). Mitigation: this matches stated UX intent ("nobody backlogs a post"); progress-status pills remain the documented Backlog entry point.
