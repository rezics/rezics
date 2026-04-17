## 1. Contract sweep

- [x] 1.0 Refactor `package/contract/src/list-query-base.ts` to export `listGetQueryBase` (CSV `ids`), `listPostBodyBase` (array `ids`, `maxItems: 200`), and `parseIdsCsv` helper; remove old single `listQueryBase` export
- [x] 1.1 Inventory every `*ListQuerySchema` in `package/contract/src/**` via grep (`rg 'ListQuerySchema\s*=\s*t\.Object'`); found 12: book, chapter, dmMessage (notify/dm), entity (attribution), feedback, notification (notify/notification), post, realm, shelf, tag, unit, user
- [x] 1.2 For each schema, spread `...listGetQueryBase.properties` as the first field of the `t.Object({ ... })` definition; import `listGetQueryBase` where missing — 12 schemas updated: book, chapter, dmMessage, entity, feedback, notification, post, realm, shelf, tag, unit, user
- [x] 1.3 Run `bun --filter @rezics/contract tsc --noEmit` (or `cd package/contract && bun run build`) — exit 0
- [ ] 1.4 For each list endpoint in `@rezics/server`, add `ids` handling: call `parseIdsCsv(query.ids)` in the route (or service) to get `string[] | undefined`; if the result is non-empty, filter `unitId: { in: idList }` in the Prisma `where` clause via intersection (not replacement)
- [ ] 1.5 Run `bun --filter @rezics/server tsc --noEmit` — expect exit 0
- [ ] 1.6 Spot-test one endpoint per affected domain: `curl 'http://localhost:3000/book/list?ids=<id1>,<id2>'` returns only those two books (requires a seeded DB and running dev server; skip if sandbox-only)

## 2. Server route prefix renames (R1 — 15 sites)

- [ ] 2.1 Rename `/books` → `/book` in `package/server/src/book/book.api.ts`
- [ ] 2.2 Rename `/chapters` → `/chapter` in `package/server/src/chapter/chapter.api.ts`
- [ ] 2.3 Rename `/feedbacks` → `/feedback` in `package/server/src/feedback/feedback.api.ts`
- [ ] 2.4 Rename `/links` → `/link` in `package/server/src/link/link.api.ts`
- [ ] 2.5 Rename `/notifications` → `/notification` in `package/notify/src/notification/notification.api.ts`
- [ ] 2.6 Rename `/posts` → `/post` in `package/server/src/post/post.api.ts`
- [ ] 2.7 Rename `/reactions` → `/reaction` in `package/reaction/src/reaction/reaction.api.ts` AND `package/server/src/reaction/reaction.api.ts`
- [ ] 2.8 Rename `/realms` → `/realm` in `package/server/src/realm/realm.api.ts`
- [ ] 2.9 Rename `/shelves` → `/shelf` in `package/server/src/shelf/shelf.api.ts`
- [ ] 2.10 Rename `/tags` → `/tag` in `package/server/src/tag/tag.api.ts`
- [ ] 2.11 Resolve `/unit` collision FIRST: rename translation-group's Elysia prefix from `/unit` to `/translation-group` in `package/server/src/translation-group/*.api.ts`
- [ ] 2.12 Rename `/units` → `/unit` in `package/server/src/unit/unit.api.ts`
- [ ] 2.13 Rename `/users` → `/user` in `package/server/src/user/api/user.api.ts` (merge with existing `/user` tree if separate) AND `package/server/src/notify/user-batch.api.ts`
- [ ] 2.14 Rename `/zones` → `/zone` in `package/server/src/zone/zone.api.ts`
- [ ] 2.15 Run `bun --filter @rezics/server dev` briefly; confirm Elysia logs show the new prefixes and no duplicate-mount errors

## 3. Root list handler `/list` move (R2 — 12 sites)

- [ ] 3.1 `package/server/src/book/book.api.ts` — two root list handlers; move both to `/list` (GET + POST) or consolidate into one `/list` endpoint covering both transports
- [ ] 3.2 `package/server/src/chapter/chapter.api.ts` — root list handler → `/list`
- [ ] 3.3 `package/server/src/echokv/echokv.api.ts` — if the root handler is a genuine list, move to `/list`; if it's a pronoun-root read, annotate `// @convention:root-list-ok`
- [ ] 3.4 `package/server/src/feedback/feedback.api.ts` — two root handlers → `/list`
- [ ] 3.5 `package/server/src/jwt/jwt.admin.api.ts` — root admin list → `/list`
- [ ] 3.6 `package/server/src/post/post.api.ts` — root list → `/list`
- [ ] 3.7 `package/server/src/realm/realm.api.ts` — root list → `/list`
- [ ] 3.8 `package/server/src/shelf/shelf.api.ts` — root list → `/list`
- [ ] 3.9 `package/server/src/unit/unit.api.ts` — two root handlers → `/list`
- [ ] 3.10 Run `bun run check:convention` with the current baseline still in place; R2 count must drop to 0 (snapshot still non-empty because of R3/R4)

## 4. Frontend caller updates

- [ ] 4.1 `grep -rE "(\"|')/(books|chapters|feedbacks|links|notifications|posts|reactions|realms|shelves|tags|units|users|zones)(/|\\?|\"|')" package/api/src package/app/src package/admin/src` and capture the match list
- [ ] 4.2 Update `apiFetch`, `createApiQuery`, and TanStack Query `queryKey` factories in `package/api/src/**` for every renamed prefix
- [ ] 4.3 Update direct `apiFetch` calls in `package/app/src/**` (bypassing the `@rezics/api` layer) — expected rare
- [ ] 4.4 Update direct `apiFetch` calls in `package/admin/src/**` — expected rare
- [ ] 4.5 Update MSW handlers or test fixtures referencing old paths: `rg "'/(books|chapters|feedbacks|links|notifications|posts|reactions|realms|shelves|tags|units|users|zones)" package/`
- [ ] 4.6 Run `bun --filter @rezics/api tsc --noEmit`, `bun --filter @rezics/app tsc --noEmit`, `bun --filter @rezics/admin tsc --noEmit`
- [ ] 4.7 `bun run build` in `@rezics/app` and `@rezics/admin` — confirm Vite produces bundles with no unresolved imports
- [ ] 4.8 Final grep for stray string-literal old prefixes in `.ts`/`.tsx` under `package/{api,app,admin}/src/**`; any match is a bug

## 5. Folder renames — singular containers → plural (R3 — 112 sites)

- [ ] 5.1 Write a throwaway `bun` helper `tool/scripts/rewrite-imports.ts` (not to be committed, or committed under `tool/scripts/` and deleted at end) that takes `--from <stem> --to <stem>` and rewrites any import path matching `/<from>/` or `'/<from>/'` under `package/*/src/**/*.{ts,tsx,md}` — ALTERNATIVE: use `rg -l | xargs sed -i` inline for each stem
- [ ] 5.2 Rename all `component/` → `components/` (admin, app, api, preview, ui): `git mv` each, then rewrite imports, then `bun --filter <pkg> tsc --noEmit` per package
- [ ] 5.3 Rename all `page/` → `pages/` (admin, app)
- [ ] 5.4 Rename all `section/` → `sections/` (app, ui)
- [ ] 5.5 Rename all `state/` → `states/` (admin, app, api)
- [ ] 5.6 Rename all `model/` → `models/` (admin, app, server)
- [ ] 5.7 Rename all `util/` → `utils/` (admin, app, server, ui)
- [ ] 5.8 Rename all `hook/` → `hooks/` (app/book-edit)
- [ ] 5.9 Rename all `layout/` → `layouts/` (admin/core, app/book-edit, app/book-read, app/core, app/user, ui/composite)
- [ ] 5.10 Rename all `provider/` → `providers/` (admin/app, app/app, api)
- [ ] 5.11 Rename all `plugin/` → `plugins/` (folio, ui/editor)
- [ ] 5.12 Rename all `style/` → `styles/` (ui/shared)
- [ ] 5.13 Rename all `mock/` → `mocks/` (app/src, ui, app/mock/handler → handlers, server/prisma/seed/mock)
- [ ] 5.14 Rename all `asset/` → `assets/` (app/shared)
- [ ] 5.15 Rename all `doc/` → `docs/` (app/inbox)
- [ ] 5.16 Rename all `template/` → `templates/` (app/zone)
- [ ] 5.17 After each batch: run `bun --filter <pkg> tsc --noEmit` and `bun run build` in affected frontend packages
- [ ] 5.18 Run full `bun run check:convention` with baseline still in place; R3 count must drop to 0

## 6. Non-allowlisted plurals (R4 — 12 sites)

- [ ] 6.1 `package/admin/src/home/component/charts/` → `chart/` (admin home dashboard chart primitives; domain folder, singular)
- [ ] 6.2 `package/admin/src/routes/_admin/realms/` → `realm/` (TanStack Router segment mirroring the new singular prefix)
- [ ] 6.3 `package/admin/src/routes/_admin/shelves/` → `shelf/`
- [ ] 6.4 `package/admin/src/routes/_admin/units/` → `unit/`
- [ ] 6.5 `package/admin/src/routes/_admin/users/` → `user/`
- [ ] 6.6 `package/api/src/stats/` → `stat/` (domain folder; the route-prefix allowlist entry `stats` covers the HTTP path `/stats`, unrelated to folder naming)
- [ ] 6.7 `package/server/src/stats/` → `stat/` (same rationale)
- [ ] 6.8 `package/app/src/preferences/` → `preference/` (app settings domain)
- [ ] 6.9 `package/app/src/realm/settings/` → `setting/`
- [ ] 6.10 `package/app/src/routes/_mainLayout/user/me/settings/` → `setting/` (TanStack Router segment)
- [ ] 6.11 `package/jwt/src/adapters/` and `package/jwt/src/contracts/` — OPEN QUESTION D4: default to rename singular (`adapter/`, `contract/`). If reviewer prefers, instead amend `openspec/specs/folder-naming-convention/spec.md` to add `adapters`, `contracts` to the container allowlist AND mirror in `tool/scripts/check-convention.ts`; either path is acceptable — pick one and document in PR
- [ ] 6.12 After all R4 decisions land: run `bun run check:convention`; R4 count must drop to 0

## 7. Documentation touchpoints

- [ ] 7.1 Update `CLAUDE.md` "API Route & Folder Convention" section: add a single sentence noting the baseline snapshot was removed after migration completed on 2026-04-17 (or actual migration date)
- [ ] 7.2 If task 6.11 chose the allowlist-extension path for `adapters`/`contracts`: update `CLAUDE.md`'s allowlist line in the same edit
- [ ] 7.3 Verify `package/app/docs/feature standard.md` still aligns with post-migration folder names; no changes expected since it already links to the spec

## 8. Baseline snapshot cleanup

- [ ] 8.1 Patch `tool/scripts/check-convention.ts`: wrap the `JSON.parse(readFileSync(...))` in a try/catch; on `ENOENT` return `{ total: 0, keys: [] }` so the script tolerates a missing baseline
- [ ] 8.2 Delete `tool/scripts/expected-violations.json` (`git rm`)
- [ ] 8.3 Run `bun run check:convention` — expect exit 0, no "baseline not found" warning
- [ ] 8.4 Commit the script patch and the snapshot deletion in a single commit titled `chore(convention): retire baseline snapshot after migration`

## 9. Verification

- [ ] 9.1 `bun run check:convention` at repo root — exit 0, zero violations, no baseline file present
- [ ] 9.2 `bun --filter '*' tsc --noEmit` across all packages — exit 0 each (user feedback memory: tolerate cross-package path-alias false positives; what matters is per-package green)
- [ ] 9.3 `bun run build` in `@rezics/app`, `@rezics/admin` — Vite succeeds
- [ ] 9.4 `bun run knip` — no new unused exports introduced by the sweep
- [ ] 9.5 `bun test` in packages that have tests covering renamed endpoints or folders
- [ ] 9.6 Boot `@rezics/server`; confirm Elysia startup logs enumerate all new singular prefixes and no duplicates
- [ ] 9.7 Manual smoke of five highest-traffic renamed endpoints against running server: `GET /book/list`, `GET /post/list`, `GET /user/brief/list`, `GET /tag/list`, `GET /realm/list` — all return 200
- [ ] 9.8 `openspec validate api-route-and-folder-migration --strict` — change is valid

## 10. PR preparation

- [ ] 10.1 Write PR description enumerating: (a) the 15 renamed HTTP prefixes, (b) the 12 `/list`-suffix additions, (c) the `/unit` collision resolution, (d) the folder-rename batches by package, (e) the snapshot retirement
- [ ] 10.2 Deploy checklist in PR body: "server and client must deploy together; no alias window exists"
- [ ] 10.3 Release notes line item: one sentence describing the breaking route change for internal visibility
- [ ] 10.4 Link the PR to the archived `api-route-and-folder-convention` change as its origin
