## 1. Specs land in repo

- [ ] 1.1 Move `openspec/changes/api-route-and-folder-convention/specs/api-route-convention/spec.md` → `openspec/specs/api-route-convention/spec.md` at archive time (handled by `/opsx:archive`, listed here for visibility)
- [ ] 1.2 Move `openspec/changes/api-route-and-folder-convention/specs/folder-naming-convention/spec.md` → `openspec/specs/folder-naming-convention/spec.md` at archive time
- [ ] 1.3 Move `openspec/changes/api-route-and-folder-convention/specs/convention-enforcement/spec.md` → `openspec/specs/convention-enforcement/spec.md` at archive time
- [x] 1.4 Run `openspec validate api-route-and-folder-convention --strict` and resolve any warnings before apply

## 2. Documentation touchpoints

- [x] 2.1 Add an "API Route & Folder Convention" section to `CLAUDE.md` — ~8–12 lines covering singular resources, `/list` suffix, β dual-track folders, container allowlist pointer, and links to the three specs
- [x] 2.2 Edit `package/app/docs/feature standard.md`: change the `util/` example to `utils/`, confirm `hooks/` stays plural, and replace the inlined folder rules with a link to `openspec/specs/folder-naming-convention/spec.md`
- [x] 2.3 Verify no other CLAUDE.md files (`package/*/CLAUDE.md`, if any exist) contradict the new convention; update or link as needed

## 3. Shared listQueryBase mixin

- [x] 3.1 Create `package/contract/src/list-query-base.ts` exporting `listQueryBase = t.Object({ ids: t.Optional(t.Array(t.String(), { maxItems: 200 })) })` with a JSDoc block explaining CSV-on-GET, array-on-POST, and the "ids > 30 → prefer POST" guidance
- [x] 3.2 Export `listQueryBase` from `package/contract/src/index.ts`
- [x] 3.3 Do NOT modify any existing `*ListQuerySchema` in this change — the migration change will spread `...listQueryBase.properties` into each
- [x] 3.4 Run `bun run build` in `package/contract` to confirm the new mixin type-checks (verified via `tsc --noEmit` in package/contract — exit 0)

## 4. Convention check script

- [x] 4.1 Place the script in the existing `tool/scripts/` directory alongside `check-no-runtime-env.mjs` and `generate-barrel.ts` (repo-wide tooling lives under `tool/`, not `package/`)
- [x] 4.2 Write `tool/scripts/check-convention.ts` with three scan passes: route-prefix scan, list-suffix scan, folder-name scan
- [x] 4.3 Bake in the route-prefix allowlist from `api-route-convention/spec.md`: `stats`, `meili`, `well-known`, `jwt-services` (under `/admin/` only), `internal`, `dispatch`, `echokv`, `upload`, `collect`, `token`, `session`, `dm`, `score`, `attribution`, `link` (already singular), `reaction` (already singular) — exact set derived from spec
- [x] 4.4 Bake in the plural container allowlist from `folder-naming-convention/spec.md`: `hooks`, `utils`, `components`, `pages`, `sections`, `states`, `models`, `types`, `routes`, `handlers`, `providers`, `plugins`, `styles`, `helpers`, `constants`, `fixtures`, `mocks`, `layouts`, `assets`, `docs`, `templates` (spec amended during implementation to cover app/ui needs; `scripts` is NOT on the allowlist because the script now lives under `tool/scripts/`, outside the scan scope)
- [x] 4.5 Bake in the exempt-path set: `**/prisma/generated/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.output/**`, `**/.next/**`, `**/.vite/**`, `**/coverage/**`, `package/auth/**`
- [x] 4.6 Implement route-prefix scan: use a regex (not AST) to find `new Elysia({ prefix: "..." })` across `package/*/src/**/*.ts`, then validate the last path segment is singular or on the allowlist
- [x] 4.7 Implement list-suffix scan: find `.get("/", …)` and `.post("/", …)` handlers on route trees whose handler type signature contains `items:` or returns `Array<…>` / `[]`; require the route path to end in `/list` OR carry an explicit `// @convention:root-list-ok` comment (reserved for `/users/me`-style pronoun roots — keep the escape narrow and grep-able)
- [x] 4.8 Implement folder-name scan: walk directories, reject plural names not on the allowlist and singular names that equal an allowlisted plural stem
- [x] 4.9 Implement staged-mode (`--staged`) that limits the route/list scans to files reported by `git diff --cached --name-only` and limits the folder scan to directories containing those files; full-scan fallback when `--staged` is not passed
- [x] 4.10 Implement output format: one block per violation with path, rule ID (`R1`, `R2`, etc.), human-readable message, and spec link
- [x] 4.11 Add `"check:convention": "bun run tool/scripts/check-convention.ts"` to the root `package.json` scripts section
- [x] 4.12 Run the script against the current repository and record the current violation count in an `expected-violations.json` snapshot committed alongside the script — baseline captured: 151 violations (R1=15, R2=12, R3=112, R4=12)

## 5. Pre-commit hook wiring

- [x] 5.1 Locate the existing pre-commit configuration (`lefthook.yml`, `.husky/pre-commit`, or `package.json` `pre-commit` field) — none present, fresh install required
- [x] 5.2 Install `lefthook` at the repo root (`bun add -D lefthook`) and add `postinstall: "lefthook install || true"` to root `package.json` so devs pick up the hook automatically on `bun install`
- [x] 5.3 Create `lefthook.yml` with a `pre-commit` job named `check-convention` running `bun run check:convention -- --staged`
- [ ] 5.4 Test the hook locally: stage a commit that introduces a violation (e.g., create `package/server/src/testplural/`), verify the hook rejects; remove the test folder — **DEFERRED**: sandbox cannot write to `.git/hooks/`; user runs `bunx lefthook install` once on first clone, `postinstall` handles subsequent clones
- [x] 5.5 Document the hook in the CLAUDE.md section from task 2.1 (covered by the "Enforcement" paragraph)

## 6. CI wiring

- [x] 6.1 Locate the existing CI workflow (`.github/workflows/ci.yml`)
- [x] 6.2 Add a `Check convention (routes & folders)` step that runs before `knip` and `check:runtime-env`
- [x] 6.3 Non-zero exit fails the workflow (default GitHub Actions behaviour; no `continue-on-error` set)
- [ ] 6.4 Trigger CI on this change's branch and verify the `Check convention` step runs — **DEFERRED**: requires PR push, out of sandbox scope; step invokes the same script that passes locally at the baseline

## 7. Self-verification

- [x] 7.1 Run `bun run check:convention` locally — passes at exit 0 with baseline 151 violations, no new violations introduced by this change
- [x] 7.2 `openspec validate api-route-and-folder-convention --strict` → `Change 'api-route-and-folder-convention' is valid`
- [x] 7.3 `openspec status api-route-and-folder-convention` → all 4 artifacts done

## 8. Out-of-scope guardrails

- [x] 8.1 Confirm NO server route has been renamed in this change — `git status` shows no file under `package/server/src/**/*.api.ts` touched
- [x] 8.2 Confirm NO folder has been renamed in this change — `git diff --diff-filter=R --name-only` returns empty
- [x] 8.3 Confirm NO existing `*ListQuerySchema` has been modified — diff in `package/contract/src/` limited to the new `list-query-base.ts` file and a single re-export line in `index.ts`
- [ ] 8.4 Open a follow-up change proposal `api-route-and-folder-migration` (via `/opsx:propose`) referencing this spec, so the migration work has a tracked home the moment this change is archived — **DEFERRED**: best invoked via `/opsx:propose` with user present to steer scope
