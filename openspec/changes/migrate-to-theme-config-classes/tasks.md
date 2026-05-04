# Tasks — migrate-to-theme-config-classes

The change is structured into six phases. Phase 0 is preflight (verify proposal 1 has shipped). Phase 1 builds the codemod and the substitution map. Phases 2A / 2B / 2C run the migration in three rolling commits by package group. Phase 3 cleans up dynamic-interpolation and inline-style cases the codemod skipped. Phase 4 turns on R9 and writes the docs. Phase 5 verifies and unblocks the legacy-alias-deletion follow-up.

## Phase 0 — Preflight

- [ ] 0.1 Confirm `complete-rezics-token-system` (proposal 1) has fully landed: `package/ui/src/config/tokens.css` exists, the legacy 11-name aliases are live with `@deprecated` comments, the new system-tier roles (`text-on-primary-container`, `bg-surface-container-low`, `inverse-surface`, etc.) are defined.
- [ ] 0.2 Run the proposal-1 baseline grep and capture the count: `rg "(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-" package/*/src/ | wc -l`. Persist the count to the proposal's tracking issue. This is the migration's starting baseline.
- [ ] 0.3 Run `rg "var\(--rezics-color-" package/*/src/ -l | grep -v "\.css$" | wc -l` and capture the count of `.tsx` / `.ts` files using inline `var(--rezics-*)`. Same purpose.

## Phase 1 — Author the codemod and the substitution map

- [ ] 1.1 Add `ts-morph` to the workspace devDependencies (root `package.json`, or `tool/scripts/package.json` if `tool/scripts/` has its own). Confirm it's not already a transitive dep we can reuse.
- [ ] 1.2 Author `tool/scripts/migrate-theme-classes.map.json` with the full substitution map per `design.md` Decision 2. Cover every rezics-color-prefixed name appearing in the codebase audit. Include the `ambiguous` block for `rezics-color-bg-selected` and any other ambiguous case the audit surfaces.
- [ ] 1.3 Author `tool/scripts/codemod-theme-classes.ts`. Implements:
  - JSX `Attribute name=className` traversal via ts-morph.
  - `CallExpression` traversal for `cn(…)` and `clsx(…)` (auto-detected from imports).
  - String-literal and static-template-segment substitution using the map.
  - `--dry-run` and `--apply` modes.
  - A `--report-skipped` flag that lists every skipped site (dynamic interpolation, comment-content, `*.fixture.ts`, etc.).
  - Idempotent: re-running on output is a no-op.
- [ ] 1.4 Run the codemod with `--dry-run` against `package/folio/src/`. Verify the diff matches expectations (sample 5 changes manually). Iterate the map until the dry-run is clean.
- [ ] 1.5 Add a smoke test for the codemod in `tool/scripts/codemod-theme-classes.test.ts` covering: (a) an exact-map substitution, (b) a `cn()` argument substitution, (c) a template-literal static-segment substitution, (d) a skipped dynamic-interpolation case, (e) an idempotency check. Run via `bun test tool/scripts/codemod-theme-classes.test.ts`.

## Phase 2A — Migrate Folio, Editor, Admin

- [ ] 2A.1 Run `bun tool/scripts/codemod-theme-classes.ts --apply package/folio/src/`. Commit per the standard PR flow.
- [ ] 2A.2 Run `bun -F @rezics/folio run typecheck` and verify Storybook serves with no visual regression (manual sweep of the index page).
- [ ] 2A.3 Run `--apply` against `package/editor/src/`. Commit. Typecheck. Manual visual sweep.
- [ ] 2A.4 Run `--apply` against `package/admin/src/`. Commit. Typecheck. Manual sweep of the admin dashboard, one detail page, and one form page.
- [ ] 2A.5 Verify `rg "(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-" package/{folio,editor,admin}/src/` returns zero matches.
- [ ] 2A.6 Verify `rg "rezics-color-(fg|bg|primary|secondary|accent)\b" package/{folio,editor,admin}/src/` returns zero matches.
- [ ] 2A.7 Resolve any `// TODO(R9-codemod):` comments inserted by the codemod for ambiguous-map cases.

## Phase 2B — Migrate App

- [ ] 2B.1 Run the codemod's `--report-skipped` mode against `package/app/src/`. Capture the skipped-sites list as the manual remediation backlog.
- [ ] 2B.2 Run `--apply` against `package/app/src/` *one feature subfolder at a time* — `core/`, `book/`, `post/`, `comment/`, `shelf/`, `search/`, `user/`, `tag/`, `realm/`, `feedback/`, `pinboard/`, `preference/`, `review/`, `editor/` (folio editor view), and the rest. One commit per subfolder.
- [ ] 2B.3 After each subfolder, run `bun -F @rezics/app run typecheck`. Visual sweep at end of every 3rd subfolder commit.
- [ ] 2B.4 Resolve all `// TODO(R9-codemod):` comments in `@rezics/app`.
- [ ] 2B.5 Verify zero matches for the long-form pattern in `package/app/src/`.

## Phase 2C — Migrate UI internals

- [ ] 2C.1 Run `--apply` against `package/ui/src/composite/`. Commit. Typecheck.
- [ ] 2C.2 Run `--apply` against `package/ui/src/primitive/`. Commit. Typecheck.
- [ ] 2C.3 Run `--apply` against `package/ui/src/shadcn/`. Commit. Typecheck. The shadcn folder is sensitive (these are shadcn-original files lightly customized) — visual sweep all primitives in Storybook after this commit.
- [ ] 2C.4 Run `--apply` against the remaining `package/ui/src/` files (utils, types, and any escape-hatch CSS-as-string patterns). Commit. Typecheck.
- [ ] 2C.5 Run `--apply` against `package/storybook-config/src/` and `package/app-shell/src/` (small, sweep at end). Commit per package.
- [ ] 2C.6 Verify `rg "(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-" package/*/src/` returns zero matches across the entire monorepo.

## Phase 3 — Clean up dynamic-interpolation and inline-style cases

- [ ] 3.1 Read `tool/scripts/codemod-theme-classes.ts --report-skipped` output for the entire monorepo. Group by category:
  - Dynamic-interpolation cases (`${variable}` segments).
  - String-concatenation cases (`"text-" + foo`).
  - Inline-style `var(--rezics-*)` cases (SVG `fill`, dynamic-color `style={{}}`).
- [ ] 3.2 For each dynamic-interpolation / concatenation case, rewrite manually. Most resolve to a small switch over canonical short-name classes:
  ```ts
  // before
  cn(`text-rezics-color-${variant}`)
  // after
  cn(variantToClass[variant])  // where variantToClass = { primary: "text-text-primary", muted: "text-text-secondary" }
  ```
- [ ] 3.3 For inline-style `var(--rezics-color-*)` cases that have a corresponding UnoCSS short class, replace inline style with the class.
- [ ] 3.4 For inline-style cases that *don't* have a clean class equivalent (SVG `fill`, gradient stops in `style`), choose:
  - (a) Promote them into a UnoCSS class by adding a `fill-chart-1` / similar shortcut to `uno-config.ts` and migrate the callsite. Preferred when ≥3 sites share the need.
  - (b) Update the reference from `var(--rezics-color-*)` (legacy / long-form) to `var(--rezics-sys-color-*)` (canonical) and add the file to `expected-violations.json` under the `R9` section with a comment. Acceptable for ≤2 sites.
- [ ] 3.5 Verify `rg "var\(--rezics-color-(fg|bg|primary|secondary|accent)\b" package/*/src/` returns zero matches in `.tsx` / `.ts` files (CSS files exempt).

## Phase 4 — Activate R9 and ship the docs

- [ ] 4.1 Implement R9 in `tool/scripts/check-convention.ts`:
  - Add `R9` to the `Rule` union type.
  - Add `R9: "openspec/specs/ui-component-foundation/spec.md"` to `SPEC_LINK`.
  - Implement the three pattern checks (long-form utility, raw `var(--rezics-…)` in className contexts, legacy generation names).
  - Wire the `expected-violations.json` `R9` allowlist (with the small SVG-inline exception list from Phase 3).
- [ ] 4.2 Run `bun run check:convention`. Confirm the R9 path returns zero violations.
- [ ] 4.3 Add `package/ui/src/config/README.md` per `design.md` Decision 5. One-pager pointing at the spec.
- [ ] 4.4 Add a top-of-file comment block in `package/ui/src/config/uno-config.ts` documenting the consumption-surface rule.
- [ ] 4.5 Update `CLAUDE.md`'s "Convention Enforcement" section (or an adjacent section) to mention R9 with one line and a link to the spec.

## Phase 5 — Verify and prepare for legacy-alias deletion

- [ ] 5.1 `bun run check:convention` passes with R9 active.
- [ ] 5.2 `bun run check:tokens` passes (regression check; this should be unaffected but verify).
- [ ] 5.3 `rg "(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-" package/*/src/` returns zero matches.
- [ ] 5.4 `rg "rezics-color-(fg|bg|primary|secondary|accent)\b" package/*/src/` returns zero matches in `.tsx` / `.ts` / `.mdx` files (CSS files still contain the alias definitions per proposal 1's Decision 6).
- [ ] 5.5 `rg "var\(--rezics-" package/*/src/` returns matches only in `.css` files plus the `expected-violations.json` allowlisted SVG-inline sites.
- [ ] 5.6 Every Storybook (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`) builds and serves. Manual visual sweep of one representative page per package; confirm no regression.
- [ ] 5.7 Type-check passes for every package.
- [ ] 5.8 Open a follow-up tracking issue: "Delete legacy 11-name aliases from `tokens.css`" — small, ready to land now that R9 confirms zero consumer usage. Not in scope for this change; the issue is the artifact that closes the loop.
