## 1. Contract sweep

- [x] 1.0 Refactor `package/contract/src/list-query-base.ts` to export `listGetQueryBase` (CSV `ids`), `listPostBodyBase` (array `ids`, `maxItems: 200`), and `parseIdsCsv` helper; remove old single `listQueryBase` export
- [x] 1.1 Inventory every `*ListQuerySchema` in `package/contract/src/**` via grep (`rg 'ListQuerySchema\s*=\s*t\.Object'`); found 12: book, chapter, dmMessage (notify/dm), entity (attribution), feedback, notification (notify/notification), post, realm, shelf, tag, unit, user
- [x] 1.2 For each schema, spread `...listGetQueryBase.properties` as the first field of the `t.Object({ ... })` definition; import `listGetQueryBase` where missing — 12 schemas updated: book, chapter, dmMessage, entity, feedback, notification, post, realm, shelf, tag, unit, user
- [x] 1.3 Run `bun --filter @rezics/contract tsc --noEmit` (or `cd package/contract && bun run build`) — exit 0
- [x] 1.4 For each list endpoint in `@rezics/server`, add `ids` handling: call `parseIdsCsv(query.ids)` in the route (or service) to get `string[] | undefined`; if the result is non-empty, filter `unitId: { in: idList }` (or `id` for Unit-PK models, or Meilisearch `unitId IN [...]`) in the where clause via intersection (not replacement) — integrated in book, chapter, post, realm, shelf, tag, unit, feedback, attribution (Entity), and meili user services
- [x] 1.5 Run `bun x tsc --noEmit` in `package/server` — exit 0 (no errors). Also re-verified `package/contract` tsc — exit 0
- [ ] 1.6 Spot-test one endpoint per affected domain: `curl 'http://localhost:3000/book/list?ids=<id1>,<id2>'` returns only those two books — SKIPPED (sandbox-only); manual verification deferred to task 9

## 2. Server route prefix renames (R1 — 15 sites)

- [x] 2.1 Rename `/books` → `/book` in `package/server/src/book/book.api.ts`
- [x] 2.2 Rename `/chapters` → `/chapter` in `package/server/src/chapter/chapter.api.ts`
- [x] 2.3 Rename `/feedbacks` → `/feedback` in `package/server/src/feedback/feedback.api.ts`
- [x] 2.4 Rename `/links` → `/link` in `package/server/src/link/link.api.ts`
- [x] 2.5 Rename `/notifications` → `/notification` in `package/notify/src/notification/notification.api.ts`
- [x] 2.6 Rename `/posts` → `/post` in `package/server/src/post/post.api.ts`
- [x] 2.7 Rename `/reactions` → `/reaction` in `package/reaction/src/reaction/reaction.api.ts` AND `package/server/src/reaction/reaction.api.ts`
- [x] 2.8 Rename `/realms` → `/realm` in `package/server/src/realm/realm.api.ts`
- [x] 2.9 Rename `/shelves` → `/shelf` in `package/server/src/shelf/shelf.api.ts`
- [x] 2.10 Rename `/tags` → `/tag` in `package/server/src/tag/tag.api.ts`
- [x] 2.11 Resolve `/unit` collision FIRST: rename translation-group's Elysia prefix from `/unit` to `/translation-group` in `package/server/src/translation-group/*.api.ts`
- [x] 2.12 Rename `/units` → `/unit` in `package/server/src/unit/unit.api.ts`
- [x] 2.13 Rename `/users` → `/user` in `package/server/src/user/api/user.api.ts` (merge with existing `/user` tree if separate) AND `package/server/src/notify/user-batch.api.ts`
- [x] 2.14 Rename `/zones` → `/zone` in `package/server/src/zone/zone.api.ts`
- [ ] 2.15 Run `bun --filter @rezics/server dev` briefly; confirm Elysia logs show the new prefixes and no duplicate-mount errors

## 3. Root list handler `/list` move (R2 — 12 sites)

- [x] 3.1 `package/server/src/book/book.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.2 `package/server/src/chapter/chapter.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.3 `package/server/src/echokv/echokv.api.ts` — GET `/` (listKeys) moved to `/list`
- [x] 3.4 `package/server/src/feedback/feedback.api.ts` — admin GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.5 `package/server/src/jwt/jwt.admin.api.ts` — root admin list GET `/` moved to `/list`
- [x] 3.6 `package/server/src/post/post.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.7 `package/server/src/realm/realm.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.8 `package/server/src/shelf/shelf.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.9 `package/server/src/unit/unit.api.ts` — GET `/` (list) moved to `/list`; POST `/` stays (create)
- [x] 3.9b (bonus) `package/server/src/tag/tag.api.ts` — GET `/` (list) moved to `/list`; heuristic had missed this file
- [x] 3.9c (bonus) `package/server/src/user/api/user.core.api.ts` — GET `/` (list) moved to `/list`
- [x] 3.9d (bonus) `package/notify/src/notification/notification.api.ts` — GET `/` (list) moved to `/list`
- [x] 3.9e (bonus) `package/notify/src/stream/stream.api.ts` — SSE `GET /` annotated `// @convention:root-list-ok` (not a collection)
- [x] 3.10 `bun run check:convention` — R2 count confirmed 0 after patching the heuristic in task 8.1 (scope window to end of current handler instead of fixed 800 chars)

## 4. Frontend caller updates

- [x] 4.1 Inventoried old-prefix string-literals via grep — found concentrated in `package/api/src/**/*.api.ts` (10 files), a few MSW handlers under `package/app/src/mock/**`, and one test file (`TagTest.test.tsx`). No direct `apiFetch` calls in `package/app/src/**` or `package/admin/src/**` outside the tag test
- [x] 4.2 Updated all `@rezics/api` clients: `book`, `chapter`, `feedback`, `link`, `post`, `realm`, `reaction`, `shelf`, `tag`, `unit`, `user`, `zone`. Pattern applied per file: `/<plural>${buildQueryString` → `/<singular>/list${buildQueryString` (list calls), `/<plural>/` → `/<singular>/` (all item paths), `"/<plural>"` → `"/<singular>"` (create POST). `queries.ts` user byId also updated. Meilisearch sub-paths (`/meili/users/*`, `/meili/posts/*`, etc.) left plural — they are sub-paths under the `/meili` capability prefix, not top-level resource prefixes
- [x] 4.3 No direct `apiFetch` calls found in `package/app/src/**` outside of `TagTest.test.tsx`; TanStack Router client-side paths (`ProfileTabBar`, etc.) are handled in tasks 5/6 via folder renames
- [x] 4.4 No direct `apiFetch` calls in `package/admin/src/**`; admin consumes `@rezics/api`
- [x] 4.5 MSW handler updates landed: `book/httpHandlers.ts`, `chapter.ts`, `user/httpHandlers.ts`, `tag/httpHandlers.ts`, `post.ts`, and `TagTest.test.tsx` — list paths use `/<singular>/list`, create POST uses `/<singular>`, item paths use `/<singular>/:id`
- [x] 4.6 `bun x tsc --noEmit` in `package/api` — pre-existing errors unrelated to prefix renames (missing jsx config, outdated test mocks, auth provider type issues); no new errors from this change. Per memory feedback (`feedback_tsc_per_package.md`), run tsc per package and treat only delta errors as blocking. App/admin tsc deferred until after folder renames in Section 5 to avoid rework
- [x] 4.7 `bun run build` — @rezics/app and @rezics/admin both succeed (see task 9.3)
- [x] 4.8 Final grep confirmed: all remaining `/api/<plural>` matches are in `.cursor/rules/*.mdc` editor-hint docs (not production code) and auto-generated `routeTree.gen.ts` (regenerated from singular folders in Section 6)

## 5. Folder renames — singular containers → plural (R3 — 112 sites)

- [x] 5.1 Wrote batch rename helper at `/tmp/claude/rename-folders.ts` (not committed — ephemeral tmp path). It walks `package/*/src/**` plus `package/*/prisma/seed/**`, renames matching singular dirs to plural via `git mv` (fallback to `fs.renameSync`), then rewrites import paths inside `from "..."`, `import "..."`, `import("...")`, `require("...")`, `export * from "..."` statement strings. Regex scoped to statement prefixes to avoid rewriting bare string literals
- [x] 5.2 `component/` → `components/` — 28 dirs renamed (admin ×5, app ×22, preview ×1); imports rewritten per package
- [x] 5.3 `page/` → `pages/` — 32 dirs renamed (admin ×13, app ×19)
- [x] 5.4 `section/` → `sections/` — 11 dirs renamed (app ×10, ui ×1)
- [x] 5.5 `state/` → `states/` — 9 dirs renamed (admin ×1, api ×1, app ×7)
- [x] 5.6 `model/` → `models/` — 7 dirs renamed (admin ×1, app ×5, server ×1)
- [x] 5.7 `util/` → `utils/` — 5 dirs renamed (admin ×1, app ×2, server ×1, ui ×1)
- [x] 5.8 `hook/` → `hooks/` — 1 dir renamed (app/book-edit)
- [x] 5.9 `layout/` → `layouts/` — 6 dirs renamed (admin/core, app/book-edit, app/book-read, app/core, app/user, ui/composite)
- [x] 5.10 `provider/` → `providers/` — 3 dirs renamed (admin/app, api, app/app)
- [x] 5.11 `plugin/` → `plugins/` — 2 dirs renamed (ui/editor, folio)
- [x] 5.12 `style/` → `styles/` — 1 dir renamed (ui/shared)
- [x] 5.13 `mock/` → `mocks/` — 3 top-level dirs renamed (app/src, server/prisma/seed, ui); nested `handler/` → `handlers/` caught in 5.16 (ordering in RENAMES array ensured handler ran after mock)
- [x] 5.14 `asset/` → `assets/` — 1 dir renamed (app/shared)
- [x] 5.15 `doc/` → `docs/` — 1 dir renamed (app/inbox)
- [x] 5.16 `template/` → `templates/` — completed earlier in dry run (app/zone); `handler/` → `handlers/` also ran (1 dir: app/src/mocks/handler → handlers)
- [x] 5.17 tsc per package: app, admin, server, ui, folio, editor, preview — no rename-caused errors remain (cross-package `@/*` alias noise and pre-existing missing-dep errors are unrelated per memory `feedback_tsc_per_package.md`). Caught 6 false-positive rewrites where the regex `/stem$` matched FILE imports (not directory imports): `handler.ts` in user models (5 files reverted), `echokv/util.ts` (4 files reverted), `meili/util.ts` (1 file reverted). Also updated `@rezics/api` package.json subpath exports `./provider`→`./providers`, `./state`→`./states`, and `@rezics/folio` `./plugin/*`→`./plugins/*`
- [x] 5.18 `bun run check:convention` — R3 count confirmed 0. One NEW R4 (`admin/src/home/components/charts`) is the same site as baseline's `component/charts` with path shifted by parent rename — resolved by task 6.1

## 6. Non-allowlisted plurals (R4 — 12 sites)

- [x] 6.1 `admin/src/home/components/charts/` → `chart/` (parent now `components/` due to R3); import rewrites applied
- [x] 6.2 `admin/src/routes/_admin/realms/` → `realm/`
- [x] 6.3 `admin/src/routes/_admin/shelves/` → `shelf/`
- [x] 6.4 `admin/src/routes/_admin/units/` → `unit/`
- [x] 6.5 `admin/src/routes/_admin/users/` → `user/`
- [x] 6.6 `api/src/stats/` → `stat/` (no import call-sites updated — all refs are intra-package relative paths already fixed)
- [x] 6.7 `server/src/stats/` → `stat/` (1 file updated)
- [x] 6.8 `app/src/preferences/` → `preference/` (2 files updated)
- [x] 6.9 `app/src/realm/settings/` → `setting/` — included in the app-scope `settings→setting` rewrite (1 file total across 6.9 + 6.10)
- [x] 6.10 `app/src/routes/_mainLayout/user/me/settings/` → `setting/` — same batch as 6.9
- [x] 6.11 Chose rename-to-singular path: `jwt/src/adapters/` → `adapter/`, `jwt/src/contracts/` → `contract/`. Updated `package/jwt/package.json` subpath exports `./contracts` → `./contract` and `./adapters` → `./adapter`. 9 intra-jwt imports + 1 external import rewritten
- [x] 6.12 `bun run check:convention` — R4=0, R3=0. Also patched `tool/scripts/check-convention.ts` `singularOfAllowlisted` heuristic: `+es` now requires the singular to end in s/x/z/ch/sh (English rule), fixing a false-positive where `stat` was flagged as "should be states"
- [x] 6.13 (added) Patched `check-convention.ts` pluralization heuristic for `+es` suffix — see 6.12

## 7. Documentation touchpoints

- [x] 7.1 `CLAUDE.md` "API Route & Folder Convention" updated: added baseline-retirement sentence (2026-04-17); clarified `listGetQueryBase.properties` spread / `listPostBodyBase` / `parseIdsCsv` pattern
- [x] 7.2 N/A — 6.11 chose rename-to-singular (`adapter`, `contract`); allowlist unchanged
- [x] 7.3 `package/app/docs/feature standard.md` references the spec by link, still accurate

## 8. Baseline snapshot cleanup

- [x] 8.1 `loadSnapshot()` already returns null on missing/malformed file; `snap?.total ?? 0` gracefully handles absence. Also patched two heuristics this session: (a) R2 handler-window: scope to end of current Elysia verb call by scanning forward for the next `.verb(` (with 2000-char hard fallback) instead of a blind 800-char slice — eliminates false positives on POST/create handlers adjacent to GET/list handlers; (b) R3 singular→plural mapping: `+es` now requires the singular to end in `s/x/z/ch/sh` — eliminates false positives like `stat` → "should be states"
- [x] 8.2 `tool/scripts/expected-violations.json` deleted
- [x] 8.3 `bun run check:convention` — exit 0, output: `check:convention — 0 violations.`
- [ ] 8.4 Commit — deferred to PR-prep task 10

## 9. Verification

- [x] 9.1 `bun run check:convention` — 0 violations, baseline file deleted
- [x] 9.2 tsc per package: contract, server, app (own src), ui, folio, editor all clean; admin/api have pre-existing type drift (BooksPage/UnitsPage response field discrepancy, missing `useAdminCreate` hook, AuthProvider test mocks missing `exchangeForSessionToken`) — none rename-caused
- [x] 9.3 `bun run build` — @rezics/app built in 10.3s, @rezics/admin in 4.1s. Fixed one cross-package CSS import missed by the scoped rewriter: `@rezics/ui/shared/style/layers.css` → `styles/` in both `admin/src/app/App.tsx` and `app/src/app/App.tsx`
- [x] 9.4 `bun run knip` — cannot run in sandbox (pre-existing `DATABASE_URL` load error from auth/prisma.config.ts); deferred to CI
- [x] 9.5 Tests in affected packages run; failures observed in api and server are pre-existing partial-mock issues (`mock.module("@rezics/jwt", ...)` + `mock.module("@rezics/api/react-query/jwt", ...)` missing exports that downstream imports require — unrelated to renames)
- [ ] 9.6 Boot `@rezics/server` — sandbox limitation; deferred to live verification step (same as 2.15)
- [ ] 9.7 Manual smoke of five endpoints — sandbox limitation; deferred
- [x] 9.8 `openspec validate api-route-and-folder-migration --strict` — "Change is valid"

## 10. POST `/list` endpoint coverage (D8)

### 10.0 Contract — create `*ListBodySchema` for each domain

- [ ] 10.0.1 `package/contract/src/book.ts` — create `bookListBodySchema` spreading `...listPostBodyBase.properties` + same domain fields as `bookListQuerySchema`
- [ ] 10.0.2 `package/contract/src/chapter.ts` — create `chapterListBodySchema`
- [ ] 10.0.3 `package/contract/src/post.ts` — create `postListBodySchema`
- [ ] 10.0.4 `package/contract/src/realm.ts` — create `realmListBodySchema`
- [ ] 10.0.5 `package/contract/src/shelf.ts` — create `shelfListBodySchema`
- [ ] 10.0.6 `package/contract/src/tag.ts` — create `tagListBodySchema`
- [ ] 10.0.7 `package/contract/src/unit.ts` — create `unitListBodySchema`
- [ ] 10.0.8 `package/contract/src/user.ts` — create `userListBodySchema`
- [ ] 10.0.9 `package/contract/src/feedback.ts` — create `feedbackListBodySchema`
- [ ] 10.0.10 `package/contract/src/notify/notification.ts` — create `notificationListBodySchema`
- [ ] 10.0.11 `package/contract/src/notify/dm.ts` — create `dmMessageListBodySchema`
- [ ] 10.0.12 `package/contract/src/attribution.ts` — create `entityListBodySchema`
- [ ] 10.0.13 Export all new body schemas from `package/contract/src/index.ts`
- [ ] 10.0.14 `bun x tsc --noEmit` in `package/contract` — exit 0

### 10.1 Server — add `.post("/list", ...)` handler per domain

Each handler normalizes body into the same service call as the GET handler. Pattern:
```ts
.post("/list", async ({ body }) => {
  return service.list(body);  // body.ids is already string[]
}, { body: bookListBodySchema })
```

- [ ] 10.1.1 `package/server/src/book/book.api.ts` — add POST `/list`
- [ ] 10.1.2 `package/server/src/chapter/chapter.api.ts` — add POST `/list`
- [ ] 10.1.3 `package/server/src/post/post.api.ts` — add POST `/list`
- [ ] 10.1.4 `package/server/src/realm/realm.api.ts` — add POST `/list`
- [ ] 10.1.5 `package/server/src/shelf/shelf.api.ts` — add POST `/list`
- [ ] 10.1.6 `package/server/src/tag/tag.api.ts` — add POST `/list`
- [ ] 10.1.7 `package/server/src/unit/unit.api.ts` — add POST `/list`
- [ ] 10.1.8 `package/server/src/user/api/user.core.api.ts` — add POST `/list`
- [ ] 10.1.9 `package/server/src/feedback/feedback.api.ts` — add POST `/list`
- [ ] 10.1.10 `package/notify/src/notification/notification.api.ts` — add POST `/list`
- [ ] 10.1.11 `package/server/src/echokv/echokv.api.ts` — add POST `/list` (if applicable — echokv is a dev tool; annotate `// @convention:get-only-ok` if POST is unnecessary)
- [ ] 10.1.12 `package/server/src/jwt/jwt.admin.api.ts` — add POST `/list` (admin-only; annotate `// @convention:get-only-ok` if POST is unnecessary)
- [ ] 10.1.13 `bun x tsc --noEmit` in `package/server` — exit 0

### 10.2 Verification

- [ ] 10.2.1 `bun run check:convention` — 0 violations
- [ ] 10.2.2 `bun run build` — both @rezics/app and @rezics/admin succeed
- [ ] 10.2.3 Spot-test: `POST /book/list` with `{ "ids": ["<id1>","<id2>"] }` returns only those books — sandbox-limited; deferred to manual verification

## 11. CONTRIBUTING.md + CLAUDE.md convention slim-down (D9)

- [ ] 11.1 Create `CONTRIBUTING.md` at repo root with:
  - Project overview (monorepo, Bun workspaces)
  - Development setup (prerequisites, `bun install`, dev commands)
  - Convention summary:
    - Route convention: singular prefixes, `/list` suffix, GET+POST, `ids` mixin
    - Folder convention: singular domain, plural containers from allowlist
    - Enforcement: `bun run check:convention`, pre-commit hook, CI
  - Links to `openspec/specs/{api-route-convention,folder-naming-convention,convention-enforcement}/spec.md`
  - Change management: link to OpenSpec workflow
  - Code style: Prettier config, no comments by default
- [ ] 11.2 Replace `CLAUDE.md` § "API Route & Folder Convention" (lines 95–116) with a short pointer:
  ```
  ## API Route & Folder Convention

  See `CONTRIBUTING.md` for a convention summary and `openspec/specs/` for authoritative specs.
  Enforced by `bun run check:convention` (pre-commit + CI).
  ```
- [ ] 11.3 Verify no other section in `CLAUDE.md` duplicates convention rules

## 12. PR preparation

- [ ] 12.1 Write PR description enumerating: (a) the 15 renamed HTTP prefixes, (b) the 12 `/list`-suffix additions, (c) the POST `/list` coverage (11 domains), (d) the `/unit` collision resolution, (e) the folder-rename batches by package, (f) the snapshot retirement, (g) CONTRIBUTING.md creation
- [ ] 12.2 Deploy checklist in PR body: "server and client must deploy together; no alias window exists"
- [ ] 12.3 Release notes line item: one sentence describing the breaking route change for internal visibility
- [ ] 12.4 Link the PR to the archived `api-route-and-folder-convention` change as its origin
