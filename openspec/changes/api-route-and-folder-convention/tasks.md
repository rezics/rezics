## 1. Specs land in repo

- [ ] 1.1 Move `openspec/changes/api-route-and-folder-convention/specs/api-route-convention/spec.md` → `openspec/specs/api-route-convention/spec.md` at archive time (handled by `/opsx:archive`, listed here for visibility)
- [ ] 1.2 Move `openspec/changes/api-route-and-folder-convention/specs/folder-naming-convention/spec.md` → `openspec/specs/folder-naming-convention/spec.md` at archive time
- [ ] 1.3 Move `openspec/changes/api-route-and-folder-convention/specs/convention-enforcement/spec.md` → `openspec/specs/convention-enforcement/spec.md` at archive time
- [ ] 1.4 Run `openspec validate api-route-and-folder-convention --strict` and resolve any warnings before apply

## 2. Documentation touchpoints

- [ ] 2.1 Add an "API Route & Folder Convention" section to `CLAUDE.md` — ~8–12 lines covering singular resources, `/list` suffix, β dual-track folders, container allowlist pointer, and links to the three specs
- [ ] 2.2 Edit `package/app/docs/feature standard.md`: change the `util/` example to `utils/`, confirm `hooks/` stays plural, and replace the inlined folder rules with a link to `openspec/specs/folder-naming-convention/spec.md`
- [ ] 2.3 Verify no other CLAUDE.md files (`package/*/CLAUDE.md`, if any exist) contradict the new convention; update or link as needed

## 3. Shared listQueryBase mixin

- [ ] 3.1 Create `package/contract/src/list-query-base.ts` exporting `listQueryBase = t.Object({ ids: t.Optional(t.Array(t.String(), { maxItems: 200 })) })` with a JSDoc block explaining CSV-on-GET, array-on-POST, and the "ids > 30 → prefer POST" guidance
- [ ] 3.2 Export `listQueryBase` from `package/contract/src/index.ts`
- [ ] 3.3 Do NOT modify any existing `*ListQuerySchema` in this change — the migration change will spread `...listQueryBase.properties` into each
- [ ] 3.4 Run `bun run build` in `package/contract` to confirm the new mixin type-checks

## 4. Convention check script

- [ ] 4.1 Create `package/scripts/` directory (container folder per the new convention — `scripts` is on the plural allowlist)
- [ ] 4.2 Write `package/scripts/check-convention.ts` with three scan passes: route-prefix scan, list-suffix scan, folder-name scan
- [ ] 4.3 Bake in the route-prefix allowlist from `api-route-convention/spec.md`: `stats`, `meili`, `well-known`, `jwt-services` (under `/admin/` only), `internal`, `dispatch`, `echokv`, `upload`, `collect`, `token`, `session`, `dm`, `score`, `attribution`, `link` (already singular), `reaction` (already singular) — exact set derived from spec
- [ ] 4.4 Bake in the plural container allowlist from `folder-naming-convention/spec.md`: `hooks`, `utils`, `components`, `pages`, `sections`, `states`, `models`, `types`, `routes`, `handlers`, `providers`, `plugins`, `styles`, `helpers`, `constants`, `fixtures`, `mocks`, plus the `scripts` scaffolding folder for self-exemption
- [ ] 4.5 Bake in the exempt-path set: `**/prisma/generated/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.output/**`, `**/.next/**`, `**/.vite/**`, `**/coverage/**`, `package/auth/**`
- [ ] 4.6 Implement route-prefix scan: use a regex (not AST) to find `new Elysia({ prefix: "..." })` across `package/*/src/**/*.ts`, then validate the last path segment is singular or on the allowlist
- [ ] 4.7 Implement list-suffix scan: find `.get("/", …)` and `.post("/", …)` handlers on route trees whose handler type signature contains `items:` or returns `Array<…>` / `[]`; require the route path to end in `/list` OR carry an explicit `// @convention:root-list-ok` comment (reserved for `/users/me`-style pronoun roots — keep the escape narrow and grep-able)
- [ ] 4.8 Implement folder-name scan: walk directories, reject plural names not on the allowlist and singular names that equal an allowlisted plural stem
- [ ] 4.9 Implement staged-mode (`--staged`) that limits the route/list scans to files reported by `git diff --cached --name-only` and limits the folder scan to directories containing those files; full-scan fallback when `--staged` is not passed
- [ ] 4.10 Implement output format: one block per violation with path, rule ID (`R1`, `R2`, etc.), human-readable message, and spec link
- [ ] 4.11 Add `"check:convention": "bun run package/scripts/check-convention.ts"` to the root `package.json` scripts section
- [ ] 4.12 Run the script against the current repository and record the current violation count in an `expected-violations.json` snapshot committed alongside the script — this lets the migration change assert its completeness by driving the count to zero

## 5. Pre-commit hook wiring

- [ ] 5.1 Locate the existing pre-commit configuration (`lefthook.yml`, `.husky/pre-commit`, or `package.json` `pre-commit` field) — search `ls -la | grep -iE "lefthook|husky|pre-commit"` at repo root and inside `package/*`
- [ ] 5.2 If no pre-commit tool is installed, install `lefthook` at the repo root (`bun add -D lefthook -w`) and initialize `lefthook.yml`; otherwise extend the existing config
- [ ] 5.3 Add a `pre-commit` step named `check-convention` that runs `bun run check:convention -- --staged` and blocks the commit on non-zero exit
- [ ] 5.4 Test the hook locally: stage a commit that introduces a violation (e.g., create `package/server/src/testplural/`), verify the hook rejects; remove the test folder
- [ ] 5.5 Document the hook in the CLAUDE.md section from task 2.1

## 6. CI wiring

- [ ] 6.1 Locate the existing CI workflow (`.github/workflows/*.yml` or equivalent)
- [ ] 6.2 Add a `Check convention` job or step that runs `bun install --frozen-lockfile` followed by `bun run check:convention` before the test job
- [ ] 6.3 Ensure the step fails the workflow on a non-zero exit code (default behaviour, but confirm explicitly)
- [ ] 6.4 Trigger CI on this change's branch and verify the `Check convention` step runs — it should pass because this change introduces no route/folder violations (all spec scaffolding lives under `openspec/` which is not scanned)

## 7. Self-verification

- [ ] 7.1 Run `bun run check:convention` locally after every task above — expected outcome: passes, with the same violation count as the `expected-violations.json` snapshot (this change introduces no new violations)
- [ ] 7.2 Confirm `openspec show api-route-and-folder-convention` renders without errors and that all three spec files are listed under Capabilities
- [ ] 7.3 Confirm `openspec list` shows the change as `ready` (all applyRequires satisfied)

## 8. Out-of-scope guardrails

- [ ] 8.1 Confirm NO server route has been renamed in this change — grep `git diff --name-only dev..HEAD` and verify no file in `package/server/src/**/*.api.ts` is touched
- [ ] 8.2 Confirm NO folder has been renamed in this change — `git diff --diff-filter=R` must show zero folder moves
- [ ] 8.3 Confirm NO existing `*ListQuerySchema` has been modified — grep for changes in `package/contract/src/**` other than the new `list-query-base.ts` and the `index.ts` re-export
- [ ] 8.4 Open a follow-up change proposal `api-route-and-folder-migration` (via `/opsx:propose`) referencing this spec, so the migration work has a tracked home the moment this change is archived
