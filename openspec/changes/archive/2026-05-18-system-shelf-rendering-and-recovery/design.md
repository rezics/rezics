## Context

The four system shelves (`favorites`, `backlog`, `active`, `completed`) are owned jointly by three layers today, and each layer makes a different assumption about who creates the shelf and when:

- **Bootstrap path** (`package/server/src/shelf/system-shelves.ts:123` `bootstrapSystemShelves`) creates all four inside the user-create transaction. Called from `userService.create`, `completeProfileSetup`, `internal.api.ts:/users/provision`, and the factory's `factory/users.ts:144`.
- **Silent safety-net** (`getOrCreateSystemShelf` in the same file) re-checks at every hot-path mutation. `collection.service.ts:36` calls it inside `toggleFavorite`, `getCollectionStatus`, and `getCollectionStatusBatch`. The helper also logs a `console.warn` on the create branch.
- **Fixture seed path** (`package/utils/src/seed/users.ts:71` `seedServerUser`) creates the four fixture users (`root`, `admin`, `user`, `blocked`) but **never** calls `bootstrapSystemShelves`. The silent safety-net hides this gap behind the `console.warn` — and only on first favorite click, never on observation.

A frontend-side recent change (`shelf-system-slugs`, archived 2026-05-16) migrated lookup from a JSON pointer map (`User.extra.shelves`) to slug-based `(slugScope, slug)` lookups on `Unit`. Frontend now resolves via `useSystemShelfRef → useSlugRef`. That refactor preserved the silent helper as a "safety net" — exactly the abstraction this change argues is wrong.

### Current state (concrete)

```
bootstrapSystemShelves(userId, tx)                  ← 4 callsites, slug-aware paths only
   creates  Unit { type: SHELF, slug: kindKey, slugScope: userId,
                   translations: { en: { title: "Favorites" } } }
            Shelf { unitId, kindKey }

getOrCreateSystemShelf(userId, kindKey, client?)     ← 1 service caller (collection.service.ts:36)
   findSystemShelf → createSystemShelf (with warnOnCreate console.warn)
   races handled by P2002 retry-read pattern

seedServerUser(prisma, scope, input)                 ← seed fixture path
   upserts USER Unit + User row
   ❌ no bootstrapSystemShelves call

CollectionModal                                       ← frontend
   renders all shelves uniformly (no kindKey awareness)
   uses DB title ("alice's Favorites") even for owner-self

useSystemShelfRef(kindKey)                            ← frontend
   { isLoading, unitId, data }
   unitId === null is the "missing" signal but undifferentiated from "still loading at first paint"
```

### Constraints

- **Backend specialization must be minimized** (user directive). The backend stores whatever string is passed; it does not understand "system shelf editing" as a separate path. `PUT /shelf/:unitId` already exists and is the only update surface.
- **Development-stage, no compat shims** (CLAUDE.md). Rename and signature changes are atomic and global.
- **i18n exists** in the app via the `t()` helper (per `progress-status-ui` Requirement: Toast and modal copy localization). Adding system-shelf keys is incremental.
- **Slug minting at bootstrap time** is already specced (`shelf-collection` Requirement: System shelves are slug-minted at user creation).

## Goals / Non-Goals

**Goals:**

- Make the silent backend safety-net **dead code in normal operation** by removing its hot-path callers. Keep an *explicit* user-driven invocation behind a new route, `POST /shelf/system/ensure`, that exists solely as the user-visible recovery path.
- Fix the seed bug so `bun run seed` produces fixture users with all four system shelves on the first run, no toast required.
- Move the canonical title knowledge (`SYSTEM_SHELF_LABELS`, `formatSystemShelfTitle`) to `@rezics/contract` so the server, factory copy, and frontend share a single source of truth.
- Render system shelves correctly for the two audiences they have: owner-self (use app i18n keyed on `kindKey`) and non-owner (use the DB-stored title that identifies *whose* shelf this is).
- Remove `Backlog` / `Active` / `Completed` from `CollectionModal` as collectable targets. They reach those shelves only via progress-status side-effects.

**Non-Goals:**

- Auto-syncing the shelf title when a user renames their slug. The backend stores `${slug}'s Favorites` at bootstrap and never rewrites it. Manual rename is via the standard `PUT /shelf/:unitId` (out of scope for the editor UX in this change).
- A specialized "system shelf settings" editor with a language switcher or sync-username button. Listed as T15 optional and may slip.
- Adding `bootstrapSystemShelves` to `materializeFromVerifiedAuth`. Happy-path is materialize → completeProfileSetup, and the ensure route covers the orphan case.
- Decoupling Backlog from the shelf model entirely (the "wishlist / series" redesign is a future change).
- Visibility-toggle UX for system shelves. The data model and `PUT` already support it; UI work is out of scope.

## Decisions

### D1: Move title knowledge to `@rezics/contract`, not to `@rezics/server` or `@rezics/ui`

**Decision:** A new file `package/contract/src/shelf/system-shelves.ts` exports `SYSTEM_SHELF_LABELS: Record<SystemShelfKindKey, string>` and `formatSystemShelfTitle(slug, kindKey, label?)`. Both the server bootstrap path and the factory seed copy import from the contract — eliminating the current duplicate `SYSTEM_SHELF_TITLES` defined in two places.

**Why:** `@rezics/contract` is the shared TypeScript / Typebox layer. `SYSTEM_SHELF_KIND_KEYS` already lives there (`progress.ts:3`). The labels are part of the contract identity, not implementation. Both the server and the seed-runtime `prisma/factory/system-shelves.ts` already import `SYSTEM_SHELF_KIND_KEYS` from contract — labels join naturally.

**Alternatives:**
- Keep titles in `@rezics/server` and have the factory copy duplicate. Status quo; the duplication is the problem.
- Put it in `@rezics/ui`. Wrong layer — labels are needed at seed time, before any UI exists.

### D2: Backend stays dumb — no special "system shelf edit" path

**Decision:** The backend never reasons about "system" vs "user-created" shelf for title or visibility updates. `PUT /shelf/:unitId` handles both uniformly. The title format `${slug}'s Favorites` is computed *only* at bootstrap time (and at `ensureSystemShelf` time, which is the same code path). Username changes do not trigger any title rewrite. There is no special editing endpoint.

**Why:** Backend specialization is a code-smell magnet — every special case the backend learns about system shelves becomes a maintenance burden and an inconsistency surface. The user explicitly requested minimization. The contract helper plus normal CRUD is sufficient.

**Trade-off accepted:** When a user renames their slug from `alice` to `alicia`, their shelf title remains `alice's Favorites` until they manually edit it. The product team accepted this — the alternative is cross-domain coupling that would entangle `userService.renameSlug` with shelf rewrites.

### D3: Rename `getOrCreateSystemShelf` → `ensureSystemShelf`

**Decision:** Pure semantic rename — same idempotency, same race-handling, same warning log. New name expresses intent: "ensure this exists, used only for recovery". The route `POST /shelf/system/ensure` is the public surface; the internal helper matches the route name.

**Why:** The old name implied this was a normal-flow helper. With the hot-path callers removed (D4), the only consumers are bootstrap (eager) and the new ensure route (rare recovery). The name should reflect that.

**Alternatives:**
- Keep the old name. Misleading.
- Remove the helper and inline create logic in the route. Loses bootstrap reuse.

### D4: Remove silent helper from `collection.service.ts`; throw 404 instead

**Decision:** `toggleFavorite`, `getCollectionStatus`, and `getCollectionStatusBatch` switch from `getOrCreateSystemShelf` to a read-only `findSystemShelfByKindKey(userId, "favorites")`. If the row is absent, throw `AppError(404, "system_shelf_missing", { kindKey: "favorites" })`. The Elysia error handler surfaces a JSON body of shape `{ error: { code: "system_shelf_missing", kindKey: "favorites" } }`.

**Why:** This is the central decoupling. Silent magic in mutation paths hides bugs, masks misuse, and makes seed regressions invisible. Surfacing the failure forces the question "why is this missing?" upward into the UX layer, where it belongs.

**Compatibility risk:** Any unaudited code path that assumes "favorites always exists" will now 404. Mitigation: greppable error code; CollectionModal's hover-favorite and the ♡ button both flow through `toggleFavorite`, so the toast/retry recovery (Module B) catches the surface area.

### D5: `POST /shelf/system/ensure` is a single-shot, no-frills route

**Decision:** Body: `{ kindKey: SystemShelfKindKey }`. Auth-required. Resolves caller's slug from `identity.userId`, calls `ensureSystemShelf(userId, slug, kindKey)`, returns `{ unitId: string, created: boolean }`. **No** `visibility` parameter (always `PRIVATE`). **No** `title` override. **No** automatic retry on the server. **No** other body fields.

**Why:** The route is a "fix-my-bootstrap" affordance, not a CRUD endpoint. Adding flexibility invites misuse. The `created` field lets the client distinguish "already existed (your view was stale)" from "we just created it" for a slightly better toast wording, but the server has no other behavior.

### D6: `bootstrapSystemShelves` takes `userSlug` explicitly

**Decision:** Signature changes from `bootstrapSystemShelves(userId, tx)` to `bootstrapSystemShelves(userId, userSlug, tx)`. All four callers pass the slug they already have in scope:
- `user.service.ts:232` — `req.slug` (CreateUserProfileInput already carries it)
- `user.service.ts:307` — `payload.slug` (CompleteProfileSetupInput already carries it)
- `internal.api.ts:76` — `finalSlug` (already computed at line 44)
- `factory/users.ts:144` — `plan.slug` (already on FactoryUserPlan)
- `utils/seed/users.ts:71` (new caller) — `input.slug` (already on SeedServerUserInput)

The ensure route looks up the slug from the User row (fresh read, not cached).

**Why:** The bootstrap function should not perform a User lookup itself — that adds a query inside what is already an in-flight transaction. The caller knows the slug; pass it. The ensure route runs *outside* user-create flows, so a fresh DB read is acceptable there.

### D7: Owner-self UI renders via app i18n; non-owner UI renders DB title

**Decision:** Two-layer split:
- **Owner-self view** (CollectionModal items, profile shelf tabs while viewing own profile, system-shelf detail page header while owner): renders the label from the app's i18n table keyed on `kindKey`: `t('shelf.system.favorites')` → "Favorites" / "收藏" / "お気に入り" / ...
- **Non-owner view** (visiting another user's profile, search results, share previews): renders the DB-stored `${slug}'s ${LABEL[kindKey]}` title as-is — this is the identity-for-others.

The DB-stored title is the *canonical* string; the i18n label is a per-viewer ergonomic affordance.

**Why:** A user on a Chinese device viewing their own Favorites shelf in CollectionModal seeing `alice's Favorites` would look broken. The same user visiting `alice's` shelf as a non-owner seeing `alice's Favorites` reads as "this is alice's collection" — useful identity.

**Alternative considered:** Store the DB title localized per language via `UnitTranslation` rows. The user judged this as too costly to maintain at bootstrap. The contract helper exports default English only; multi-language is opt-in via standard `PUT /shelf/:unitId` (post-MVP).

### D8: `CollectionModal` filters `backlog | active | completed`; keeps `favorites`

**Decision:** Filter rule based on the contract `SYSTEM_SHELF_KIND_KEYS`. Shelves with `kindKey ∈ {backlog, active, completed}` are excluded from the modal entirely. The favorites shelf is included and rendered via i18n. User-created shelves are unchanged. The reasoning maps to user intent — "nobody backlogs a post" — and to the existing dual-write spec (`user-unit-progress`) where progress transitions are the documented Backlog/Active/Completed entry.

**Why:** Surfacing these three in the collect picker invites accidental misuse: a user clicks "Save to Backlog" expecting it to mark the book as "want to read", but the progress-status backend has no idea. The two write paths produce drift. Removing the affordance is the cleanest fix.

**Alternative considered:** A hidden "System" chip in the filter row that surfaces system shelves only when activated. Rejected — hidden affordance with identical visual to a tag chip is a usability footgun.

### D9: Frontend recovery is user-driven; no auto-retry

**Decision:** When a mutation returns `system_shelf_missing`, the UI surfaces a toast:

```
"Your Favorites shelf isn't ready. [Retry]"
                                    │
                                    ▼
                          calls /shelf/system/ensure → invalidate slugResolveQuery
                                    │
                                    ▼
                          user re-clicks the original ♡  (not auto-triggered)
```

The toast is dismissable. The `[Retry]` button calls `POST /shelf/system/ensure` exactly once. On success, the toast closes and the SlugRef cache invalidates. The original mutation is **not** re-issued automatically. The user re-clicks themselves.

**Why:** Auto-retry hides the recovery from the user. The user explicitly asked for this decoupling — the recovery is visible, manual, and obvious. If `/ensure` itself fails, a second toast surfaces with the same `[Retry]`. No exponential backoff, no polling.

### D10: Seed fix lands as one helper call, not a refactor

**Decision:** Add a single line `await bootstrapSystemShelves(input.unitId, input.slug, prisma)` to `seedServerUser` after the User upsert (line 110). Wrap nothing else; the existing `prisma` parameter is the seed's `ServerPrismaClient`, which the factory copy now accepts after T6 fixes the type lie.

**Why:** Minimal surgical fix. The seed function is already non-transactional (it does two sequential upserts); adding a third call doesn't change its consistency guarantee. The existing fixture users are 4 well-known accounts — partial failure on any one of them is loud and reproducible.

## Risks / Trade-offs

- **[Removing silent magic exposes latent assumers]** → Mitigation: error code `system_shelf_missing` is greppable; PR review checklist asks "any other caller that assumed a system shelf always exists?". Tests for `toggleFavorite` against a user without bootstrap will catch behavioral drift.
- **[Renaming a public-ish symbol]** → `getOrCreateSystemShelf` is exported from `package/server/src/shelf/index.ts`. No external package consumes it (verified via grep — only server tests + collection.service). Atomic rename across all callers in one PR.
- **[Title format coupling: contract helper + bootstrap path]** → If the helper ever changes (e.g., dropping the `'s`), pre-existing rows keep the old format. Mitigation: this is by design; titles are user-editable post-bootstrap, and the spec says no auto-resync.
- **[Frontend `CollectionModal` filter is a UX regression for power users]** → Mitigation: documented in the proposal's Non-Goals; the progress-status pills are the documented Backlog/Active/Completed entry point.
- **[i18n string set is starter only (en + zh)]** → Mitigation: feature follows the existing `i18next` pattern with `t(key, fallback)`; new locales can be added incrementally. The recovery toast is also i18n'd.
- **[Seed fix runs four extra DB writes per fixture user]** → 4 users × 4 shelves = 16 inserts on seed init. Trivial.

## Migration Plan

1. **Module A backend** ships first (T1–T8). The change is atomic: contract import, bootstrap signature, helper rename, route addition, silent-magic removal, seed fix, callsite slug threading. After merge:
   - Re-run `bun run seed` on dev / staging DBs to populate fixture-user shelves (the bug only ever affected those four accounts).
   - Existing user-registered accounts (DB-correct) are untouched.
2. **Module B frontend** ships in the same PR (T9–T15). Without it, the backend 404 would surface as raw errors; the recovery toast and CollectionModal filter make it user-friendly.
3. **No rollback plan** beyond `git revert`. The change is small enough to redo cleanly. Database state is unchanged — title format is a write-time concern only.

## Open Questions

None. All earlier open questions were resolved during exploration:
- Q1 (auto-resync on rename): **No** — manual only.
- Q2 (slug vs displayName in title): **slug**.
- Q3 (`/ensure` visibility): **Always PRIVATE**.
- Q4 (one change or two): **One change, two modules** (per user directive).
- Q5 (`materializeFromVerifiedAuth` bootstrap): **A — leave as-is**, ensure route covers orphan state.
