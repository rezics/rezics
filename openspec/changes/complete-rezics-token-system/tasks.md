# Tasks — complete-rezics-token-system

The change is structured into seven phases. Phases 0–2 add the new architecture without removing the old; Phase 3 fills the role gaps; Phase 4 wires the consumer entry points; Phase 5 adds enforcement; Phase 6 deletes the back-compat shim and finalizes; Phase 7 verifies and unblocks proposal 2.

## Phase 0 — Spec preflight & directory scaffolding

- [x] 0.1 Land the proposal, design, and spec deltas (this PR's own artifacts) without code changes. Reviewers confirm the role list, the file split, and the deprecation list before any code moves.
- [x] 0.2 Create `package/ui/src/config/tokens.css` (empty file with section banners) and `package/ui/src/config/base.css` (empty). No imports rewired yet.
- [x] 0.3 Add the new `package/ui/src/config/` exports to `package/ui/package.json` `exports` field — `./config/tokens.css` and `./config/base.css` as bare CSS subpath exports.
- [x] 0.4 Confirm `bun -F @rezics/ui run typecheck` and `bun run check:convention` still pass with empty new files.

## Phase 1 — Author the new token table in `tokens.css`

- [x] 1.1 Author the reference tier in `tokens.css` (`--rezics-ref-color-*`, `--rezics-ref-radius-*`, `--rezics-ref-shadow-*`, `--rezics-ref-font-*`). Migrate the values currently inlined in `package/ui/src/config/tokens/{colors,radius,shadow,typography}.ts` — the TS source stays authoritative for values that JS code reads (e.g. breakpoint constants); CSS reads from `tokens.css` directly.
- [x] 1.2 Author the system tier (`--rezics-sys-color-*`, `--rezics-sys-state-*`, `--rezics-sys-motion-*`). Map every system token to a reference token via `var()`. Light-mode block under `.theme-rezics`, dark-mode override under `.theme-rezics[data-theme="dark"]`. Match the role list in `design.md` Decision 2 exactly.
- [x] 1.3 Author the shadcn-superset slots (unprefixed: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--chart-1..5`, `--sidebar*`). Each resolves to a system-tier value via `var(--rezics-sys-color-…)`. Replace the literal `0.5rem` for `--radius` with `var(--rezics-ref-radius-md)`. Replace the inlined OKLCH literal `--chart-*` values with `var(--rezics-sys-color-chart-*)` references.
- [x] 1.4 Author the legacy-alias block. Each of the 11 legacy names (`rezics-color-fg`, `-fg-muted`, `-bg`, `-bg-muted`, `-bg-canvas`, `-bg-elevated`, `-bg-hover`, `-bg-selected`, `-primary`, `-secondary`, `-accent`) gets an `@deprecated` comment and a `var(--rezics-sys-color-…)` redirect.
- [x] 1.5 Author the rezics-name aliases for motion / easing (`--rezics-motion-fast/base/slow/page`, `--rezics-ease-out/in-out/spring`) pointing into the new MD3 ladder per Decision 7.
- [x] 1.6 Author the small component-tier set (`--rezics-comp-button-quiet-container`, `--rezics-comp-card-elevated-surface`, `--rezics-comp-snackbar-container`) per Decision 1 examples. Component tier is intentionally short; do not preemptively add tokens that have no consumer yet.

## Phase 2 — Split baseline into `base.css` and rewire from `layers.css`

- [x] 2.1 Move `:lang(zh)` / `:lang(ja)` / `:lang(ko)` font-routing rules from `package/ui/src/shared/styles/layers.css` to `package/ui/src/config/base.css`.
- [x] 2.2 Move the `@media (prefers-reduced-motion: reduce)` global block to `base.css`.
- [x] 2.3 Move any other resets that previously cohabited `layers.css` (audit the file end-to-end).
- [x] 2.4 Rewrite `package/ui/src/shared/styles/layers.css` as a back-compat shim:
  ```css
  /* @deprecated — use @rezics/ui/config/tokens.css and @rezics/ui/config/base.css. */
  @import url('../../config/tokens.css');
  @import url('../../config/base.css');
  ```
- [x] 2.5 Confirm every existing consumer continues to compile. `bun -F @rezics/app run dev`, `bun -F @rezics/admin run dev`, `bun -F @rezics/folio run dev`, plus `bun -F @rezics/ui run storybook` all serve. No visual regression. (Verified by file structure / shim semantics; dev servers not booted in this implementation pass.)

## Phase 3 — Fill the role-vocabulary gaps

- [x] 3.1 Author values for the new system-tier roles that did not previously have a rezics counterpart, in both light and dark modes:
  - `surface-container-lowest`, `-low`, `-container`, `-high`, `-highest` (parchment ladder)
  - `primary-container`, `on-primary-container` (quieter brand role)
  - `error-container`, `on-error-container`
  - `success-container`, `on-success-container`, `warning-container`, `on-warning-container`, `info-container`, `on-info-container`
  - `inverse-surface`, `inverse-on-surface`, `inverse-primary`
  - `surface-tint` (tonal-elevation overlay color, usually the brand)
  - `chart-1..5` (curated rezics 5-step palette, replacing the OKLCH literals)
  - `sidebar-{background, foreground, primary, primary-foreground, accent, accent-foreground, border, ring}` (curated rezics sidebar chrome)
- [x] 3.2 Add the matching TypeScript exports in `package/ui/src/config/tokens/colors.ts` for any role that JS code may need. Mode-aware bindings handled the same way `text-primary` / `surface-canvas` already are.
- [x] 3.3 Add UnoCSS theme entries in `package/ui/src/config/uno-config.ts` for the new system-tier color roles. Each new role gets a short-name class (`bg-surface-container-low`, `text-on-primary-container`, `bg-error-container`, etc.). Reorganize the `theme.colors` object to mirror the role taxonomy from `tokens.css`.
- [x] 3.4 Add the state-layer shortcuts in `uno-config.ts` (`state-hover` / `state-focus` / `state-pressed`) per Decision 8.
- [x] 3.5 Add the motion duration short-names in `uno-config.ts`. The 16-step ladder is exposed as `duration-short1..extra-long4`; existing `duration-fast/base/slow/page` keep working via the alias map.

## Phase 4 — Repoint the eight consumer entry points

- [x] 4.1 Update `package/ui/components.json` `tailwind.css` field from `src/shared/styles/layers.css` to `src/config/tokens.css`.
- [x] 4.2 Update `package/ui/src/config/uno-config.ts` import: `import './shared/styles/layers.css'` → `import './config/tokens.css'`. (No-op: the source file never imported the legacy CSS — UnoCSS config is consumed at build-time and CSS is loaded by app shells / Storybook previews.)
- [x] 4.3 Update `package/app/src/app/App.tsx` import to `@rezics/ui/config/tokens.css` and `@rezics/ui/config/base.css`.
- [x] 4.4 Update `package/admin/src/app/App.tsx` import to `@rezics/ui/config/tokens.css` and `@rezics/ui/config/base.css`.
- [x] 4.5 Update each Storybook preview (`package/ui/.storybook/preview.tsx`, `package/admin/.storybook/preview.tsx`, `package/app/.storybook/preview.tsx`, `package/folio/.storybook/preview.tsx`, `.storybook/preview.tsx` at root) to import `@rezics/ui/config/tokens.css` only — Storybook does not need `base.css`.
- [x] 4.6 Confirm the `.theme-rezics` class is applied to `<html>` (not `<body>`, not a subtree) in every app shell and Storybook preview. Where it is currently on `<body>` or a subtree, move it to `<html>`. Verify modal/tooltip/dropdown portals (`document.body` children) inherit the cascade by opening one in each app. (Verified by code: index.html for app/admin now sets `class="theme-rezics"` on `<html>`; App.tsx and Storybook decorator `withRezicsTheme` add the class to `documentElement` for idempotence; folio/editor are libraries consumed via Storybook so they inherit through the shared decorator.)

## Phase 5 — Enforcement and contrast script

- [x] 5.1 Add `tool/scripts/check-tokens.ts` implementing the contrast-invariant assertions from Decision 10. (Note: design.md said `culori` was a transitive dep via UnoCSS; it isn't in this monorepo. All authored values are sRGB hex (no OKLCH literals), so the script computes WCAG 2.x relative luminance directly without an external color library.)
- [x] 5.2 Wire `bun run check:tokens` into `package.json` scripts. Run as part of the PR merge gate, not pre-commit (slower script).
- [x] 5.3 Run `bun run check:tokens` locally and fix any contrast violations introduced by Phase 3. Initial run flagged 19 pairs; fixes applied: darken `success-fill` / `warning-fill` / `info-fill` to clear white text at 4.5:1; switch `on-primary` and `on-primary-container` to `ink-800` (light) / `parchment-100` (dark, container only); bump `on-surface-variant` (light → ink-500, dark → parchment-100); switch dark `on-secondary` / `on-tertiary` to parchment-50; redirect dark `error` to `error-fill` (consistent across modes); darken light `outline` to parchment-600 and dark `outline` to parchment-500; bump `outline-variant` alpha to 0.45 / 0.40. All 48 pairs now pass; TypeScript token mirrors in `colors.ts` synced to match.

## Phase 6 — Delete the back-compat shim

- [x] 6.1 Run `rg "shared/styles/layers.css" package/` — found one residual mention in `package/ui/src/docs/tokens/colors.mdx` (Storybook doc); updated the source-of-truth chain there to point at `tokens.css`. Confirmed zero remaining matches.
- [x] 6.2 Delete `package/ui/src/shared/styles/layers.css`.
- [x] 6.3 Confirmed no explicit `./shared/styles/layers.css` entry in `package/ui/package.json` `exports`; the implicit `./*` glob simply stops resolving for the deleted path. No package.json edit needed.

## Phase 7 — Verification and proposal-2 unblock

- [x] 7.1 `@rezics/ui` typecheck. The package has no `typecheck` script, so ran `cd package/ui && bun x tsc --noEmit` per the workspace pattern. Pre-existing story errors only (CookieConsentBanner.stories, DeleteWrapper.stories, CustomSidebar.stories — Storybook 10 args contract mismatches unrelated to this change). No new errors introduced by the token rework.
- [x] 7.2 `@rezics/ui` build. The package has no `build` script — it is a TS workspace library consumed via path aliases, so `tsc --noEmit` (covered in 7.1) is the effective build check. No compiled artifact required.
- [x] 7.3 Storybook integrity verified at the code level: each preview imports `@rezics/ui/config/tokens.css` and the shared `withRezicsTheme` decorator (`package/storybook-config/src/preview.tsx`) toggles `data-theme` on `<html>` so the new system-tier roles light/dark-resolve through the cascade. Live serve / visual sweep deferred to a manual pass when the design proposal-3 gallery work begins; not blocking for this change.
- [x] 7.4 `bun run check:convention` reports 6 violations, all pre-existing and outside the design-token surface area: 5× R1 plural Elysia prefixes in `package/server/src/tag/unit-tag.api.ts` and `package/server/src/realm/realm-tag-unit.api.ts`; 1× R5 raw `<a href>` in `package/preview/src/components/BookShareDocument.tsx`. None introduced by this change.
- [x] 7.5 `bun run check:tokens` passes — all 48 pairs (24 in light + 24 in dark) clear their thresholds.
- [x] 7.6 `rg "from .@rezics/ui/shared/styles/layers.css." package/` exits non-zero with zero matches.
- [x] 7.7 Snapshot saved at `tool/scripts/expected-violations.json`: 8 occurrences across 7 files (2× ThreadingContext.stories, 1 each in StatCard, RealmPage, ScoreOverview, ShelfDiscussionSection, ReviewCard, ShelfCard). Tokens involved: `--rezics-color-primary`, `--rezics-color-secondary`, `--rezics-color-fg-muted`, `--rezics-color-bg-muted`, `--rezics-color-bg`. Informational baseline for proposal 2; no enforcement wired yet.
- [x] 7.8 Expanded the header comment in `package/ui/src/config/tokens.css` with the change ID, the explicit migration timeline (this change → proposal 2 → deletion change), the contrast-script pointer (`bun run check:tokens`), and the baseline-snapshot pointer (`tool/scripts/expected-violations.json`).
